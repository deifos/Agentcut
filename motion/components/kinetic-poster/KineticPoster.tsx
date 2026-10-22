import { AbsoluteFill, Easing, random, useCurrentFrame } from "remotion";
import { FONTS, exitOut, ramp, splitHighlights } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  title: string[];
  kicker: string;
  layout: string;
  red: string;
  yellow: string;
  blue: string;
  ink: string;
  paper: string;
  bpm: number;
  cols: number;
  showGrid: boolean;
  font: string;
  seed: number;
};

type Kind = "square" | "circle" | "triangle" | "half" | "quarter";
type Hue = "red" | "yellow" | "blue" | "ink";
const HUES: Hue[] = ["red", "yellow", "blue", "ink"];

/** A shape's box on the grid, in modules (top-left x, y and size w × h), as it sits in the end frame. */
interface ShapeDef {
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  color: Hue;
  /** Keeps turning 90° a beat after the hero moment, so the end frame stays alive. */
  metronome?: boolean;
}

/** Center (modules), angle (degrees) and color. */
interface State {
  cx: number;
  cy: number;
  angle: number;
  color: Hue;
}

type Action =
  | { type: "move"; dx: number; dy: number }
  | { type: "spin"; dir: number }
  /** Turn about a fixed point: a corner of the shape's box (90°) or the frame center (180°). */
  | { type: "pivot"; px: number; py: number; dir: number; deg: number }
  | { type: "color"; from: Hue; to: Hue };

// The end-frame compositions, on a 6 × 6 module square.
const POSTER: ShapeDef[] = [
  { kind: "circle", x: 2, y: 0, w: 4, h: 4, color: "red" },
  { kind: "square", x: 0, y: 0, w: 2, h: 2, color: "blue" },
  { kind: "quarter", x: 0, y: 2, w: 2, h: 2, color: "yellow" },
  { kind: "triangle", x: 0, y: 4, w: 2, h: 2, color: "ink" },
  { kind: "square", x: 2, y: 4, w: 4, h: 1, color: "ink" },
  { kind: "half", x: 2, y: 5, w: 2, h: 1, color: "red" },
  { kind: "square", x: 4, y: 5, w: 1, h: 1, color: "yellow" },
  { kind: "quarter", x: 5, y: 5, w: 1, h: 1, color: "blue", metronome: true },
];
const MINIMAL: ShapeDef[] = [
  { kind: "circle", x: 3, y: 0, w: 3, h: 3, color: "red" },
  { kind: "square", x: 0, y: 2, w: 1, h: 4, color: "blue" },
  { kind: "triangle", x: 2, y: 4, w: 2, h: 2, color: "yellow" },
  { kind: "half", x: 0, y: 0, w: 2, h: 1, color: "ink" },
  { kind: "quarter", x: 5, y: 5, w: 1, h: 1, color: "ink", metronome: true },
];
const ACTION_ORDER = ["move", "pivot", "move", "spin", "orbit", "color"] as const;

const quad = Easing.inOut(Easing.quad);
/** Rounded so the server-rendered still and the client agree to the last digit. */
const r2 = (v: number) => Math.round(v * 100) / 100;
const snapHalf = (v: number) => Math.round(v * 2) / 2;

function apply(s: State, a: Action, t: number): State {
  switch (a.type) {
    case "move":
      return { ...s, cx: s.cx + a.dx * t, cy: s.cy + a.dy * t };
    case "spin":
      return { ...s, angle: s.angle + 90 * a.dir * t };
    case "pivot": {
      const th = ((a.deg * a.dir * t) / 180) * Math.PI;
      const vx = s.cx - a.px;
      const vy = s.cy - a.py;
      return {
        ...s,
        cx: a.px + vx * Math.cos(th) - vy * Math.sin(th),
        cy: a.py + vx * Math.sin(th) + vy * Math.cos(th),
        angle: s.angle + a.deg * a.dir * t,
      };
    }
    case "color":
      return { ...s, color: t > 0 ? a.to : a.from };
  }
}

/** A completed action, snapped back onto the grid (no float drift between beats). */
function applyFull(s: State, a: Action): State {
  const n = apply(s, a, 1);
  return { cx: snapHalf(n.cx), cy: snapHalf(n.cy), angle: Math.round(n.angle), color: n.color };
}

function inverse(a: Action): Action {
  switch (a.type) {
    case "move":
      return { ...a, dx: -a.dx, dy: -a.dy };
    case "spin":
      return { ...a, dir: -a.dir };
    case "pivot":
      return { ...a, dir: -a.dir };
    case "color":
      return { ...a, from: a.to, to: a.from };
  }
}

const dims = (def: ShapeDef, angle: number) =>
  Math.abs(Math.round(angle / 90)) % 2 === 1 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };

function inBounds(s: State, def: ShapeDef, C: number, R: number) {
  const { w, h } = dims(def, s.angle);
  return s.cx - w / 2 >= -0.01 && s.cx + w / 2 <= C + 0.01 && s.cy - h / 2 >= -0.01 && s.cy + h / 2 <= R + 0.01;
}

/**
 * One shape's moves, one per beat. Built backwards from the end frame: each beat picks an action whose
 * undo stays on the grid, so playing them forwards always lands exactly on the composition.
 */
function planShape(def: ShapeDef, index: number, beats: number[], C: number, R: number, seed: number) {
  const final: State = { cx: def.x + def.w / 2, cy: def.y + def.h / 2, angle: 0, color: def.color };
  const actions: Action[] = [];
  let cur = final;
  const start = Math.floor(random(`bh-${seed}-${index}-order`) * ACTION_ORDER.length);
  for (let k = beats.length - 1; k >= 0; k--) {
    const rnd = (key: string) => random(`bh-${seed}-${index}-${k}-${key}`);
    let chosen: { a: Action; pre: State } | null = null;
    for (let attempt = 0; attempt < 12 && !chosen; attempt++) {
      const type = ACTION_ORDER[(start + k + attempt) % ACTION_ORDER.length];
      const r = (key: string) => rnd(`${key}${attempt}`);
      let a: Action | null = null;
      if (type === "move") {
        const mag = (1 + Math.floor(r("m") * 3)) * (r("s") < 0.5 ? -1 : 1);
        a = r("axis") < 0.5 ? { type: "move", dx: mag, dy: 0 } : { type: "move", dx: 0, dy: mag };
      } else if (type === "spin") {
        // A turning circle or square looks still: they roll about a corner instead.
        if (def.kind !== "circle" && !(def.kind === "square" && def.w === def.h)) a = { type: "spin", dir: r("d") < 0.5 ? -1 : 1 };
      } else if (type === "pivot") {
        const { w, h } = dims(def, cur.angle);
        const corner = Math.floor(r("c") * 4);
        a = {
          type: "pivot",
          px: cur.cx + (corner % 2 ? w / 2 : -w / 2),
          py: cur.cy + (corner > 1 ? h / 2 : -h / 2),
          dir: r("d") < 0.5 ? -1 : 1,
          deg: 90,
        };
      } else if (type === "orbit") {
        a = { type: "pivot", px: C / 2, py: R / 2, dir: r("d") < 0.5 ? -1 : 1, deg: 180 };
      } else {
        const others = HUES.filter((hue) => hue !== cur.color && hue !== "ink");
        a = { type: "color", from: others[Math.floor(r("h") * others.length)], to: cur.color };
      }
      if (!a) continue;
      const pre = applyFull(cur, inverse(a));
      if (inBounds(pre, def, C, R)) chosen = { a, pre };
    }
    const fallback: Action = { type: "color", from: cur.color === "red" ? "blue" : "red", to: cur.color };
    const { a, pre } = chosen ?? { a: fallback, pre: applyFull(cur, inverse(fallback)) };
    actions[k] = a;
    cur = pre;
  }
  return { startState: cur, actions };
}

function shapePath(kind: Kind, w: number, h: number, fill: string) {
  const [x0, y0, x1, y1] = [r2(-w / 2), r2(-h / 2), r2(w / 2), r2(h / 2)];
  switch (kind) {
    case "circle":
      return <circle r={r2(Math.min(w, h) / 2)} fill={fill} />;
    case "triangle":
      return <polygon points={`${x0},${y1} ${x1},${y1} ${x0},${y0}`} fill={fill} />;
    case "half":
      return <path d={`M ${x0} ${y1} A ${x1} ${x1} 0 0 1 ${x1} ${y1} Z`} fill={fill} />;
    case "quarter":
      return <path d={`M ${x0} ${y1} L ${x0} ${y0} A ${r2(w)} ${r2(h)} 0 0 1 ${x1} ${y1} Z`} fill={fill} />;
    default:
      return <rect x={x0} y={y0} width={r2(w)} height={r2(h)} fill={fill} />;
  }
}

/**
 * A kinetic Bauhaus poster: primary-colored circles, triangles, bars and quarter-circles step across a strict
 * grid, one move per beat (slide by whole modules, roll about a corner, swing about the frame center, flip
 * color), lock into a composition, then the title is uncovered by sliding color bars.
 */
export function KineticPoster(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const portrait = height > width;
  const hue = (h: Hue) => props[h];

  // The grid: whole modules across, as many whole rows as fit, centered vertically.
  const C = portrait ? Math.max(4, Math.round((props.cols * 9) / 16)) : Math.round(props.cols);
  const m = width / C;
  const R = Math.max(3, Math.floor(height / m));
  const oy = (height - R * m) / 2;

  // Shapes take a square region (right in wide, top in mobile); the type gets the rest.
  const S = portrait ? Math.max(3, Math.min(C, R - 4)) : Math.max(3, Math.min(R, Math.floor(C / 2)));
  const regionX = portrait ? Math.floor((C - S) / 2) : C - S;
  const regionY = portrait ? 0 : Math.floor((R - S) / 2);
  const text = portrait
    ? { x0: 0, x1: C, y0: S, y1: R }
    : { x0: 0, x1: C - S, y0: 0, y1: R };
  const inText = (i: number, j: number) => i >= text.x0 && i < text.x1 && j >= text.y0 && j < text.y1;

  const beat = (fps * 60) / props.bpm;
  const bf = (b: number) => Math.round(b * beat);
  const dur = Math.max(3, Math.min(Math.round(beat * 0.6), Math.round(beat) - 1));
  const heroBeat = Math.max(2, Math.round((d * 0.62) / beat));
  const heroFrame = bf(heroBeat);
  const out = exitOut(frame, d, 10);
  const pad = m * 0.22;

  // Grid lines draw on over the first beat.
  const gridIn = ramp(frame, 0, Math.max(4, beat), Easing.linear);
  const lineW = r2(Math.max(1, m / 110));
  const gridLines = props.showGrid ? (
    <g stroke={props.ink} strokeOpacity={0.14} strokeWidth={lineW}>
      {Array.from({ length: C + 1 }, (_, i) => (
        <line key={`v${i}`} x1={r2(i * m)} x2={r2(i * m)} y1={r2(oy)} y2={r2(oy + R * m * gridIn)} />
      ))}
      {Array.from({ length: R + 1 }, (_, j) => (
        <line key={`h${j}`} y1={r2(oy + j * m)} y2={r2(oy + j * m)} x1={0} x2={r2(C * m * gridIn)} />
      ))}
    </g>
  ) : null;

  // ── Poster / minimal: shapes planned beat by beat ──────────────────────────────────────────────────────
  const shapes = (() => {
    if (props.layout === "array") return null;
    const base = props.layout === "minimal" ? MINIMAL : POSTER;
    const k = S >= 6 ? 1 : S / 6;
    const off = S >= 6 ? Math.round((S - 6) / 2) : 0;
    return base.map((src, i) => {
      const h = Math.max(1, Math.round(src.h * k));
      const def: ShapeDef = {
        ...src,
        x: regionX + off + Math.round(src.x * k),
        y: regionY + off + Math.round(src.y * k),
        h,
        w: src.kind === "half" ? h * 2 : Math.max(1, Math.round(src.w * k)),
      };
      // Shapes appear on eighth notes, then act on every other beat until the hero moment.
      const appear = Math.round((i * beat) / 2);
      const firstBeat = Math.ceil((appear + 1) / beat);
      const beats: number[] = [];
      for (let b = firstBeat; b < heroBeat; b++) if ((b + i) % 2 === 0) beats.push(b);
      const { startState, actions } = planShape(def, i, beats, C, R, props.seed);
      let s = startState;
      for (let n = 0; n < beats.length; n++) {
        const at = bf(beats[n]);
        if (frame < at) break;
        const a = actions[n];
        const t = a.type === "color" ? 1 : ramp(frame, at, dur, quad);
        s = t >= 1 ? applyFull(s, a) : apply(s, a, t);
        if (t < 1) break;
      }
      if (def.metronome && frame >= heroFrame + bf(1)) {
        // A quarter turn every beat after the hero moment.
        const since = frame - heroFrame;
        const done = Math.floor(since / beat);
        s = { ...s, angle: s.angle + 90 * (done - 1 + ramp(frame, heroFrame + bf(done), dur, quad)) };
      }
      if (frame < appear) return null;
      return (
        <g key={i} transform={`translate(${r2(s.cx * m)} ${r2(oy + s.cy * m)}) rotate(${r2(s.angle)})`}>
          {shapePath(def.kind, def.w * m, def.h * m, hue(s.color))}
        </g>
      );
    });
  })();

  // ── Array: a Truchet field of quarter-circles that turn on the beat in phase waves ────────────────────────
  const tiles = (() => {
    if (props.layout !== "array") return null;
    const now = Math.floor(frame / beat);
    const cells = [];
    for (let j = 0; j < R; j++) {
      for (let i = 0; i < C; i++) {
        const key = `${props.seed}-${i}-${j}`;
        const appear = Math.round((Math.floor(((i + j) / Math.max(1, C + R - 2)) * 8) * beat) / 4);
        if (frame < appear) continue;
        if (inText(i, j)) {
          const rel = portrait ? i + (j - text.y0) : i + j * 0.5;
          if (frame >= heroFrame + Math.round((rel * beat) / 4)) continue;
        }
        // Rounded before bucketing so the server-rendered still and the browser pick the same tile.
        const v = r3(Math.sin(i * 0.75 + props.seed) * Math.cos(j * 0.6 + props.seed * 0.37) + 0.35 * Math.sin((i + j) * 0.5));
        if (Math.abs(v) < 0.1) continue;
        const color = HUES[Math.min(3, Math.max(0, Math.floor(((v + 1.35) / 2.7) * 4)))];
        const dir = (i + j) % 2 ? 1 : -1;
        let turns = Math.floor(random(`q${key}`) * 4);
        let partial = 0;
        for (let b = 1; b <= now; b++) {
          const wave = r3(0.5 + 0.5 * Math.sin(i * 0.6 + j * 0.45 - b * 0.9 + props.seed));
          if (random(`t${key}-${b}`) < wave * 0.7) {
            if (b < now) turns += 1;
            else partial = ramp(frame, bf(b), dur, quad);
          }
        }
        const kind: Kind = random(`k${key}`) < 0.82 ? "quarter" : random(`k2${key}`) < 0.5 ? "circle" : "triangle";
        cells.push(
          <g
            key={key}
            transform={`translate(${r2((i + 0.5) * m)} ${r2(oy + (j + 0.5) * m)}) rotate(${r2(90 * dir * (turns + partial))})`}
          >
            {shapePath(kind, kind === "circle" ? m * 0.76 : m, kind === "circle" ? m * 0.76 : m, hue(color))}
          </g>,
        );
      }
    }
    return cells;
  })();

  // ── Type ───────────────────────────────────────────────────────────────────────────────────────────────
  const box = {
    left: text.x0 * m + pad,
    right: text.x1 * m - pad,
    top: oy + text.y0 * m + pad,
    bottom: oy + text.y1 * m - pad,
  };
  const lines = props.title.filter((l) => l.trim());
  const maxChars = Math.max(4, ...lines.map((l) => l.replace(/\*/g, "").length));
  const kickerSize = Math.max(12, m * 0.15);
  const fontSize = Math.min(
    (box.right - box.left) / (maxChars * 0.56),
    ((box.bottom - box.top - kickerSize * 3) * 0.9) / Math.max(1, lines.length * 0.92),
    m * 1.8,
  );
  const barColors = [props.ink, props.red, props.blue];
  const covered = props.layout !== "array";
  const typeLayer = (
    <AbsoluteFill>
      {props.kicker && frame >= (covered ? bf(1) : 0) ? (
        <div
          style={{
            position: "absolute",
            left: r2(box.left),
            top: r2(box.top),
            display: "flex",
            alignItems: "center",
            gap: r2(kickerSize * 0.7),
            fontFamily: FONTS[props.font] ?? FONTS.grotesk,
            fontWeight: 600,
            fontSize: r2(kickerSize),
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: props.ink,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ width: r2(kickerSize * 0.75), height: r2(kickerSize * 0.75), background: props.red }} />
          {props.kicker}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: r2(box.left),
          bottom: r2(height - box.bottom),
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: r2(fontSize * 0.06),
        }}
      >
        {lines.map((line, i) => {
          const barIn = bf(1 + i);
          const reveal = ramp(frame, heroFrame + i * Math.round(beat / 2), dur, quad);
          if (covered && frame < barIn) return <div key={i} style={{ height: r2(fontSize * 0.92) }} />;
          return (
            <div key={i} style={{ position: "relative", overflow: "hidden" }}>
              <div
                style={{
                  fontFamily: FONTS[props.font] ?? FONTS.grotesk,
                  fontWeight: 700,
                  fontSize: r2(fontSize),
                  lineHeight: 0.92,
                  letterSpacing: "-0.045em",
                  color: props.ink,
                  whiteSpace: "nowrap",
                  paddingRight: r2(fontSize * 0.06),
                }}
              >
                {splitHighlights(line).map((word, w) => (
                  <span key={w} style={{ color: word.highlighted ? props.red : undefined }}>
                    {w > 0 ? " " : ""}
                    {word.text}
                  </span>
                ))}
              </div>
              {covered && reveal < 1 ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: barColors[i % barColors.length],
                    transform: `translateX(${r2(reveal * 101)}%)`,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ background: props.paper, opacity: out }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {gridLines}
        {shapes}
      </svg>
      {typeLayer}
      {tiles ? (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {tiles}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
