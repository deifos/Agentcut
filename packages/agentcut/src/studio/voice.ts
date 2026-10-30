// Voice-over generation for Agentcut, with the user's own API keys.
//
// Keys live in a file in the user's home folder (outside the workspace, so Claude's file
// tools never see them), are never sent to the page after saving, never put in Claude's
// environment, and never written to logs. The helper adds the key when it calls the provider.
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { debugLog } from "../log.js";
import { atomicWrite, projectDir, safeJoin, uniquePath } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";
import { providerStore } from "./providers/settings.js";
import { VOICE_ADAPTERS, getVoiceAdapter } from "./voice/registry.js";
import type {
  ProviderSpec,
  VoiceInfo,
  GenerateVoiceInput,
} from "./voice/types.js";
export type { VoiceInfo, GenerateVoiceInput } from "./voice/types.js";
export { readError } from "./providers/http.js";
const store = providerStore(keyStorePath, () => VOICE_PROVIDERS);

export type VoiceProviderId = string;

export const VOICE_PROVIDERS = Object.values(VOICE_ADAPTERS).map((a) => a.spec);

// ---------------------------------------------------------------------------
// Key store

export function keyStorePath() {
  // Not in the workspace: Claude reads and writes files there.
  return (
    process.env.AGENTCUT_KEYS ||
    join(homedir(), ".agentcut", "studio-keys.json")
  );
}

function spec(id: unknown): ProviderSpec {
  return getVoiceAdapter(String(id)).spec;
}

/** The key for a provider: saved in the studio settings, or the provider's env var. */
export function keyFor(id: VoiceProviderId): string | null {
  return store.key(id);
}

/** Env vars that hold provider keys: removed from Claude's environment. */
export const VOICE_KEY_ENV_VARS = VOICE_PROVIDERS.map((p) => p.envVar);

export function voiceSettings() {
  const providers = VOICE_PROVIDERS.map((p) => ({
    ...p,
    ...store.status(p.id),
  }));
  const configured = providers.filter((p) => p.configured).map((p) => p.id);
  const preferred = store.preferred();
  return {
    providers,
    defaultProvider:
      preferred && configured.includes(preferred)
        ? preferred
        : (configured[0] ?? null),
  };
}

// ---------------------------------------------------------------------------
// Provider calls

export async function listVoices(
  provider: VoiceProviderId,
): Promise<VoiceInfo[]> {
  return getVoiceAdapter(provider).listVoices(keyFor(provider));
}

/** Check a key with a cheap call before saving it. */

export async function saveKey(
  providerId: unknown,
  rawKey: unknown,
  makeDefault: boolean,
) {
  const provider = spec(providerId);
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  if (key.length < 8) throw new Error("Paste the whole API key.");
  try {
    await getVoiceAdapter(provider.id).verify(key);
  } catch {
    throw new Error(
      provider.name +
        " could not verify this key. Check the key and permissions.",
    );
  }
  store.save(provider.id, key, makeDefault || !store.preferred());
  debugLog("voice: saved a " + provider.id + " key");
  return voiceSettings();
}

export function removeKey(providerId: unknown) {
  store.remove(spec(providerId).id);
  return voiceSettings();
}

export function setDefaultProvider(providerId: unknown) {
  store.select(spec(providerId).id);
  return voiceSettings();
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
      const bytes =
        size === 0xffffffff || offset + 8 + size > data.length
          ? data.length - offset - 8
          : size;
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
export async function generateVoice(
  paths: WorkspacePaths,
  slug: string,
  input: GenerateVoiceInput,
) {
  const text = String(input.text ?? "").trim();
  if (!text) throw new Error("text is required: the words to speak.");
  if (text.length > 20_000)
    throw new Error(
      "That script is very long; generate it in parts (max ~20,000 characters).",
    );
  const settings = voiceSettings();
  const providerId = (input.provider ||
    settings.defaultProvider) as VoiceProviderId | null;
  if (!providerId) {
    throw new Error(
      "No voice provider is set up. Ask the user to open Voice-over in the studio header and paste an API key (ElevenLabs, Gemini, OpenAI or Grok).",
    );
  }
  const provider = spec(providerId);
  const key = keyFor(provider.id);
  if (!key)
    throw new Error(
      `No ${provider.name} key yet. Ask the user to add one under Voice-over in the studio header.`,
    );
  const model = input.model?.trim() || provider.defaultModel;
  const voice = input.voice?.trim() || provider.defaultVoice;
  const takes = Math.max(1, Math.min(4, Math.round(input.takes ?? 1)));
  const base =
    slugName(
      input.name ||
        `${voice || provider.id}-${text.split(/\s+/).slice(0, 4).join(" ")}`,
    ) || "voice";
  const dir = join(projectDir(paths, slug), "assets", "voice");
  mkdirSync(dir, { recursive: true });

  const results = await Promise.all(
    Array.from({ length: takes }, async (_, index) => {
      try {
        const audio = await getVoiceAdapter(provider.id).synthesize(
          key,
          { ...input, text },
          model,
          voice,
        );
        const target = uniquePath(
          safeJoin(
            projectDir(paths, slug),
            `assets/voice/${base}${takes > 1 ? `-take${index + 1}` : ""}.${audio.ext}`,
          ),
        );
        atomicWrite(target, audio.data);
        const rel = `assets/voice/${target.split(/[\\/]/).pop()}`;
        return {
          path: rel,
          bytes: audio.data.length,
          seconds: audio.ext === "wav" ? wavSeconds(audio.data) : null,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
  if (results.every((r) => "error" in r))
    throw new Error((results[0] as { error: string }).error);
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
      voices:
        getVoiceAdapter(p.id).voices?.map((v) =>
          v.description ? v.id + " (" + v.description + ")" : v.id,
        ) ??
        "Call agentcut_voice_options with this provider to list account voices.",
    })),
    note: settings.defaultProvider
      ? "Use the user's default provider unless they name another. Never ask for or mention API keys; the helper adds them."
      : "No provider is set up yet: ask the user to open Voice-over in the studio header and add a key.",
  };
}

export function hasKeyFile() {
  return existsSync(keyStorePath());
}
