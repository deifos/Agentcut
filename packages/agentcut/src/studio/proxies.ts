// Fast-seeking copies of footage for the live preview. Camera and screen files keep seconds between
// keyframes, so stepping backward means decoding all the way forward again; these copies have a
// keyframe every few frames. Only the preview's Player ever asks for one: captures and exports read
// the original. They sit in .agentcut/proxies, keyed by the file's contents' identity, so they never
// travel with a project and can always be made again.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync, rmSync, statSync, utimesSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";
import { ensureFfmpeg, MEDIA_INPUT_ONLY, run } from "./references.js";
import { debugLog } from "../log.js";

const LONG_EDGE = 1920;
const KEYFRAME_EVERY = 8;
/** Below this, a keyframe is close enough that a copy wouldn't make seeking noticeably faster. */
const MAX_SECONDS_BETWEEN_KEYFRAMES = 0.5;
const MIN_DURATION_SECONDS = 2;
const MAX_CACHE_BYTES = 20 * 1024 ** 3;
const PROBE_TIMEOUT_MS = 2 * 60_000;
const ENCODE_TIMEOUT_MS = 2 * 60 * 60_000;

export interface VideoProbe {
  durationSeconds: number;
  width: number;
  height: number;
  pixelFormat: string;
  /** HDR or a separate alpha plane: an 8-bit copy would change the picture. */
  unsafe: boolean;
}

export type ProxyAnswer =
  | { state: "ready"; file: string }
  | { state: "working" }
  | { state: "none"; reason: string };

/** What `ffmpeg -i` printed about the first video stream, or null if it has none. */
export function parseProbe(output: string): VideoProbe | null {
  const stream = /Stream #[^\n]*Video: [^\n]*/.exec(output)?.[0];
  if (!stream) return null;
  const size = /\b(\d{2,5})x(\d{2,5})\b/.exec(stream);
  if (!size) return null;
  const pixelFormat = /Video: [^,]+, ([a-z0-9_]+)/.exec(stream)?.[1] ?? "";
  const duration = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(output);
  return {
    durationSeconds: duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : 0,
    width: Number(size[1]),
    height: Number(size[2]),
    pixelFormat,
    unsafe:
      /bt2020|smpte2084|arib-std-b67/i.test(stream) ||
      /^(yuva|rgba|bgra|argb|abgr|gbrap|ya)/.test(pixelFormat) ||
      /alpha_mode\s*:\s*1/i.test(output),
  };
}

/** Why this file doesn't get a copy, or null when it should. */
export function proxySkipReason(probe: VideoProbe, keyframes: number) {
  if (probe.unsafe) return "It has HDR colour or transparency, which an 8-bit copy would change.";
  if (probe.durationSeconds < MIN_DURATION_SECONDS) return "It's too short to need one.";
  if (Math.max(probe.width, probe.height) > LONG_EDGE) return null;
  if (keyframes > 0 && probe.durationSeconds / keyframes <= MAX_SECONDS_BETWEEN_KEYFRAMES)
    return "It already seeks quickly.";
  return null;
}

export function proxyArgs(input: string, output: string, threads: number) {
  const short = `min(${LONG_EDGE},`;
  return [
    "-hide_banner",
    "-nostdin",
    "-y",
    ...MEDIA_INPUT_ONLY,
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    // Never upscales; even dimensions for yuv420p.
    "-vf",
    `scale='if(gte(iw,ih),${short}iw),-2)':'if(gte(iw,ih),-2,${short}ih))'`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-g",
    String(KEYFRAME_EVERY),
    "-keyint_min",
    String(KEYFRAME_EVERY),
    "-sc_threshold",
    "0",
    // Decode order is display order: a seek never needs frames from after it.
    "-bf",
    "0",
    "-pix_fmt",
    "yuv420p",
    // Same frame times as the original, even when the frame rate varies (screen recordings).
    "-fps_mode",
    "passthrough",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-threads",
    String(threads),
    output,
  ];
}

export class ProxyStore {
  private readonly dir: string;
  private readonly known = new Map<string, ProxyAnswer>();
  /** One encode at a time, so the preview that asked for it stays smooth. */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(internalDir: string) {
    this.dir = join(internalDir, "proxies");
  }

  /** The copy's path for a file name this store handed out, or null. */
  filePath(name: string) {
    if (!/^[a-f0-9]{40}\.mp4$/.test(name)) return null;
    const file = join(this.dir, name);
    return existsSync(file) ? file : null;
  }

  /** Where `file`'s copy stands; asking starts the work if nobody has yet. */
  request(file: string): ProxyAnswer {
    const stat = statSync(file);
    const key = createHash("sha1")
      .update(`1|${realpathSync(file)}|${stat.size}|${stat.mtimeMs}`)
      .digest("hex");
    const known = this.known.get(key);
    if (known) return known;
    const name = `${key}.mp4`;
    const target = join(this.dir, name);
    if (existsSync(target)) {
      const now = new Date();
      utimesSync(target, now, now);
      const ready: ProxyAnswer = { state: "ready", file: name };
      this.known.set(key, ready);
      return ready;
    }
    const working: ProxyAnswer = { state: "working" };
    this.known.set(key, working);
    this.tail = this.tail.then(() => this.make(key, file, target)).catch(() => undefined);
    return working;
  }

  private async make(key: string, file: string, target: string) {
    const part = `${target}.part.mp4`;
    try {
      const ffmpeg = await ensureFfmpeg();
      const info = await run(ffmpeg, ["-hide_banner", ...MEDIA_INPUT_ONLY, "-i", file], { timeoutMs: PROBE_TIMEOUT_MS });
      const probe = parseProbe(info.stderr);
      if (!probe) {
        this.known.set(key, { state: "none", reason: "No video stream ffmpeg can read." });
        return;
      }
      const counted = await run(
        ffmpeg,
        ["-hide_banner", "-nostdin", "-skip_frame", "nokey", ...MEDIA_INPUT_ONLY, "-i", file, "-map", "0:v:0", "-f", "null", "-"],
        { timeoutMs: PROBE_TIMEOUT_MS },
      );
      const counts = [...counted.stderr.matchAll(/frame=\s*(\d+)/g)];
      const keyframes = counts.length ? Number(counts[counts.length - 1][1]) : 0;
      const reason = proxySkipReason(probe, keyframes);
      if (reason) {
        this.known.set(key, { state: "none", reason });
        return;
      }
      mkdirSync(this.dir, { recursive: true });
      const threads = Math.max(2, Math.floor(cpus().length / 2));
      const encoded = await run(ffmpeg, proxyArgs(file, part, threads), { timeoutMs: ENCODE_TIMEOUT_MS });
      if (encoded.code !== 0) throw new Error(encoded.stderr.slice(-400));
      renameSync(part, target);
      this.known.set(key, { state: "ready", file: `${key}.mp4` });
      this.evict(target);
    } catch (error) {
      debugLog(`proxies: no copy of ${file}: ${error instanceof Error ? error.message : String(error)}`);
      rmSync(part, { force: true });
      // The preview carries on with the original.
      this.known.set(key, { state: "none", reason: "The copy couldn't be made." });
    }
  }

  /** Oldest used first, never the one just made. */
  private evict(keep: string) {
    const files = readdirSync(this.dir)
      .filter((name) => /^[a-f0-9]{40}\.mp4$/.test(name))
      .map((name) => {
        const path = join(this.dir, name);
        const stat = statSync(path);
        return { path, name, size: stat.size, used: stat.mtimeMs };
      })
      .sort((a, b) => a.used - b.used);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (total <= MAX_CACHE_BYTES) break;
      if (file.path === keep) continue;
      rmSync(file.path, { force: true });
      this.known.delete(file.name.slice(0, -4));
      total -= file.size;
    }
  }
}
