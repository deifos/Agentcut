import type { VoiceAdapter, VoiceInfo } from "./types.js";
import { readError, verifyRequest } from "../providers/http.js";

const voices: VoiceInfo[] | null = [
  "marin",
  "cedar",
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
].map((id) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  description: id === "marin" || id === "cedar" ? "Best quality" : undefined,
}));
export const adapter: VoiceAdapter = {
  spec: {
    id: "openai",
    name: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "platform.openai.com → API keys.",
    envVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini-tts",
    models: [
      {
        id: "gpt-4o-mini-tts",
        label: "gpt-4o-mini-tts (follows style instructions)",
      },
      { id: "tts-1-hd", label: "tts-1-hd" },
      { id: "tts-1", label: "tts-1 (fast)" },
    ],
    defaultVoice: "marin",
    styleNote: "Style goes in `instructions` (gpt-4o-mini-tts only).",
  },
  voices,
  async listVoices(key) {
    return voices!;
  },
  async verify(key) {
    await verifyRequest("https://api.openai.com/v1/models", {
      Authorization: `Bearer ${key}`,
    });
    return;
  },
  async synthesize(key, input, model, voice) {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        input: input.text,
        response_format: "wav",
        ...(input.style?.trim() && model.startsWith("gpt-")
          ? { instructions: input.style.trim() }
          : {}),
        ...(typeof input.speed === "number"
          ? { speed: Math.max(0.25, Math.min(4, input.speed)) }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(`OpenAI: ${await readError(response)}`);
    return { data: Buffer.from(await response.arrayBuffer()), ext: "wav" };
  },
};
