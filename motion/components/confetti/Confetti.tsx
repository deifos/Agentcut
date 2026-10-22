import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { exitOut, fill, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  mode: string;
  count: number;
  power: number;
  gravity: number;
  size: number;
  palette: string[];
  originX: number;
  originY: number;
  seed: number;
  background: string;
};

/** Linear air drag (per second): pieces slow quickly and settle into a flutter at terminal speed. */
const DRAG = 1.6;

/**
 * Confetti: a seeded burst from a point, two cannons from the bottom corners, or rain from the top.
 * Every piece's position is solved from the frame (velocity, gravity and drag in closed form), so
 * any frame renders the same on its own.
 */
export function Confetti(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const out = exitOut(frame, d, 14);
  const palette = props.palette.filter((c) => /^#?[0-9a-f]{3,8}$/i.test(c.trim()));
  const colors = palette.length ? palette : ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ffffff"];
  const n = Math.round(props.count);
  const diag = Math.hypot(width, height);
  const g = props.gravity * 900 * u;
  const pieceScale = props.size * u;

  const pieces = Array.from({ length: n }, (_, i) => {
    const r = (k: string) => random(`${props.seed}-${i}-${k}`);
    let x0: number;
    let y0: number;
    let vx: number;
    let vy: number;
    let delay = r("delay") * 4;
    if (props.mode === "cannons") {
      const left = i % 2 === 0;
      x0 = left ? 0 : width;
      y0 = height;
      const angle = ((-62 + (r("a") - 0.5) * 34) * Math.PI) / 180;
      const speed = diag * props.power * (0.75 + r("v") * 0.6);
      vx = Math.cos(angle) * speed * (left ? 1 : -1);
      vy = Math.sin(angle) * speed;
    } else if (props.mode === "rain") {
      x0 = r("x") * width;
      y0 = -40 * u - r("y") * height * 0.3;
      vx = (r("vx") - 0.5) * 120 * u;
      vy = 80 * u * r("vy");
      delay = r("delay") * d * 0.5;
    } else {
      x0 = (props.originX / 100) * width;
      y0 = (props.originY / 100) * height;
      // A burst that leans upward, like a popper.
      const angle = r("a") * Math.PI * 2;
      const speed = diag * props.power * (0.25 + Math.pow(r("v"), 0.6) * 1.05);
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed * 0.85 - speed * 0.35;
    }
    const t = Math.max(0, (frame - delay) / fps);
    if (frame < delay) return null;
    // Closed-form motion with linear drag: v' = g − k·v.
    const decay = (1 - Math.exp(-DRAG * t)) / DRAG;
    const terminal = g / DRAG;
    const flutter = Math.sin(t * (3 + r("fs") * 4) + r("fp") * 6.28) * 26 * u * Math.min(1, t * 2);
    const x = x0 + vx * decay + flutter;
    const y = y0 + terminal * t + (vy - terminal) * decay;
    if (y > height + 80 * u || x < -100 * u || x > width + 100 * u) return null;

    const kind = r("kind");
    const shape = kind < 0.55 ? "rect" : kind < 0.8 ? "circle" : "streamer";
    const w = (shape === "streamer" ? 5 : shape === "circle" ? 11 : 12 + r("w") * 6) * pieceScale;
    const h = (shape === "streamer" ? 26 + r("h") * 16 : shape === "circle" ? 11 : 7 + r("h") * 5) * pieceScale;
    const spin = (r("spin") - 0.5) * 900;
    const rot = r("rot") * 360 + spin * t;
    // Tumbling: the piece's face turns toward and away from the camera.
    const tumble = Math.cos(t * (6 + r("ts") * 10) + r("tp") * 6.28);
    const color = colors[Math.floor(r("c") * colors.length)];
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          // Rounded so the server-rendered still and the client agree (Math.exp/sin differ in the last digits).
          left: round(x - w / 2),
          top: round(y - h / 2),
          width: round(w),
          height: round(h),
          background: color,
          borderRadius: shape === "circle" ? "50%" : shape === "streamer" ? w / 2 : 1.5 * pieceScale,
          transform: `rotate(${round(rot)}deg) scaleX(${shape === "circle" ? 1 : round(tumble)})`,
          opacity: shape === "circle" ? 1 : round(0.75 + 0.25 * Math.abs(tumble)),
        }}
      />
    );
  });

  return <AbsoluteFill style={{ background: fill(props.background), opacity: out, overflow: "hidden" }}>{pieces}</AbsoluteFill>;
}

const round = (v: number) => Math.round(v * 100) / 100;
