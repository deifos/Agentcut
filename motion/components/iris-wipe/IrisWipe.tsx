import { useId } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, ramp } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  color: string;
  accent: string;
  rings: boolean;
  originX: number;
  originY: number;
  shape: string;
};

/**
 * A shape transition: colored circles (or diamonds) burst out from a point and cover the frame by
 * the clip's midpoint, then a hole opens in them from the same point to reveal the next shot.
 * Center the clip on the cut.
 */
export function IrisWipe(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const id = `iris${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mid = d / 2;
  const cx = (props.originX / 100) * width;
  const cy = (props.originY / 100) * height;
  // Far enough to cover the farthest corner from the origin.
  const reach = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy),
  ) * (props.shape === "diamond" ? 1.45 : 1.02);
  const layers = props.rings ? [props.accent, props.color] : [props.color];
  const lag = Math.max(2, d * 0.08);

  const shapeAt = (r: number, fill: string, key: string) =>
    props.shape === "diamond" ? (
      <polygon key={key} points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={fill} />
    ) : (
      <circle key={key} cx={cx} cy={cy} r={r} fill={fill} />
    );

  // Opening: the last layer to land is the first to open.
  const open = ramp(frame, mid, mid - 1, easeInOut);
  const openLag = ramp(frame, mid + lag, mid - 1 - lag, easeInOut);

  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <mask id={`${id}-hole`}>
            <rect width={width} height={height} fill="white" />
            {shapeAt(reach * open, "black", "hole")}
          </mask>
          <mask id={`${id}-hole2`}>
            <rect width={width} height={height} fill="white" />
            {shapeAt(reach * openLag, "black", "hole2")}
          </mask>
        </defs>
        {layers.map((fill, i) => {
          const delay = i * lag;
          const grow = ramp(frame, delay, mid - delay, easeInOut);
          if (grow <= 0) return null;
          // Rings: the outer (accent) layer opens last, so it rims the reveal.
          const mask = layers.length > 1 && i === 0 ? `url(#${id}-hole2)` : `url(#${id}-hole)`;
          return (
            <g key={i} mask={frame >= mid ? mask : undefined}>
              {shapeAt(reach * grow, fill, `s${i}`)}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
