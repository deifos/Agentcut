// Pure edits on layers.json used by the timeline and inspector. Every function
// returns a new StudioLayers and never mutates its input.
import type {
  AudioClip,
  CaptionsClip,
  StudioClip,
  StudioLayers,
  StudioTrack,
  TrackKind,
  VideoClip,
} from "@/lib/studio/types";

export interface ClipLocation {
  track: StudioTrack;
  trackIndex: number;
  clip: StudioClip;
  clipIndex: number;
}

export function findClip(
  layers: StudioLayers,
  clipId: string,
): ClipLocation | null {
  for (let t = 0; t < layers.tracks.length; t += 1) {
    const track = layers.tracks[t];
    const clips = track.clips as StudioClip[];
    const c = clips.findIndex((clip) => clip.id === clipId);
    if (c >= 0) return { track, trackIndex: t, clip: clips[c], clipIndex: c };
  }
  return null;
}

export function clipEnd(clip: StudioClip) {
  return clip.from + clip.duration;
}

export function layersEnd(layers: StudioLayers) {
  let end = 0;
  for (const track of layers.tracks)
    for (const clip of track.clips as StudioClip[])
      end = Math.max(end, clipEnd(clip));
  return end;
}

function allIds(layers: StudioLayers) {
  const ids = new Set<string>();
  for (const track of layers.tracks) {
    ids.add(`track:${track.id}`);
    for (const clip of track.clips as StudioClip[]) ids.add(clip.id);
  }
  return ids;
}

export function uniqueClipId(layers: StudioLayers, base: string) {
  const ids = allIds(layers);
  const clean =
    base
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "clip";
  if (!ids.has(clean)) return clean;
  for (let n = 2; ; n += 1)
    if (!ids.has(`${clean}-${n}`)) return `${clean}-${n}`;
}

export function uniqueTrackId(layers: StudioLayers, base: string) {
  const ids = new Set(layers.tracks.map((track) => track.id));
  const clean =
    base
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "track";
  if (!ids.has(clean)) return clean;
  for (let n = 2; ; n += 1)
    if (!ids.has(`${clean}-${n}`)) return `${clean}-${n}`;
}

function sortClips<T extends StudioClip>(clips: T[]): T[] {
  return [...clips].sort((a, b) => a.from - b.from);
}

function replaceTrack(
  layers: StudioLayers,
  index: number,
  track: StudioTrack,
): StudioLayers {
  const tracks = [...layers.tracks];
  tracks[index] = track;
  return { ...layers, tracks };
}

function mapClips(
  track: StudioTrack,
  fn: (clips: StudioClip[]) => StudioClip[],
): StudioTrack {
  return {
    ...track,
    clips: sortClips(fn([...(track.clips as StudioClip[])])),
  } as StudioTrack;
}

export function updateClip(
  layers: StudioLayers,
  clipId: string,
  patch: Partial<StudioClip>,
): StudioLayers {
  const location = findClip(layers, clipId);
  if (!location) return layers;
  const next = { ...location.clip, ...patch } as StudioClip;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined)
      delete (next as unknown as Record<string, unknown>)[key];
  }
  return replaceTrack(
    layers,
    location.trackIndex,
    mapClips(location.track, (clips) =>
      clips.map((clip) => (clip.id === clipId ? next : clip)),
    ),
  );
}

export function updateTrack(
  layers: StudioLayers,
  trackId: string,
  patch: Partial<Omit<StudioTrack, "clips" | "kind">>,
): StudioLayers {
  const index = layers.tracks.findIndex((track) => track.id === trackId);
  if (index < 0) return layers;
  return replaceTrack(layers, index, {
    ...layers.tracks[index],
    ...patch,
  } as StudioTrack);
}

/** Move a clip in time and optionally onto another track of the same kind. */
export function moveClip(
  layers: StudioLayers,
  clipId: string,
  from: number,
  targetTrackId?: string,
): StudioLayers {
  const location = findClip(layers, clipId);
  if (!location) return layers;
  const newFrom = Math.max(0, Math.round(from));
  const moved = { ...location.clip, from: newFrom } as StudioClip;
  const targetIndex = targetTrackId
    ? layers.tracks.findIndex((track) => track.id === targetTrackId)
    : location.trackIndex;
  if (
    targetIndex < 0 ||
    layers.tracks[targetIndex].kind !== location.track.kind ||
    targetIndex === location.trackIndex
  ) {
    return replaceTrack(
      layers,
      location.trackIndex,
      mapClips(location.track, (clips) =>
        clips.map((clip) => (clip.id === clipId ? moved : clip)),
      ),
    );
  }
  let next = replaceTrack(
    layers,
    location.trackIndex,
    mapClips(location.track, (clips) =>
      clips.filter((clip) => clip.id !== clipId),
    ),
  );
  next = replaceTrack(
    next,
    targetIndex,
    mapClips(next.tracks[targetIndex], (clips) => [...clips, moved]),
  );
  return next;
}

function hasTrimStart(kind: TrackKind) {
  return kind === "audio" || kind === "video";
}

/** Shift caption words when the clip start moves by `delta` frames (positive = later). */
function shiftCaptionWords(
  clip: CaptionsClip,
  delta: number,
  duration: number,
): CaptionsClip {
  return {
    ...clip,
    words: clip.words
      .map((word) => ({
        ...word,
        from: word.from - delta,
        to: word.to - delta,
      }))
      .filter((word) => word.to > 0 && word.from < duration)
      .map((word) => ({
        ...word,
        from: Math.max(0, word.from),
        to: Math.min(duration, word.to),
      })),
  };
}

/** Drag a clip edge to `frame` (timeline frame). Keeps at least 1 frame. */
export function trimClip(
  layers: StudioLayers,
  clipId: string,
  edge: "start" | "end",
  frame: number,
): StudioLayers {
  const location = findClip(layers, clipId);
  if (!location) return layers;
  const { clip, track } = location;
  const end = clipEnd(clip);
  let next: StudioClip;
  if (edge === "end") {
    const newEnd = Math.max(clip.from + 1, Math.round(frame));
    next = { ...clip, duration: newEnd - clip.from } as StudioClip;
    if (track.kind === "captions")
      next = shiftCaptionWords(next as CaptionsClip, 0, next.duration);
  } else {
    let newFrom = Math.min(end - 1, Math.max(0, Math.round(frame)));
    if (hasTrimStart(track.kind)) {
      // Can't reveal media before its first frame.
      const trimStart = (clip as AudioClip | VideoClip).trimStart ?? 0;
      const rate = (clip as AudioClip | VideoClip).playbackRate ?? 1;
      newFrom = Math.max(newFrom, clip.from - Math.floor(trimStart / rate));
    }
    const delta = newFrom - clip.from;
    next = { ...clip, from: newFrom, duration: end - newFrom } as StudioClip;
    if (hasTrimStart(track.kind)) {
      const rate = (clip as AudioClip | VideoClip).playbackRate ?? 1;
      const trimStart = Math.max(
        0,
        Math.round(
          ((clip as AudioClip | VideoClip).trimStart ?? 0) + delta * rate,
        ),
      );
      (next as AudioClip | VideoClip).trimStart = trimStart || undefined;
      if (!trimStart) delete (next as AudioClip).trimStart;
    }
    if (track.kind === "captions")
      next = shiftCaptionWords(next as CaptionsClip, delta, next.duration);
  }
  return replaceTrack(
    layers,
    location.trackIndex,
    mapClips(track, (clips) =>
      clips.map((candidate) => (candidate.id === clipId ? next : candidate)),
    ),
  );
}

/** Kinds whose clips play back-to-back, so lengthening one should push the rest ("magnetic"). */
export function isRippleTrack(kind: TrackKind) {
  return kind === "scene";
}

/** Clips that only stretch (never media with a fixed length): full-length backgrounds, captions, text. */
const STRETCHABLE: TrackKind[] = ["scene", "text", "captions", "image"];

/**
 * Ripple trim: move a clip's end to `frame` and shift everything that starts at or after its old
 * end, on every track (plus markers), by the same amount, so voiceover and sound effects stay with
 * their scenes. Clips that span the cut and run to the end of the video (a background, captions)
 * stretch with it. Returns the change in length so the caller can resize the project.
 */
export function rippleTrimEnd(
  layers: StudioLayers,
  clipId: string,
  frame: number,
  projectEnd: number,
): { layers: StudioLayers; delta: number } {
  const location = findClip(layers, clipId);
  if (!location) return { layers, delta: 0 };
  const oldEnd = clipEnd(location.clip);
  const newEnd = Math.max(location.clip.from + 1, Math.round(frame));
  const delta = newEnd - oldEnd;
  if (delta === 0) return { layers, delta: 0 };
  const trimmed = trimClip(layers, clipId, "end", newEnd);
  const reachesEnd = (clip: StudioClip) => clipEnd(clip) >= projectEnd - 1;
  const tracks = trimmed.tracks.map((track) =>
    mapClips(track, (clips) =>
      clips.map((clip) => {
        if (clip.id === clipId) return clip;
        if (clip.from >= oldEnd)
          return {
            ...clip,
            from: Math.max(0, clip.from + delta),
          } as StudioClip;
        // Spans the edit point: stretch it only if it's a full-length layer that can stretch.
        if (
          clipEnd(clip) > oldEnd &&
          reachesEnd(clip) &&
          STRETCHABLE.includes(track.kind)
        ) {
          const next = {
            ...clip,
            duration: Math.max(1, clip.duration + delta),
          } as StudioClip;
          if (track.kind !== "captions") return next;
          // Words after the edit point move with the voice they were timed to.
          const cut = oldEnd - clip.from;
          const captions = next as CaptionsClip;
          return {
            ...captions,
            words: captions.words.map((word) =>
              word.from >= cut
                ? { ...word, from: word.from + delta, to: word.to + delta }
                : word,
            ),
          } as StudioClip;
        }
        return clip;
      }),
    ),
  );
  const markers = trimmed.markers.map((marker) =>
    marker.frame >= oldEnd
      ? { ...marker, frame: Math.max(0, marker.frame + delta) }
      : marker,
  );
  return { layers: { ...trimmed, tracks, markers }, delta };
}

/** Split a clip at a timeline frame into two clips. */
export function splitClip(
  layers: StudioLayers,
  clipId: string,
  at: number,
): { layers: StudioLayers; newId: string | null } {
  const location = findClip(layers, clipId);
  if (!location) return { layers, newId: null };
  const { clip, track } = location;
  const cut = Math.round(at);
  if (cut <= clip.from || cut >= clipEnd(clip)) return { layers, newId: null };
  const offset = cut - clip.from;
  const newId = uniqueClipId(layers, `${clip.id}-b`);
  let first = { ...clip, duration: offset } as StudioClip;
  let second = {
    ...clip,
    id: newId,
    from: cut,
    duration: clip.duration - offset,
  } as StudioClip;
  delete (first as { exit?: unknown }).exit;
  delete (second as { enter?: unknown }).enter;
  if (clip.name) second.name = `${clip.name} (2)`;
  if (hasTrimStart(track.kind)) {
    (second as AudioClip).trimStart = Math.round(
      ((clip as AudioClip).trimStart ?? 0) +
        offset * ((clip as AudioClip).playbackRate ?? 1),
    );
    if ((clip as AudioClip).fadeOut) delete (first as AudioClip).fadeOut;
    if ((clip as AudioClip).fadeIn) delete (second as AudioClip).fadeIn;
  }
  if (track.kind === "captions") {
    first = shiftCaptionWords(first as CaptionsClip, 0, first.duration);
    second = shiftCaptionWords(second as CaptionsClip, offset, second.duration);
  }
  const next = replaceTrack(
    layers,
    location.trackIndex,
    mapClips(track, (clips) =>
      clips.flatMap((candidate) =>
        candidate.id === clipId ? [first, second] : [candidate],
      ),
    ),
  );
  return { layers: next, newId };
}

export function deleteClips(
  layers: StudioLayers,
  clipIds: string[],
): StudioLayers {
  const ids = new Set(clipIds);
  return {
    ...layers,
    tracks: layers.tracks.map((track) =>
      (track.clips as StudioClip[]).some((clip) => ids.has(clip.id))
        ? ({
            ...track,
            clips: (track.clips as StudioClip[]).filter(
              (clip) => !ids.has(clip.id),
            ),
          } as StudioTrack)
        : track,
    ),
  };
}

export function duplicateClip(
  layers: StudioLayers,
  clipId: string,
): { layers: StudioLayers; newId: string | null } {
  const location = findClip(layers, clipId);
  if (!location) return { layers, newId: null };
  const newId = uniqueClipId(layers, `${location.clip.id}-copy`);
  const copy = {
    ...structuredClone(location.clip),
    id: newId,
    from: clipEnd(location.clip),
  } as StudioClip;
  if (copy.name) copy.name = `${copy.name} copy`;
  return {
    layers: replaceTrack(
      layers,
      location.trackIndex,
      mapClips(location.track, (clips) => [...clips, copy]),
    ),
    newId,
  };
}

const DEFAULT_TRACK_NAMES: Record<TrackKind, string> = {
  scene: "Scenes",
  video: "Video",
  image: "Images",
  text: "Text",
  captions: "Captions",
  audio: "Audio",
};

/** Add a track of `kind`. Visual tracks go on top, audio tracks at the bottom. */
export function addTrack(
  layers: StudioLayers,
  kind: TrackKind,
  name?: string,
): { layers: StudioLayers; trackId: string } {
  const trackId = uniqueTrackId(
    layers,
    (name ?? DEFAULT_TRACK_NAMES[kind]).toLowerCase(),
  );
  const track = {
    id: trackId,
    name: name ?? DEFAULT_TRACK_NAMES[kind],
    kind,
    clips: [],
  } as StudioTrack;
  const tracks =
    kind === "audio" ? [...layers.tracks, track] : [track, ...layers.tracks];
  return { layers: { ...layers, tracks }, trackId };
}

function fitsOnTrack(track: StudioTrack, from: number, duration: number) {
  if (track.kind === "scene" || track.kind === "audio") return true;
  return !(track.clips as StudioClip[]).some(
    (clip) => clip.from < from + duration && from < clipEnd(clip),
  );
}

/** Add a clip to the first track of its kind where it fits (creates a track when needed). */
export function addClip(
  layers: StudioLayers,
  kind: TrackKind,
  clip: StudioClip,
  options: { trackId?: string; trackName?: string } = {},
): { layers: StudioLayers; trackId: string } {
  let next = layers;
  let index = options.trackId
    ? next.tracks.findIndex(
        (track) => track.id === options.trackId && track.kind === kind,
      )
    : -1;
  if (index < 0)
    index = next.tracks.findIndex(
      (track) =>
        track.kind === kind && fitsOnTrack(track, clip.from, clip.duration),
    );
  if (index < 0) {
    const added = addTrack(next, kind, options.trackName);
    next = added.layers;
    index = next.tracks.findIndex((track) => track.id === added.trackId);
  }
  next = replaceTrack(
    next,
    index,
    mapClips(next.tracks[index], (clips) => [...clips, clip]),
  );
  return { layers: next, trackId: next.tracks[index].id };
}

export function moveTrack(
  layers: StudioLayers,
  trackId: string,
  direction: -1 | 1,
): StudioLayers {
  const index = layers.tracks.findIndex((track) => track.id === trackId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= layers.tracks.length) return layers;
  const tracks = [...layers.tracks];
  [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
  return { ...layers, tracks };
}

export function deleteTrack(
  layers: StudioLayers,
  trackId: string,
): StudioLayers {
  return {
    ...layers,
    tracks: layers.tracks.filter((track) => track.id !== trackId),
  };
}

/** Snap candidates: playhead, clip edges (except the moving clip), markers, 0. */
export function snapPoints(
  layers: StudioLayers,
  excludeClipIds: Set<string>,
  playhead: number,
) {
  const points = new Set<number>([0, playhead]);
  for (const track of layers.tracks) {
    for (const clip of track.clips as StudioClip[]) {
      if (excludeClipIds.has(clip.id)) continue;
      points.add(clip.from);
      points.add(clipEnd(clip));
    }
  }
  for (const marker of layers.markers) points.add(marker.frame);
  return [...points].sort((a, b) => a - b);
}

export function snapFrame(frame: number, points: number[], threshold: number) {
  let best = frame;
  let bestDistance = threshold + 1;
  for (const point of points) {
    const distance = Math.abs(point - frame);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }
  return bestDistance <= threshold ? best : frame;
}
