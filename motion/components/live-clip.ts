// Edits in progress. While a slider moves, its value goes straight to the one clip it changes, so only
// that clip redraws: nothing else in the studio re-renders until the edit is saved on release.
// Renders (captures and exports) never read this, so they only ever draw what's saved.
import { useMemo, useSyncExternalStore } from "react";

type Fields = Record<string, unknown>;

/** Key for the whole-video grade, which isn't a clip. */
export const LIVE_PROJECT = "project";

const live = new Map<string, Fields>();
const clearing = new Set<string>();
const listeners = new Set<() => void>();
let scheduled = false;

function flush() {
  scheduled = false;
  for (const id of clearing) live.delete(id);
  clearing.clear();
  for (const listener of listeners) listener();
}

/** At most one redraw per display frame, however fast the pointer reports. */
function schedule() {
  if (scheduled) return;
  scheduled = true;
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(flush);
  else flush();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLiveClip(id: string, fields: Fields) {
  clearing.delete(id);
  live.set(id, { ...live.get(id), ...fields });
  schedule();
}

/** The edit is over. Takes effect on the next frame, after the saved value has reached the clip. */
export function clearLiveClip(id: string) {
  if (!live.has(id)) return;
  clearing.add(id);
  schedule();
}

/** Fields being edited on this clip, or undefined. */
export function getLiveClip(id: string): Fields | undefined {
  return live.get(id);
}

const none = () => undefined;

/** `clip` with any edit in progress on top. Re-renders only when this clip's own edit changes. */
export function useLiveClip<T extends { id: string }>(clip: T, isRendering = false): T {
  const id = clip.id;
  const snapshot = isRendering ? none : () => live.get(id);
  const fields = useSyncExternalStore(subscribe, snapshot, none);
  return useMemo(() => (fields ? { ...clip, ...fields } : clip), [clip, fields]);
}

/** Re-render when any of these edits change (a clip following adjustment layers and the project grade). */
export function useLiveClips(ids: string[], isRendering = false) {
  const snapshot = () => {
    if (isRendering) return "";
    let key = "";
    for (const id of ids) if (live.has(id)) key += `${id}:${JSON.stringify(live.get(id))};`;
    return key;
  };
  useSyncExternalStore(subscribe, snapshot, () => "");
}
