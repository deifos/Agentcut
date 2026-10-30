import type { TranscriptionAdapter, TranscriptWord } from "./types.js";

export const localWhisper: TranscriptionAdapter = {
  metadata: {
    id: "local",
    name: "Local Whisper",
    cloud: false,
    models: ["tiny", "base", "small"],
    defaultModel: "base",
    capabilities: {
      wordTimings: true,
      speakers: false,
      languageDetection: false,
      fillers: "Not guaranteed. Listen before making filler cuts.",
    },
  },
  async run(input, context) {
    if (input.speakerLabels)
      throw new Error(
        "Local Whisper does not provide speaker labels. Select a provider with that capability.",
      );
    const model = input.model ?? "base";
    if (!["tiny", "base", "small"].includes(model))
      throw new Error("Choose tiny, base or small for Local Whisper.");
    const language = input.language ?? "en";
    if (language === "auto")
      throw new Error("Local Whisper needs a language code, such as en.");
    context.progress("local_transcription");
    context.signal.throwIfAborted();
    // The page can disconnect or remain busy with another job. Cancellation must
    // finish this helper request without waiting for that page request to settle.
    let abort: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(new Error("Local transcription cancelled."));
      context.signal.addEventListener("abort", abort, { once: true });
    });
    const result = await Promise.race([
      context.local({ language, model }),
      cancelled,
    ]).finally(() => context.signal.removeEventListener("abort", abort));
    context.signal.throwIfAborted();
    const words = result.words as TranscriptWord[];
    return {
      text: String(result.text),
      language,
      model: String(result.model),
      seconds: Number(result.seconds),
      fps: context.fps,
      words,
      segments: [
        {
          text: String(result.text),
          start: words[0]?.start ?? 0,
          end: words.at(-1)?.end ?? 0,
        },
      ],
      note: String(result.note ?? "Check word timings by ear before cutting."),
    };
  },
};
