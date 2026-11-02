import { useSyncExternalStore } from "react";

/** Tiny external store for the playhead so 30fps updates don't re-render the whole studio. */
export interface FrameStore {
  get(): number;
  set(frame: number): void;
  subscribe(listener: () => void): () => void;
  /** A drag owns the playhead: the player's own frame events mustn't pull it back to a frame still drawing. */
  scrubbing: boolean;
}

export function createFrameStore(initial = 0): FrameStore {
  let frame = initial;
  const listeners = new Set<() => void>();
  return {
    scrubbing: false,
    get: () => frame,
    set(next) {
      if (next === frame) return;
      frame = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useFrame(store: FrameStore) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
