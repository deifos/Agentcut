// Seamless motion loops: each loop is a pure function of time drawn on a 2D canvas. Every motion in a
// loop repeats with a period that divides LOOP (12 s), so the frame at 12 s is the frame at 0 s and a
// loop can run under a clip of any length, or repeat, without a seam. No React here.

/** The loop length in seconds. Periods must divide it: 1, 1.5, 2, 3, 4, 6, 12. */
export const LOOP = 12;
export const TAU = Math.PI * 2;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Fractional part in [0, 1): a tiny negative (float error) gives 0, never 1, so it is safe to index with. */
export const fract = (v: number) => {
  const f = v - Math.floor(v);
  return f < 1 ? f : 0;
};
/** Modulo that stays positive. */
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 0…1 position inside a cycle of `period` seconds (offset in cycles). */
export const phase = (t: number, period: number, offset = 0) => fract(t / period + offset);

/** A fixed pseudo-random number in [0, 1) per element index and salt (never Math.random). */
export function rand(i: number, salt = 0) {
  return fract(Math.sin(i * 127.1 + salt * 311.7 + 74.7) * 43758.5453123);
}

/** 0 before a, eases 0→1 between a and b (as a linear 0…1), 1 after b. */
export const win = (p: number, a: number, b: number) => clamp((p - a) / Math.max(1e-6, b - a));

export const smoothstep = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};

export const ease = {
  linear: (k: number) => k,
  inSine: (k: number) => 1 - Math.cos((k * Math.PI) / 2),
  outSine: (k: number) => Math.sin((k * Math.PI) / 2),
  inOutSine: (k: number) => -(Math.cos(Math.PI * k) - 1) / 2,
  inCubic: (k: number) => k * k * k,
  outCubic: (k: number) => 1 - Math.pow(1 - k, 3),
  inOutCubic: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outExpo: (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inOutExpo: (k: number) =>
    k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2,
  outBack: (k: number, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
  inBack: (k: number, s = 1.70158) => (s + 1) * k * k * k - s * k * k,
  /** Settles from 0 to 1 with a wobble; exactly 1 at k = 1. */
  spring: (k: number, zeta = 0.35, freq = 3) => {
    if (k >= 1) return 1;
    const w = TAU * freq;
    const v = 1 - Math.exp(-zeta * w * k) * Math.cos(w * Math.sqrt(1 - zeta * zeta) * k);
    return lerp(v, 1, smoothstep(0.75, 1, k));
  },
};

/** Smooth noise that repeats every `period` seconds (sines on a circle): drift, sway, breathing. */
export function loopNoise(t: number, seed = 0, period = LOOP) {
  const a = TAU * phase(t, period);
  return (
    Math.sin(a + rand(seed, 1) * TAU) * 0.5 +
    Math.sin(2 * a + rand(seed, 2) * TAU) * 0.3 +
    Math.sin(3 * a + rand(seed, 3) * TAU) * 0.2
  );
}

/** Perspective projection, divided by depth once. */
export function proj(x: number, y: number, z: number, f: number, cx: number, cy: number) {
  const s = f / Math.max(1e-3, z);
  return { x: cx + x * s, y: cy + y * s, s };
}

// ─── Colour ──────────────────────────────────────────────────────────────────────────────────────

function parse(c: string): [number, number, number] {
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (x) => x + x) : hex[1];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(c);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((v) => parseFloat(v));
    return [r || 0, g || 0, b || 0];
  }
  return [0, 0, 0];
}

/** A colour (hex or rgb()) at an alpha. */
export function rgba(c: string, a: number) {
  const [r, g, b] = parse(c);
  return `rgba(${r},${g},${b},${clamp(a)})`;
}

/** Mix two colours (hex or rgb()). */
export function mixColor(a: string, b: string, k: number) {
  const x = parse(a);
  const y = parse(b);
  return `rgb(${Math.round(lerp(x[0], y[0], k))},${Math.round(lerp(x[1], y[1], k))},${Math.round(lerp(x[2], y[2], k))})`;
}

const luma = (c: string) => {
  const [r, g, b] = parse(c);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

export type LoopTone = "dark" | "accent" | "light";

/** The palette a loop draws with. Never use other colours inside a loop. */
export interface LoopPalette {
  /** Filled before draw() unless the loop is transparent. */
  bg: string;
  /** Main motif. */
  fg: string;
  /** Second colour, sparingly. */
  fg2: string;
  /** Between bg and fg: grids, quiet details. */
  mid: string;
  accent: string;
  accent2: string;
  paper: string;
  ink: string;
  tone: LoopTone;
}

/**
 * Three tones from the brand colours: dark (deep brand-tinted background, accent motif), accent
 * (accent background, ink motif), light (paper background, ink motif, accent as the second colour).
 */
export function loopPalette(accent: string, accent2: string, tone: LoopTone, paper = "#f5f3ee", ink = "#111216"): LoopPalette {
  if (tone === "accent") {
    const onAccent = luma(accent) > 0.6 ? ink : paper;
    return { bg: accent, fg: onAccent, fg2: accent2, mid: mixColor(accent, onAccent, 0.3), accent, accent2, paper, ink, tone };
  }
  if (tone === "light") {
    return { bg: paper, fg: ink, fg2: accent, mid: mixColor(paper, ink, 0.18), accent, accent2, paper, ink, tone };
  }
  const bg = mixColor(accent, "#07070b", 0.9);
  return { bg, fg: accent, fg2: accent2, mid: mixColor(bg, accent, 0.28), accent, accent2, paper, ink, tone };
}

/** What a loop's draw() receives besides the context. */
export interface LoopHelpers {
  phase: typeof phase;
  rand: typeof rand;
  win: typeof win;
  ease: typeof ease;
  loopNoise: typeof loopNoise;
  proj: typeof proj;
  rgba: typeof rgba;
  mixColor: typeof mixColor;
  smoothstep: typeof smoothstep;
  clamp: typeof clamp;
  fract: typeof fract;
  mod: typeof mod;
  lerp: typeof lerp;
  TAU: number;
  LOOP: number;
}

export const M: LoopHelpers = { phase, rand, win, ease, loopNoise, proj, rgba, mixColor, smoothstep, clamp, fract, mod, lerp, TAU, LOOP };

/**
 * draw(ctx, w, h, t, P, M): paint the frame at t seconds (0 ≤ t < 12). The background is already
 * filled (unless transparent). Sizes from u = h / 100 (min(w, h) for shapes); counts from w.
 * `seed` varies element layouts so the same loop can look different per video.
 */
export type LoopDraw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, P: LoopPalette, M: LoopHelpers, seed: number) => void;

export const LOOP_CATEGORIES = ["Backgrounds", "Shapes", "Symmetry", "Morphing", "Games", "Physics", "Generative"] as const;
export type LoopCategory = (typeof LOOP_CATEGORIES)[number];

export interface LoopDef {
  id: string;
  name: string;
  kind: "background" | "shape";
  /** Gallery group (defaults from kind). */
  category?: LoopCategory;
  /** What it looks like and when it works (Claude reads this). */
  description: string;
  tags: string[];
  draw: LoopDraw;
}
