// Looks: the graphic language a style draws with (cards, chips, stickers, backdrops, entrances).
// The talking-head components (hook-card, word-pop, sticker-badge, list-card, quote-card,
// before-after), the styled captions and the style overlay are built from these pieces, so one
// `look` restyles all of them. Same rules as the components: react, remotion and ./lib only;
// everything is driven by the frame.
import { useId, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import { FONTS, alpha, clamp01, easeOutExpo, exitOut, glowStyle, mix, onColor, ramp, splitHighlights } from "./lib";

/**
 * ink: neo-brutal · paper: cut-paper craft · notebook: grid paper and pen · crt: terminal ·
 * neon: cyberpunk · line: black and white line art, bold centered captions · vhs: 90s tape and TV ·
 * clean: soft cards.
 */
export type Look = "ink" | "paper" | "notebook" | "crt" | "neon" | "line" | "vhs" | "clean";

export const LOOKS: Look[] = ["ink", "paper", "notebook", "crt", "neon", "line", "vhs", "clean"];

/** Colors and fonts every look piece reads. Build it once per component with `lookKit`. */
export interface LookKit {
  look: Look;
  u: number;
  accent: string;
  onAccent: string;
  /** Card fill and the text on it (also the text on the backdrop). */
  panel: string;
  panelText: string;
  /** Borders, hard shadows, pen strokes, ink. */
  line: string;
  /** Full-frame fill under the texture. */
  backdrop: string;
  /** Text straight over footage. */
  text: string;
  /** Headline / small text. */
  head: string;
  body: string;
}

export interface LookProps {
  look: string;
  accent: string;
  panel: string;
  panelText: string;
  line: string;
  backdrop: string;
  /** Text straight over footage. */
  onVideo: string;
  font: string;
}

const BODY_FONT: Record<Look, string> = {
  ink: FONTS.grotesk,
  paper: FONTS.mono,
  notebook: FONTS.caveat,
  crt: FONTS.pixel,
  neon: FONTS.mono,
  line: FONTS.sans,
  vhs: FONTS.pixel,
  clean: FONTS.sans,
};

const isHex = (color: string) => /^#?[0-9a-f]{6}$/i.test(color.trim());
/** alpha() for colors that may not be hex (rgba panels): falls back to a neutral. */
const tint = (color: string, a: number, fallback = "#000000") => alpha(isHex(color) ? color : fallback, a);

export function lookKit(props: LookProps, u: number): LookKit {
  const look = (LOOKS as string[]).includes(props.look) ? (props.look as Look) : "ink";
  return {
    look,
    u,
    accent: props.accent,
    onAccent: onColor(props.accent),
    panel: props.panel,
    panelText: props.panelText,
    line: props.line,
    backdrop: props.backdrop,
    text: props.onVideo,
    head: FONTS[props.font] ?? FONTS.archivo,
    body: BODY_FONT[look],
  };
}

/** Headline weight per look (Archivo Black, Anton, VT323 have one weight). */
export function headWeight(kit: LookKit) {
  return kit.look === "line" ? 900 : kit.look === "notebook" ? 700 : kit.look === "clean" || kit.look === "neon" ? 800 : 400;
}

const labelCase = (kit: LookKit): CSSProperties["textTransform"] =>
  kit.look === "notebook" || kit.look === "crt" ? "none" : "uppercase";

/** VHS color bleed: red and cyan ghosts either side of the text. */
export function chroma(u: number, amount = 1) {
  return `${-3 * u * amount}px 0 rgba(255,40,60,0.75), ${3 * u * amount}px 0 rgba(40,220,255,0.7)`;
}

/** Deterministic 0…1 noise. */
export function hash(a: number, b = 0) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Stop-motion: the frame held for two (paper animates "on twos"). */
const onTwos = (frame: number) => frame - (frame % 2);

// ---------------------------------------------------------------------------
// Motion

/** Each look's entrance (opacity + transform), `delay` frames in. `seed` varies the paper jitter. */
export function enter(kit: LookKit, frame: number, fps: number, delay = 0, tilt = 0, seed = 1) {
  const f = frame - delay;
  switch (kit.look) {
    case "ink": {
      // A slap: overshooting scale and a twist that settles on the tilt.
      const s = spring({ frame: f, fps, config: { damping: 11, stiffness: 230, mass: 0.7 } });
      return {
        opacity: clamp01(s * 4),
        transform: `scale(${mix(0.55, 1, s)}) rotate(${mix(tilt - 9, tilt, s)}deg)`,
      };
    }
    case "paper": {
      // Slapped down from above, then the hand-animated wobble of stop-motion.
      if (f < 0) return { opacity: 0, transform: "scale(1.8)" };
      const s = interpolate(f, [0, 3, 5], [1.8, 0.94, 1], { extrapolateRight: "clamp" });
      const h = onTwos(frame);
      const settled = f >= 6;
      const jx = settled ? (hash(seed, h) - 0.5) * 3 * kit.u : 0;
      const jy = settled ? (hash(seed + 7, h) - 0.5) * 3 * kit.u : 0;
      const jr = settled ? (hash(seed + 13, h) - 0.5) * 1.2 : 0;
      return { opacity: 1, transform: `translate(${jx}px, ${jy}px) rotate(${tilt + jr}deg) scale(${s})` };
    }
    case "notebook": {
      const t = ramp(frame, delay, 14);
      return {
        opacity: t,
        transform: `translateY(${mix(22 * kit.u, 0, t)}px) rotate(${mix(tilt - 3, tilt, t)}deg)`,
      };
    }
    case "neon": {
      // Glitches in: a few frames of sideways tearing and flicker, then holds.
      if (f < 0) return { opacity: 0, transform: `rotate(${tilt}deg)` };
      if (f < 7) {
        const k = 1 - f / 7;
        const x = (hash(seed + f, 3) - 0.5) * 60 * kit.u * k;
        const skew = (hash(seed + f, 5) - 0.5) * 24 * k;
        return { opacity: f % 2 === 0 ? 1 : 0.55, transform: `translateX(${x.toFixed(1)}px) skewX(${skew.toFixed(1)}deg) rotate(${tilt}deg)` };
      }
      return { opacity: 1, transform: `rotate(${tilt}deg)` };
    }
    case "vhs": {
      // Tracking settles: a short roll from above with sideways jitter and flicker.
      if (f < 0) return { opacity: 0, transform: `rotate(${tilt}deg)` };
      if (f < 8) {
        const k = 1 - f / 8;
        const x = (hash(seed + f, 7) - 0.5) * 36 * kit.u * k;
        return { opacity: f % 3 === 1 ? 0.6 : 1, transform: `translate(${x.toFixed(1)}px, ${(-40 * kit.u * k * k).toFixed(1)}px) rotate(${tilt}deg)` };
      }
      return { opacity: 1, transform: `rotate(${tilt}deg)` };
    }
    case "line": {
      // A quick pop: overshoot, then settle.
      if (f < 0) return { opacity: 0, transform: `scale(0.6) rotate(${tilt}deg)` };
      const s = interpolate(f, [0, 3, 6], [0.6, 1.12, 1], { extrapolateRight: "clamp" });
      return { opacity: 1, transform: `scale(${s}) rotate(${tilt}deg)` };
    }
    case "crt": {
      // Power-on flicker, no movement.
      const opacity = f < 0 ? 0 : f < 2 ? 0.5 : f < 3 ? 0.1 : f < 5 ? 0.85 : 1;
      return { opacity, transform: `rotate(${tilt}deg)` };
    }
    default: {
      const t = ramp(frame, delay, 18, easeOutExpo);
      return { opacity: t, transform: `translateY(${mix(28 * kit.u, 0, t)}px) rotate(${tilt}deg)` };
    }
  }
}

/** Characters of `text` typed so far (crt types, other looks show it all once in). */
export function typed(kit: LookKit, text: string, frame: number, start: number, perFrame = 1.6) {
  if (kit.look !== "crt") return text;
  return text.slice(0, Math.max(0, Math.floor((frame - start) * perFrame)));
}

// ---------------------------------------------------------------------------
// Texture

function useSvgId(prefix: string) {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

const fullSvg: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };

/** Thin horizontal lines, as an SVG pattern (the export draws SVG exactly). */
export function Scanlines({ u, opacity = 0.32 }: { u: number; opacity?: number }) {
  const id = useSvgId("scan");
  const gap = Math.max(3, 6 * u);
  return (
    <svg style={fullSvg}>
      <defs>
        <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <rect width={gap} height={gap / 2} fill={`rgba(0,0,0,${opacity})`} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Paper / film grain (SVG noise). `seed` changes per frame for moving grain. */
export function Grain({ opacity = 0.3, seed = 1, frequency = 0.85, warm = true }: { opacity?: number; seed?: number; frequency?: number; warm?: boolean }) {
  const id = useSvgId("grain");
  const [r, g, b] = warm ? [0.16, 0.11, 0.05] : [0, 0, 0];
  return (
    <svg style={fullSvg}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values={`0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${opacity * 2.2} -${opacity * 0.5}`} />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/** Corners darkened toward the edges (linear gradients only: the export can't draw sized radials). */
export function Vignette({ color = "#000000", amount = 0.35 }: { color?: string; amount?: number }) {
  const c0 = tint(color, amount);
  const c1 = tint(color, 0);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${c0} 0%, ${c1} 24%, ${c1} 76%, ${c0} 100%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${c0} 0%, ${c1} 18%, ${c1} 82%, ${c0} 100%)` }} />
    </>
  );
}

/** A torn-edged polygon in a 100×100 box (stretch it with preserveAspectRatio="none"). */
function tornBox(seed: number, depth = 3) {
  const pts: string[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number, side: number) => {
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const off = (hash(seed + side * 31, i) - 0.5) * depth;
      const x = mix(x0, x1, t) + (y0 === y1 ? 0 : off);
      const y = mix(y0, y1, t) + (y0 === y1 ? off : 0);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
  };
  edge(0, 0, 100, 0, 9, 1);
  edge(100, 0, 100, 100, 5, 2);
  edge(100, 100, 0, 100, 9, 3);
  edge(0, 100, 0, 0, 5, 4);
  return pts.join(" ");
}

/** A paper scrap behind its children: torn edges, a drop shadow and grain. */
function Scrap({ bg, seed, children, shadow = 0.4, style }: { bg: string; seed: number; children: ReactNode; shadow?: number; style?: CSSProperties }) {
  const points = tornBox(seed, 4);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: "3%", top: "7%", width: "100%", height: "100%", overflow: "visible" }}>
        <polygon points={points} fill={`rgba(20,12,4,${shadow})`} />
      </svg>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        <polygon points={points} fill={bg} />
      </svg>
      <span style={{ position: "relative", display: "inline-block" }}>{children}</span>
    </span>
  );
}

/** Paper colors a ransom chip can be cut from. */
function paperChips(kit: LookKit) {
  return [
    { bg: kit.panel, fg: kit.panelText },
    { bg: kit.accent, fg: kit.onAccent },
    { bg: kit.line, fg: kit.panel },
    { bg: "#dcc7a0", fg: "#1a1410" },
    { bg: "#ffffff", fg: isHex(kit.accent) ? kit.accent : "#1a1410" },
  ];
}

const RANSOM_FONTS = [FONTS.archivo, FONTS.serif, FONTS.condensed, FONTS.mono, FONTS.fraunces, FONTS.grotesk];

/** Text cut letter by letter from different papers and typefaces, each letter slapped down in turn. */
export function CutLetters({ kit, text, fontSize, frame, fps, start = 0, stagger = 2, seed = 1 }: { kit: LookKit; text: string; fontSize: number; frame: number; fps: number; start?: number; stagger?: number; seed?: number }) {
  const chips = paperChips(kit);
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  // Letters land one after another across the words; a word never breaks across lines.
  const offsets = words.map((_, w) => words.slice(0, w).reduce((sum, word) => sum + word.length, 0));
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", columnGap: fontSize * 0.3, rowGap: fontSize * 0.1 }}>
      {words.map((word, w) => (
        <span key={w} style={{ display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
          {Array.from(word).map((ch, c) => {
            const index = offsets[w] + c;
            const s = seed * 97 + index * 13;
            const chip = chips[Math.floor(hash(s, 2) * chips.length)];
            const e = enter(kit, frame, fps, start + index * stagger, (hash(s, 3) - 0.5) * 16, s);
            return (
              <span key={c} style={{ display: "inline-block", margin: `0 ${fontSize * 0.03}px`, opacity: e.opacity, transform: e.transform }}>
                <Scrap bg={chip.bg} seed={s}>
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: RANSOM_FONTS[Math.floor(hash(s, 1) * RANSOM_FONTS.length)],
                      fontSize: fontSize * (0.88 + hash(s, 4) * 0.28),
                      lineHeight: 1.05,
                      color: chip.fg,
                      padding: `${fontSize * 0.06}px ${fontSize * 0.14}px ${fontSize * 0.02}px`,
                    }}
                  >
                    {ch}
                  </span>
                </Scrap>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** The full-frame ground of a look: halftone, cut paper, grid paper, CRT glass or a soft gradient. */
export function Backdrop({ kit, width, height, seed = 1 }: { kit: LookKit; width: number; height: number; seed?: number }) {
  const id = useSvgId("bd");
  const u = kit.u;
  const fillStyle: CSSProperties = { position: "absolute", inset: 0, background: kit.backdrop, overflow: "hidden" };
  if (kit.look === "ink") {
    const step = 26 * u;
    return (
      <div style={fillStyle}>
        <svg style={fullSvg}>
          <defs>
            <pattern id={`${id}p`} width={step} height={step} patternUnits="userSpaceOnUse">
              <circle cx={step / 2} cy={step / 2} r={step * 0.2} fill={tint(kit.line, 0.16)} />
            </pattern>
            <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.15" />
              <stop offset="1" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id={`${id}m`}>
              <rect width="100%" height="100%" fill={`url(#${id}g)`} />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id}p)`} mask={`url(#${id}m)`} />
        </svg>
      </div>
    );
  }
  if (kit.look === "paper") {
    // Kraft ground with two torn sheets laid across it.
    return (
      <div style={fillStyle}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: "-12%", top: "8%", width: "80%", height: "46%", transform: "rotate(-7deg)" }}>
          <polygon points={tornBox(seed + 3, 3)} fill={kit.accent} />
        </svg>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", right: "-14%", bottom: "4%", width: "86%", height: "42%", transform: "rotate(5deg)" }}>
          <polygon points={tornBox(seed + 9, 3)} fill={kit.panel} />
        </svg>
        <Grain opacity={0.32} seed={seed} />
      </div>
    );
  }
  if (kit.look === "notebook") {
    const step = 48 * u;
    return (
      <div style={fillStyle}>
        <svg style={fullSvg}>
          <defs>
            <pattern id={`${id}p`} width={step} height={step} patternUnits="userSpaceOnUse">
              <path d={`M ${step} 0 L 0 0 0 ${step}`} fill="none" stroke="rgba(70,90,130,0.16)" strokeWidth={Math.max(1, 1.5 * u)} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id}p)`} />
        </svg>
      </div>
    );
  }
  if (kit.look === "neon") {
    const horizon = height * 0.58;
    const lines: ReactNode[] = [];
    for (let i = -12; i <= 12; i += 1) {
      lines.push(<line key={`v${i}`} x1={width / 2 + i * width * 0.02} y1={horizon} x2={width / 2 + i * width * 0.22} y2={height} />);
    }
    for (let i = 1; i <= 9; i += 1) {
      const y = horizon + (height - horizon) * Math.pow(i / 9, 2.2);
      lines.push(<line key={`h${i}`} x1={0} y1={y} x2={width} y2={y} />);
    }
    return (
      <div style={fillStyle}>
        <div style={glowStyle(width * 0.15, height * 0.18, width * 1.2, width * 1.2, kit.accent, 0.3)} />
        <div style={glowStyle(width * 0.9, height * 0.75, width * 1.1, width * 1.1, isHex(kit.line) ? kit.line : "#22e8ff", 0.22)} />
        <svg style={fullSvg}>
          <g stroke={tint(kit.accent, 0.45)} strokeWidth={Math.max(1, 1.6 * u)}>{lines}</g>
          <line x1={0} y1={horizon} x2={width} y2={horizon} stroke={isHex(kit.line) ? kit.line : "#22e8ff"} strokeWidth={Math.max(1, 2 * u)} opacity={0.8} />
        </svg>
        <Scanlines u={u} opacity={0.14} />
      </div>
    );
  }
  if (kit.look === "line") {
    return <div style={fillStyle} />;
  }
  if (kit.look === "vhs") {
    return (
      <div style={{ ...fillStyle, background: `linear-gradient(180deg, ${kit.backdrop} 0%, ${tint(kit.backdrop, 0.85, "#1626c9")} 100%)` }}>
        <Grain opacity={0.18} seed={seed} warm={false} frequency={1.1} />
        <Scanlines u={u} opacity={0.18} />
        <Vignette amount={0.35} />
      </div>
    );
  }
  if (kit.look === "crt") {
    const step = 60 * u;
    return (
      <div style={fillStyle}>
        <svg style={fullSvg}>
          <defs>
            <pattern id={`${id}p`} width={step} height={step} patternUnits="userSpaceOnUse">
              <path d={`M ${step} 0 L 0 0 0 ${step}`} fill="none" stroke={tint(kit.accent, 0.07)} strokeWidth={Math.max(1, 1.2 * u)} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id}p)`} />
        </svg>
        <div style={glowStyle(width / 2, height / 2, width * 1.3, height * 1.1, kit.accent, 0.14)} />
        <Scanlines u={u} />
        <Vignette amount={0.45} />
      </div>
    );
  }
  return (
    <div style={{ ...fillStyle, background: `linear-gradient(165deg, ${tint(kit.accent, 0.18)} 0%, ${kit.backdrop} 45%, ${kit.backdrop} 100%)` }}>
      <div style={glowStyle(width * 0.25, height * 0.15, width * 1.1, width * 1.1, kit.accent, 0.12)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards

/** A card in the look: ink border + hard shadow, torn paper, taped notebook page, terminal window or a soft card. */
export function Panel({
  kit,
  children,
  style,
  title,
  seed = 1,
}: {
  kit: LookKit;
  children: ReactNode;
  style?: CSSProperties;
  /** crt window title. */
  title?: string;
  seed?: number;
}) {
  const u = kit.u;
  const base: CSSProperties = { position: "relative", color: kit.panelText, ...style };
  if (kit.look === "ink") {
    return (
      <div
        style={{
          ...base,
          background: kit.panel,
          border: `${Math.max(3, 6 * u)}px solid ${kit.line}`,
          borderRadius: 10 * u,
          boxShadow: `${14 * u}px ${14 * u}px 0 ${kit.line}`,
        }}
      >
        {children}
      </div>
    );
  }
  if (kit.look === "paper") {
    const points = tornBox(seed, 2.5);
    return (
      <div style={base}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: 10 * u, top: 16 * u, width: "100%", height: "100%", overflow: "visible" }}>
          <polygon points={points} fill="rgba(20,12,4,0.42)" />
        </svg>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
          <polygon points={points} fill={kit.panel} />
        </svg>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <Grain opacity={0.22} seed={seed + 2} />
        </div>
        {/* Masking tape across a corner. */}
        <div style={{ position: "absolute", left: -24 * u, top: 18 * u, width: 150 * u, height: 40 * u, background: "rgba(232,220,186,0.86)", transform: "rotate(-32deg)" }} />
        <div style={{ position: "relative" }}>{children}</div>
      </div>
    );
  }
  if (kit.look === "notebook") {
    return (
      <div
        style={{
          ...base,
          background: kit.panel,
          border: `${Math.max(2, 3 * u)}px solid ${kit.line}`,
          // Uneven corners read as drawn by hand.
          borderRadius: `${10 * u}px ${26 * u}px ${12 * u}px ${20 * u}px / ${20 * u}px ${12 * u}px ${26 * u}px ${10 * u}px`,
          boxShadow: `0 ${8 * u}px ${24 * u}px rgba(0,0,0,0.18)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: -22 * u,
            width: 170 * u,
            height: 44 * u,
            marginLeft: -85 * u,
            background: "rgba(236,226,196,0.82)",
            transform: "rotate(-3deg)",
          }}
        />
        {children}
      </div>
    );
  }
  if (kit.look === "neon") {
    const cut = 28 * u;
    const glowColor = isHex(kit.line) ? kit.line : "#22e8ff";
    const shape = `polygon(${cut}px 0, 100% 0, 100% calc(100% - ${cut}px), calc(100% - ${cut}px) 100%, 0 100%, 0 ${cut}px)`;
    return (
      <div style={{ ...base, filter: `drop-shadow(0 0 ${14 * u}px ${tint(glowColor, 0.55)})` }}>
        <div style={{ position: "absolute", inset: 0, background: glowColor, clipPath: shape }} />
        <div style={{ position: "absolute", inset: Math.max(2, 3 * u), background: kit.panel, clipPath: shape }} />
        <div style={{ position: "absolute", left: cut * 1.4, top: -Math.max(2, 3 * u), width: 90 * u, height: Math.max(4, 7 * u), background: kit.accent }} />
        <div style={{ position: "relative" }}>{children}</div>
      </div>
    );
  }
  if (kit.look === "line") {
    return (
      <div style={{ ...base, background: kit.panel, border: `${Math.max(2, 3 * u)}px solid ${kit.line}` }}>
        {children}
      </div>
    );
  }
  if (kit.look === "vhs") {
    return (
      <div
        style={{
          ...base,
          background: kit.panel,
          border: `${Math.max(2, 3 * u)}px solid ${kit.line}`,
          outline: `${Math.max(1, 2 * u)}px solid ${kit.line}`,
          outlineOffset: `${6 * u}px`,
        }}
      >
        {children}
        <Scanlines u={u} opacity={0.16} />
      </div>
    );
  }
  if (kit.look === "crt") {
    const bar = 46 * u;
    return (
      <div
        style={{
          ...base,
          background: kit.panel,
          border: `${Math.max(2, 3 * u)}px solid ${kit.line}`,
          boxShadow: `0 0 ${30 * u}px ${tint(kit.line, 0.35)}`,
          paddingTop: bar,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: bar,
            display: "flex",
            alignItems: "center",
            gap: 10 * u,
            padding: `0 ${18 * u}px`,
            borderBottom: `${Math.max(1, 2 * u)}px solid ${tint(kit.line, 0.6)}`,
            fontFamily: kit.body,
            fontSize: 30 * u,
            color: tint(kit.line, 0.85),
          }}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 14 * u, height: 14 * u, background: tint(kit.line, 0.7 - i * 0.2) }} />
          ))}
          <span style={{ marginLeft: 8 * u }}>{title ?? "~/note.txt"}</span>
        </div>
        {children}
        <Scanlines u={u} opacity={0.22} />
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        background: kit.panel,
        borderRadius: 30 * u,
        border: `${Math.max(1, 2 * u)}px solid rgba(255,255,255,0.1)`,
        boxShadow: `0 ${24 * u}px ${70 * u}px rgba(0,0,0,0.4)`,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Words

/** One highlighted word, drawn the look's way (the *starred* words of a line). */
function Accent({ kit, children, fontSize, onPanel, progress = 1, seed = 1 }: { kit: LookKit; children: ReactNode; fontSize: number; onPanel: boolean; progress?: number; seed?: number }) {
  const u = kit.u;
  if (kit.look === "ink") {
    return (
      <span
        style={{
          display: "inline-block",
          background: kit.accent,
          color: kit.onAccent,
          padding: `0 ${fontSize * 0.14}px`,
          border: `${Math.max(2, 3.5 * u)}px solid ${kit.line}`,
          borderRadius: 6 * u,
          lineHeight: 1.12,
        }}
      >
        {children}
      </span>
    );
  }
  if (kit.look === "paper") {
    return (
      <Scrap bg={kit.accent} seed={seed} shadow={0.35}>
        <span style={{ display: "inline-block", color: kit.onAccent, padding: `0 ${fontSize * 0.14}px` }}>{children}</span>
      </Scrap>
    );
  }
  if (kit.look === "notebook") {
    // A marker swipe that draws across the word.
    return (
      <span style={{ position: "relative", display: "inline-block" }}>
        <span
          style={{
            position: "absolute",
            left: -fontSize * 0.08,
            top: "38%",
            height: "52%",
            width: `calc(${progress * 100}% + ${fontSize * 0.16 * progress}px)`,
            background: tint(kit.accent, 0.85, "#ffd60a"),
            transform: "rotate(-1.5deg)",
            borderRadius: fontSize * 0.1,
          }}
        />
        <span style={{ position: "relative", color: onPanel ? kit.panelText : progress > 0.5 ? kit.onAccent : kit.text }}>{children}</span>
      </span>
    );
  }
  if (kit.look === "crt") {
    return <span style={{ display: "inline-block", background: kit.accent, color: kit.onAccent, padding: `0 ${fontSize * 0.12}px` }}>{children}</span>;
  }
  if (kit.look === "line") {
    return <span style={{ color: kit.accent }}>{children}</span>;
  }
  if (kit.look === "vhs") {
    return <span style={{ color: kit.accent, textShadow: chroma(u) }}>{children}</span>;
  }
  if (kit.look === "neon") {
    return (
      <span
        style={{
          display: "inline-block",
          background: kit.accent,
          color: kit.onAccent,
          padding: `0 ${fontSize * 0.14}px`,
          boxShadow: `${5 * u}px ${4 * u}px 0 ${kit.line}`,
          textShadow: "none",
        }}
      >
        {children}
      </span>
    );
  }
  return <span style={{ color: kit.accent }}>{children}</span>;
}

/**
 * A line of words with *starred* accents. Words appear one after another from `start`
 * (`stagger` frames apart), or at `times` (frames, one per word); otherwise all at once.
 */
export function Words({
  kit,
  line,
  fontSize,
  frame,
  start = 0,
  stagger = 0,
  times,
  onPanel = true,
  seed = 1,
  style,
}: {
  kit: LookKit;
  line: string;
  fontSize: number;
  frame: number;
  start?: number;
  stagger?: number;
  times?: number[];
  onPanel?: boolean;
  seed?: number;
  style?: CSSProperties;
}) {
  const words = splitHighlights(line);
  const animated = stagger > 0 || Boolean(times);
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", alignItems: "baseline", columnGap: fontSize * 0.26, rowGap: fontSize * 0.08, ...style }}>
      {words.map((word, i) => {
        const at = times?.[i] ?? start + i * stagger;
        // Spoken words (captions) take no space until they're said, so the box grows word by word.
        if (times && frame < at) return null;
        const t = animated ? ramp(frame, at, 5) : 1;
        const pop = animated ? interpolate(frame, [at, at + 3, at + 6], [0.7, 1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
        return (
          <span key={i} style={{ display: "inline-block", opacity: t, transform: `scale(${pop})` }}>
            {word.highlighted ? (
              <Accent kit={kit} fontSize={fontSize} onPanel={onPanel} progress={ramp(frame, at + 3, 10)} seed={seed * 31 + i}>
                {word.text}
              </Accent>
            ) : (
              word.text
            )}
          </span>
        );
      })}
    </span>
  );
}

/**
 * A caption-like phrase over footage: white box with ink border, ransom-note words on paper,
 * handwriting with a marker, terminal text on black, or a dark pill.
 */
export function Chip({
  kit,
  line,
  fontSize,
  frame,
  fps,
  start = 0,
  stagger = 0,
  times,
  seed = 1,
  onBackdrop = false,
  style,
}: {
  kit: LookKit;
  line: string;
  fontSize: number;
  frame: number;
  fps: number;
  start?: number;
  stagger?: number;
  times?: number[];
  seed?: number;
  /** Sits on the look's backdrop (a full-frame card) rather than over footage. */
  onBackdrop?: boolean;
  style?: CSSProperties;
}) {
  const u = kit.u;
  const words = (onPanel: boolean) => (
    <Words kit={kit} line={line} fontSize={fontSize} frame={frame} start={start} stagger={stagger} times={times} onPanel={onPanel} seed={seed} />
  );
  const text: CSSProperties = { fontSize, lineHeight: 1.15 };
  if (kit.look === "ink") {
    return (
      <span
        style={{
          ...text,
          display: "inline-block",
          fontFamily: kit.body,
          fontWeight: 700,
          textTransform: "uppercase",
          background: kit.panel,
          color: kit.panelText,
          border: `${Math.max(2, 4 * u)}px solid ${kit.line}`,
          boxShadow: `${6 * u}px ${6 * u}px 0 ${kit.line}`,
          padding: `${fontSize * 0.12}px ${fontSize * 0.3}px`,
          ...style,
        }}
      >
        {words(true)}
      </span>
    );
  }
  if (kit.look === "paper") {
    // Each word on its own scrap, in its own typeface.
    const chips = paperChips(kit);
    const list = splitHighlights(line);
    return (
      <span style={{ ...text, display: "inline-flex", flexWrap: "wrap", justifyContent: "center", gap: `${fontSize * 0.16}px ${fontSize * 0.12}px`, ...style }}>
        {list.map((word, i) => {
          const s = seed * 53 + i * 11;
          const chip = word.highlighted ? { bg: kit.accent, fg: kit.onAccent } : chips[Math.floor(hash(s, 2) * 4)];
          const at = times?.[i] ?? start + i * stagger;
          if (times && frame < at) return null;
          const e = enter(kit, frame, fps, at, (hash(s, 3) - 0.5) * 8, s);
          return (
            <span key={i} style={{ display: "inline-block", opacity: e.opacity, transform: e.transform }}>
              <Scrap bg={chip.bg} seed={s}>
                <span
                  style={{
                    display: "inline-block",
                    fontFamily: RANSOM_FONTS[Math.floor(hash(s, 1) * RANSOM_FONTS.length)],
                    fontSize: fontSize * (word.highlighted ? 1.2 : 1),
                    color: chip.fg,
                    padding: `${fontSize * 0.06}px ${fontSize * 0.2}px ${fontSize * 0.02}px`,
                    textTransform: hash(s, 5) > 0.4 ? "uppercase" : "none",
                  }}
                >
                  {word.text}
                </span>
              </Scrap>
            </span>
          );
        })}
      </span>
    );
  }
  if (kit.look === "notebook") {
    return (
      <span
        style={{
          ...text,
          display: "inline-block",
          fontFamily: kit.head,
          fontWeight: 700,
          fontSize: fontSize * 1.25,
          color: onBackdrop ? kit.panelText : kit.text,
          textShadow: onBackdrop ? undefined : `0 ${2 * u}px ${10 * u}px rgba(0,0,0,0.6), 0 0 ${2 * u}px rgba(0,0,0,0.8)`,
          ...style,
        }}
      >
        {words(onBackdrop)}
      </span>
    );
  }
  if (kit.look === "neon") {
    return (
      <span
        style={{
          ...text,
          display: "inline-block",
          transform: "skewX(-10deg)",
          background: "rgba(10,4,24,0.86)",
          border: `${Math.max(2, 2.5 * u)}px solid ${kit.line}`,
          boxShadow: `0 0 ${16 * u}px ${tint(kit.line, 0.6, "#22e8ff")}, ${6 * u}px ${6 * u}px 0 ${tint(kit.accent, 0.85)}`,
          padding: `${fontSize * 0.1}px ${fontSize * 0.34}px`,
          ...style,
        }}
      >
        <span style={{ display: "inline-block", transform: "skewX(10deg)", fontFamily: kit.body, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: kit.text }}>
          {words(true)}
        </span>
      </span>
    );
  }
  if (kit.look === "line") {
    const big = fontSize * 1.55;
    const stroke = Math.max(2, big * 0.09);
    return (
      <span
        style={{
          display: "inline-block",
          fontFamily: FONTS.heavy,
          fontWeight: 900,
          fontSize: big,
          lineHeight: 1.04,
          letterSpacing: "-0.01em",
          textTransform: "uppercase",
          color: onBackdrop ? kit.panelText : kit.text,
          WebkitTextStroke: onBackdrop ? undefined : `${stroke}px #000000`,
          paintOrder: "stroke fill",
          textShadow: onBackdrop ? undefined : `0 ${big * 0.06}px ${big * 0.1}px rgba(0,0,0,0.55)`,
          ...style,
        }}
      >
        <Words kit={kit} line={line} fontSize={big} frame={frame} start={start} stagger={stagger} times={times} onPanel={onBackdrop} seed={seed} />
      </span>
    );
  }
  if (kit.look === "vhs") {
    return (
      <span
        style={{
          ...text,
          display: "inline-block",
          fontFamily: FONTS.pixel,
          fontSize: fontSize * 1.3,
          lineHeight: 1.1,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          background: "#000000",
          color: "#ffffff",
          padding: `${fontSize * 0.02}px ${fontSize * 0.28}px`,
          ...style,
        }}
      >
        {words(true)}
      </span>
    );
  }
  if (kit.look === "crt") {
    return (
      <span
        style={{
          ...text,
          display: "inline-block",
          fontFamily: kit.body,
          fontSize: fontSize * 1.15,
          background: "rgba(0,0,0,0.82)",
          color: kit.panelText,
          padding: `${fontSize * 0.08}px ${fontSize * 0.3}px`,
          ...style,
        }}
      >
        {words(true)}
      </span>
    );
  }
  return (
    <span
      style={{
        ...text,
        display: "inline-block",
        fontFamily: kit.body,
        fontWeight: 700,
        background: "rgba(10,12,16,0.78)",
        color: kit.text,
        borderRadius: fontSize,
        padding: `${fontSize * 0.18}px ${fontSize * 0.5}px`,
        ...style,
      }}
    >
      {words(false)}
    </span>
  );
}

/** Big headline lines; each enters in turn. Color: the panel text (it sits on a card or the backdrop). */
export function Headline({
  kit,
  lines,
  fontSize,
  frame,
  fps,
  start = 0,
  align = "left",
  seed = 1,
}: {
  kit: LookKit;
  lines: string[];
  fontSize: number;
  frame: number;
  fps: number;
  start?: number;
  align?: "left" | "center";
  seed?: number;
}) {
  const items = align === "center" ? "center" : "flex-start";
  if (kit.look === "paper") {
    // Ransom note: every letter its own cut-out, line after line.
    const texts = lines.map((line) => line.replace(/\*/g, ""));
    const starts = texts.map((_, i) => start + texts.slice(0, i).reduce((sum, text) => sum + text.replace(/\s/g, "").length * 2 + 4, 0));
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: items, gap: fontSize * 0.08 }}>
        {texts.map((text, i) => (
          <CutLetters key={i} kit={kit} text={text} fontSize={fontSize * 0.62} frame={frame} fps={fps} start={starts[i]} seed={seed * 7 + i} />
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: items,
        textAlign: align,
        fontFamily: kit.head,
        fontWeight: headWeight(kit),
        // Orbitron runs wide: a size down keeps two words on a line.
        fontSize: kit.look === "neon" ? fontSize * 0.78 : fontSize,
        lineHeight: kit.look === "notebook" ? 1 : 0.98,
        letterSpacing: kit.look === "crt" ? "0.02em" : kit.look === "notebook" ? "0" : "-0.02em",
        textTransform: kit.look === "crt" || kit.look === "neon" || kit.look === "line" ? "uppercase" : "none",
        color: kit.panelText,
        textShadow:
          kit.look === "crt"
            ? `0 0 ${18 * kit.u}px ${tint(kit.accent, 0.55)}`
            : kit.look === "neon"
              ? `${-4 * kit.u}px 0 ${tint(kit.line, 0.9, "#22e8ff")}, ${4 * kit.u}px 0 ${tint(kit.accent, 0.9)}, 0 0 ${24 * kit.u}px ${tint(kit.accent, 0.5)}`
              : kit.look === "vhs"
                ? chroma(kit.u, 1.4)
                : undefined,
      }}
    >
      {lines.map((line, i) => {
        const e = enter(kit, frame, fps, start + i * 5, 0, seed + i);
        // Neon: every couple of seconds a line tears sideways for two frames.
        const tear = kit.look === "neon" && frame % 54 >= 52 - i ? `translateX(${((hash(i, frame) - 0.5) * 30 * kit.u).toFixed(1)}px)` : "";
        return (
          <div key={i} style={{ opacity: e.opacity, transform: `${e.transform} ${tear}`, transformOrigin: align === "center" ? "50% 60%" : "0% 60%" }}>
            <Words
              kit={kit}
              line={kit.look === "crt" ? typed(kit, line, frame, start + i * 10, 1.2) : line}
              fontSize={fontSize}
              frame={frame}
              seed={seed + i}
              style={{ justifyContent: align === "center" ? "center" : "flex-start" }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Small kicker / label text. */
export function Label({ kit, children, fontSize, color, style }: { kit: LookKit; children: ReactNode; fontSize: number; color?: string; style?: CSSProperties }) {
  const big = kit.look === "notebook" || kit.look === "crt";
  return (
    <div
      style={{
        fontFamily: kit.body,
        fontWeight: kit.look === "notebook" ? 600 : 700,
        fontSize: big ? fontSize * 1.35 : fontSize,
        letterSpacing: labelCase(kit) === "uppercase" ? "0.14em" : "0.01em",
        textTransform: labelCase(kit),
        color: color ?? kit.panelText,
        opacity: 0.8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stickers and tags

/** Points of a starburst polygon centered in a size×size box. */
function burst(size: number, points = 14, inner = 0.78) {
  const c = size / 2;
  const out: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = (i % 2 === 0 ? 1 : inner) * c;
    const a = (Math.PI * i) / points - Math.PI / 2;
    out.push(`${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(" ");
}

/** A wobbly hand-drawn loop around a w×h box (slightly overshooting where it closes). */
function scribble(w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const pts: string[] = [];
  for (let i = 0; i <= 56; i += 1) {
    const a = (i / 52) * Math.PI * 2 - 2.2;
    const wob = 1 + Math.sin(i * 1.7) * 0.025 + (i > 50 ? 0.06 : 0);
    pts.push(`${(cx + Math.cos(a) * (w / 2 - 6) * wob).toFixed(1)},${(cy + Math.sin(a) * (h / 2 - 6) * wob).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}

/** A badge for a number or one word: starburst, paper rosette, hand-drawn circle, terminal bracket or a disc. */
export function Sticker({ kit, text, size, frame, fps, start = 0, tilt = 8, seed = 1 }: { kit: LookKit; text: string; size: number; frame: number; fps: number; start?: number; tilt?: number; seed?: number }) {
  const u = kit.u;
  const e = enter(kit, frame, fps, start, kit.look === "crt" ? 0 : tilt, seed);
  const fontSize = size * (text.length <= 2 ? 0.46 : text.length <= 4 ? 0.3 : 0.22);
  const label: CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize, lineHeight: 1 };
  if (kit.look === "ink" || kit.look === "paper") {
    const stroke = kit.look === "ink" ? Math.max(3, 6 * u) : 0;
    const pad = stroke + 12 * u;
    return (
      <div style={{ position: "relative", width: size, height: size, opacity: e.opacity, transform: e.transform }}>
        <svg width={size} height={size} viewBox={`${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <polygon points={burst(size, kit.look === "paper" ? 18 : 14, kit.look === "paper" ? 0.86 : 0.78)} transform={`translate(${10 * u} ${12 * u})`} fill={kit.look === "ink" ? kit.line : "rgba(20,12,4,0.42)"} />
          <polygon points={burst(size, kit.look === "paper" ? 18 : 14, kit.look === "paper" ? 0.86 : 0.78)} fill={kit.accent} stroke={kit.line} strokeWidth={stroke} strokeLinejoin="round" />
        </svg>
        {kit.look === "paper" ? (
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden" }}>
            <Grain opacity={0.25} seed={seed} />
          </div>
        ) : null}
        <div style={{ ...label, fontFamily: kit.head, color: kit.onAccent, WebkitTextStroke: kit.look === "ink" ? `${Math.max(1, 2 * u)}px ${kit.line}` : undefined }}>{text}</div>
      </div>
    );
  }
  if (kit.look === "notebook") {
    const draw = ramp(frame, start + 4, 16);
    const path = scribble(size * 1.25, size);
    return (
      <div style={{ position: "relative", width: size * 1.25, height: size, opacity: e.opacity, transform: e.transform }}>
        <svg width={size * 1.25} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d={path} fill="none" stroke={kit.accent} strokeWidth={Math.max(3, 7 * u)} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        </svg>
        <div style={{ ...label, fontFamily: kit.head, fontWeight: 700, color: kit.text, fontSize: fontSize * 1.2, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{text}</div>
      </div>
    );
  }
  if (kit.look === "neon") {
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      return `${(size / 2 + Math.cos(a) * size * 0.48).toFixed(1)},${(size / 2 + Math.sin(a) * size * 0.48).toFixed(1)}`;
    }).join(" ");
    const glowColor = isHex(kit.line) ? kit.line : "#22e8ff";
    return (
      <div style={{ position: "relative", width: size, height: size, opacity: e.opacity, transform: e.transform, filter: `drop-shadow(0 0 ${12 * u}px ${glowColor})` }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <polygon points={pts} fill="rgba(10,4,24,0.85)" stroke={glowColor} strokeWidth={Math.max(2, 4 * u)} />
          <polygon points={pts} fill="none" stroke={kit.accent} strokeWidth={Math.max(1, 2 * u)} transform={`translate(${5 * u} ${4 * u})`} />
        </svg>
        <div style={{ ...label, fontFamily: kit.head, fontWeight: 800, color: "#ffffff", textShadow: `${-3 * u}px 0 ${glowColor}, ${3 * u}px 0 ${kit.accent}` }}>{text}</div>
      </div>
    );
  }
  if (kit.look === "line") {
    const draw = ramp(frame, start, 14);
    const r = size / 2 - 4 * u;
    return (
      <div style={{ position: "relative", width: size, height: size, opacity: e.opacity }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(0,0,0,0.55)" stroke={kit.line} strokeWidth={Math.max(2, 3 * u)} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
        <div style={{ ...label, fontFamily: FONTS.heavy, fontWeight: 900, color: kit.text, transform: e.transform }}>{text}</div>
      </div>
    );
  }
  if (kit.look === "vhs") {
    const segments = 16;
    const fillTo = Math.round(ramp(frame, start + 4, 18) * segments);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 * u, opacity: e.opacity, transform: e.transform, fontFamily: FONTS.pixel, color: kit.accent, textShadow: chroma(u) }}>
        <span style={{ fontSize: size * 0.42, lineHeight: 0.9 }}>{text}</span>
        <span style={{ display: "flex", gap: 5 * u }}>
          {Array.from({ length: segments }, (_, k) => (
            <span key={k} style={{ width: size * 0.045, height: size * 0.16, background: k < fillTo ? kit.accent : "rgba(255,255,255,0.25)" }} />
          ))}
        </span>
      </div>
    );
  }
  if (kit.look === "crt") {
    const blink = Math.floor((frame - start) / 15) % 2 === 0;
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10 * u,
          padding: `${8 * u}px ${20 * u}px`,
          background: "rgba(0,0,0,0.85)",
          border: `${Math.max(2, 3 * u)}px solid ${kit.accent}`,
          boxShadow: `0 0 ${24 * u}px ${tint(kit.accent, 0.45)}`,
          fontFamily: kit.head,
          fontSize: fontSize * 1.1,
          color: kit.accent,
          opacity: e.opacity,
        }}
      >
        <span>{typed(kit, text, frame, start + 4, 0.6)}</span>
        <span style={{ width: fontSize * 0.45, height: fontSize * 0.8, background: kit.accent, opacity: blink ? 1 : 0 }} />
      </div>
    );
  }
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: kit.accent,
        boxShadow: `0 ${14 * u}px ${40 * u}px ${tint(kit.accent, 0.45)}`,
        opacity: e.opacity,
        transform: e.transform,
      }}
    >
      <div style={{ ...label, fontFamily: kit.head, fontWeight: 800, color: kit.onAccent }}>{text}</div>
    </div>
  );
}

/** A small tilted label ("Claude Code"): ink tag, masking tape, taped paper scrap, prompt line or pill. */
export function Tag({ kit, text, fontSize, frame, fps, start = 0, tilt = -7, seed = 1 }: { kit: LookKit; text: string; fontSize: number; frame: number; fps: number; start?: number; tilt?: number; seed?: number }) {
  const u = kit.u;
  const e = enter(kit, frame, fps, start, kit.look === "crt" ? 0 : tilt, seed);
  const common: CSSProperties = { display: "inline-block", opacity: e.opacity, transform: e.transform, fontSize, lineHeight: 1.1, whiteSpace: "nowrap" };
  if (kit.look === "ink") {
    return (
      <span
        style={{
          ...common,
          fontFamily: kit.body,
          fontWeight: 700,
          background: kit.panel,
          color: kit.panelText,
          border: `${Math.max(2, 3.5 * u)}px solid ${kit.line}`,
          boxShadow: `${5 * u}px ${5 * u}px 0 ${kit.line}`,
          padding: `${fontSize * 0.2}px ${fontSize * 0.45}px`,
        }}
      >
        {text}
      </span>
    );
  }
  if (kit.look === "paper") {
    // Written on a strip of masking tape.
    return (
      <span style={common}>
        <Scrap bg="rgba(232,220,186,0.95)" seed={seed} shadow={0.18}>
          <span style={{ display: "inline-block", fontFamily: FONTS.condensed, color: kit.line, padding: `${fontSize * 0.14}px ${fontSize * 0.5}px`, textTransform: "uppercase", letterSpacing: "0.04em" }}>{text}</span>
        </Scrap>
      </span>
    );
  }
  if (kit.look === "notebook") {
    return (
      <span
        style={{
          ...common,
          position: "relative",
          fontFamily: kit.head,
          fontWeight: 700,
          fontSize: fontSize * 1.35,
          background: kit.panel,
          color: kit.panelText,
          padding: `${fontSize * 0.15}px ${fontSize * 0.5}px`,
          boxShadow: `0 ${4 * u}px ${12 * u}px rgba(0,0,0,0.2)`,
        }}
      >
        <span style={{ position: "absolute", left: "50%", top: -fontSize * 0.45, width: fontSize * 2.4, height: fontSize * 0.7, marginLeft: -fontSize * 1.2, background: "rgba(236,226,196,0.85)", transform: "rotate(4deg)" }} />
        {text}
      </span>
    );
  }
  if (kit.look === "neon") {
    return (
      <span
        style={{
          ...common,
          fontFamily: kit.body,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          background: "rgba(10,4,24,0.85)",
          color: kit.line,
          borderLeft: `${Math.max(3, 6 * u)}px solid ${kit.accent}`,
          padding: `${fontSize * 0.2}px ${fontSize * 0.5}px`,
          boxShadow: `0 0 ${12 * u}px ${tint(kit.line, 0.45, "#22e8ff")}`,
        }}
      >
        {"// "}
        {text}
      </span>
    );
  }
  if (kit.look === "line") {
    return (
      <span
        style={{
          ...common,
          fontFamily: kit.body,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          background: "#000000",
          color: kit.text,
          border: `${Math.max(1, 2 * u)}px solid ${kit.line}`,
          padding: `${fontSize * 0.25}px ${fontSize * 0.6}px`,
        }}
      >
        {text}
      </span>
    );
  }
  if (kit.look === "vhs") {
    return (
      <span style={{ ...common, fontFamily: FONTS.pixel, fontSize: fontSize * 1.5, color: "#ffffff", textTransform: "uppercase", textShadow: `0 0 ${2 * u}px #000000, ${chroma(u)}` }}>
        {text}
      </span>
    );
  }
  if (kit.look === "crt") {
    return (
      <span style={{ ...common, fontFamily: kit.body, fontSize: fontSize * 1.3, background: "rgba(0,0,0,0.85)", color: kit.accent, padding: `${fontSize * 0.1}px ${fontSize * 0.4}px` }}>
        {"> "}
        {typed(kit, text, frame, start, 1.2)}
      </span>
    );
  }
  return (
    <span
      style={{
        ...common,
        fontFamily: kit.body,
        fontWeight: 700,
        background: "rgba(10,12,16,0.78)",
        color: kit.text,
        border: `${Math.max(1, 2 * u)}px solid ${tint(kit.accent, 0.6, "#ffffff")}`,
        borderRadius: fontSize,
        padding: `${fontSize * 0.25}px ${fontSize * 0.6}px`,
      }}
    >
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Split layout

/** Jagged torn-paper edge along the bottom of a w-wide strip (deterministic). */
function tornPath(w: number, h: number, depth: number) {
  const pts: string[] = [`0,0`, `${w},0`];
  const steps = Math.max(12, Math.round(w / (depth * 1.4)));
  for (let i = steps; i >= 0; i -= 1) {
    const x = (i / steps) * w;
    pts.push(`${x.toFixed(1)},${(h - depth + hash(i, 4) * depth).toFixed(1)}`);
  }
  return pts.join(" ");
}

/**
 * The top part of a split frame (the speaker's footage shows below it): the look's backdrop with a
 * bottom edge (hard ink rule, torn paper, glowing line or a soft fade). Children are laid out inside.
 */
export function SplitTop({ kit, width, height, fraction, children, reveal, seed = 1 }: { kit: LookKit; width: number; height: number; fraction: number; children: ReactNode; reveal: number; seed?: number }) {
  const u = kit.u;
  const h = Math.round(height * fraction);
  const edge = 40 * u;
  const slide = mix(-(h + edge), 0, reveal);
  const torn = kit.look === "notebook" || kit.look === "paper";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width, height: h + edge, transform: `translateY(${slide}px)` }}>
      <div style={{ position: "absolute", left: 0, top: 0, width, height: h, overflow: "hidden" }}>
        <Backdrop kit={kit} width={width} height={h} seed={seed} />
      </div>
      {torn ? (
        <svg width={width} height={edge} style={{ position: "absolute", left: 0, top: h - 1 }}>
          <polygon points={tornPath(width, edge, edge * 0.55)} transform={`translate(0 ${6 * u})`} fill="rgba(0,0,0,0.25)" />
          <polygon points={tornPath(width, edge, edge * 0.55)} fill={kit.backdrop} />
        </svg>
      ) : kit.look === "ink" ? (
        <div style={{ position: "absolute", left: 0, top: h, width, height: Math.max(4, 8 * u), background: kit.line, boxShadow: `0 ${10 * u}px 0 ${tint(kit.line, 0.35)}` }} />
      ) : kit.look === "crt" ? (
        <div style={{ position: "absolute", left: 0, top: h, width, height: Math.max(2, 3 * u), background: kit.accent, boxShadow: `0 0 ${20 * u}px ${kit.accent}` }} />
      ) : (
        <div style={{ position: "absolute", left: 0, top: h, width, height: edge * 2, background: `linear-gradient(180deg, ${kit.backdrop} 0%, ${tint(kit.backdrop, 0)} 100%)` }} />
      )}
      <div style={{ position: "absolute", left: 0, top: 0, width, height: h, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card layouts (list-card, quote-card, before-after)

/** Shared frame for the card components: full frame on the look's backdrop, or a card over footage. */
export function CardStage({
  kit,
  width,
  height,
  layout,
  frame,
  fps,
  durationInFrames,
  footer,
  footerStart,
  title,
  children,
}: {
  kit: LookKit;
  width: number;
  height: number;
  layout: string;
  frame: number;
  fps: number;
  durationInFrames: number;
  footer: string;
  footerStart: number;
  title: string;
  children: ReactNode;
}) {
  const vertical = height > width;
  const out = exitOut(frame, durationInFrames, 10);
  const e = enter(kit, frame, fps, 0, kit.look === "ink" || kit.look === "paper" ? -1.5 : 0, 3);
  const cardWidth = width * (vertical ? 0.86 : 0.5);
  const footerSize = Math.min(width, height) * 0.045;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {layout === "full" ? <Backdrop kit={kit} width={width} height={height} seed={4} /> : null}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: footerSize * 1.6 }}>
        <div style={{ width: cardWidth, opacity: e.opacity, transform: e.transform }}>
          <Panel kit={kit} title={title} seed={6}>
            {children}
          </Panel>
        </div>
        {footer ? (
          <div style={{ maxWidth: width * 0.9 }}>
            <Chip kit={kit} line={footer} fontSize={footerSize} frame={frame} fps={fps} start={footerStart} stagger={3} seed={9} onBackdrop={layout === "full"} />
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** A card title: ransom letters on paper, typed on a terminal, the headline font elsewhere. */
export function CardTitle({ kit, text, fontSize, frame, fps, start }: { kit: LookKit; text: string; fontSize: number; frame: number; fps: number; start: number }) {
  // Cut letters are wide (a scrap each): smaller so a two-word title stays on a line or two.
  if (kit.look === "paper") return <CutLetters kit={kit} text={text} fontSize={fontSize * 0.7} frame={frame} fps={fps} start={start} seed={11} />;
  const e = enter(kit, frame, fps, start);
  return (
    <div
      style={{
        opacity: e.opacity,
        transform: e.transform,
        transformOrigin: "0% 60%",
        fontFamily: kit.head,
        fontWeight: headWeight(kit),
        fontSize,
        lineHeight: 1,
        letterSpacing: kit.look === "crt" || kit.look === "notebook" ? 0 : "-0.02em",
        textTransform: kit.look === "crt" ? "uppercase" : "none",
        color: kit.panelText,
      }}
    >
      <Words kit={kit} line={typed(kit, text, frame, start, 1.2)} fontSize={fontSize} frame={frame} />
    </div>
  );
}
