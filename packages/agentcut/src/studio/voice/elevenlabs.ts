import type { VoiceAdapter, VoiceInfo } from "./types.js";
import { readError, readJson, verifyRequest } from "../providers/http.js";
async function elevenVoices(key: string): Promise<VoiceInfo[]> {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!response.ok) throw new Error(`ElevenLabs: ${await readError(response)}`);
  const json = (await readJson(response)) as {
    voices?: {
      voice_id: string;
      name: string;
      labels?: Record<string, string>;
      preview_url?: string;
      category?: string;
    }[];
  };
  return (json.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    description:
      [
        v.labels?.accent,
        v.labels?.gender,
        v.labels?.description ?? v.labels?.descriptive,
        v.labels?.use_case ?? v.labels?.use_cases,
      ]
        .filter(Boolean)
        .join(", ") || v.category,
    previewUrl: v.preview_url,
  }));
}
const voices: VoiceInfo[] | null = null;
export const adapter: VoiceAdapter = {
  spec: {
    id: "elevenlabs",
    name: "ElevenLabs",
    keyUrl: "https://elevenlabs.io/app/settings/api-keys",
    keyHint:
      "Profile → API keys. Needs the Text to Speech and Voices (read) permissions.",
    envVar: "ELEVENLABS_API_KEY",
    defaultModel: "eleven_multilingual_v2",
    models: [
      { id: "eleven_v4", label: "Eleven v4 (most expressive)" },
      { id: "eleven_v3", label: "Eleven v3 (expressive, audio tags)" },
      { id: "eleven_multilingual_v2", label: "Multilingual v2 (most stable)" },
      { id: "eleven_flash_v2_5", label: "Flash v2.5 (fastest, cheapest)" },
    ],
    defaultVoice: "",
    styleNote:
      "No style field: put audio tags like [excited] or [whispers] in the text (v3/v4 models).",
  },
  voices,
  async listVoices(key) {
    if (!key) throw new Error("Add an ElevenLabs key first.");
    return elevenVoices(key);
  },
  async verify(key) {
    await verifyRequest("https://api.elevenlabs.io/v1/voices?page_size=1", {
      "xi-api-key": key,
    });
    return;
  },
  async synthesize(key, input, model, voice) {
    if (!voice)
      throw new Error(
        "Pick an ElevenLabs voice (its voice id). agentcut_voice_options lists them.",
      );
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: input.text,
          model_id: model,
          ...(input.language && model !== "eleven_multilingual_v2"
            ? { language_code: input.language }
            : {}),
        }),
      },
    );
    if (!response.ok)
      throw new Error(`ElevenLabs: ${await readError(response)}`);
    return { data: Buffer.from(await response.arrayBuffer()), ext: "mp3" };
  },
};
