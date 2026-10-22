// Art-punk cut-paper kit: palette, seeded randomness, stop-motion timing, torn paper, tape, beats.
// Everything is clip-path polygons + <Img> textures so the browser export draws it.
import React from "react";
import { Img } from "remotion";
import { asset } from "agentcut";
import { BEATS } from "./beats";

export const P = {
  paper: "#EFE8D8",
  cream: "#F4ECDC",
  white: "#FBF8F1",
  ink: "#141312",
  red: "#E2332A",
  pink: "#FF4F9A",
  yellow: "#FFD21F",
  orange: "#F07A22",
  teal: "#13A89A",
  green: "#3E9B3A",
  blue: "#2A5FD8",
  kraft: "#C49A6C",
};
export const ACCENTS = [P.red, P.pink, P.yellow, P.orange, P.teal, P.blue];

// ransom-note faces: [family, size multiplier, uppercase?]
export const FACES: [string, number, boolean][] = [
  ["Anton", 1.0, true],
  ["Archivo Black", 0.78, true],
  ["Special Elite", 0.86, false],
  ["Abril Fatface", 0.88, false],
  ["Permanent Marker", 0.82, true],
  ["Rubik Mono One", 0.66, true],
  ["Courier Prime", 0.86, false],
];

// chip looks: [bg, fg, texture]
export const CHIPS: [string, string, Tex | null][] = [
  [P.ink, P.white, null],
  [P.white, P.ink, "white"],
  [P.cream, P.ink, "newsprint"],
  [P.yellow, P.ink, null],
  [P.red, P.white, null],
  [P.pink, P.ink, null],
  [P.cream, P.red, "cream"],
  [P.teal, P.white, null],
  [P.kraft, P.ink, "kraft"],
  [P.orange, P.ink, null],
];

// ---------- seeded randomness ----------
export function rand(seed: number) {
  let a = (Math.floor(seed) * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (a: number, b = 0) => rand(a * 7919 + b * 104729 + 13)();
export const strSeed = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100000;
};

// ---------- stop-motion time ----------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const backOut = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
/** Frame quantised to 12 fps. */
export const q12 = (f: number) => Math.floor(f / 2.5) * 2.5;
/** Progress 0..1 from t0 over dur frames, sampled at 12 fps. */
export function st(f: number, t0: number, dur: number, ease: (t: number) => number = easeOut) {
  return ease(clamp01((q12(f) - t0) / dur));
}
/** Hand-placed wobble that changes on 12 fps steps. */
export function jit(seed: number, f: number, amp = 2) {
  const k = Math.floor(f / 2.5);
  return {
    x: (hash(seed, k) * 2 - 1) * amp,
    y: (hash(seed + 31, k) * 2 - 1) * amp,
    r: (hash(seed + 67, k) * 2 - 1) * amp * 0.25,
  };
}
/** Slap landing with a stepped overshoot. */
export function slap(f: number, t0: number, s0 = 1.6) {
  if (f < t0) return { s: s0, o: 0 };
  const steps = [s0, 0.9, 1.06, 0.98, 1];
  const i = Math.min(steps.length - 1, Math.floor((f - t0) / 2));
  return { s: steps[i], o: 1 };
}

// ---------- beats (absolute frames) ----------
export function beatIndex(abs: number) {
  let lo = 0, hi = BEATS.length - 1, ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (BEATS[m] <= abs) { ans = m; lo = m + 1; } else hi = m - 1;
  }
  return ans;
}
/** 1 on a strong beat, decaying to 0 over `decay` frames. */
export function beatPulse(abs: number, decay = 8) {
  const i = beatIndex(abs);
  if (i < 0) return 0;
  const d = abs - BEATS[i];
  return d > decay ? 0 : 1 - d / decay;
}

// ---------- torn / cut outlines ----------
export function outline(w: number, h: number, seed: number, kind: "tear" | "cut" = "cut", inset = 0, sides = "trbl") {
  const r = rand(seed);
  const pts: string[] = [];
  const step = kind === "tear" ? 10 : 60;
  const amp = kind === "tear" ? Math.min(6, Math.max(2.5, Math.min(w, h) * 0.03)) : 2.4;
  const edge = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, rough: boolean) => {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.min(90, Math.round(L / (kind === "tear" ? step : step + r() * 70))));
    let lf = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      lf = lf * 0.7 + (r() * 2 - 1) * 0.3;
      const d = rough ? inset + amp * (kind === "tear" ? r() * 1.4 + lf * 1.6 : r() * 2 - 0.4) : inset;
      const x = x0 + (x1 - x0) * t + nx * d;
      const y = y0 + (y1 - y0) * t + ny * d;
      pts.push(`${((x / w) * 100).toFixed(2)}% ${((y / h) * 100).toFixed(2)}%`);
    }
  };
  edge(0, 0, w, 0, 0, 1, sides.includes("t"));
  edge(w, 0, w, h, -1, 0, sides.includes("r"));
  edge(w, h, 0, h, 0, -1, sides.includes("b"));
  edge(0, h, 0, 0, 1, 0, sides.includes("l"));
  return `polygon(${pts.join(",")})`;
}

export type Tex = "cream" | "white" | "newsprint" | "kraft";
const TEX: Record<Tex, string> = {
  cream: "assets/paper/paper-cream.jpg",
  white: "assets/paper/paper-white.jpg",
  newsprint: "assets/paper/newsprint.jpg",
  kraft: "assets/paper/kraft.jpg",
};

/** A piece of paper: contact shadow, optional white rim, textured face. */
export function Paper({ w, h, seed = 1, tex = null, color = P.cream, grain = 0.45, kind = "cut", sides = "trbl", rim = 0, rimColor = P.white, shadow = 1, style, children }: {
  w: number; h: number; seed?: number; tex?: Tex | null; color?: string; grain?: number; kind?: "tear" | "cut"; sides?: string;
  rim?: number; rimColor?: string; shadow?: number; style?: React.CSSProperties; children?: React.ReactNode;
}) {
  const outer = outline(w, h, seed, kind, 0, sides);
  const inner = rim > 0 ? outline(w, h, seed + 101, kind, rim, sides) : outer;
  const tw = Math.max(w, h, 1024);
  const ox = -((seed * 137) % Math.max(1, tw - w));
  const oy = -((seed * 211) % Math.max(1, tw - h));
  return (
    <div style={{ position: "absolute", width: w, height: h, ...style }}>
      {shadow > 0 ? (
        <div style={{ position: "absolute", left: 6 * shadow, top: 10 * shadow, width: w, height: h, background: "rgba(20,12,4,0.42)", clipPath: outer }} />
      ) : null}
      {rim > 0 ? <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, background: rimColor, clipPath: outer }} /> : null}
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, clipPath: inner, overflow: "hidden", background: color }}>
        {tex ? <Img src={asset(TEX[tex])} style={{ position: "absolute", left: ox, top: oy, width: tw, height: tw }} /> : null}
        {!tex && grain > 0 ? <Img src={asset("assets/paper/grain-overlay.png")} style={{ position: "absolute", left: ox, top: oy, width: tw, height: tw, opacity: grain }} /> : null}
        {children}
      </div>
    </div>
  );
}

export function Tape({ x, y, w = 150, rot = 0, o = 1, seed = 1 }: { x: number; y: number; w?: number; rot?: number; o?: number; seed?: number }) {
  const h = w * 0.25;
  return (
    <Img src={asset("assets/paper/tape.png")}
      style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `rotate(${rot}deg) scaleX(${seed % 2 ? -1 : 1})`, opacity: 0.92 * o }} />
  );
}

export function Halftone({ x, y, size, color = "black", o = 1, rot = 0 }: { x: number; y: number; size: number; color?: "red" | "black" | "yellow"; o?: number; rot?: number }) {
  return <Img src={asset(`assets/paper/halftone-${color}.png`)} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: o, transform: `rotate(${rot}deg)` }} />;
}

/** Layout areas (px) for the two halves of a beat: the words and the picture. */
export type Side = "left" | "right" | "center";
export function areas(width: number, height: number, side: Side) {
  const vertical = height > width;
  if (vertical) {
    return {
      text: { x: 60, y: height * 0.5, w: width - 120, h: height * 0.32 },
      pic: { cx: width / 2, cy: height * 0.29, size: Math.min(width * 0.86, height * 0.4) },
    };
  }
  if (side === "center") {
    return {
      text: { x: width * 0.1, y: height * 0.52, w: width * 0.8, h: height * 0.4 },
      pic: { cx: width / 2, cy: height * 0.3, size: height * 0.5 },
    };
  }
  const textLeft = side === "left";
  return {
    text: { x: textLeft ? width * 0.05 : width * 0.47, y: height * 0.14, w: width * 0.48, h: height * 0.72 },
    pic: { cx: textLeft ? width * 0.76 : width * 0.25, cy: height * 0.5, size: height * 0.74 },
  };
}
