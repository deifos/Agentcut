// Voice-over generation for Agentcut, with the user's own API keys.
//
// Keys live in a file in the user's home folder (outside the workspace, so Claude's file
// tools never see them), are never sent to the page after saving, never put in Claude's
// environment, and never written to logs. The helper adds the key when it calls the provider.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { debugLog } from "../log.js";
import { atomicWrite, projectDir, safeJoin, uniquePath } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

export type VoiceProviderId = "elevenlabs" | "gemini" | "openai" | "xai";

export interface VoiceInfo {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
}

interface ProviderSpec {
  id: VoiceProviderId;
  name: string;
  keyUrl: string;
  keyHint: string;
  envVar: string;
  defaultModel: string;
  models: { id: string; label: string }[];
  defaultVoice: string;
  /** How style directions are given. */
  styleNote: string;
}

export const VOICE_PROVIDERS: ProviderSpec[] = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    keyUrl: "https://elevenlabs.io/app/settings/api-keys",
    keyHint: "Profile → API keys. Needs the Text to Speech and Voices (read) permissions.",
    envVar: "ELEVENLABS_API_KEY",
    defaultModel: "eleven_multilingual_v2",
    models: [
      { id: "eleven_v4", label: "Eleven v4 (most expressive)" },
      { id: "eleven_v3", label: "Eleven v3 (expressive, audio tags)" },
      { id: "eleven_multilingual_v2", label: "Multilingual v2 (most stable)" },
      { id: "eleven_flash_v2_5", label: "Flash v2.5 (fastest, cheapest)" },
    ],
    defaultVoice: "",
    styleNote: "No style field: put audio tags like [excited] or [whispers] in the text (v3/v4 models).",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "Google AI Studio → Get API key.",
    envVar: "GEMINI_API_KEY",
    defaultModel: "gemini-3.8-flash-tts",
    models: [
      { id: "gemini-3.8-flash-tts", label: "Gemini 3.8 Flash TTS" },
      { id: "gemini-3.8-flash-lite-tts", label: "Gemini 3.8 Flash-Lite TTS (cheaper)" },
      { id: "gemini-2.5-pro-preview-tts", label: "Gemini 2.5 Pro TTS (preview)" },
    ],
    defaultVoice: "Puck",
    styleNote: "Short style/pace notes are sent as director's notes above the transcript.",
  },
  {
    id: "openai",
    name: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "platform.openai.com → API keys.",
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini-tts",
    models: [
      { id: "gpt-4o-mini-tts", label: "gpt-4o-mini-tts (follows style instructions)" },
      { id: "tts-1-hd", label: "tts-1-hd" },
      { id: "tts-1", label: "tts-1 (fast)" },
    ],
    defaultVoice: "marin",
    styleNote: "Style goes in `instructions` (gpt-4o-mini-tts only).",
  },
  {
    id: "xai",
    name: "Grok (xAI)",
    keyUrl: "https://console.x.ai/",
    keyHint: "console.x.ai → API keys.",
    envVar: "XAI_API_KEY",
    defaultModel: "default",
    models: [{ id: "default", label: "Grok TTS" }],
    defaultVoice: "eve",
    styleNote: "No style field: use inline tags like [pause] [laugh] or <whisper>…</whisper>, and `speed`.",
  },
];

const STATIC_VOICES: Record<Exclude<VoiceProviderId, "elevenlabs">, VoiceInfo[]> = {
  gemini: [
    ["Zephyr", "Bright"], ["Puck", "Upbeat"], ["Charon", "Informative"], ["Kore", "Firm"], ["Fenrir", "Excitable"],
    ["Leda", "Youthful"], ["Orus", "Firm"], ["Aoede", "Breezy"], ["Callirrhoe", "Easy-going"], ["Autonoe", "Bright"],
    ["Enceladus", "Breathy"], ["Iapetus", "Clear"], ["Umbriel", "Easy-going"], ["Algieba", "Smooth"], ["Despina", "Smooth"],
    ["Erinome", "Clear"], ["Algenib", "Gravelly"], ["Rasalgethi", "Informative"], ["Laomedeia", "Upbeat"], ["Achernar", "Soft"],
    ["Alnilam", "Firm"], ["Schedar", "Even"], ["Gacrux", "Mature"], ["Pulcherrima", "Forward"], ["Achird", "Friendly"],
    ["Zubenelgenubi", "Casual"], ["Vindemiatrix", "Gentle"], ["Sadachbia", "Lively"], ["Sadaltager", "Knowledgeable"], ["Sulafat", "Warm"],
  ].map(([id, description]) => ({ id, name: id, description })),
  openai: ["marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"].map((id) => ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    description: id === "marin" || id === "cedar" ? "Best quality" : undefined,
  })),
  xai: [
    "eve", "ara", "leo", "rex", "sal", "carina", "zagan", "helix", "orion", "luna", "iris", "altair", "zenith", "perseus",
    "helios", "lux", "kepler", "rigel", "cosmo", "celeste", "ursa", "sirius", "lumen", "castor", "naksh", "atlas", "aurora", "liora",
  ].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), description: id === "eve" ? "Default" : undefined })),
};

// ---------------------------------------------------------------------------
// Key store

interface KeyFile {
  version: 1;
  defaultProvider: VoiceProviderId | null;
  keys: Partial<Record<VoiceProviderId, { key: string; savedAt: number }>>;
}

export function keyStorePath() {
  // Not in the workspace: Claude reads and writes files there.
  return process.env.AGENTCUT_KEYS || join(homedir(), ".agentcut", "studio-keys.json");
}

function readKeys(): KeyFile {
  try {
    const raw = JSON.parse(readFileSync(keyStorePath(), "utf8")) as KeyFile;
    if (raw && typeof raw.keys === "object") return { version: 1, defaultProvider: raw.defaultProvider ?? null, keys: raw.keys };
  } catch {}
  return { version: 1, defaultProvider: null, keys: {} };
}

function writeKeys(file: KeyFile) {
  const path = keyStorePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {}
}

function spec(id: unknown): ProviderSpec {
  const found = VOICE_PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown voice provider "${String(id)}". Use one of: ${VOICE_PROVIDERS.map((p) => p.id).join(", ")}.`);
  return found;
}

/** The key for a provider: saved in the studio settings, or the provider's env var. */
export function keyFor(id: VoiceProviderId): string | null {
  const saved = readKeys().keys[id]?.key;
  if (saved) return saved;
  const fromEnv = process.env[spec(id).envVar];
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : null;
}

/** Env vars that hold provider keys: removed from Claude's environment. */
export const VOICE_KEY_ENV_VARS = VOICE_PROVIDERS.map((p) => p.envVar);

export function voiceSettings() {
  const file = readKeys();
  const providers = VOICE_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    keyUrl: p.keyUrl,
    keyHint: p.keyHint,
    configured: Boolean(keyFor(p.id)),
    source: file.keys[p.id] ? "saved" : keyFor(p.id) ? "environment" : null,
    models: p.models,
    defaultModel: p.defaultModel,
    defaultVoice: p.defaultVoice,
    styleNote: p.styleNote,
  }));
  const configured = providers.filter((p) => p.configured).map((p) => p.id);
  const defaultProvider =
    file.defaultProvider && configured.includes(file.defaultProvider) ? file.defaultProvider : (configured[0] ?? null);
  return { providers, defaultProvider };
}

// ---------------------------------------------------------------------------
// Provider calls

export async function readError(response: Response) {
  const body = await response.text().catch(() => "");
  let message = body.slice(0, 400);
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    const err = (json.error ?? json.detail ?? json) as Record<string, unknown> | string;
    message = typeof err === "string" ? err : String(err.message ?? err.status ?? JSON.stringify(err)).slice(0, 400);
  } catch {}
  return `${response.status} ${response.statusText}${message ? `: ${message}` : ""}`;
}

async function elevenVoices(key: string): Promise<VoiceInfo[]> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!response.ok) throw new Error(`ElevenLabs: ${await readError(response)}`);
  const json = (await response.json()) as { voices?: { voice_id: string; name: string; labels?: Record<string, string>; preview_url?: string; category?: string }[] };
  return (json.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    description: [v.labels?.accent, v.labels?.gender, v.labels?.description ?? v.labels?.descriptive, v.labels?.use_case ?? v.labels?.use_cases]
      .filter(Boolean)
      .join(", ") || v.category,
    previewUrl: v.preview_url,
  }));
}

export async function listVoices(provider: VoiceProviderId): Promise<VoiceInfo[]> {
  if (provider === "elevenlabs") {
    const key = keyFor("elevenlabs");
    if (!key) throw new Error("Add an ElevenLabs API key first.");
    return elevenVoices(key);
  }
  return STATIC_VOICES[provider];
}

/** Check a key with a cheap call before saving it. */
async function verifyKey(provider: VoiceProviderId, key: string) {
  const call = async (url: string, headers: Record<string, string>) => {
    let response: Response;
    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      throw new Error(`couldn't reach ${new URL(url).host}: check your internet connection (${error instanceof Error ? error.message : String(error)})`);
    }
    if (!response.ok) throw new Error(await readError(response));
  };
  switch (provider) {
    case "elevenlabs":
      await call("https://api.elevenlabs.io/v1/voices?page_size=1", { "xi-api-key": key });
      return;
    case "gemini":
      await call("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { "x-goog-api-key": key });
      return;
    case "openai":
      await call("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` });
      return;
    case "xai":
      await call("https://api.x.ai/v1/models", { Authorization: `Bearer ${key}` });
      return;
  }
}

export async function saveKey(providerId: unknown, rawKey: unknown, makeDefault: boolean) {
  const provider = spec(providerId);
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  if (key.length < 8) throw new Error("Paste the whole API key.");
  try {
    await verifyKey(provider.id, key);
  } catch (error) {
    throw new Error(`${provider.name} didn't accept this key (${error instanceof Error ? error.message : String(error)}).`);
  }
  const file = readKeys();
  file.keys[provider.id] = { key, savedAt: Date.now() };
  if (makeDefault || !file.defaultProvider) file.defaultProvider = provider.id;
  writeKeys(file);
  debugLog(`voice: saved a ${provider.id} key`);
  return voiceSettings();
}

export function removeKey(providerId: unknown) {
  const provider = spec(providerId);
  const file = readKeys();
  delete file.keys[provider.id];
  if (file.defaultProvider === provider.id) file.defaultProvider = null;
  writeKeys(file);
  return voiceSettings();
}

export function setDefaultProvider(providerId: unknown) {
  const provider = spec(providerId);
  const file = readKeys();
  file.defaultProvider = provider.id;
  writeKeys(file);
  return voiceSettings();
}

export interface GenerateVoiceInput {
  provider?: string;
  model?: string;
  voice?: string;
  text: string;
  style?: string;
  language?: string;
  speed?: number;
  name?: string;
  takes?: number;
}

interface Audio {
  data: Buffer;
  ext: "wav" | "mp3";
}

function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesize(provider: ProviderSpec, key: string, input: GenerateVoiceInput, model: string, voice: string): Promise<Audio> {
  switch (provider.id) {
    case "elevenlabs": {
      if (!voice) throw new Error("Pick an ElevenLabs voice (its voice id). agentcut_voice_options lists them.");
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({
          text: input.text,
          model_id: model,
          ...(input.language && model !== "eleven_multilingual_v2" ? { language_code: input.language } : {}),
        }),
      });
      if (!response.ok) throw new Error(`ElevenLabs: ${await readError(response)}`);
      return { data: Buffer.from(await response.arrayBuffer()), ext: "mp3" };
    }
    case "gemini": {
      // Style goes in short director's notes above the transcript: the model speaks a
      // "Say this…" prefix and doesn't take a system instruction.
      const text = input.style?.trim()
        ? `### DIRECTOR'S NOTES\n${input.style.trim()}\n\n#### TRANSCRIPT\n${input.text}`
        : input.text;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
      });
      if (!response.ok) throw new Error(`Gemini: ${await readError(response)}`);
      const json = (await response.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType?: string } }[] } }[];
      };
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!part) throw new Error("Gemini returned no audio (the text may have been blocked).");
      const data = Buffer.from(part.data, "base64");
      if (data.subarray(0, 4).toString("ascii") === "RIFF") return { data, ext: "wav" };
      const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24_000);
      return { data: pcmToWav(data, rate), ext: "wav" };
    }
    case "openai": {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          voice,
          input: input.text,
          response_format: "wav",
          ...(input.style?.trim() && model.startsWith("gpt-") ? { instructions: input.style.trim() } : {}),
          ...(typeof input.speed === "number" ? { speed: Math.max(0.25, Math.min(4, input.speed)) } : {}),
        }),
      });
      if (!response.ok) throw new Error(`OpenAI: ${await readError(response)}`);
      return { data: Buffer.from(await response.arrayBuffer()), ext: "wav" };
    }
    case "xai": {
      const response = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          text: input.text,
          voice_id: voice,
          language: input.language || "auto",
          output_format: { codec: "wav", sample_rate: 48_000 },
          ...(typeof input.speed === "number" ? { speed: Math.max(0.7, Math.min(1.5, input.speed)) } : {}),
        }),
      });
      if (!response.ok) throw new Error(`xAI: ${await readError(response)}`);
      return { data: Buffer.from(await response.arrayBuffer()), ext: "wav" };
    }
  }
}

export function wavSeconds(data: Buffer) {
  if (data.subarray(0, 4).toString("ascii") !== "RIFF") return null;
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= data.length) {
    const id = data.subarray(offset, offset + 4).toString("ascii");
    const size = data.readUInt32LE(offset + 4);
    if (id === "fmt ") byteRate = data.readUInt32LE(offset + 16);
    if (id === "data") {
      const bytes = size === 0xffffffff || offset + 8 + size > data.length ? data.length - offset - 8 : size;
      return byteRate ? Math.round((bytes / byteRate) * 100) / 100 : null;
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function slugName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Generate one or more takes and save them in the project's assets/voice/ (never overwrites). */
export async function generateVoice(paths: WorkspacePaths, slug: string, input: GenerateVoiceInput) {
  const text = String(input.text ?? "").trim();
  if (!text) throw new Error("text is required: the words to speak.");
  if (text.length > 20_000) throw new Error("That script is very long; generate it in parts (max ~20,000 characters).");
  const settings = voiceSettings();
  const providerId = (input.provider || settings.defaultProvider) as VoiceProviderId | null;
  if (!providerId) {
    throw new Error(
      "No voice provider is set up. Ask the user to open Voices in the studio header and paste an API key (ElevenLabs, Gemini, OpenAI or Grok).",
    );
  }
  const provider = spec(providerId);
  const key = keyFor(provider.id);
  if (!key) throw new Error(`No ${provider.name} key yet. Ask the user to add one under Voices in the studio header.`);
  const model = input.model?.trim() || provider.defaultModel;
  const voice = input.voice?.trim() || provider.defaultVoice;
  const takes = Math.max(1, Math.min(4, Math.round(input.takes ?? 1)));
  const base = slugName(input.name || `${voice || provider.id}-${text.split(/\s+/).slice(0, 4).join(" ")}`) || "voice";
  const dir = join(projectDir(paths, slug), "assets", "voice");
  mkdirSync(dir, { recursive: true });

  const results = await Promise.all(
    Array.from({ length: takes }, async (_, index) => {
      try {
        const audio = await synthesize(provider, key, { ...input, text }, model, voice);
        const target = uniquePath(safeJoin(projectDir(paths, slug), `assets/voice/${base}${takes > 1 ? `-take${index + 1}` : ""}.${audio.ext}`));
        atomicWrite(target, audio.data);
        const rel = `assets/voice/${target.split(/[\\/]/).pop()}`;
        return { path: rel, bytes: audio.data.length, seconds: audio.ext === "wav" ? wavSeconds(audio.data) : null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  if (results.every((r) => "error" in r)) throw new Error((results[0] as { error: string }).error);
  return {
    provider: provider.id,
    model,
    voice,
    takes: results,
    next: "Check each take with agentcut_media_info (exact length) and agentcut_transcribe (the words were said right), then place the best one on a Voice track.",
  };
}

export function voiceOptions() {
  const settings = voiceSettings();
  return {
    defaultProvider: settings.defaultProvider,
    providers: settings.providers.map((p) => ({
      id: p.id,
      name: p.name,
      configured: p.configured,
      defaultModel: p.defaultModel,
      models: p.models.map((m) => m.id),
      defaultVoice: p.defaultVoice || undefined,
      style: p.styleNote,
      voices: p.id === "elevenlabs" ? "call with provider: \"elevenlabs\" to list the account's voices" : STATIC_VOICES[p.id as Exclude<VoiceProviderId, "elevenlabs">].map((v) => (v.description ? `${v.id} (${v.description})` : v.id)),
    })),
    note: settings.defaultProvider
      ? "Use the user's default provider unless they name another. Never ask for or mention API keys; the helper adds them."
      : "No provider is set up yet: ask the user to open Voices in the studio header and add a key.",
  };
}

export function hasKeyFile() {
  return existsSync(keyStorePath());
}
