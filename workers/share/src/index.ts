/**
 * Agentcut share links: a Cloudflare Worker in front of an R2 bucket.
 *
 * The helper encrypts a project on the sender's computer and uploads it as numbered chunks plus a
 * manifest; the recipient's helper downloads and decrypts them. The key lives in the link's
 * #fragment, so this Worker and the bucket only ever see ciphertext. It stays stateless: a share's
 * limits (size, chunk count, upload window) are signed into an upload token, never stored.
 *
 * Routes (all under /v1):
 *   GET  /status                     { enabled, maxBytes, ttlHours }
 *   POST /shares                     { bytes, chunks } → { id, token, created, expiresAt }
 *   PUT  /shares/<id>/c/<n>          one encrypted chunk (token headers)
 *   PUT  /shares/<id>/manifest       the encrypted manifest, uploaded last (token headers)
 *   GET  /shares/<id>/manifest|c/<n> download (404 unknown or unfinished, 410 expired)
 *
 * Keep the limits in sync with packages/agentcut/src/studio/share.ts.
 */

interface Env {
  BUCKET: R2Bucket;
  CREATE_LIMITER?: RateLimit;
  /** `wrangler secret put SIGNING_SECRET`: any long random string. */
  SIGNING_SECRET: string;
  /** Comma-separated page origins allowed to call from a browser. */
  ALLOWED_ORIGINS?: string;
  /** "false" turns sharing off (new shares only; existing links keep working until they expire). */
  SHARING_ENABLED?: string;
}

// Minimal shapes of the Workers runtime types we use (no @cloudflare/workers-types needed).
interface R2Object {
  customMetadata?: Record<string, string>;
}
interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  size: number;
}
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | null,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<R2Object | null>;
}
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}
declare const caches: { default: Cache };

const TTL_MS = 3 * 24 * 60 * 60 * 1000;
/** How long the sender has to upload every chunk after creating the share. */
const UPLOAD_WINDOW_MS = 2 * 60 * 60 * 1000;
const MAX_BYTES = 1024 * 1024 * 1024;
/** Plaintext bytes per chunk, plus the 16-byte AES-GCM tag. */
const CHUNK_BYTES = 8 * 1024 * 1024;
const MAX_CHUNK_UPLOAD = CHUNK_BYTES + 16;
const MAX_CHUNKS = Math.ceil(MAX_BYTES / CHUNK_BYTES);
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9]{12}$/;

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const response = await route(request, env, ctx);
      for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
      return response;
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message }, status, cors);
    }
  },
};

export default worker;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const enabled = env.SHARING_ENABLED !== "false";

  if (url.pathname === "/v1/status" && request.method === "GET") {
    return json({ enabled, maxBytes: MAX_BYTES, ttlHours: TTL_MS / 3_600_000 });
  }

  if (url.pathname === "/v1/shares" && request.method === "POST") {
    if (!enabled) throw new HttpError(503, "Sharing is turned off right now.");
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (env.CREATE_LIMITER && !(await env.CREATE_LIMITER.limit({ key: ip })).success) {
      throw new HttpError(429, "Too many shares in a short time. Wait a minute and try again.");
    }
    const body = (await request.json().catch(() => null)) as { bytes?: unknown; chunks?: unknown } | null;
    const bytes = Number(body?.bytes);
    const chunks = Number(body?.chunks);
    if (!Number.isInteger(bytes) || bytes < 1) throw new HttpError(400, "bytes must be a positive integer.");
    if (bytes > MAX_BYTES) throw new HttpError(413, `Projects up to ${MAX_BYTES / 1024 / 1024 / 1024} GB can be shared.`);
    if (!Number.isInteger(chunks) || chunks !== Math.ceil(bytes / CHUNK_BYTES) || chunks > MAX_CHUNKS) {
      throw new HttpError(400, "chunks doesn't match bytes.");
    }
    const id = randomId();
    const created = Date.now();
    const token = await sign(env, `${id}.${chunks}.${created}`);
    return json({ id, token, created, chunks, chunkBytes: CHUNK_BYTES, expiresAt: created + TTL_MS }, 201);
  }

  // One object name per chunk: leading-zero aliases would bypass the storage limit.
  const match = /^\/v1\/shares\/([^/]+)\/(manifest|c\/(0|[1-9]\d{0,3}))$/.exec(url.pathname);
  if (!match) throw new HttpError(404, "Not found.");
  const id = match[1];
  if (!ID_PATTERN.test(id)) throw new HttpError(404, "Not found.");
  const object = match[2];
  const key = `shares/${id}/${object}`;

  if (request.method === "PUT") {
    const chunks = Number(request.headers.get("x-share-chunks"));
    const created = Number(request.headers.get("x-share-created"));
    const token = request.headers.get("x-share-token") ?? "";
    if (!Number.isInteger(chunks) || !Number.isInteger(created)) throw new HttpError(401, "Missing upload token.");
    if (!(await verify(env, `${id}.${chunks}.${created}`, token))) throw new HttpError(401, "Bad upload token.");
    if (Date.now() > created + UPLOAD_WINDOW_MS) throw new HttpError(401, "The upload window for this share closed. Share again.");
    const limit = object === "manifest" ? MAX_MANIFEST_BYTES : MAX_CHUNK_UPLOAD;
    if (match[3] !== undefined && Number(match[3]) >= chunks) throw new HttpError(400, "Chunk number out of range.");
    const length = Number(request.headers.get("content-length"));
    if (!Number.isInteger(length) || length < 1) throw new HttpError(411, "Content-Length required.");
    if (length > limit) throw new HttpError(413, "Upload too large.");
    // Buffered (≤ 8 MB) so a lying Content-Length can't push more than the limit into the bucket.
    const data = await request.arrayBuffer();
    if (data.byteLength !== length) throw new HttpError(400, "Body doesn't match Content-Length.");
    await env.BUCKET.put(key, data, {
      httpMetadata: { contentType: "application/octet-stream" },
      customMetadata: { expires: String(created + TTL_MS) },
    });
    return json({ ok: true });
  }

  if (request.method === "GET" || request.method === "HEAD") {
    // Objects never change once uploaded, so repeat downloads come from Cloudflare's cache
    // instead of counting as R2 reads.
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await caches.default.match(cacheKey);
    if (cached) return new Response(request.method === "HEAD" ? null : cached.body, cached);
    const found = await env.BUCKET.get(key);
    if (!found) throw new HttpError(404, "This share doesn't exist, or it's still uploading.");
    const expires = Number(found.customMetadata?.expires);
    const left = Math.floor((expires - Date.now()) / 1000);
    if (!Number.isFinite(expires) || left <= 0) throw new HttpError(410, "This share has expired.");
    const response = new Response(found.body, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(found.size),
        "cache-control": `public, max-age=${left}, immutable`,
        "x-share-expires": String(expires),
      },
    });
    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  throw new HttpError(405, "Method not allowed.");
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, HEAD, POST, PUT, OPTIONS",
    "access-control-allow-headers": "content-type, x-share-token, x-share-chunks, x-share-created",
    "access-control-expose-headers": "x-share-expires",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra },
  });
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomId() {
  // 62^12 ≈ 3e21: unguessable enough that ids can't be enumerated, and the content is encrypted anyway.
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function hmacKey(env: Env) {
  if (!env.SIGNING_SECRET) throw new HttpError(500, "SIGNING_SECRET isn't set on the share Worker.");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env.SIGNING_SECRET), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function sign(env: Env, message: string) {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(env), new TextEncoder().encode(message));
  return base64url(new Uint8Array(signature));
}

async function verify(env: Env, message: string, token: string) {
  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = fromBase64url(token);
  } catch {
    return false;
  }
  return crypto.subtle.verify("HMAC", await hmacKey(env), signature, new TextEncoder().encode(message));
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
