// Person cutouts: a transparent video of one person that sits above a graphic on the timeline,
// with the original footage underneath. Everything here is pure; cutout.worker.ts makes the file
// and cutout-tool.ts applies it.
import { framingCropAt } from "../../packages/agentcut/template/runtime/framing";
import { findClip } from "./edit";
import type { StudioLayers, StudioTrack, VideoClip } from "./types";

/** MODNet needs sides divisible by 32. 512 keeps hair edges while staying faster than playback on WebGPU. */
export const MATTE_LONG_SIDE = 512;
const MATTE_MULTIPLE = 32;
/** The cutout lies directly on its source, so stay sharp up to full HD. */
export const CUTOUT_LONG_SIDE = 1920;
/** A person takes more of the picture than this on a usable frame. */
const PERSON_MIN_COVERAGE = 0.01;
const SMOOTHING = 0.6;

export function matteSize(width: number, height: number) {
  const scale = MATTE_LONG_SIDE / Math.max(width, height);
  const side = (value: number) =>
    Math.max(
      MATTE_MULTIPLE,
      Math.round((value * scale) / MATTE_MULTIPLE) * MATTE_MULTIPLE,
    );
  return { width: side(width), height: side(height) };
}

export function cutoutSize(width: number, height: number) {
  const scale = Math.min(1, CUTOUT_LONG_SIDE / Math.max(width, height));
  const even = (value: number) => Math.max(2, Math.round((value * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/**
 * Damp edge flicker between frames. The previous frame counts less where a pixel changed a lot,
 * so stable edges stay calm while moving arms follow without a ghost.
 */
export function smoothMatte(previous: Float32Array | null, current: Float32Array) {
  if (!previous || previous.length !== current.length) return current.slice();
  for (let i = 0; i < current.length; i += 1) {
    const weight = SMOOTHING * (1 - Math.min(1, Math.abs(current[i] - previous[i])));
    previous[i] = previous[i] * weight + current[i] * (1 - weight);
  }
  return previous;
}

export function matteCoverage(matte: Float32Array) {
  let sum = 0;
  for (let i = 0; i < matte.length; i += 1) sum += matte[i];
  return matte.length ? sum / matte.length : 0;
}

export function hasPerson(coverages: number[]) {
  const visible = coverages.filter((value) => value >= PERSON_MIN_COVERAGE);
  return coverages.length > 0 && visible.length / coverages.length >= 0.5;
}

export interface CutoutRange {
  from: number;
  duration: number;
  partial: boolean;
  /** Where the range starts and ends in the source file, in seconds. */
  sourceStart: number;
  sourceEnd: number;
}

/** Timeline frames → source seconds, respecting the clip's trim and speed. Null when outside the clip. */
export function cutoutRange(
  clip: VideoClip,
  fps: number,
  fromFrame = clip.from,
  durationInFrames = clip.from + clip.duration - fromFrame,
): CutoutRange | null {
  if (
    !Number.isInteger(fromFrame) ||
    !Number.isInteger(durationInFrames) ||
    durationInFrames <= 0 ||
    fromFrame < clip.from ||
    fromFrame + durationInFrames > clip.from + clip.duration
  )
    return null;
  const rate = clip.playbackRate ?? 1;
  const sourceStart =
    (clip.trimStart ?? 0) / fps + ((fromFrame - clip.from) / fps) * rate;
  return {
    from: fromFrame,
    duration: durationInFrames,
    partial: durationInFrames !== clip.duration,
    sourceStart,
    sourceEnd: sourceStart + (durationInFrames / fps) * rate,
  };
}

/**
 * Part of a clip only lines up with its source when nothing depends on the clip's own length or
 * local frame: style camera moves and enter/exit animations do.
 */
export function rangeNeedsFullClip(
  clip: VideoClip,
  range: CutoutRange,
  hasStyle: boolean,
) {
  if (!range.partial) return false;
  if (Object.values(clip.variants ?? {}).some((overrides) =>
    rangeNeedsFullClip({ ...clip, ...overrides, variants: undefined } as VideoClip, range, hasStyle),
  )) return true;
  if (hasStyle && clip.camera !== "none") return true;
  const start = range.from - clip.from;
  const entering =
    clip.enter && clip.enter.preset !== "none" && start < clip.enter.frames;
  const exiting =
    clip.exit &&
    clip.exit.preset !== "none" &&
    start + range.duration > clip.duration - clip.exit.frames;
  return Boolean(entering || exiting);
}

/** A variant that retimes or swaps the footage would need its own cutout. */
export function retimedVariant(clip: VideoClip) {
  const fields = ["src", "from", "duration", "trimStart", "playbackRate"] as const;
  return Object.entries(clip.variants ?? {}).find(([, overrides]) =>
    fields.some((field) => overrides[field] !== undefined),
  )?.[0];
}

/** Framing paths use absolute source seconds; the cutout file starts at the range, so the path starts with the crop there. */
function shiftFraming(
  framing: NonNullable<VideoClip["framing"]>,
  sourceStart: number,
): NonNullable<VideoClip["framing"]> {
  return {
    crop: framing.crop,
    ...(framing.path
      ? {
          path: [
            { seconds: 0, crop: framingCropAt(framing, sourceStart) },
            ...framing.path
              .filter((key) => key.seconds > sourceStart)
              .map((key) => ({ ...key, seconds: key.seconds - sourceStart })),
          ],
        }
      : {}),
  };
}

export function cutoutClip(
  source: VideoClip,
  range: CutoutRange,
  src: string,
  id: string,
): VideoClip {
  const variants = Object.entries(source.variants ?? {}).map(
    ([name, overrides]) => {
      const copy = { ...overrides };
      delete copy.volume;
      delete copy.muted;
      delete copy.cursor;
      delete copy.name;
      if (range.partial) {
        delete copy.enter;
        delete copy.exit;
      }
      if (copy.framing)
        copy.framing = shiftFraming(copy.framing, range.sourceStart);
      return [name, copy] as const;
    },
  );
  return {
    id,
    name: `${source.name ?? source.id} cutout`,
    src,
    from: range.from,
    duration: range.duration,
    muted: true,
    ...(source.playbackRate !== undefined
      ? { playbackRate: source.playbackRate }
      : {}),
    ...(source.box ? { box: source.box } : {}),
    ...(source.fit ? { fit: source.fit } : {}),
    ...(source.radius !== undefined ? { radius: source.radius } : {}),
    ...(source.grade ? { grade: source.grade } : {}),
    ...(source.camera ? { camera: source.camera } : {}),
    ...(source.opacity !== undefined ? { opacity: source.opacity } : {}),
    ...(source.framing
      ? { framing: shiftFraming(source.framing, range.sourceStart) }
      : {}),
    ...(!range.partial && source.enter ? { enter: source.enter } : {}),
    ...(!range.partial && source.exit ? { exit: source.exit } : {}),
    ...(variants.length ? { variants: Object.fromEntries(variants) } : {}),
  };
}

export type CutoutPlacement =
  | { ok: true; index: number }
  | { ok: false; status: string; clipId?: string; next: string };

/** tracks[0] is the top layer: the cutout goes above the footage and the highest graphic behind the person. */
export function cutoutPlacement(
  layers: StudioLayers,
  sourceId: string,
  behind: string[] = [],
): CutoutPlacement {
  const source = findClip(layers, sourceId);
  if (!source)
    return {
      ok: false,
      status: "stale_project",
      clipId: sourceId,
      next: "The footage clip is gone. Check the timeline before retrying.",
    };
  let index = source.trackIndex;
  for (const id of behind) {
    const graphic = findClip(layers, id);
    if (!graphic)
      return {
        ok: false,
        status: "unknown_clip",
        clipId: id,
        next: "Pass the IDs of clips that exist on the timeline as behind.",
      };
    if (graphic.trackIndex >= source.trackIndex)
      return {
        ok: false,
        status: "graphic_below_footage",
        clipId: id,
        next: "Move this clip to a track above the footage first; below the footage it can't be seen.",
      };
    index = Math.min(index, graphic.trackIndex);
  }
  return { ok: true, index };
}

/** Add the cutout on its own video track. A new cutout replaces any it overlaps from the same footage. */
export function addCutoutClip(
  layers: StudioLayers,
  sourceId: string,
  clip: VideoClip,
  index: number,
): StudioLayers {
  const trackId = `cutout-${sourceId}`;
  const previous = layers.tracks.find((track) => track.id === trackId);
  const kept = ((previous?.clips ?? []) as VideoClip[]).filter(
    (other) =>
      other.from + other.duration <= clip.from ||
      other.from >= clip.from + clip.duration,
  );
  const tracks = [...layers.tracks];
  const position = Math.min(
    index,
    previous ? tracks.indexOf(previous) : index,
  );
  if (previous) tracks.splice(tracks.indexOf(previous), 1);
  const track: StudioTrack<"video"> = {
    id: trackId,
    name: "Person cutout",
    kind: "video",
    clips: [...kept, clip].sort((a, b) => a.from - b.from),
  };
  tracks.splice(position, 0, track);
  return { ...layers, tracks };
}
