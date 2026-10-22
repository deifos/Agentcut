import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, glowStyle, easeInOut, easeOutExpo, exitOut, fill, mix, pop, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  name: string;
  tagline: string;
  mark: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  font: string;
  weight: string;
  glow: boolean;
  shine: boolean;
};

/**
 * A brand sting: a mark pops in, the wordmark converges out of a wide, blurred spread beside it,
 * a glow breathes and a light shine glides across the letters, then the tagline settles under it.
 */
export function LogoSting(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.1 : 1);
  const out = exitOut(frame, d, 16);
  const markIn = pop(frame, fps, 0, 220);
  const hasMark = props.mark !== "none";
  const textIn = ramp(frame, hasMark ? 8 : 0, 34, easeOutExpo);
  const tagIn = ramp(frame, 30, 20, easeOutExpo);
  const shine = ramp(frame, 26, 26, easeInOut);
  const glow = props.glow ? 0.35 + 0.65 * Math.sin(Math.min(1, ramp(frame, 10, 40)) * Math.PI) : 0;
  const markSize = fontSize * 0.82;

  const wordStyle = {
    fontFamily: FONTS[props.font] ?? FONTS.display,
    fontWeight: Number(props.weight) || 700,
    fontSize,
    lineHeight: 1,
    letterSpacing: `${mix(0.45, -0.035, textIn)}em`,
    whiteSpace: "nowrap",
  } as const;

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: "center",
        justifyContent: "center",
        opacity: out,
        transform: `scale(${mix(1, 1.04, ramp(frame, 0, d, easeInOut))})`,
      }}
    >
      {props.glow ? (
        <div style={glowStyle(width / 2, height / 2, width * 0.9, height * 0.7, props.accent, glow * 0.35 * textIn)} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: fontSize * 0.35 }}>
        <div style={{ display: "flex", alignItems: "center", gap: fontSize * 0.3 }}>
          {hasMark ? (
            <div
              style={{
                width: markSize,
                height: markSize,
                borderRadius: props.mark === "dot" ? "50%" : markSize * 0.26,
                background: props.accent,
                transform: `scale(${markIn}) rotate(${(1 - markIn) * -90}deg)`,
                boxShadow: props.glow ? `0 0 ${60 * u * glow}px ${props.accent}` : undefined,
              }}
            />
          ) : null}
          <div style={{ position: "relative" }}>
            <div
              style={{
                ...wordStyle,
                color: props.color,
                opacity: textIn,
                textShadow: props.glow ? `0 0 ${Math.round(40 * u * glow)}px ${props.accent}` : undefined,
                ...blurStyle((1 - textIn) * fontSize * 0.1),
              }}
            >
              {props.name}
            </div>
            {/* The shine: a white copy of the wordmark showing only through a slanted band. */}
            {props.shine && shine > 0 && shine < 1 ? (
              <div
                style={{
                  ...wordStyle,
                  position: "absolute",
                  inset: 0,
                  color: "#ffffff",
                  opacity: 0.9,
                  clipPath: band(shine),
                }}
              >
                {props.name}
              </div>
            ) : null}
          </div>
        </div>
        {props.tagline ? (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: Math.max(14, fontSize * 0.18),
              letterSpacing: `${mix(0.6, 0.28, tagIn)}em`,
              textTransform: "uppercase",
              color: props.color,
              opacity: tagIn * 0.75,
              ...blurStyle((1 - tagIn) * fontSize * 0.04),
            }}
          >
            {props.tagline}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

/** A slanted band moving left to right across the box (t 0→1). */
function band(t: number) {
  const x = mix(-30, 130, t);
  const w = 14;
  const slant = 12;
  return `polygon(${x}% 0%, ${x + w}% 0%, ${x + w - slant}% 100%, ${x - slant}% 100%)`;
}
