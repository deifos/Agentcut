// Cursor and click data from ScreenSlick Companion recordings, in the shape Agentcut
// uses: a `<video>.cursor.json` next to each video, positions as 0–1 of the frame and
// times in frames of that video file (the same units as a clip's `trimStart`).
import {
  findVideoTimeForCompanionTimestampMs,
  getCompanionCursorPointAtTime,
  mapCompanionCursorSampleToVideoPoint,
} from "@/lib/companion-coordinate-mapping";
import type { CompanionRecordingTelemetry } from "@/lib/companion-protocol";
import {
  getMultiClipOutputTimeAtTimelineTime,
  type MultiClipFreezeWindow,
} from "@/lib/multi-clip-freeze-map";
import {
  buildTimelineClipRanges,
  getTimelineClipKeptSourceSpans,
  getTimelineOffsetForClipSourceTime,
} from "@/lib/multi-source-timeline";
import type { TimelineClip } from "@/types/editor";

export interface StudioCursorClick {
  frame: number;
  x: number;
  y: number;
  button: "left" | "right" | "middle";
}

export interface StudioCursorScroll {
  frame: number;
  x: number;
  y: number;
  /** Summed wheel delta; positive scrolls down. */
  dy: number;
}

export interface StudioCursorTrack {
  version: 1;
  /** Frames are frames of the video file at this rate. */
  fps: number;
  durationInFrames: number;
  /** Pixel size of the video, so a player can place the cursor in a letterboxed clip. */
  width?: number;
  height?: number;
  /**
   * "video": positions are 0–1 of this video's frame.
   * "source": the video is an edit (zooms, padding); positions are 0–1 of the original
   * screen, so use them for timing and rough placement only.
   */
  space: "video" | "source";
  /** The recording already shows the system cursor. */
  cursorInVideo: boolean;
  /** [frame, x, y], linear in between; null x/y: the cursor was off the captured screen. */
  path: [number, number | null, number | null][];
  /** [frame, kind] wherever the pointer shape changes (arrow, text, hand, resize). */
  kinds: [number, string][];
  clicks: StudioCursorClick[];
  scrolls: StudioCursorScroll[];
}

// Movement under ~0.15% of the frame (3 px at 1080p) is jitter, not motion.
const MOVE_EPSILON = 0.0015;
const SCROLL_MERGE_SECONDS = 0.4;

const round4 = (value: number) => Math.round(value * 10000) / 10000;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Path + clicks + scrolls of one Companion take, in its own video's frames. */
export function buildCursorTrack(
  telemetry: CompanionRecordingTelemetry,
  video: { duration: number; width?: number; height?: number },
  fps: number,
): StudioCursorTrack | null {
  const durationSeconds = video.duration;
  const capture = telemetry.captureSettings;
  if (!capture?.width || !capture.height || !(durationSeconds > 0)) return null;
  const width = capture.width;
  const height = capture.height;
  const durationInFrames = Math.max(1, Math.round(durationSeconds * fps));
  const durationMs = durationSeconds * 1000;

  const toVideo = (input: {
    timestampMs: number;
    displayId: string;
    screenX: number;
    screenY: number;
  }) => {
    const point = mapCompanionCursorSampleToVideoPoint({
      sample: { type: "cursor", ...input },
      status: telemetry.status,
      captureSettings: capture,
    });
    return point
      ? { x: round4(clamp01(point.x / width)), y: round4(clamp01(point.y / height)) }
      : null;
  };
  const frameAt = (companionTimestampMs: number) => {
    const videoMs = findVideoTimeForCompanionTimestampMs({
      telemetry,
      durationMs,
      companionTimestampMs,
    });
    return videoMs === null
      ? null
      : Math.min(durationInFrames - 1, Math.round((videoMs / 1000) * fps));
  };

  // Sample every frame, keep only the points where the cursor moves (plus the last
  // still frame before a move, so holds stay holds when interpolating).
  const path: StudioCursorTrack["path"] = [];
  let lastKept: StudioCursorTrack["path"][number] | null = null;
  let previous: StudioCursorTrack["path"][number] | null = null;
  let previousKept = false;
  for (let frame = 0; frame < durationInFrames; frame += 1) {
    const point = getCompanionCursorPointAtTime(telemetry, (frame / fps) * 1000);
    const current: StudioCursorTrack["path"][number] = point
      ? [frame, round4(clamp01(point.x / width)), round4(clamp01(point.y / height))]
      : [frame, null, null];
    const changed =
      !lastKept ||
      (lastKept[1] === null) !== (current[1] === null) ||
      (current[1] !== null &&
        Math.hypot(current[1] - (lastKept[1] ?? 0), (current[2] ?? 0) - (lastKept[2] ?? 0)) >
          MOVE_EPSILON);
    if (changed) {
      if (previous && !previousKept) path.push(previous);
      path.push(current);
      lastKept = current;
      previousKept = true;
    } else {
      previousKept = false;
    }
    previous = current;
  }
  if (previous && !previousKept) path.push(previous);

  const kinds: StudioCursorTrack["kinds"] = [];
  let lastKind: string | undefined;
  for (const sample of telemetry.cursorSamples) {
    const kind = sample.cursorKind ?? "unknown";
    if (kind === lastKind) continue;
    const frame = frameAt(sample.timestampMs);
    if (frame === null) continue;
    lastKind = kind;
    kinds.push([frame, kind]);
  }

  // One click per press: mousedown when the companion reports it, else click.
  const pressType = telemetry.inputEvents.some((e) => e.type === "mousedown")
    ? "mousedown"
    : "click";
  const clicks: StudioCursorClick[] = [];
  const scrolls: StudioCursorScroll[] = [];
  for (const event of telemetry.inputEvents) {
    if (event.type !== pressType && event.type !== "scroll") continue;
    const frame = frameAt(event.timestampMs);
    const position = toVideo(event);
    if (frame === null || !position) continue;
    if (event.type === "scroll") {
      const last = scrolls.at(-1);
      if (last && frame - last.frame <= SCROLL_MERGE_SECONDS * fps) {
        last.dy += event.scrollDeltaY ?? 0;
        continue;
      }
      scrolls.push({ frame, ...position, dy: event.scrollDeltaY ?? 0 });
    } else {
      clicks.push({ frame, ...position, button: event.button ?? "left" });
    }
  }

  return {
    version: 1,
    fps,
    durationInFrames,
    ...(video.width && video.height
      ? { width: video.width, height: video.height }
      : {}),
    space: "video",
    cursorInVideo: capture.cursorIncludedInVideo !== false,
    path,
    kinds,
    clicks,
    scrolls,
  };
}

/**
 * Clicks and scrolls of the takes in an edit, moved to where they land in the rendered
 * edit (cuts, removed silences, speed and freeze frames applied). Events in cut ranges
 * are dropped. No path: the edit already shows its cursor.
 */
export function mapCursorTracksToEdit(input: {
  tracksByAssetId: Map<string, StudioCursorTrack>;
  clips: TimelineClip[];
  timelineDuration: number;
  freezeWindows: MultiClipFreezeWindow[];
  fps: number;
  durationInFrames: number;
}): StudioCursorTrack | null {
  if (input.tracksByAssetId.size === 0) return null;
  const ranges = buildTimelineClipRanges(input.clips);
  const toEditFrame = (assetId: string, sourceSeconds: number): number | null => {
    for (const range of ranges) {
      const { clip } = range;
      if (clip.deleted || clip.assetId !== assetId) continue;
      const kept = getTimelineClipKeptSourceSpans(clip).some(
        (span) => sourceSeconds >= span.startTime && sourceSeconds <= span.endTime,
      );
      if (!kept) continue;
      const timeline =
        range.timelineStart + getTimelineOffsetForClipSourceTime(clip, sourceSeconds);
      const output = getMultiClipOutputTimeAtTimelineTime(
        input.timelineDuration,
        input.freezeWindows,
        timeline,
      );
      return Math.min(input.durationInFrames - 1, Math.round(output * input.fps));
    }
    return null;
  };

  const clicks: StudioCursorClick[] = [];
  const scrolls: StudioCursorScroll[] = [];
  for (const [assetId, track] of input.tracksByAssetId) {
    for (const click of track.clicks) {
      const frame = toEditFrame(assetId, click.frame / track.fps);
      if (frame !== null) clicks.push({ ...click, frame });
    }
    for (const scroll of track.scrolls) {
      const frame = toEditFrame(assetId, scroll.frame / track.fps);
      if (frame !== null) scrolls.push({ ...scroll, frame });
    }
  }
  clicks.sort((a, b) => a.frame - b.frame);
  scrolls.sort((a, b) => a.frame - b.frame);
  return {
    version: 1,
    fps: input.fps,
    durationInFrames: input.durationInFrames,
    space: "source",
    cursorInVideo: true,
    path: [],
    kinds: [],
    clicks,
    scrolls,
  };
}

/** `assets/screen.webm` → `assets/screen.cursor.json` */
export function cursorTrackPathFor(videoPath: string) {
  return videoPath.replace(/\.[^./]+$/, "") + ".cursor.json";
}

const seconds = (frame: number, fps: number) => Math.round((frame / fps) * 10) / 10;

/**
 * What Claude needs to plan an edit without reading the whole file: click count, the
 * busiest stretches, idle stretches (no movement, clicks or scrolls) and likely typing.
 */
export function summarizeCursorTrack(track: StudioCursorTrack) {
  const { fps } = track;
  const span = (from: number, to: number) => ({
    fromFrame: from,
    toFrame: to,
    from: seconds(from, fps),
    to: seconds(to, fps),
  });

  // Busiest: 10 s windows with the most clicks, not overlapping, at least 3 clicks.
  const windowFrames = 10 * fps;
  const candidates = track.clicks.map((click, index) => {
    const inWindow = track.clicks.filter(
      (other, otherIndex) =>
        otherIndex >= index && other.frame - click.frame <= windowFrames,
    );
    const last = inWindow.at(-1) ?? click;
    return {
      ...span(click.frame, last.frame),
      clicks: inWindow.length,
      around: {
        x: round4(inWindow.reduce((sum, c) => sum + c.x, 0) / inWindow.length),
        y: round4(inWindow.reduce((sum, c) => sum + c.y, 0) / inWindow.length),
      },
    };
  });
  const busiest: typeof candidates = [];
  for (const candidate of [...candidates].sort((a, b) => b.clicks - a.clicks)) {
    if (candidate.clicks < 3 || busiest.length >= 3) break;
    const overlaps = busiest.some(
      (b) => candidate.fromFrame <= b.toFrame && candidate.toFrame >= b.fromFrame,
    );
    if (!overlaps) busiest.push(candidate);
  }
  busiest.sort((a, b) => a.fromFrame - b.fromFrame);

  // Still stretches: consecutive path points at the same place (or both off screen).
  const still: [number, number][] = [];
  for (let index = 0; index + 1 < track.path.length; index += 1) {
    const [from, x1, y1] = track.path[index];
    const [to, x2, y2] = track.path[index + 1];
    const same =
      (x1 === null && x2 === null) ||
      (x1 !== null &&
        x2 !== null &&
        Math.hypot(x2 - x1, (y2 ?? 0) - (y1 ?? 0)) <= MOVE_EPSILON * 2);
    if (!same) continue;
    const last = still.at(-1);
    if (last && last[1] >= from) last[1] = to;
    else still.push([from, to]);
  }
  // Clicks and scrolls break a still stretch.
  const events = [...track.clicks, ...track.scrolls]
    .map((event) => event.frame)
    .sort((a, b) => a - b);
  const quiet = still.flatMap(([from, to]) => {
    const pieces: [number, number][] = [];
    let start = from;
    for (const frame of events) {
      if (frame <= start || frame >= to) continue;
      pieces.push([start, frame]);
      start = frame;
    }
    pieces.push([start, to]);
    return pieces;
  });
  const idle = quiet
    .filter(([from, to]) => to - from >= 3 * fps)
    .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
    .slice(0, 12)
    .sort((a, b) => a[0] - b[0])
    .map(([from, to]) => span(from, to));

  // Typing: a text cursor that stays put for 1.5 s or more.
  const textRanges: [number, number][] = track.kinds.flatMap(([frame, kind], index) =>
    kind === "text"
      ? [[frame, track.kinds[index + 1]?.[0] ?? track.durationInFrames] as [number, number]]
      : [],
  );
  const typing = textRanges
    .flatMap(([textFrom, textTo]) =>
      still.flatMap(([from, to]) => {
        const start = Math.max(from, textFrom);
        const end = Math.min(to, textTo);
        return end - start >= 1.5 * fps ? [span(start, end)] : [];
      }),
    )
    .slice(0, 12);

  return {
    space: track.space,
    cursorInVideo: track.cursorInVideo,
    clicks: track.clicks.length,
    scrolls: track.scrolls.length,
    busiest,
    idle: track.space === "video" ? idle : [],
    typing: track.space === "video" ? typing : [],
  };
}
