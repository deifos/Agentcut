import { createReadStream, createWriteStream, existsSync, mkdirSync, openSync, realpathSync, statSync, unlinkSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, extname, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { assertSlug, projectDir, safeJoin, StudioError, uniquePath } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

const MIME: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024;
const UPLOAD_ROOTS = ["assets/", "renders/", ".studio/attachments/"];

export interface StudioHttpDeps {
  paths: WorkspacePaths;
  getBundle(slug: string): { code: string | null; revision: number } | null;
  ensureBundle(slug: string): Promise<void>;
  onUploaded(slug: string, relPath: string): void;
  /** Create a project around footage sent from a video editor. */
  importFootage(input: Record<string, unknown>): { slug: string; videoPath?: string; screenPaths?: string[]; cameraPath?: string };
}

export function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, HEAD, PUT, POST, OPTIONS",
    "access-control-allow-headers": "content-type, range",
    "access-control-expose-headers": "content-length, content-range, accept-ranges, x-studio-path, x-studio-revision",
    "access-control-allow-private-network": "true",
    "access-control-max-age": "600",
    "cross-origin-resource-policy": "cross-origin",
    vary: "origin",
  };
}

function sendJson(response: ServerResponse, status: number, body: unknown, extra: Record<string, string>) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    ...extra,
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function sendFile(
  request: IncomingMessage,
  response: ServerResponse,
  file: string,
  extra: Record<string, string>,
) {
  let size: number;
  let revision: string;
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    size = stat.size;
    revision = `${stat.size}-${stat.mtimeMs}-${stat.ctimeMs}`;
  } catch {
    sendJson(response, 404, { error: "File not found" }, extra);
    return;
  }
  const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string> = {
    ...extra,
    "content-type": type,
    "accept-ranges": "bytes",
    "x-studio-revision": revision,
    "cache-control": "no-cache",
  };
  const range = request.headers.range;
  const match = typeof range === "string" ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match && (match[1] !== "" || match[2] !== "")) {
    let start: number;
    let end: number;
    if (match[1] === "") {
      const suffix = Number(match[2]);
      start = Math.max(0, size - suffix);
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    }
    if (start > end || start >= size) {
      response.writeHead(416, { ...headers, "content-range": `bytes */${size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      ...headers,
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": String(end - start + 1),
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    await pipeline(createReadStream(file, { start, end }), response).catch(() => undefined);
    return;
  }
  response.writeHead(200, { ...headers, "content-length": String(size) });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  await pipeline(createReadStream(file), response).catch(() => undefined);
}

function decodePath(path: string) {
  return path
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");
}

/** Studio HTTP routes. Returns false when the URL isn't a studio route. */
export async function handleStudioHttp(
  request: IncomingMessage,
  response: ServerResponse,
  deps: StudioHttpDeps,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (!url.pathname.startsWith("/studio/")) return false;
  const origin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin;
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    response.writeHead(204, cors);
    response.end();
    return true;
  }

  try {
    const bundleMatch = /^\/studio\/bundle\/([a-z0-9-]+)\.js$/.exec(url.pathname);
    if (bundleMatch && (request.method === "GET" || request.method === "HEAD")) {
      const slug = assertSlug(bundleMatch[1]);
      await deps.ensureBundle(slug);
      const bundle = deps.getBundle(slug);
      if (!bundle?.code) {
        sendJson(response, 503, { error: "Bundle not built yet (see studio status for errors)." }, cors);
        return true;
      }
      response.writeHead(200, {
        ...cors,
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
        "x-studio-revision": String(bundle.revision),
        "content-length": String(Buffer.byteLength(bundle.code)),
      });
      response.end(request.method === "HEAD" ? undefined : bundle.code);
      return true;
    }

    const fileMatch = /^\/studio\/files\/([a-z0-9-]+)\/(.+)$/.exec(url.pathname);
    if (fileMatch && (request.method === "GET" || request.method === "HEAD")) {
      const slug = assertSlug(fileMatch[1]);
      const dir = projectDir(deps.paths, slug);
      const file = safeJoin(dir, decodePath(fileMatch[2]));
      const rel = relative(realpathSync(dir), existsSync(file) ? realpathSync(file) : file).split(/[\\/]/).join("/").toLowerCase();
      if (rel.startsWith(".studio/") && !rel.startsWith(".studio/attachments/")) {
        throw new StudioError("Not allowed.", "forbidden");
      }
      await sendFile(request, response, file, cors);
      return true;
    }

    const libraryMatch = /^\/studio\/library\/(.+)$/.exec(url.pathname);
    if (libraryMatch && (request.method === "GET" || request.method === "HEAD")) {
      await sendFile(request, response, safeJoin(deps.paths.library, decodePath(libraryMatch[1])), cors);
      return true;
    }

    const uploadMatch = /^\/studio\/upload\/([a-z0-9-]+)\/(.+)$/.exec(url.pathname);
    if (uploadMatch && request.method === "PUT") {
      const slug = assertSlug(uploadMatch[1]);
      const rel = decodePath(uploadMatch[2]);
      if (!UPLOAD_ROOTS.some((root) => rel.startsWith(root))) {
        throw new StudioError(`Uploads go under ${UPLOAD_ROOTS.join(", ")}.`, "forbidden");
      }
      const length = Number(request.headers["content-length"] ?? 0);
      if (length > MAX_UPLOAD_BYTES) throw new StudioError("File too large.", "too_large");
      const dir = projectDir(deps.paths, slug);
      const requested = safeJoin(dir, rel);
      mkdirSync(dirname(requested), { recursive: true });
      const actualParent = relative(realpathSync(dir), realpathSync(dirname(requested))).split(/[\\/]/).join("/").toLowerCase() + "/";
      if (!UPLOAD_ROOTS.some((root) => actualParent.startsWith(root))) {
        throw new StudioError("Upload path points outside the allowed media folders.", "forbidden");
      }
      let target: string;
      let fd: number;
      for (;;) {
        target = uniquePath(requested);
        try {
          fd = openSync(target, "wx");
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
      }
      let received = 0;
      request.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_UPLOAD_BYTES) request.destroy(new Error("File too large."));
      });
      try {
        await pipeline(request, createWriteStream(target, { fd }));
      } catch (error) {
        unlinkSync(target);
        throw error;
      }
      const savedRel = target.slice(dir.length + 1).split(/[\\/]/).join("/");
      deps.onUploaded(slug, savedRel);
      sendJson(response, 200, { path: savedRel, size: received }, { ...cors, "x-studio-path": savedRel });
      return true;
    }

    if (url.pathname === "/studio/import" && request.method === "POST") {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += (chunk as Buffer).length;
        if (size > 8 * 1024 * 1024) throw new StudioError("Import details too large.", "too_large");
        chunks.push(chunk as Buffer);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
      sendJson(response, 200, deps.importFootage(body), cors);
      return true;
    }

    sendJson(response, 404, { error: "Not found" }, cors);
    return true;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const status = code === "bad_path" || code === "bad_slug" ? 400 : code === "forbidden" ? 403 : code === "too_large" ? 413 : 500;
    sendJson(response, status, { error: error instanceof Error ? error.message : String(error) }, cors);
    return true;
  }
}
