import type {
  SilenceRegion,
  SubtitleSkippedRange,
  TimelineClip,
  TimelineClipRange,
  TimelineSourcePosition,
  VideoAsset,
} from "@/types/editor";

const SOURCE_BOUNDARY_EPSILON_SECONDS = 1e-9;

export function createTimelineClipId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createTimelineClip(
  asset: Pick<VideoAsset, "id" | "duration">,
): TimelineClip {
  return {
    id: createTimelineClipId(),
    assetId: asset.id,
    sourceStart: 0,
    sourceEnd: asset.duration,
    speed: 1,
  };
}

export function getLiveTimelineClips(clips: TimelineClip[]): TimelineClip[] {
  return clips.filter(
    (clip) =>
      !clip.deleted &&
      getTimelineClipOutputDuration(clip) > 0 &&
      (clip.speed ?? 1) > 0,
  );
}

export function shouldUseTimelineClipPipeline(
  clips: TimelineClip[] | undefined,
  assets: Pick<VideoAsset, "id" | "duration">[] | undefined,
): boolean {
  if (!clips || !assets || assets.length === 0) {
    return false;
  }

  // If the caller supplies clip-timeline state, keep the clip-backed path even
  // while clips are temporarily empty during restore/hydration. That avoids a
  // silent sourceBlob export that ignores the timeline store.
  return true;
}

export function getTimelineClipSourceDuration(clip: TimelineClip): number {
  return Math.max(0, clip.sourceEnd - clip.sourceStart);
}

type ClipSpanCache = {
  sourceStart: number;
  sourceEnd: number;
  speed: number;
  deleted: boolean;
  rawRanges: SilenceRegion[];
  rawSubtitleSkippedRanges: SubtitleSkippedRange[];
  removed: SilenceRegion[];
  kept: SilenceRegion[];
  outputDuration: number;
};

const EMPTY_SPANS: SilenceRegion[] = [];
const EMPTY_SUBTITLE_SKIPPED_RANGES: SubtitleSkippedRange[] = [];
const clipSpanCache = new WeakMap<TimelineClip, ClipSpanCache>();

function getClipSpanCache(clip: TimelineClip): ClipSpanCache {
  const sourceStart = Math.max(0, Math.min(clip.sourceStart, clip.sourceEnd));
  const sourceEnd = Math.max(clip.sourceStart, clip.sourceEnd);
  const speed = clip.speed || 1;
  const deleted = Boolean(clip.deleted);
  const rawRanges = clip.sourceRemovedRanges ?? EMPTY_SPANS;
  const rawSubtitleSkippedRanges =
    clip.subtitleSkippedRanges ?? EMPTY_SUBTITLE_SKIPPED_RANGES;
  const cached = clipSpanCache.get(clip);
  if (
    cached &&
    cached.sourceStart === sourceStart &&
    cached.sourceEnd === sourceEnd &&
    cached.speed === speed &&
    cached.deleted === deleted &&
    cached.rawRanges === rawRanges &&
    cached.rawSubtitleSkippedRanges === rawSubtitleSkippedRanges
  ) {
    return cached;
  }

  if (
    (rawRanges.length === 0 && rawSubtitleSkippedRanges.length === 0) ||
    sourceEnd <= sourceStart
  ) {
    const kept =
      sourceEnd > sourceStart
        ? [{ startTime: sourceStart, endTime: sourceEnd }]
        : EMPTY_SPANS;
    const next: ClipSpanCache = {
      sourceStart,
      sourceEnd,
      speed,
      deleted,
      rawRanges,
      rawSubtitleSkippedRanges,
      removed: EMPTY_SPANS,
      kept,
      outputDuration:
        deleted || sourceEnd <= sourceStart
          ? 0
          : (sourceEnd - sourceStart) / speed,
    };
    clipSpanCache.set(clip, next);
    return next;
  }

  const sorted = [...rawRanges, ...rawSubtitleSkippedRanges]
    .map((range) => ({
      startTime: Math.max(sourceStart, Math.min(sourceEnd, range.startTime)),
      endTime: Math.max(sourceStart, Math.min(sourceEnd, range.endTime)),
    }))
    .filter((range) => range.endTime > range.startTime)
    .sort((a, b) => a.startTime - b.startTime);

  const removed: SilenceRegion[] = [];
  for (const range of sorted) {
    const previous = removed[removed.length - 1];
    if (previous && range.startTime <= previous.endTime + 0.001) {
      previous.endTime = Math.max(previous.endTime, range.endTime);
    } else {
      removed.push({ ...range });
    }
  }

  const kept: SilenceRegion[] = [];
  let cursor = sourceStart;
  for (const range of removed) {
    if (range.startTime > cursor) {
      kept.push({ startTime: cursor, endTime: range.startTime });
    }
    cursor = Math.max(cursor, range.endTime);
  }
  if (cursor < sourceEnd) {
    kept.push({ startTime: cursor, endTime: sourceEnd });
  }

  const keptSourceDuration = kept.reduce(
    (total, span) => total + Math.max(0, span.endTime - span.startTime),
    0,
  );
  const next: ClipSpanCache = {
    sourceStart,
    sourceEnd,
    speed,
    deleted,
    rawRanges,
    rawSubtitleSkippedRanges,
    removed,
    kept,
    outputDuration: deleted ? 0 : keptSourceDuration / speed,
  };
  clipSpanCache.set(clip, next);
  return next;
}

export function getTimelineClipSourceRemovedRanges(
  clip: TimelineClip,
): SilenceRegion[] {
  return getClipSpanCache(clip).removed;
}

export function getTimelineClipKeptSourceSpans(
  clip: TimelineClip,
): SilenceRegion[] {
  return getClipSpanCache(clip).kept;
}

export function getFirstPlayableClipSourceTime(
  clip: TimelineClip,
): number | null {
  return getTimelineClipKeptSourceSpans(clip)[0]?.startTime ?? null;
}

export function getLastPlayableClipSourceTime(
  clip: TimelineClip,
): number | null {
  const spans = getTimelineClipKeptSourceSpans(clip);
  return spans[spans.length - 1]?.endTime ?? null;
}

export function getClipSourceTimeAtTimelineOffset(
  clip: TimelineClip,
  timelineOffset: number,
): number {
  const speed = clip.speed || 1;
  const sourceOffset = Math.max(0, timelineOffset * speed);
  let remaining = sourceOffset;
  const spans = getTimelineClipKeptSourceSpans(clip);

  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index];
    const spanDuration = span.endTime - span.startTime;
    // Timeline offsets at a removed-range seam are built by summing decimal
    // source durations. Tiny floating-point underflow can therefore make an
    // exact seam look fractionally smaller than the preceding kept span. In
    // that case, advance to the next kept span instead of replaying the audio
    // that was removed between them.
    if (
      remaining < spanDuration - SOURCE_BOUNDARY_EPSILON_SECONDS ||
      index === spans.length - 1
    ) {
      return Math.min(span.endTime, span.startTime + remaining);
    }
    remaining = Math.max(0, remaining - spanDuration);
  }

  return spans[spans.length - 1]?.endTime ?? clip.sourceStart;
}

export function getTimelineOffsetForClipSourceTime(
  clip: TimelineClip,
  sourceTime: number,
): number {
  const speed = clip.speed || 1;
  const clampedSourceTime = Math.max(
    clip.sourceStart,
    Math.min(sourceTime, clip.sourceEnd),
  );
  let keptSourceDuration = 0;

  for (const span of getTimelineClipKeptSourceSpans(clip)) {
    if (clampedSourceTime < span.startTime) {
      return keptSourceDuration / speed;
    }

    if (clampedSourceTime <= span.endTime) {
      return (keptSourceDuration + clampedSourceTime - span.startTime) / speed;
    }

    keptSourceDuration += span.endTime - span.startTime;
  }

  return keptSourceDuration / speed;
}

export function getSourceRemovedRangeAtTime(
  clip: TimelineClip,
  sourceTime: number,
  epsilon = 0,
): SilenceRegion | null {
  return (
    getTimelineClipSourceRemovedRanges(clip).find(
      (range) =>
        sourceTime >= range.startTime - epsilon &&
        sourceTime < range.endTime - epsilon,
    ) ?? null
  );
}

export function getTimelineClipOutputDuration(clip: TimelineClip): number {
  return getClipSpanCache(clip).outputDuration;
}

export function getTimelineDuration(clips: TimelineClip[]): number {
  return clips.reduce(
    (total, clip) => total + getTimelineClipOutputDuration(clip),
    0,
  );
}

export interface TimelineRangeRemovalResult {
  clips: TimelineClip[];
  removedRanges: Array<{ startTime: number; endTime: number }>;
}

export interface TimelineRangeRemovalOptions {
  subtitleSkipId?: string;
}

export interface TimelineRangeRestorationResult {
  clips: TimelineClip[];
  restoredRanges: SubtitleSkippedRange[];
}

function getClipSourceRangesForTimelineOffsets(
  clip: TimelineClip,
  startOffset: number,
  endOffset: number,
): SilenceRegion[] {
  const speed = clip.speed || 1;
  const ranges: SilenceRegion[] = [];
  let timelineCursor = 0;

  for (const span of getTimelineClipKeptSourceSpans(clip)) {
    const spanOutputDuration = (span.endTime - span.startTime) / speed;
    const overlapStart = Math.max(startOffset, timelineCursor);
    const overlapEnd = Math.min(endOffset, timelineCursor + spanOutputDuration);

    if (overlapEnd - overlapStart > SOURCE_BOUNDARY_EPSILON_SECONDS) {
      ranges.push({
        startTime: span.startTime + (overlapStart - timelineCursor) * speed,
        endTime: span.startTime + (overlapEnd - timelineCursor) * speed,
      });
    }

    timelineCursor += spanOutputDuration;
    if (timelineCursor >= endOffset) break;
  }

  return ranges;
}

/**
 * Remove a visible timeline interval from the underlying source clips.
 *
 * Timeline coordinates account for clip speed and any source ranges that
 * were already removed. Each overlap is converted back to source time and
 * stored on its owning clip, so preview, audio, export, and timeline duration
 * all use the same edit instead of maintaining a separate skip flag.
 */
export function removeTimelineRangeFromClips(
  clips: TimelineClip[],
  startTime: number,
  endTime: number,
  options: TimelineRangeRemovalOptions = {},
): TimelineRangeRemovalResult {
  const timelineDuration = getTimelineDuration(clips);
  const removalStart = Math.max(0, Math.min(startTime, timelineDuration));
  const removalEnd = Math.max(
    removalStart,
    Math.min(endTime, timelineDuration),
  );
  if (
    !Number.isFinite(removalStart) ||
    !Number.isFinite(removalEnd) ||
    removalEnd - removalStart <= SOURCE_BOUNDARY_EPSILON_SECONDS
  ) {
    return { clips, removedRanges: [] };
  }

  const rangeByClipId = new Map(
    buildTimelineClipRanges(clips).map((range) => [range.clip.id, range]),
  );
  const removedRanges: Array<{ startTime: number; endTime: number }> = [];
  let changed = false;

  const nextClips = clips.map((clip) => {
    const range = rangeByClipId.get(clip.id);
    if (!range || clip.deleted || range.timelineEnd <= range.timelineStart) {
      return clip;
    }

    const overlapStart = Math.max(removalStart, range.timelineStart);
    const overlapEnd = Math.min(removalEnd, range.timelineEnd);
    if (overlapEnd - overlapStart <= SOURCE_BOUNDARY_EPSILON_SECONDS) {
      return clip;
    }

    const sourceRanges = getClipSourceRangesForTimelineOffsets(
      clip,
      overlapStart - range.timelineStart,
      overlapEnd - range.timelineStart,
    );
    if (sourceRanges.length === 0) {
      return clip;
    }

    const nextClip: TimelineClip = options.subtitleSkipId
      ? {
          ...clip,
          subtitleSkippedRanges: [
            ...(clip.subtitleSkippedRanges ?? []),
            ...sourceRanges.map((sourceRange) => ({
              ...sourceRange,
              skipId: options.subtitleSkipId!,
            })),
          ],
        }
      : {
          ...clip,
          sourceRemovedRanges: [
            ...(clip.sourceRemovedRanges ?? []),
            ...sourceRanges,
          ],
        };
    const hasPlayableSource =
      getTimelineClipKeptSourceSpans(nextClip).length > 0;

    changed = true;
    removedRanges.push({ startTime: overlapStart, endTime: overlapEnd });
    return options.subtitleSkipId || hasPlayableSource
      ? nextClip
      : { ...nextClip, deleted: true };
  });

  return {
    clips: changed ? nextClips : clips,
    removedRanges,
  };
}

/** Restore only the source ranges owned by one disabled subtitle row. */
export function restoreSubtitleSkippedRangeToClips(
  clips: TimelineClip[],
  skipId: string,
): TimelineRangeRestorationResult {
  const restoredRanges: SubtitleSkippedRange[] = [];
  let changed = false;

  const nextClips = clips.map((clip) => {
    const skippedRanges = clip.subtitleSkippedRanges;
    if (!skippedRanges?.some((range) => range.skipId === skipId)) {
      return clip;
    }

    const nextSkippedRanges = skippedRanges.filter((range) => {
      if (range.skipId !== skipId) return true;
      restoredRanges.push(range);
      return false;
    });
    changed = true;
    return {
      ...clip,
      subtitleSkippedRanges:
        nextSkippedRanges.length > 0 ? nextSkippedRanges : undefined,
    };
  });

  return {
    clips: changed ? nextClips : clips,
    restoredRanges,
  };
}

export function buildTimelineClipRanges(
  clips: TimelineClip[],
): TimelineClipRange[] {
  const ranges: TimelineClipRange[] = [];
  let timelineCursor = 0;

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const duration = getTimelineClipOutputDuration(clip);
    ranges.push({
      clip,
      index,
      timelineStart: timelineCursor,
      timelineEnd: timelineCursor + duration,
    });
    timelineCursor += duration;
  }

  return ranges;
}

export function getTimelinePositionAtTime(
  clips: TimelineClip[],
  timelineTime: number,
): TimelineSourcePosition | null {
  const ranges = buildTimelineClipRanges(clips);
  if (ranges.length === 0) return null;

  const clampedTime = Math.max(
    0,
    Math.min(timelineTime, getTimelineDuration(clips)),
  );
  const range =
    ranges.find(
      (item) =>
        !item.clip.deleted &&
        clampedTime >= item.timelineStart &&
        clampedTime < item.timelineEnd,
    ) ??
    [...ranges].reverse().find((item) => !item.clip.deleted) ??
    null;

  if (!range) return null;

  const sourceTime = getClipSourceTimeAtTimelineOffset(
    range.clip,
    Math.max(0, clampedTime - range.timelineStart),
  );

  return {
    clip: range.clip,
    clipIndex: range.index,
    assetId: range.clip.assetId,
    sourceTime,
    clipTimelineStart: range.timelineStart,
    clipTimelineEnd: range.timelineEnd,
  };
}

export function getTimelineTimeForClipSourceTime(
  clips: TimelineClip[],
  clipId: string,
  sourceTime: number,
): number | null {
  const range = buildTimelineClipRanges(clips).find(
    (item) => item.clip.id === clipId,
  );
  if (!range || range.clip.deleted) return null;

  const clampedSourceTime = Math.max(
    range.clip.sourceStart,
    Math.min(sourceTime, range.clip.sourceEnd),
  );
  return (
    range.timelineStart +
    getTimelineOffsetForClipSourceTime(range.clip, clampedSourceTime)
  );
}

export function createSingleSourceTimelineClip(
  assetId: string,
  duration: number,
): TimelineClip {
  return {
    id: createTimelineClipId(),
    assetId,
    sourceStart: 0,
    sourceEnd: duration,
    speed: 1,
  };
}
