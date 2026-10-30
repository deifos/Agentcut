import type { VoiceAdapter, VoiceInfo } from "./types.js";
import { readError, readJson, verifyRequest } from "../providers/http.js";
import { pcmToWav } from "./audio.js";

const voices: VoiceInfo[] | null = [
  ["Zephyr", "Bright"],
  ["Puck", "Upbeat"],
  ["Charon", "Informative"],
  ["Kore", "Firm"],
  ["Fenrir", "Excitable"],
  ["Leda", "Youthful"],
  ["Orus", "Firm"],
  ["Aoede", "Breezy"],
  ["Callirrhoe", "Easy-going"],
  ["Autonoe", "Bright"],
  ["Enceladus", "Breathy"],
  ["Iapetus", "Clear"],
  ["Umbriel", "Easy-going"],
  ["Algieba", "Smooth"],
  ["Despina", "Smooth"],
  ["Erinome", "Clear"],
  ["Algenib", "Gravelly"],
  ["Rasalgethi", "Informative"],
  ["Laomedeia", "Upbeat"],
  ["Achernar", "Soft"],
  ["Alnilam", "Firm"],
  ["Schedar", "Even"],
  ["Gacrux", "Mature"],
  ["Pulcherrima", "Forward"],
  ["Achird", "Friendly"],
  ["Zubenelgenubi", "Casual"],
  ["Vindemiatrix", "Gentle"],
  ["Sadachbia", "Lively"],
  ["Sadaltager", "Knowledgeable"],
  ["Sulafat", "Warm"],
].map(([id, description]) => ({ id, name: id, description }));
export const adapter: VoiceAdapter = {
  spec: {
    id: "gemini",
    name: "Google Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "Google AI Studio → Get API key.",
    envVar: "GEMINI_API_KEY",
    defaultModel: "gemini-3.8-flash-tts",
    models: [
      { id: "gemini-3.8-flash-tts", label: "Gemini 3.8 Flash TTS" },
      {
        id: "gemini-3.8-flash-lite-tts",
        label: "Gemini 3.8 Flash-Lite TTS (cheaper)",
      },
      {
        id: "gemini-2.5-pro-preview-tts",
        label: "Gemini 2.5 Pro TTS (preview)",
      },
    ],
    defaultVoice: "Puck",
    styleNote:
      "Short style/pace notes are sent as director's notes above the transcript.",
  },
  voices,
  async listVoices(key) {
    return voices!;
  },
  async verify(key) {
    await verifyRequest(
      "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
      { "x-goog-api-key": key },
    );
    return;
  },
  async synthesize(key, input, model, voice) {
    const text = input.style?.trim()
      ? `### DIRECTOR'S NOTES\n${input.style.trim()}\n\n#### TRANSCRIPT\n${input.text}`
      : input.text;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini: ${await readError(response)}`);
    const json = (await readJson(response)) as {
      candidates?: {
        content?: {
          parts?: { inlineData?: { data: string; mimeType?: string } }[];
        };
      }[];
    };
    const part = json.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData,
    )?.inlineData;
    if (!part)
      throw new Error(
        "Gemini returned no audio (the text may have been blocked).",
      );
    const data = Buffer.from(part.data, "base64");
    if (data.subarray(0, 4).toString("ascii") === "RIFF")
      return { data, ext: "wav" };
    const rate = Number(/rate=(\d+)/.exec(part.mimeType ?? "")?.[1] ?? 24_000);
    return { data: pcmToWav(data, rate), ext: "wav" };
  },
};
