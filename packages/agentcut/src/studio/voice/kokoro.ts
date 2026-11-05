import { homedir } from "node:os";
import { join } from "node:path";
import { KOKORO_VOICES } from "./kokoro-catalog.js";
import type { VoiceAdapter, GenerateVoiceInput } from "./types.js";
const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
type Engine = Awaited<
  ReturnType<typeof import("kokoro-js").KokoroTTS.from_pretrained>
>;
let engine: Promise<Engine> | null = null;
let queue: Promise<unknown> = Promise.resolve();
export function selectKokoroVoice(input: GenerateVoiceInput): string {
  const accent =
    input.accent ??
    (/^(en[-_]gb|british english)$/i.test(input.language ?? "")
      ? "British"
      : /^(en[-_]us|american english)$/i.test(input.language ?? "")
        ? "American"
        : undefined);
  const choices = KOKORO_VOICES.filter(
    (v) =>
      (!input.gender || input.gender === v.gender) &&
      (!accent || accent === v.accent),
  );
  if (input.voice) {
    if (!choices.some((v) => v.id === input.voice))
      throw new Error(
        "The selected Kokoro voice does not match the requested voice, gender or accent. Review the voice options; no other provider was called.",
      );
    return input.voice;
  }
  const purpose = input.purpose;
  return (
    choices.find(
      (v) =>
        purpose && (v.suggestedUses as readonly string[]).includes(purpose),
    )?.id ??
    choices.find((v) => v.id === "af_heart")?.id ??
    choices[0]?.id ??
    (() => {
      throw new Error("No Kokoro voice matches these constraints.");
    })()
  );
}
export function validateKokoro(
  input: GenerateVoiceInput,
  voice: string,
  model: string,
) {
  selectKokoroVoice({ ...input, voice });
  if (model !== MODEL) throw new Error("Choose the Kokoro-82M v1.0 model.");
  if (!KOKORO_VOICES.some((item) => item.id === voice))
    throw new Error(
      "Unknown Kokoro voice. Read the voice options and select a listed voice.",
    );
  if (
    input.language &&
    !/^(en(?:[-_](?:us|gb))?|english|american english|british english)$/i.test(
      input.language.trim(),
    )
  )
    throw new Error(
      "Local Kokoro supports English only in this version. Choose an English script, or explicitly select a paid provider that supports your language. No paid provider was called.",
    );
  if (
    /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u.test(
      input.text,
    )
  )
    throw new Error(
      "This Kokoro runtime supports English only. Use an English script or explicitly select another provider. No paid provider was called.",
    );
  if (
    input.speed !== undefined &&
    (!Number.isFinite(input.speed) || input.speed < 0.5 || input.speed > 2)
  )
    throw new Error("Kokoro speed must be between 0.5 and 2.");
  if (input.style?.trim())
    throw new Error(
      "Kokoro does not support style instructions. Choose a listed voice and speed, or explicitly select another provider.",
    );
}
async function getEngine() {
  if (!engine)
    engine = (async () => {
      const { KokoroTTS } = await import("kokoro-js");
      const { env } = await import("@huggingface/transformers");
      env.cacheDir =
        process.env.AGENTCUT_MODEL_CACHE ||
        join(homedir(), ".agentcut", "models");
      return KokoroTTS.from_pretrained(MODEL, { dtype: "q8", device: "cpu" });
    })().catch((reason) => {
      engine = null;
      throw new Error(
        `Local Kokoro setup failed. First use needs an internet connection for the model (about 93 MB plus small support files) and a writable model cache. Retry after checking the connection and disk space. No paid provider was called. ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    });
  return engine;
}
export function splitKokoroText(text: string): string[] {
  const chunks: string[] = [];
  let part = "";
  for (const token of text.trim().split(/\s+/)) {
    for (let start = 0; start < token.length; start += 180) {
      const word = token.slice(start, start + 180);
      if (part && part.length + word.length + 1 > 180) {
        chunks.push(part);
        part = "";
      }
      part += (part ? " " : "") + word;
      if (/[.!?]$/.test(word)) {
        chunks.push(part);
        part = "";
      }
    }
  }
  if (part) chunks.push(part);
  return chunks;
}
export const adapter: VoiceAdapter = {
  spec: {
    id: "kokoro",
    name: "Kokoro (free, local)",
    local: true,
    keyUrl: "",
    keyHint: "No key. First use downloads about 93 MB. English only.",
    envVar: "",
    defaultModel: MODEL,
    models: [{ id: MODEL, label: "Kokoro-82M v1.0 (local CPU, q8)" }],
    defaultVoice: "af_heart",
    styleNote:
      "English, American and British voices. Pick a voice and speed; style instructions are not supported. First use downloads the model; later use reuses the cache. No paid fallback.",
  },
  voices: KOKORO_VOICES.map((voice) => ({
    ...voice,
    suggestedUses: [...voice.suggestedUses],
  })),
  async listVoices() {
    return this.voices!;
  },
  async verify() {
    throw new Error("Kokoro does not use an API key.");
  },
  async synthesize(_key, input, model, voice) {
    validateKokoro(input, voice, model);
    const task = queue
      .catch(() => undefined)
      .then(async () => {
        const tts = await getEngine();
        const chunks: Float32Array[] = [];
        let sampleRate = 24000;
        // Bound English chunks before the runtime tokenizer's 510-token window.
        for (const text of splitKokoroText(input.text)) {
          const audio = await tts.generate(text, {
            voice: voice as keyof typeof tts.voices,
            speed: input.speed ?? 1,
          });
          chunks.push(audio.audio);
          sampleRate = audio.sampling_rate;
        }
        const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        if (!length)
          throw new Error(
            "Kokoro returned no audio. No paid provider was called.",
          );
        const samples = new Float32Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          samples.set(chunk, offset);
          offset += chunk.length;
        }
        const wav = Buffer.alloc(44 + length * 2);
        wav.write("RIFF");
        wav.writeUInt32LE(wav.length - 8, 4);
        wav.write("WAVEfmt ", 8);
        wav.writeUInt32LE(16, 16);
        wav.writeUInt16LE(1, 20);
        wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(sampleRate, 24);
        wav.writeUInt32LE(sampleRate * 2, 28);
        wav.writeUInt16LE(2, 32);
        wav.writeUInt16LE(16, 34);
        wav.write("data", 36);
        wav.writeUInt32LE(length * 2, 40);
        for (let i = 0; i < length; i++)
          wav.writeInt16LE(
            Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767),
            44 + i * 2,
          );
        return { data: wav, ext: "wav" as const };
      });
    queue = task.then(() => undefined, () => undefined);
    return task;
  },
};
