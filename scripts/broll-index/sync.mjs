// Uploads the built catalog (out/) to R2 under agentcut/broll/: only files not uploaded yet, the index last,
// so the live catalog never points at a missing file. With --loop it repeats, for a catalog that grows
// while the indexer runs.
//   BROLL_DATA=E:/agentcut-broll BROLL_ENV_FILE=path/to/.env node sync.mjs [--loop minutes]
// The env file needs CLOUDFLARE_BUCKET_API, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY and
// CLOUDFLARE_BUCKET_NAME (the CLOUDFARE_* spelling works too). Keys are read, never printed.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DATA, OUT_DIR, readJson, writeJson } from "./lib.mjs";

const PREFIX = process.env.BROLL_PREFIX ?? "agentcut/broll";
const CONCURRENCY = 6;

function loadEnv(path) {
  if (!path || !existsSync(path)) throw new Error("Set BROLL_ENV_FILE to an env file with the CLOUDFLARE_* keys.");
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  const out = {};
  for (const key of ["BUCKET_API", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    out[key] = env[`CLOUDFLARE_${key}`] ?? env[`CLOUDFARE_${key}`];
    if (!out[key]) throw new Error(`CLOUDFLARE_${key} is missing from the env file.`);
  }
  return out;
}

const env = loadEnv(process.env.BROLL_ENV_FILE);
const bucket = env.BUCKET_NAME;
const client = new S3Client({
  region: "auto",
  endpoint: env.BUCKET_API,
  credentials: { accessKeyId: env.ACCESS_KEY_ID, secretAccessKey: env.SECRET_ACCESS_KEY },
});
// One record of uploaded files per bucket and folder.
const LEDGER = join(DATA, `uploaded-${bucket}-${PREFIX.replace(/[^a-z0-9]+/gi, "_")}.json`);

const TYPES = { ".json": "application/json", ".webp": "image/webp", ".mp4": "video/mp4", ".i8": "application/octet-stream" };
// Shots, thumbnails and versioned vectors never change; the index is replaced as the catalog grows.
const IMMUTABLE = "public, max-age=31536000, immutable";
const INDEX_CACHE = "public, max-age=300";

async function put(rel, body, cacheControl) {
  const ext = rel.slice(rel.lastIndexOf("."));
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${PREFIX}/${rel}`,
      Body: body,
      ContentType: TYPES[ext] ?? "application/octet-stream",
      CacheControl: cacheControl,
    }),
  );
}

const BROWSE_SHOTS = 240;

function browseHash(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

// The latest additions lead the browse order (newest film first, at most 2 shots each), then the shuffle.
// Same rule as browseOrder in lib/studio/broll/search.worker.ts, so "Show more" carries on seamlessly.
const LATEST_SHOTS = 96;
const LATEST_PER_FILM = 2;

function browseOrder(shots) {
  const browsable = shots.filter((s) => !s.titleCard && s.brightness >= 35);
  const byFilm = new Map();
  for (const shot of browsable) byFilm.set(shot.film.id, [...(byFilm.get(shot.film.id) ?? []), shot]);
  const latest = [];
  for (const film of [...byFilm.keys()].reverse()) {
    if (latest.length >= LATEST_SHOTS) break;
    const picks = [...byFilm.get(film)].sort((a, b) => browseHash(a.id) - browseHash(b.id));
    latest.push(...picks.slice(0, Math.min(LATEST_PER_FILM, LATEST_SHOTS - latest.length)));
  }
  const first = new Set(latest);
  const rest = browsable.filter((s) => !first.has(s)).sort((a, b) => browseHash(a.id) - browseHash(b.id));
  return [...latest, ...rest];
}

async function pool(items, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

async function syncOnce() {
  const indexPath = join(OUT_DIR, "shots.json");
  if (!existsSync(indexPath)) return console.log("sync: nothing built yet");
  const indexText = readFileSync(indexPath, "utf8");
  const index = JSON.parse(indexText);
  const ledger = readJson(LEDGER, {});
  const files = index.shots.flatMap((s) => [s.thumb, s.preview, s.full]).filter((rel) => !ledger[rel]);
  let bytes = 0;
  const started = Date.now();
  await pool(files, async (rel) => {
    const path = join(OUT_DIR, rel);
    if (!existsSync(path)) return;
    const body = readFileSync(path);
    await put(rel, body, IMMUTABLE);
    ledger[rel] = statSync(path).size;
    bytes += body.length;
    // Save progress now and then, so an interrupted upload resumes instead of starting over.
    if (Object.keys(ledger).length % 50 === 0) writeJson(LEDGER, ledger);
  });
  writeJson(LEDGER, ledger);
  // The shot videos live on R2 now: drop the local copies so a long run doesn't fill the disk
  // (thumbnails stay, they're tiny). The indexer knows a shot was cut from its recorded sizes.
  let pruned = 0;
  for (const rel of Object.keys(ledger)) {
    if (!rel.endsWith(".mp4")) continue;
    const path = join(OUT_DIR, rel);
    if (existsSync(path)) {
      rmSync(path, { force: true });
      pruned++;
    }
  }
  if (pruned) console.log(`sync: removed ${pruned} uploaded videos from disk`);
  // Vectors under a content name, then the index pointing at them: one switch, never half a catalog.
  const vectors = readFileSync(join(OUT_DIR, "vectors.i8"));
  // The indexer may be mid-build: only publish a matching pair.
  if (vectors.length !== index.count * index.dim) return console.log("sync: index and vectors out of step, next round");
  const vectorsFile = `vectors-${createHash("sha1").update(vectors).digest("hex").slice(0, 12)}.i8`;
  if (!ledger[vectorsFile]) {
    await put(vectorsFile, vectors, IMMUTABLE);
    ledger[vectorsFile] = vectors.length;
    writeJson(LEDGER, ledger);
  }
  const live = JSON.stringify({ ...index, vectorsFile });
  const liveHash = createHash("sha1").update(live).digest("hex");
  if (ledger["shots.json"] !== liveHash) {
    await put("shots.json", live, INDEX_CACHE);
    ledger["shots.json"] = liveHash;
    writeJson(LEDGER, ledger);
  }
  // The opening grid on the b-roll page: the start of the same stable shuffle the studio's search worker
  // browses (lib/studio/broll/search.worker.ts), so "Show more" carries on where this file ends.
  const browsable = browseOrder(index.shots);
  const browse = JSON.stringify({ total: index.count, matches: browsable.length, shots: browsable.slice(0, BROWSE_SHOTS) });
  const browseSum = createHash("sha1").update(browse).digest("hex");
  if (ledger["browse.json"] !== browseSum) {
    await put("browse.json", browse, INDEX_CACHE);
    ledger["browse.json"] = browseSum;
    writeJson(LEDGER, ledger);
  }
  console.log(
    `${new Date().toISOString().slice(11, 19)} sync: ${index.count} shots live, ${files.length} new files ` +
      `(${(bytes / 1e6).toFixed(0)} MB in ${((Date.now() - started) / 1000).toFixed(0)} s)`,
  );
}

const loopAt = process.argv.indexOf("--loop");
const minutes = loopAt >= 0 ? Number(process.argv[loopAt + 1] ?? 30) : 0;
for (;;) {
  try {
    await syncOnce();
  } catch (error) {
    console.error(`sync failed: ${error instanceof Error ? error.message : error}`);
  }
  if (!minutes) break;
  await new Promise((r) => setTimeout(r, minutes * 60_000));
}
