import { useId } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { exitOut, glowStyle } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  title: string;
  subtitle: string;
  scene: string;
  palette: string;
  sprite: string;
  resolution: number;
  spriteFps: number;
  speed: number;
  crt: boolean;
  seed: number;
};

type Palette = {
  /** Day sky, top to horizon. */
  sky: string[];
  /** Night / space sky, top to horizon. */
  night: string[];
  sun: string;
  /** Synthwave sun: horizontal cuts through its lower half. */
  sunStripes: boolean;
  cloud: string;
  far: string;
  farShade: string;
  mid: string;
  midShade: string;
  grass: string;
  ground: string;
  groundDark: string;
  cityFar: string;
  cityNear: string;
  road: string;
  window: string;
  text: string;
  textAlt: string;
  outline: string;
  star: string;
  main: string;
  skin: string;
  dark: string;
  accent: string;
  planet: string;
  planetShade: string;
  surface: string;
  surfaceDark: string;
};

const GB = ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"];

const PALETTES: Record<string, Palette> = {
  pico8: {
    sky: ["#1d2b53", "#29adff", "#29adff", "#ffccaa"],
    night: ["#000000", "#1d2b53", "#1d2b53", "#7e2553"],
    sun: "#ffec27",
    sunStripes: false,
    cloud: "#fff1e8",
    far: "#83769c",
    farShade: "#5f574f",
    mid: "#008751",
    midShade: "#1d2b53",
    grass: "#00e436",
    ground: "#ab5236",
    groundDark: "#5f574f",
    cityFar: "#7e2553",
    cityNear: "#000000",
    road: "#5f574f",
    window: "#ffa300",
    text: "#fff1e8",
    textAlt: "#ffec27",
    outline: "#000000",
    star: "#fff1e8",
    main: "#ff004d",
    skin: "#ffccaa",
    dark: "#1d2b53",
    accent: "#29adff",
    planet: "#ff77a8",
    planetShade: "#7e2553",
    surface: "#83769c",
    surfaceDark: "#5f574f",
  },
  nes: {
    sky: ["#0058f8", "#0078f8", "#3cbcfc", "#a4e4fc"],
    night: ["#000000", "#00005c", "#0000bc", "#4428bc"],
    sun: "#f8b800",
    sunStripes: false,
    cloud: "#fcfcfc",
    far: "#9878f8",
    farShade: "#6844fc",
    mid: "#00a800",
    midShade: "#005800",
    grass: "#b8f8b8",
    ground: "#ac7c00",
    groundDark: "#503000",
    cityFar: "#6844fc",
    cityNear: "#000000",
    road: "#7c7c7c",
    window: "#f8b800",
    text: "#fcfcfc",
    textAlt: "#f8b800",
    outline: "#000000",
    star: "#fcfcfc",
    main: "#e40058",
    skin: "#fca044",
    dark: "#000000",
    accent: "#3cbcfc",
    planet: "#e45c10",
    planetShade: "#a81000",
    surface: "#bcbcbc",
    surfaceDark: "#7c7c7c",
  },
  gameboy: {
    sky: [GB[3], GB[3], GB[3], GB[2]],
    night: [GB[0], GB[0], GB[1], GB[1]],
    sun: GB[2],
    sunStripes: false,
    cloud: GB[2],
    far: GB[2],
    farShade: GB[1],
    mid: GB[1],
    midShade: GB[0],
    grass: GB[2],
    ground: GB[1],
    groundDark: GB[0],
    cityFar: GB[1],
    cityNear: GB[0],
    road: GB[1],
    window: GB[3],
    text: GB[3],
    textAlt: GB[2],
    outline: GB[0],
    star: GB[3],
    main: GB[0],
    skin: GB[2],
    dark: GB[0],
    accent: GB[3],
    planet: GB[2],
    planetShade: GB[1],
    surface: GB[1],
    surfaceDark: GB[0],
  },
  sunset: {
    sky: ["#2b0f54", "#ab1f65", "#ff4f69", "#ff8142"],
    night: ["#0d0221", "#0d0221", "#2b0f54", "#53115e"],
    sun: "#ffda45",
    sunStripes: true,
    cloud: "#ff8142",
    far: "#53115e",
    farShade: "#2b0f54",
    mid: "#2b0f54",
    midShade: "#1a0b3b",
    grass: "#ff4f69",
    ground: "#1a0b3b",
    groundDark: "#0d0221",
    cityFar: "#53115e",
    cityNear: "#1a0b3b",
    road: "#1a0b3b",
    window: "#49e7ec",
    text: "#fff3d6",
    textAlt: "#49e7ec",
    outline: "#0d0221",
    star: "#fff3d6",
    main: "#49e7ec",
    skin: "#fff3d6",
    dark: "#0d0221",
    accent: "#ff4f69",
    planet: "#ff4f69",
    planetShade: "#53115e",
    surface: "#53115e",
    surfaceDark: "#2b0f54",
  },
};

// A 5×7 bitmap font: each glyph is 7 rows, 5 bits per row (bit 4 is the left column).
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x11, 0x0a, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "/": [0, 0x01, 0x02, 0x04, 0x08, 0x10, 0],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "%": [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
  "@": [0x0e, 0x11, 0x17, 0x15, 0x17, 0x10, 0x0f],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  _: [0, 0, 0, 0, 0, 0, 0x1f],
};

// Sprites: "." transparent, a main, s skin, d dark, w text, y text alt, e accent.
const RUNNER_HEAD = ["...aaaa..", "..aaaaaaa", "..ssssds.", "..sssss.."];
const RUNNER_ARMS = [
  ["..aaaaa..", ".saaaaa.s", "..aaaaa.."],
  ["..aaaaa..", "..saaaas.", "..aaaaa.."],
];
const RUNNER_LEGS = [
  ["..dd.dd..", ".dd...dd.", ".d.....d.", "dd.....dd"],
  ["..ddddd..", "..dd.dd..", ".dd...d..", ".d....dd."],
  ["...ddd...", "...ddd...", "...dd....", "...ddd..."],
  ["..dd.dd..", ".dd...dd.", ".d.....d.", "dd.....dd"],
  ["..ddddd..", "..dd.dd..", "..d...dd.", ".dd....d."],
  ["...ddd...", "...ddd...", "....dd...", "...ddd..."],
];
const RUNNER_BOB = [0, 0, -1, 0, 0, -1];
const SHIP = [
  "...aa.......",
  "..aaaa......",
  "aaaaaaaaww..",
  "aeaaaaaawwa.",
  "aaaaaaaaaaa.",
  "..aaaa......",
  "...aa.......",
];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const threshold = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Seeded integer hash → [0, 1): the same on the server and every client. */
function hash(seed: number, a: number, b = 0, c = 0) {
  let h =
    Math.imul(a | 0, 374761393) ^
    Math.imul(b | 0, 668265263) ^
    Math.imul(c | 0, 1274126177) ^
    Math.imul((seed | 0) + 101, 1597334677);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A low-res frame buffer of palette ids, drawn out as one SVG path per color. */
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Int16Array;
  private readonly colors: string[] = [];
  private readonly ids = new Map<string, number>();

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Int16Array(w * h).fill(-1);
  }

  id(color: string) {
    let i = this.ids.get(color);
    if (i === undefined) {
      i = this.colors.length;
      this.colors.push(color);
      this.ids.set(color, i);
    }
    return i;
  }

  set(x: number, y: number, id: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = id;
  }

  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return this.px[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, id: number) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, id);
  }

  disc(cx: number, cy: number, r: number, id: number, maxY = Infinity) {
    const rr = r * r + r * 0.8;
    for (let dy = -r; dy <= r; dy++) {
      if (cy + dy > maxY) continue;
      for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= rr) this.set(cx + dx, cy + dy, id);
    }
  }

  /** Horizontal runs of one color merged into rectangles, one path per color. */
  paths() {
    const d: string[][] = this.colors.map(() => []);
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const id = this.px[y * this.w + x];
        let end = x + 1;
        while (end < this.w && this.px[y * this.w + end] === id) end++;
        if (id >= 0) d[id].push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
        x = end;
      }
    }
    return this.colors.map((color, i) => ({ color, d: d[i].join("") })).filter((p) => p.d);
  }
}

type Ctx = {
  cv: Canvas;
  pal: Palette;
  vw: number;
  vh: number;
  gY: number;
  step: number;
  seed: number;
  /** Parallax offset in whole pixels for a layer moving at `f` × the scroll speed. */
  o: (f: number) => number;
};

/** A vertical gradient through the colors, solid in each band then Bayer-dithered into the next. */
function skyFill({ cv, vw }: Ctx, colors: string[], top: number, bottom: number) {
  const ids = colors.map((c) => cv.id(c));
  const n = ids.length;
  for (let y = top; y < bottom; y++) {
    const v = ((y - top) / Math.max(1, bottom - top - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(v));
    const f = clamp01((v - i - 0.5) / 0.5);
    for (let x = 0; x < vw; x++) cv.set(x, y, f > threshold(x, y) ? ids[i + 1] : ids[i]);
  }
}

function paintHills(ctx: Ctx, vertical: boolean) {
  const { cv, pal, vw, vh, gY, seed, o } = ctx;
  skyFill(ctx, pal.sky, 0, gY);

  // Sun, sitting behind the far mountains.
  const sun = cv.id(pal.sun);
  const sr = Math.max(5, Math.round(Math.min(vw, vh) * 0.13));
  const sx = Math.round(vw * (vertical ? 0.7 : 0.74));
  const sy = Math.round(vh * (vertical ? 0.55 : 0.5));
  for (let dy = -sr; dy <= sr; dy++) {
    if (pal.sunStripes && dy > 0 && (dy % 4 === 0 || (dy % 4 === 1 && dy > sr * 0.5))) continue;
    for (let dx = -sr; dx <= sr; dx++) if (dx * dx + dy * dy <= sr * sr + sr * 0.8) cv.set(sx + dx, sy + dy, sun);
  }

  // Clouds drifting slowly.
  const cloud = cv.id(pal.cloud);
  for (let i = 0; i < 4; i++) {
    const cw = 10 + Math.floor(hash(seed, i, 1) * 10);
    const base = Math.floor(hash(seed, i, 2) * (vw + 40));
    const y = Math.floor(vh * (0.07 + hash(seed, i, 3) * 0.26));
    const x = mod(base - o(0.12 + i * 0.04), vw + 40) - 20;
    cv.rect(x, y + 3, cw, 2, cloud);
    cv.disc(x + 3, y + 3, 2, cloud, y + 4);
    cv.disc(x + Math.floor(cw * 0.45), y + 2, 3, cloud, y + 4);
    cv.disc(x + cw - 4, y + 3, 2, cloud, y + 4);
  }

  // Far mountains: sharp peaks, lit on the left, with snow on the tall ones.
  const far = cv.id(pal.far);
  const farShade = cv.id(pal.farShade);
  const P = Math.max(24, Math.round(vh * 0.38));
  const of = o(0.25);
  for (let x = 0; x < vw; x++) {
    const wx = x + of;
    const k0 = Math.floor(wx / P);
    let top = Infinity;
    let peakX = 0;
    let peakTop = 0;
    let snowy = false;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const cx = k * P + Math.floor(hash(seed, k, 5) * P * 0.6);
      const pt = Math.floor(vh * (0.34 + hash(seed, k, 6) * 0.18));
      const y = pt + Math.abs(wx - cx);
      if (y < top) {
        top = y;
        peakX = cx;
        peakTop = pt;
        snowy = pt < vh * 0.42;
      }
    }
    for (let y = Math.max(0, top); y < gY; y++) {
      const snow = snowy && y < peakTop + 3 + (wx % 2);
      cv.set(x, y, snow ? cloud : wx < peakX ? far : farShade);
    }
  }

  // Mid hills: rolling, dithered darker toward their base, with a few trees.
  const mid = cv.id(pal.mid);
  const midShade = cv.id(pal.midShade);
  const grass = cv.id(pal.grass);
  const om = o(0.5);
  const s1 = hash(seed, 1, 40) * 6.28;
  const s2 = hash(seed, 2, 40) * 6.28;
  const hillTop = (wx: number) =>
    Math.round(vh * 0.64 + 3 * Math.sin(wx * 0.045 + s1) + 2 * Math.sin(wx * 0.11 + s2));
  for (let x = 0; x < vw; x++) {
    const wx = x + om;
    const top = hillTop(wx);
    for (let y = top; y < gY; y++) {
      const depth = y - top;
      const c =
        depth === 0 ? grass : depth < 6 ? mid : depth < 10 ? ((depth - 6) / 4 > threshold(x, y) ? midShade : mid) : midShade;
      cv.set(x, y, c);
    }
  }
  const T = 23;
  for (let k = Math.floor(om / T) - 1; k <= Math.floor((om + vw) / T) + 1; k++) {
    if (hash(seed, k, 41) < 0.45) continue;
    const wx = k * T + Math.floor(hash(seed, k, 42) * 12);
    const x = wx - om;
    const top = hillTop(wx);
    cv.rect(x, top - 2, 1, 2, midShade);
    cv.disc(x, top - 4, 2, midShade);
    cv.set(x - 1, top - 5, mid);
  }

  // Near ground: grass edge with tufts, dirt with speckles.
  const ground = cv.id(pal.ground);
  const groundDark = cv.id(pal.groundDark);
  const on = o(1);
  for (let x = 0; x < vw; x++) {
    const wx = x + on;
    if (hash(seed, wx, 8) < 0.14) cv.set(x, gY - 1, grass);
    for (let y = gY; y < vh; y++) {
      const dpt = y - gY;
      let c = ground;
      if (dpt === 0) c = grass;
      else if (dpt === 1) c = hash(seed, wx, 7) < 0.5 ? grass : ground;
      else if (dpt === 2) c = hash(seed, wx, 9) < 0.4 ? groundDark : ground;
      else if (hash(seed, wx, y) < 0.07) c = groundDark;
      cv.set(x, y, c);
    }
  }
}

function paintCity(ctx: Ctx) {
  const { cv, pal, vw, vh, gY, step, seed, o } = ctx;
  skyFill(ctx, pal.night, 0, gY);

  // Twinkling stars and a crescent moon.
  const star = cv.id(pal.star);
  const nStars = Math.floor((vw * vh) / 110);
  for (let i = 0; i < nStars; i++) {
    const x = Math.floor(hash(seed, i, 10) * vw);
    const y = Math.floor(hash(seed, i, 11) * gY * 0.6);
    const tw = hash(seed, i, Math.floor(step / 3) + 100);
    if (tw < 0.25) continue;
    cv.set(x, y, star);
    if (hash(seed, i, 12) > 0.92 && tw > 0.6) {
      cv.set(x - 1, y, star);
      cv.set(x + 1, y, star);
      cv.set(x, y - 1, star);
      cv.set(x, y + 1, star);
    }
  }
  const mr = Math.max(3, Math.round(Math.min(vw, vh) * 0.075));
  const mx = Math.round(vw * 0.8);
  const my = Math.round(vh * 0.16);
  for (let dy = -mr; dy <= mr; dy++)
    for (let dx = -mr; dx <= mr; dx++) {
      const inA = dx * dx + dy * dy <= mr * mr + mr * 0.8;
      const bx = dx + Math.round(mr * 0.5);
      const by = dy + Math.round(mr * 0.25);
      if (inA && bx * bx + by * by > mr * mr) cv.set(mx + dx, my + dy, star);
    }

  // Far skyline with flickering windows and antenna lights.
  const cityFar = cv.id(pal.cityFar);
  const win = cv.id(pal.window);
  const accent = cv.id(pal.accent);
  const of = o(0.25);
  for (let x = 0; x < vw; x++) {
    const wx = x + of;
    const k = Math.floor(wx / 10);
    const local = mod(wx, 10);
    const bw = 6 + Math.floor(hash(seed, k, 20) * 4);
    if (local >= bw) continue;
    const top = gY - Math.floor(vh * (0.22 + hash(seed, k, 21) * 0.26));
    for (let y = top; y < gY; y++) {
      const lit =
        local >= 1 && local < bw - 1 && local % 2 === 1 && (y - top) % 3 === 1 && y > top + 1 &&
        hash(seed, k * 31 + local, y, Math.floor(step / 25)) < 0.22;
      cv.set(x, y, lit ? win : cityFar);
    }
    if (hash(seed, k, 22) > 0.65 && local === Math.floor(bw / 2)) {
      for (let y = top - 4; y < top; y++) cv.set(x, y, cityFar);
      if (Math.floor(step / 5) % 2 === 0) cv.set(x, top - 5, accent);
    }
  }

  // Near buildings: a lighter roof edge and a grid of lit windows.
  const cityNear = cv.id(pal.cityNear);
  const om = o(0.5);
  for (let x = 0; x < vw; x++) {
    const wx = x + om;
    const k = Math.floor(wx / 18);
    const local = mod(wx, 18);
    const bw = 11 + Math.floor(hash(seed, k, 23) * 6);
    if (local >= bw) continue;
    const top = gY - Math.floor(vh * (0.12 + hash(seed, k, 24) * 0.22));
    for (let y = top; y < gY; y++) {
      let c = y === top ? cityFar : cityNear;
      if (local >= 2 && local < bw - 2 && (local - 2) % 3 < 2 && y > top + 2 && y < gY - 2 && (y - top - 3) % 4 < 2) {
        const lit = hash(seed, k * 7 + Math.floor((local - 2) / 3), Math.floor((y - top - 3) / 4), 31 + Math.floor(step / 40));
        if (lit < 0.45) c = win;
      }
      cv.set(x, y, c);
    }
  }

  // Street: a curb line, the road and moving lane dashes.
  const road = cv.id(pal.road);
  const on = o(1);
  const lane = gY + Math.max(3, Math.floor((vh - gY) / 2));
  for (let x = 0; x < vw; x++) {
    const wx = x + on;
    for (let y = gY; y < vh; y++) {
      let c = y === gY ? cityFar : road;
      if (y === lane && mod(wx, 14) < 6) c = win;
      cv.set(x, y, c);
    }
  }
}

function paintSpace(ctx: Ctx) {
  const { cv, pal, vw, vh, gY, step, seed } = ctx;
  skyFill(ctx, [pal.night[0], pal.night[0], pal.night[1], pal.night[2]], 0, gY);

  // Three layers of stars scrolling at different speeds.
  const layers = [
    { color: cv.id(pal.far), sp: 0.15, n: (vw * vh) / 70 },
    { color: cv.id(pal.star), sp: 0.4, n: (vw * vh) / 140 },
    { color: cv.id(pal.textAlt), sp: 0.9, n: (vw * vh) / 400 },
  ];
  layers.forEach((layer, l) => {
    const off = ctx.o(layer.sp);
    for (let i = 0; i < Math.floor(layer.n); i++) {
      const x = mod(Math.floor(hash(seed, i, 50 + l) * vw * 3) - off, vw);
      const y = Math.floor(hash(seed, i, 60 + l) * gY);
      if (l === 1 && hash(seed, i, Math.floor(step / 4) + 200) < 0.2) continue;
      cv.set(x, y, layer.color);
      if (l === 2) cv.set(x + 1, y, layer.color);
    }
  });

  // A dithered planet with a tilted ring.
  const planet = cv.id(pal.planet);
  const planetShade = cv.id(pal.planetShade);
  const ring = cv.id(pal.textAlt);
  const r = Math.max(6, Math.round(Math.min(vw, vh) * 0.17));
  const cx = Math.round(vw * 0.74);
  const cy = Math.round(vh * 0.3);
  const inPlanet = (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.8;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      if (!inPlanet(cx + dx, cy + dy)) continue;
      const shade = clamp01((((dx / r) * 0.8 + (dy / r) * 0.5) + 0.1) / 0.6);
      cv.set(cx + dx, cy + dy, shade > threshold(cx + dx, cy + dy) ? planetShade : planet);
    }
  const rx = Math.round(r * 1.9);
  const ry = Math.max(2, Math.round(r * 0.42));
  for (let dx = -rx; dx <= rx; dx++) {
    const e = Math.round(ry * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2)));
    const tilt = Math.round(dx * 0.22);
    const x = cx + dx;
    const back = cy - e + tilt;
    const front = cy + e + tilt;
    if (!inPlanet(x, back)) cv.set(x, back, ring);
    cv.set(x, front, ring);
  }

  // Cratered surface.
  const surface = cv.id(pal.surface);
  const surfaceDark = cv.id(pal.surfaceDark);
  const edge = cv.id(pal.cloud);
  const on = ctx.o(1);
  for (let x = 0; x < vw; x++) {
    const wx = x + on;
    const top = gY + Math.round(1.5 * Math.sin(wx * 0.09) + Math.sin(wx * 0.23 + 1));
    for (let y = top; y < vh; y++) cv.set(x, y, y === top ? edge : surface);
    const k = Math.floor(wx / 22);
    const ccx = k * 22 + 4 + Math.floor(hash(seed, k, 70) * 10);
    const cw = 5 + Math.floor(hash(seed, k, 71) * 5);
    const ccy = gY + 4 + Math.floor(hash(seed, k, 72) * Math.max(1, vh - gY - 8));
    if (Math.abs(wx - ccx) < cw / 2) {
      cv.set(x, ccy, surfaceDark);
      if (Math.abs(wx - ccx) < cw / 2 - 1) cv.set(x, ccy + 1, surfaceDark);
    }
  }
}

function drawSprite(cv: Canvas, rows: string[], x: number, y: number, map: Record<string, number>) {
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const id = map[row[rx]];
      if (id !== undefined) cv.set(x + rx, y + ry, id);
    }
  });
}

function drawCoin(cv: Canvas, pal: Palette, x: number, y: number, f: number) {
  const w = Math.max(1, Math.round(8 * Math.abs(Math.cos((f * Math.PI) / 4))));
  const fillId = cv.id(pal.textAlt);
  const edge = cv.id(pal.outline);
  const shine = cv.id(pal.text);
  for (let r = 0; r < 8; r++) {
    const half = Math.max(0.5, (w / 2) * Math.sqrt(Math.max(0, 1 - ((r - 3.5) / 4) ** 2)));
    const left = Math.round(x + 4 - half);
    const right = Math.round(x + 4 + half) - 1;
    for (let xx = left; xx <= right; xx++) {
      const isEdge = xx === left || xx === right || r === 0 || r === 7;
      cv.set(xx, y + r, isEdge ? edge : w > 3 && xx === left + 1 && r > 1 && r < 6 ? shine : fillId);
    }
  }
}

/** Greedy word wrap of `text` into lines of at most `max` characters (long words are cut). */
function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let wd = word;
    while (wd.length > max) {
      if (line) lines.push(line);
      lines.push(wd.slice(0, max));
      wd = wd.slice(max);
      line = "";
    }
    if (!line) line = wd;
    else if (line.length + 1 + wd.length <= max) line += ` ${wd}`;
    else {
      lines.push(line);
      line = wd;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws text into the mask (palette ids), 5×7 glyphs at an integer scale. Top rows `top`, bottom rows `bottom`. */
function drawText(mask: Int16Array, w: number, h: number, text: string, x0: number, y0: number, s: number, top: number, bottom: number) {
  for (let i = 0; i < text.length; i++) {
    const glyph = FONT[text[i]] ?? FONT["?"];
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++) {
        if (!(glyph[r] & (1 << (4 - c)))) continue;
        for (let yy = 0; yy < s; yy++)
          for (let xx = 0; xx < s; xx++) {
            const px = x0 + (i * 6 + c) * s + xx;
            const py = y0 + r * s + yy;
            if (px >= 0 && py >= 0 && px < w && py < h) mask[py * w + px] = r < 4 ? top : bottom;
          }
      }
  }
}

/**
 * A retro game title screen on a low-res pixel canvas: Bayer-dithered sky, parallax layers scrolling in
 * whole pixels, a stepped sprite animation, a bitmap-font title that drops in with a bounce and a
 * blinking "press start", with optional CRT scanlines. Fades in and out with a dithered dissolve.
 */
export function ArcadeTitle(props: Props) {
  const frame = useCurrentFrame();
  const scanId = `px${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { width, height, fps, durationInFrames: d } = props;
  const pal = PALETTES[props.palette] ?? PALETTES.pico8;
  const res = Math.max(40, Math.round(props.resolution));
  const scale = Math.min(width, height) / res;
  const vw = Math.ceil(width / scale);
  const vh = Math.ceil(height / scale);
  const vertical = height > width;
  const step = Math.floor((frame * props.spriteFps) / fps);
  const seed = Math.round(props.seed);
  const gY = Math.floor(vh * (vertical ? 0.8 : 0.79));
  const cv = new Canvas(vw, vh);
  const ctx: Ctx = { cv, pal, vw, vh, gY, step, seed, o: (f) => Math.floor(step * props.speed * f) };

  if (props.scene === "city") paintCity(ctx);
  else if (props.scene === "space") paintSpace(ctx);
  else paintHills(ctx, vertical);

  // The sprite.
  const map: Record<string, number> = {
    a: cv.id(pal.main),
    s: cv.id(pal.skin),
    d: cv.id(pal.dark),
    w: cv.id(pal.text),
    y: cv.id(pal.textAlt),
    e: cv.id(pal.accent),
  };
  const sprite = props.sprite === "auto" ? (props.scene === "space" ? "ship" : "runner") : props.sprite;
  if (sprite === "runner") {
    const f = step % 6;
    const rows = [...RUNNER_HEAD, ...RUNNER_ARMS[f < 3 ? 0 : 1], ...RUNNER_LEGS[f]];
    const x = Math.min(Math.floor(vw * 0.2), -10 + step * 3);
    drawSprite(cv, rows, x, gY - rows.length + RUNNER_BOB[f], map);
  } else if (sprite === "ship") {
    const x = Math.min(Math.floor(vw * 0.2), -14 + step * 3);
    const y = Math.floor(vh * (props.scene === "space" ? 0.62 : 0.6)) + Math.round(2 * Math.sin(step * 0.5));
    const flick = 2 + (step % 3);
    for (let i = 1; i <= flick; i++) cv.set(x - i, y + 3, i <= 2 ? map.y : map.e);
    for (let i = 1; i <= flick - 2; i++) {
      cv.set(x - i, y + 2, map.y);
      cv.set(x - i, y + 4, map.y);
    }
    drawSprite(cv, SHIP, x, y, map);
  } else if (sprite === "coins") {
    const on = ctx.o(1);
    const gap = 16;
    const y = (props.scene === "space" ? Math.floor(vh * 0.6) : gY - 14) + (Math.floor(step / 3) % 2);
    for (let k = Math.floor(on / gap); k <= Math.floor((on + vw) / gap) + 1; k++) {
      if (hash(seed, k, 80) < 0.3) continue;
      drawCoin(cv, pal, k * gap - on, y, step + k * 2);
    }
  }

  // The title and the blinking subtitle, outlined so they read on any scene.
  const title = props.title.toUpperCase().trim();
  const subtitle = props.subtitle.toUpperCase().trim();
  const mask = new Int16Array(vw * vh).fill(-1);
  const textId = cv.id(pal.text);
  const textAlt = cv.id(pal.textAlt);
  const outline = cv.id(pal.outline);
  let titleBottom = Math.round(vh * 0.28);
  let landed = 4;
  if (title) {
    let s = 1;
    let lines = [title];
    for (let tryS = 5; tryS >= 1; tryS--) {
      const max = Math.floor((vw * 0.9 + tryS) / (6 * tryS));
      const words = title.split(/\s+/);
      if (max < 1 || words.some((w) => w.length > max)) continue;
      const wrapped = wrap(title, max);
      if (wrapped.length * 9 * tryS <= vh * (vertical ? 0.36 : 0.42) && wrapped.length <= 3) {
        s = tryS;
        lines = wrapped;
        break;
      }
      if (tryS === 1) lines = wrapped;
    }
    const lineH = 9 * s;
    const ty = Math.round(vh * (vertical ? 0.2 : 0.17));
    const bounce = [-2, -3, -2, 0, -1, 0];
    lines.forEach((line, li) => {
      const start = 3 + li * 2;
      const t = step - start;
      if (t < 0) return;
      const drop = ty + (li + 1) * lineH + 4;
      const off = t <= 5 ? -Math.round(drop * (1 - (t / 5) ** 2)) : t - 6 < bounce.length ? bounce[t - 6] * s : 0;
      const lw = (line.length * 6 - 1) * s;
      drawText(mask, vw, vh, line, Math.round((vw - lw) / 2), ty + li * lineH + off, s, textId, textAlt);
    });
    titleBottom = ty + lines.length * lineH - 2 * s;
    landed = 3 + (lines.length - 1) * 2 + 12;
  }
  if (subtitle) {
    const start = landed + 2;
    if (step >= start && (step - start) % 8 < 5) {
      const ss = vw >= 220 ? 2 : 1;
      const lw = (subtitle.length * 6 - 1) * ss;
      const sy = title ? titleBottom + Math.max(6, Math.round(vh * 0.06)) : Math.round(vh * 0.4);
      drawText(mask, vw, vh, subtitle, Math.round((vw - lw) / 2), sy, ss, textId, textId);
    }
  }
  const OUTLINE = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2], [1, 2]];
  for (let y = 0; y < vh; y++)
    for (let x = 0; x < vw; x++) {
      if (mask[y * vw + x] < 0) continue;
      for (const [dx, dy] of OUTLINE) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < vw && ny < vh && mask[ny * vw + nx] < 0) cv.set(nx, ny, outline);
      }
    }
  for (let i = 0; i < mask.length; i++) if (mask[i] >= 0) cv.px[i] = mask[i];

  // Dithered dissolve from black at the start and to black at the end.
  const black = outline;
  const fadeIn = clamp01(step / 4);
  const fadeOut = exitOut(frame, d, 12);
  const shown = Math.min(fadeIn, fadeOut);
  if (shown < 1)
    for (let y = 0; y < vh; y++) for (let x = 0; x < vw; x++) if (threshold(x, y) >= shown) cv.set(x, y, black);

  const paths = cv.paths();
  const pxSize = Math.max(width / vw, height / vh);
  const offY = (height - vh * pxSize) / 2;
  const round = (v: number) => Math.round(v * 100) / 100;

  return (
    <AbsoluteFill style={{ background: pal.outline }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        style={{ position: "absolute", inset: 0 }}
      >
        {paths.map((p) => (
          <path key={p.color} d={p.d} fill={p.color} />
        ))}
      </svg>
      {props.crt ? (
        <>
          <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <pattern id={scanId} width={8} height={round(pxSize)} y={round(offY)} patternUnits="userSpaceOnUse">
                <rect y={round(pxSize * 0.62)} width={8} height={round(pxSize * 0.38)} fill="#000000" fillOpacity={0.28} />
              </pattern>
            </defs>
            <rect width={width} height={height} fill={`url(#${scanId})`} />
          </svg>
          <div style={glowStyle(width / 2, height / 2, width * 1.1, height * 1.1, pal.accent, 0.08)} />
          <AbsoluteFill
            style={{ background: "radial-gradient(rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.5) 100%)" }}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
}
