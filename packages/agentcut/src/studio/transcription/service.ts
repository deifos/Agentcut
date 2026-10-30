import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, rmdir, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { providerStore } from "../providers/settings.js";
import { projectDir, readProjectState, safeJoin } from "../projects.js";
import { ensureFfmpeg } from "../references.js";
import type { WorkspacePaths } from "../workspace.js";
import { TRANSCRIPTION_ADAPTERS } from "./registry.js";
import type { Transcript, TranscriptionInput } from "./types.js";

const store = providerStore(
  () =>
    process.env.AGENTCUT_TRANSCRIPTION_KEYS ||
    join(homedir(), ".agentcut", "transcription-keys.json"),
  () => Object.values(TRANSCRIPTION_ADAPTERS).map((a) => a.metadata),
  "local",
);
export function transcriptionSettings() {
  return {
    defaultProvider: store.preferred() ?? "local",
    providers: Object.values(TRANSCRIPTION_ADAPTERS).map((a) => ({
      ...a.metadata,
      ...(a.metadata.cloud
        ? store.status(a.metadata.id)
        : { configured: true, source: null }),
    })),
  };
}
export function saveTranscriptionKey(id: string, key: unknown) {
  if (!TRANSCRIPTION_ADAPTERS[id]?.metadata.cloud)
    throw new Error("Choose a cloud transcription provider.");
  store.save(id, key);
  return transcriptionSettings();
}
export function removeTranscriptionKey(id: string) {
  store.remove(id);
  return transcriptionSettings();
}
export function preferTranscription(id: string) {
  const adapter = TRANSCRIPTION_ADAPTERS[id];
  if (!adapter || (adapter.metadata.cloud && !store.key(id)))
    throw new Error("Configure this provider before selecting it.");
  store.select(id);
  return transcriptionSettings();
}

interface Job {
  id: string;
  project: string;
  provider: string;
  stage: string;
  controller: AbortController;
  active: boolean;
}
export class TranscriptionService {
  private jobs = new Map<string, Job>();
  private cache = new Map<string, Transcript>();
  constructor(
    private paths: WorkspacePaths,
    private page: (method: string, params: unknown) => Promise<unknown>,
    private emit: (event: unknown) => void,
  ) {}
  status() {
    return [...this.jobs.values()].map(
      ({ id, project, provider, stage, active }) => ({
        id,
        project,
        provider,
        stage,
        active,
      }),
    );
  }
  cancel(id: string) {
    const job = this.jobs.get(id);
    if (!job?.active) return { cancelled: false };
    job.controller.abort();
    if (job.provider === "local")
      void this.page("studio_cancel_local_transcription", { job: id }).catch(
        () => undefined,
      );
    return {
      cancelled: true,
      note: "Cloud processing may already have incurred charges.",
    };
  }
  close() {
    for (const job of this.jobs.values()) if (job.active) this.cancel(job.id);
  }
  async run(slug: string, input: TranscriptionInput) {
    const provider = input.provider ?? store.preferred() ?? "local";
    const adapter = TRANSCRIPTION_ADAPTERS[provider];
    if (!adapter)
      throw new Error(
        "Unknown transcription provider. Use agentcut_transcription_options.",
      );
    const key = adapter.metadata.cloud ? store.key(provider) : null;
    if (adapter.metadata.cloud && !key)
      throw new Error(
        `Configure ${adapter.metadata.name} in Transcription settings. No fallback was used.`,
      );
    if (!input.path || !/^(assets\/|library:)/.test(input.path))
      throw new Error(
        "Use a project assets/ path or library: path. Remote URLs are not accepted.",
      );
    const source = input.path.startsWith("library:")
      ? safeJoin(this.paths.library, input.path.slice(8))
      : safeJoin(projectDir(this.paths, slug), input.path);
    const info = await stat(source);
    if (!info.isFile() || info.size > 2 * 1024 ** 3)
      throw new Error("Use a media file smaller than 2 GB.");
    const state = readProjectState(this.paths, slug);
    if (!state.project)
      throw new Error("Open a valid project before transcription.");
    const fps = state.project.fps;
    const id = input.job ?? randomUUID();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || this.jobs.has(id))
      throw new Error("Use a new job ID, or omit job to create one.");
    const job: Job = {
      id,
      project: slug,
      provider,
      stage: "reading_source",
      controller: new AbortController(),
      active: true,
    };
    this.jobs.set(id, job);
    while (this.jobs.size > 32) {
      const old = [...this.jobs.values()].find((j) => !j.active);
      if (!old) break;
      this.jobs.delete(old.id);
    }
    const progress = (stage: string) => {
      job.stage = stage;
      if (["completed", "cancelled", "error"].includes(stage)) job.active = false;
      this.emit({ job: id, project: slug, provider, stage });
    };
    const timeout = setTimeout(() => this.cancel(id), 20 * 60_000);
    let temp: string | undefined;
    try {
      progress("reading_source");
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(source, {
        signal: job.controller.signal,
      }))
        hash.update(chunk);
      const options = {
        language: input.language ?? "en",
        model: input.model ?? adapter.metadata.defaultModel,
        speakerLabels: input.speakerLabels ?? false,
        editingTranscript: true,
      };
      const cacheKey = createHash("sha256")
        .update(
          JSON.stringify([
            slug,
            input.path,
            hash.digest("hex"),
            fps,
            provider,
            options,
          ]),
        )
        .digest("hex");
      const cached = this.cache.get(cacheKey);
      if (cached) {
        progress("completed");
        return { ...cached, job: id, cached: true };
      }
      const result = await adapter.run(input, {
        fps,
        key,
        signal: job.controller.signal,
        progress,
        local: async (options) =>
          this.page("studio_transcribe", {
            project: slug,
            path: input.path,
            ...options,
            job: id,
          }) as Promise<Record<string, unknown>>,
        audio: async () => {
          const ffmpeg = await ensureFfmpeg();
          job.controller.signal.throwIfAborted();
          temp = await mkdtemp(join(tmpdir(), "agentcut-transcript-"));
          const target = join(temp, "audio.wav");
          await new Promise<void>((resolve, reject) => {
            const child = spawn(
              ffmpeg,
              [
                "-nostdin",
                "-v",
                "error",
                "-i",
                source,
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                target,
              ],
              {
                windowsHide: true,
                stdio: "ignore",
                signal: job.controller.signal,
              },
            );
            child.once("error", () =>
              reject(new Error("Audio extraction stopped or could not start.")),
            );
            child.once("close", (code) =>
              code === 0
                ? resolve()
                : reject(
                    new Error(
                      "Could not extract audio. Check that the source has an audio track.",
                    ),
                  ),
            );
          });
          if ((await stat(target)).size > 1024 ** 3)
            throw new Error(
              "Extracted audio exceeds the 1 GB upload limit. Split the source first.",
            );
          return target;
        },
      });
      job.controller.signal.throwIfAborted();
      const transcript: Transcript = {
        ...result,
        provider,
        provenance: {
          provider,
          model: result.model,
          options,
          source: input.path,
          createdAt: new Date().toISOString(),
          cacheKey,
        },
      };
      this.cache.set(cacheKey, transcript);
      if (this.cache.size > 16)
        this.cache.delete(this.cache.keys().next().value!);
      progress("completed");
      return { ...transcript, job: id, cached: false };
    } catch (error) {
      progress(job.controller.signal.aborted ? "cancelled" : "error");
      if (job.controller.signal.aborted)
        throw new Error(
          "Transcription was cancelled or timed out. No fallback was used; cloud charges may already apply.",
        );
      // Never echo a provider credential, even if a remote error includes it.
      const message =
        error instanceof Error ? error.message : "Transcription failed.";
      throw new Error(key ? message.split(key).join("[redacted]") : message);
    } finally {
      clearTimeout(timeout);
      job.active = false;
      if (temp)
        await rm(join(temp, "audio.wav"), { force: true }).catch(
          () => undefined,
        );
      if (temp) await rmdir(temp).catch(() => undefined);
    }
  }
}
