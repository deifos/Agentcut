import { AbsoluteFill } from "remotion";
import { mul } from "./math";
import { projectLine } from "./project-line";
import type { StageContext } from "./Cinematic";

/** A bounded screen-space grid. No perspective CSS layers, SVG masks, or filtered floor tiles. */
export function PreviewFloor({ ctx, y, size, near, spacing, color, opacity }: {
  ctx: StageContext; y: number; size: number; near: number; spacing: number; color: string; opacity: number;
}) {
  if (![y, size, near, spacing, opacity].every(Number.isFinite) || size <= 0 || spacing <= 0) return null;
  const matrix = mul(ctx.project, ctx.view, ctx.model);
  const paths = Array.from({ length: 16 }, () => "");
  const steps = 48;
  const count = Math.min(200, Math.floor(size / spacing));
  for (let line = 0; line <= count; line++) {
    const fixed = line * spacing;
    for (let step = 0; step < steps; step++) {
      const from = size * step / steps, to = size * (step + 1) / steps;
      for (const horizontal of [false, true]) {
        const x = horizontal ? (from + to) / 2 : fixed;
        const z = horizontal ? fixed : (from + to) / 2;
        const fade = Math.max(0, 1 - Math.hypot(x - size / 2, z - size / 2) / (size * 0.35));
        const bucket = Math.round(fade * 15);
        if (!bucket) continue;
        const a: [number, number, number] = horizontal ? [from - size / 2, y, near - size + fixed] : [fixed - size / 2, y, near - size + from];
        const b: [number, number, number] = horizontal ? [to - size / 2, y, near - size + fixed] : [fixed - size / 2, y, near - size + to];
        const points = projectLine(matrix, a, b, ctx.width, ctx.height);
        if (!points) continue;
        const [x0, y0, x1, y1] = points.map((v) => v.toFixed(2));
        paths[bucket] += `M${x0},${y0}L${x1},${y1}`;
      }
    }
  }
  return <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
    <svg width={ctx.width} height={ctx.height} viewBox={`0 0 ${ctx.width} ${ctx.height}`} style={{ overflow: "hidden" }}>
      {paths.map((d, i) => d ? <path key={i} d={d} fill="none" stroke={color} strokeWidth={Math.max(0.5, ctx.u)} opacity={opacity * i / 15} /> : null)}
    </svg>
  </AbsoluteFill>;
}
