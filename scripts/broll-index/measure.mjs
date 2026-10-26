// Measured shot traits the vision model judges poorly: camera movement (global shift between frames)
// and how much calm, simple area the frame has for text on top. Written to work/<film>/measure.json
// (separate from film.json) and merged by `build`.
import { join } from "node:path";
import { ffmpeg, FILMS_DIR, readJson, WORK_DIR, writeJson } from "./lib.mjs";

const W = 96;
const H = 72;
const FPS = 6;
const MAX_SHIFT = 6; // px at 96 wide ≈ 6% of the frame
const STEP = 3; // compare frames 0.5 s apart so slow pans still move a pixel or more
const GRID_X = 8;
const GRID_Y = 6;
const CALM_GRADIENT = 6; // mean |gradient| (0–255) below which a cell reads as flat

function diffAt(a, b, dx, dy) {
  let sum = 0;
  let n = 0;
  for (let y = MAX_SHIFT; y < H - MAX_SHIFT; y++) {
    for (let x = MAX_SHIFT; x < W - MAX_SHIFT; x++) {
      sum += Math.abs(a[y * W + x] - b[(y + dy) * W + (x + dx)]);
      n++;
    }
  }
  return sum / n;
}

/** Best integer shift of b against a, and how much better it fits than no shift. */
function globalShift(a, b) {
  const still = diffAt(a, b, 0, 0);
  let best = { dx: 0, dy: 0, diff: still };
  for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy++) {
    for (let dx = -MAX_SHIFT; dx <= MAX_SHIFT; dx++) {
      const diff = diffAt(a, b, dx, dy);
      if (diff < best.diff) best = { dx, dy, diff };
    }
  }
  return { ...best, gain: still > 0 ? 1 - best.diff / still : 0 };
}

function gradientMap(f) {
  const g = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      g[i] = (Math.abs(f[i + 1] - f[i - 1]) + Math.abs(f[i + W] - f[i - W])) / 2;
    }
  }
  return g;
}

/** Share of grid cells that are flat (sky, wall, water), and the frame's mean detail. */
function calmness(f) {
  const g = gradientMap(f);
  const cw = W / GRID_X;
  const ch = H / GRID_Y;
  let calm = 0;
  let total = 0;
  for (let gy = 0; gy < GRID_Y; gy++) {
    for (let gx = 0; gx < GRID_X; gx++) {
      let sum = 0;
      let n = 0;
      for (let y = Math.max(1, gy * ch); y < Math.min(H - 1, (gy + 1) * ch); y++) {
        for (let x = Math.max(1, gx * cw); x < Math.min(W - 1, (gx + 1) * cw); x++) {
          sum += g[y * W + x];
          n++;
        }
      }
      if (sum / n < CALM_GRADIENT) calm++;
      total += sum;
    }
  }
  return { calmShare: calm / (GRID_X * GRID_Y), detail: total / ((W - 2) * (H - 2)) };
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export async function measureFilm(film) {
  const path = join(WORK_DIR, film.id, "measure.json");
  const results = readJson(path, {});
  const src = join(FILMS_DIR, film.id, "index.mp4");
  let done = 0;
  for (const shot of film.shots) {
    if (results[shot.id]) continue;
    const { stdout } = await ffmpeg([
      "-ss", shot.start.toFixed(3), "-t", (shot.end - shot.start).toFixed(3), "-i", src, "-an",
      "-vf", `fps=${FPS},scale=${W}:${H},format=gray`, "-f", "rawvideo", "-",
    ]);
    const size = W * H;
    const frames = Array.from({ length: Math.floor(stdout.length / size) }, (_, i) => stdout.subarray(i * size, (i + 1) * size));
    const shifts = [];
    for (let i = STEP; i < frames.length; i++) shifts.push(globalShift(frames[i - STEP], frames[i]));
    // Camera moves when most steps fit clearly better shifted (gain) by a consistent amount.
    const dx = median(shifts.map((s) => s.dx));
    const dy = median(shifts.map((s) => s.dy));
    const gain = median(shifts.map((s) => s.gain));
    const moving = gain > 0.15 && (Math.abs(dx) >= 1 || Math.abs(dy) >= 1);
    const camera = !moving ? "static" : Math.abs(dx) >= Math.abs(dy) ? "pan" : "tilt";
    const calm = frames.length ? frames.filter((_, i) => i % 3 === 0).map(calmness) : [{ calmShare: 0, detail: 0 }];
    results[shot.id] = {
      camera,
      shift: { dx, dy, gain: +gain.toFixed(2) },
      calmShare: +Math.min(...calm.map((c) => c.calmShare)).toFixed(2),
      detail: +(calm.reduce((a, c) => a + c.detail, 0) / calm.length).toFixed(2),
    };
    done++;
  }
  if (done) writeJson(path, results);
  return done;
}
