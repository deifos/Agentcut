import { useId, type ReactNode } from "react";
import { AbsoluteFill, Img, random, spring, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, clamp01, exitOut, mix, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  name: string;
  tagline: string;
  mark: string;
  shape: string;
  color: string;
  textColor: string;
  border: string;
  font: string;
  weight: string;
  size: number;
  cutEvery: number;
  tilt: number;
  peel: boolean;
  flash: boolean;
  images: string[];
  seed: number;
};

/**
 * A brand sticker slapped on everything: the background hard-cuts between surfaces (a laptop lid,
 * a brick wall, a skate deck, a street sign, a cardboard box…) or your own images, and on every cut
 * the die-cut sticker in the middle snaps to a new tilt, as if it were stuck there too.
 */
export function StickerSlam(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const id = `stk${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const out = exitOut(frame, d, 10);

  // Cuts: a new surface every `cutEvery` frames, never the same one twice in a row.
  const every = Math.max(2, Math.round(props.cutEvery));
  const cut = Math.floor(frame / every);
  const local = frame - cut * every;
  const images = props.images.map((s) => s.trim()).filter(Boolean);
  const count = images.length || SURFACES.length;
  const index = sequence(cut, count, props.seed);
  const rc = (k: string) => random(`${props.seed}-${cut}-${k}`);

  // The sticker's size: fit the wordmark inside the frame whatever its length and font.
  const textCut = props.shape === "text-cut";
  const circle = props.shape === "circle";
  const hasMark = props.mark !== "none";
  const charW = CHAR_WIDTH[props.font] ?? 0.58;
  const len = Math.max(1, props.name.length);
  const widthPer = len * charW + (hasMark ? 0.95 : 0) + (textCut ? 0.4 : 1.45);
  const room = circle ? Math.min(width, height) * 0.72 : width * (vertical ? 0.84 : 0.74);
  const wanted = (props.size / 100) * Math.min(width, height) * (vertical ? 1.15 : 1);
  const fontSize = Math.min(wanted, room / widthPer);
  const bw = fontSize * 0.17;
  const padY = fontSize * 0.3;
  const padX = fontSize * 0.55;
  const boxW = fontSize * widthPer;
  const boxH = fontSize * 1.05 + padY * 2 + bw * 2;
  const diameter = Math.max(boxW, boxH * 1.9);

  // The slap: big and lifted, then pressed flat. Every later cut re-sticks it with a small bump.
  const slap = spring({ frame, fps, config: { damping: 13, stiffness: 420, mass: 0.7 } });
  const lift = 1 - clamp01(slap);
  const side = cut % 2 === 0 ? -1 : 1;
  const angle = side * props.tilt * (0.3 + 0.7 * rc("a")) + lift * side * 10;
  const bump = cut > 0 ? 1 + 0.05 * (1 - ramp(local, 0, 3)) : 1;
  const scale = mix(1.55, 1, slap) * (0.93 + 0.12 * rc("s")) * bump;
  const skew = (rc("k") - 0.5) * 6;
  const jx = (rc("x") - 0.5) * 0.05 * Math.min(width, height);
  const jy = (rc("y") - 0.5) * 0.04 * Math.min(width, height);
  const shadowOff = (6 + 46 * lift) * u;
  const shadowBlur = (7 + 34 * lift) * u;
  const shadowAlpha = 0.5 - 0.22 * lift;
  const gloss = 25 + 50 * rc("g");
  const tagIn = ramp(frame, 8, 14);

  const font = FONTS[props.font] ?? FONTS.display;
  const weight = Number(props.weight) || 800;
  const markSize = fontSize * 0.78;

  // The peel: the bottom-right corner is cut away and folded back over the sticker.
  const fold = circle ? diameter * 0.26 : Math.min(boxH * 0.5, fontSize * 0.62);
  const fw = circle ? diameter : boxW;
  const fh = circle ? diameter : boxH;
  const peel = props.peel && !textCut;
  const peelClip = peel
    ? `polygon(0% 0%, 100% 0%, 100% ${(100 - (fold / fh) * 100).toFixed(2)}%, ${(100 - (fold / fw) * 100).toFixed(2)}% 100%, 0% 100%)`
    : undefined;
  const radius = circle ? diameter / 2 : props.shape === "pill" ? boxH / 2 : fontSize * 0.38;

  const mark = hasMark ? (
    <MarkIcon
      kind={props.mark}
      size={markSize}
      color={textCut ? props.color : props.textColor}
      stroke={textCut ? props.border : undefined}
      strokeWidth={(bw * 2 * 100) / markSize}
    />
  ) : null;

  const word = (
    <span style={{ fontFamily: font, fontWeight: weight, fontSize, lineHeight: 1.05, whiteSpace: "nowrap", letterSpacing: "-0.02em" }}>
      {props.name}
    </span>
  );

  let sticker: ReactNode;
  if (textCut) {
    sticker = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: fontSize * 0.22,
          color: props.color,
          textShadow: dieCutShadow(bw, props.border, shadowOff, shadowBlur, shadowAlpha),
        }}
      >
        {mark}
        {word}
      </div>
    );
  } else {
    const size = circle ? { width: diameter, height: diameter } : {};
    sticker = (
      <div style={{ position: "relative", ...size }}>
        {/* The drop shadow is its own shape so the peel can cut it too. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${shadowOff * 0.35}px, ${shadowOff}px)`,
            ...blurStyle(shadowBlur),
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: radius,
              background: `rgba(0, 0, 0, ${shadowAlpha.toFixed(3)})`,
              clipPath: peelClip,
            }}
          />
        </div>
        <div
          style={{
            position: "relative",
            ...size,
            padding: bw,
            borderRadius: radius,
            background: props.border,
            clipPath: peelClip,
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              width: circle ? "100%" : undefined,
              height: circle ? "100%" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: fontSize * 0.22,
              padding: circle ? 0 : `${padY}px ${padX}px`,
              borderRadius: circle ? "50%" : Math.max(0, radius - bw),
              background: props.color,
              color: props.textColor,
            }}
          >
            {mark}
            {word}
            {/* Gloss: a soft top light and a slanted sheen that moves with every new surface. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(115deg, rgba(255,255,255,0) ${gloss - 16}%, rgba(255,255,255,0.32) ${gloss}%, rgba(255,255,255,0) ${gloss + 12}%)`,
              }}
            />
          </div>
        </div>
        {peel ? (
          <>
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: fold * 1.12,
                height: fold * 1.12,
                background: "rgba(0, 0, 0, 0.28)",
                clipPath: "polygon(0% 0%, 100% 0%, 0% 100%)",
                borderTopLeftRadius: Math.min(fold, radius),
                transform: `translate(${-fold * 0.08}px, ${-fold * 0.08}px)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: fold,
                height: fold,
                background: "linear-gradient(135deg, #ffffff 0%, #ececec 30%, #c4c4c4 50%)",
                clipPath: "polygon(0% 0%, 100% 0%, 0% 100%)",
                borderTopLeftRadius: Math.min(fold, radius),
              }}
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <AbsoluteFill style={{ background: "#0b0b0d", opacity: out }}>
      {images.length ? (
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img
            src={images[index]}
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${(1.06 + 0.12 * rc("zs")) * (1 + 0.006 * local)}) translate(${(rc("zx") - 0.5) * 4}%, ${(rc("zy") - 0.5) * 4}%)`,
            }}
          />
        </AbsoluteFill>
      ) : (
        <Surface index={index} width={width} height={height} u={u} id={id} r={rc} local={local} />
      )}
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id={`${id}-vig`} cx="50%" cy="50%" r="75%">
            <stop offset="55%" stopColor="#000000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.5} />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill={`url(#${id}-vig)`} />
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: fontSize * 0.6 }}>
          <div
            style={{
              opacity: ramp(frame, 0, 3),
              transform: `translate(${jx}px, ${jy}px) rotate(${angle.toFixed(2)}deg) skewX(${skew.toFixed(2)}deg) scale(${scale.toFixed(4)})`,
            }}
          >
            {sticker}
          </div>
          {props.tagline ? (
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: Math.max(14, fontSize * 0.2),
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#ffffff",
                background: "rgba(10, 10, 12, 0.82)",
                padding: `${fontSize * 0.09}px ${fontSize * 0.22}px`,
                borderRadius: 999,
                whiteSpace: "nowrap",
                opacity: tagIn,
                transform: `translateY(${(1 - tagIn) * 20 * u}px)`,
              }}
            >
              {props.tagline}
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
      {props.flash && cut > 0 && local === 0 ? <AbsoluteFill style={{ background: "#ffffff", opacity: 0.7 }} /> : null}
    </AbsoluteFill>
  );
}

/** Rough advance width per character, in ems, so long names shrink to fit. */
const CHAR_WIDTH: Record<string, number> = {
  sans: 0.58,
  display: 0.56,
  serif: 0.46,
  fraunces: 0.55,
  grotesk: 0.58,
  syne: 0.66,
  wide: 0.82,
  condensed: 0.44,
  mono: 0.62,
};

/** The surface for cut n: walks the cuts so two neighbours never share one. */
function sequence(cut: number, count: number, seed: number) {
  let index = Math.floor(random(`${seed}-pick-0`) * count);
  for (let c = 1; c <= cut; c++) index = (index + 1 + Math.floor(random(`${seed}-pick-${c}`) * (count - 1))) % count;
  return index;
}

/** A die-cut outline that follows the letters: rings of shadow copies, then a soft drop shadow. */
function dieCutShadow(bw: number, border: string, off: number, blur: number, alphaValue: number) {
  const ring = (r: number, steps: number, color: string, dx = 0, dy = 0, b = 0) =>
    Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2;
      return `${(Math.cos(a) * r + dx).toFixed(1)}px ${(Math.sin(a) * r + dy).toFixed(1)}px ${b.toFixed(1)}px ${color}`;
    });
  return [
    ...ring(bw, 24, border),
    ...ring(bw * 0.5, 12, border),
    ...ring(bw, 10, `rgba(0, 0, 0, ${(alphaValue * 0.6).toFixed(3)})`, off * 0.35, off, blur),
  ].join(", ");
}

function MarkIcon({ kind, size, color, stroke, strokeWidth }: { kind: string; size: number; color: string; stroke?: string; strokeWidth: number }) {
  const paint = { fill: color, stroke, strokeWidth: stroke ? strokeWidth : 0, strokeLinejoin: "round" as const, paintOrder: "stroke" };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: "visible", flexShrink: 0 }}>
      {kind === "dot" ? <circle cx={50} cy={50} r={44} {...paint} /> : null}
      {kind === "star" ? <polygon points={starPoints()} {...paint} /> : null}
      {kind === "bolt" ? <polygon points="60,2 14,58 44,58 36,98 86,38 56,38 64,2" {...paint} /> : null}
      {kind === "heart" ? (
        <path d="M50 90 C 20 68, 4 50, 4 30 C 4 14, 16 4, 30 4 C 40 4, 47 10, 50 18 C 53 10, 60 4, 70 4 C 84 4, 96 14, 96 30 C 96 50, 80 68, 50 90 Z" {...paint} />
      ) : null}
    </svg>
  );
}

function starPoints() {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 48 : 21;
    return `${(50 + Math.cos(a) * r).toFixed(1)},${(52 + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
}

// ---------------------------------------------------------------------------------------------
// Surfaces: drawn in SVG (patterns and turbulence, which the export draws exactly), varied per cut.

type SurfaceArgs = { w: number; h: number; u: number; id: string; r: (k: string) => number; n: number };

const pick = <T,>(list: readonly T[], v: number) => list[Math.min(list.length - 1, Math.floor(v * list.length))];

/** A hex color mixed toward black (t < 0) or white (t > 0). */
function shade(hex: string, t: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const target = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  const c = (x: number) => Math.round(x + (target - x) * k);
  return `rgb(${c((v >> 16) & 255)}, ${c((v >> 8) & 255)}, ${c(v & 255)})`;
}

/** Turbulence as a texture layer: alpha = a·noise + b, in one flat color. */
function noise(
  id: string,
  w: number,
  h: number,
  o: { fx: number; fy?: number; oct?: number; seed: number; a: number; b: number; rgb?: [number, number, number]; opacity?: number },
) {
  const [cr, cg, cb] = o.rgb ?? [0, 0, 0];
  return (
    <g key={id}>
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={`${o.fx} ${o.fy ?? o.fx}`} numOctaves={o.oct ?? 2} seed={o.seed} />
        <feColorMatrix type="matrix" values={`0 0 0 0 ${cr}  0 0 0 0 ${cg}  0 0 0 0 ${cb}  ${o.a} 0 0 0 ${o.b}`} />
      </filter>
      <rect width={w} height={h} filter={`url(#${id})`} opacity={o.opacity ?? 1} />
    </g>
  );
}

/** A sheen: a soft diagonal band of light across the whole surface. */
function sheen(id: string, w: number, h: number, strength: number, at = 0.45) {
  return (
    <g key={id}>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset={at - 0.2} stopColor="#ffffff" stopOpacity={0} />
        <stop offset={at} stopColor="#ffffff" stopOpacity={strength} />
        <stop offset={at + 0.18} stopColor="#ffffff" stopOpacity={0} />
      </linearGradient>
      <rect width={w} height={h} fill={`url(#${id})`} />
    </g>
  );
}

const STICKER_COLORS = ["#ff5d8f", "#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#8338ec", "#f8f9fa", "#ff8c42"];

function laptop({ w, h, u, id, r, n }: SurfaceArgs) {
  const [a, b, c] = pick(
    [
      ["#e4e6e9", "#b3b7bd", "#d2d5da"],
      ["#9b9ea4", "#63666c", "#86898f"],
      ["#3b414d", "#1f232b", "#2f3541"],
      ["#e9dccd", "#b9a28b", "#d9c5b1"],
    ],
    r("tone"),
  );
  const x0 = -w * 0.15;
  const y0 = -h * 0.15;
  const lw = w * (1.03 + 0.05 * r("lw"));
  const lh = h * (1.02 + 0.05 * r("lh"));
  const rx = 70 * u;
  const spots = [
    [0.13, 0.17],
    [0.87, 0.14],
    [0.15, 0.84],
    [0.78, 0.8],
    [0.5, 0.08],
  ];
  const start = Math.floor(r("sp") * spots.length);
  return (
    <>
      <rect width={w} height={h} fill="#0d0e10" />
      <linearGradient id={`${id}-al`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={a} />
        <stop offset="0.55" stopColor={b} />
        <stop offset="1" stopColor={c} />
      </linearGradient>
      <clipPath id={`${id}-lid`}>
        <rect x={x0} y={y0} width={lw} height={lh} rx={rx} />
      </clipPath>
      <rect x={x0} y={y0} width={lw} height={lh} rx={rx} fill={`url(#${id}-al)`} />
      <g clipPath={`url(#${id}-lid)`}>
        {noise(`${id}-brush`, w, h, { fx: 0.0015 / u, fy: 0.5 / u, oct: 2, seed: n, a: 0.35, b: -0.08 })}
        {sheen(`${id}-sh`, w, h, 0.22, 0.35 + 0.3 * r("sh"))}
        {[0, 1, 2].map((i) => {
          const [sx, sy] = spots[(start + i * 2) % spots.length];
          const x = (sx + (r(`mx${i}`) - 0.5) * 0.04) * w;
          const y = (sy + (r(`my${i}`) - 0.5) * 0.04) * h;
          const fill = pick(STICKER_COLORS, r(`mc${i}`));
          const rot = (r(`mr${i}`) - 0.5) * 50;
          const round = r(`ms${i}`) > 0.5;
          const s = (0.8 + 0.5 * r(`mz${i}`)) * u;
          return (
            <g key={i} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
              {round ? (
                <circle r={78} fill={fill} stroke="#ffffff" strokeWidth={12} />
              ) : (
                <rect x={-100} y={-55} width={200} height={110} rx={55} fill={fill} stroke="#ffffff" strokeWidth={12} />
              )}
            </g>
          );
        })}
      </g>
      <rect x={x0} y={y0} width={lw} height={lh} rx={rx} fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={4 * u} />
    </>
  );
}

function brick({ w, h, u, id, r, n }: SurfaceArgs) {
  const [bricks, mortar] = pick(
    [
      [["#8e3b26", "#a2472e", "#7a3020", "#b0563a", "#963f29"], "#b7ab98"],
      [["#e9e4da", "#ddd7cb", "#f1ede5", "#d6cfc2", "#e4ded2"], "#bdb8ae"],
      [["#2b2b2e", "#323236", "#26262a", "#38383c", "#2e2e31"], "#4a4a4e"],
      [["#a5643f", "#b87650", "#94583a", "#c08560", "#9d5e3c"], "#c2b39c"],
    ] as const,
    r("tone"),
  );
  const bw = 230 * u;
  const bh = 76 * u;
  const m = 12 * u;
  const tile = (x: number, y: number, i: number) => (
    <rect key={`${x}-${y}`} x={x + m / 2} y={y + m / 2} width={bw - m} height={bh - m} rx={4 * u} fill={bricks[i % bricks.length]} />
  );
  return (
    <>
      <pattern
        id={`${id}-p`}
        width={bw * 4}
        height={bh * 2}
        patternUnits="userSpaceOnUse"
        patternTransform={`translate(${r("px") * bw} ${r("py") * bh})`}
      >
        <rect width={bw * 4} height={bh * 2} fill={mortar} />
        {[0, 1, 2, 3].map((k) => tile(k * bw, 0, k * 2 + 1))}
        {[0, 1, 2, 3, 4].map((k) => tile(-bw / 2 + k * bw, bh, k === 4 ? 2 : k * 3 + 2))}
      </pattern>
      <rect width={w} height={h} fill={`url(#${id}-p)`} />
      {noise(`${id}-weather`, w, h, { fx: 0.005 / u, oct: 4, seed: n, a: 1.1, b: -0.45 })}
      {noise(`${id}-grain`, w, h, { fx: 0.9 / u, oct: 1, seed: n + 3, a: 0.9, b: -0.3 })}
      <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.12} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.35} />
      </linearGradient>
      <rect width={w} height={h} fill={`url(#${id}-l)`} />
    </>
  );
}

function skateDeck({ w, h, u, id, r, n }: SurfaceArgs) {
  const wood = pick(["#c8925a", "#d9a86c", "#a86b3c", "#e0bf8f"], r("tone"));
  const plies = ["#e63946", "#1d3557", "#f1c453", "#2a9d8f", "#111111", "#f4a261"];
  const top = h * (0.08 + 0.05 * r("top"));
  const ply = 9 * u;
  const boltX = (r("side") > 0.5 ? 0.86 : 0.14) * w;
  return (
    <>
      <rect width={w} height={h} fill={wood} />
      {noise(`${id}-grain`, w, h, { fx: 0.0018 / u, fy: 0.06 / u, oct: 3, seed: n, a: 1.5, b: -0.62, rgb: [0.28, 0.14, 0.05] })}
      {noise(`${id}-fine`, w, h, { fx: 0.004 / u, fy: 0.9 / u, oct: 1, seed: n + 1, a: 0.5, b: -0.18, rgb: [0.3, 0.16, 0.06] })}
      {/* The deck's edge: grip tape on top, then the dyed maple plies. */}
      <rect width={w} height={top} fill="#141414" />
      {noise(`${id}-grip`, w, top, { fx: 0.8 / u, oct: 1, seed: n + 2, a: 1, b: -0.55, rgb: [1, 1, 1] })}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} y={top + i * ply} width={w} height={ply} fill={i % 2 ? wood : pick(plies, r(`ply${i}`))} />
      ))}
      <rect y={top + 6 * ply} width={w} height={6 * u} fill="#000000" opacity={0.25} />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => {
          const x = boltX + sx * 62 * u;
          const y = h * 0.58 + sy * 70 * u;
          return (
            <g key={`${sx}${sy}`}>
              <circle cx={x} cy={y + 3 * u} r={17 * u} fill="#000000" opacity={0.3} />
              <circle cx={x} cy={y} r={16 * u} fill="#9ca3af" stroke="#4b5563" strokeWidth={2 * u} />
              <path d={`M${x - 8 * u} ${y}H${x + 8 * u}M${x} ${y - 8 * u}V${y + 8 * u}`} stroke="#374151" strokeWidth={3.5 * u} />
            </g>
          );
        }),
      )}
      {sheen(`${id}-sh`, w, h, 0.18, 0.3 + 0.4 * r("sh"))}
    </>
  );
}

function streetSign({ w, h, u, id, r, n }: SurfaceArgs) {
  const [bg, ink] = pick(
    [
      ["#0f6b45", "#ffffff"],
      ["#1747a6", "#ffffff"],
      ["#b91c1c", "#ffffff"],
      ["#f2c230", "#111111"],
      ["#6b3e1f", "#ffffff"],
    ] as const,
    r("tone"),
  );
  const word = pick(["MAIN ST", "ONE WAY", "EXIT 24", "5TH AVE", "STOP", "NO PARKING", "SUNSET BLVD"], r("word"));
  const inset = 44 * u;
  const rivets = [
    [inset + 46 * u, inset + 46 * u],
    [w - inset - 46 * u, inset + 46 * u],
    [inset + 46 * u, h - inset - 46 * u],
    [w - inset - 46 * u, h - inset - 46 * u],
  ];
  return (
    <>
      <rect width={w} height={h} fill={bg} />
      <text
        x={w * (0.04 - 0.3 * r("tx"))}
        y={h * (0.4 + 0.5 * r("ty"))}
        fill={ink}
        opacity={0.92}
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight={700}
        fontSize={h * 0.42}
        letterSpacing={h * 0.01}
      >
        {word}
      </text>
      <rect x={inset} y={inset} width={w - inset * 2} height={h - inset * 2} rx={50 * u} fill="none" stroke={ink} strokeWidth={16 * u} />
      {rivets.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={15 * u} fill={shade(bg, -0.5)} />
          <circle cx={x - 2 * u} cy={y - 2 * u} r={12 * u} fill="#d1d5db" />
          <circle cx={x - 5 * u} cy={y - 5 * u} r={4 * u} fill="#ffffff" opacity={0.8} />
        </g>
      ))}
      {Array.from({ length: 14 }, (_, i) => {
        const x = r(`sx${i}`) * w;
        const y = r(`sy${i}`) * h;
        const len = (40 + 160 * r(`sl${i}`)) * u;
        const a = (r(`sa${i}`) - 0.5) * 0.8;
        return (
          <line
            key={i}
            x1={x}
            y1={y}
            x2={x + Math.cos(a) * len}
            y2={y + Math.sin(a) * len}
            stroke="#ffffff"
            strokeOpacity={0.18}
            strokeWidth={1.5 * u}
          />
        );
      })}
      {noise(`${id}-grime`, w, h, { fx: 0.004 / u, oct: 4, seed: n, a: 1.2, b: -0.6 })}
      {noise(`${id}-grain`, w, h, { fx: 0.7 / u, oct: 1, seed: n + 1, a: 0.5, b: -0.2 })}
      {sheen(`${id}-sh`, w, h, 0.2, 0.3 + 0.3 * r("sh"))}
    </>
  );
}

function cardboard({ w, h, u, id, r, n }: SurfaceArgs) {
  const tone = pick(["#c69c6d", "#b98c5a", "#d2ab7c", "#a87d4f"], r("tone"));
  const stamp = pick(["FRAGILE", "THIS SIDE UP", "HANDLE WITH CARE", "DO NOT CRUSH"], r("stamp"));
  const step = 22 * u;
  const tapeY = h * pick([0.18, 0.5, 0.82], r("ty"));
  const tapeA = (r("ta") - 0.5) * 24;
  const tapeH = 190 * u;
  const sx = r("sx") > 0.5;
  const stampSize = 96 * u;
  const stampW = stamp.length * stampSize * 0.62;
  return (
    <>
      <rect width={w} height={h} fill={tone} />
      <pattern id={`${id}-c`} width={step} height={step} patternUnits="userSpaceOnUse">
        <rect width={step * 0.45} height={step} fill="#000000" opacity={0.045} />
      </pattern>
      <rect width={w} height={h} fill={`url(#${id}-c)`} />
      {noise(`${id}-fiber`, w, h, { fx: 0.5 / u, oct: 2, seed: n, a: 0.8, b: -0.32, rgb: [0.25, 0.15, 0.05] })}
      {noise(`${id}-blot`, w, h, { fx: 0.003 / u, oct: 3, seed: n + 1, a: 0.9, b: -0.45, rgb: [0.3, 0.18, 0.06] })}
      <g transform={`rotate(-6 ${sx ? w * 0.75 : w * 0.25} ${h * 0.2})`} opacity={0.72}>
        <rect
          x={(sx ? w * 0.95 - stampW : w * 0.05) - 22 * u}
          y={h * 0.08}
          width={stampW + 44 * u}
          height={stampSize * 1.3}
          fill="none"
          stroke="#b3261e"
          strokeWidth={8 * u}
          rx={10 * u}
        />
        <text
          x={sx ? w * 0.95 - stampW : w * 0.05}
          y={h * 0.08 + stampSize * 1.03}
          fill="#b3261e"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight={900}
          fontSize={stampSize}
        >
          {stamp}
        </text>
      </g>
      {/* Packing tape. */}
      <g transform={`rotate(${tapeA} ${w / 2} ${tapeY})`}>
        <rect x={-w} y={tapeY - tapeH / 2} width={w * 3} height={tapeH} fill="#d8b77e" opacity={0.6} />
        <rect x={-w} y={tapeY - tapeH / 2 + tapeH * 0.15} width={w * 3} height={tapeH * 0.18} fill="#ffffff" opacity={0.2} />
        <rect x={-w} y={tapeY - tapeH / 2} width={w * 3} height={3 * u} fill="#000000" opacity={0.2} />
        <rect x={-w} y={tapeY + tapeH / 2 - 3 * u} width={w * 3} height={3 * u} fill="#000000" opacity={0.2} />
      </g>
    </>
  );
}

function concrete({ w, h, u, id, r, n }: SurfaceArgs) {
  const tone = pick(["#9a9893", "#7f7d79", "#b3afa7", "#6d6b68"], r("tone"));
  const cracks = [0, 1].map((k) => {
    let x = r(`cx${k}`) * w;
    let y = k ? 0 : h;
    let a = k ? Math.PI / 2 : -Math.PI / 2;
    const pts = [`${x},${y}`];
    for (let i = 0; i < 16; i++) {
      a += (r(`ca${k}-${i}`) - 0.5) * 1.1;
      const len = (30 + 40 * r(`cl${k}-${i}`)) * u;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  });
  const stripeX = (r("st") > 0.5 ? 0.12 : 0.88) * w;
  return (
    <>
      <rect width={w} height={h} fill={tone} />
      {noise(`${id}-blot`, w, h, { fx: 0.004 / u, oct: 4, seed: n, a: 1.2, b: -0.5 })}
      {noise(`${id}-light`, w, h, { fx: 0.012 / u, oct: 3, seed: n + 1, a: 0.9, b: -0.45, rgb: [1, 1, 1] })}
      <rect x={stripeX - 60 * u} y={-h} width={120 * u} height={h * 3} fill="#e0b31c" opacity={0.85} transform={`rotate(${(r("sa") - 0.5) * 16} ${stripeX} ${h / 2})`} />
      {noise(`${id}-grain`, w, h, { fx: 0.85 / u, oct: 1, seed: n + 2, a: 1, b: -0.35 })}
      {cracks.map((pts, k) => (
        <g key={k}>
          <polyline points={pts} fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={3 * u} transform={`translate(${1.5 * u} ${1.5 * u})`} />
          <polyline points={pts} fill="none" stroke="#1a1a1a" strokeOpacity={0.6} strokeWidth={2.5 * u} strokeLinejoin="round" />
        </g>
      ))}
    </>
  );
}

function notebook({ w, h, u, id, r, n }: SurfaceArgs) {
  const paper = pick(["#fbf8ef", "#fdf3b0", "#f4f1ea"], r("tone"));
  const line = 58 * u;
  const rot = (r("rot") - 0.5) * 6;
  const margin = w * 0.14;
  const doodle = Array.from({ length: 9 }, (_, i) => {
    const x = w * (r("dx") > 0.5 ? 0.62 : 0.2) + i * 34 * u;
    const y = h * (0.82 + 0.06 * r("dy")) + (i % 2 ? -26 : 26) * u;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <>
      <rect width={w} height={h} fill="#2a211b" />
      <g transform={`rotate(${rot} ${w / 2} ${h / 2})`}>
        <rect x={-w * 0.04} y={-h * 0.1} width={w * 1.2} height={h * 1.2} fill={paper} />
        <pattern id={`${id}-l`} width={w} height={line} patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${r("ly") * line})`}>
          <rect y={line - 2.5 * u} width={w} height={2.5 * u} fill="#8fb3e0" />
        </pattern>
        <rect x={-w * 0.04} y={h * 0.1} width={w * 1.2} height={h * 1.1} fill={`url(#${id}-l)`} />
        <rect x={margin} y={-h * 0.1} width={3 * u} height={h * 1.2} fill="#e07a7a" />
        {[0.2, 0.5, 0.8].map((y) => (
          <circle key={y} cx={w * 0.045} cy={h * y} r={24 * u} fill="#2a211b" />
        ))}
        {noise(`${id}-paper`, w, h, { fx: 0.6 / u, oct: 1, seed: n, a: 0.35, b: -0.12 })}
        <path d={doodle} fill="none" stroke="#1d4ed8" strokeWidth={4 * u} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
        <circle cx={w * (r("cx") > 0.5 ? 0.86 : 0.24)} cy={h * 0.16} r={42 * u} fill="none" stroke="#1d4ed8" strokeWidth={4 * u} opacity={0.8} />
      </g>
    </>
  );
}

function posters({ w, h, u, id, r, n }: SurfaceArgs) {
  const palette = ["#ff3b6b", "#ffd23f", "#2ec4b6", "#3a86ff", "#ff8c42", "#8338ec", "#06d6a0", "#f72585"];
  const base = pick(palette, r("base"));
  const words = ["LIVE", "SALE", "TONIGHT", "NEW", "DROP", "TOUR", "OPEN"];
  const dot = 18 * u;
  return (
    <>
      <rect width={w} height={h} fill={base} />
      <pattern id={`${id}-dots`} width={dot} height={dot} patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
        <circle cx={dot / 2} cy={dot / 2} r={dot * 0.22} fill="#000000" opacity={0.18} />
      </pattern>
      {[0, 1, 2, 3].map((i) => {
        const pw = w * (0.35 + 0.3 * r(`pw${i}`));
        const ph = h * (0.45 + 0.4 * r(`ph${i}`));
        const x = (r(`px${i}`) * 1.1 - 0.2) * w;
        const y = (r(`py${i}`) * 1.1 - 0.25) * h;
        const color = pick(palette, r(`pc${i}`));
        const rot = (r(`pr${i}`) - 0.5) * 10;
        return (
          <g key={i} transform={`rotate(${rot} ${x + pw / 2} ${y + ph / 2})`}>
            <rect x={x + 8 * u} y={y + 10 * u} width={pw} height={ph} fill="#000000" opacity={0.18} />
            <rect x={x} y={y} width={pw} height={ph} fill={color} />
            <rect x={x} y={y} width={pw} height={ph} fill={`url(#${id}-dots)`} />
            <text x={x + 24 * u} y={y + ph * 0.42} fontFamily="Impact, 'Arial Black', Arial, sans-serif" fontWeight={900} fontSize={ph * 0.36} fill="#111111" opacity={0.85}>
              {pick(words, r(`pt${i}`))}
            </text>
          </g>
        );
      })}
      {noise(`${id}-wrinkle`, w, h, { fx: 0.008 / u, oct: 3, seed: n, a: 0.7, b: -0.32, rgb: [1, 1, 1] })}
      {noise(`${id}-wrinkle2`, w, h, { fx: 0.008 / u, oct: 3, seed: n + 7, a: 0.7, b: -0.36 })}
    </>
  );
}

function fridge({ w, h, u, id, r, n }: SurfaceArgs) {
  const color = pick(["#bfe5d2", "#f3ead7", "#d63a2f", "#1f1f22", "#a9c8e8"], r("tone"));
  const handleX = (r("hx") > 0.5 ? 0.9 : 0.07) * w;
  const gapY = h * (0.14 + 0.08 * r("gy"));
  return (
    <>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={shade(color, 0.12)} />
        <stop offset="0.55" stopColor={color} />
        <stop offset="1" stopColor={shade(color, -0.2)} />
      </linearGradient>
      <rect width={w} height={h} fill={`url(#${id}-body)`} />
      <linearGradient id={`${id}-spec`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.38} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
      </linearGradient>
      <rect x={w * (0.22 + 0.15 * r("sx"))} width={w * 0.16} height={h} fill={`url(#${id}-spec)`} />
      <rect y={gapY} width={w} height={7 * u} fill="#000000" opacity={0.45} />
      <rect y={gapY + 7 * u} width={w} height={2 * u} fill="#ffffff" opacity={0.35} />
      <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#f5f5f5" />
        <stop offset="0.4" stopColor="#9a9a9a" />
        <stop offset="0.7" stopColor="#e8e8e8" />
        <stop offset="1" stopColor="#6f6f6f" />
      </linearGradient>
      <rect x={handleX - 14 * u} y={gapY + 80 * u} width={44 * u} height={h * 0.5} rx={22 * u} fill="#000000" opacity={0.25} />
      <rect x={handleX - 22 * u} y={gapY + 70 * u} width={44 * u} height={h * 0.5} rx={22 * u} fill={`url(#${id}-chrome)`} />
      {[0, 1, 2].map((i) => {
        const x = w * (0.15 + 0.7 * r(`mx${i}`));
        const y = h * (r(`my${i}`) > 0.5 ? 0.06 + 0.06 * r(`mz${i}`) : 0.84 + 0.08 * r(`mz${i}`));
        const fill = pick(STICKER_COLORS, r(`mc${i}`));
        return (
          <g key={i}>
            <circle cx={x + 4 * u} cy={y + 6 * u} r={30 * u} fill="#000000" opacity={0.25} />
            <circle cx={x} cy={y} r={30 * u} fill={fill} />
            <circle cx={x - 9 * u} cy={y - 9 * u} r={9 * u} fill="#ffffff" opacity={0.45} />
          </g>
        );
      })}
      {noise(`${id}-grain`, w, h, { fx: 0.9 / u, oct: 1, seed: n, a: 0.2, b: -0.06 })}
    </>
  );
}

function bottle({ w, h, u, id, r, n }: SurfaceArgs) {
  const color = pick(["#2f6f5e", "#e76f51", "#264653", "#c9ada7", "#e9c46a", "#5e60ce", "#151515"], r("tone"));
  const bwid = w * (h > w ? 0.9 : 0.72);
  const x = (w - bwid) / 2;
  return (
    <>
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#253043" />
        <stop offset="1" stopColor="#0d1016" />
      </linearGradient>
      <rect width={w} height={h} fill={`url(#${id}-bg)`} />
      <linearGradient id={`${id}-cyl`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={shade(color, -0.6)} />
        <stop offset="0.16" stopColor={color} />
        <stop offset="0.3" stopColor={shade(color, 0.3)} />
        <stop offset="0.48" stopColor={color} />
        <stop offset="0.84" stopColor={shade(color, -0.35)} />
        <stop offset="1" stopColor={shade(color, -0.7)} />
      </linearGradient>
      <clipPath id={`${id}-clip`}>
        <rect x={x} y={-h * 0.1} width={bwid} height={h * 1.2} rx={bwid * 0.12} />
      </clipPath>
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={x} y={-h * 0.1} width={bwid} height={h * 1.2} fill={`url(#${id}-cyl)`} />
        {noise(`${id}-coat`, w, h, { fx: 1.1 / u, oct: 1, seed: n, a: 1.1, b: -0.5 })}
        {noise(`${id}-coat2`, w, h, { fx: 1.1 / u, oct: 1, seed: n + 5, a: 0.8, b: -0.45, rgb: [1, 1, 1] })}
        <filter id={`${id}-soft`} x="-50%" y="0" width="200%" height="100%">
          <feGaussianBlur stdDeviation={10 * u} />
        </filter>
        <rect x={x + bwid * 0.26} y={-h * 0.1} width={bwid * 0.04} height={h * 1.2} fill="#ffffff" opacity={0.5} filter={`url(#${id}-soft)`} />
      </g>
    </>
  );
}

function guitarCase({ w, h, u, id, r, n }: SurfaceArgs) {
  const tone = pick(["#151515", "#2a1d16", "#1c2a3a", "#3a1414"], r("tone"));
  const thread = pick(["#d9c9a3", "#e5e7eb", "#f59e0b"], r("thread"));
  const inset = 70 * u;
  const latchX = w * (0.3 + 0.4 * r("lx"));
  return (
    <>
      <rect width={w} height={h} fill={tone} />
      {noise(`${id}-pebble`, w, h, { fx: 0.22 / u, oct: 2, seed: n, a: 1.3, b: -0.72, rgb: [1, 1, 1] })}
      {noise(`${id}-pebble2`, w, h, { fx: 0.22 / u, oct: 2, seed: n + 9, a: 1.3, b: -0.5 })}
      <rect x={inset - 30 * u} y={inset - 30 * u} width={w - (inset - 30 * u) * 2} height={h - (inset - 30 * u) * 2} rx={80 * u} fill="none" stroke="#050505" strokeWidth={30 * u} />
      <rect x={inset - 38 * u} y={inset - 38 * u} width={w - (inset - 38 * u) * 2} height={h - (inset - 38 * u) * 2} rx={88 * u} fill="none" stroke="#ffffff" strokeOpacity={0.12} strokeWidth={3 * u} />
      <rect
        x={inset}
        y={inset}
        width={w - inset * 2}
        height={h - inset * 2}
        rx={60 * u}
        fill="none"
        stroke={thread}
        strokeOpacity={0.85}
        strokeWidth={4 * u}
        strokeDasharray={`${22 * u} ${12 * u}`}
      />
      <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f3f4f6" />
        <stop offset="0.5" stopColor="#8b8f96" />
        <stop offset="1" stopColor="#d1d5db" />
      </linearGradient>
      <rect x={latchX - 90 * u} y={-20 * u} width={180 * u} height={90 * u} rx={14 * u} fill={`url(#${id}-chrome)`} />
      <rect x={latchX - 30 * u} y={30 * u} width={60 * u} height={22 * u} rx={6 * u} fill="#4b5563" />
      {sheen(`${id}-sh`, w, h, 0.1, 0.3 + 0.4 * r("sh"))}
    </>
  );
}

function tiles({ w, h, u, id, r, n }: SurfaceArgs) {
  const [tile, grout] = pick(
    [
      ["#f4f4f0", "#c9c6bd"],
      ["#9fd8c5", "#e8efe9"],
      ["#1b1b1d", "#5a5a5a"],
      ["#2754c5", "#dfe4ee"],
      ["#e8b4a0", "#f3e7dc"],
    ] as const,
    r("tone"),
  );
  const tw = 200 * u;
  const th = 100 * u;
  const g = 8 * u;
  const one = (x: number, y: number) => (
    <rect key={`${x}-${y}`} x={x + g / 2} y={y + g / 2} width={tw - g} height={th - g} rx={6 * u} fill={`url(#${id}-t)`} />
  );
  return (
    <>
      <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={shade(tile, 0.25)} />
        <stop offset="0.3" stopColor={tile} />
        <stop offset="1" stopColor={shade(tile, -0.08)} />
      </linearGradient>
      <pattern id={`${id}-p`} width={tw} height={th * 2} patternUnits="userSpaceOnUse" patternTransform={`translate(${r("px") * tw} 0)`}>
        <rect width={tw} height={th * 2} fill={grout} />
        {one(0, 0)}
        {one(-tw / 2, th)}
        {one(tw / 2, th)}
      </pattern>
      <rect width={w} height={h} fill={`url(#${id}-p)`} />
      {sheen(`${id}-sh`, w, h, 0.3, 0.25 + 0.5 * r("sh"))}
      {noise(`${id}-grain`, w, h, { fx: 0.006 / u, oct: 3, seed: n, a: 0.5, b: -0.25 })}
    </>
  );
}

const SURFACES = [laptop, brick, skateDeck, streetSign, cardboard, concrete, notebook, posters, fridge, bottle, guitarCase, tiles];

function Surface({
  index,
  width: w,
  height: h,
  u,
  id,
  r,
  local,
}: {
  index: number;
  width: number;
  height: number;
  u: number;
  id: string;
  r: (k: string) => number;
  local: number;
}) {
  const draw = SURFACES[index % SURFACES.length];
  // Each cut frames its surface differently: a bit closer, a bit turned, drifting in slowly.
  const scale = (1.1 + 0.12 * r("zoom")) * (1 + 0.004 * local);
  const rot = (r("turn") - 0.5) * 6;
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(${w / 2} ${h / 2}) rotate(${rot.toFixed(2)}) scale(${scale.toFixed(4)}) translate(${-w / 2} ${-h / 2})`}>
        {draw({ w, h, u, id: `${id}-s${index}`, r, n: Math.floor(r("noise") * 1000) })}
      </g>
    </svg>
  );
}
