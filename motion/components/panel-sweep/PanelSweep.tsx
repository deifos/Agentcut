import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  color1: string;
  color2: string;
  color3: string;
  panels: number;
  direction: string;
  angle: number;
  streaks: boolean;
};

const glide = Easing.bezier(0.83, 0, 0.17, 1);

/**
 * Stacked color panels sweep across the frame one after another (slanted, like a whip pan), the
 * last one covering it at the midpoint, then all of them carry on out the other side.
 * Center the clip on the cut.
 */
export function PanelSweep(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const horizontal = props.direction === "left" || props.direction === "right";
  const sign = props.direction === "left" || props.direction === "up" ? -1 : 1;
  const span = horizontal ? width : height;
  const cross = horizontal ? height : width;
  const count = Math.round(props.panels);
  const colors = [props.color1, props.color2, props.color3];
  const skew = Math.tan((props.angle * Math.PI) / 180) * cross;
  // Panels are wide enough to cover the frame plus the slant on both sides.
  const size = span + Math.abs(skew) + 4;
  const stagger = Math.max(1, (d * 0.16) / Math.max(1, count - 1));
  const phase = Math.max(1, d / 2 - (count - 1) * stagger);
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: glide } as const;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: count }, (_, i) => {
        // In: back panels first, the front one landing exactly at the midpoint.
        // Out: the front one leaves first, uncovering the stack, the back one leaves at the end.
        const inT = interpolate(frame, [i * stagger, i * stagger + phase], [0, 1], clamp);
        const outStart = d / 2 + (count - 1 - i) * stagger;
        const outT = interpolate(frame, [outStart, outStart + phase], [0, 1], clamp);
        // -1: off the near side, 0: covering, +1: off the far side.
        const pos = (inT + outT - 1) * ((span + size + Math.abs(skew)) / 2);
        const offset = sign * pos;
        const color = colors[i % colors.length];
        const style = horizontal
          ? {
              left: (span - size) / 2,
              top: 0,
              width: size,
              height: cross,
              transform: `translateX(${offset}px) skewX(${-props.angle * sign}deg)`,
            }
          : {
              left: 0,
              top: (span - size) / 2,
              width: cross,
              height: size,
              transform: `translateY(${offset}px) skewY(${-props.angle * sign}deg)`,
            };
        return (
          <div key={i} style={{ position: "absolute", background: color, ...style }}>
            {props.streaks
              ? [0.2, 0.55, 0.8].map((at, k) => (
                  <div
                    key={k}
                    style={{
                      position: "absolute",
                      background: colors[(i + 1) % colors.length],
                      opacity: 0.5,
                      ...(horizontal
                        ? { top: `${at * 100}%`, height: Math.max(2, cross * 0.006), width: size * 0.35, [sign > 0 ? "left" : "right"]: -size * 0.3 }
                        : { left: `${at * 100}%`, width: Math.max(2, cross * 0.006), height: size * 0.35, [sign > 0 ? "top" : "bottom"]: -size * 0.3 }),
                    }}
                  />
                ))
              : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
