import { randomUUID } from "node:crypto";
import { lookup } from "node:dns";
import { closeSync, createWriteStream, mkdirSync, openSync, readdirSync, readSync, renameSync, rmSync, statSync } from "node:fs";
import { get as httpGet, type IncomingMessage } from "node:http";
import { get as httpsGet } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { dirname, extname, join, posix } from "node:path";
import { pipeline } from "node:stream/promises";
import { debugLog } from "../log.js";
import { projectDir, safeJoin, StudioError, uniquePath } from "./projects.js";
import { ensureFfmpeg, ensureYtdlp, run } from "./references.js";
import { slugName } from "./voice.js";
import type { WorkspacePaths } from "./workspace.js";

// The agent's shell only reaches a few sites, so media from anywhere else comes through here: the
// helper makes a plain GET with no logins, refuses this computer and its network, and only keeps
// what really is a media file, under a name it chooses.
const MAX_BYTES = 2 * 1024 ** 3;
const MAX_REDIRECTS = 5;

const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE.addSubnet(net, bits, "ipv4");
}
for (const [net, bits] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE.addSubnet(net, bits, "ipv6");
}

const isPrivate = (address: string) => PRIVATE.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
const privateError = () => new StudioError("That link points at this computer or its local network.", "bad_input");

/** Checked at connection time, so a name can't pass a check and then resolve somewhere else. */
const publicLookup = ((hostname: string, options: object, callback: (...args: unknown[]) => void) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some((found) => isPrivate(found.address))) return callback(privateError());
    if ((options as { all?: boolean }).all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}) as unknown as LookupFunction;

export function publicUrl(raw: unknown) {
  let url: URL;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    throw new StudioError("That isn't a web link.", "bad_input");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw new StudioError("Only plain http and https links can be downloaded.", "bad_input");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivate(host)) throw privateError();
  return url;
}

/** Follows redirects itself, so every hop gets the same checks. */
export async function fetchPublic(raw: string, signal: AbortSignal, hops = 0): Promise<IncomingMessage> {
  const url = publicUrl(raw);
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const get = url.protocol === "https:" ? httpsGet : httpGet;
    get(url, { lookup: publicLookup, signal, headers: { "user-agent": "Mozilla/5.0 (Agentcut)", accept: "*/*" } }, resolve).on("error", reject);
  });
  const location = response.headers.location;
  if (!location || ![301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) return response;
  response.resume();
  if (hops >= MAX_REDIRECTS) throw new StudioError("That link redirects too many times.", "bad_input");
  return fetchPublic(new URL(location, url).href, signal, hops + 1);
}

export interface SniffedMedia {
  kind: "audio" | "video" | "image" | "font" | "model";
  ext: string;
}

/** What a file really is, from its first bytes. A page or a script fails this whatever its name says. */
export function sniffMedia(head: Buffer): SniffedMedia | null {
  const ascii = (from: number, to: number) => head.toString("latin1", from, to);
  const start = ascii(0, 4);
  if (start.startsWith("ID3")) return { kind: "audio", ext: "mp3" };
  if (head[0] === 0xff && (head[1] & 0xf6) === 0xf0) return { kind: "audio", ext: "aac" };
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0 && (head[1] & 0x06) !== 0) return { kind: "audio", ext: "mp3" };
  if (start === "fLaC") return { kind: "audio", ext: "flac" };
  if (start === "OggS") return { kind: "audio", ext: "ogg" };
  if (start === "RIFF" && ascii(8, 12) === "WAVE") return { kind: "audio", ext: "wav" };
  if (start === "RIFF" && ascii(8, 11) === "AVI") return { kind: "video", ext: "avi" };
  if (start === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", ext: "webp" };
  if (start === "FORM" && ascii(8, 11) === "AIF") return { kind: "audio", ext: "aiff" };
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (/^(M4A|M4B|F4A)/.test(brand)) return { kind: "audio", ext: "m4a" };
    if (brand === "avif" || brand === "avis") return { kind: "image", ext: "avif" };
    return { kind: "video", ext: brand === "qt  " ? "mov" : "mp4" };
  }
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return { kind: "video", ext: head.includes("webm", 0, "latin1") ? "webm" : "mkv" };
  }
  if (head[0] === 0x89 && ascii(1, 4) === "PNG") return { kind: "image", ext: "png" };
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { kind: "image", ext: "jpg" };
  if (start === "GIF8") return { kind: "image", ext: "gif" };
  if (start === "wOF2") return { kind: "font", ext: "woff2" };
  if (start === "wOFF") return { kind: "font", ext: "woff" };
  if (start === "OTTO") return { kind: "font", ext: "otf" };
  if (head[0] === 0 && head[1] === 1 && head[2] === 0 && head[3] === 0) return { kind: "font", ext: "ttf" };
  if (start === "glTF") return { kind: "model", ext: "glb" };
  return null;
}

function sniffFile(file: string) {
  const head = Buffer.alloc(64);
  const fd = openSync(file, "r");
  try {
    return sniffMedia(head.subarray(0, readSync(fd, head, 0, head.length, 0)));
  } finally {
    closeSync(fd);
  }
}

/** A file behind a link, if the link answers with one. */
async function saveMedia(response: IncomingMessage, file: string) {
  await pipeline(
    response,
    async function* (source: AsyncIterable<Buffer>) {
      let size = 0;
      for await (const chunk of source) {
        size += chunk.length;
        if (size > MAX_BYTES) throw new StudioError("That file is over 2 GB.", "bad_input");
        yield chunk;
      }
    },
    createWriteStream(file),
  );
  return sniffFile(file);
}

/** A share page rather than a file (a video site): the media is inside it. */
async function fromPage(url: string, dir: string, audioOnly: boolean, signal: AbortSignal) {
  const [ytdlp, ffmpeg] = await Promise.all([ensureYtdlp(), ensureFfmpeg()]);
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
    "2G",
    "--ffmpeg-location",
    ffmpeg,
    "--js-runtimes",
    `node:${process.execPath}`,
    ...(audioOnly ? ["-f", "ba/b"] : ["-S", "res:1080,vcodec:h264,acodec:aac", "-f", "bv*+ba/b", "--merge-output-format", "mp4"]),
    "-o",
    join(dir, "page.%(ext)s"),
    "--",
    url,
  ];
  const result = await run(ytdlp, args, { timeoutMs: 8 * 60_000, onChild: (child) => signal.addEventListener("abort", () => child?.kill()) });
  debugLog(`download: yt-dlp exited ${result.code}\n${result.stderr.slice(-2000)}`);
  const name = readdirSync(dir).find((file) => file.startsWith("page.") && !file.endsWith(".part"));
  return name ? join(dir, name) : null;
}

export interface DownloadMediaInput {
  url: string;
  name?: string;
  folder?: string;
  audioOnly?: boolean;
}

const FOLDERS: Record<SniffedMedia["kind"], string> = { audio: "music", video: "video", image: "images", font: "fonts", model: "models" };

/** Save the audio, video, image, font or 3D model at a link into the project's assets/ (never overwrites). */
export async function downloadMedia(paths: WorkspacePaths, slug: string, input: DownloadMediaInput) {
  const url = publicUrl(input.url);
  const root = projectDir(paths, slug);
  const dir = join(root, ".studio", "downloads", randomUUID());
  mkdirSync(dir, { recursive: true });
  const signal = AbortSignal.timeout(9 * 60_000);
  try {
    let file = join(dir, "media");
    let media: SniffedMedia | null = null;
    const response = await fetchPublic(url.href, signal);
    if (response.statusCode === 200 && !/html/i.test(response.headers["content-type"] ?? "")) media = await saveMedia(response, file);
    else response.destroy();
    if (!media) {
      const found = await fromPage(url.href, dir, Boolean(input.audioOnly), signal);
      if (found) {
        file = found;
        media = sniffFile(file);
      }
    }
    if (!media) {
      throw new StudioError(
        "Found no audio, video, image or font at that link: it may be private, need a login or be protected (Suno song links are). Ask the user to download the file from the site and add it to the project.",
        "bad_input",
      );
    }
    const fromUrl = posix.basename(url.pathname, extname(url.pathname));
    const base = slugName(input.name || fromUrl) || media.kind;
    const folder = slugName(input.folder ?? "") || (input.audioOnly ? "music" : FOLDERS[media.kind]);
    const target = uniquePath(safeJoin(root, `assets/${folder}/${base}.${media.ext}`));
    mkdirSync(dirname(target), { recursive: true });
    renameSync(file, target);
    const rel = `assets/${folder}/${target.split(/[\\/]/).pop()}`;
    debugLog(`download: ${slug} ${rel} from ${url.hostname}`);
    return { path: rel, kind: media.kind, bytes: statSync(target).size, source: url.href };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
