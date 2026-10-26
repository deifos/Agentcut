// Main-thread client for search.worker.ts (archival b-roll search in the browser).
import { BROLL_CDN_URL, type BrollQuery, type BrollResult, type BrollShot } from "@/lib/broll";

/** The text model stays resident while the worker lives; drop it after this long idle. */
const IDLE_TERMINATE_MS = 10 * 60 * 1000;

export interface BrollSearchResult {
  total: number;
  matches: number;
  offset: number;
  /** "keywords" until the meaning model has loaded (only when not waiting for it). */
  mode: "meaning" | "keywords" | "browse";
  results: BrollResult[];
}

let worker: Worker | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let counter = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
const readyListeners = new Set<() => void>();
const progressListeners = new Set<(info: { file?: string; progress?: number }) => void>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./search.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type: string; id?: number; result?: unknown; error?: string; file?: string; progress?: number };
    if (data.type === "ready") {
      for (const listener of readyListeners) listener();
      return;
    }
    if (data.type === "progress") {
      for (const listener of progressListeners) listener({ file: data.file, progress: data.progress });
      return;
    }
    if (data.id === undefined) return;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.type === "error") entry.reject(new Error(data.error ?? "b-roll search failed"));
    else entry.resolve(data.result);
  });
  worker.addEventListener("error", (event) => {
    for (const [, entry] of pending) entry.reject(new Error(event.message || "b-roll search worker crashed."));
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

function request<T>(type: string, payload: unknown): Promise<T> {
  const id = ++counter;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    getWorker().postMessage({ id, type, base: BROLL_CDN_URL, payload });
  }).finally(scheduleIdleTerminate);
}

/**
 * Search the catalog. With `wait` the first search waits for the meaning model (a one-time ~110 MB
 * download, then cached); without it, results come from keywords until the model is ready.
 */
export function searchBroll(query: BrollQuery & { wait?: boolean }) {
  return request<BrollSearchResult>("search", query);
}

/** Catalog entries by id (null for unknown ids). */
export function brollShots(ids: string[]) {
  return request<(BrollShot | null)[]>("shots", ids);
}

/** Called when the meaning model has loaded (re-run a keyword search then). */
export function onBrollModelReady(listener: () => void) {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

export function onBrollModelProgress(listener: (info: { file?: string; progress?: number }) => void) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}
