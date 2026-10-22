import type { FreezeSegment, TimelineClip } from "@/types/editor";
import {
  buildTimelineClipRanges,
  getFirstPlayableClipSourceTime,
  getLastPlayableClipSourceTime,
  getTimelinePositionAtTime,
  getTimelineTimeForClipSourceTime,
} from "@/lib/multi-source-timeline";
import { pruneOrphanedSourceScopedItems } from "@/lib/timeline-source-ownership";

const FREEZE_EPSILON = 0.001;

export interface MultiClipFreezeWindow {
  segment: FreezeSegment;
  timelineStart: number;
  outputStart: number;
  outputEnd: number;
}

export interface ActiveMultiClipFreezeState {
  id: string;
  elapsed: number;
}

export function scopeFreezeSegmentsToTimeline(
  segments: FreezeSegment[],
  clips: TimelineClip[],
): FreezeSegment[] {
  const boundarySegments = segments.filter(
    (segment) => segment.boundaryAfterClipId !== undefined,
  );
  const sourceSegments = segments.filter(
    (segment) => segment.boundaryAfterClipId === undefined,
  );
  const retainedSourceSegments = pruneOrphanedSourceScopedItems(
    sourceSegments,
    clips,
  );
  let changed = retainedSourceSegments !== sourceSegments;
  const clipRanges = buildTimelineClipRanges(clips);
  const liveClipRanges = clipRanges.filter(
    (range) => !range.clip.deleted && range.timelineEnd > range.timelineStart,
  );
  const normalizedBoundarySegments = boundarySegments.map((segment) => {
    const timelineStartTime = segment.timelineStartTime;
    if (
      typeof segment.boundaryAfterClipId !== "string" ||
      liveClipRanges.some(
        (range) => range.clip.id === segment.boundaryAfterClipId,
      ) ||
      timelineStartTime === undefined ||
      liveClipRanges.length === 0
    ) {
      return segment;
    }

    // Clip ids can be regenerated while a source is hydrated. Boundary
    // intermissions also persist their base-timeline position, so use that
    // stable coordinate to recover the closest live seam instead of falling
    // back to the beginning of the timeline.
    const boundaryAfterClipId =
      timelineStartTime <= FREEZE_EPSILON
        ? null
        : liveClipRanges.reduce((closest, candidate) =>
            Math.abs(candidate.timelineEnd - timelineStartTime) <
            Math.abs(closest.timelineEnd - timelineStartTime)
              ? candidate
              : closest,
          ).clip.id;
    changed = true;
    return { ...segment, boundaryAfterClipId };
  });
  const normalizedSourceSegments = retainedSourceSegments.map((segment) => {
    if (!segment.sourceClipId) return segment;
    const sourceClip = clips.find(
      (clip) => !clip.deleted && clip.id === segment.sourceClipId,
    );
    if (!sourceClip || segment.sourceAssetId === sourceClip.assetId) {
      return segment;
    }
    changed = true;
    return { ...segment, sourceAssetId: sourceClip.assetId };
  });

  if (!changed) return segments;
  const retainedIds = new Set([
    ...normalizedBoundarySegments.map((segment) => segment.id),
    ...normalizedSourceSegments.map((segment) => segment.id),
  ]);
  const normalizedById = new Map(
    [...normalizedBoundarySegments, ...normalizedSourceSegments].map(
      (segment) => [segment.id, segment],
    ),
  );
  return segments
    .filter((segment) => retainedIds.has(segment.id))
    .map((segment) => normalizedById.get(segment.id) ?? segment);
}

export function getMultiClipFreezePlaybackTarget(
  segment: FreezeSegment,
  clips: TimelineClip[],
): { clipId?: string; sourceTime: number } {
  const clip = segment.sourceClipId
    ? clips.find((item) => item.id === segment.sourceClipId && !item.deleted)
    : undefined;
  if (!clip) {
    return { sourceTime: segment.sourceTime };
  }

  const firstPlayable =
    getFirstPlayableClipSourceTime(clip) ?? clip.sourceStart;
  const lastPlayable = getLastPlayableClipSourceTime(clip) ?? clip.sourceEnd;
  let sourceTime = Math.max(
    firstPlayable,
    Math.min(segment.sourceTime, lastPlayable),
  );

  // A media element positioned at its exact native end may expose no decoded
  // frame. Stay just inside the authored clip so a boundary freeze captures
  // the final visible frame of that clip instead of the next clip's first one.
  if (
    sourceTime >= lastPlayable - FREEZE_EPSILON &&
    lastPlayable > firstPlayable
  ) {
    sourceTime = Math.max(firstPlayable, lastPlayable - FREEZE_EPSILON);
  }

  return { clipId: clip.id, sourceTime };
}

function getFreezeTimelineStart(
  freeze: FreezeSegment,
  clips: TimelineClip[],
): number | null {
  if (clips.length === 0) return freeze.sourceTime;

  // Boundary-anchored intermission: lives at the end of `boundaryAfterClipId`
  // (or before the first clip if null). Resolves at lookup time so reorder /
  // trim / removal of neighbors don't require mutating the freeze segment.
  // If the anchor clip itself is gone or has no duration, walk back to the
  // previous surviving clip's end.
  if (freeze.boundaryAfterClipId !== undefined) {
    if (freeze.boundaryAfterClipId === null) return 0;
    const ranges = buildTimelineClipRanges(clips);
    const anchorIdx = ranges.findIndex(
      (r) => r.clip.id === freeze.boundaryAfterClipId,
    );
    if (anchorIdx < 0) {
      // Anchor clip no longer in the array at all; pin to start.
      return 0;
    }
    for (let i = anchorIdx; i >= 0; i--) {
      const r = ranges[i];
      if (!r.clip.deleted && r.timelineEnd > r.timelineStart) {
        return r.timelineEnd;
      }
    }
    return 0;
  }

  if (freeze.sourceClipId) {
    return getTimelineTimeForClipSourceTime(
      clips,
      freeze.sourceClipId,
      freeze.sourceTime,
    );
  }

  if (freeze.timelineStartTime !== undefined) {
    const position = getTimelinePositionAtTime(clips, freeze.timelineStartTime);
    if (position) return freeze.timelineStartTime;
  }

  const matchingClip = clips.find(
    (clip) =>
      !clip.deleted &&
      (!freeze.sourceAssetId || clip.assetId === freeze.sourceAssetId) &&
      freeze.sourceTime >= clip.sourceStart &&
      freeze.sourceTime <= clip.sourceEnd,
  );
  if (!matchingClip) return null;

  return getTimelineTimeForClipSourceTime(
    clips,
    matchingClip.id,
    freeze.sourceTime,
  );
}

// Builds the freeze window array. Hot-path callers should compute this once
// per render (e.g. via useMemo) and feed it into the helpers below instead
// of rebuilding for every lookup.
export function getMultiClipFreezeWindows(
  clips: TimelineClip[],
  freezes: FreezeSegment[],
): MultiClipFreezeWindow[] {
  const placed: { segment: FreezeSegment; timelineStart: number }[] = [];
  for (const segment of scopeFreezeSegmentsToTimeline(freezes, clips)) {
    const timelineStart = getFreezeTimelineStart(segment, clips);
    if (timelineStart === null) continue;
    placed.push({ segment, timelineStart });
  }
  placed.sort(
    (a, b) =>
      a.timelineStart - b.timelineStart ||
      a.segment.id.localeCompare(b.segment.id),
  );

  const windows: MultiClipFreezeWindow[] = new Array(placed.length);
  let freezeOffset = 0;
  for (let i = 0; i < placed.length; i++) {
    const { segment, timelineStart } = placed[i];
    const outputStart = timelineStart + freezeOffset;
    const outputEnd = outputStart + segment.duration;
    freezeOffset += segment.duration;
    windows[i] = { segment, timelineStart, outputStart, outputEnd };
  }
  return windows;
}

// Returns a fresh windows array with the given freeze removed, re-shifting
// outputStart / outputEnd so the remaining windows stay contiguous. Cheaper
// than calling getMultiClipFreezeWindows again because it skips the per-freeze
// clip lookup and the sort.
export function rebuildWindowsExcluding(
  windows: MultiClipFreezeWindow[],
  excludeId: string,
): MultiClipFreezeWindow[] {
  const next: MultiClipFreezeWindow[] = [];
  let freezeOffset = 0;
  for (const window of windows) {
    if (window.segment.id === excludeId) continue;
    const outputStart = window.timelineStart + freezeOffset;
    const outputEnd = outputStart + window.segment.duration;
    freezeOffset += window.segment.duration;
    next.push({
      segment: window.segment,
      timelineStart: window.timelineStart,
      outputStart,
      outputEnd,
    });
  }
  return next;
}

export function buildFreezeWindowIndex(
  windows: MultiClipFreezeWindow[],
): Map<string, MultiClipFreezeWindow> {
  const index = new Map<string, MultiClipFreezeWindow>();
  for (const window of windows) {
    index.set(window.segment.id, window);
  }
  return index;
}

export function getMultiClipTotalDuration(
  timelineDuration: number,
  windows: MultiClipFreezeWindow[],
): number {
  let total = timelineDuration;
  for (const window of windows) total += window.segment.duration;
  return total;
}

export function getMultiClipTimelineTimeAtOutputTime(
  timelineDuration: number,
  windows: MultiClipFreezeWindow[],
  outputTime: number,
): number {
  const totalDuration = getMultiClipTotalDuration(timelineDuration, windows);
  const clampedOutputTime = Math.max(0, Math.min(outputTime, totalDuration));
  let freezeOffset = 0;

  for (const window of windows) {
    if (clampedOutputTime < window.outputStart) {
      return Math.max(
        0,
        Math.min(timelineDuration, clampedOutputTime - freezeOffset),
      );
    }

    if (clampedOutputTime < window.outputEnd) {
      return window.timelineStart;
    }

    freezeOffset += window.segment.duration;
  }

  return Math.max(
    0,
    Math.min(timelineDuration, clampedOutputTime - freezeOffset),
  );
}

export function getMultiClipOutputTimeAtTimelineTime(
  timelineDuration: number,
  windows: MultiClipFreezeWindow[],
  timelineTime: number,
  activeFreeze?: ActiveMultiClipFreezeState,
): number {
  const clampedTimelineTime = Math.max(
    0,
    Math.min(timelineTime, timelineDuration),
  );
  let freezeOffset = 0;

  for (const window of windows) {
    if (window.timelineStart <= clampedTimelineTime - FREEZE_EPSILON) {
      freezeOffset += window.segment.duration;
      continue;
    }

    if (
      activeFreeze?.id === window.segment.id &&
      Math.abs(window.timelineStart - clampedTimelineTime) <= FREEZE_EPSILON
    ) {
      freezeOffset += Math.max(
        0,
        Math.min(activeFreeze.elapsed, window.segment.duration),
      );
    }
    break;
  }

  return clampedTimelineTime + freezeOffset;
}

export function getMultiClipFreezeWindowAtOutputTime(
  windows: MultiClipFreezeWindow[],
  outputTime: number,
): MultiClipFreezeWindow | null {
  for (const window of windows) {
    if (outputTime >= window.outputStart && outputTime < window.outputEnd) {
      return window;
    }
  }
  return null;
}

/**
 * Returns the holds that sit entirely before an output-timeline position.
 *
 * Output time is intentional here: a source timestamp at a freeze boundary
 * can represent either the frame before the hold or the first frame after it.
 * The expanded output timeline removes that ambiguity, which makes this safe
 * for rebuilding playback state after scrubbing backward or forward.
 */
export function getCompletedMultiClipFreezeIdsAtOutputTime(
  windows: MultiClipFreezeWindow[],
  outputTime: number,
): Set<string> {
  const completed = new Set<string>();
  for (const window of windows) {
    if (outputTime >= window.outputEnd - FREEZE_EPSILON) {
      completed.add(window.segment.id);
    }
  }
  return completed;
}
