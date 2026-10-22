import { useId } from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { FONTS, clamp01, exitOut, fill, glowStyle, mix, pop, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  shapes: string[];
  captions: string[];
  colors: string[];
  background: string;
  captionColor: string;
  size: number;
  morphFrames: number;
  via: boolean;
  squash: number;
  rotation: boolean;
  trail: boolean;
  glow: boolean;
  font: string;
};

type Pt = [number, number];

/** Points on every outline: all shapes share the count, start vertex (top) and winding, so morphs never knot. */
const N = 160;
const MORPH_EASE = Easing.bezier(0.7, 0, 0.3, 1);
const DEFAULT_COLORS = ["#3d5bff", "#22c55e", "#f43f5e", "#f59e0b"];

/**
 * Shape morphing: each shape flows into the next through a continuous outline, by way of a circle,
 * with a hop, a slight turn and squash & stretch at the morph. Held shapes carry a caption.
 */
export function ShapeShift(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const id = `sm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const names = props.shapes.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!names.length) names.push("circle");
  const colors = props.colors.map((c) => c.trim()).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
  const palette = colors.length ? colors : DEFAULT_COLORS;
  const K = names.length;
  const R = ((props.size / 100) * Math.min(width, height)) / 2;
  const exitFrames = Math.min(14, d * 0.15);
  const segment = (d - exitFrames) / K;
  const morph = Math.min(props.morphFrames, segment * 0.8);
  const hasCaptions = props.captions.some((c) => c.trim());
  const capSize = Math.min(width, height) * 0.052;
  const cx = width / 2;
  const cy = height / 2 - (hasCaptions ? capSize * 1.1 : 0);

  /** Where the shape is at frame f: outline, color and the morph's motion. */
  const pose = (f: number) => {
    const i = Math.max(0, Math.min(K - 1, Math.floor(f / segment)));
    const local = f - i * segment;
    const p = i < K - 1 && local > segment - morph ? (local - (segment - morph)) / morph : 0;
    const a = i;
    const b = Math.min(i + 1, K - 1);
    const e = p > 0 ? MORPH_EASE(clamp01(p)) : 0;
    const A = outline(names[a], f);
    let pts: Pt[];
    if (e === 0) pts = A;
    else {
      const B = outline(names[b], f);
      const via = props.via && names[a] !== "circle" && names[b] !== "circle";
      pts = via ? (e < 0.5 ? lerpPts(A, CIRCLE(), e * 2) : lerpPts(CIRCLE(), B, (e - 0.5) * 2)) : lerpPts(A, B, e);
    }
    const color = mixHex(palette[a % palette.length], palette[b % palette.length], e);
    const bump = Math.sin(Math.PI * e);
    const dir = a % 2 === 0 ? 1 : -1;
    const s = (props.squash / 100) * bump;
    const enter = pop(f, fps, 0, 200);
    const out = exitOut(f, d, exitFrames);
    const scale = enter * mix(0.85, 1, out);
    return {
      pts,
      color,
      a,
      b,
      p,
      sx: (1 + s) * scale,
      sy: (1 - s * 0.85) * scale,
      rot: (props.rotation ? bump * 12 * dir : 0) + (1 - enter) * -40,
      dx: bump * R * 0.06 * dir,
      dy: -bump * R * 0.14,
      out,
    };
  };

  const now = pose(frame);
  const transform = (q: ReturnType<typeof pose>) =>
    `translate(${rd(cx + q.dx)} ${rd(cy + q.dy)}) rotate(${rd(q.rot)}) scale(${Math.round(q.sx * 1000) / 1000} ${Math.round(q.sy * 1000) / 1000})`;
  const trails = props.trail && now.p > 0 ? [1, 2, 3].map((k) => ({ k, q: pose(frame - k * 2) })) : [];
  // Details (a phone's notch, a pin's hole…) fade out as a morph starts and back in as it lands.
  const detailA = now.p > 0 ? 1 - clamp01(now.p * 5) : 1;
  const detailB = now.p > 0 ? clamp01((now.p - 0.8) * 5) : 0;
  const capIn = ramp(frame, 6, 14);
  const capA = (now.p > 0 ? 1 - clamp01(now.p * 3) : 1) * capIn;
  const capB = now.p > 0 ? clamp01((now.p - 0.6) * 2.5) : 0;
  const lift = Math.abs(now.dy) / (R * 0.14 || 1);

  const caption = (index: number, opacity: number, shift: number) => {
    const text = props.captions[index]?.trim();
    if (!text || opacity <= 0) return null;
    return (
      <div
        key={`cap${index}`}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy + R * 1.12 + capSize * 0.3,
          textAlign: "center",
          fontFamily: FONTS[props.font] ?? FONTS.display,
          fontWeight: 700,
          fontSize: capSize,
          letterSpacing: "-0.02em",
          color: props.captionColor,
          opacity: rd(opacity * now.out),
          transform: `translateY(${rd(shift * capSize)}px)`,
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: fill(props.background), opacity: now.out }}>
      {props.glow ? <div style={glowStyle(cx, cy, R * 3.4, R * 3.4, now.color, 0.4 * now.out)} /> : null}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={mixHex(now.color, "#ffffff", 0.25)} />
            <stop offset="55%" stopColor={now.color} />
            <stop offset="100%" stopColor={mixHex(now.color, "#000000", 0.2)} />
          </linearGradient>
          <radialGradient id={`${id}-s`}>
            <stop offset="0%" stopColor={now.color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={now.color} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* Floor glow: shrinks as the shape hops. */}
        <ellipse
          cx={rd(cx)}
          cy={rd(cy + R * 1.02)}
          rx={rd(R * 0.8 * (1 - lift * 0.25) * Math.max(0, now.sx))}
          ry={rd(R * 0.09)}
          fill={`url(#${id}-s)`}
          opacity={rd(0.8 * now.out)}
        />
        {trails.map(({ k, q }) => (
          <path
            key={k}
            d={pathD(q.pts, R)}
            transform={transform(q)}
            fill="none"
            stroke={q.color}
            strokeWidth={rd(Math.max(1, 3 * u))}
            opacity={rd(0.4 - k * 0.11)}
          />
        ))}
        <g transform={transform(now)}>
          <path d={pathD(now.pts, R)} fill={`url(#${id}-g)`} stroke="rgba(255, 255, 255, 0.16)" strokeWidth={rd(1.5 * u)} />
          {detail(names[now.a], R, detailA, `a${now.a}`)}
          {now.b !== now.a ? detail(names[now.b], R, detailB, `b${now.b}`) : null}
        </g>
      </svg>
      {caption(now.a, capA, -mix(0, 0.6, now.p > 0 ? clamp01(now.p * 3) : 0))}
      {now.b !== now.a ? caption(now.b, capB, mix(0.6, 0, capB)) : null}
    </AbsoluteFill>
  );
}

/** Inner marks drawn on top of a held shape, in its local (centered, R-scaled) space. */
function detail(name: string, R: number, opacity: number, key: string) {
  if (opacity <= 0) return null;
  const o = rd(opacity);
  const ink = "rgba(255, 255, 255, 0.92)";
  switch (name) {
    case "phone":
      return (
        <g key={key} opacity={o} fill="rgba(0, 0, 0, 0.3)">
          <rect x={rd(-0.17 * R)} y={rd(-0.84 * R)} width={rd(0.34 * R)} height={rd(0.08 * R)} rx={rd(0.04 * R)} />
          <rect x={rd(-0.2 * R)} y={rd(0.8 * R)} width={rd(0.4 * R)} height={rd(0.04 * R)} rx={rd(0.02 * R)} />
        </g>
      );
    case "pin":
      return <circle key={key} cx={0} cy={rd(-0.28 * R)} r={rd(0.25 * R)} fill={ink} opacity={o} />;
    case "badge":
      return (
        <path
          key={key}
          d={`M${rd(-0.32 * R)} ${rd(0.02 * R)} L${rd(-0.08 * R)} ${rd(0.26 * R)} L${rd(0.36 * R)} ${rd(-0.22 * R)}`}
          fill="none"
          stroke={ink}
          strokeWidth={rd(0.13 * R)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={o}
        />
      );
    case "bubble":
      return (
        <g key={key} opacity={o} fill={ink}>
          {[-0.42, 0, 0.42].map((x) => (
            <circle key={x} cx={rd(x * R)} cy={rd(-0.13 * R)} r={rd(0.1 * R)} />
          ))}
        </g>
      );
    default:
      return null;
  }
}

// ---- Outlines (unit space, y down, roughly within ±1) ----

const cache = new Map<string, Pt[]>();

function outline(name: string, frame: number): Pt[] {
  if (name === "blob") {
    const f = frame;
    return normalize(
      polar((t) => 0.82 + 0.08 * Math.sin(3 * t + f * 0.05) + 0.05 * Math.sin(5 * t - f * 0.07) + 0.03 * Math.sin(2 * t + f * 0.03)),
    );
  }
  const key = SHAPES[name] ? name : "circle";
  let pts = cache.get(key);
  if (!pts) {
    pts = normalize(SHAPES[key]());
    cache.set(key, pts);
  }
  return pts;
}

const CIRCLE = () => outline("circle", 0);

const SHAPES: Record<string, () => Pt[]> = {
  circle: () => polar(() => 0.92),
  square: () => roundedPolygon([[-0.82, -0.82], [0.82, -0.82], [0.82, 0.82], [-0.82, 0.82]], 0.3),
  triangle: () => roundedPolygon([[0, -0.95], [0.98, 0.75], [-0.98, 0.75]], 0.16),
  star: () =>
    roundedPolygon(
      Array.from({ length: 10 }, (_, k) => {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const r = k % 2 === 0 ? 1.02 : 0.47;
        return [r * Math.cos(a), r * Math.sin(a) + 0.08] as Pt;
      }),
      0.07,
    ),
  heart: () =>
    Array.from({ length: 400 }, (_, k) => {
      const t = (k / 400) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      return [x / 16.5, y / 16.5 - 0.12] as Pt;
    }),
  pin: () => {
    const c: Pt = [0, -0.28];
    const r = 0.66;
    const tip: Pt = [0, 0.98];
    const beta = Math.acos(r / (tip[1] - c[1]));
    const pts: Pt[] = [];
    for (let k = 0; k <= 200; k++) {
      const a = Math.PI / 2 + beta + (k / 200) * (2 * Math.PI - 2 * beta);
      pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
    }
    pts.push(tip);
    return pts;
  },
  phone: () => roundedPolygon([[-0.52, -0.95], [0.52, -0.95], [0.52, 0.95], [-0.52, 0.95]], 0.2),
  bubble: () =>
    roundedPolygon(
      [[-0.95, -0.72], [0.95, -0.72], [0.95, 0.48], [-0.15, 0.48], [-0.58, 0.92], [-0.5, 0.48], [-0.95, 0.48]],
      [0.32, 0.32, 0.32, 0.05, 0.04, 0.05, 0.32],
    ),
  bolt: () => roundedPolygon([[0.2, -1], [-0.62, 0.12], [-0.04, 0.12], [-0.22, 1], [0.62, -0.16], [0.04, -0.16]], 0.05),
  badge: () => polar((t) => 0.86 + 0.07 * Math.cos(12 * t)),
  play: () => roundedPolygon([[-0.62, -0.88], [0.86, 0], [-0.62, 0.88]], 0.22),
  cloud: () => {
    const circles: [number, number, number][] = [
      [-0.52, 0.2, 0.42],
      [-0.05, -0.18, 0.58],
      [0.5, 0.08, 0.46],
      [0.1, 0.28, 0.44],
    ];
    const o: Pt = [0, 0.1];
    const base = 0.62;
    const pts: Pt[] = [];
    for (let k = 0; k < 360; k++) {
      const t = -Math.PI / 2 + (k / 360) * Math.PI * 2;
      const dx = Math.cos(t);
      const dy = Math.sin(t);
      let best = 0;
      for (const [x, y, r] of circles) {
        const wx = x - o[0];
        const wy = y - o[1];
        const b = dx * wx + dy * wy;
        const disc = r * r - (wx * wx + wy * wy - b * b);
        if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
      }
      if (best <= 0) continue;
      if (o[1] + best * dy > base) best = (base - o[1]) / dy;
      pts.push([o[0] + best * dx, o[1] + best * dy - 0.1]);
    }
    return pts;
  },
};

/** r(θ) sampled clockwise from the top. */
function polar(r: (t: number) => number, samples = 360): Pt[] {
  return Array.from({ length: samples }, (_, k) => {
    const t = -Math.PI / 2 + (k / samples) * Math.PI * 2;
    const v = r(t);
    return [v * Math.cos(t), v * Math.sin(t)] as Pt;
  });
}

/** A polygon with each corner rounded by a quadratic curve `radius` along its edges. */
function roundedPolygon(verts: Pt[], radius: number | number[]): Pt[] {
  const out: Pt[] = [];
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const v = verts[i];
    const p = verts[(i - 1 + n) % n];
    const q = verts[(i + 1) % n];
    const r = Array.isArray(radius) ? radius[i] : radius;
    const lp = Math.hypot(p[0] - v[0], p[1] - v[1]);
    const lq = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const dist = Math.min(r, lp / 2, lq / 2);
    const a: Pt = [v[0] + ((p[0] - v[0]) / lp) * dist, v[1] + ((p[1] - v[1]) / lp) * dist];
    const b: Pt = [v[0] + ((q[0] - v[0]) / lq) * dist, v[1] + ((q[1] - v[1]) / lq) * dist];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      const w = 1 - t;
      out.push([w * w * a[0] + 2 * w * t * v[0] + t * t * b[0], w * w * a[1] + 2 * w * t * v[1] + t * t * b[1]]);
    }
  }
  return out;
}

/** Clockwise, starting at the point straight above the center, resampled to N points evenly by arc length. */
function normalize(raw: Pt[]): Pt[] {
  let pts = raw;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  }
  if (area < 0) pts = [...pts].reverse();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const my = (Math.min(...ys) + Math.max(...ys)) / 2;
  let start = 0;
  let bestDist = Infinity;
  pts.forEach(([x, y], i) => {
    const a = Math.atan2(y - my, x - mx);
    const dist = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
    if (dist < bestDist) {
      bestDist = dist;
      start = i;
    }
  });
  pts = [...pts.slice(start), ...pts.slice(0, start)];
  const lengths = [0];
  for (let i = 1; i <= pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i % pts.length];
    lengths.push(lengths[i - 1] + Math.hypot(x2 - x1, y2 - y1));
  }
  const total = lengths[pts.length];
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k < N; k++) {
    const target = (k / N) * total;
    while (j < pts.length - 1 && lengths[j + 1] < target) j++;
    const seg = lengths[j + 1] - lengths[j] || 1;
    const t = (target - lengths[j]) / seg;
    const [x1, y1] = pts[j];
    const [x2, y2] = pts[(j + 1) % pts.length];
    out.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  return out;
}

function lerpPts(a: Pt[], b: Pt[], t: number): Pt[] {
  return a.map(([x, y], i) => [x + (b[i][0] - x) * t, y + (b[i][1] - y) * t]);
}

/** A smooth closed path through the points (Catmull-Rom as cubics), in pixels, rounded so SSR and client agree. */
function pathD(pts: Pt[], R: number) {
  const P = pts.map(([x, y]) => [x * R, y * R]);
  const n = P.length;
  let path = `M${rd(P[0][0])} ${rd(P[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n];
    const p1 = P[i];
    const p2 = P[(i + 1) % n];
    const p3 = P[(i + 2) % n];
    path += `C${rd(p1[0] + (p2[0] - p0[0]) / 6)} ${rd(p1[1] + (p2[1] - p0[1]) / 6)} ${rd(p2[0] - (p3[0] - p1[0]) / 6)} ${rd(
      p2[1] - (p3[1] - p1[1]) / 6,
    )} ${rd(p2[0])} ${rd(p2[1])}`;
  }
  return `${path}Z`;
}

function mixHex(a: string, b: string, t: number) {
  const pa = /^#?([0-9a-f]{6})$/i.exec(a.trim());
  const pb = /^#?([0-9a-f]{6})$/i.exec(b.trim());
  if (!pa || !pb) return a;
  const na = parseInt(pa[1], 16);
  const nb = parseInt(pb[1], 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  const c = (s: number) => Math.round(ch(na, s) + (ch(nb, s) - ch(na, s)) * t);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}

const rd = (v: number) => Math.round(v * 100) / 100;
