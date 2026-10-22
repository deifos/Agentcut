// Music beds with Google Lyria (Gemini API), using the user's saved Gemini key.
// Same rules as voice.ts: the helper adds the key; Claude never sees it.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { debugLog } from "../log.js";
import { atomicWrite, projectDir, safeJoin, uniquePath } from "./projects.js";
import { keyFor, readError, slugName, wavSeconds } from "./voice.js";
import type { WorkspacePaths } from "./workspace.js";

const LYRIA_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const MUSIC_MODELS = [
  { id: "lyria-3.5", label: "Lyria 3.5 (full songs, length from the prompt)" },
  { id: "lyria-3-clip-preview", label: "Lyria 3 Clip (always 30 s, MP3)" },
] as const;

export interface GenerateMusicInput {
  prompt: string;
  name?: string;
  takes?: number;
  model?: string;
}

export function musicOptions() {
  const lyria = Boolean(keyFor("gemini"));
  return {
    lyria: {
      available: lyria,
      models: MUSIC_MODELS.map((m) => `${m.id}: ${m.label}`),
    },
    note: lyria
      ? "Lyria is available (the user's Gemini key). Use agentcut_generate_music for new songs."
      : "Lyria isn't set up (no Gemini key under Voices). If the user asks for a made song, compose it in code (see references/sound.md) or ask them to add a Gemini key for Lyria.",
  };
}

/** Find the audio block in an interactions response: steps[type=model_output].content[type=audio].data. */
function findAudio(value: unknown): { data: string; mime?: string } | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudio(item);
      if (found) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.data === "string" && record.data.length > 10_000) {
    const mime = record.mime_type ?? record.mimeType;
    return { data: record.data, mime: typeof mime === "string" ? mime : undefined };
  }
  for (const child of Object.values(record)) {
    const found = findAudio(child);
    if (found) return found;
  }
  return null;
}

/** The song description Lyria sends back next to the audio (structure / lyrics), if any. */
function findText(value: unknown): string | null {
  const steps = (value as { steps?: { type?: string; content?: { type?: string; text?: string }[] }[] })?.steps;
  if (!Array.isArray(steps)) return null;
  const texts = steps
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string);
  return texts.length ? texts.join("\n").slice(0, 2000) : null;
}

async function lyria(key: string, model: string, prompt: string, signal: AbortSignal) {
  const body: Record<string, unknown> = { model, input: prompt };
  if (model === "lyria-3.5") body.response_format = { type: "audio" };
  const response = await fetch(LYRIA_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`Lyria: ${await readError(response)}`);
  const json = (await response.json()) as unknown;
  const audio = findAudio(json);
  if (!audio) throw new Error("Lyria returned no audio (the prompt may have been blocked; rephrase it without artist or song names).");
  const data = Buffer.from(audio.data, "base64");
  const ext = data.subarray(0, 4).toString("ascii") === "RIFF" ? "wav" : "mp3";
  return { data, ext, description: findText(json) };
}

/** Generate 1–3 takes into the project's assets/music/ (never overwrites). */
export async function generateMusic(paths: WorkspacePaths, slug: string, input: GenerateMusicInput) {
  const prompt = String(input.prompt ?? "").trim();
  if (!prompt) throw new Error("prompt is required: describe the music (style, BPM, instruments, sections with timestamps).");
  if (prompt.length > 8000) throw new Error("Keep the prompt under 8,000 characters.");
  const key = keyFor("gemini");
  if (!key) {
    throw new Error(
      "Lyria needs a Gemini key and none is set up. Ask the user to add one under Voices in the studio header, or compose the music in code (references/sound.md).",
    );
  }
  const model = MUSIC_MODELS.some((m) => m.id === input.model) ? (input.model as string) : "lyria-3.5";
  const takes = Math.max(1, Math.min(3, Math.round(input.takes ?? 1)));
  const base = slugName(input.name || prompt.split(/\s+/).slice(0, 4).join(" ")) || "music";
  mkdirSync(join(projectDir(paths, slug), "assets", "music"), { recursive: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9 * 60_000);
  try {
    const results = await Promise.all(
      Array.from({ length: takes }, async (_, index) => {
        try {
          const audio = await lyria(key, model, prompt, controller.signal);
          const target = uniquePath(
            safeJoin(projectDir(paths, slug), `assets/music/${base}${takes > 1 ? `-take${index + 1}` : ""}.${audio.ext}`),
          );
          atomicWrite(target, audio.data);
          const rel = `assets/music/${target.split(/[\\/]/).pop()}`;
          debugLog(`music: ${slug} ${rel} (${audio.data.length} bytes)`);
          return {
            path: rel,
            bytes: audio.data.length,
            seconds: audio.ext === "wav" ? wavSeconds(audio.data) : null,
            ...(audio.description ? { description: audio.description } : {}),
          };
        } catch (error) {
          const message = controller.signal.aborted ? "Lyria took too long (over 9 minutes)." : error instanceof Error ? error.message : String(error);
          return { error: message };
        }
      }),
    );
    if (results.every((r) => "error" in r)) throw new Error((results[0] as { error: string }).error);
    return {
      model,
      takes: results,
      next: "Check each take: agentcut_media_info (length), agentcut_analyze_audio (tempo, beats, drop), agentcut_listen_tags (no vocals if you asked for none). Put the best on the Music track and time the cuts to its beats.",
    };
  } finally {
    clearTimeout(timer);
  }
}
