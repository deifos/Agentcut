import { useId, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, random, useCurrentFrame } from "remotion";
import { FONTS, exitOut, onColor, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  headline: string[];
  kicker: string;
  bubble: string;
  paper: string;
  ink: string;
  accent: string;
  accent2: string;
  rate: number;
  jitter: number;
  images: string[];
  seed: number;
};

type Pt = [number, number];

/** Rounded so the server-rendered still and the client agree to the last digit. */
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Fonts the ransom-note words draw from, with a rough width per character (em). */
const WORD_FONTS = [
  { font: "condensed", upper: true, weight: 400, w: 0.5 },
  { font: "serif", upper: false, weight: 400, w: 0.5 },
  { font: "fraunces", upper: false, weight: 800, w: 0.6 },
  { font: "mono", upper: true, weight: 600, w: 0.62 },
  { font: "display", upper: false, weight: 800, w: 0.58 },
  { font: "wide", upper: true, weight: 800, w: 0.82 },
];

/**
 * A cut-paper collage, stop-motion style: on warm newsprint, torn color blocks, a constructivist
 * wedge and stripes, a halftone sun and cut-out graphics get slapped on by hand at a low frame rate,
 * the headline arrives as ransom-note scraps, then a pointing hand, a speech bubble and scribbles.
 * At the end the pieces are pulled off again in reverse order.
 */
export function CutAndPaste(props: Props) {
  const frame = useCurrentFrame();
  const { width: w, height: h, fps, durationInFrames: d } = props;
  const u = unit(w, h);
  const m = Math.min(w, h);
  const vertical = h > w;
  const id = `col${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const seed = props.seed;

  // Stop motion: time only moves in held steps (`rate` drawings a second), and every held
  // drawing nudges each piece by a pixel or two, like hands placing paper under a camera.
  const holdLen = fps / Math.max(4, props.rate);
  const hold = Math.floor(frame / holdLen);
  const q = hold * holdLen;
  const jit = props.jitter * u;
  const out = exitOut(frame, d, 5);

  // Removal: the last ~15% of the clip pulls pieces off, last placed first.
  const pieces: string[] = [];
  const order = (key: string) => {
    pieces.push(key);
    return pieces.length - 1;
  };
  type Placed = { x: number; y: number; s: number; r: number } | null;
  const placements: Record<string, { at: number; k: number; rot: number }> = {};
  const schedule = (key: string, at: number, rot = 5) => {
    placements[key] = { at, k: order(key), rot };
  };
  const place = (key: string): Placed => {
    const p = placements[key];
    const n = pieces.length;
    const rmStart = d * 0.84;
    const off = rmStart + ((n - 1 - p.k) / n) * (d - 5 - rmStart);
    if (q < p.at || q >= off) return null;
    const since = Math.floor((q - p.at) / holdLen + 1e-6);
    const dir = random(`${seed}-${key}-dir`) > 0.5 ? 1 : -1;
    const j = (k: string) => (random(`${seed}-${key}-${hold}-${k}`) - 0.5) * 2;
    return {
      x: r2(j("x") * jit),
      y: r2(j("y") * jit),
      s: [1.16, 1.04, 1][Math.min(2, since)],
      r: r2([p.rot, p.rot * 0.3, 0][Math.min(2, since)] * dir + j("r") * 0.35 * props.jitter),
    };
  };

  // ---- Layout (fractions of the frame, per orientation) ----
  const L = vertical
    ? {
        cy: h * 0.5,
        sun: [w * 0.72, h * 0.2, m * 0.26] as const,
        star: [w * 0.2, h * 0.15, m * 0.15] as const,
        photo3: [w * 0.24, h * 0.75, m * 0.3] as const,
        bubble: [w * 0.72, h * 0.7, m * 0.2] as const,
        stripesY: h * 0.88,
      }
    : {
        cy: h * 0.53,
        sun: [w * 0.8, h * 0.27, m * 0.2] as const,
        star: [w * 0.14, h * 0.22, m * 0.13] as const,
        photo3: [w * 0.12, h * 0.66, m * 0.26] as const,
        bubble: [w * 0.85, h * 0.72, m * 0.15] as const,
        stripesY: h * 0.9,
      };

  // ---- Headline: ransom-note scraps ----
  const lines = props.headline.filter((l) => l.trim()).slice(0, 4);
  const parsed = lines.map((line) => splitHighlights(line));
  const longest = Math.max(1, ...lines.map((l) => l.replace(/\*/g, "").length));
  const fs = Math.min(m * (vertical ? 0.13 : 0.12), (w * (vertical ? 0.86 : 0.7)) / (longest * 0.66 + 1));
  const headH = lines.length * fs * 1.45;
  const wordCount = parsed.reduce((n, l) => n + l.length, 0);

  // ---- Schedule (in frames; compared against held time) ----
  const step = holdLen;
  schedule("news1", 0, 0);
  schedule("block", 0, 2);
  schedule("wedge", step, 3);
  schedule("stripes", step * 2, 2);
  schedule("sun", step * 3, 6);
  schedule("star", step * 4, 10);
  schedule("photo3", step * 5, 6);
  schedule("news2", step * 2, 0);
  const kickAt = Math.max(step * 5, d * 0.12);
  schedule("kicker", kickAt, 6);
  const wordsFrom = kickAt + step;
  const wordsTo = Math.max(wordsFrom + step * wordCount, d * 0.48);
  const wordGap = Math.max(step, (wordsTo - wordsFrom) / Math.max(1, wordCount));
  let wi = 0;
  parsed.forEach((line, li) =>
    line.forEach((word, i) => {
      const at = wordsFrom + wordGap * wi++;
      schedule(`w${li}-${i}`, at, 7);
      // Emphasized words are cut letter by letter: each letter is slapped on half a beat apart.
      if (word.highlighted) [...word.text].forEach((_, ci) => schedule(`w${li}-${i}-${ci}`, at + Math.floor(ci / 2) * step, 9));
    }),
  );
  const afterWords = wordsFrom + wordGap * wordCount;
  schedule("hand", afterWords, 8);
  schedule("bubble", afterWords + step * 2, 8);
  schedule("scribble", afterWords + step, 0);
  schedule("circle", afterWords + step * 3, 0);
  schedule("doodles", afterWords + step * 4, 0);

  const images = props.images.map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const scrapBgs = ["#fbf8f1", props.ink, props.accent, props.accent2, "#d9ccb0", "#ffffff"];

  // ---- Torn shapes ----
  const tornPoly = (pts: Pt[], amp: number, stepPx: number, key: string) => jag(pts, amp, stepPx, `${seed}-${key}`);
  const t = (p: Placed, cx: number, cy: number) =>
    p ? `translate(${r2(cx + p.x)} ${r2(cy + p.y)}) rotate(${p.r}) scale(${p.s}) translate(${r2(-cx)} ${r2(-cy)})` : undefined;

  // Back layer: newsprint, blocks, wedge, stripes, sun, starburst.
  const news1 = place("news1");
  const news2 = place("news2");
  const block = place("block");
  const wedge = place("wedge");
  const stripes = place("stripes");
  const sun = place("sun");
  const star = place("star");
  const photo3 = place("photo3");

  const blockW = Math.min(w * 0.9, Math.max(w * 0.5, longest * fs * 0.62 + fs * 2));
  const blockH = headH + fs * 1.6;
  const blockPts = tornPoly(
    [
      [w / 2 - blockW / 2, L.cy - blockH / 2],
      [w / 2 + blockW / 2, L.cy - blockH / 2],
      [w / 2 + blockW / 2, L.cy + blockH / 2],
      [w / 2 - blockW / 2, L.cy + blockH / 2],
    ],
    6 * u,
    14 * u,
    "block",
  );
  const wedgePts = tornPoly(
    vertical
      ? [[w * 0.45, -20], [w + 20, -20], [w + 20, h * 0.42]]
      : [[w * 0.56, -20], [w + 20, -20], [w + 20, h * 0.8]],
    7 * u,
    18 * u,
    "wedge",
  );
  const stripeLen = w * 1.3;
  const stripeH = m * 0.05;
  const newsPts = (cx: number, cy: number, bw: number, bh: number, key: string) =>
    tornPoly(
      [
        [cx - bw / 2, cy - bh / 2],
        [cx + bw / 2, cy - bh / 2],
        [cx + bw / 2, cy + bh / 2],
        [cx - bw / 2, cy + bh / 2],
      ],
      5 * u,
      12 * u,
      key,
    );
  const n1 = vertical ? ([w * 0.3, h * 0.33, w * 0.52, h * 0.22] as const) : ([w * 0.24, h * 0.36, w * 0.3, h * 0.42] as const);
  const n2 = vertical ? ([w * 0.7, h * 0.62, w * 0.5, h * 0.2] as const) : ([w * 0.7, h * 0.66, w * 0.3, h * 0.36] as const);

  const starPts: Pt[] = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const rr = (i % 2 === 0 ? 1 : 0.62) * L.star[2];
    return [L.star[0] + Math.cos(a) * rr, L.star[1] + Math.sin(a) * rr];
  });
  const starTurn = (hold % 24) * 3.75;

  const scissor = Math.max(2, 3.5 * u);
  const dot = Math.max(4, 9 * u);

  const back = (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <filter id={`${id}-fibre`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={r2(0.006 / u)} numOctaves={3} seed={seed % 97} />
          <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.18  0 0 0 0.9 -0.32" />
        </filter>
        <pattern id={`${id}-lines`} width={r2(40 * u)} height={r2(7 * u)} patternUnits="userSpaceOnUse">
          <rect width={r2(36 * u)} height={r2(2.2 * u)} y={r2(2 * u)} fill={props.ink} opacity={0.42} />
        </pattern>
        <pattern id={`${id}-dots`} width={r2(dot)} height={r2(dot)} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx={r2(dot / 2)} cy={r2(dot / 2)} r={r2(dot * 0.36)} fill={props.ink} />
        </pattern>
        <pattern id={`${id}-dots-s`} width={r2(dot * 0.7)} height={r2(dot * 0.7)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx={r2(dot * 0.35)} cy={r2(dot * 0.35)} r={r2(dot * 0.16)} fill={props.ink} />
        </pattern>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
        </linearGradient>
        <mask id={`${id}-sunmask`}>
          <circle cx={r2(L.sun[0])} cy={r2(L.sun[1])} r={r2(L.sun[2])} fill={`url(#${id}-fade)`} />
        </mask>
        <radialGradient id={`${id}-age`} cx="50%" cy="50%" r="72%">
          <stop offset="60%" stopColor="#5b3a12" stopOpacity={0} />
          <stop offset="100%" stopColor="#5b3a12" stopOpacity={0.28} />
        </radialGradient>
      </defs>

      {/* Paper: newsprint color, fibres and aged edges. */}
      <rect width={w} height={h} fill={props.paper} />
      <rect width={w} height={h} filter={`url(#${id}-fibre)`} opacity={0.5} />
      <rect width={w} height={h} fill={`url(#${id}-age)`} />

      {/* Torn newspaper scraps: columns of "text" with a heading bar. */}
      {[
        [news1, n1, "n1"],
        [news2, n2, "n2"],
      ].map(([p, n, key]) => {
        const pl = p as Placed;
        const [cx, cy, bw, bh] = n as readonly [number, number, number, number];
        if (!pl) return null;
        const pts = newsPts(cx, cy, bw, bh, key as string);
        return (
          <g key={key as string} transform={t(pl, cx, cy)}>
            <polygon points={svgPts(pts)} fill="#e4dac4" />
            <polygon points={svgPts(pts)} fill={`url(#${id}-lines)`} opacity={0.5} />
            <rect x={r2(cx - bw * 0.42)} y={r2(cy - bh * 0.4)} width={r2(bw * 0.6)} height={r2(bh * 0.09)} fill={props.ink} opacity={0.75} />
          </g>
        );
      })}

      {/* The constructivist wedge. */}
      {wedge ? (
        <g transform={t(wedge, w * 0.85, h * 0.2)}>
          <polygon points={svgPts(wedgePts)} fill={props.accent} />
          <polygon points={svgPts(wedgePts)} fill={`url(#${id}-dots-s)`} opacity={0.22} />
        </g>
      ) : null}

      {/* Stripes band across the bottom, torn at the ends. */}
      {stripes ? (
        <g transform={`${t(stripes, w / 2, L.stripesY) ?? ""} rotate(-7 ${r2(w / 2)} ${r2(L.stripesY)})`}>
          {[props.ink, props.accent2, props.ink, props.paper].map((c, i) => (
            <polygon
              key={i}
              points={svgPts(
                tornPoly(
                  [
                    [w / 2 - stripeLen / 2, L.stripesY + (i - 2) * stripeH],
                    [w / 2 + stripeLen / 2, L.stripesY + (i - 2) * stripeH],
                    [w / 2 + stripeLen / 2, L.stripesY + (i - 1) * stripeH],
                    [w / 2 - stripeLen / 2, L.stripesY + (i - 1) * stripeH],
                  ],
                  2.5 * u,
                  16 * u,
                  `st${i}`,
                ),
              )}
              fill={c}
            />
          ))}
        </g>
      ) : null}

      {/* The color block behind the headline. */}
      {block ? (
        <g transform={t(block, w / 2, L.cy)}>
          <g transform={`rotate(-3 ${r2(w / 2)} ${r2(L.cy)})`}>
            <polygon points={svgPts(blockPts)} fill={props.accent2} />
            <polygon points={svgPts(blockPts)} fill={`url(#${id}-dots-s)`} opacity={0.16} />
          </g>
        </g>
      ) : null}

      {/* The halftone sun, cut out with a white scissor edge. */}
      {sun && !images[0] ? (
        <g transform={t(sun, L.sun[0], L.sun[1])}>
          <circle cx={r2(L.sun[0])} cy={r2(L.sun[1])} r={r2(L.sun[2])} fill={props.accent2} stroke="#ffffff" strokeWidth={r2(scissor * 2)} />
          <rect
            x={r2(L.sun[0] - L.sun[2])}
            y={r2(L.sun[1] - L.sun[2])}
            width={r2(L.sun[2] * 2)}
            height={r2(L.sun[2] * 2)}
            fill={`url(#${id}-dots)`}
            mask={`url(#${id}-sunmask)`}
          />
        </g>
      ) : null}

      {/* The starburst, turning in hand-placed steps. */}
      {star && !images[1] ? (
        <g transform={`${t(star, L.star[0], L.star[1])} rotate(${r2(starTurn)} ${r2(L.star[0])} ${r2(L.star[1])})`}>
          <polygon points={svgPts(starPts)} fill={props.accent} stroke="#ffffff" strokeWidth={r2(scissor * 2)} strokeLinejoin="round" />
          <circle cx={r2(L.star[0])} cy={r2(L.star[1])} r={r2(L.star[2] * 0.38)} fill={props.paper} />
          <circle cx={r2(L.star[0])} cy={r2(L.star[1])} r={r2(L.star[2] * 0.38)} fill={`url(#${id}-dots-s)`} opacity={0.4} />
        </g>
      ) : null}
    </svg>
  );

  // Photo scraps (optional images) take the sun, starburst and a third slot.
  const photoSlots = [
    { key: "sun", at: L.sun, p: sun, rot: 5 },
    { key: "star", at: L.star, p: star, rot: -7 },
    { key: "photo3", at: L.photo3, p: photo3, rot: 4 },
  ];
  const photos = images.map((src, i) => {
    const slot = photoSlots[i];
    if (!slot.p) return null;
    const pw = slot.at[2] * (i === 1 ? 2.1 : 1.7);
    const ph = pw * 1.2;
    const clip = cssPoly(
      tornPoly([[3, 3], [pw - 3, 3], [pw - 3, ph - 3], [3, ph - 3]], 4 * u, 12 * u, `ph${i}`),
      pw,
      ph,
    );
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: r2(slot.at[0] - pw / 2 + slot.p.x),
          top: r2(slot.at[1] - ph / 2 + slot.p.y),
          width: r2(pw),
          height: r2(ph),
          transform: `rotate(${r2(slot.rot + slot.p.r)}deg) scale(${slot.p.s})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transform: `translate(${r2(5 * u)}px, ${r2(7 * u)}px)`, background: "rgba(0, 0, 0, 0.28)", clipPath: clip }} />
        <div style={{ position: "absolute", inset: 0, background: "#ffffff", clipPath: clip }} />
        <div style={{ position: "absolute", inset: r2(scissor * 2.2), overflow: "hidden", clipPath: clip }}>
          <Img src={src} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <pattern id={`${id}-pd${i}`} width={r2(dot * 0.6)} height={r2(dot * 0.6)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <circle cx={r2(dot * 0.3)} cy={r2(dot * 0.3)} r={r2(dot * 0.14)} fill={props.ink} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${id}-pd${i})`} opacity={0.3} />
          </svg>
        </div>
      </div>
    );
  });

  // ---- Headline layer (HTML) ----
  const scrap = (text: string, key: string, size: number, emphasized: boolean): ReactNode => {
    const p = place(key);
    const rs = (k: string) => random(`${seed}-${key}-${k}`);
    const style = WORD_FONTS[Math.floor(rs("f") * WORD_FONTS.length)];
    const bg = emphasized ? (rs("e") > 0.5 ? props.accent : props.ink) : scrapBgs[Math.floor(rs("b") * scrapBgs.length)];
    const fg = bg === props.ink ? (emphasized ? props.accent2 : props.paper) : bg === props.accent ? onColor(props.accent) : props.ink;
    const label = style.upper ? text.toUpperCase() : text;
    const estW = Math.max(1, label.length * style.w * size + size * 0.7);
    const estH = size * 1.35;
    const amp = size * 0.06;
    const outer = cssPoly(tornPoly([[amp, amp], [estW - amp, amp], [estW - amp, estH - amp], [amp, estH - amp]], amp, size * 0.14, `${key}o`), estW, estH);
    const inner = cssPoly(tornPoly([[amp, amp], [estW - amp, amp], [estW - amp, estH - amp], [amp, estH - amp]], amp * 0.8, size * 0.12, `${key}i`), estW, estH);
    const baseRot = (rs("r") - 0.5) * 12;
    const lift = (rs("y") - 0.5) * size * 0.16;
    const scrapStyle: CSSProperties = {
      position: "relative",
      display: "inline-block",
      opacity: p ? 1 : 0,
      transform: p
        ? `translate(${p.x}px, ${r2(p.y + lift)}px) rotate(${r2(baseRot + p.r)}deg) scale(${p.s})`
        : `translateY(${r2(lift)}px) rotate(${r2(baseRot)}deg)`,
      margin: `0 ${r2(size * 0.04)}px`,
    };
    return (
      <div key={key} style={scrapStyle}>
        <div style={{ position: "absolute", inset: 0, transform: `translate(${r2(4 * u)}px, ${r2(6 * u)}px)`, background: "rgba(0, 0, 0, 0.3)", clipPath: outer }} />
        <div style={{ position: "relative", background: "#ffffff", clipPath: outer, padding: r2(scissor) }}>
          <div
            style={{
              background: bg,
              clipPath: inner,
              color: fg,
              fontFamily: FONTS[style.font],
              fontWeight: style.weight,
              fontStyle: style.font === "serif" && rs("i") > 0.5 ? "italic" : undefined,
              fontSize: r2(size),
              lineHeight: 1.12,
              padding: `${r2(size * 0.08)}px ${r2(size * 0.24)}px`,
              whiteSpace: "nowrap",
              letterSpacing: style.font === "mono" ? "0.02em" : "-0.01em",
            }}
          >
            {label}
          </div>
        </div>
      </div>
    );
  };

  const kick = place("kicker");
  const headline = (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: r2(fs * 0.12), transform: `translateY(${r2(L.cy - h / 2)}px)` }}>
        {props.kicker ? (
          <div
            style={{
              position: "relative",
              alignSelf: vertical ? "center" : "flex-start",
              marginBottom: r2(fs * 0.15),
              opacity: kick ? 1 : 0,
              transform: `translate(${kick?.x ?? 0}px, ${kick?.y ?? 0}px) rotate(${r2(-3 + (kick?.r ?? 0))}deg) scale(${kick?.s ?? 1})`,
            }}
          >
            <div
              style={{
                background: "#fbf8f1",
                color: props.ink,
                fontFamily: FONTS.mono,
                fontWeight: 600,
                fontSize: r2(Math.max(14, fs * 0.26)),
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                padding: `${r2(fs * 0.08)}px ${r2(fs * 0.2)}px`,
                boxShadow: `${r2(3 * u)}px ${r2(4 * u)}px 0 rgba(0, 0, 0, 0.22)`,
              }}
            >
              {props.kicker}
            </div>
            <Tape left={-fs * 0.22} top={-fs * 0.12} w={fs * 0.6} h={fs * 0.2} rot={-28} />
            <Tape right={-fs * 0.22} top={-fs * 0.1} w={fs * 0.6} h={fs * 0.2} rot={24} />
          </div>
        ) : null}
        {parsed.map((line, li) => (
          <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", rowGap: r2(fs * 0.1) }}>
            {line.map((word, i) => {
              const key = `w${li}-${i}`;
              if (!word.highlighted) return scrap(word.text, key, fs, false);
              return (
                <div key={key} style={{ display: "inline-flex", margin: `0 ${r2(fs * 0.08)}px` }}>
                  {[...word.text].map((ch, ci) => scrap(ch, `${key}-${ci}`, fs * 1.15, true))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
  // ---- Front layer: the pointing hand, the speech bubble, scribbles, doodles ----
  const hand = place("hand");
  const bubble = place("bubble");
  const scribble = place("scribble");
  const circle = place("circle");
  const doodles = place("doodles");

  // The hand: a sleeve from the bottom-left corner and a pointing hand, puppet-jointed at the wrist.
  const shoulder: Pt = vertical ? [w * -0.04, h * 0.98] : [w * -0.02, h * 1.04];
  const armLen = m * (vertical ? 0.42 : 0.42);
  const armAngle = (vertical ? -48 : -38) + Math.sin(hold * 0.8) * 3;
  const wristAngle = Math.sin(hold * 1.3 + 1) * 9;
  const sleeveW = m * 0.11;
  const handS = m * 0.1;

  const bubbleOpen = hold % 4 < 2 ? 1 : 1.07;
  const [bx, by, br] = L.bubble;
  const headBottom = L.cy + headH / 2 + fs * 0.25;
  const zig = (() => {
    const x0 = w / 2 - Math.min(w * 0.36, longest * fs * 0.34);
    const x1 = w - x0;
    const n = 9;
    return Array.from({ length: n + 1 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = headBottom + (i % 2 ? fs * 0.12 : -fs * 0.04) + (random(`${seed}-zz${i}`) - 0.5) * fs * 0.06;
      return `${i ? "L" : "M"}${r2(x)} ${r2(y)}`;
    }).join(" ");
  })();
  const loop = (() => {
    const [cx, cy, rr] = images[0] ? [L.sun[0], L.sun[1], L.sun[2] * 1.15] : L.sun;
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = -1.9 + (i / 40) * Math.PI * 2.25;
      const k = rr * (1.16 + 0.07 * Math.sin(i * 0.9 + seed) + i * 0.002);
      pts.push(`${i ? "L" : "M"}${r2(cx + Math.cos(a) * k * 1.08)} ${r2(cy + Math.sin(a) * k * 0.94)}`);
    }
    return pts.join(" ");
  })();
  const drawOn = (key: string, frames: number) => {
    const p = placements[key];
    const since = Math.max(0, q - p.at);
    return r2(Math.min(1, (since + holdLen) / frames));
  };

  const front = (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      {hand ? (
        <g transform={`translate(${hand.x} ${hand.y}) rotate(${r2(armAngle)} ${r2(shoulder[0])} ${r2(shoulder[1])})`}>
          {/* Sleeve: striped cut-out. */}
          <rect x={r2(shoulder[0])} y={r2(shoulder[1] - sleeveW / 2)} width={r2(armLen)} height={r2(sleeveW)} fill={props.ink} stroke="#ffffff" strokeWidth={r2(scissor * 2)} />
          {[0.2, 0.45, 0.7].map((f) => (
            <rect key={f} x={r2(shoulder[0] + armLen * f)} y={r2(shoulder[1] - sleeveW / 2)} width={r2(armLen * 0.08)} height={r2(sleeveW)} fill={props.accent} />
          ))}
          <rect x={r2(shoulder[0] + armLen - sleeveW * 0.25)} y={r2(shoulder[1] - sleeveW * 0.58)} width={r2(sleeveW * 0.35)} height={r2(sleeveW * 1.16)} fill="#ffffff" />
          {/* Hand, jointed at the wrist. */}
          <g transform={`rotate(${r2(wristAngle)} ${r2(shoulder[0] + armLen)} ${r2(shoulder[1])})`}>
            <g stroke="#ffffff" strokeWidth={r2(scissor * 2)} fill="#f1c9a5" strokeLinejoin="round">
              <rect x={r2(shoulder[0] + armLen + handS * 0.05)} y={r2(shoulder[1] - handS * 0.5)} width={r2(handS * 0.95)} height={r2(handS)} rx={r2(handS * 0.28)} />
              <rect x={r2(shoulder[0] + armLen + handS * 0.6)} y={r2(shoulder[1] - handS * 0.5)} width={r2(handS * 1.15)} height={r2(handS * 0.3)} rx={r2(handS * 0.15)} />
            </g>
            <g stroke={props.ink} strokeWidth={r2(2 * u)} fill="none" opacity={0.6}>
              <path d={`M${r2(shoulder[0] + armLen + handS * 0.35)} ${r2(shoulder[1] - handS * 0.05)} h${r2(handS * 0.55)}`} />
              <path d={`M${r2(shoulder[0] + armLen + handS * 0.35)} ${r2(shoulder[1] + handS * 0.22)} h${r2(handS * 0.5)}`} />
            </g>
          </g>
        </g>
      ) : null}

      {bubble && props.bubble ? (
        <g transform={`${t(bubble, bx, by)} translate(${r2(bx)} ${r2(by)}) scale(${bubbleOpen}) translate(${r2(-bx)} ${r2(-by)})`}>
          <g stroke={props.ink} strokeWidth={r2(3.5 * u)} strokeLinejoin="round">
            <polygon
              points={svgPts([
                [bx - br * 0.55, by + br * 0.45],
                [bx - br * 1.05, by + br * 1.05],
                [bx - br * 0.15, by + br * 0.55],
              ])}
              fill="#ffffff"
            />
            <ellipse cx={r2(bx)} cy={r2(by)} rx={r2(br * 1.25)} ry={r2(br * 0.78)} fill="#ffffff" />
          </g>
          <text
            x={r2(bx)}
            y={r2(by + br * 0.18)}
            textAnchor="middle"
            fontFamily="Impact, 'Arial Black', sans-serif"
            fontSize={r2(Math.min(br * 0.62, (br * 2.1) / Math.max(1, props.bubble.length * 0.55)))}
            fill={props.accent}
          >
            {props.bubble.toUpperCase()}
          </text>
        </g>
      ) : null}

      {scribble ? (
        <path d={zig} fill="none" stroke={props.accent} strokeWidth={r2(6 * u)} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={r2(1 - drawOn("scribble", holdLen * 3))} transform={`translate(${scribble.x} ${scribble.y})`} />
      ) : null}
      {circle ? (
        <path d={loop} fill="none" stroke={props.ink} strokeWidth={r2(4.5 * u)} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={r2(1 - drawOn("circle", holdLen * 3))} transform={`translate(${circle.x} ${circle.y})`} />
      ) : null}
      {doodles
        ? [0, 1, 2].map((i) => {
            const cx = (vertical ? [0.12, 0.88, 0.5] : [0.33, 0.66, 0.93])[i] * w;
            const cy = (vertical ? [0.32, 0.4, 0.06] : [0.12, 0.1, 0.48])[i] * h;
            const s = m * (0.022 + 0.01 * i);
            const tw = (random(`${seed}-dd${i}-${hold}`) - 0.5) * 18;
            return (
              <g key={i} transform={`rotate(${r2(tw)} ${r2(cx)} ${r2(cy)})`} stroke={i === 1 ? props.accent : props.ink} strokeWidth={r2(3.5 * u)} strokeLinecap="round">
                <path d={`M${r2(cx - s)} ${r2(cy)} H${r2(cx + s)} M${r2(cx)} ${r2(cy - s)} V${r2(cy + s)} M${r2(cx - s * 0.6)} ${r2(cy - s * 0.6)} L${r2(cx + s * 0.6)} ${r2(cy + s * 0.6)} M${r2(cx + s * 0.6)} ${r2(cy - s * 0.6)} L${r2(cx - s * 0.6)} ${r2(cy + s * 0.6)}`} />
              </g>
            );
          })
        : null}
    </svg>
  );

  // Film grain that changes with every held drawing.
  const grain = (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
      <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={(hold % 6) + seed} />
        <feColorMatrix values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.06  0 0 0 1.1 -0.42" />
      </filter>
      <rect width={w} height={h} filter={`url(#${id}-grain)`} opacity={0.55} />
    </svg>
  );

  return (
    <AbsoluteFill style={{ background: props.paper, opacity: out, overflow: "hidden" }}>
      {back}
      {photos}
      {headline}
      {front}
      {grain}
    </AbsoluteFill>
  );
}

/** A strip of translucent masking tape. */
function Tape(props: { left?: number; right?: number; top: number; w: number; h: number; rot: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: props.left !== undefined ? r2(props.left) : undefined,
        right: props.right !== undefined ? r2(props.right) : undefined,
        top: r2(props.top),
        width: r2(props.w),
        height: r2(props.h),
        background: "rgba(236, 222, 170, 0.78)",
        transform: `rotate(${props.rot}deg)`,
      }}
    />
  );
}

/** A polygon with torn edges: each side broken into short jagged steps (seeded). */
function jag(pts: Pt[], amp: number, step: number, key: string): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const n = Math.max(1, Math.round(len / Math.max(1, step)));
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const o = k === 0 ? 0 : (random(`${key}-${i}-${k}`) - 0.5) * 2 * amp;
      out.push([x1 + (x2 - x1) * f + nx * o, y1 + (y2 - y1) * f + ny * o]);
    }
  }
  return out;
}

const svgPts = (p: Pt[]) => p.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ");

/** The same polygon as a CSS clip-path, in % of the element's (estimated) box. */
const cssPoly = (p: Pt[], w: number, h: number) =>
  `polygon(${p.map(([x, y]) => `${r2(Math.min(100, Math.max(0, (x / w) * 100)))}% ${r2(Math.min(100, Math.max(0, (y / h) * 100)))}%`).join(", ")})`;
