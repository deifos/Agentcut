"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speak instead of typing: the mic records in the page, Moonshine (in a worker) reads the phrase
 * again every few hundred ms so the words show up while you talk, and the last read is final.
 * Nothing leaves the browser.
 */

export type DictationState = "idle" | "loading" | "listening" | "finishing";

const RATE = 16_000;
/** Read the phrase again once this much new audio came in. */
const PARTIAL_EVERY = RATE * 0.35;
/** Past this, the phrase is cut at its quietest moment so each read stays short. */
const SEGMENT_MAX = RATE * 18;
const SPLIT_SEARCH = RATE * 5;
/** Shorter than this, or quieter than this, is not speech. */
const MIN_AUDIO = RATE * 0.3;
const MIN_PEAK = 0.015;
/** Keep the model loaded between phrases; drop it after this long unused. */
const IDLE_TERMINATE_MS = 10 * 60 * 1000;

const CAPTURE_WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("agentcut-capture", Capture);
`;

let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let modelLoaded = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let nextId = 0;
const activeSessions = new Set<object>();

function resetWorker(w: Worker) {
  w.terminate();
  if (worker === w) {
    worker = null;
    workerReady = null;
    modelLoaded = false;
  }
}

function getWorker(onProgress?: (percent: number) => void) {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (!worker) {
    worker = new Worker(
      new URL("../../../app/dictation-worker.ts", import.meta.url),
      { type: "module" },
    );
    const w = worker;
    w.addEventListener("error", () => resetWorker(w));
    w.addEventListener("messageerror", () => resetWorker(w));
    const device =
      typeof navigator !== "undefined" && "gpu" in navigator
        ? "webgpu"
        : "wasm";
    // Files download in parallel; show the slowest one.
    const files = new Map<string, number>();
    workerReady = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        w.removeEventListener("message", onMessage);
        w.removeEventListener("error", onError);
        w.removeEventListener("messageerror", onError);
      };
      const onError = () => {
        cleanup();
        reject(new Error("The speech worker stopped. Try again."));
      };
      const onMessage = (event: MessageEvent) => {
        const data = event.data as {
          type: string;
          file?: string;
          progress?: number;
          message?: string;
        };
        if (data.type === "progress" && data.file) {
          files.set(data.file, data.progress ?? 0);
          onProgress?.(Math.min(...files.values()));
        } else if (data.type === "ready") {
          cleanup();
          modelLoaded = true;
          resolve();
        } else if (data.type === "error") {
          cleanup();
          reject(new Error(data.message ?? "Couldn't load the speech model."));
        }
      };
      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError);
      w.addEventListener("messageerror", onError);
      w.postMessage({ type: "load", device });
    });
    workerReady.catch(() => {
      resetWorker(w);
    });
  }
  return { worker, ready: workerReady! };
}

function scheduleIdleTerminate() {
  if (idleTimer) clearTimeout(idleTimer);
  if (activeSessions.size) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeSessions.size) return;
    worker?.terminate();
    worker = null;
    workerReady = null;
    modelLoaded = false;
  }, IDLE_TERMINATE_MS);
}

function recognize(audio: Float32Array): Promise<string> {
  let peak = 0;
  for (let i = 0; i < audio.length; i++)
    peak = Math.max(peak, Math.abs(audio[i]));
  if (audio.length < MIN_AUDIO || peak < MIN_PEAK) return Promise.resolve("");
  const { worker: w } = getWorker();
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      w.removeEventListener("messageerror", onError);
    };
    const onError = () => {
      cleanup();
      reject(new Error("The speech worker stopped. Try again."));
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type: string;
        id?: number;
        text?: string;
        message?: string;
      };
      if (data.id !== id) return;
      cleanup();
      if (data.type === "result") resolve(data.text ?? "");
      else reject(new Error(data.message ?? "Speech recognition failed."));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.addEventListener("messageerror", onError);
    w.postMessage({ type: "run", id, audio });
  });
}

/** Linear resample of mic blocks to 16 kHz, carrying the read position across blocks. */
function makeResampler(inputRate: number) {
  const step = inputRate / RATE;
  let position = 0;
  return (input: Float32Array) => {
    const out: number[] = [];
    while (position < input.length) {
      const index = Math.floor(position);
      const frac = position - index;
      const a = input[index];
      const b = index + 1 < input.length ? input[index + 1] : a;
      out.push(a + (b - a) * frac);
      position += step;
    }
    position -= input.length;
    return Float32Array.from(out);
  };
}

function join(a: string, b: string) {
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}

/** A phrase read while a word is still being spoken can loop ("move the woo the woo"): keep one. */
function dropTrailingRepeats(text: string) {
  const words = text.split(" ");
  for (let size = 1; size <= 4; size++) {
    while (
      words.length >= size * 2 &&
      words.slice(-size).join(" ").toLowerCase() ===
        words
          .slice(-size * 2, -size)
          .join(" ")
          .toLowerCase()
    ) {
      words.splice(-size);
    }
  }
  return words.join(" ");
}

/** The quietest 100 ms in the last few seconds: the safest place to end a phrase. */
function quietestSplit(audio: Float32Array) {
  const window = RATE / 10;
  let best = audio.length;
  let bestEnergy = Infinity;
  for (
    let start = Math.max(0, audio.length - SPLIT_SEARCH);
    start + window <= audio.length;
    start += window / 2
  ) {
    let energy = 0;
    for (let i = start; i < start + window; i++) energy += audio[i] * audio[i];
    if (energy < bestEnergy) {
      bestEnergy = energy;
      best = start + window / 2;
    }
  }
  return best;
}

interface Session {
  stream: MediaStream;
  context: AudioContext;
  chunks: Float32Array[];
  length: number;
  /** Samples of the current phrase already read by the model. */
  readLength: number;
  committed: string;
  partial: string;
  busy: Promise<void> | null;
  stopped: boolean;
  ready: boolean;
  initializing: Promise<void>;
  emit(text: string): void;
  fail(error: unknown): void;
}

function segment(s: Session) {
  const audio = new Float32Array(s.length);
  let offset = 0;
  for (const chunk of s.chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }
  return audio;
}

/** Read the phrase again when enough new audio came in and the model is free. */
function pump(s: Session) {
  if (s.stopped || !s.ready || s.busy) return;
  if (s.length - s.readLength < PARTIAL_EVERY) return;
  let audio = segment(s);
  let finishing = false;
  if (audio.length > SEGMENT_MAX) {
    // Close this phrase at a pause and keep reading the rest as a new one.
    const split = quietestSplit(audio.subarray(0, SEGMENT_MAX));
    const rest = audio.slice(split);
    audio = audio.slice(0, split);
    s.chunks = [rest];
    s.length = rest.length;
    s.readLength = 0;
    finishing = true;
  } else {
    s.readLength = audio.length;
  }
  s.busy = recognize(audio)
    .then((text) => {
      if (finishing) {
        s.committed = join(s.committed, text);
        s.partial = "";
      } else {
        s.partial = dropTrailingRepeats(text);
      }
      if (!s.stopped) s.emit(join(s.committed, s.partial));
    })
    .catch((error: unknown) => s.fail(error))
    .finally(() => {
      s.busy = null;
      pump(s);
    });
}

export function useDictation({
  onText,
  onError,
  enabled = true,
}: {
  /** The words so far (`final` once the phrase is done); replaces what the last call sent. */
  onText(text: string, final: boolean): void;
  onError(error: unknown): void;
  enabled?: boolean;
}) {
  const [state, setState] = useState<DictationState>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (enabled !== wasEnabled) {
    setWasEnabled(enabled);
    setState("idle");
    setProgress(null);
  }
  const callbacks = useRef({ onText, onError });
  useEffect(() => {
    callbacks.current = { onText, onError };
  });

  const session = useRef<Session | null>(null);
  // Exists before the permission prompt resolves. Stop/close can cancel it safely.
  const attempt = useRef<object | null>(null);

  const cancel = useCallback(() => {
    if (attempt.current) activeSessions.delete(attempt.current);
    attempt.current = null;
    const s = session.current;
    session.current = null;
    if (s) {
      s.stopped = true;
      s.stream.getTracks().forEach((track) => track.stop());
      void s.context.close().catch(() => {});
    }
    scheduleIdleTerminate();
  }, []);

  const start = useCallback(async () => {
    if (attempt.current || !enabled) return;
    const token = {};
    attempt.current = token;
    activeSessions.add(token);
    setState("loading");
    setProgress(null);
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        throw new Error(
          "Agentcut can't use the microphone. Allow it in the browser's site settings.",
        );
      }
      if (attempt.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      context = new AudioContext();
      const audioContext = context;
      const s: Session = {
        stream,
        context,
        chunks: [],
        length: 0,
        readLength: 0,
        committed: "",
        partial: "",
        busy: null,
        stopped: false,
        ready: false,
        initializing: Promise.resolve(),
        emit: (text) => {
          if (attempt.current === token) callbacks.current.onText(text, false);
        },
        fail: (error) => {
          if (attempt.current !== token) return;
          cancel();
          setProgress(null);
          setState("idle");
          callbacks.current.onError(error);
        },
      };
      session.current = s;
      s.initializing = (async () => {
        const url = URL.createObjectURL(
          new Blob([CAPTURE_WORKLET], { type: "text/javascript" }),
        );
        try {
          await audioContext.audioWorklet.addModule(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        if (attempt.current !== token) return;
        if (!s.stopped) {
          await audioContext.resume();
          if (attempt.current !== token || s.stopped) return;
          const source = audioContext.createMediaStreamSource(s.stream);
          const node = new AudioWorkletNode(audioContext, "agentcut-capture");
          const resample = makeResampler(audioContext.sampleRate);
          node.port.onmessage = (event: MessageEvent<Float32Array>) => {
            if (s.stopped) return;
            const block = resample(event.data);
            s.chunks.push(block);
            s.length += block.length;
            pump(s);
          };
          source.connect(node);
          // The worklet emits silence, but needs an output connection to keep processing.
          node.connect(audioContext.destination);
        }
        const { ready } = getWorker((percent) => {
          if (attempt.current === token) setProgress(percent);
        });
        if (!s.stopped) setState(modelLoaded ? "listening" : "loading");
        await ready;
        s.ready = true;
        if (attempt.current !== token) return;
        setProgress(null);
        if (!s.stopped) setState("listening");
        pump(s);
      })();
      await s.initializing;
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
      if (attempt.current !== token) return;
      cancel();
      setProgress(null);
      setState("idle");
      throw error;
    }
  }, [cancel, enabled]);

  const stop = useCallback(async () => {
    const token = attempt.current;
    const s = session.current;
    if (!s) {
      cancel();
      setState("idle");
      setProgress(null);
      return;
    }
    if (s.stopped) return;
    s.stopped = true;
    s.stream.getTracks().forEach((track) => track.stop());
    void s.context.close().catch(() => {});
    setState("finishing");
    try {
      await s.initializing;
      while (s.busy) await s.busy;
      if (attempt.current !== token) return;
      let audio = segment(s);
      let text = "";
      while (audio.length > SEGMENT_MAX) {
        const split = quietestSplit(audio.subarray(0, SEGMENT_MAX));
        text = join(text, await recognize(audio.slice(0, split)));
        if (attempt.current !== token) return;
        audio = audio.slice(split);
      }
      text = join(text, await recognize(audio));
      if (attempt.current === token)
        callbacks.current.onText(join(s.committed, text), true);
    } catch (error) {
      if (attempt.current === token) {
        callbacks.current.onText(join(s.committed, s.partial), true);
        callbacks.current.onError(error);
      }
    } finally {
      if (attempt.current === token) {
        cancel();
        setProgress(null);
        setState("idle");
      }
    }
  }, [cancel]);

  useEffect(() => cancel, [cancel, enabled]);

  return { state, progress, start, stop };
}
