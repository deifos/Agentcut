import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  chmodSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { open, stat } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";
import { phoneEditPrompt, type PhoneEditing } from "./phone-editing.js";
import { atomicWrite } from "./projects.js";
import { debugLog } from "../log.js";
import {
  PHONE_CHUNK,
  PHONE_MAX_BYTES,
  PHONE_TTL,
  phoneSecret,
  openPhone,
  sealPhone,
  validatePhoneManifest,
  type PhoneJob,
  type PhoneManifest,
} from "./phone-protocol.js";

interface Connection {
  id: string;
  token: string;
  secret: string;
  api: string;
  invite: string;
  expires: number;
  paired?: boolean;
}
interface LocalJob {
  id: string;
  connection: string;
  stage:
    | "received"
    | "editing"
    | "edited"
    | "rendering"
    | "rendered"
    | "done"
    | "error";
  slug: string;
  file: string;
  manifest: PhoneManifest;
  result?: string;
  error?: string;
}
class PhonePayloadError extends Error {}
export interface PhoneDeps {
  internal: string;
  available(): boolean;
  import(manifest: PhoneManifest): { slug: string; file: string };
  edit(slug: string, prompt: string, signal: AbortSignal): Promise<void>;
  render(slug: string, editing?: PhoneEditing): Promise<string>;
  cancel(slug: string): void;
}

export class PhoneTransfers {
  private connection: Connection | null = null;
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopped = false;
  private current: LocalJob | null = null;
  private editAbort: AbortController | null = null;
  private readonly file: string;
  private readonly jobsDir: string;
  constructor(private deps: PhoneDeps) {
    this.file = join(deps.internal, "phone-connection.json");
    this.jobsDir = join(deps.internal, "phone-jobs");
    mkdirSync(this.jobsDir, { recursive: true });
    if (existsSync(this.file)) {
      try {
        this.connection = JSON.parse(readFileSync(this.file, "utf8"));
      } catch {
        debugLog(
          "phone: saved connection is invalid; connect the phone again.",
        );
      }
    }
    for (const name of readdirSync(this.jobsDir)) {
      if (!/^[a-f0-9-]{36}\.video$/.test(name)) continue;
      const file = join(this.jobsDir, name);
      try {
        if (Date.now() - statSync(file).mtimeMs > PHONE_TTL) unlinkSync(file);
      } catch {}
    }
  }
  start() {
    this.stopped = false;
    this.timer = setInterval(() => void this.tick(), 5000);
    this.timer.unref();
    void this.tick();
  }
  stop() {
    this.stopped = true;
    clearInterval(this.timer);
    this.editAbort?.abort();
    if (this.current) this.deps.cancel(this.current.slug);
  }
  private saveConnection() {
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(this.connection), { mode: 0o600 });
    chmodSync(temp, 0o600);
    renameSync(temp, this.file);
  }
  private save(job: LocalJob) {
    atomicWrite(join(this.jobsDir, `${job.id}.json`), JSON.stringify(job));
  }
  async connect(api: string) {
    const url = new URL(api);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        ))
    )
      throw new Error("Use an HTTPS transfer service.");
    if (this.connection)
      throw new Error("Remove the current phone connection first.");
    const token = phoneSecret(),
      invite = phoneSecret(),
      secret = phoneSecret();
    const response = await fetch(`${api.replace(/\/+$/, "")}/v1/phone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ desktop: token, invite }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await response.json()) as {
      id: string;
      expires: number;
      error?: string;
    };
    if (!response.ok)
      throw new Error(data.error ?? "Could not create a phone connection.");
    if (!/^[a-f0-9-]{36}$/.test(data.id))
      throw new Error("Invalid transfer service response.");
    this.connection = {
      id: data.id,
      expires: data.expires,
      token,
      invite,
      secret,
      api: api.replace(/\/+$/, ""),
    };
    this.saveConnection();
    return this.status();
  }
  status() {
    const c = this.connection;
    return c
      ? {
          connected: true,
          paired: Boolean(c.paired),
          name: hostname(),
          expires: c.expires,
          pairing: c.paired
            ? null
            : { id: c.id, invite: c.invite, secret: c.secret },
        }
      : { connected: false };
  }
  isUsing(slug: string) {
    return this.current?.slug === slug;
  }
  async disconnect() {
    const c = this.connection;
    if (!c) return { ok: true };
    await this.request(c, "revoke", { method: "POST" });
    this.editAbort?.abort();
    if (this.current) this.deps.cancel(this.current.slug);
    this.connection = null;
    this.saveConnection();
    return { ok: true };
  }
  private async request(c: Connection, path: string, init: RequestInit = {}) {
    const response = await fetch(`${c.api}/v1/phone/${c.id}/${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${c.token}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      if (
        response.status === 410 &&
        path === "jobs" &&
        this.connection?.id === c.id
      ) {
        this.connection = null;
        this.saveConnection();
      }
      throw new Error(
        `Phone service: ${response.status}. ${(await response.text()).slice(0, 250)}`,
      );
    }
    return response;
  }
  private stage(
    c: Connection,
    j: PhoneJob,
    stage: PhoneJob["stage"],
    bytes?: number,
  ) {
    return this.request(c, `jobs/${j.id}/status`, {
      method: "POST",
      body: JSON.stringify({ stage, bytes }),
    });
  }
  private active(c: Connection) {
    if (this.stopped || this.connection?.id !== c.id)
      throw new Error("Phone connection stopped.");
  }
  async tick() {
    if (this.busy || this.stopped || !this.connection) return;
    this.busy = true;
    const c = this.connection;
    let job: PhoneJob | undefined;
    try {
      const data = (await (await this.request(c, "jobs")).json()) as {
        paired: boolean;
        jobs: PhoneJob[];
      };
      if (data.paired && !c.paired) {
        c.paired = true;
        this.saveConnection();
      }
      if (!this.deps.available()) return;
      job = data.jobs.find(
        (j) => !["uploading", "done", "error"].includes(j.stage),
      );
      if (job) await this.process(c, job);
    } catch (error) {
      if (job && error instanceof PhonePayloadError) {
        try {
          await this.stage(c, job, "error");
        } catch {}
      }
      debugLog(
        `phone: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.busy = false;
      this.current = null;
    }
  }
  private async process(c: Connection, j: PhoneJob) {
    this.active(c);
    const journal = join(this.jobsDir, `${j.id}.json`);
    let local: LocalJob | undefined = existsSync(journal)
      ? JSON.parse(readFileSync(journal, "utf8"))
      : undefined;
    if (local && local.connection !== c.id)
      throw new Error("Phone job belongs to another connection.");
    if (!local) {
      if (!["waiting", "receiving"].includes(j.stage)) {
        await this.stage(c, j, "error");
        return;
      }
      await this.stage(c, j, "receiving");
      const manifestBytes = await (
        await this.request(c, `jobs/${j.id}/input/manifest`)
      ).arrayBuffer();
      let manifest: PhoneManifest;
      try {
        manifest = validatePhoneManifest(
          JSON.parse(
            new TextDecoder().decode(
              await openPhone(c.secret, j.id, "input/manifest", manifestBytes),
            ),
          ),
          j.bytes,
        );
      } catch {
        throw new PhonePayloadError(
          "The phone video details are damaged or invalid.",
        );
      }
      const temp = join(this.jobsDir, `${j.id}.video`);
      const output = await open(temp, "w");
      try {
        for (let n = 0; n < j.chunks; n++) {
          this.active(c);
          const encrypted = await (
            await this.request(c, `jobs/${j.id}/input/${n}`)
          ).arrayBuffer();
          let data: Uint8Array<ArrayBuffer>;
          try {
            data = await openPhone(c.secret, j.id, `input/${n}`, encrypted);
          } catch {
            throw new PhonePayloadError(
              "The phone video is damaged. Send it again.",
            );
          }
          if (data.length !== Math.min(PHONE_CHUNK, j.bytes - n * PHONE_CHUNK))
            throw new PhonePayloadError("The video part has the wrong size.");
          await output.writeFile(data);
        }
        await output.sync();
      } finally {
        await output.close();
      }
      this.active(c);
      const imported = this.deps.import(manifest);
      renameSync(temp, imported.file);
      local = {
        id: j.id,
        connection: c.id,
        stage: "received",
        ...imported,
        manifest,
      };
      this.save(local);
    }
    this.current = local;
    // A restart must never repeat an agent turn or claim an interrupted render succeeded.
    if (["editing", "rendering"].includes(local.stage)) {
      local.stage = "error";
      local.error =
        "The helper stopped during this job. Open the saved project to continue.";
      this.save(local);
    }
    if (local.stage === "error") {
      await this.stage(c, j, "error");
      return;
    }
    if (local.stage === "received") {
      if (!this.deps.available()) return;
      await this.stage(c, j, "editing");
      this.active(c);
      local.stage = "editing";
      this.save(local);
      try {
        this.editAbort = new AbortController();
        await this.deps.edit(
          local.slug,
          phoneEditPrompt(local.manifest.prompt, local.manifest.editing),
          this.editAbort.signal,
        );
        this.active(c);
        local.stage = "edited";
        this.save(local);
      } catch (error) {
        local.stage = "error";
        local.error = String(error);
        this.save(local);
        await this.stage(c, j, "error");
        return;
      } finally {
        this.editAbort = null;
      }
    }
    if (local.stage === "edited") {
      await this.stage(c, j, "rendering");
      this.active(c);
      local.stage = "rendering";
      this.save(local);
      try {
        local.result = await this.deps.render(local.slug, local.manifest.editing);
        this.active(c);
        local.stage = "rendered";
        this.save(local);
      } catch (error) {
        local.stage = "error";
        local.error = String(error);
        this.save(local);
        await this.stage(c, j, "error");
        return;
      }
    }
    if (local.stage === "rendered" && local.result) {
      const bytes = (await stat(local.result)).size;
      if (bytes > PHONE_MAX_BYTES) {
        local.stage = "error";
        local.error =
          "The result exceeds the 1 GB transfer limit. It is saved on this computer.";
        this.save(local);
        await this.stage(c, j, "error");
        return;
      }
      await this.stage(c, j, "returning", bytes);
      const input = await open(local.result, "r");
      try {
        for (let n = 0; n < Math.ceil(bytes / PHONE_CHUNK); n++) {
          this.active(c);
          const part = new Uint8Array(
            Math.min(PHONE_CHUNK, bytes - n * PHONE_CHUNK),
          );
          const read = await input.read(part, 0, part.length, n * PHONE_CHUNK);
          if (read.bytesRead !== part.length)
            throw new Error("Could not read the finished video.");
          await this.request(c, `jobs/${j.id}/result/${n}`, {
            method: "PUT",
            body: await sealPhone(c.secret, j.id, `result/${n}`, part),
          });
        }
      } finally {
        await input.close();
      }
      const manifest = new TextEncoder().encode(
        JSON.stringify({ name: `${local.slug}.mp4`, bytes }),
      );
      await this.request(c, `jobs/${j.id}/result/manifest`, {
        method: "PUT",
        body: await sealPhone(c.secret, j.id, "result/manifest", manifest),
      });
      await this.stage(c, j, "done");
      local.stage = "done";
      this.save(local);
    }
  }
}
