// Charcoal sketch kit. Everything is graphite grey on paper; the mascot (Mascot) is the only colour.
// Lines are hand-wobbled polylines re-seeded on threes ("line boil"), drawn on with a progress 0..1.
// All coordinates live in a 1920x1080 SVG viewBox (wide only).
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { asset, ease } from "agentcut";

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const INK = "#2a2826";
export const INK_SOFT = "#5d5a56";
export const PAPER = "#E9E6DF";
export const HAND = "Cabin Sketch";
export const SCRIPT = "Caveat";
export const PRINT = "Patrick Hand";

/** boil index: changes every `every` frames (sketch elements animate on threes). */
export const boil = (f: number, every = 3) => Math.floor(f / every);
/** frame quantised to twos for drawn elements (the mascot moves on ones). */
export const twos = (f: number) => Math.floor(f / 2) * 2;
/** draw-on progress on twos. */
export const prog = (f: number, start: number, dur: number) => clamp((twos(f) - start) / dur, 0, 1);

export function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Pt = [number, number];

/** a hand-drawn line: slight bow, per-point wobble, overshoot at both ends. */
export function roughLine(a: Pt, b: Pt, seed: number, rough = 1): Pt[] {
  const r = rng(seed);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const over = (r() * 0.04 + 0.01) * Math.min(len, 400);
  const bow = (r() - 0.5) * Math.min(len, 600) * 0.025 * rough;
  const n = Math.max(4, Math.round(len / 28));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const tt = -over / len + t * (1 + (2 * over) / len);
    const off = Math.sin(Math.PI * t) * bow + (r() - 0.5) * 2.2 * rough;
    pts.push([a[0] + dx * tt + nx * off, a[1] + dy * tt + ny * off]);
  }
  return pts;
}

export function roughPoly(pts: Pt[], seed: number, closed = false, rough = 1): Pt[] {
  const out: Pt[] = [];
  const segs = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segs; i++) {
    const seg = roughLine(pts[i], pts[(i + 1) % pts.length], seed * 31 + i, rough);
    out.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return out;
}

export function roughEllipse(cx: number, cy: number, rx: number, ry: number, seed: number, rough = 1): Pt[] {
  const r = rng(seed);
  const start = r() * Math.PI * 2;
  const sweep = Math.PI * 2 * (1.06 + r() * 0.08); // sketchy circles overshoot
  const n = Math.max(18, Math.round((rx + ry) / 7));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = start + (sweep * i) / n;
    const k = 1 + (r() - 0.5) * 0.03 * rough + (i / n) * 0.04;
    pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
  }
  return pts;
}

/** keep the first fraction (by length) of a polyline. */
export function trim(pts: Pt[], p: number): Pt[] {
  if (p >= 1) return pts;
  if (p <= 0 || pts.length < 2) return [];
  let total = 0;
  const seg: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let want = total * p;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (want >= seg[i - 1]) {
      out.push(pts[i]);
      want -= seg[i - 1];
    } else {
      const t = want / seg[i - 1];
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]);
      break;
    }
  }
  return out;
}

export function toD(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  d += ` L${l[0].toFixed(1)},${l[1].toFixed(1)}`;
  return d;
}

type StrokeStyle = { sw?: number; o?: number; color?: string; passes?: number };

/** draws one shape (given as a generator of points per seed) in 1–3 charcoal passes. */
function Passes({ make, p, sw = 3.2, o = 0.9, color = INK, passes = 2, seed }: StrokeStyle & {
  make: (seed: number) => Pt[];
  p: number;
  seed: number;
}) {
  if (p <= 0) return null;
  const halo = trim(make(seed * 7 + 55), p);
  return (
    <g>
      {/* soft charcoal halo: a wide, faint smear under the line */}
      <path d={toD(halo)} fill="none" stroke={color} strokeOpacity={o * 0.1} strokeWidth={sw * 4.5} strokeLinecap="round" strokeLinejoin="round" />
      {Array.from({ length: passes }, (_, i) => {
        const pts = trim(make(seed * 7 + i * 101), p);
        return (
          <path key={i} d={toD(pts)} fill="none" stroke={color} strokeOpacity={i === 0 ? o : o * 0.55}
            strokeWidth={i === 0 ? sw : sw * 0.6} strokeLinecap="round" strokeLinejoin="round" />
        );
      })}
    </g>
  );
}

/** the per-frame seed for a shape: stable id + boil. */
export function useBoil(id: number, every = 3) {
  const f = useCurrentFrame();
  return id * 977 + boil(f, every) * 13;
}

export function SkLine({ a, b, p = 1, id = 1, rough = 1, ...s }: StrokeStyle & { a: Pt; b: Pt; p?: number; id?: number; rough?: number }) {
  const seed = useBoil(id);
  return <Passes make={(sd) => roughLine(a, b, sd, rough)} p={p} seed={seed} {...s} />;
}

export function SkPoly({ pts, closed = false, p = 1, id = 1, rough = 1, ...s }: StrokeStyle & { pts: Pt[]; closed?: boolean; p?: number; id?: number; rough?: number }) {
  const seed = useBoil(id);
  return <Passes make={(sd) => roughPoly(pts, sd, closed, rough)} p={p} seed={seed} {...s} />;
}

/** rectangle drawn as four separate strokes (each overshoots), drawn on one after another. */
export function SkRect({ x, y, w: rw, h, p = 1, id = 1, fill, ...s }: StrokeStyle & { x: number; y: number; w: number; h: number; p?: number; id?: number; fill?: string }) {
  const seed = useBoil(id);
  const c: Pt[] = [[x, y], [x + rw, y], [x + rw, y + h], [x, y + h]];
  return (
    <g>
      {fill && p > 0 ? <rect x={x} y={y} width={rw} height={h} fill={fill} opacity={clamp(p * 2, 0, 1)} /> : null}
      {[0, 1, 2, 3].map((i) => (
        <Passes key={i} make={(sd) => roughLine(c[i], c[(i + 1) % 4], sd)} p={clamp(p * 4 - i, 0, 1)} seed={seed + i * 5} {...s} />
      ))}
    </g>
  );
}

export function SkEllipse({ cx, cy, rx, ry, p = 1, id = 1, rough = 1, ...s }: StrokeStyle & { cx: number; cy: number; rx: number; ry: number; p?: number; id?: number; rough?: number }) {
  const seed = useBoil(id);
  return <Passes make={(sd) => roughEllipse(cx, cy, rx, ry, sd, rough)} p={p} seed={seed} {...s} />;
}

/** diagonal charcoal hatching inside a rect (shading). */
export function Hatch({ x, y, w: rw, h, p = 1, id = 1, gap = 14, angle = 1, o = 0.35, sw = 2 }: { x: number; y: number; w: number; h: number; p?: number; id?: number; gap?: number; angle?: number; o?: number; sw?: number }) {
  const seed = useBoil(id);
  const r = rng(seed);
  const lines: React.ReactNode[] = [];
  const n = Math.floor((rw + h) / gap);
  const shown = Math.floor(n * p);
  for (let i = 0; i < shown; i++) {
    const d = i * gap;
    // line x + y = const (angle 1) clipped to rect
    let a: Pt = angle > 0 ? [x + Math.min(d, rw), y + Math.max(0, d - rw)] : [x + rw - Math.min(d, rw), y + Math.max(0, d - rw)];
    let b: Pt = angle > 0 ? [x + Math.max(0, d - h), y + Math.min(d, h)] : [x + rw - Math.max(0, d - h), y + Math.min(d, h)];
    const j = (r() - 0.5) * 4;
    a = [a[0] + j, a[1]];
    b = [b[0] + j, b[1]];
    lines.push(<path key={i} d={toD(roughLine(a, b, seed + i, 0.6))} stroke={INK} strokeOpacity={o * (0.7 + r() * 0.5)} strokeWidth={sw} fill="none" strokeLinecap="round" />);
  }
  return <g>{lines}</g>;
}

/** check mark / cross / arrow helpers */
export function SkCheck({ x, y, s = 1, p = 1, id = 1, ...st }: StrokeStyle & { x: number; y: number; s?: number; p?: number; id?: number }) {
  return <SkPoly pts={[[x, y], [x + 16 * s, y + 18 * s], [x + 46 * s, y - 24 * s]]} p={p} id={id} {...st} />;
}
export function SkArrow({ a, b, p = 1, id = 1, head = 26, ...st }: StrokeStyle & { a: Pt; b: Pt; p?: number; id?: number; head?: number }) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const h1: Pt = [b[0] - Math.cos(ang - 0.5) * head, b[1] - Math.sin(ang - 0.5) * head];
  const h2: Pt = [b[0] - Math.cos(ang + 0.5) * head, b[1] - Math.sin(ang + 0.5) * head];
  return (
    <g>
      <SkLine a={a} b={b} p={clamp(p * 1.25, 0, 1)} id={id} {...st} />
      <SkPoly pts={[h1, b, h2]} p={clamp(p * 5 - 4, 0, 1)} id={id + 50} {...st} />
    </g>
  );
}

/** full-frame SVG layer in the 1920x1080 space. */
export function Sk({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1920 1080" width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible", ...style }}>
      {children}
    </svg>
  );
}

/** handwritten text, written on left→right (clip) and boiling slightly on threes. */
export function HandText({ children, x, y, size = 80, font = HAND, weight = 700, p = 1, id = 1, color = INK, align = "left", width, rot = 0, style }: {
  children: React.ReactNode; x: number; y: number; size?: number; font?: string; weight?: number; p?: number; id?: number; color?: string;
  align?: "left" | "center" | "right"; width?: number; rot?: number; style?: React.CSSProperties;
}) {
  const f = useCurrentFrame();
  const r = rng(id * 31 + boil(f));
  const jx = (r() - 0.5) * 2.2, jy = (r() - 0.5) * 2.2, jr = (r() - 0.5) * 0.5;
  if (p <= 0) return null;
  const left = align === "center" && width ? x - width / 2 : align === "right" && width ? x - width : x;
  return (
    <div style={{
      position: "absolute", left, top: y, width, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight: 1.02,
      color, textAlign: align, whiteSpace: width ? "normal" : "nowrap",
      transform: `translate(${jx}px, ${jy}px) rotate(${rot + jr}deg)`,
      clipPath: p < 1 ? `inset(-20% ${(1 - p) * 100}% -20% -5%)` : undefined,
      textShadow: `0.6px 0.8px 0 rgba(42,40,38,0.35)`,
      ...style,
    }}>{children}</div>
  );
}

/** the Rolino mascot: the only colour element. Moves on ones. */
export function Mascot({ pose, x, y, h, rot = 0, flip = false, opacity = 1, squash = 0 }: {
  pose: string; x: number; y: number; h: number; rot?: number; flip?: boolean; opacity?: number; squash?: number;
}) {
  // x,y = bottom centre (feet) in px
  const sy = 1 - squash, sx = 1 + squash * 0.6;
  return (
    <div style={{
      position: "absolute", left: x, top: y, width: 0, height: 0, opacity,
    }}>
      <Img src={asset(`assets/mascot/${pose}.png`)} style={{
        position: "absolute", height: h, left: 0, bottom: 0,
        transform: `translateX(-50%) rotate(${rot}deg) scale(${(flip ? -1 : 1) * sx}, ${sy})`, transformOrigin: "50% 100%",
      }} />
    </div>
  );
}

/** a hatched contact shadow under the mascot so it sits on the paper. */
export function MascotShadow({ x, y, w, id = 900, o = 0.5 }: { x: number; y: number; w: number; id?: number; o?: number }) {
  return (
    <Sk>
      <SkEllipse cx={x} cy={y} rx={w / 2} ry={w / 9} id={id} sw={2.4} o={o} />
      <SkEllipse cx={x} cy={y} rx={w / 2.6} ry={w / 14} id={id + 1} sw={2} o={o * 0.7} />
    </Sk>
  );
}

/** a smeared eraser band (for the mascot's swipe). */
export function Smudge({ x, y, w, h, o = 0.5, rot = 0 }: { x: number; y: number; w: number; h: number; o?: number; rot?: number }) {
  return (
    <Img src={asset("assets/paper/smudge.png")} style={{
      position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, opacity: o, transform: `rotate(${rot}deg)`,
    }} />
  );
}

/** fade + slight blur out at the end of a clip (eraser-ish exit). */
export function useExit(duration: number, frames = 8) {
  const f = useCurrentFrame();
  const out = ease(f, duration - frames, duration);
  return { opacity: 1 - out, filter: out > 0 ? `blur(${out * 6}px)` : undefined } as React.CSSProperties;
}

export function Layer({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
}
