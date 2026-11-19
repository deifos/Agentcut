import { spawn } from "node:child_process";
import { killTree } from "./proc.js";

// Style Spy measurements. One decode of the reference at thumbnail size gives every frame a
// signature; cuts, flashes, transitions, things appearing on screen and caption switches are read
// from those numbers, so the agent looks at pictures only where a picture is needed.

/** Thumbnails are THUMB x THUMB whatever the aspect ratio: regions are fractions of the frame. */
export const THUMB = 64;
export const GRID = 8;
const CELL = THUMB / GRID;
const CELLS = GRID * GRID;
const SIG = 16;
const SIG_SIZE = SIG * SIG;

// Mean absolute luma change (0-255) per frame.
const CELL_ON = 10;
const CUT_SHARE = 0.45;
const CUT_CHANGE = 6;
const SLOW_CHANGE = 2;
const SLOW_SHARE = 0.6;
/** Two pictures this far apart (signature difference) are different pictures. */
const DIFFERENT = 12;
const SAME = 6;
const FLASH_FRAMES = 8;
const STEP_FRAMES = 4;
const EVENT_GAP = 2;
const EVENT_PEAK = 14;
const MAX_EVENTS = 60;
const BAND_MIN_EVENTS = 5;
const LOOK_DISTANCE = 10;

export interface Signatures {
  count: number;
  /** count x 64: how much each grid cell changed from the frame before. */
  cell: Uint8Array;
  /** count x 256: the frame at 16x16. */
  sig: Uint8Array;
}

/** Stream raw frames of `bytes` each from ffmpeg's stdout. Resolves with the frame count. */
export function readRawFrames(ffmpeg: string, args: string[], bytes: number, onFrame: (pixels: Buffer, index: number) => void, timeoutMs: number) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(ffmpeg, args, { shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => killTree(child), timeoutMs);
    let pending: Buffer = Buffer.alloc(0);
    let index = 0;
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      let offset = 0;
      while (pending.length - offset >= bytes) {
        onFrame(pending.subarray(offset, offset + bytes), index);
        index += 1;
        offset += bytes;
      }
      pending = pending.subarray(offset);
    });
    child.stderr.on("data", (chunk: Buffer) => { stderr = (stderr + chunk.toString("utf8")).slice(-4000); });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(index);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/** Signatures of raw THUMB x THUMB gray frames, fed one at a time. */
export function signatureCollector() {
  const cells: Uint8Array[] = [];
  const sigs: Uint8Array[] = [];
  let previous: Uint8Array | null = null;
  return {
    add(pixels: Uint8Array) {
      const cell = new Uint8Array(CELLS);
      const sig = new Uint8Array(SIG_SIZE);
      const sums = new Float64Array(CELLS);
      const sigSums = new Float64Array(SIG_SIZE);
      const sigCell = THUMB / SIG;
      for (let y = 0; y < THUMB; y += 1) {
        for (let x = 0; x < THUMB; x += 1) {
          const i = y * THUMB + x;
          sigSums[Math.floor(y / sigCell) * SIG + Math.floor(x / sigCell)] += pixels[i];
          if (previous) sums[Math.floor(y / CELL) * GRID + Math.floor(x / CELL)] += Math.abs(pixels[i] - previous[i]);
        }
      }
      for (let i = 0; i < CELLS; i += 1) cell[i] = Math.min(255, Math.round(sums[i] / (CELL * CELL)));
      for (let i = 0; i < SIG_SIZE; i += 1) sig[i] = Math.round(sigSums[i] / (sigCell * sigCell));
      cells.push(cell);
      sigs.push(sig);
      previous = Uint8Array.from(pixels);
    },
    done(): Signatures {
      const count = cells.length;
      const cell = new Uint8Array(count * CELLS);
      const sig = new Uint8Array(count * SIG_SIZE);
      for (let i = 0; i < count; i += 1) {
        cell.set(cells[i], i * CELLS);
        sig.set(sigs[i], i * SIG_SIZE);
      }
      return { count, cell, sig };
    },
  };
}

export async function readSignatures(ffmpeg: string, inputArgs: string[], video: string) {
  const collector = signatureCollector();
  await readRawFrames(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-nostats", ...inputArgs, "-i", video, "-map", "0:v:0", "-an",
      "-vf", `scale=${THUMB}:${THUMB}:flags=area,format=gray`, "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"],
    THUMB * THUMB,
    (pixels) => collector.add(pixels),
    8 * 60_000,
  );
  return collector.done();
}

export interface MeasuredCut {
  frame: number;
  /** cut: one frame to the next. flash: the picture returns at endFrame. transition: settled at endFrame. */
  kind: "cut" | "flash" | "transition";
  endFrame?: number;
}

/** Fractions of the frame from its top left: [x, y, width, height]. */
export type Box = [number, number, number, number];

export interface MeasuredEvent {
  id: string;
  /** First frame that shows the change, and the first frame after it settles. */
  frame: number;
  settledFrame: number;
  box: Box;
  /** Peak change inside the box, 0-255. */
  strength: number;
}

export interface MeasuredBand {
  id: string;
  box: Box;
  /** The frame each change starts on: caption switches when the band holds captions. */
  frames: number[];
}

export interface MeasuredShot {
  id: string;
  startFrame: number;
  endFrameExclusive: number;
  look: string;
}

export interface Measured {
  cuts: MeasuredCut[];
  shots: MeasuredShot[];
  /** Shots that share a picture (the same setup or layout), with the longest shot as the example. */
  looks: { id: string; shots: string[]; example: string }[];
  events: MeasuredEvent[];
  bands: MeasuredBand[];
  /** One digit per half second: how much the picture changes (0 still, 9 everything). */
  rhythm: string;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

function cellBox(cells: Iterable<number>): Box {
  let x0 = GRID, y0 = GRID, x1 = -1, y1 = -1;
  for (const c of cells) {
    const x = c % GRID, y = Math.floor(c / GRID);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0 / GRID, y0 / GRID, (x1 - x0 + 1) / GRID, (y1 - y0 + 1) / GRID].map(round3) as Box;
}

function overlap(a: Box, b: Box) {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a[2] * a[3] + b[2] * b[3] - w * h);
}

/** Cuts, shots, looks, events and caption bands from frame signatures. */
export function analyzeSignatures(s: Signatures, fps: number): Measured {
  const n = s.count;
  const change = new Float32Array(n);
  const share = new Float32Array(n);
  for (let f = 1; f < n; f += 1) {
    let sum = 0, on = 0;
    for (let c = 0; c < CELLS; c += 1) {
      const v = s.cell[f * CELLS + c];
      sum += v;
      if (v >= CELL_ON) on += 1;
    }
    change[f] = sum / CELLS;
    share[f] = on / CELLS;
  }
  const distance = (a: number, b: number) => {
    const i = Math.max(0, Math.min(n - 1, a)) * SIG_SIZE, j = Math.max(0, Math.min(n - 1, b)) * SIG_SIZE;
    let sum = 0;
    for (let k = 0; k < SIG_SIZE; k += 1) sum += Math.abs(s.sig[i + k] - s.sig[j + k]);
    return sum / SIG_SIZE;
  };

  // Whole-frame changes, grouped into runs of consecutive frames.
  const whole = (f: number) => (change[f] >= CUT_CHANGE && share[f] >= CUT_SHARE) || (change[f] >= SLOW_CHANGE && share[f] >= SLOW_SHARE);
  const longRun = Math.max(6, Math.round(fps * 1.5));
  const found: MeasuredCut[] = [];
  const taken = new Uint8Array(n);
  const spike = (f: number) =>
    change[f] >= 20 && share[f] >= CUT_SHARE && change[f] >= 3 * Math.max(change[f - 1] ?? 0, change[f + 1] ?? 0, 1) && distance(f - 1, f) >= DIFFERENT;
  for (let f = 1; f < n; f += 1) {
    if (!whole(f)) continue;
    let end = f;
    while (end + 1 < n && whole(end + 1)) end += 1;
    const length = end - f + 1;
    let peak = f;
    for (let k = f; k <= end; k += 1) if (change[k] > change[peak]) peak = k;
    const spikes: number[] = [];
    for (let k = f; k <= end; k += 1) if (spike(k)) spikes.push(k);
    if (length <= 2) {
      if (distance(f - 1, end) >= DIFFERENT) found.push({ frame: peak, kind: "cut" });
      else if (change[peak] >= 20) found.push({ frame: f, kind: "flash", endFrame: end });
    } else if (spikes.length) {
      for (const k of spikes) found.push({ frame: k, kind: "cut" });
    } else if (length <= longRun && distance(f - 1, end) >= DIFFERENT) {
      // A hard cut that opens a run of motion is still a cut.
      if (change[f] >= 20 && change[f] >= 2 * median(Array.from(change.subarray(f + 1, end + 1)))) found.push({ frame: f, kind: "cut" });
      else found.push({ frame: f, kind: "transition", endFrame: end + 1 });
    }
    for (let k = f; k <= end; k += 1) taken[k] = 1;
    f = end;
  }
  // A picture that comes back within a few frames was a flash, not two cuts.
  const merged: MeasuredCut[] = [];
  for (let i = 0; i < found.length; i += 1) {
    const a = found[i], b = found[i + 1];
    if (a.kind === "cut" && b?.kind === "cut" && b.frame - a.frame <= FLASH_FRAMES && distance(a.frame - 1, b.frame) < SAME) {
      merged.push({ frame: a.frame, kind: "flash", endFrame: b.frame });
      i += 1;
    } else merged.push(a);
  }
  // Animation drawn every second or third frame steps like a row of cuts: it is one transition.
  const cuts: MeasuredCut[] = [];
  for (let i = 0; i < merged.length; i += 1) {
    let j = i;
    while (merged[j].kind === "cut" && merged[j + 1]?.kind === "cut" && merged[j + 1].frame - merged[j].frame <= STEP_FRAMES) j += 1;
    if (j === i) { cuts.push(merged[i]); continue; }
    const first = merged[i].frame, last = merged[j].frame;
    if (distance(first - 1, last) >= DIFFERENT) cuts.push({ frame: first, kind: "transition", endFrame: last + 1 });
    i = j;
  }

  const bounds = [0, ...cuts.filter((c) => c.kind !== "flash" && c.frame > 0 && c.frame < n).map((c) => c.frame), n];
  const ranges = bounds.slice(0, -1).map((start, i) => ({ start, end: bounds[i + 1] })).filter((r) => r.end > r.start);

  // Looks: shots whose middle frames match.
  const looks: { id: string; shots: number[]; middle: number }[] = [];
  const shotLook: string[] = [];
  ranges.forEach((range, index) => {
    const middle = Math.floor((range.start + range.end) / 2);
    const look = looks.find((l) => distance(l.middle, middle) < LOOK_DISTANCE);
    if (look) look.shots.push(index);
    else looks.push({ id: `L${looks.length + 1}`, shots: [index], middle });
    shotLook.push((look ?? looks[looks.length - 1]).id);
  });
  const shots: MeasuredShot[] = ranges.map((range, i) => ({ id: `s${i + 1}`, startFrame: range.start, endFrameExclusive: range.end, look: shotLook[i] }));

  // Events: cells that change far more than they usually do in their shot, outside whole-frame changes.
  const flashFrames = new Uint8Array(n);
  for (const cut of cuts) if (cut.kind === "flash") for (let k = cut.frame; k <= (cut.endFrame ?? cut.frame); k += 1) flashFrames[k] = 1;
  const bursts: { frame: number; last: number; cells: Set<number>; strength: number }[] = [];
  for (const range of ranges) {
    const limit = new Float32Array(CELLS);
    for (let c = 0; c < CELLS; c += 1) {
      const values: number[] = [];
      for (let f = range.start + 1; f < range.end; f += 1) values.push(s.cell[f * CELLS + c]);
      limit[c] = Math.max(CELL_ON, 3 * median(values));
    }
    let open: (typeof bursts)[number] | null = null;
    for (let f = range.start + 1; f < range.end; f += 1) {
      if (taken[f] || flashFrames[f]) continue;
      const on: number[] = [];
      let peak = 0;
      for (let c = 0; c < CELLS; c += 1) {
        const v = s.cell[f * CELLS + c];
        if (v >= limit[c]) { on.push(c); peak = Math.max(peak, v); }
      }
      if (on.length < 2 && peak < 30) continue;
      if (open && f - open.last <= EVENT_GAP + 1) {
        open.last = f;
        open.strength = Math.max(open.strength, peak);
        for (const c of on) open.cells.add(c);
      } else {
        open = { frame: f, last: f, cells: new Set(on), strength: peak };
        bursts.push(open);
      }
    }
  }
  const strong = bursts.filter((b) => b.strength >= EVENT_PEAK).map((b) => ({ frame: b.frame, settledFrame: b.last + 1, box: cellBox(b.cells), strength: b.strength }));

  // Bands: short changes that keep returning to the same place (captions, counters, tickers).
  const groups: { box: Box; items: typeof strong }[] = [];
  for (const event of strong) {
    if (event.settledFrame - event.frame > Math.max(8, fps / 3) || event.box[2] * event.box[3] > 0.3) continue;
    const group = groups.find((g) => overlap(g.box, event.box) >= 0.4);
    if (group) group.items.push(event);
    else groups.push({ box: event.box, items: [event] });
  }
  const inBand = new Set<(typeof strong)[number]>();
  const bands: MeasuredBand[] = [];
  for (const group of groups) {
    if (group.items.length < BAND_MIN_EVENTS) continue;
    for (const item of group.items) inBand.add(item);
    bands.push({ id: `b${bands.length + 1}`, box: group.box, frames: group.items.map((item) => item.frame) });
  }
  const events = strong
    .filter((event) => !inBand.has(event))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_EVENTS)
    .sort((a, b) => a.frame - b.frame)
    .map((event, i) => ({ id: `e${i + 1}`, ...event }));

  const step = Math.max(1, Math.round(fps / 2));
  let rhythm = "";
  for (let f = 0; f < n; f += step) {
    let peak = 0;
    for (let k = f; k < Math.min(n, f + step); k += 1) peak = Math.max(peak, change[k]);
    rhythm += String(Math.min(9, Math.round(Math.log2(1 + peak) * 1.3)));
  }

  return {
    cuts,
    shots,
    looks: looks.map((look) => {
      const longest = [...look.shots].sort((a, b) => ranges[b].end - ranges[b].start - (ranges[a].end - ranges[a].start))[0];
      return { id: look.id, shots: look.shots.map((i) => `s${i + 1}`), example: `s${longest + 1}` };
    }),
    events,
    bands,
    rhythm,
  };
}

// ---------------------------------------------------------------------------
// Sheets

/** One image a model reads without shrinking it. */
export const SHEET_SIDE = 1568;
export const SHEET_PIXELS = 1_150_000;
export const ROW_FRAMES = 8;
const MAX_ROWS = 24;

/** Tile size for `tiles` frames of aspect `aspect` (width / height) in `columns` columns, inside one sheet. */
export function tileSize(aspect: number, tiles: number, columns: number, padding = 4) {
  const rows = Math.ceil(tiles / columns);
  const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
  let width = Math.floor(SHEET_SIDE / columns) - padding;
  width = Math.min(width, Math.floor((SHEET_SIDE / rows - padding) * aspect));
  width = Math.min(width, Math.floor(Math.sqrt((SHEET_PIXELS / (columns * rows)) * aspect)));
  return { width: even(width), height: even(width / aspect), rows };
}

/** Rows of a motion sheet per sheet, for frames of this aspect. */
export function motionLayout(aspect: number) {
  const padding = 4;
  const even = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
  const width = even(Math.min(Math.floor(SHEET_SIDE / ROW_FRAMES) - padding, Math.sqrt(26_000 * aspect)));
  const height = even(width / aspect);
  const rows = Math.max(1, Math.min(Math.floor(SHEET_SIDE / (height + padding)), Math.floor(SHEET_PIXELS / (ROW_FRAMES * (width + padding) * (height + padding)))));
  return { width, height, rows, padding };
}

export interface MotionRow {
  kind: "hook" | "transition" | "event" | "band";
  /** The cut, event or band this row shows. */
  of?: string;
  frames: number[];
}

/** `count` frames from `from` to `to`, evenly spread, extended past `to` when the stretch is shorter. */
function spread(from: number, to: number, count: number, last: number) {
  const start = Math.max(0, Math.min(from, last - count + 1));
  const span = Math.max(to, start + count - 1);
  const end = Math.min(last, span);
  const frames = Array.from({ length: count }, (_, i) => Math.round(start + (i * (end - start)) / (count - 1)));
  return frames.every((frame, i) => i === 0 || frame > frames[i - 1]) ? frames : null;
}

/**
 * The stretches worth seeing in motion, eight frames a row: the hook, every transition, the strongest
 * events and a sample of each band. Hard cuts need no picture. Rows never share a frame.
 */
export function planMotionRows(measured: Measured, frameCount: number, fps: number): MotionRow[] {
  const last = frameCount - 1;
  if (last < ROW_FRAMES) return [];
  const hookEnd = Math.min(last, Math.round(fps * 3));
  const wanted: (MotionRow & { from: number; to: number; rank: number })[] = [];
  const hook = spread(0, hookEnd, ROW_FRAMES * 2, last);
  const transitions = measured.cuts.filter((cut) => cut.kind !== "cut" && cut.frame > hookEnd);
  transitions.forEach((cut, i) => wanted.push({ kind: "transition", of: `f${cut.frame}`, from: cut.frame - 2, to: (cut.endFrame ?? cut.frame) + 1, frames: [], rank: 1000 - i }));
  for (const event of measured.events) {
    if (event.frame <= hookEnd) continue;
    wanted.push({ kind: "event", of: event.id, from: event.frame - 1, to: event.settledFrame + 1, frames: [], rank: event.strength });
  }
  for (const band of measured.bands) {
    const sample = band.frames.find((frame) => frame > hookEnd) ?? band.frames[0];
    wanted.push({ kind: "band", of: band.id, from: sample - 2, to: sample + 5, frames: [], rank: 900 });
  }
  const room = MAX_ROWS - (hook ? 2 : 0);
  const chosen = wanted.sort((a, b) => b.rank - a.rank).slice(0, room).sort((a, b) => a.from - b.from);
  const rows: MotionRow[] = [];
  let free = 0;
  if (hook) {
    rows.push({ kind: "hook", frames: hook.slice(0, ROW_FRAMES) }, { kind: "hook", frames: hook.slice(ROW_FRAMES) });
    free = hook[hook.length - 1] + 1;
  }
  for (const row of chosen) {
    const from = Math.max(row.from, free);
    if (from > row.to) continue;
    const frames = spread(from, row.to, ROW_FRAMES, last);
    if (!frames || frames[0] < free) continue;
    rows.push({ kind: row.kind, of: row.of, frames });
    free = frames[frames.length - 1] + 1;
  }
  return rows;
}

/** ffmpeg filter that lays the rows' frames out on sheets of `layout.rows` rows. */
export function motionFilter(rows: MotionRow[], layout: ReturnType<typeof motionLayout>) {
  const frames = rows.flatMap((row) => row.frames);
  return [
    `select='${frames.map((frame) => `eq(n,${frame})`).join("+")}'`,
    `scale=${layout.width}:${layout.height}`,
    "setsar=1",
    `tile=${ROW_FRAMES}x${Math.min(layout.rows, rows.length)}:padding=${layout.padding}:color=black`,
  ].join(",");
}

// ---------------------------------------------------------------------------
// Regions of one frame

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/**
 * The text or marks drawn in an RGB image: what stands out from the colour around its edge.
 * Boxes are fractions of the image.
 */
export function measureInk(rgb: Uint8Array, width: number, height: number) {
  const at = (x: number, y: number) => (y * width + x) * 3;
  const border: number[][] = [[], [], []];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x > 1 && x < width - 2 && y > 1 && y < height - 2) continue;
      for (let k = 0; k < 3; k += 1) border[k].push(rgb[at(x, y) + k]);
    }
  }
  const background = border.map(median);
  // The median, so ink that reaches the edge does not count as background noise.
  const deviation = median(border[0].map((_, i) => Math.max(...background.map((v, k) => Math.abs(border[k][i] - v)))));
  const limit = Math.max(36, 3 * deviation);
  const mask = new Uint8Array(width * height);
  const rowCount = new Uint32Array(height);
  const columnCount = new Uint32Array(width);
  const ink: number[][] = [[], [], []];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = at(x, y);
      if (Math.max(Math.abs(rgb[i] - background[0]), Math.abs(rgb[i + 1] - background[1]), Math.abs(rgb[i + 2] - background[2])) <= limit) continue;
      mask[y * width + x] = 1;
      rowCount[y] += 1;
      columnCount[x] += 1;
      for (let k = 0; k < 3; k += 1) ink[k].push(rgb[i + k]);
    }
  }
  const first = (counts: Uint32Array) => counts.findIndex((v) => v >= 2);
  const lastOf = (counts: Uint32Array) => { for (let i = counts.length - 1; i >= 0; i -= 1) if (counts[i] >= 2) return i; return -1; };
  const x0 = first(columnCount), x1 = lastOf(columnCount), y0 = first(rowCount), y1 = lastOf(rowCount);
  if (x0 < 0 || y0 < 0) return null;
  const lines: { y: number; height: number }[] = [];
  let start = -1, gap = 0;
  for (let y = y0; y <= y1 + 1; y += 1) {
    const filled = y <= y1 && rowCount[y] >= 2;
    if (filled) { if (start < 0) start = y; gap = 0; }
    else if (start >= 0) {
      gap += 1;
      if (gap > 2 || y > y1) { lines.push({ y: round3(start / height), height: round3((y - gap + 1 - start) / height) }); start = -1; gap = 0; }
    }
  }
  return {
    box: { x: round3(x0 / width), y: round3(y0 / height), width: round3((x1 - x0 + 1) / width), height: round3((y1 - y0 + 1) / height) },
    lines,
    color: hex(median(ink[0]), median(ink[1]), median(ink[2])),
    background: hex(background[0], background[1], background[2]),
    /** How much of the box is ink: heavier type covers more. */
    coverage: round3(ink[0].length / ((x1 - x0 + 1) * (y1 - y0 + 1))),
    /** False when the surroundings are not one flat colour (footage, a gradient): treat the box as approximate. */
    flatBackground: deviation < 12,
  };
}

/** The main colours of an RGB image, largest share first. */
export function measureColors(rgb: Uint8Array, limit = 5) {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  const total = rgb.length / 3;
  for (let i = 0; i < rgb.length; i += 3) {
    const key = ((rgb[i] >> 4) << 8) | ((rgb[i + 1] >> 4) << 4) | (rgb[i + 2] >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1; bucket.r += rgb[i]; bucket.g += rgb[i + 1]; bucket.b += rgb[i + 2];
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .filter((bucket) => bucket.count / total >= 0.03)
    .map((bucket) => ({ color: hex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count), share: Math.round((bucket.count / total) * 100) / 100 }));
}

/** When a stretch of gray frames changes: bursts of consecutive changing frames. */
export function measureChanges(frames: Uint8Array[], startFrame: number) {
  const change: number[] = [0];
  for (let i = 1; i < frames.length; i += 1) {
    let sum = 0;
    for (let k = 0; k < frames[i].length; k += 1) sum += Math.abs(frames[i][k] - frames[i - 1][k]);
    change.push(sum / frames[i].length);
  }
  const limit = Math.max(3, 4 * median(change.slice(1)));
  const changes: { frame: number; settledFrame: number; peak: number }[] = [];
  for (let i = 1; i < change.length; i += 1) {
    if (change[i] < limit) continue;
    let end = i;
    while (end + 1 < change.length && change[end + 1] >= limit) end += 1;
    changes.push({ frame: startFrame + i, settledFrame: startFrame + end + 1, peak: Math.round(Math.max(...change.slice(i, end + 1))) });
    i = end;
  }
  return changes;
}

/** How far apart two gray THUMB x THUMB pictures are (0 identical, 100 opposite), and where it is worst. */
export function comparePictures(a: Uint8Array, b: Uint8Array) {
  const quarter = THUMB / 4;
  const cells = new Float64Array(16);
  let sum = 0;
  for (let y = 0; y < THUMB; y += 1) {
    for (let x = 0; x < THUMB; x += 1) {
      const d = Math.abs(a[y * THUMB + x] - b[y * THUMB + x]);
      sum += d;
      cells[Math.floor(y / quarter) * 4 + Math.floor(x / quarter)] += d;
    }
  }
  let worst = 0;
  for (let i = 1; i < 16; i += 1) if (cells[i] > cells[worst]) worst = i;
  return {
    difference: Math.round((sum / (THUMB * THUMB) / 255) * 1000) / 10,
    worst: { x: (worst % 4) / 4, y: Math.floor(worst / 4) / 4, width: 0.25, height: 0.25, difference: Math.round((cells[worst] / (quarter * quarter) / 255) * 1000) / 10 },
  };
}
