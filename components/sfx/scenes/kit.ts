// Shared drawing kit for the sound effect scenes: one small motion graphic per sound, showing what it is
// (a mouse for a mouse click, a zipper for a zip, a cork for a cork pop) and driven by the sound itself.
//
// Look: Agentcut's thin-line style. Ink outlines (f.lw thick), brand-colour accents used sparingly, no
// background (the card is paper), everything inside the safe area. Deterministic: no Math.random
// (use rand(i, seed)); motion comes from t (progress), level (loudness now) and time (seconds playing).

export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 0…1 through the sound. At rest (not playing) it is REST_T. */
  t: number;
  /** Loudness now, 0…1. Hits, presses and flashes should follow it. At rest it is REST_LEVEL. */
  level: number;
  /** Seconds since play started (0 at rest): for steady motion like spinning or jitter. */
  time: number;
  /** True while the sound plays; at rest draw a clear still of the object. */
  playing: boolean;
  brand: string;
  ink: string;
  /** Stable per-sound number for variety. */
  seed: number;
  /** min(w, h): size things with it. */
  s: number;
  cx: number;
  cy: number;
  /** The standard thin line width. */
  lw: number;
}

export type Scene = (f: Frame) => void;

export const REST_T = 0.4;
export const REST_LEVEL = 0.5;

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** Deterministic 0…1 noise. */
export const rand = (i: number, s: number) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const ease = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = (k: number) => Math.pow(clamp(k), 3);
export const easeInOut = (k: number) => {
  const x = clamp(k);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
/** 0 → 1 → 0 bump centred on `at` with half-width `width`. */
export const bump = (t: number, at: number, width: number) => clamp(1 - Math.abs(t - at) / width);
/** Spring-like overshoot settle 0…1 (for pops). */
export const spring = (k: number) => {
  const x = clamp(k);
  return 1 - Math.cos(x * Math.PI * 4.5) * Math.exp(-x * 6);
};
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Any CSS colour at an opacity. */
export function alpha(color: string, a: number) {
  return `color-mix(in srgb, ${color} ${Math.round(clamp(a) * 100)}%, transparent)`;
}

/** Stroke a path built by `build` with the frame's ink at its standard width. */
export function stroke(f: Frame, build: (ctx: CanvasRenderingContext2D) => void, color = f.ink, width = f.lw) {
  const { ctx } = f;
  ctx.beginPath();
  build(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

export function fill(f: Frame, build: (ctx: CanvasRenderingContext2D) => void, color = f.brand) {
  const { ctx } = f;
  ctx.beginPath();
  build(ctx);
  ctx.fillStyle = color;
  ctx.fill();
}

export function line(f: Frame, x0: number, y0: number, x1: number, y1: number, color = f.ink, width = f.lw) {
  stroke(f, (c) => {
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
  }, color, width);
}

export function circle(f: Frame, x: number, y: number, r: number, opts: { fill?: string; stroke?: string; width?: number } = {}) {
  const { ctx } = f;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fill();
  }
  if (opts.stroke ?? !opts.fill) {
    ctx.strokeStyle = opts.stroke ?? f.ink;
    ctx.lineWidth = opts.width ?? f.lw;
    ctx.stroke();
  }
}

export function rrect(
  f: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  opts: { fill?: string; stroke?: string; width?: number } = {},
) {
  const { ctx } = f;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)));
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fill();
  }
  if (opts.stroke ?? !opts.fill) {
    ctx.strokeStyle = opts.stroke ?? f.ink;
    ctx.lineWidth = opts.width ?? f.lw;
    ctx.stroke();
  }
}

/** Expanding rings from (x, y): k 0…1 drives them outward and fades them. */
export function ripples(f: Frame, x: number, y: number, k: number, maxR: number, n = 3, color = f.brand) {
  for (let i = 0; i < n; i++) {
    const p = clamp(k * 1.4 - i * 0.2);
    if (p <= 0 || p >= 1) continue;
    circle(f, x, y, maxR * ease(p), { stroke: alpha(color, 1 - p), width: f.lw });
  }
}

/** Short radiating strokes around (x, y), e.g. a hit or a sparkle. */
export function burst(f: Frame, x: number, y: number, r0: number, r1: number, n: number, k: number, color = f.brand, rot = 0) {
  if (k <= 0) return;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const a0 = r0 + (r1 - r0) * clamp(k - 0.35) * 1.5;
    const a1 = r0 + (r1 - r0) * ease(k);
    line(f, x + Math.cos(a) * a0, y + Math.sin(a) * a0, x + Math.cos(a) * a1, y + Math.sin(a) * a1, alpha(color, 1 - clamp(k - 0.6) * 2.5));
  }
}

/** A four-point sparkle star. */
export function sparkle(f: Frame, x: number, y: number, r: number, color = f.brand) {
  if (r <= 0) return;
  fill(f, (c) => {
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.quadraticCurveTo(x, y, x, y + r);
    c.quadraticCurveTo(x, y, x - r, y);
    c.quadraticCurveTo(x, y, x, y - r);
  }, color);
}

/** Classic arrow cursor with its tip at (x, y), `size` tall. */
export function cursor(f: Frame, x: number, y: number, size: number, press = 0) {
  const { ctx } = f;
  const k = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k * (1 - press * 0.15), k * (1 - press * 0.15));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 19);
  ctx.lineTo(4.6, 14.8);
  ctx.lineTo(7.8, 21.6);
  ctx.lineTo(11, 20.2);
  ctx.lineTo(7.9, 13.6);
  ctx.lineTo(14, 13.6);
  ctx.closePath();
  ctx.fillStyle = f.ink;
  ctx.fill();
  ctx.restore();
}

/** A sine-like wave across [x0, x1] at y: amp, cycles, phase. Good for tones, sweeps and strings. */
export function wave(
  f: Frame,
  x0: number,
  x1: number,
  y: number,
  amp: number | ((u: number) => number),
  cycles: number | ((u: number) => number),
  phase = 0,
  color = f.ink,
  width = f.lw,
) {
  stroke(f, (c) => {
    const n = 90;
    let ph = phase;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const cyc = typeof cycles === "number" ? cycles : cycles(u);
      ph += (cyc * TAU) / n;
      const a = typeof amp === "number" ? amp : amp(u);
      const px = x0 + (x1 - x0) * u;
      const py = y + Math.sin(ph) * a;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
  }, color, width);
}

/** Speed lines trailing behind a point moving in direction `dir` (radians). */
export function speedLines(f: Frame, x: number, y: number, dir: number, len: number, spread: number, n: number, k: number, color = f.ink) {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (spread / Math.max(1, n - 1));
    const l = len * (0.55 + 0.45 * rand(i, 7)) * k;
    const px = x - Math.sin(dir) * off;
    const py = y + Math.cos(dir) * off;
    line(f, px - Math.cos(dir) * l * 0.15, py - Math.sin(dir) * l * 0.15, px - Math.cos(dir) * l, py - Math.sin(dir) * l, alpha(color, 0.25 + 0.6 * k));
  }
}

/** Shake offset for hits: scaled by level, deterministic from time. */
export function shake(f: Frame, amount: number) {
  if (!f.playing) return [0, 0] as const;
  const a = amount * f.s * f.level;
  return [(rand(Math.floor(f.time * 60), 3) - 0.5) * a, (rand(Math.floor(f.time * 60), 9) - 0.5) * a] as const;
}

/** Run `draw` with the canvas translated / rotated / scaled about (x, y). */
export function withT(f: Frame, x: number, y: number, rot: number, scale: number, draw: () => void) {
  const { ctx } = f;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  draw();
  ctx.restore();
}

/** Text in the display font, centred. */
export function label(f: Frame, text: string, x: number, y: number, size: number, color = f.ink, weight = 700, family = "ui-sans-serif, system-ui, sans-serif") {
  const { ctx } = f;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
