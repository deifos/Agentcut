// Moving and resizing clips by hand on the preview. Boxes are frame fractions (0…1), like `clip.box`.

import { findClip, updateClip } from "@/lib/studio/edit";
import type { Box, ClipTransform, StudioClip, StudioLayers, TrackKind } from "@/lib/studio/types";

export type TransformHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

/** Where a text clip sits when it has no box (the runtime's default). */
export const DEFAULT_TEXT_BOX: Box = { x: 0.05, y: 0.4, width: 0.9, height: 0.2 };
export const FULL_BOX: Box = { x: 0, y: 0, width: 1, height: 1 };
const MIN_SIZE = 0.02;

type Variants = Record<string, Partial<StudioClip>>;

function variantsOf(clip: StudioClip): Variants {
  return (clip as { variants?: Variants }).variants ?? {};
}

/** The clip as this variant draws it. */
export function viewClip<T extends StudioClip>(clip: T, variant: string): T {
  const override = variantsOf(clip)[variant];
  return override ? ({ ...clip, ...override } as T) : clip;
}

export function isBoxKind(kind: TrackKind): kind is "text" | "image" | "video" {
  return kind === "text" || kind === "image" || kind === "video";
}

/** The box a clip is drawn in, or null for clips that have none (scenes, captions, audio…). */
export function clipBox(kind: TrackKind, clip: StudioClip): Box | null {
  if (!isBoxKind(kind)) return null;
  const box = (clip as { box?: Box }).box;
  return box ?? (kind === "text" ? DEFAULT_TEXT_BOX : FULL_BOX);
}

export function boxContains(box: Box, x: number, y: number) {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

function roundBox(box: Box): Box {
  return { x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) };
}

/**
 * The box after dragging a handle by dx/dy (frame fractions). `keepRatio` makes corners scale the
 * box evenly. `scale` is how much the box grew (1 unless the ratio was kept).
 */
export function dragBox(
  start: Box,
  handle: TransformHandle,
  dx: number,
  dy: number,
  keepRatio = false,
): { box: Box; scale: number } {
  if (handle === "move") {
    return { box: roundBox({ ...start, x: start.x + dx, y: start.y + dy }), scale: 1 };
  }
  const west = handle.includes("w");
  const east = handle.includes("e");
  const north = handle.includes("n");
  const south = handle.includes("s");
  let width = start.width + (east ? dx : west ? -dx : 0);
  let height = start.height + (south ? dy : north ? -dy : 0);
  let scale = 1;
  if (keepRatio && handle.length === 2) {
    // Follow whichever axis the pointer pulled furthest.
    scale = Math.max(
      width / start.width,
      height / start.height,
      MIN_SIZE / start.width,
      MIN_SIZE / start.height,
    );
    width = start.width * scale;
    height = start.height * scale;
  } else {
    width = Math.max(MIN_SIZE, width);
    height = Math.max(MIN_SIZE, height);
  }
  // The opposite edge stays where it was.
  const x = west ? start.x + start.width - width : start.x;
  const y = north ? start.y + start.height - height : start.y;
  return { box: roundBox({ x, y, width, height }), scale };
}

export interface SnapGuides {
  /** Frame fractions of the lines the box snapped to. */
  x?: number;
  y?: number;
}

function snapAxis(start: number, size: number, threshold: number) {
  let best: { delta: number; guide: number } | null = null;
  const candidates: [number, number][] = [
    [start, 0],
    [start + size / 2, 0.5],
    [start + size, 1],
  ];
  for (const [value, guide] of candidates) {
    const delta = guide - value;
    if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta)))
      best = { delta, guide };
  }
  return best;
}

/** Pull a moved box onto the frame's edges and centre lines when it is within the threshold. */
export function snapMove(
  box: Box,
  thresholdX: number,
  thresholdY: number,
): { box: Box; guides: SnapGuides } {
  const x = snapAxis(box.x, box.width, thresholdX);
  const y = snapAxis(box.y, box.height, thresholdY);
  return {
    box: roundBox({ ...box, x: box.x + (x?.delta ?? 0), y: box.y + (y?.delta ?? 0) }),
    guides: { x: x?.guide, y: y?.guide },
  };
}

/**
 * Save fields on a clip. With `perVariant`, a variant other than the default keeps them as its own
 * override, so a phone layout can differ from the wide one. An override that already sets one of
 * the fields always gets them, or the change wouldn't show.
 */
export function patchClipForVariant(
  layers: StudioLayers,
  clipId: string,
  fields: Partial<StudioClip>,
  variant: string,
  defaultVariant: string,
  perVariant = true,
): StudioLayers {
  const location = findClip(layers, clipId);
  if (!location) return layers;
  const variants = variantsOf(location.clip);
  const override = variants[variant];
  const overridden = override ? Object.keys(fields).some((key) => key in override) : false;
  if (!overridden && !(perVariant && variant !== defaultVariant))
    return updateClip(layers, clipId, fields);
  return updateClip(layers, clipId, {
    variants: { ...variants, [variant]: { ...(override ?? {}), ...fields } },
  } as Partial<StudioClip>);
}

// ---------------------------------------------------------------------------
// Scenes and components: they fill the frame, so they are moved and scaled as a whole (`clip.transform`).

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;

/**
 * The transform that takes what a scene draws from one rectangle to another (frame fractions),
 * given the transform it had while it was measured at `from`. Scale is about the frame's centre.
 */
export function transformForRect(
  start: ClipTransform | undefined,
  from: Box,
  to: Box,
): ClipTransform | undefined {
  const startScale = start?.scale ?? 1;
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, startScale * (from.width > 0 ? to.width / from.width : 1)),
  );
  const k = scale / startScale;
  const x = round(to.x - 0.5 - k * (from.x - 0.5 - (start?.x ?? 0)));
  const y = round(to.y - 0.5 - k * (from.y - 0.5 - (start?.y ?? 0)));
  const rounded = round(scale);
  if (!x && !y && rounded === 1) return undefined;
  return { x, y, scale: rounded };
}

export type PropPath = (string | number)[];

/** Every string inside a scene's props, with where it is. */
export function textLeaves(value: unknown, path: PropPath = []): { path: PropPath; text: string }[] {
  if (typeof value === "string") return value.trim() ? [{ path, text: value }] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => textLeaves(item, [...path, index]));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) => textLeaves(item, [...path, key]));
  return [];
}

/** A copy of `value` with the entry at `path` replaced. */
export function setAtPath<T>(value: T, path: PropPath, next: unknown): T {
  if (path.length === 0) return next as T;
  const [key, ...rest] = path;
  if (Array.isArray(value)) {
    const copy = [...value];
    copy[key as number] = setAtPath(copy[key as number], rest, next);
    return copy as T;
  }
  const record = (value ?? {}) as Record<string, unknown>;
  return { ...record, [key]: setAtPath(record[key as string], rest, next) } as T;
}

/** Text as it compares between a prop and the page: no *accent stars*, spacing or case. */
function plain(text: string) {
  return text.replace(/\*/g, "").replace(/\s+/g, "").toLowerCase();
}

/**
 * The prop that holds the text the user double-clicked. `shown` is the text of the element under
 * the pointer, then of each element around it: scenes often split a line into a span per word.
 * `level` is which of them matched.
 */
export function matchTextLeaf(
  leaves: { path: PropPath; text: string }[],
  shown: string[],
): { path: PropPath; text: string; level: number } | null {
  const keyed = leaves.map((leaf) => ({ ...leaf, key: plain(leaf.text) })).filter((leaf) => leaf.key);
  for (let level = 0; level < shown.length; level += 1) {
    const key = plain(shown[level]);
    if (!key) continue;
    const exact = keyed.find((leaf) => leaf.key === key);
    if (exact) return { path: exact.path, text: exact.text, level };
  }
  // A single word, or a line still being typed on: the shortest prop it is part of.
  const word = plain(shown[0] ?? "");
  if (word.length < 2) return null;
  const within = keyed
    .filter((leaf) => leaf.key.includes(word))
    .sort((a, b) => a.key.length - b.key.length)[0];
  return within ? { path: within.path, text: within.text, level: 0 } : null;
}
