import { useId, type CSSProperties } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FONTS, exitOut, fill, mix, ramp, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lines: string[];
  color: string;
  accent: string;
  splitLeft: string;
  splitRight: string;
  background: string;
  size: number;
  font: string;
  weight: string;
  uppercase: boolean;
  intensity: number;
  bursts: number;
  scanlines: boolean;
  seed: number;
};

const SLICES = 7;

/**
 * A glitch title: the text arrives torn into horizontal slices with red and cyan copies split off
 * it, flickers, snaps clean, then catches small glitch bursts every so often while it holds.
 */
export function GlitchTitle(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const id = `gl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.1 : 1);
  const out = exitOut(frame, d, 10);
  const strength = props.intensity / 100;
  // Glitch values change every 2 frames: every frame reads as noise, slower reads as a stutter.
  const tick = Math.floor(frame / 2);
  const r = (k: string) => random(`${props.seed}-${tick}-${k}`);

  // How torn the text is (0 clean → 1 fully torn): high on entry, then short bursts while it holds,
  // and a last tear as it leaves.
  const entry = 1 - ramp(frame, 4, 20);
  let burst = 0;
  if (props.bursts > 0) {
    const every = Math.max(8, Math.round(fps / props.bursts));
    const local = frame - 30;
    if (local >= 0) {
      const phase = local % every;
      const n = Math.floor(local / every);
      const len = 3 + Math.floor(random(`len${props.seed}-${n}`) * 5);
      if (phase < len) burst = 0.35 + 0.35 * random(`amt${props.seed}-${n}`);
    }
  }
  const leave = ramp(frame, d - 12, 8);
  const tear = Math.min(1, Math.max(entry, burst, leave)) * strength;
  // Entry flicker: the text blinks a few times before it holds.
  const visible = frame < 3 ? 0 : frame < 14 ? (r("blink") > 0.28 ? 1 : 0.15) : 1;

  const split = tear * fontSize * 0.09 * (0.6 + 0.8 * r("split"));
  const jitterX = tear > 0.05 ? (r("jx") - 0.5) * fontSize * 0.12 * tear : 0;
  const jitterY = tear > 0.05 ? (r("jy") - 0.5) * fontSize * 0.04 * tear : 0;

  const textStyle: CSSProperties = {
    fontFamily: FONTS[props.font] ?? FONTS.condensed,
    fontWeight: Number(props.weight) || 400,
    fontSize,
    lineHeight: 1.02,
    letterSpacing: props.font === "condensed" ? "0.01em" : "-0.02em",
    textTransform: props.uppercase ? "uppercase" : undefined,
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  const text = (tint?: string) => (
    <div style={{ ...textStyle, color: tint ?? props.color }}>
      {props.lines.map((line, i) => (
        <div key={i}>
          {splitHighlights(line).map((word, w) => (
            <span key={w} style={{ color: tint ?? (word.highlighted ? props.accent : props.color) }}>
              {w > 0 ? " " : ""}
              {word.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );

  // The torn layer: the text cut into horizontal bands, each pushed sideways by its own amount.
  const torn = (tint: string | undefined, dx: number, key: string) => {
    if (tear < 0.04)
      return (
        <div key={key} style={{ position: dx === 0 ? "relative" : "absolute", inset: 0, transform: `translateX(${dx}px)` }}>
          {text(tint)}
        </div>
      );
    return Array.from({ length: SLICES }, (_, s) => {
      const top = (s / SLICES) * 100;
      const bottom = 100 - ((s + 1) / SLICES) * 100;
      const shift = r(`s${s}`) > 0.45 ? (r(`sx${s}`) - 0.5) * fontSize * 0.7 * tear : 0;
      return (
        <div
          key={`${key}${s}`}
          style={{
            position: s === 0 && dx === 0 ? "relative" : "absolute",
            inset: 0,
            clipPath: `inset(${top}% 0 ${bottom}% 0)`,
            transform: `translateX(${dx + shift}px)`,
          }}
        >
          {text(tint)}
        </div>
      );
    });
  };

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 50 : 100) * u)}px`,
        opacity: out,
      }}
    >
      <div
        style={{
          position: "relative",
          opacity: visible,
          transform: `translate(${jitterX}px, ${jitterY}px) scale(${mix(1.06, 1, ramp(frame, 0, 18))})`,
        }}
      >
        {split > 0.5 ? (
          <>
            <div style={{ position: "absolute", inset: 0, opacity: 0.85 }}>{torn(props.splitLeft, -split, "l")}</div>
            <div style={{ position: "absolute", inset: 0, opacity: 0.85 }}>{torn(props.splitRight, split, "r")}</div>
          </>
        ) : null}
        <div style={{ position: "relative" }}>{torn(undefined, 0, "m")}</div>
        {/* A bright bar that flashes across a slice during a tear. */}
        {tear > 0.2 && r("bar") > 0.4 ? (
          <div
            style={{
              position: "absolute",
              left: "-6%",
              right: "-6%",
              top: `${r("bary") * 90}%`,
              height: Math.max(2, fontSize * 0.05 * (0.5 + r("barh"))),
              background: r("barc") > 0.5 ? props.splitRight : props.accent,
              opacity: 0.7,
              transform: `translateX(${(r("barx") - 0.5) * fontSize}px)`,
            }}
          />
        ) : null}
      </div>
      {props.scanlines ? (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <pattern id={`${id}-scan`} width={4} height={Math.max(3, Math.round(4 * u))} patternUnits="userSpaceOnUse">
              <rect width={4} height={Math.max(1, Math.round(1.5 * u))} fill="#000000" opacity={0.28} />
            </pattern>
          </defs>
          <rect width={width} height={height} fill={`url(#${id}-scan)`} />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
}
