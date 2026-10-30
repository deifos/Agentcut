import type { VoiceAdapter, VoiceInfo } from "./types.js";
import { readError, verifyRequest } from "../providers/http.js";

const voices: VoiceInfo[] | null = [
  "eve",
  "ara",
  "leo",
  "rex",
  "sal",
  "carina",
  "zagan",
  "helix",
  "orion",
  "luna",
  "iris",
  "altair",
  "zenith",
  "perseus",
  "helios",
  "lux",
  "kepler",
  "rigel",
  "cosmo",
  "celeste",
  "ursa",
  "sirius",
  "lumen",
  "castor",
  "naksh",
  "atlas",
  "aurora",
  "liora",
].map((id) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  description: id === "eve" ? "Default" : undefined,
}));
export const adapter: VoiceAdapter = {
  spec: {
    id: "xai",
    name: "Grok (xAI)",
    keyUrl: "https://console.x.ai/",
    keyHint: "console.x.ai → API keys.",
    envVar: "XAI_API_KEY",
    defaultModel: "default",
    models: [{ id: "default", label: "Grok TTS" }],
    defaultVoice: "eve",
    styleNote:
      "No style field: use inline tags like [pause] [laugh] or <whisper>…</whisper>, and `speed`.",
  },
  voices,
  async listVoices(key) {
    return voices!;
  },
  async verify(key) {
    await verifyRequest("https://api.x.ai/v1/models", {
      Authorization: `Bearer ${key}`,
    });
    return;
  },
  async synthesize(key, input, model, voice) {
    const response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        voice_id: voice,
        language: input.language || "auto",
        output_format: { codec: "wav", sample_rate: 48_000 },
        ...(typeof input.speed === "number"
          ? { speed: Math.max(0.7, Math.min(1.5, input.speed)) }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(`xAI: ${await readError(response)}`);
    return { data: Buffer.from(await response.arrayBuffer()), ext: "wav" };
  },
};
