import { useId } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { exitOut, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  colorA: string;
  colorB: string;
  colorC: string;
  background: string;
  blobs: number;
  blobSize: number;
  speed: number;
  look: string;
  grain: boolean;
  seed: number;
};

// The SVG is drawn at a quarter of the frame size and scaled up: the goo blur is the costly part.
const SCALE = 4;

/**
 * A lava lamp: blobs rise, sink and merge through an SVG "goo" filter (blur, then a hard alpha
 * threshold), colored by a vertical gradient. "Soft" skips the threshold for a dreamy blur field.
 */
export function LavaLamp(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const w = width / SCALE;
  const h = height / SCALE;
  const u = unit(width, height) / SCALE;
  const t = (frame / fps) * props.speed;
  const fadeIn = ramp(frame, 0, 12);
  const out = exitOut(frame, d, 12);
  const goo = props.look !== "soft";
  // SVG ids are page-global: two lamps on one page must not share gradients.
  const id = `lava${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const base = 190 * u * props.blobSize;
  const count = Math.round(props.blobs);

  const blobs = Array.from({ length: count }, (_, i) => {
    const r = (k: string) => random(`${props.seed}-${i}-${k}`);
    const radius = base * (0.55 + r("r") * 0.9);
    const x = w * (0.1 + r("x") * 0.8) + Math.sin(t * (0.25 + r("wx") * 0.35) + r("px") * 6.28) * w * 0.08;
    // Each blob travels most of the height and back, at its own pace: they meet, merge and split.
    const y = h * 0.5 + Math.sin(t * (0.18 + r("wy") * 0.3) + r("py") * 6.28) * h * 0.55;
    const squash = 1 + Math.sin(t * 0.9 + i) * 0.08;
    return { x, y, rx: radius * squash, ry: radius / squash };
  });

  return (
    <AbsoluteFill style={{ background: props.background, opacity: out * fadeIn }}>
      <svg width={width} height={height} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2={h} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={props.colorA} />
            <stop offset="55%" stopColor={props.colorB} />
            <stop offset="100%" stopColor={props.colorC} />
          </linearGradient>
          <filter id={`${id}-goo`} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={(goo ? 7 : 13) * u * SCALE} result="blur" />
            {goo ? (
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
            ) : null}
          </filter>
          <radialGradient id={`${id}-shade`} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.18} />
            <stop offset="60%" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <g filter={`url(#${id}-goo)`}>
          {/* Pools at the bottom and top, like the wax resting in a real lamp. */}
          <ellipse cx={w / 2} cy={h * 1.04} rx={w * 0.7} ry={h * 0.12} fill={`url(#${id}-fill)`} />
          <ellipse cx={w / 2} cy={-h * 0.04} rx={w * 0.6} ry={h * 0.08} fill={`url(#${id}-fill)`} />
          {blobs.map((b, i) => (
            <ellipse key={i} cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} fill={`url(#${id}-fill)`} />
          ))}
        </g>
        <rect width={w} height={h} fill={`url(#${id}-shade)`} />
        {props.grain ? (
          <>
            <filter id={`${id}-grain`}>
              <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={frame % 60} />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width={w} height={h} filter={`url(#${id}-grain)`} opacity={0.12} />
          </>
        ) : null}
      </svg>
    </AbsoluteFill>
  );
}
