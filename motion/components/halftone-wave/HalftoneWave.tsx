import { useId } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { alpha, easeOutExpo, exitOut, glowStyle, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  mode: string;
  background: string;
  dotColor: string;
  gradient: boolean;
  secondColor: string;
  accent: string;
  density: number;
  dotSize: number;
  speed: number;
  seed: number;
};

const MAX_DOTS = 2600;

/**
 * A halftone dot matrix that breathes: each dot's size follows a field that moves over time
 * (diagonal waves, rings rippling out from the middle, or drifting organic noise). Optionally the
 * dots blend from one color to another across the frame, under a soft accent glow and vignette.
 */
export function HalftoneWave(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const id = `ht${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const t = (frame / fps) * props.speed;
  const enter = ramp(frame, 0, 30, easeOutExpo);
  const out = exitOut(frame, d, 12);

  // Spacing from the density (dots across the short side), widened if the frame would need too many.
  let spacing = Math.min(width, height) / props.density;
  const needed = (width / spacing + 1) * (height / spacing + 1);
  if (needed > MAX_DOTS) spacing *= Math.sqrt(needed / MAX_DOTS);
  const cols = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  const ox = (width - (cols - 1) * spacing) / 2;
  const oy = (height - (rows - 1) * spacing) / 2;
  const maxR = spacing * 0.5 * (props.dotSize / 100);
  const minR = Math.max(0.6 * u, maxR * 0.06);
  const short = Math.min(width, height);

  // Seeded phases and directions, so each seed is its own pattern but every render matches.
  const r = (k: string) => random(`${props.seed}-${k}`);
  const a1 = r("a1") * Math.PI * 2;
  const a2 = a1 + 0.9 + r("a2") * 1.4;
  const p = [r("p0"), r("p1"), r("p2"), r("p3")].map((v) => v * Math.PI * 2);
  const cxr = 0.5 + (r("cx") - 0.5) * 0.2;
  const cyr = 0.5 + (r("cy") - 0.5) * 0.2;

  const field = (x: number, y: number) => {
    const nx = x / short;
    const ny = y / short;
    if (props.mode === "ripple") {
      const dist = Math.hypot(x / width - cxr, (y / height - cyr) * (height / width)) * (width / short);
      const ring = Math.sin(dist * 16 - t * 3.2 + p[0]);
      return 0.5 + 0.5 * ring * (1 - Math.min(1, dist * 0.55));
    }
    if (props.mode === "noise") {
      // A few slow, crossing sines read as drifting organic blobs.
      const v =
        Math.sin(nx * 3.1 + t * 0.7 + p[0]) * Math.cos(ny * 2.7 - t * 0.5 + p[1]) +
        0.6 * Math.sin((nx * Math.cos(a1) + ny * Math.sin(a1)) * 5.3 - t * 0.9 + p[2]) +
        0.4 * Math.sin((nx * Math.cos(a2) + ny * Math.sin(a2)) * 8.1 + t * 1.1 + p[3]);
      return Math.min(1, Math.max(0, 0.5 + v * 0.42));
    }
    const w1 = Math.sin((nx * Math.cos(a1) + ny * Math.sin(a1)) * 6.5 - t * 2 + p[0]);
    const w2 = Math.sin((nx * Math.cos(a2) + ny * Math.sin(a2)) * 4.2 - t * 1.3 + p[1]);
    return 0.5 + 0.32 * w1 + 0.18 * w2;
  };

  const dots = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = ox + i * spacing;
      const y = oy + j * spacing;
      const v = field(x, y);
      const rad = (minR + (maxR - minR) * v * v) * enter;
      if (rad < 0.35) continue;
      dots.push(<circle key={j * cols + i} cx={x} cy={y} r={Math.round(rad * 100) / 100} />);
    }
  }

  return (
    <AbsoluteFill style={{ background: props.background, overflow: "hidden", opacity: out }}>
      <div style={glowStyle(width / 2, height / 2, width * 1.1, height * 1.1, props.accent, 0.28 * enter)} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={width} y2={height}>
            <stop offset="0%" stopColor={props.dotColor} />
            <stop offset="100%" stopColor={props.gradient ? props.secondColor : props.dotColor} />
          </linearGradient>
        </defs>
        <g fill={`url(#${id}-g)`}>{dots}</g>
      </svg>
      {/* Vignette: the dots sink into the background toward the edges. */}
      <AbsoluteFill
        style={{ background: `radial-gradient(${alpha(props.background, 0)} 45%, ${alpha(props.background, 0.85)} 95%)` }}
      />
    </AbsoluteFill>
  );
}
