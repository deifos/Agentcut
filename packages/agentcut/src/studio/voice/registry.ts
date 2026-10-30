import { adapter as elevenlabs } from "./elevenlabs.js";
import { adapter as gemini } from "./gemini.js";
import { adapter as openai } from "./openai.js";
import { adapter as xai } from "./xai.js";
import type { VoiceAdapter } from "./types.js";
/** One registration point for synthesis metadata, validation, voices and generation. */
export const VOICE_ADAPTERS: Record<string, VoiceAdapter> = {
  elevenlabs,
  gemini,
  openai,
  xai,
};
export function getVoiceAdapter(id: string) {
  const adapter = VOICE_ADAPTERS[id];
  if (!adapter)
    throw new Error("Unknown voice-over provider. Choose one from settings.");
  return adapter;
}
