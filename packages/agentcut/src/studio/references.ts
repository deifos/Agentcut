import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { debugLog } from "../log.js";
import { killTree } from "./proc.js";
import { assertSlug, projectDir, safeJoin, StudioError } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

// Style Spy references: the helper downloads a public Instagram, TikTok or YouTube video with
// yt-dlp, then samples frames with ffmpeg so the agent can look at it. Both tools are fetched on
// first use into ~/.agentcut/tools (checksums verified), never installed system-wide.

export const REFERENCE_DOMAINS = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be"];
export const LOGIN_BROWSERS = ["chrome", "safari", "firefox", "edge", "brave"] as const;
export type LoginBrowser = (typeof LOGIN_BROWSERS)[number];

const MAX_BYTES = 200 * 1024 * 1024;
const MAX_SECONDS = 600;
// Frames: one per shot (several for long shots), capped.
const SCENE_THRESHOLD = 0.3;
const MIN_SHOT_SECONDS = 0.4;
const LONG_SHOT_SECONDS = 6;
const MAX_FRAMES = 48;
const MAX_CUT_STRIPS = 30;
const YTDLP_CHECK_MS = 3 * 24 * 60 * 60 * 1000;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

// ffmpeg doesn't move fast; pin a build and its checksum (github.com/eugeneware/ffmpeg-static).
const FFMPEG_RELEASE = "b6.1.1";
const FFMPEG_BUILDS: Record<string, { asset: string; sha256: string }> = {
  "darwin-arm64": { asset: "ffmpeg-darwin-arm64.gz", sha256: "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa" },
  "darwin-x64": { asset: "ffmpeg-darwin-x64.gz", sha256: "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106" },
  "linux-x64": { asset: "ffmpeg-linux-x64.gz", sha256: "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa" },
  "linux-arm64": { asset: "ffmpeg-linux-arm64.gz", sha256: "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0" },
  "win32-x64": { asset: "ffmpeg-win32-x64.gz", sha256: "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77" },
  // Windows on ARM runs the x64 build.
  "win32-arm64": { asset: "ffmpeg-win32-x64.gz", sha256: "8883a3dffbd0a16cf4ef95206ea05283f78908dbfb118f73c83f4951dcc06d77" },
};

// Sites change often and yt-dlp follows within days: track its latest release (SHA2-256SUMS verified).
const YTDLP_ASSETS: Record<string, string> = {
  "darwin-arm64": "yt-dlp_macos",
  "darwin-x64": "yt-dlp_macos",
  "linux-x64": "yt-dlp_linux",
  "linux-arm64": "yt-dlp_linux_aarch64",
  "win32-x64": "yt-dlp.exe",
  "win32-arm64": "yt-dlp_arm64.exe",
};

const platformKey = `${process.platform}-${process.arch}`;
const exe = process.platform === "win32" ? ".exe" : "";

export type ReferenceStage = "setup" | "downloading" | "frames" | "ready" | "failed";
export type ReferenceErrorCode =
  | "login_required"
  | "cookies"
  | "unavailable"
  | "too_long"
  | "too_large"
  | "unsupported"
  | "network"
  | "setup"
  | "cancelled"
  | "failed";

export interface ReferenceFrame {
  path: string;
  time: number;
}

export interface ReferenceJob {
  id: string;
  slug: string;
  /** Source link, or null for an uploaded video. */
  url: string | null;
  browser: LoginBrowser | null;
  stage: ReferenceStage;
  /** 0..1 while downloading, else null. */
  progress: number | null;
  detail?: string;
  /** Project-relative paths, set when ready. */
  path?: string;
  dir?: string;
  frames?: ReferenceFrame[];
  sheet?: string | null;
  error?: { code: ReferenceErrorCode; message: string };
}

class ReferenceError extends Error {
  constructor(
    readonly code: ReferenceErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function normalizeReferenceUrl(raw: unknown) {
  let url: URL;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    throw new StudioError("Paste an HTTPS video link from Instagram, TikTok, or YouTube.", "bad_input");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !REFERENCE_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  ) {
    throw new StudioError("Paste an HTTPS video link from Instagram, TikTok, or YouTube.", "bad_input");
  }
  return url.href;
}

function loginBrowser(value: unknown): LoginBrowser | null {
  if (value === undefined || value === null || value === "") return null;
  if (!LOGIN_BROWSERS.includes(value as LoginBrowser)) throw new StudioError(`Unknown browser "${String(value)}".`, "bad_input");
  return value as LoginBrowser;
}

const BROWSER_NAMES: Record<LoginBrowser, string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  brave: "Brave",
};

/** Browsers with a profile on this computer (where yt-dlp reads logins), most convenient first. */
export function installedBrowsers(): LoginBrowser[] {
  const home = homedir();
  const local = process.env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const roaming = process.env.APPDATA ?? join(home, "AppData", "Roaming");
  const support = join(home, "Library", "Application Support");
  const profiles: Record<LoginBrowser, string | null> =
    process.platform === "darwin"
      ? {
          chrome: join(support, "Google", "Chrome"),
          brave: join(support, "BraveSoftware", "Brave-Browser"),
          edge: join(support, "Microsoft Edge"),
          firefox: join(support, "Firefox", "Profiles"),
          safari: "/Applications/Safari.app",
        }
      : process.platform === "win32"
        ? {
            chrome: join(local, "Google", "Chrome", "User Data"),
            brave: join(local, "BraveSoftware", "Brave-Browser", "User Data"),
            edge: join(local, "Microsoft", "Edge", "User Data"),
            firefox: join(roaming, "Mozilla", "Firefox", "Profiles"),
            safari: null,
          }
        : {
            chrome: join(home, ".config", "google-chrome"),
            brave: join(home, ".config", "BraveSoftware", "Brave-Browser"),
            edge: join(home, ".config", "microsoft-edge"),
            firefox: join(home, ".mozilla", "firefox"),
            safari: null,
          };
  const order: LoginBrowser[] = ["chrome", "brave", "edge", "firefox", "safari"];
  return order.filter((browser) => {
    const dir = profiles[browser];
    return dir !== null && existsSync(dir);
  });
}

// ---------------------------------------------------------------------------
// Tools

interface ToolsManifest {
  ytdlp?: { version: string; checkedAt: number };
  ffmpeg?: { version: string };
}

function toolsDir() {
  return process.env.AGENTCUT_TOOLS || join(homedir(), ".agentcut", "tools");
}

function readManifest(): ToolsManifest {
  try {
    return JSON.parse(readFileSync(join(toolsDir(), "tools.json"), "utf8")) as ToolsManifest;
  } catch {
    return {};
  }
}

function writeManifest(update: Partial<ToolsManifest>) {
  mkdirSync(toolsDir(), { recursive: true });
  writeFileSync(join(toolsDir(), "tools.json"), `${JSON.stringify({ ...readManifest(), ...update }, null, 2)}\n`);
}

/** Download to `target`, checking the SHA-256 of the bytes as served (before gunzip). */
async function downloadVerified(url: string, sha256: string, target: string, gunzip: boolean) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}) for ${url}`);
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  const hash = createHash("sha256");
  let size = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      size += chunk.length;
      if (size > 300 * 1024 * 1024) return done(new Error("Tool download is unexpectedly large."));
      hash.update(chunk);
      done(null, chunk);
    },
  });
  try {
    const source = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
    if (gunzip) await pipeline(source, tap, createGunzip(), createWriteStream(temp));
    else await pipeline(source, tap, createWriteStream(temp));
    const digest = hash.digest("hex");
    if (digest !== sha256.toLowerCase()) throw new Error(`Checksum mismatch for ${url}`);
    chmodSync(temp, 0o755);
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
}

let ffmpegReady: Promise<string> | null = null;
let ytdlpReady: Promise<string> | null = null;

function ffmpegPath() {
  return join(toolsDir(), "ffmpeg", FFMPEG_RELEASE, `ffmpeg${exe}`);
}

function ytdlpPath() {
  return join(toolsDir(), "yt-dlp", `yt-dlp${exe}`);
}

export function ensureFfmpeg(onDownload?: () => void) {
  ffmpegReady ??= (async () => {
    const target = ffmpegPath();
    if (existsSync(target)) return target;
    const build = FFMPEG_BUILDS[platformKey];
    if (!build) throw new ReferenceError("setup", `Video tools aren't available for ${platformKey}. Upload the video instead.`);
    onDownload?.();
    await downloadVerified(
      `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_RELEASE}/${build.asset}`,
      build.sha256,
      target,
      true,
    );
    writeManifest({ ffmpeg: { version: FFMPEG_RELEASE } });
    debugLog(`references: installed ffmpeg ${FFMPEG_RELEASE}`);
    return target;
  })().catch((error) => {
    ffmpegReady = null;
    throw error;
  });
  return ffmpegReady;
}

async function latestYtdlpVersion() {
  // /latest/download/ redirects to /download/<version>/: read the version without the API rate limit.
  const response = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS", {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  const match = /\/releases\/download\/([^/]+)\//.exec(response.headers.get("location") ?? "");
  if (!match) throw new Error(`Couldn't find the latest yt-dlp release (${response.status}).`);
  return match[1];
}

/** yt-dlp, updated every few days (or now with `force`, after an unexplained failure). */
export function ensureYtdlp({ force = false, onDownload }: { force?: boolean; onDownload?: () => void } = {}) {
  if (ytdlpReady && !force) return ytdlpReady;
  ytdlpReady = (async () => {
    const target = ytdlpPath();
    const current = readManifest().ytdlp;
    const installed = existsSync(target) && current;
    if (installed && !force && Date.now() - current.checkedAt < YTDLP_CHECK_MS) return target;
    const asset = YTDLP_ASSETS[platformKey];
    if (!asset) throw new ReferenceError("setup", `Video tools aren't available for ${platformKey}. Upload the video instead.`);
    let version: string;
    try {
      version = await latestYtdlpVersion();
    } catch (error) {
      if (installed) return target; // offline: keep the copy we have
      throw error;
    }
    if (installed && current.version === version) {
      writeManifest({ ytdlp: { version, checkedAt: Date.now() } });
      return target;
    }
    onDownload?.();
    const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}`;
    const sums = await fetch(`${base}/SHA2-256SUMS`, { signal: AbortSignal.timeout(20_000) }).then((r) => {
      if (!r.ok) throw new Error(`Couldn't fetch yt-dlp checksums (${r.status}).`);
      return r.text();
    });
    const line = sums.split(/\r?\n/).find((l) => l.trim().endsWith(`  ${asset}`) || l.trim().endsWith(` *${asset}`));
    const sha256 = line?.trim().split(/\s+/)[0];
    if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) throw new Error(`No checksum for ${asset} in yt-dlp ${version}.`);
    await downloadVerified(`${base}/${asset}`, sha256, target, false);
    writeManifest({ ytdlp: { version, checkedAt: Date.now() } });
    debugLog(`references: installed yt-dlp ${version}`);
    return target;
  })().catch((error) => {
    ytdlpReady = null;
    throw error;
  });
  return ytdlpReady;
}

// ---------------------------------------------------------------------------
// Running tools

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function run(
  command: string,
  args: string[],
  { timeoutMs, onLine, onChild }: { timeoutMs: number; onLine?: (line: string) => void; onChild?: (child: ChildProcess | null) => void },
) {
  return new Promise<RunResult>((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    onChild?.(child);
    let stdout = "";
    let stderr = "";
    let partial = "";
    const keep = (text: string, more: string) => (text + more).slice(-64_000);
    const timer = setTimeout(() => killTree(child), timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout = keep(stdout, text);
      if (!onLine) return;
      const lines = (partial + text).split(/\r?\n/);
      partial = lines.pop() ?? "";
      for (const line of lines) onLine(line);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = keep(stderr, chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      onChild?.(null);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      onChild?.(null);
      if (partial && onLine) onLine(partial);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Turn yt-dlp's output into something the user can act on. */
export function classifyFailure(output: string, browser: LoginBrowser | null): ReferenceError {
  const text = output.toLowerCase();
  const name = browser ? BROWSER_NAMES[browser] : "";
  if (browser && /could not find .* cookies database|failed to find .* profile/.test(text)) {
    return new ReferenceError("cookies", `Couldn't find a ${name} profile on this computer. Pick the browser you use for this site.`);
  }
  if (
    browser &&
    /(failed to (?:decrypt|read)|unable to (?:read|get key)|keyring|keychain|cookies? database|could not copy|operation not permitted|permission denied)/.test(text)
  ) {
    return new ReferenceError(
      "cookies",
      browser === "safari"
        ? "Couldn't read your Safari login. Safari needs Full Disk Access for this, so try Chrome or Firefox instead."
        : `Couldn't read your ${name} login. Click Allow if your computer asks, or pick another browser.`,
    );
  }
  if (/does not pass filter/.test(text)) {
    return new ReferenceError("too_long", "This video is longer than 10 minutes or is a live stream. Upload a shorter clip instead.");
  }
  if (/larger than max-filesize/.test(text)) {
    return new ReferenceError("too_large", "This video is larger than 200 MB. Upload a shorter clip instead.");
  }
  if (/unsupported url/.test(text)) {
    return new ReferenceError("unsupported", "That link doesn't point to a video. Copy the link of the reel or video itself.");
  }
  if (
    /(login required|log in|logged-in|sign in|--cookies|empty media response|rate-limit reached|private|age[- ]restricted|inappropriate|confirm your age|not a bot)/.test(text)
  ) {
    return browser
      ? new ReferenceError(
          "login_required",
          `Your ${name} login couldn't open this video. Check that you're signed in there and can watch it, or upload it instead.`,
        )
      : new ReferenceError("login_required", "This video needs a login to download.");
  }
  if (/(video unavailable|not available|has been removed|does not exist|http error 404|no video formats|no video could be found)/.test(text)) {
    return new ReferenceError("unavailable", "This video is unavailable. It may have been removed or restricted. Upload it instead.");
  }
  if (/(unable to download webpage|timed out|getaddrinfo|connection (?:reset|refused)|network is unreachable|ssl)/.test(text)) {
    return new ReferenceError("network", "Couldn't reach the site. Check your connection and try again.");
  }
  return new ReferenceError("failed", "Couldn't download this video. Try again, or upload it instead.");
}

async function probeDuration(ffmpeg: string, file: string) {
  // `ffmpeg -i` with no output exits 1 but prints the input's duration.
  const result = await run(ffmpeg, ["-hide_banner", "-i", file], { timeoutMs: 30_000 });
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(result.stderr);
  if (!match) throw new ReferenceError("failed", "This file doesn't look like a video ffmpeg can read.");
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Cut times (seconds) where the picture changes: hard cuts and layout switches (split screens, cards). */
async function detectCuts(ffmpeg: string, video: string) {
  const result = await run(
    ffmpeg,
    ["-hide_banner", "-i", video, "-an", "-vf", `scale=160:-2,select='gt(scene,${SCENE_THRESHOLD})',showinfo`, "-f", "null", "-"],
    { timeoutMs: 5 * 60_000 },
  );
  const cuts: number[] = [];
  for (const match of result.stderr.matchAll(/pts_time:([\d.]+)/g)) {
    const time = Number(match[1]);
    if (time - (cuts.at(-1) ?? 0) >= MIN_SHOT_SECONDS) cuts.push(Math.round(time * 100) / 100);
  }
  return cuts;
}

export interface ReferenceShot {
  start: number;
  end: number;
  frames: string[];
}

/**
 * Shots from cut times, and when to grab frames: the opening, the middle of every shot (more for
 * long ones), and the ending. Capped at MAX_FRAMES, keeping the opening and an even spread.
 */
export function planFrames(duration: number, cuts: number[]) {
  const bounds = [0, ...cuts.filter((t) => t > 0 && t < duration), duration];
  const shots = bounds.slice(0, -1).map((start, i) => ({ start, end: bounds[i + 1] }));
  let times: number[] = [Math.min(0.3, duration / 2)];
  for (const shot of shots) {
    const length = shot.end - shot.start;
    const count = Math.max(1, Math.ceil(length / LONG_SHOT_SECONDS));
    for (let i = 0; i < count; i += 1) times.push(shot.start + ((i + 0.5) * length) / count);
  }
  times.push(Math.max(0, duration - 0.3));
  times = [...new Set(times.map((t) => Math.round(t * 100) / 100))].sort((a, b) => a - b);
  if (times.length > MAX_FRAMES) {
    const step = (times.length - 1) / (MAX_FRAMES - 1);
    times = Array.from({ length: MAX_FRAMES }, (_, i) => times[Math.round(i * step)]);
  }
  return { shots, times };
}

export interface ReferenceStrip {
  kind: "hook" | "cut" | "captions";
  /** Seconds covered, sampled at `fps`, frames left to right, top to bottom. */
  start: number;
  end: number;
  fps: number;
  path: string;
  /** For cuts: the cut time. */
  at?: number;
}

/** Windows worth seeing in motion: the hook, around every cut, and a stretch of captions. */
export function planStrips(duration: number, shots: { start: number; end: number }[]) {
  const round = (t: number) => Math.round(t * 100) / 100;
  const strips: Omit<ReferenceStrip, "path">[] = [{ kind: "hook", start: 0, end: round(Math.min(3, duration)), fps: 6 }];
  const cuts = shots.slice(1).map((shot) => shot.start);
  const step = cuts.length > MAX_CUT_STRIPS ? cuts.length / MAX_CUT_STRIPS : 1;
  for (let i = 0; i < cuts.length && strips.length <= MAX_CUT_STRIPS; i += step) {
    const at = cuts[Math.floor(i)];
    strips.push({ kind: "cut", at, start: round(Math.max(0, at - 0.25)), end: round(Math.min(duration, at + 0.75)), fps: 8 });
  }
  const longest = [...shots].sort((a, b) => b.end - b.start - (a.end - a.start))[0];
  if (longest && longest.end - longest.start >= 1.5) {
    const start = round(longest.start + Math.min(0.5, (longest.end - longest.start) / 4));
    strips.push({ kind: "captions", start, end: round(Math.min(longest.end, start + 2)), fps: 8 });
  }
  return strips;
}

async function renderStrip(ffmpeg: string, video: string, strip: Omit<ReferenceStrip, "path">, file: string) {
  const count = Math.max(1, Math.round((strip.end - strip.start) * strip.fps));
  const columns = Math.min(count, strip.kind === "hook" ? 6 : 8);
  const rows = Math.ceil(count / columns);
  await run(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      String(strip.start),
      "-t",
      String(strip.end - strip.start),
      "-i",
      video,
      "-an",
      "-vf",
      `fps=${strip.fps},scale=-2:320,tile=${columns}x${rows}:padding=4:color=black`,
      "-frames:v",
      "1",
      "-q:v",
      "4",
      "-y",
      file,
    ],
    { timeoutMs: 60_000 },
  );
  return existsSync(file);
}

export interface ReferenceAnalysis {
  duration: number;
  cuts: number[];
  averageShotSeconds: number;
  shots: ReferenceShot[];
  frames: ReferenceFrame[];
  /** Every frame in one image, in order, left to right. */
  sheet: string | null;
  /** Short stretches sampled several times a second: transitions, graphics entering, captions. */
  strips: ReferenceStrip[];
}

/** Cuts, shots, frames and an overview sheet in `<folder>/frames`, for the agent to read. */
async function analyzeVideo(ffmpeg: string, video: string, folder: string, rel: string): Promise<ReferenceAnalysis> {
  const duration = await probeDuration(ffmpeg, video);
  const cuts = await detectCuts(ffmpeg, video).catch(() => [] as number[]);
  const { shots, times } = planFrames(duration, cuts);
  const dir = join(folder, "frames");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames: ReferenceFrame[] = [];
  for (const time of times) {
    const name = `${String(frames.length + 1).padStart(2, "0")}.jpg`;
    await run(
      ffmpeg,
      ["-hide_banner", "-loglevel", "error", "-ss", String(time), "-i", video, "-frames:v", "1", "-vf", "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'", "-q:v", "3", "-y", join(dir, name)],
      { timeoutMs: 60_000 },
    );
    if (existsSync(join(dir, name))) frames.push({ path: `${rel}/frames/${name}`, time });
  }
  if (!frames.length) throw new ReferenceError("failed", "Couldn't read frames from this video. Try uploading an MP4.");
  const columns = Math.min(8, frames.length);
  const rows = Math.ceil(frames.length / columns);
  await run(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-i", join(dir, "%02d.jpg"), "-vf", `scale=-2:360,tile=${columns}x${rows}:padding=6:color=black`, "-frames:v", "1", "-q:v", "4", "-y", join(dir, "sheet.jpg")],
    { timeoutMs: 60_000 },
  ).catch(() => undefined);
  const motionDir = join(folder, "motion");
  rmSync(motionDir, { recursive: true, force: true });
  mkdirSync(motionDir, { recursive: true });
  const strips: ReferenceStrip[] = [];
  for (const strip of planStrips(duration, shots)) {
    const name = strip.kind === "cut" ? `cut-${String(strips.length).padStart(2, "0")}.jpg` : `${strip.kind}.jpg`;
    const ok = await renderStrip(ffmpeg, video, strip, join(motionDir, name)).catch(() => false);
    if (ok) strips.push({ ...strip, path: `${rel}/motion/${name}` });
  }
  return {
    duration: Math.round(duration * 100) / 100,
    cuts,
    averageShotSeconds: Math.round((duration / shots.length) * 10) / 10,
    shots: shots.map((shot) => ({
      start: Math.round(shot.start * 100) / 100,
      end: Math.round(shot.end * 100) / 100,
      frames: frames.filter((f) => f.time >= shot.start && f.time < shot.end).map((f) => f.path),
    })),
    frames,
    sheet: existsSync(join(dir, "sheet.jpg")) ? `${rel}/frames/sheet.jpg` : null,
    strips,
  };
}

// ---------------------------------------------------------------------------
// Jobs

export class ReferenceImports {
  private readonly jobs = new Map<string, ReferenceJob>();
  private readonly waiters = new Map<string, Promise<ReferenceJob>>();
  private readonly children = new Map<string, ChildProcess>();
  private readonly cancelled = new Set<string>();

  constructor(
    private readonly paths: WorkspacePaths,
    private readonly emit: (job: ReferenceJob) => void,
    private readonly onAssets: (slug: string) => void,
  ) {}

  list(slug: string) {
    return [...this.jobs.values()].filter((job) => job.slug === slug);
  }

  /** Import a link. Pass a failed job's `id` with `browser` to retry it with the user's browser login. */
  importUrl(slugInput: unknown, rawUrl: unknown, options: { id?: unknown; browser?: unknown } = {}) {
    const slug = assertSlug(slugInput);
    const browser = loginBrowser(options.browser);
    let url: string;
    let id: string;
    const previous = typeof options.id === "string" ? this.jobs.get(options.id) : undefined;
    if (previous) {
      if (previous.slug !== slug || !previous.url) throw new StudioError("Unknown reference import.", "bad_input");
      if (previous.stage !== "failed") return previous;
      url = previous.url;
      id = previous.id;
    } else {
      url = normalizeReferenceUrl(rawUrl);
      id = randomUUID();
    }
    return this.start({ id, slug, url, browser, stage: "setup", progress: null }, () => this.download(id));
  }

  /** Sample frames and write reference.json for a video already in assets/references/<id>/ (an upload). */
  prepare(slugInput: unknown, pathInput: unknown) {
    const slug = assertSlug(slugInput);
    const path = String(pathInput ?? "");
    const match = /^assets\/references\/([a-zA-Z0-9_-]{1,80})\/[^/]+$/.exec(path);
    if (!match || !VIDEO_EXT.test(path)) throw new StudioError("Reference videos live in assets/references/<id>/.", "bad_input");
    if (!existsSync(safeJoin(projectDir(this.paths, slug), path))) throw new StudioError(`${path} doesn't exist.`, "bad_input");
    const id = match[1];
    const running = this.jobs.get(id);
    if (running && running.stage !== "ready" && running.stage !== "failed") return running;
    return this.start({ id, slug, url: null, browser: null, stage: "setup", progress: null }, () => this.prepareExisting(id, path));
  }

  wait(id: string) {
    return this.waiters.get(id) ?? Promise.resolve(this.jobs.get(id));
  }

  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job || job.stage === "ready" || job.stage === "failed") return { cancelled: false };
    this.cancelled.add(id);
    const child = this.children.get(id);
    if (child) killTree(child);
    return { cancelled: true };
  }

  cancelAll() {
    for (const id of this.children.keys()) this.cancel(id);
  }

  private update(id: string, patch: Partial<ReferenceJob>) {
    const job = this.jobs.get(id);
    if (!job) return;
    const next = { ...job, ...patch };
    this.jobs.set(id, next);
    this.emit(next);
  }

  private start(job: ReferenceJob, work: () => Promise<void>) {
    this.cancelled.delete(job.id);
    this.jobs.set(job.id, job);
    this.emit(job);
    const done = work()
      .catch((error: unknown) => {
        const failure =
          this.cancelled.has(job.id)
            ? new ReferenceError("cancelled", "Import cancelled.")
            : error instanceof ReferenceError
              ? error
              : new ReferenceError("setup", `Couldn't set up the video tools: ${error instanceof Error ? error.message : String(error)}`);
        debugLog(`references: ${job.id} failed (${failure.code}) ${error instanceof Error ? error.message : String(error)}`);
        this.update(job.id, { stage: "failed", progress: null, detail: undefined, error: { code: failure.code, message: failure.message } });
      })
      .then(() => {
        this.cancelled.delete(job.id);
        this.waiters.delete(job.id);
        return this.jobs.get(job.id)!;
      });
    this.waiters.set(job.id, done);
    return job;
  }

  private checkCancelled(id: string) {
    if (this.cancelled.has(id)) throw new ReferenceError("cancelled", "Import cancelled.");
  }

  private async tools(id: string) {
    const announce = () => this.update(id, { stage: "setup", detail: "Downloading video tools (first import only)…" });
    const [ytdlp, ffmpeg] = await Promise.all([ensureYtdlp({ onDownload: announce }), ensureFfmpeg(announce)]);
    return { ytdlp, ffmpeg };
  }

  private async download(id: string) {
    const job = this.jobs.get(id)!;
    const dir = projectDir(this.paths, job.slug);
    const rel = `assets/references/${id}`;
    const dest = join(dir, rel);
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true }); // a failed attempt's leftovers
    const temp = join(dir, ".studio", "reference-imports", id);
    rmSync(temp, { recursive: true, force: true });
    mkdirSync(temp, { recursive: true });
    try {
      let { ytdlp, ffmpeg } = await this.tools(id);
      this.checkCancelled(id);
      let meta: Record<string, unknown> = {};
      for (let attempt = 0; ; attempt += 1) {
        this.update(id, { stage: "downloading", progress: 0, detail: undefined, error: undefined });
        try {
          meta = await this.runYtdlp(id, ytdlp, ffmpeg, job.url!, job.browser, temp);
          break;
        } catch (error) {
          this.checkCancelled(id);
          // Sites change often; an unexplained failure usually means yt-dlp needs its latest fix.
          if (attempt > 0 || !(error instanceof ReferenceError) || error.code !== "failed") throw error;
          const before = readManifest().ytdlp?.version;
          ytdlp = await ensureYtdlp({ force: true, onDownload: () => this.update(id, { stage: "setup", progress: null, detail: "Updating the video downloader…" }) });
          if (readManifest().ytdlp?.version === before) throw error;
        }
      }
      this.checkCancelled(id);
      const video = join(temp, "video.mp4");
      if (statSync(video).size > MAX_BYTES) throw new ReferenceError("too_large", "This video is larger than 200 MB. Upload a shorter clip instead.");
      this.update(id, { stage: "frames", progress: null });
      const duration = await probeDuration(ffmpeg, video);
      if (duration > MAX_SECONDS + 1) throw new ReferenceError("too_long", "This video is longer than 10 minutes. Upload a shorter clip instead.");
      const analysis = await analyzeVideo(ffmpeg, video, temp, rel);
      this.checkCancelled(id);
      writeReferenceJson(temp, {
        id,
        sourceUrl: job.url,
        title: meta.title ?? null,
        uploader: meta.uploader ?? null,
        site: meta.extractor ?? null,
        width: meta.width ?? null,
        height: meta.height ?? null,
        usedBrowserLogin: Boolean(job.browser),
        importedAt: new Date().toISOString(),
        video: `${rel}/video.mp4`,
        ...analysis,
      });
      mkdirSync(dirname(dest), { recursive: true });
      renameSync(temp, dest);
      this.onAssets(job.slug);
      this.update(id, { stage: "ready", progress: null, path: `${rel}/video.mp4`, dir: rel, frames: analysis.frames, sheet: analysis.sheet });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }

  private async runYtdlp(id: string, ytdlp: string, ffmpeg: string, url: string, browser: LoginBrowser | null, temp: string) {
    for (const name of readdirSync(temp)) rmSync(join(temp, name), { recursive: true, force: true });
    let meta: Record<string, unknown> = {};
    // A merged download fetches video then audio: show one bar (video ~85% of it), not two.
    let parts = 1;
    let part = 0;
    let lastDone = 0;
    let shown = -1;
    const args = [
      "--ignore-config",
      "--no-playlist",
      "--no-cache-dir",
      "--max-downloads",
      "1",
      "--socket-timeout",
      "20",
      "--retries",
      "2",
      "--max-filesize",
      "200M",
      "--match-filters",
      `duration <=? ${MAX_SECONDS} & !is_live`,
      "--ffmpeg-location",
      ffmpeg,
      // YouTube needs a JavaScript runtime; the helper's own Node will do.
      "--js-runtimes",
      `node:${process.execPath}`,
      // Sharpest up to 1080p for reading type; H.264 when there's a choice, so every browser plays it.
      "-S",
      "res:1080,vcodec:h264,acodec:aac",
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mp4",
      "--remux-video",
      "mp4",
      "--newline",
      "--progress",
      "--progress-template",
      "download:@@progress %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s",
      "--no-simulate",
      "-O",
      "before_dl:@@parts %(format_id)s",
      // -O implies --quiet, which hides why a video was skipped (too long, too large).
      "--no-quiet",
      "-O",
      "after_move:@@meta %(.{title,uploader,width,height,extractor})j",
      ...(browser ? ["--cookies-from-browser", browser] : []),
      "-o",
      join(temp, "video.%(ext)s"),
      "--",
      url,
    ];
    const result = await run(ytdlp, args, {
      timeoutMs: 6 * 60_000,
      onChild: (child) => (child ? this.children.set(id, child) : this.children.delete(id)),
      onLine: (line) => {
        if (line.startsWith("@@progress ")) {
          const [done, total, estimate] = line.slice(11).split(" ").map(Number);
          const size = total > 0 ? total : estimate;
          if (!(done >= 0 && size > 0)) return;
          if (done < lastDone) part = Math.min(parts - 1, part + 1);
          lastDone = done;
          const fraction = Math.min(1, done / size);
          const overall = parts > 1 ? (part === 0 ? fraction * 0.85 : 0.85 + fraction * 0.15) : fraction;
          const percent = Math.floor(overall * 100);
          if (percent === shown) return;
          shown = percent;
          this.update(id, { progress: percent / 100 });
        } else if (line.startsWith("@@parts ")) {
          parts = line.slice(8).split("+").length;
        } else if (line.startsWith("@@meta ")) {
          try {
            meta = JSON.parse(line.slice(7)) as Record<string, unknown>;
          } catch {}
        }
      },
    });
    this.checkCancelled(id);
    // --max-downloads exits 101 once the one video is done.
    if ((result.code === 0 || result.code === 101) && existsSync(join(temp, "video.mp4"))) return meta;
    debugLog(`references: yt-dlp exited ${result.code}\n${result.stderr.slice(-4000)}`);
    throw classifyFailure(`${result.stdout}\n${result.stderr}`, browser);
  }

  private async prepareExisting(id: string, path: string) {
    const job = this.jobs.get(id)!;
    const dir = projectDir(this.paths, job.slug);
    const rel = dirname(path);
    const ffmpeg = await ensureFfmpeg(() => this.update(id, { stage: "setup", detail: "Downloading video tools (first import only)…" }));
    this.update(id, { stage: "frames", detail: undefined });
    const video = join(dir, path);
    const analysis = await analyzeVideo(ffmpeg, video, join(dir, rel), rel);
    // Keep what an earlier import recorded (source link, title).
    let previous: Record<string, unknown> = {};
    try {
      previous = JSON.parse(readFileSync(join(dir, rel, "reference.json"), "utf8")) as Record<string, unknown>;
    } catch {}
    writeReferenceJson(join(dir, rel), {
      sourceUrl: null,
      importedAt: new Date().toISOString(),
      ...previous,
      id,
      video: path,
      ...analysis,
    });
    this.onAssets(job.slug);
    this.update(id, { stage: "ready", path, dir: rel, frames: analysis.frames, sheet: analysis.sheet });
  }
}

function writeReferenceJson(folder: string, data: Record<string, unknown>) {
  writeFileSync(join(folder, "reference.json"), `${JSON.stringify(data, null, 2)}\n`);
}
