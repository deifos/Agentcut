// Shared helpers for the b-roll indexer: data folders, ffmpeg, archive.org and the per-film record.
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const dataRoot = process.env.BROLL_DATA;
if (!dataRoot) {
  console.error("Set BROLL_DATA to the data folder (films, work, out), e.g. BROLL_DATA=E:/agentcut-broll");
  process.exit(1);
}
export const DATA = resolve(dataRoot);
export const FILMS_DIR = join(DATA, "films"); // downloaded sources: untrusted data, only ever read by ffmpeg
export const WORK_DIR = join(DATA, "work");
export const OUT_DIR = join(DATA, "out"); // mirrors the CDN layout: agentcut/broll/
export const MODEL_CACHE = join(DATA, "cache", "hf");

export const USER_AGENT = "AgentcutBrollIndexer/0.1 (+https://agentcut.synteq.app)";

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

// One record per film (metadata, files, shots and everything later steps add), saved after each step.
export const filmPath = (id) => join(WORK_DIR, id, "film.json");
export const loadFilm = (id) => readJson(filmPath(id), null);
export const saveFilm = (film) => writeJson(filmPath(film.id), film);

export const shotId = (filmId, index) => `${filmId}-${String(index).padStart(3, "0")}`;

/** Run a command; resolves with stdout (Buffer) and stderr (string), rejects on a non-zero exit. */
export function run(command, args, { stdout = "buffer" } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const out = [];
    let err = "";
    child.stdout.on("data", (chunk) => stdout === "buffer" && out.push(chunk));
    child.stderr.on("data", (chunk) => {
      err += chunk;
      if (err.length > 4_000_000) err = err.slice(-2_000_000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout: Buffer.concat(out), stderr: err });
      else reject(new Error(`${command} exited ${code}: ${err.slice(-1500)}`));
    });
  });
}

export const ffmpeg = (args, options) => run("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], options);

export async function probeDuration(path) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]);
  return Number(stdout.toString().trim());
}

// archive.org asks bots to stay around one request per second.
let lastRequest = 0;
async function politeFetch(url) {
  const wait = lastRequest + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (response.ok) return response;
    if (attempt >= 3 || ![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

export async function archiveJson(url) {
  return (await politeFetch(url)).json();
}

/** Download to `target` (via a .part file); returns { bytes, seconds }. */
export async function download(url, target) {
  ensureDir(dirname(target));
  const started = Date.now();
  const response = await politeFetch(url);
  const part = `${target}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(part));
  renameSync(part, target);
  const bytes = Number(response.headers.get("content-length")) || 0;
  return { bytes, seconds: (Date.now() - started) / 1000 };
}

export const archiveFileUrl = (id, name) =>
  `https://archive.org/download/${encodeURIComponent(id)}/${name.split("/").map(encodeURIComponent).join("/")}`;

/** L2-normalize in place. */
export function normalize(vector) {
  let sum = 0;
  for (const v of vector) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vector.length; i++) vector[i] /= norm;
  return vector;
}
