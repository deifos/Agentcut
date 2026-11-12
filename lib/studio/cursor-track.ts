// Cursor and click data from ScreenSlick Companion recordings, in the shape Agentcut
// uses: a `<video>.cursor.json` next to each video, positions as 0–1 of the frame and
// times in frames of that video file (the same units as a clip's `trimStart`).

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
const round4 = (value: number) => Math.round(value * 10000) / 10000;

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
