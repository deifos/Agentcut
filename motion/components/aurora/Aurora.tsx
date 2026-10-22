import { useId } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { alpha, exitOut, glowStyle, ramp } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  background: string;
  speed: number;
  intensity: number;
  grain: boolean;
  vignette: boolean;
  seed: number;
};

/**
 * A mesh gradient that never sits still: four big soft color fields drift, swell and swap places
 * over a base color, with film grain and a vignette. The modern "AI product" backdrop.
 */
export function Aurora(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const id = `aurora${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const t = (frame / fps) * props.speed;
  const out = exitOut(frame, d, 12);
  const fadeIn = ramp(frame, 0, 12);
  const colors = [props.color1, props.color2, props.color3, props.color4];

  return (
    <AbsoluteFill style={{ background: props.background, overflow: "hidden", opacity: out * fadeIn }}>
      {colors.map((color, i) => {
        const r = (k: string) => random(`${props.seed}-${i}-${k}`);
        // Each field orbits its own center on a slow Lissajous path.
        const cx = 50 + (r("cx") - 0.5) * 60 + Math.sin(t * (0.21 + r("w1") * 0.2) + r("p1") * 6.28) * 30;
        const cy = 50 + (r("cy") - 0.5) * 60 + Math.cos(t * (0.17 + r("w2") * 0.2) + r("p2") * 6.28) * 28;
        const size = (55 + r("s") * 25 + Math.sin(t * 0.4 + i * 1.7) * 10) / 100;
        return (
          <div
            key={i}
            style={glowStyle((cx / 100) * width, (cy / 100) * height, width * size * 1.35, height * size * 1.7, color, props.intensity)}
          />
        );
      })}
      {props.vignette ? (
        <AbsoluteFill
          style={{ background: `radial-gradient(${alpha(props.background, 0)} 45%, ${alpha(props.background, 0.9)} 100%)` }}
        />
      ) : null}
      {props.grain ? (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }} viewBox={`0 0 ${width / 2} ${height / 2}`}>
          <filter id={`${id}-grain`}>
            <feTurbulence type="fractalNoise" baseFrequency={0.8} numOctaves={2} seed={frame % 48} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width={width / 2} height={height / 2} filter={`url(#${id}-grain)`} opacity={0.09} />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
}
