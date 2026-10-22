import { useId } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { alpha, easeOutExpo, exitOut, glowStyle, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  accent: string;
  gridColor: string;
  background: string;
  cell: number;
  pattern: string;
  spotlight: boolean;
  speed: number;
};

/**
 * A dark technical grid (lines or dots) that fades out toward the edges, with a colored spotlight
 * roaming over it: the grid lights up in the accent wherever the light passes.
 */
export function SpotlightGrid(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const id = `grid${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const cell = props.cell * u;
  const t = (frame / fps) * props.speed;
  const enter = ramp(frame, 0, 30, easeOutExpo);
  const out = exitOut(frame, d, 12);
  // The light wanders on a slow figure-eight around the middle.
  const sx = 50 + Math.sin(t * 0.5) * 28;
  const sy = 50 + Math.sin(t * 1) * 18;
  const px = (sx / 100) * width;
  const py = (sy / 100) * height;
  const radius = Math.max(width, height) * 0.22;
  const stroke = Math.max(1, 1.2 * u);

  const grid = (color: string, key: string) => (
    <svg key={key} width={width} height={height} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id={`${id}-${key}`} width={cell} height={cell} patternUnits="userSpaceOnUse" x={width / 2} y={height / 2}>
          {props.pattern === "dots" ? (
            <circle cx={cell / 2} cy={cell / 2} r={Math.max(1.2, 2 * u)} fill={color} />
          ) : (
            <path d={`M ${cell} 0 L 0 0 0 ${cell}`} fill="none" stroke={color} strokeWidth={stroke} />
          )}
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${id}-${key})`} />
    </svg>
  );

  return (
    <AbsoluteFill style={{ background: props.background, overflow: "hidden", opacity: out }}>
      <AbsoluteFill style={{ opacity: enter, transform: `scale(${1.08 - 0.08 * enter})` }}>
        {grid(props.gridColor, "base")}
        {props.spotlight ? (
          <>
            <div style={glowStyle(px, py, radius * 3.4, radius * 3.4, props.accent, 0.22)} />
            {/* The lit grid: an accent copy shown only inside the light's circle. */}
            <AbsoluteFill style={{ clipPath: `circle(${radius}px at ${sx}% ${sy}%)`, opacity: 0.9 }}>
              {grid(props.accent, "lit")}
            </AbsoluteFill>
            {/* Soften the lit circle's rim into the dim grid. */}
            <div
              style={{
                position: "absolute",
                left: px - radius,
                top: py - radius,
                width: radius * 2,
                height: radius * 2,
                background: `radial-gradient(${alpha(props.background, 0)} 25%, ${props.background} 70.7%)`,
                clipPath: "circle(50%)",
              }}
            />
          </>
        ) : null}
      </AbsoluteFill>
      {/* Fade the grid out toward the frame's edges. */}
      <AbsoluteFill
        style={{ background: `radial-gradient(${alpha(props.background, 0)} 40%, ${props.background} 85%)` }}
      />
    </AbsoluteFill>
  );
}
