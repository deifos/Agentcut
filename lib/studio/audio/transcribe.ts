import { decodeAudioUrl, resampleMono } from "@/lib/studio/audio/decode";

export interface TranscribeOptions {
  fps: number;
  language: string;
  model: "tiny" | "base" | "small";
}

interface WorkerChunk {
  text: string;
  timestamp: [number, number | null];
}

/** The Whisper weights stay resident while the worker lives; drop them after this long idle. */
const IDLE_TERMINATE_MS = 3 * 60 * 1000;

let worker: Worker | null = null;
let inFlight = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function getWorker() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (!worker) {
    worker = new Worker(new URL("../../../app/transcription-worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

function scheduleIdleTerminate() {
  if (inFlight > 0) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (inFlight > 0) return;
    worker?.terminate();
    worker = null;
  }, IDLE_TERMINATE_MS);
}

function runWorker(audio: Float32Array, options: TranscribeOptions) {
  const device = typeof navigator !== "undefined" && "gpu" in navigator ? "webgpu" : "wasm";
  const w = getWorker();
  inFlight += 1;
  const promise = new Promise<{ text: string; chunks: WorkerChunk[] }>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { status?: string; result?: { text: string; chunks: WorkerChunk[] }; data?: unknown };
      if (data.status === "complete" && data.result) {
        w.removeEventListener("message", onMessage);
        resolve(data.result);
      } else if (data.status === "error") {
        w.removeEventListener("message", onMessage);
        reject(new Error(String(data.data ?? "Transcription failed.")));
      }
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ type: "load", data: { device, modelSize: options.model } });
    w.postMessage({ type: "run", data: { audio, language: options.language, device, modelSize: options.model } });
  });
  return promise.finally(() => {
    inFlight -= 1;
    scheduleIdleTerminate();
  });
}

/** Word timings for a voice or song file (browser Whisper, same worker as the editor). */
export async function transcribeUrl(url: string, options: TranscribeOptions) {
  const buffer = await decodeAudioUrl(url);
  const audio = await resampleMono(buffer, 16_000);
  const started = performance.now();
  const result = await runWorker(audio, options);
  const words = result.chunks
    .map((chunk) => {
      const start = chunk.timestamp[0] ?? 0;
      const end = chunk.timestamp[1] ?? start + 0.2;
      return {
        text: chunk.text.trim(),
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        fromFrame: Math.round(start * options.fps),
        toFrame: Math.max(Math.round(start * options.fps) + 1, Math.round(end * options.fps)),
      };
    })
    .filter((word) => word.text.length > 0);
  return {
    text: result.text.trim(),
    language: options.language,
    model: `whisper-${options.model}`,
    seconds: Number(buffer.duration.toFixed(3)),
    fps: options.fps,
    words,
    tookMs: Math.round(performance.now() - started),
    note: "Word times come from browser Whisper; check fast or sung passages by ear (listen tools) before cutting to them.",
  };
}
