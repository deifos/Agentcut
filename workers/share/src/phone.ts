import {
  PHONE_CHUNK,
  PHONE_MAX_BYTES,
  PHONE_TTL,
  type PhoneJob,
} from "../../../packages/agentcut/src/studio/phone-protocol";

interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  list<T>(options: { prefix: string }): Promise<Map<string, T>>;
  setAlarm(time: number): Promise<void>;
}
interface State {
  storage: Storage;
}
export interface PhoneEnv {
  PHONES?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  BUCKET: {
    put(key: string, value: ArrayBuffer): Promise<unknown>;
    get(key: string): Promise<{ body: ReadableStream } | null>;
    delete(keys: string[]): Promise<void>;
  };
  CREATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  PHONE_ENABLED?: string;
}
interface Device {
  desktop: string;
  invite: string;
  phone?: string;
  expires: number;
  revoked?: boolean;
}
interface StoredJob extends PhoneJob {
  input: number[];
  output: number[];
  manifest?: boolean;
  resultManifest?: boolean;
  resultAccess?: string;
}
const validToken = (v: unknown): v is string =>
  typeof v === "string" && /^[\w-]{43}$/.test(v);
const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });
class Fault extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new Fault(status, message);
};
async function hash(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
}
async function body(request: Request) {
  const text = await bounded(request, 16_384);
  try {
    return JSON.parse(new TextDecoder().decode(text));
  } catch {
    return fail(400, "Invalid request.");
  }
}
async function bounded(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return fail(400, "Missing body.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > max) {
      await reader.cancel();
      return fail(413, "Upload too large.");
    }
    parts.push(next.value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out.buffer;
}

export async function routePhone(
  request: Request,
  env: PhoneEnv,
): Promise<Response> {
  if (!env.PHONES || env.PHONE_ENABLED !== "true")
    return reply(
      { error: "Phone transfer is not enabled on this server." },
      503,
    );
  const path = new URL(request.url).pathname;
  let id = path.split("/")[3];
  // Initialization is internal: reject the action, including trailing path segments.
  if (path.split("/")[4] === "init") return reply({ error: "Not found." }, 404);
  if (path === "/v1/phone" && request.method === "POST") {
    if (
      !env.CREATE_LIMITER ||
      !(
        await env.CREATE_LIMITER.limit({
          key: request.headers.get("cf-connecting-ip") ?? "local",
        })
      ).success
    )
      return reply(
        { error: "Wait a minute before you connect another phone." },
        429,
      );
    id = crypto.randomUUID();
    const url = new URL(request.url);
    url.pathname = `/v1/phone/${id}/init`;
    request = new Request(url, request);
  }
  if (!/^[a-f0-9-]{36}$/.test(id ?? ""))
    return reply({ error: "Connection not found." }, 404);
  return env.PHONES.get(env.PHONES.idFromName(id)).fetch(request);
}

/** One durable coordinator per paired phone. Serializes claims, commits and quota checks. */
export class PhoneInbox {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(
    private state: State,
    private env: PhoneEnv,
  ) {}
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    // Request bodies can take more than blockConcurrencyWhile's 30-second limit
    // on mobile networks. Keep ordering without resetting a slow upload.
    const next = this.pending.then(fn);
    this.pending = next.catch(() => {});
    return next;
  }
  fetch(request: Request) {
    return this.exclusive(async () => {
      try {
        return await this.route(request);
      } catch (e) {
        return reply(
          {
            error:
              e instanceof Fault
                ? e.message
                : "Phone transfer failed. Try again.",
          },
          e instanceof Fault ? e.status : 500,
        );
      }
    });
  }
  private async route(request: Request): Promise<Response> {
    const [, , , id, action, jobId, ...rest] = new URL(
      request.url,
    ).pathname.split("/");
    const store = this.state.storage;
    let device = await store.get<Device>("device");
    if (action === "init" && request.method === "POST" && !device) {
      const b = await body(request);
      if (!validToken(b.desktop) || !validToken(b.invite))
        return fail(400, "Invalid connection.");
      device = {
        desktop: await hash(b.desktop),
        invite: await hash(b.invite),
        expires: Date.now() + 600_000,
      };
      await store.put("device", device);
      await store.put("id", id);
      await store.setAlarm(device.expires);
      return reply({ id, expires: device.expires }, 201);
    }
    if (!device || device.revoked)
      return fail(
        410,
        "This connection was removed. Connect again from your computer.",
      );
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const digest = await hash(token);
    const desktop = digest === device.desktop;
    // This capability can only read or remove one finished result. It cannot send
    // jobs, read inputs, list the inbox, or change the device connection.
    if (action === "results")
      return this.result(request, id, jobId, rest.join("/"), digest);
    if (action === "claim" && request.method === "POST") {
      if (digest !== device.invite || Date.now() > device.expires)
        return fail(401, "This connection link has expired.");
      const b = await body(request);
      if (!validToken(b.token)) return fail(400, "Invalid phone token.");
      const phone = await hash(b.token);
      if (device.phone && device.phone !== phone)
        return fail(409, "This link has already been used.");
      device.phone = phone;
      await store.put("device", device);
      return reply({ ok: true });
    }
    if (!desktop && digest !== device.phone)
      return fail(401, "Connect this phone again from your computer.");
    if (action === "revoke" && request.method === "POST") {
      device.revoked = true;
      await store.put("device", device);
      await store.setAlarm(Date.now() + 1000);
      return reply({ ok: true });
    }
    if (action !== "jobs") return fail(404, "Not found.");
    if (!jobId) {
      const jobs = [
        ...(await store.list<StoredJob>({ prefix: "job:" })).values(),
      ]
        .filter((j) => j.created + PHONE_TTL > Date.now())
        .sort((a, b) => a.created - b.created);
      if (request.method === "GET")
        return reply({
          paired: Boolean(device.phone),
          jobs: jobs.map((j) => ({
            id: j.id,
            bytes: j.bytes,
            chunks: j.chunks,
            created: j.created,
            stage: j.stage,
            resultBytes: j.resultBytes,
            resultChunks: j.resultChunks,
            resultDeleted: j.resultDeleted,
          })),
        });
      if (request.method !== "POST" || desktop)
        return fail(403, "Only the phone can send a video.");
      const b = await body(request);
      if (
        !/^[a-f0-9-]{36}$/.test(b.id) ||
        !Number.isInteger(b.bytes) ||
        b.bytes < 1 ||
        b.bytes > PHONE_MAX_BYTES
      )
        return fail(400, "Use a video of up to 1 GB.");
      const old = await store.get<StoredJob>(`job:${b.id}`);
      if (old) {
        if (old.bytes !== b.bytes) return fail(409, "Video size changed.");
        return reply(old);
      }
      if (
        jobs.length >= 20 ||
        jobs.reduce((sum, j) => sum + j.bytes, 0) + b.bytes >
          3 * PHONE_MAX_BYTES
      )
        return fail(
          429,
          "The phone queue is full. Wait for old jobs to expire.",
        );
      const job: StoredJob = {
        id: b.id,
        bytes: b.bytes,
        chunks: Math.ceil(b.bytes / PHONE_CHUNK),
        created: Date.now(),
        stage: "uploading",
        input: [],
        output: [],
      };
      await store.put(`job:${job.id}`, job);
      await store.setAlarm(Date.now() + 60_000);
      return reply(job, 201);
    }
    if (!/^[a-f0-9-]{36}$/.test(jobId)) return fail(404, "Video not found.");
    const j = await store.get<StoredJob>(`job:${jobId}`);
    if (!j || j.created + PHONE_TTL <= Date.now())
      return fail(410, "This video has expired.");
    const object = rest.join("/");
    const prefix = `phone/${id}/${jobId}/`;
    if (object === "link" && request.method === "POST" && !desktop) {
      if (j.resultDeleted) return fail(410, "This online video was deleted.");
      if (j.stage !== "done") return fail(409, "The video is not ready yet.");
      const b = await body(request);
      if (!validToken(b.token)) return fail(400, "Invalid result link.");
      const access = await hash(b.token);
      if (j.resultAccess && j.resultAccess !== access)
        return fail(409, "A private link already exists for this video.");
      j.resultAccess = access;
    } else if (object === "commit" && request.method === "POST" && !desktop) {
      if (j.stage !== "uploading") return reply({ ok: true });
      if (!j.manifest || j.input.length !== j.chunks)
        return fail(409, "The upload is not complete.");
      j.stage = "waiting";
    } else if (object === "status" && request.method === "POST" && desktop) {
      const b = await body(request);
      const next: Record<string, string[]> = {
        waiting: ["receiving", "error"],
        receiving: ["editing", "error"],
        editing: ["rendering", "error"],
        rendering: ["returning", "error"],
        returning: ["done", "error"],
        done: [],
        error: [],
      };
      if (b.stage !== j.stage && !next[j.stage]?.includes(b.stage))
        return fail(409, "Invalid job state.");
      if (b.stage === "returning") {
        if (
          !Number.isInteger(b.bytes) ||
          b.bytes < 1 ||
          b.bytes > PHONE_MAX_BYTES
        )
          return fail(400, "The result must be at most 1 GB.");
        if (j.resultBytes && j.resultBytes !== b.bytes)
          return fail(409, "The result size changed.");
        j.resultBytes = b.bytes;
        j.resultChunks = Math.ceil(b.bytes / PHONE_CHUNK);
      }
      if (
        b.stage === "done" &&
        (!j.resultManifest || j.output.length !== j.resultChunks)
      )
        return fail(409, "The result upload is not complete.");
      j.stage = b.stage;
      // Receipt is acknowledged only after the complete input is saved to disk.
      if (b.stage === "editing")
        await this.env.BUCKET.delete(
          [...Array(j.chunks)]
            .map((_, n) => `${prefix}input/${n}`)
            .concat(`${prefix}input/manifest`),
        );
    } else {
      const m = /^(input|result)\/(manifest|0|[1-9]\d{0,2})$/.exec(object);
      if (!m) return fail(404, "Not found.");
      const result = m[1] === "result",
        manifest = m[2] === "manifest";
      if (result && j.resultDeleted)
        return fail(410, "This online video was deleted.");
      const count = result ? (j.resultChunks ?? 0) : j.chunks;
      if (!manifest && Number(m[2]) >= count)
        return fail(400, "Invalid video part.");
      if (request.method === "GET") {
        if (
          result
            ? desktop || j.stage !== "done"
            : !desktop || !["waiting", "receiving"].includes(j.stage)
        )
          return fail(403, "This video is not available.");
        const found = await this.env.BUCKET.get(prefix + object);
        if (!found) return fail(404, "Video part not found.");
        return new Response(found.body, {
          headers: {
            "content-type": "application/octet-stream",
            "cache-control": "no-store",
          },
        });
      }
      if (
        request.method !== "PUT" ||
        (result
          ? !desktop || j.stage !== "returning"
          : desktop || j.stage !== "uploading")
      )
        return fail(403, "Upload is closed.");
      const bytes = result ? j.resultBytes! : j.bytes;
      const expected = manifest
        ? 16_384
        : Math.min(PHONE_CHUNK, bytes - Number(m[2]) * PHONE_CHUNK) + 28;
      const data = await bounded(request, expected);
      if (data.byteLength < 28 || (!manifest && data.byteLength !== expected))
        return fail(400, "Video part has the wrong size.");
      await this.env.BUCKET.put(prefix + object, data);
      if (manifest) {
        if (result) j.resultManifest = true;
        else j.manifest = true;
      } else {
        const parts = result ? j.output : j.input;
        if (!parts.includes(Number(m[2]))) parts.push(Number(m[2]));
      }
    }
    await store.put(`job:${jobId}`, j);
    return reply({ ok: true });
  }
  private async result(
    request: Request,
    id: string,
    jobId: string,
    object: string,
    digest: string,
  ) {
    if (!/^[a-f0-9-]{36}$/.test(jobId ?? ""))
      return fail(404, "Video not found.");
    const j = await this.state.storage.get<StoredJob>(`job:${jobId}`);
    if (!j || j.created + PHONE_TTL <= Date.now())
      return fail(410, "This video has expired.");
    if (!j.resultAccess || digest !== j.resultAccess)
      return fail(401, "This private video link is invalid.");
    const prefix = `phone/${id}/${jobId}/result/`;
    if (object === "delete" && request.method === "POST") {
      // Save the tombstone first. A failed R2 deletion cannot restore access.
      j.resultDeleted = true;
      await this.state.storage.put(`job:${jobId}`, j);
      await this.env.BUCKET.delete(
        [...Array(j.resultChunks ?? 0)]
          .map((_, n) => `${prefix}${n}`)
          .concat(`${prefix}manifest`),
      );
      return reply({ ok: true });
    }
    if (j.resultDeleted)
      return fail(
        410,
        "This online video was deleted. The computer copy is unchanged.",
      );
    if (j.stage !== "done") return fail(409, "The video is not ready yet.");
    if (request.method !== "GET") return fail(405, "Method not allowed.");
    if (!object)
      return reply({
        bytes: j.resultBytes,
        chunks: j.resultChunks,
        expires: j.created + PHONE_TTL,
      });
    const match = /^result\/(manifest|0|[1-9]\d{0,2})$/.exec(object);
    if (
      !match ||
      (match[1] !== "manifest" && Number(match[1]) >= (j.resultChunks ?? 0))
    )
      return fail(404, "Video part not found.");
    const found = await this.env.BUCKET.get(prefix + match[1]);
    if (!found) return fail(404, "Video part not found.");
    return new Response(found.body, {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  }
  alarm() {
    return this.exclusive(() => this.cleanup());
  }
  private async cleanup() {
    const store = this.state.storage,
      id = await store.get<string>("id"),
      device = await store.get<Device>("device");
    const jobs = await store.list<StoredJob>({ prefix: "job:" });
    for (const [key, j] of jobs) {
      if (!device?.revoked && j.created + PHONE_TTL > Date.now()) continue;
      const keys = [
        `phone/${id}/${j.id}/input/manifest`,
        `phone/${id}/${j.id}/result/manifest`,
      ];
      for (let n = 0; n < j.chunks; n++)
        keys.push(`phone/${id}/${j.id}/input/${n}`);
      for (let n = 0; n < (j.resultChunks ?? 0); n++)
        keys.push(`phone/${id}/${j.id}/result/${n}`);
      await this.env.BUCKET.delete(keys);
      await store.delete(key);
    }
    if (device && !device.phone && Date.now() > device.expires) {
      device.revoked = true;
      await store.put("device", device);
    }
    if (!device?.revoked && jobs.size)
      await store.setAlarm(Date.now() + 60_000);
  }
}
