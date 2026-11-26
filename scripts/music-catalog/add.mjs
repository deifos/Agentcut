#!/usr/bin/env node
// Add a song to the hosted Agentcut music library, end to end. See scripts/music-catalog/README.md.
//
//   npm run music:add -- <song.mp3|wav|m4a|flac> --name "Night Drive Loop" --category electronic --env <file>
//
// 1. Checks the name is free and the category exists, converts to MP3 (320 kb/s) if needed, reads the length.
// 2. Uploads it to R2 as screenslick-music/<Name>.mp3 and checks the public URL serves it.
// 3. Adds the entry to lib/music-tracks.ts (at the end of its category).
// 4. Runs analyze.py so lib/music-analysis.json gets its tempo, energy, moods and shape.
//
// Flags: --dry-run (check and print, change nothing), --force (replace a different file already uploaded
// under that name), --no-analyze (skip step 4; run analyze.py yourself later), --id <slug> (default: from name).
// The upload needs CLOUDFLARE_BUCKET_API, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY and
// CLOUDFLARE_BUCKET_NAME (as for scripts/broll-index/sync.mjs), from --env <file> (or MUSIC_ENV_FILE / BROLL_ENV_FILE),
// the shell environment, or the repo's .env.local. Keys are never printed.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HERE = join(ROOT, "scripts", "music-catalog");
const TRACKS = join(ROOT, "lib", "music-tracks.ts");
const CDN = (process.env.NEXT_PUBLIC_MUSIC_CDN_URL || "https://media.vladpalacio.com").replace(/\/+$/, "");
const PREFIX = "screenslick-music";
const CATEGORIES = ["energetic", "chill", "cinematic", "electronic", "ambient"];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (["--dry-run", "--force", "--no-analyze"].includes(a)) out.flags.add(a.slice(2));
    else if (["--name", "--category", "--id", "--env"].includes(a)) out[a.slice(2)] = argv[++i];
    else if (a.startsWith("--")) fail(`Unknown flag ${a}.`);
    else if (!out.file) out.file = a;
    else fail(`Unexpected argument "${a}" (quote a name with spaces).`);
  }
  return out;
}

export const slug = (s) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function readCatalog() {
  const src = readFileSync(TRACKS, "utf8");
  const entries = [...src.matchAll(/id: "([^"]+)",\s*name: ("(?:[^"\\]|\\.)*"),\s*filename: ("(?:[^"\\]|\\.)*")/g)].map((m) => ({
    id: m[1],
    name: JSON.parse(m[2]),
    filename: JSON.parse(m[3]),
  }));
  return { src, entries };
}

function have(cmd) {
  return spawnSync(cmd, ["-version"], { stdio: "ignore" }).status === 0;
}

function probeSeconds(path) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" });
  const s = Number.parseFloat(out);
  if (!Number.isFinite(s) || s <= 0) fail(`Could not read the length of ${path}.`);
  return s;
}

function readEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** The R2 keys, from (first wins) the --env file, the shell environment, then the repo's .env.local and .env. */
function loadEnv(path) {
  if (path && !existsSync(path)) fail(`Env file not found: ${path}`);
  const sources = [
    ...(path ? [[path, readEnvFile(path)]] : []),
    ["the environment", process.env],
    ...[".env.local", ".env"].map((f) => join(ROOT, f)).filter(existsSync).map((f) => [f, readEnvFile(f)]),
  ];
  const out = {};
  const missing = [];
  for (const key of ["BUCKET_API", "ACCESS_KEY_ID", "SECRET_ACCESS_KEY", "BUCKET_NAME"]) {
    for (const [, env] of sources) out[key] ??= env[`CLOUDFLARE_${key}`] ?? env[`CLOUDFARE_${key}`];
    if (!out[key]) missing.push(`CLOUDFLARE_${key}`);
  }
  if (missing.length)
    fail(`Missing ${missing.join(", ")}. Add them to .env.local (git-ignored) or the environment, or pass --env <file>. Looked in: ${sources.map(([n]) => n).join(", ")}.`);
  return out;
}

// R2 speaks the S3 API: one signed PUT (AWS Signature V4, region "auto"), path-style.
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
const encodeKey = (key) =>
  key.split("/").map((p) => encodeURIComponent(p).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");

export async function r2Put(env, key, body, contentType, cacheControl) {
  const endpoint = new URL(env.BUCKET_API);
  const path = `/${encodeURIComponent(env.BUCKET_NAME)}/${encodeKey(key)}`;
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const headers = {
    "cache-control": cacheControl,
    "content-type": contentType,
    host: endpoint.host,
    "x-amz-content-sha256": sha256(body),
    "x-amz-date": amzDate,
  };
  const names = Object.keys(headers).sort();
  const canonical = ["PUT", path, "", ...names.map((n) => `${n}:${headers[n]}`), "", names.join(";"), headers["x-amz-content-sha256"]].join("\n");
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${env.SECRET_ACCESS_KEY}`, day), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  // fetch sets Host itself (to the same value that was signed).
  const sent = Object.fromEntries(Object.entries(headers).filter(([n]) => n !== "host"));
  const response = await fetch(`${endpoint.origin}${path}`, {
    method: "PUT",
    headers: { ...sent, authorization: `AWS4-HMAC-SHA256 Credential=${env.ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}` },
    body,
  });
  if (!response.ok) fail(`Upload failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
}

async function publicSize(url) {
  const response = await fetch(url, { method: "HEAD", cache: "no-store" });
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) fail(`Checking ${url} answered ${response.status}.`);
  return Number(response.headers.get("content-length"));
}

export function insertEntry(src, track) {
  const label = track.category[0].toUpperCase() + track.category.slice(1);
  const start = src.indexOf(`// ── ${label} ──`);
  if (start < 0) fail(`No "// ── ${label} ──" section in lib/music-tracks.ts.`);
  const nextSection = src.indexOf("// ──", start + 5);
  const end = nextSection > 0 ? nextSection : src.indexOf("];", start);
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const entry = [
    "  {",
    `    id: ${JSON.stringify(track.id)},`,
    `    name: ${JSON.stringify(track.name)},`,
    `    filename: ${JSON.stringify(track.filename)},`,
    `    category: ${JSON.stringify(track.category)},`,
    `    durationSeconds: ${track.durationSeconds},`,
    "  },",
    "",
  ].join(eol);
  // At the end of its category, as the library has grown so far (each section is alphabetical, then newer songs).
  // The section's trailing whitespace (blank line and indent before the next header) stays after the entry.
  const at = start + src.slice(start, end).trimEnd().length + eol.length;
  return src.slice(0, at) + entry + src.slice(at);
}

function earshotPython() {
  if (process.env.EARSHOT_PY) return process.env.EARSHOT_PY;
  const dir = process.env.EARSHOT_DIR || "E:/projects/earshot";
  for (const p of [join(dir, ".venv", "Scripts", "python.exe"), join(dir, ".venv", "bin", "python")]) if (existsSync(p)) return p;
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dry = args.flags.has("dry-run");
  if (!args.file || !args.name || !args.category)
    fail('Usage: npm run music:add -- <song file> --name "Song Name" --category <energetic|chill|cinematic|electronic|ambient> --env <file>');
  const file = resolve(args.file);
  if (!existsSync(file)) fail(`File not found: ${file}`);
  const name = args.name.trim().replace(/\s+/g, " ");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '&,.()!-]*$/u.test(name) || name.length > 60)
    fail(`"${name}" is not a usable song name: letters, numbers, spaces and ' & , . ( ) ! - only, at most 60 characters.`);
  const category = args.category.toLowerCase();
  if (!CATEGORIES.includes(category)) fail(`Category must be one of: ${CATEGORIES.join(", ")}.`);
  const id = args.id ?? slug(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(`"${id}" is not a usable id (lowercase words joined by dashes).`);
  const filename = `${name}.mp3`;
  const { src, entries } = readCatalog();
  const clash = entries.find((e) => e.id === id || e.filename.toLowerCase() === filename.toLowerCase());
  if (clash) fail(`The library already has "${clash.name}" (${clash.id}). Pick another name or --id.`);
  if (!have("ffmpeg") || !have("ffprobe")) fail("ffmpeg and ffprobe must be on PATH.");

  // 1. MP3 at 320 kb/s (an MP3 is uploaded as it is).
  let mp3 = file;
  if (extname(file).toLowerCase() !== ".mp3") {
    mp3 = join(mkdtempSync(join(tmpdir(), "agentcut-music-")), filename);
    console.log(`Converting to MP3: ${mp3}`);
    try {
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-vn", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100", mp3], { stdio: ["ignore", "ignore", "pipe"] });
    } catch (error) {
      fail(`Could not convert ${file} to MP3 (is it an audio file?): ${String(error.stderr ?? error.message).trim().split(/\r?\n/).pop()}`);
    }
  }
  const seconds = probeSeconds(mp3);
  const durationSeconds = Math.round(seconds);
  if (durationSeconds < 10) fail(`The file is only ${seconds.toFixed(1)} s long; the library is for songs.`);
  const body = readFileSync(mp3);
  const url = `${CDN}/${PREFIX}/${encodeURIComponent(filename)}`;
  const track = { id, name, filename, category, durationSeconds };
  console.log(`\nSong:     ${name}  (${id})\nCategory: ${category}\nLength:   ${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}\nSize:     ${(body.length / 1e6).toFixed(1)} MB\nURL:      ${url}`);

  // 2. Upload, unless the same file is already there.
  const existing = await publicSize(url);
  if (existing === body.length) console.log("\n✓ Already uploaded (same size), skipping the upload.");
  else if (existing != null && !args.flags.has("force"))
    fail(`A different file (${existing} bytes) is already uploaded as ${filename}. Use --force to replace it, or another name.`);
  else if (dry) console.log("\n(dry run) Would upload it.");
  else {
    const env = loadEnv(args.env ?? process.env.MUSIC_ENV_FILE ?? process.env.BROLL_ENV_FILE);
    console.log("\nUploading to R2...");
    // The URL is the file's name, so a replaced file must not be cached for long.
    await r2Put(env, `${PREFIX}/${filename}`, body, "audio/mpeg", "public, max-age=86400");
    const served = await publicSize(`${url}?v=${Date.now()}`);
    if (served !== body.length) fail(`Uploaded, but ${url} serves ${served ?? "nothing"} instead of ${body.length} bytes. Check the bucket's public domain.`);
    console.log("✓ Uploaded and served at the public URL.");
  }
  if (dry) {
    console.log("(dry run) Would add the entry to lib/music-tracks.ts and run analyze.py.\n");
    return;
  }

  // 3. The catalog entry.
  writeFileSync(TRACKS, insertEntry(src, track));
  console.log(`✓ Added ${id} to lib/music-tracks.ts (${category}).`);

  // 4. Analysis (a local copy in the cache spares analyze.py the download).
  mkdirSync(join(HERE, "cache"), { recursive: true });
  copyFileSync(mp3, join(HERE, "cache", filename));
  const py = earshotPython();
  if (args.flags.has("no-analyze") || !py) {
    if (!py) console.log("\n! The earshot venv was not found (set EARSHOT_DIR or EARSHOT_PY).");
    console.log("Run the analysis before committing:  <earshot venv python> -I scripts/music-catalog/analyze.py");
  } else {
    console.log("\nAnalyzing (tempo, energy, moods, shape)...");
    const run = spawnSync(py, ["-I", join(HERE, "analyze.py")], { cwd: ROOT, stdio: "inherit", env: { ...process.env, EARSHOT_THREADS: process.env.EARSHOT_THREADS ?? "3" } });
    if (run.status !== 0) fail("analyze.py failed. The song is uploaded and listed; fix the error and run analyze.py again.");
    const analysis = JSON.parse(readFileSync(join(ROOT, "lib", "music-analysis.json"), "utf8"))[id];
    if (analysis) console.log(`✓ ${id}: ${analysis.bpm} bpm, energy ${analysis.energy}/5, ${analysis.vocals ? "vocals" : "instrumental"}, ${[...analysis.genres, ...analysis.moods].join(", ")}  ${analysis.shape}`);
  }
  console.log(`\nNext: npm run test:music, add a line under Unreleased in CHANGELOG.md, then commit lib/music-tracks.ts and lib/music-analysis.json.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
