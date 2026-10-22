// Main-thread client for models.worker.ts + embedding helpers that mirror
// earshot's windowing (earshot/vocab.py, earshot/models/clap.py).
import { decodeAudioUrl } from "@/lib/studio/audio/decode";
import { resampleLinear } from "@/lib/studio/listen/dsp";
import vocabData from "@/lib/studio/listen/data/vocab.json";
import vocabStats from "@/lib/studio/listen/data/vocab-stats.json";

export const DIM = 512;
const SR = 48_000;
const WIN_S = 10;
const HOP_S = 5;
const MAX_WIN = 6;

/** The CLAP/AST weights stay resident while the worker lives; drop them after this long idle. */
const IDLE_TERMINATE_MS = 3 * 60 * 1000;

let worker: Worker | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let counter = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const progressListeners = new Set<(info: { model: string; progress?: number; file?: string }) => void>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./models.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type: string; id?: number; result?: unknown; error?: string; model?: string; progress?: number; file?: string };
    if (data.type === "progress") {
      for (const listener of progressListeners) listener({ model: data.model ?? "", progress: data.progress, file: data.file });
      return;
    }
    if (data.id === undefined) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.type === "error") entry.reject(new Error(data.error ?? "Model error"));
    else entry.resolve(data.result);
  });
  worker.addEventListener("error", (event) => {
    for (const [, entry] of pending) entry.reject(new Error(event.message || "Listening worker crashed."));
    pending.clear();
    worker = null;
  });
  return worker;
}

function scheduleIdleTerminate() {
  if (pending.size > 0) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (pending.size > 0) return;
    worker?.terminate();
    worker = null;
  }, IDLE_TERMINATE_MS);
}

function request<T>(type: string, payload: unknown, transfer: Transferable[] = []): Promise<T> {
  const id = ++counter;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const promise = new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    getWorker().postMessage({ id, type, payload }, transfer);
  });
  return promise.finally(scheduleIdleTerminate);
}

export function onModelProgress(listener: (info: { model: string; progress?: number; file?: string }) => void) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

export function modelInfo() {
  return request<{ device: string; dtype: string }>("info", null);
}

// ---------------------------------------------------------------------------
// Vectors

export function dot(a: Float32Array, aOffset: number, b: Float32Array, bOffset: number) {
  let s = 0;
  for (let i = 0; i < DIM; i += 1) s += a[aOffset + i] * b[bOffset + i];
  return s;
}

export function normalize(v: Float32Array) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) + 1e-12;
  return v.map((x) => x / n);
}

export function row(matrix: Float32Array, index: number) {
  return matrix.subarray(index * DIM, (index + 1) * DIM);
}

// ---------------------------------------------------------------------------
// Text: phrase × prompt templates, averaged (earshot Vocab.embed_text)

const textCache = new Map<string, Float32Array>();

export async function embedPhrases(phrases: string[]): Promise<Float32Array> {
  const templates: string[] = vocabStats.templates;
  const todo = phrases.filter((p) => !textCache.has(p));
  if (todo.length) {
    const texts = todo.flatMap((phrase) => templates.map((t) => t.replace("{}", phrase)));
    const raw = await request<Float32Array>("text", texts);
    todo.forEach((phrase, i) => {
      const avg = new Float32Array(DIM);
      for (let t = 0; t < templates.length; t += 1) {
        const offset = (i * templates.length + t) * DIM;
        for (let d = 0; d < DIM; d += 1) avg[d] += raw[offset + d];
      }
      textCache.set(phrase, normalize(avg));
    });
  }
  const out = new Float32Array(phrases.length * DIM);
  phrases.forEach((phrase, i) => out.set(textCache.get(phrase)!, i * DIM));
  return out;
}

/** Plain text embeddings (no templates), for realness prompts. */
export async function embedRawTexts(texts: string[]): Promise<Float32Array> {
  return request<Float32Array>("text", texts);
}

// Vocabulary embeddings are big to compute (322 terms × 5 templates); cache them in IndexedDB.
const VOCAB_DB = "agentcut-listen";
const VOCAB_KEY = `vocab-v1-${vocabStats.model}-${vocabStats.templates.length}`;

function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(VOCAB_DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("cache");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await idb();
  if (!db) return null;
  return new Promise((resolve) => {
    const req = db.transaction("cache", "readonly").objectStore("cache").get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key: string, value: unknown) {
  const db = await idb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction("cache", "readwrite");
    tx.objectStore("cache").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export interface Vocab {
  names: string[];
  categoryOf: Map<string, string>;
  E: Float32Array; // (T, 512)
  m: Float32Array; // reference mean embedding
  muE: Float32Array; // (T,) term bias = E · m
}

let vocabPromise: Promise<Vocab> | null = null;

export function getVocab(): Promise<Vocab> {
  vocabPromise ??= (async () => {
    const categories = vocabData.categories as Record<string, string[]>;
    const names = Object.values(categories).flat();
    const categoryOf = new Map<string, string>();
    for (const [category, terms] of Object.entries(categories)) for (const term of terms) categoryOf.set(term, category);
    let E: Float32Array | null = null;
    const cached = (await idbGet(VOCAB_KEY)) as { names: string[]; data: Float32Array } | null;
    if (cached && cached.names?.length === names.length && cached.names.every((n, i) => n === names[i])) {
      E = cached.data;
    } else {
      E = await embedPhrases(names);
      await idbSet(VOCAB_KEY, { names, data: E });
    }
    const m = Float32Array.from(vocabStats.mean);
    const muE = new Float32Array(names.length);
    for (let t = 0; t < names.length; t += 1) muE[t] = dot(E, t * DIM, m, 0);
    return { names, categoryOf, E, m, muE };
  })();
  vocabPromise.catch(() => (vocabPromise = null));
  return vocabPromise;
}

// ---------------------------------------------------------------------------
// Audio

export interface LoadedAudio {
  mono48: Float32Array;
  seconds: number;
  buffer: AudioBuffer;
}

export async function loadAudio(url: string): Promise<LoadedAudio> {
  const buffer = await decodeAudioUrl(url);
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  const mono48 = buffer.sampleRate === SR ? mono : resampleLinear(mono, buffer.sampleRate, SR);
  return { mono48, seconds: mono48.length / SR, buffer };
}

/** CLAP windows for [start, end): one if ≤ 10 s, else 10 s windows hop 5 s (last flush), ≤ 6 evenly spaced. */
export function clapSpans(seconds: number, maxWin = MAX_WIN): [number, number][] {
  const n = Math.round(seconds * SR);
  const w = WIN_S * SR;
  const h = HOP_S * SR;
  if (n <= w) return [[0, seconds]];
  let starts: number[] = [];
  for (let s = 0; s <= n - w; s += h) starts.push(s);
  if ((n - w) % h) starts.push(n - w);
  if (maxWin && starts.length > maxWin) {
    const picked: number[] = [];
    for (let i = 0; i < maxWin; i += 1) picked.push(starts[Math.round((i * (starts.length - 1)) / (maxWin - 1))]);
    starts = picked;
  }
  return starts.map((s) => [s / SR, (s + w) / SR]);
}

export async function embedWindows(windows: Float32Array[]): Promise<Float32Array> {
  return request<Float32Array>("audio", windows);
}

/** File embedding = mean of its CLAP windows (repeat-padded to 10 s by the processor), normalized. */
export async function embedFile(audio: LoadedAudio, maxWin = MAX_WIN): Promise<Float32Array> {
  const spans = clapSpans(audio.seconds, maxWin);
  const windows = spans.map(([a, b]) => audio.mono48.slice(Math.round(a * SR), Math.round(b * SR)));
  const E = await embedWindows(windows);
  const mean = new Float32Array(DIM);
  for (let i = 0; i < spans.length; i += 1) for (let d = 0; d < DIM; d += 1) mean[d] += E[i * DIM + d];
  return normalize(mean);
}

export async function astProbabilities(windows16k: Float32Array[]) {
  return request<{ labels: string[]; probs: Float32Array[] }>("ast", windows16k);
}

export const LOGIT_SCALE = vocabStats.logit_scale;
