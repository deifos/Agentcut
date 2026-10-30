import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { lstat, open, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PACKAGE_VERSION } from "../config.js";
import { debugLog } from "../log.js";
import { projectDir, safeJoin, SLUG_PATTERN, slugify, StudioError } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

/**
 * Share links. A project is sent as one logical stream (every file's bytes back to back), cut into
 * 8 MB chunks, each encrypted with AES-256-GCM under a random per-share key, plus an encrypted
 * manifest naming the files. The share Worker (workers/share) stores them for 3 days; the key
 * only travels in the link's #fragment, so the Worker and the bucket see ciphertext only.
 *
 * Wire format (keep in sync with lib/studio/share.ts, which decrypts the manifest in the page):
 * - key: 32 random bytes, base64url in the link.
 * - IV (12 bytes): byte 0 = 0 for a chunk, 1 for the manifest; bytes 4–11 = the chunk number
 *   (big-endian). Each key encrypts one share, so the IVs never repeat.
 * - AAD: `agentcut-share/1/<id>/manifest` or `agentcut-share/1/<id>/c/<n>`.
 * - Stored bytes: ciphertext followed by the 16-byte tag (what WebCrypto produces).
 */

export const SHARE_FORMAT = 1;
export const CHUNK_BYTES = 8 * 1024 * 1024;
export const MAX_SHARE_BYTES = 1024 * 1024 * 1024;
export const MAX_SHARE_FILES = 5000;
/** Not shared: exports, the chat, and anything that isn't part of the project itself. */
const SKIPPED_TOP = new Set(["renders", ".studio", "node_modules", ".git"]);
/** Instructions and settings agents load by themselves, at any depth: a share must not bring its own. */
const AGENT_FILES = new Set(["claude.md", "claude.local.md", "agents.md", "agents.override.md", "gemini.md", ".mcp.json", ".claude", ".agents", ".codex", ".cursor", ".gemini"]);
const PARALLEL = 3;
/** Per request: a stalled connection fails and retries instead of hanging the share. */
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

export interface ShareManifest {
  format: number;
  name: string;
  /** The sender's folder name; the import keeps it when it's free. */
  slug?: string;
  agentcutVersion: string;
  createdAt: number;
  chunkBytes: number;
  chunks: number;
  bytes: number;
  files: { path: string; size: number; sha256: string }[];
  project: { fps?: number; durationInFrames?: number; style?: string; scenes: number };
}

export interface ShareProgress {
  stage: "preparing" | "uploading" | "downloading" | "done" | "error";
  done: number;
  total: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Crypto

function iv(kind: 0 | 1, n: number) {
  const out = Buffer.alloc(12);
  out[0] = kind;
  out.writeBigUInt64BE(BigInt(n), 4);
  return out;
}

function aad(id: string, object: string) {
  return Buffer.from(`agentcut-share/${SHARE_FORMAT}/${id}/${object}`, "utf8");
}

function encrypt(key: Buffer, id: string, object: string, kind: 0 | 1, n: number, plain: Buffer) {
  const cipher = createCipheriv("aes-256-gcm", key, iv(kind, n));
  cipher.setAAD(aad(id, object));
  return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
}

function decrypt(key: Buffer, id: string, object: string, kind: 0 | 1, n: number, sealed: Buffer) {
  if (sealed.length < 16) throw new StudioError("A share file is damaged.", "share_corrupt");
  const decipher = createDecipheriv("aes-256-gcm", key, iv(kind, n));
  decipher.setAAD(aad(id, object));
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  try {
    return Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
  } catch {
    throw new StudioError("This link's key doesn't match the shared files (copy the whole link, including the part after #).", "share_key");
  }
}

function keyFrom(text: unknown) {
  const key = typeof text === "string" && /^[A-Za-z0-9_-]{43}$/.test(text) ? Buffer.from(text, "base64url") : null;
  if (!key || key.length !== 32) throw new StudioError("The share link is incomplete: its key is missing.", "share_key");
  return key;
}

// ---------------------------------------------------------------------------
// HTTP

/** The share service URL comes from the page (it's trusted: it already drives the agent). */
function apiBase(api: unknown) {
  if (typeof api !== "string" || !api) throw new StudioError("Sharing isn't set up on this Agentcut.", "share_unavailable");
  let url: URL;
  try {
    url = new URL(api);
  } catch {
    throw new StudioError("Bad share service URL.", "bad_input");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new StudioError("The share service must use https.", "bad_input");
  }
  return url.toString().replace(/\/+$/, "");
}

async function errorText(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {}
  return `HTTP ${response.status}`;
}

async function withRetry<T>(what: string, run: () => Promise<T>) {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await run();
    } catch (error) {
      last = error;
      // Our own errors (expired, bad key, too large) won't fix themselves.
      if (error instanceof StudioError) throw error;
      debugLog(`share: ${what} failed (attempt ${attempt + 1}): ${(error as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw new StudioError(`Network error while sharing (${what}): ${(last as Error)?.message ?? last}`, "share_network");
}

/** HTTP errors the share service meant (4xx) become StudioErrors; 5xx and network errors retry. */
async function check(response: Response) {
  if (response.ok) return response;
  const message = await errorText(response);
  if (response.status >= 400 && response.status < 500) {
    const code = response.status === 410 ? "share_expired" : response.status === 404 ? "share_not_found" : "share_rejected";
    throw new StudioError(message, code);
  }
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Share

interface LocalFile {
  path: string;
  abs: string;
  size: number;
}

async function collectFiles(dir: string) {
  const files: LocalFile[] = [];
  const walk = async (rel: string) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (!rel && SKIPPED_TOP.has(entry.name)) continue;
      if (AGENT_FILES.has(entry.name.toLowerCase())) continue;
      if (entry.name.endsWith(".tmp") || entry.name === ".DS_Store") continue;
      // Links are skipped, never followed (a junction can point anywhere on the disk).
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        const abs = join(dir, path);
        files.push({ path, abs, size: (await lstat(abs)).size });
        if (files.length > MAX_SHARE_FILES) {
          throw new StudioError(`This project has more than ${MAX_SHARE_FILES} files; shares hold up to that many.`, "too_large");
        }
      }
    }
  };
  await walk("");
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function projectInfo(dir: string, fallbackName: string) {
  try {
    const raw = JSON.parse(readFileSync(join(dir, "project.json"), "utf8")) as Record<string, unknown>;
    return {
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 120) : fallbackName,
      fps: typeof raw.fps === "number" ? raw.fps : undefined,
      durationInFrames: typeof raw.durationInFrames === "number" ? raw.durationInFrames : undefined,
      style: typeof raw.style === "string" ? raw.style : undefined,
    };
  } catch {
    return { name: fallbackName };
  }
}

export async function shareProject(
  paths: WorkspacePaths,
  slug: string,
  apiInput: unknown,
  onProgress: (progress: ShareProgress) => void,
) {
  const api = apiBase(apiInput);
  const dir = projectDir(paths, slug);
  if (!existsSync(join(dir, "project.json"))) throw new StudioError(`Project "${slug}" not found.`, "not_found");
  onProgress({ stage: "preparing", done: 0, total: 0 });
  const files = await collectFiles(dir);
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  if (bytes > MAX_SHARE_BYTES) {
    throw new StudioError(
      `This project is ${(bytes / 1024 / 1024).toFixed(0)} MB without its renders; share links hold up to 1 GB. Remove unused footage from assets/ and try again.`,
      "too_large",
    );
  }
  const chunks = Math.ceil(bytes / CHUNK_BYTES);
  const created = await withRetry("create", async () =>
    check(
      await fetch(`${api}/v1/shares`, {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bytes, chunks }),
      }),
    ).then((r) => r.json() as Promise<{ id: string; token: string; created: number; expiresAt: number }>),
  );
  const { id } = created;
  const key = randomBytes(32);
  const auth = {
    "x-share-token": created.token,
    "x-share-chunks": String(chunks),
    "x-share-created": String(created.created),
    "content-type": "application/octet-stream",
  };
  const put = (object: string, body: Buffer) =>
    withRetry(object, async () => {
      await check(await fetch(`${api}/v1/shares/${id}/${object}`, { method: "PUT", headers: auth, body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }));
    });

  let sent = 0;
  let lastReport = 0;
  const report = (force = false) => {
    if (!force && Date.now() - lastReport < 250) return;
    lastReport = Date.now();
    onProgress({ stage: "uploading", done: sent, total: bytes });
  };
  report(true);

  // Read every file into the chunk buffer in order; upload up to PARALLEL chunks at once.
  const inFlight = new Set<Promise<void>>();
  let failure: unknown = null;
  let index = 0;
  const flush = async (plain: Buffer) => {
    if (failure) throw failure;
    const n = index++;
    const sealed = encrypt(key, id, `c/${n}`, 0, n, plain);
    const task: Promise<void> = put(`c/${n}`, sealed)
      .then(
        () => {
          sent += plain.length;
          report();
        },
        (error: unknown) => {
          failure ??= error;
        },
      )
      .finally(() => inFlight.delete(task));
    inFlight.add(task);
    if (inFlight.size >= PARALLEL) await Promise.race(inFlight);
    if (failure) throw failure;
  };
  const manifestFiles: ShareManifest["files"] = [];
  const buffer = Buffer.allocUnsafe(CHUNK_BYTES);
  let fill = 0;
  for (const file of files) {
    const hash = createHash("sha256");
    let handle: FileHandle | null = null;
    try {
      handle = await open(file.abs, "r");
      let left = file.size;
      while (left > 0) {
        const { bytesRead } = await handle.read(buffer, fill, Math.min(CHUNK_BYTES - fill, left), null);
        if (bytesRead === 0) throw new StudioError(`${file.path} changed while sharing. Try again.`, "share_changed");
        hash.update(buffer.subarray(fill, fill + bytesRead));
        fill += bytesRead;
        left -= bytesRead;
        if (fill === CHUNK_BYTES) {
          await flush(Buffer.from(buffer));
          fill = 0;
        }
      }
    } finally {
      await handle?.close();
    }
    manifestFiles.push({ path: file.path, size: file.size, sha256: hash.digest("hex") });
  }
  if (fill > 0) await flush(Buffer.from(buffer.subarray(0, fill)));
  await Promise.all(inFlight);
  if (failure) throw failure;
  if (index !== chunks) throw new StudioError("The project changed while sharing. Try again.", "share_changed");

  const info = projectInfo(dir, slug);
  const manifest: ShareManifest = {
    format: SHARE_FORMAT,
    name: info.name,
    slug,
    agentcutVersion: PACKAGE_VERSION,
    createdAt: created.created,
    chunkBytes: CHUNK_BYTES,
    chunks,
    bytes,
    files: manifestFiles,
    project: {
      fps: info.fps,
      durationInFrames: info.durationInFrames,
      style: info.style,
      scenes: manifestFiles.filter((f) => /^scenes\/[^/]+\.(tsx|jsx|ts|js)$/.test(f.path)).length,
    },
  };
  // Last: a share is only visible once its manifest exists, so nobody downloads half a project.
  await put("manifest", encrypt(key, id, "manifest", 1, 0, Buffer.from(JSON.stringify(manifest), "utf8")));
  onProgress({ stage: "done", done: bytes, total: bytes });
  debugLog(`share: ${slug} → ${id} (${files.length} files, ${bytes} bytes, ${chunks} chunks)`);
  return { id, key: key.toString("base64url"), expiresAt: created.expiresAt, bytes, files: files.length, name: info.name };
}

// ---------------------------------------------------------------------------
// Import

const WINDOWS_DEVICE = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;

/** Paths from someone else's manifest: plain relative paths inside the project, nothing hidden we manage. */
export function checkPath(path: unknown): string {
  if (typeof path !== "string" || !path || path.length > 400) throw new StudioError("The share has a bad file name.", "share_corrupt");
  const parts = path.split("/");
  const bad =
    path.includes("\\") ||
    path.includes(":") ||
    path.includes("\0") ||
    parts.some((part) => part === "" || part === "." || part === ".." || /[. ]$/.test(part) || WINDOWS_DEVICE.test(part)) ||
    SKIPPED_TOP.has(parts[0].toLowerCase());
  if (bad) throw new StudioError(`The share has a file outside the project (${path}).`, "share_corrupt");
  if (parts.some((part) => AGENT_FILES.has(part.toLowerCase()))) throw new StudioError(`The share tries to add agent instructions (${path}).`, "share_corrupt");
  return path;
}

function parseManifest(raw: Buffer): ShareManifest {
  let value: ShareManifest;
  try {
    value = JSON.parse(raw.toString("utf8")) as ShareManifest;
  } catch {
    throw new StudioError("The share's file list is damaged.", "share_corrupt");
  }
  if (value.format !== SHARE_FORMAT) {
    throw new StudioError("This share was made by a newer Agentcut. Update the helper: npx -y agentcut@latest", "share_version");
  }
  const files = Array.isArray(value.files) ? value.files : [];
  if (!files.length || files.length > MAX_SHARE_FILES) throw new StudioError("The share's file list is damaged.", "share_corrupt");
  let total = 0;
  const seen = new Set<string>();
  for (const file of files) {
    const path = checkPath(file.path).toLowerCase();
    if (seen.has(path)) throw new StudioError("The share lists a file twice.", "share_corrupt");
    seen.add(path);
    if (!Number.isInteger(file.size) || file.size < 0 || typeof file.sha256 !== "string") {
      throw new StudioError("The share's file list is damaged.", "share_corrupt");
    }
    total += file.size;
  }
  if (!seen.has("project.json")) throw new StudioError("The share has no project.json.", "share_corrupt");
  if (
    total !== value.bytes ||
    value.bytes > MAX_SHARE_BYTES ||
    value.chunkBytes !== CHUNK_BYTES ||
    value.chunks !== Math.ceil(total / CHUNK_BYTES)
  ) {
    throw new StudioError("The share's file list is damaged.", "share_corrupt");
  }
  return value;
}

export async function importShare(
  paths: WorkspacePaths,
  input: { api?: unknown; id?: unknown; key?: unknown },
  onProgress: (progress: ShareProgress) => void,
) {
  const api = apiBase(input.api);
  const id = typeof input.id === "string" && /^[A-Za-z0-9]{12}$/.test(input.id) ? input.id : null;
  if (!id) throw new StudioError("The share link is incomplete.", "bad_input");
  const key = keyFrom(input.key);
  const get = (object: string) =>
    withRetry(object, async () => Buffer.from(await (await check(await fetch(`${api}/v1/shares/${id}/${object}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }))).arrayBuffer()));

  onProgress({ stage: "preparing", done: 0, total: 0 });
  const manifest = parseManifest(decrypt(key, id, "manifest", 1, 0, await get("manifest")));

  // Unpack beside the projects (same disk, so the final rename is instant), hidden from the list.
  // Each request owns its staging directory, including concurrent imports of the same link.
  const staging = mkdtempSync(join(paths.projects, `.incoming-${id}-`));
  try {
    let received = 0;
    onProgress({ stage: "downloading", done: 0, total: manifest.bytes });
    // Download ahead while writing in order.
    const pending = new Map<number, Promise<Buffer>>();
    const fetchChunk = (n: number) =>
      get(`c/${n}`).then((sealed) => {
        const plain = decrypt(key, id, `c/${n}`, 0, n, sealed);
        const expected = n === manifest.chunks - 1 ? manifest.bytes - n * CHUNK_BYTES : CHUNK_BYTES;
        if (plain.length !== expected) throw new StudioError("A share file is damaged.", "share_corrupt");
        return plain;
      });
    const chunkAt = (n: number) => {
      for (let ahead = n; ahead < Math.min(manifest.chunks, n + PARALLEL); ahead++) {
        if (!pending.has(ahead)) {
          const task = fetchChunk(ahead);
          task.catch(() => undefined);
          pending.set(ahead, task);
        }
      }
      const task = pending.get(n)!;
      pending.delete(n);
      return task;
    };

    let chunkIndex = 0;
    let chunk: Buffer = Buffer.alloc(0);
    let offset = 0;
    let lastReport = 0;
    for (const file of manifest.files) {
      const target = safeJoin(staging, file.path);
      mkdirSync(dirname(target), { recursive: true });
      const handle = await open(target, "wx");
      const hash = createHash("sha256");
      try {
        let left = file.size;
        while (left > 0) {
          if (offset === chunk.length) {
            chunk = await chunkAt(chunkIndex++);
            offset = 0;
          }
          const piece = chunk.subarray(offset, offset + Math.min(left, chunk.length - offset));
          await handle.write(piece);
          hash.update(piece);
          offset += piece.length;
          left -= piece.length;
          received += piece.length;
          if (Date.now() - lastReport > 250) {
            lastReport = Date.now();
            onProgress({ stage: "downloading", done: received, total: manifest.bytes });
          }
        }
      } finally {
        await handle.close();
      }
      if (hash.digest("hex") !== file.sha256) throw new StudioError(`${file.path} didn't arrive intact. Try again.`, "share_corrupt");
    }

    for (const sub of ["scenes", "assets", "renders", ".studio"]) mkdirSync(join(staging, sub), { recursive: true });
    const base = typeof manifest.slug === "string" && SLUG_PATTERN.test(manifest.slug) ? manifest.slug : slugify(manifest.name);
    let slug = base;
    for (let n = 2; existsSync(join(paths.projects, slug)); n++) {
      const suffix = `-${n}`;
      slug = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    }
    renameSync(staging, join(paths.projects, slug));
    onProgress({ stage: "done", done: manifest.bytes, total: manifest.bytes });
    debugLog(`share: imported ${id} as ${slug} (${manifest.files.length} files, ${manifest.bytes} bytes)`);
    return { slug, name: manifest.name, files: manifest.files.length, bytes: manifest.bytes, from: manifest.agentcutVersion };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
    throw error;
  }
}
