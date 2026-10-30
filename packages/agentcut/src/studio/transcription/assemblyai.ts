import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { readError, readJson } from "../providers/http.js";
import type { TranscriptionAdapter, TranscriptWord } from "./types.js";

interface Word {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  confidence?: number;
}
interface Result {
  id: string;
  status: string;
  text?: string;
  language_code?: string;
  audio_duration?: number;
  words?: Word[];
  utterances?: Word[];
}
export function assemblyWords(words: Word[], fps: number): TranscriptWord[] {
  return words.map((w) => {
    if (
      !Number.isFinite(w.start) ||
      !Number.isFinite(w.end) ||
      w.start < 0 ||
      w.end < w.start
    )
      throw new Error("AssemblyAI returned invalid word timings.");
    return {
      text: w.text,
      start: w.start / 1000,
      end: w.end / 1000,
      fromFrame: Math.round((w.start / 1000) * fps),
      toFrame: Math.max(
        Math.round((w.start / 1000) * fps) + 1,
        Math.round((w.end / 1000) * fps),
      ),
      ...(w.speaker ? { speaker: w.speaker } : {}),
      ...(Number.isFinite(w.confidence) ? { confidence: w.confidence } : {}),
    };
  });
}

export const assemblyai: TranscriptionAdapter = {
  metadata: {
    id: "assemblyai",
    name: "AssemblyAI",
    cloud: true,
    envVar: "ASSEMBLYAI_API_KEY",
    keyUrl: "https://www.assemblyai.com/dashboard/api-keys",
    keyHint:
      "Use your AssemblyAI account key. Audio is sent to AssemblyAI; provider charges apply.",
    models: ["universal-2"],
    defaultModel: "universal-2",
    capabilities: {
      wordTimings: true,
      speakers: true,
      languageDetection: true,
      fillers:
        "Requests disfluencies=true. Supported for English with Universal-2; other languages are not guaranteed.",
    },
  },
  async run(input, context) {
    if (!context.key)
      throw new Error(
        "Add an AssemblyAI key in Transcription settings. No local fallback was used.",
      );
    if (input.model && input.model !== "universal-2")
      throw new Error("This adapter currently supports universal-2 only.");
    // English editing transcripts use the model that supports disfluencies. Never clean away fillers before timing them.
    const language = input.language ?? "en";
    const headers = { authorization: context.key };
    const request = async <T>(
      path: string,
      init: RequestInit = {},
    ): Promise<T> => {
      const response = await fetch(`https://api.assemblyai.com/v2/${path}`, {
        ...init,
        headers: { ...headers, ...init.headers },
        signal: context.signal,
      });
      if (!response.ok)
        throw new Error(`AssemblyAI: ${await readError(response)}`);
      return readJson<T>(response);
    };
    context.progress("extracting_audio");
    const audio = await context.audio();
    context.signal.throwIfAborted();
    context.progress("uploading_audio");
    const upload = await request<{ upload_url: string }>("upload", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: new Uint8Array(await readFile(audio)),
    });
    if (
      typeof upload.upload_url !== "string" ||
      !upload.upload_url.startsWith("https://")
    )
      throw new Error("AssemblyAI returned no upload URL.");
    context.progress("submitting");
    let result: Result = await request<Result>("transcript", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audio_url: upload.upload_url,
        speech_models: ["universal-2"],
        disfluencies: true,
        speaker_labels: input.speakerLabels ?? false,
        ...(language === "auto"
          ? { language_detection: true }
          : { language_code: language }),
      }),
    });
    if (!result.id || !/^[a-zA-Z0-9-]+$/.test(result.id))
      throw new Error("AssemblyAI returned no valid transcript ID.");
    const id = result.id;
    try {
      while (result.status !== "completed") {
        if (result.status === "error")
          throw new Error(
            "AssemblyAI could not transcribe this audio. Check language and account settings. No fallback was used.",
          );
        context.progress(
          result.status === "queued" ? "queued" : "transcribing",
        );
        await delay(2500, undefined, { signal: context.signal });
        result = await request<Result>(`transcript/${id}`);
      }
    } catch (error) {
      // Cancellation stops local polling. Deletion is best effort; provider billing may already have begun.
      if (context.signal.aborted)
        await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
          method: "DELETE",
          headers,
          signal: AbortSignal.timeout(5000),
        }).catch(() => undefined);
      throw error;
    }
    const words = assemblyWords(result.words ?? [], context.fps);
    return {
      text: result.text ?? "",
      language: result.language_code ?? language,
      model: "universal-2",
      seconds: result.audio_duration ?? words.at(-1)?.end ?? 0,
      fps: context.fps,
      words,
      segments: (result.utterances ?? []).map((u) => ({
        text: u.text,
        start: u.start / 1000,
        end: u.end / 1000,
        ...(u.speaker ? { speaker: u.speaker } : {}),
      })),
      note: "Fillers were requested, but recognition and timing require a listening check. A transcript does not remove audio. Cloud cancellation may not prevent charges already incurred.",
    };
  },
};
