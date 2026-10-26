// Agentcut b-roll indexer: public-domain archive.org films → shots with descriptions, tags,
// motion numbers and SigLIP vectors, plus a preview and a full-quality cut per shot.
//
//   BROLL_DATA=E:/agentcut-broll node index.mjs <step|all> [filmId ...]
//
// Steps (each skips work already done, so a crash or a new film never redoes the rest):
//   fetch     metadata (public-domain only) and the h.264 derivative used for analysis
//   shots     scene detection → shots of 1.5–14 s
//   analyze   3 frames + a thumbnail per shot, motion and loop numbers
//   measure   camera movement and calm area for text, measured (the vision model guesses these poorly)
//   describe  description and tags from a local vision model (Ollama)
//   embed     SigLIP image vector per shot (Transformers.js)
//   cut       preview.mp4 (from the derivative) and full.mp4 (from the original), timed
//   pipeline  all of the above per film, overlapped, rebuilding the index after each film
//   build     out/shots.json + out/vectors.i8 (the files the CDN serves; vectors.f32 for serve.mjs)
import { existsSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  archiveFileUrl,
  archiveJson,
  download,
  ensureDir,
  ffmpeg,
  FILMS_DIR,
  loadFilm,
  normalize,
  OUT_DIR,
  probeDuration,
  readJson,
  saveFilm,
  shotId,
  WORK_DIR,
  writeJson,
} from "./lib.mjs";
import { describeShot, DESCRIBE_MODEL } from "./describe.mjs";
import { embedImages, EMBED_MODEL } from "./embed.mjs";
import { measureFilm } from "./measure.mjs";

const SCENE_THRESHOLD = 0.3;
const EDGE_TRIM_S = 0.12; // skip the frames right at a cut (dissolves, splices)
const MIN_SHOT_S = 1.5;
const MAX_SHOT_S = 14;
const SPLIT_TARGET_S = 10;
const FRAME_POINTS = [0.2, 0.5, 0.8];
// Timing test of cutting straight from archive.org (it averaged ~20 s a shot): off unless asked for.
const REMOTE_CUT_SAMPLES = Number(process.env.BROLL_REMOTE_TESTS ?? 0);
const MAX_ORIGINAL_BYTES = 3e9;
const BACKGROUND_CALM = 0.35;
const BACKGROUND_MOTION = 8;

// Derivative to analyze (small, decodes fast) and preferred originals for the full cut.
const INDEX_FORMATS = ["h.264", "h.264 IA", "MPEG4", "512Kb MPEG4"];
const VIDEO_FORMATS = new Set([
  ...INDEX_FORMATS,
  "MPEG2",
  "MPEG1",
  "QuickTime",
  "Matroska",
  "Apple ProRes",
  "HiRes MPEG4",
  "Ogg Video",
  "Cinepack",
]);

const first = (value) => (Array.isArray(value) ? value[0] : value);
const pixels = (f) => Number(f.width || 0) * Number(f.height || 0);

async function stepFetch(id) {
  let film = loadFilm(id);
  if (!film) {
    const meta = await archiveJson(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    const m = meta.metadata ?? {};
    const license = String(first(m.licenseurl) ?? "");
    if (!/publicdomain|\/zero\//i.test(license)) {
      throw new Error(`${id}: not marked public domain (licenseurl "${license}"), skipped`);
    }
    const videos = (meta.files ?? []).filter((f) => VIDEO_FORMATS.has(f.format) && pixels(f) > 0);
    const index = INDEX_FORMATS.map((fmt) => videos.find((f) => f.format === fmt)).find(Boolean);
    if (!index) throw new Error(`${id}: no h.264/MPEG4 derivative to analyze`);
    const sized = videos.filter((f) => Number(f.size ?? 0) < MAX_ORIGINAL_BYTES);
    const originals = sized.filter((f) => f.source === "original");
    const full = [...(originals.length ? originals : sized.length ? sized : [index])].sort((a, b) => pixels(b) - pixels(a))[0];
    film = {
      id,
      title: String(first(m.title) ?? id),
      year: Number(String(first(m.year) ?? first(m.date) ?? "").slice(0, 4)) || null,
      color: String(first(m.color) ?? ""),
      collection: [].concat(m.collection ?? []),
      license,
      sourceUrl: `https://archive.org/details/${id}`,
      description: String(first(m.description) ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600),
      files: {
        index: { name: index.name, format: index.format, width: +index.width, height: +index.height, md5: index.md5 },
        full: { name: full.name, format: full.format, width: +full.width, height: +full.height, md5: full.md5, size: +full.size },
      },
      timings: {},
    };
    saveFilm(film);
  }
  const local = join(FILMS_DIR, id, "index.mp4");
  if (!existsSync(local)) {
    const { bytes, seconds } = await download(archiveFileUrl(id, film.files.index.name), local);
    film.timings.indexDownload = { bytes, seconds, mbps: +((bytes * 8) / 1e6 / seconds).toFixed(2) };
    saveFilm(film);
    console.log(`  ${id}: index file ${(bytes / 1e6).toFixed(1)} MB in ${seconds.toFixed(1)} s`);
  }
  return film;
}

async function stepShots(film) {
  if (film.shots) return;
  const src = join(FILMS_DIR, film.id, "index.mp4");
  const started = Date.now();
  const duration = await probeDuration(src);
  const { stderr } = await ffmpeg(
    ["-i", src, "-an", "-vf", `select='gt(scene,${SCENE_THRESHOLD})',showinfo`, "-f", "null", "-"],
    { stdout: "ignore" },
  );
  const cuts = [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
  const bounds = [0, ...cuts.filter((t) => t > 0 && t < duration), duration];
  const shots = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i] + EDGE_TRIM_S;
    const end = bounds[i + 1] - EDGE_TRIM_S;
    const length = end - start;
    if (length < MIN_SHOT_S) continue;
    // Long takes become several shots so each one stays a usable b-roll length.
    const parts = length > MAX_SHOT_S ? Math.ceil(length / SPLIT_TARGET_S) : 1;
    for (let p = 0; p < parts; p++) {
      const s = start + (length * p) / parts;
      const e = start + (length * (p + 1)) / parts;
      shots.push({ id: shotId(film.id, shots.length), start: +s.toFixed(3), end: +e.toFixed(3), longTake: parts > 1 });
    }
  }
  film.duration = duration;
  film.cuts = cuts.length;
  film.shots = shots;
  film.timings.shots = { seconds: (Date.now() - started) / 1000 };
  saveFilm(film);
  console.log(`  ${film.id}: ${cuts.length} cuts → ${shots.length} shots`);
}

/** Mean absolute difference (0–255) between two gray frames. */
function frameDiff(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

async function stepAnalyze(film) {
  const src = join(FILMS_DIR, film.id, "index.mp4");
  const framesDir = ensureDir(join(WORK_DIR, film.id, "frames"));
  const thumbsDir = ensureDir(join(OUT_DIR, "thumbs"));
  const started = Date.now();
  let done = 0;
  for (const shot of film.shots) {
    if (shot.motion !== undefined) continue;
    const length = shot.end - shot.start;
    shot.frames = [];
    for (const [k, point] of FRAME_POINTS.entries()) {
      const file = join(framesDir, `${shot.id}-${k}.jpg`);
      await ffmpeg(["-ss", (shot.start + length * point).toFixed(3), "-i", src, "-frames:v", "1", "-vf", "scale=448:-2", "-q:v", "3", file]);
      shot.frames.push(`frames/${shot.id}-${k}.jpg`);
    }
    await ffmpeg([
      "-ss", (shot.start + length * 0.5).toFixed(3), "-i", src, "-frames:v", "1",
      "-vf", "scale=360:-2", "-c:v", "libwebp", "-quality", "72", join(thumbsDir, `${shot.id}.webp`),
    ]);
    // Motion: mean frame-to-frame change at 6 fps on a 64×48 gray copy. Loop: first vs last frame.
    const w = 64;
    const h = 48;
    const { stdout } = await ffmpeg([
      "-ss", shot.start.toFixed(3), "-t", length.toFixed(3), "-i", src, "-an",
      "-vf", `fps=6,scale=${w}:${h},format=gray`, "-f", "rawvideo", "-",
    ]);
    const size = w * h;
    const count = Math.floor(stdout.length / size);
    const frames = Array.from({ length: count }, (_, i) => stdout.subarray(i * size, (i + 1) * size));
    let motion = 0;
    for (let i = 1; i < count; i++) motion += frameDiff(frames[i - 1], frames[i]);
    let brightness = 0;
    for (const f of frames) for (const v of f) brightness += v;
    shot.motion = count > 1 ? +(motion / (count - 1)).toFixed(2) : 0;
    shot.loopDiff = count > 1 ? +frameDiff(frames[0], frames[count - 1]).toFixed(2) : 0;
    shot.brightness = count ? +(brightness / (count * size)).toFixed(1) : 0;
    done++;
  }
  if (done) {
    film.timings.analyze = { seconds: (Date.now() - started) / 1000, shots: done };
    saveFilm(film);
    console.log(`  ${film.id}: analyzed ${done} shots`);
  }
}

async function stepDescribe(film) {
  const started = Date.now();
  let done = 0;
  for (const shot of film.shots) {
    if (shot.describe) continue;
    const t = Date.now();
    shot.describe = await describeShot(
      shot.frames.map((f) => join(WORK_DIR, film.id, f)),
      { title: film.title, year: film.year },
    );
    shot.describeSeconds = (Date.now() - t) / 1000;
    saveFilm(film); // describing is the slow step: keep every result
    done++;
    console.log(`  ${shot.id} (${shot.describeSeconds.toFixed(1)} s): ${shot.describe.description}`);
  }
  if (done) {
    film.timings.describe = { seconds: (Date.now() - started) / 1000, shots: done, model: DESCRIBE_MODEL };
    saveFilm(film);
  }
}

async function stepEmbed(film) {
  const vectorsPath = join(WORK_DIR, film.id, "vectors.json");
  const vectors = readJson(vectorsPath, {});
  const todo = film.shots.filter((s) => !vectors[s.id]);
  if (!todo.length) return;
  const started = Date.now();
  for (const shot of todo) {
    // Average the three frames so the vector covers the whole shot, not one instant.
    const perFrame = await embedImages(shot.frames.map((f) => join(WORK_DIR, film.id, f)));
    const mean = new Array(perFrame[0].length).fill(0);
    for (const v of perFrame) for (let i = 0; i < v.length; i++) mean[i] += v[i];
    vectors[shot.id] = normalize(mean).map((v) => +v.toFixed(6));
  }
  writeJson(vectorsPath, vectors);
  film.timings.embed = { seconds: (Date.now() - started) / 1000, shots: todo.length, model: EMBED_MODEL };
  saveFilm(film);
  console.log(`  ${film.id}: embedded ${todo.length} shots`);
}

/** Every described shot is published; flags (title card, sensitive, quality) are data for filtering, not exclusions. */
function usable(shot) {
  return Boolean(shot.describe);
}

// Square pixels (MPEG-2 masters are often anamorphic), progressive, even sizes.
const FULL_FILTER = "bwdif=mode=send_frame:deint=interlaced,scale=trunc(iw*sar/2)*2:ih,setsar=1";

async function stepCut(film) {
  const indexSrc = join(FILMS_DIR, film.id, "index.mp4");
  const originalUrl = archiveFileUrl(film.id, film.files.full.name);
  const ext = film.files.full.name.split(".").pop();
  const original = join(FILMS_DIR, film.id, `original.${ext}`);
  const shots = film.shots.filter(usable);
  film.timings.remoteCuts ??= [];

  // Timing test: cut straight from archive.org (seeking inside the remote original), no download.
  for (const shot of shots.slice(film.timings.remoteCuts.length, REMOTE_CUT_SAMPLES)) {
    const tmp = join(WORK_DIR, film.id, `remote-test-${shot.id}.mp4`);
    const t = Date.now();
    try {
      await ffmpeg([
        "-ss", shot.start.toFixed(3), "-t", (shot.end - shot.start).toFixed(3), "-i", originalUrl, "-an",
        "-vf", FULL_FILTER, "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", tmp,
      ]);
      film.timings.remoteCuts.push({ shot: shot.id, seconds: (Date.now() - t) / 1000, length: +(shot.end - shot.start).toFixed(2) });
    } catch (error) {
      film.timings.remoteCuts.push({ shot: shot.id, error: String(error.message).slice(0, 300) });
    }
    rmSync(tmp, { force: true });
    saveFilm(film);
  }

  // An original only earns its download when it has more pixels than the derivative we already have
  // (most Prelinger MPEG-2 masters are the same 640×480, just a bigger file).
  const betterOriginal = pixels(film.files.full) > pixels(film.files.index) * 1.1;
  const fullSrc = betterOriginal ? original : indexSrc;
  film.fullSource = betterOriginal ? film.files.full.name : film.files.index.name;
  if (betterOriginal && !existsSync(original)) {
    const { bytes, seconds } = await download(originalUrl, original);
    film.timings.originalDownload = { bytes, seconds, mbps: +((bytes * 8) / 1e6 / seconds).toFixed(2) };
    saveFilm(film);
    console.log(`  ${film.id}: original ${(bytes / 1e6).toFixed(0)} MB in ${seconds.toFixed(0)} s`);
  }

  let done = 0;
  const started = Date.now();
  for (const shot of shots) {
    const dir = ensureDir(join(OUT_DIR, "shots", shot.id));
    const preview = join(dir, "preview.mp4");
    const full = join(dir, "full.mp4");
    const range = ["-ss", shot.start.toFixed(3), "-t", (shot.end - shot.start).toFixed(3)];
    if (!existsSync(preview)) {
      await ffmpeg([
        ...range, "-i", indexSrc, "-an", "-vf", "scale=-2:'min(480,ih)'",
        "-c:v", "libx264", "-crf", "27", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", preview,
      ]);
    }
    if (!existsSync(full)) {
      await ffmpeg([
        ...range, "-i", fullSrc, "-an", "-vf", FULL_FILTER,
        "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", full,
      ]);
      done++;
    }
    shot.bytes = { preview: statSync(preview).size, full: statSync(full).size };
  }
  film.timings.cut = { seconds: (Date.now() - started) / 1000, shots: done };
  saveFilm(film);
  console.log(`  ${film.id}: cut ${done} shots`);
}

function stepBuild(ids) {
  const records = [];
  const vectors = [];
  let dim = 0;
  for (const id of ids) {
    const film = loadFilm(id);
    if (!film?.shots) continue;
    const filmVectors = readJson(join(WORK_DIR, id, "vectors.json"), {});
    const measured = readJson(join(WORK_DIR, id, "measure.json"), {});
    for (const shot of film.shots) {
      if (!usable(shot) || !filmVectors[shot.id] || !shot.bytes) continue;
      const d = shot.describe;
      const m = measured[shot.id];
      dim = filmVectors[shot.id].length;
      vectors.push(filmVectors[shot.id]);
      records.push({
        id: shot.id,
        film: { id: film.id, title: film.title, year: film.year, url: film.sourceUrl, license: film.license },
        start: shot.start,
        end: shot.end,
        seconds: +(shot.end - shot.start).toFixed(2),
        description: d.description,
        subjects: d.subjects,
        setting: d.setting,
        mood: d.mood,
        tags: d.tags,
        shotSize: d.shot_size,
        // Measured where available: the vision model calls most still shots "pan".
        camera: m?.camera ?? d.camera,
        people: d.people,
        color: d.color,
        // Room for text on top: a third of the frame flat, steady, no text of its own.
        backgroundOk: m ? m.calmShare >= BACKGROUND_CALM && shot.motion <= BACKGROUND_MOTION && !d.text_on_screen : d.background_ok,
        calmShare: m?.calmShare,
        textOnScreen: d.text_on_screen,
        titleCard: d.title_card,
        sensitive: d.sensitive,
        quality: d.quality,
        motion: shot.motion,
        loopDiff: shot.loopDiff,
        brightness: shot.brightness,
        width: film.fullSource === film.files.full.name ? film.files.full.width : film.files.index.width,
        height: film.fullSource === film.files.full.name ? film.files.full.height : film.files.index.height,
        thumb: `thumbs/${shot.id}.webp`,
        preview: `shots/${shot.id}/preview.mp4`,
        full: `shots/${shot.id}/full.mp4`,
        bytes: shot.bytes,
      });
    }
  }
  const flat = new Float32Array(records.length * dim);
  vectors.forEach((v, i) => flat.set(v, i * dim));
  writeFileSync(join(ensureDir(OUT_DIR), "vectors.f32"), Buffer.from(flat.buffer));
  // What the studio downloads: int8 (a quarter of the size), one scale for the whole file.
  let peak = 0;
  for (const v of flat) peak = Math.max(peak, Math.abs(v));
  const vectorScale = peak / 127 || 1;
  const int8 = Int8Array.from(flat, (v) => Math.round(v / vectorScale));
  writeFileSync(join(OUT_DIR, "vectors.i8"), Buffer.from(int8.buffer));
  writeJson(join(OUT_DIR, "shots.json"), {
    version: 1,
    builtAt: new Date().toISOString(),
    embedModel: EMBED_MODEL,
    describeModel: DESCRIBE_MODEL,
    dim,
    vectorScale,
    count: records.length,
    shots: records,
  });
  console.log(`build: ${records.length} shots, ${dim}-d vectors → ${OUT_DIR}`);
}

function report(ids) {
  const rows = ids.map(loadFilm).filter(Boolean);
  const sum = (pick) => rows.reduce((a, f) => a + (pick(f) ?? 0), 0);
  const shots = sum((f) => f.shots?.length);
  const usableShots = sum((f) => f.shots?.filter(usable).length);
  const filmMinutes = sum((f) => f.duration) / 60;
  const remote = rows.flatMap((f) => f.timings.remoteCuts ?? []).filter((r) => r.seconds);
  const summary = {
    films: rows.length,
    filmMinutes: +filmMinutes.toFixed(1),
    shots,
    usableShots,
    secondsPerShot: {
      analyze: +(sum((f) => f.timings.analyze?.seconds) / shots).toFixed(2),
      describe: +(sum((f) => f.timings.describe?.seconds) / shots).toFixed(2),
      embed: +(sum((f) => f.timings.embed?.seconds) / shots).toFixed(2),
      cut: +(sum((f) => f.timings.cut?.seconds) / Math.max(1, usableShots)).toFixed(2),
    },
    remoteCutFromArchive: remote.length
      ? {
          samples: remote.length,
          avgSeconds: +(remote.reduce((a, r) => a + r.seconds, 0) / remote.length).toFixed(1),
          maxSeconds: Math.max(...remote.map((r) => r.seconds)),
          failures: rows.flatMap((f) => f.timings.remoteCuts ?? []).filter((r) => r.error).length,
        }
      : null,
    downloadsMbps: rows.map((f) => ({ film: f.id, index: f.timings.indexDownload?.mbps, original: f.timings.originalDownload?.mbps })),
    outBytes: {
      preview: sum((f) => f.shots?.reduce((a, s) => a + (s.bytes?.preview ?? 0), 0)),
      full: sum((f) => f.shots?.reduce((a, s) => a + (s.bytes?.full ?? 0), 0)),
    },
  };
  writeJson(join(OUT_DIR, "report.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
}

const STEPS = ["fetch", "shots", "analyze", "measure", "describe", "embed", "cut"];

/**
 * Every step for every film, overlapped: the next film downloads and is analyzed (network, CPU) while
 * the current one is described (GPU). The index is rebuilt after each film, so it's searchable mid-run.
 */
async function runPipeline(ids) {
  const ready = [];
  let producing = true;
  let wake = null;
  const producer = (async () => {
    for (const id of ids) {
      try {
        await stepFetch(id);
        const film = loadFilm(id);
        await stepShots(film);
        await stepAnalyze(film);
        await measureFilm(film);
        ready.push(id);
      } catch (error) {
        console.error(`  ${id}: ${error instanceof Error ? error.message : error}`);
      }
      wake?.();
    }
    producing = false;
    wake?.();
  })();
  for (;;) {
    if (!ready.length) {
      if (!producing) break;
      await new Promise((resolve) => (wake = resolve));
      wake = null;
      continue;
    }
    const id = ready.shift();
    try {
      const film = loadFilm(id);
      await stepDescribe(film);
      await stepEmbed(film);
      await stepCut(film);
      stepBuild(ids);
      console.log(`== ${id} done (${ids.indexOf(id) + 1}/${ids.length})`);
    } catch (error) {
      console.error(`  ${id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  await producer;
  stepBuild(ids);
  report(ids);
}

async function main() {
  const [step = "all", ...rest] = process.argv.slice(2);
  // Film ids, or a .json list (strings or { id } objects) such as films-v1.json.
  const list = rest.length === 1 && rest[0].endsWith(".json") ? rest[0] : rest.length ? null : "films.json";
  const ids = list
    ? readJson(fileURLToPath(new URL(`./${list}`, import.meta.url)), []).map((f) => (typeof f === "string" ? f : f.id))
    : rest;
  if (step === "pipeline") return runPipeline(ids);
  if (step === "build") return stepBuild(ids);
  if (step === "report") return report(ids);
  const steps = step === "all" ? STEPS : [step];
  if (!steps.every((s) => STEPS.includes(s))) throw new Error(`Unknown step "${step}". Steps: ${STEPS.join(", ")}, build, report, all`);
  for (const s of steps) {
    console.log(`== ${s}`);
    for (const id of ids) {
      try {
        if (s === "fetch") {
          await stepFetch(id);
          continue;
        }
        const film = loadFilm(id);
        if (!film) throw new Error("run fetch first");
        if (s === "shots") await stepShots(film);
        if (s === "analyze") await stepAnalyze(film);
        if (s === "measure") console.log(`  ${id}: measured ${await measureFilm(film)} shots`);
        if (s === "describe") await stepDescribe(film);
        if (s === "embed") await stepEmbed(film);
        if (s === "cut") await stepCut(film);
      } catch (error) {
        console.error(`  ${id}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  if (step === "all") {
    stepBuild(ids);
    report(ids);
  }
}

await main();
