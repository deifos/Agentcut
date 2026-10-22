import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  color: string;
  accent: string;
  columns: number;
  origin: string;
  shape: string;
  checker: boolean;
};

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * A grid of tiles grows in a wave from a corner (or the center) until the frame is covered at the
 * midpoint, then the tiles shrink away in the same order to reveal the next shot.
 * Center the clip on the cut.
 */
export function TileWipe(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const cols = Math.round(props.columns);
  const tile = width / cols;
  const rows = Math.ceil(height / tile);
  const mid = d / 2;
  // Each tile takes 40% of a half to grow; the wave spreads the starts over the rest.
  const grow = mid * 0.4;
  const spread = mid - grow;

  const distance = (c: number, r: number) => {
    const x = (c + 0.5) / cols;
    const y = (r + 0.5) / rows;
    switch (props.origin) {
      case "center":
        return Math.hypot(x - 0.5, (y - 0.5) * (rows / cols)) / Math.hypot(0.5, 0.5 * (rows / cols));
      case "left":
        return x;
      case "bottom":
        return 1 - y;
      default: // top-left corner, diagonal
        return (x + y) / 2;
    }
  };

  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const at = distance(c, r) * spread;
      const inT = interpolate(frame, [at, at + grow], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
      const outT = interpolate(frame, [mid + at, mid + at + grow], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
      const scale = inT - outT;
      if (scale <= 0.001) continue;
      const round = props.shape === "circle" ? 50 * (1 - inT * (1 - outT)) : props.shape === "rounded" ? 18 : 0;
      tiles.push(
        <div
          key={`${r}-${c}`}
          style={{
            position: "absolute",
            left: c * tile,
            top: r * tile,
            // A hair of overlap so no seams show between full tiles.
            width: tile + 1,
            height: tile + 1,
            background: props.checker && (r + c) % 2 === 1 ? props.accent : props.color,
            borderRadius: `${round}%`,
            transform: `scale(${props.shape === "rounded" ? scale * 1.12 : scale}) rotate(${(1 - scale) * 45}deg)`,
          }}
        />,
      );
    }
  }

  return <AbsoluteFill style={{ overflow: "hidden" }}>{tiles}</AbsoluteFill>;
}
