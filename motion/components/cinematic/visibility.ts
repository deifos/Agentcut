import { apply, type M4 } from "./math";

/** Conservative bounds, including blur spill. Keep planes that cross the camera plane. */
export function outsideViewport(matrix: M4, width: number, height: number, viewportWidth: number, viewportHeight: number, margin = 0) {
  const corners = [[0, 0], [width, 0], [0, height], [width, height]]
    .map(([x, y]) => apply(matrix, x, y));
  if (corners.some((p) => p.some((v) => !Number.isFinite(v)) || p[3] <= 0)) return false;
  const xs = corners.map((p) => p[0] / p[3]);
  const ys = corners.map((p) => p[1] / p[3]);
  return Math.max(...xs) < -margin || Math.min(...xs) > viewportWidth + margin ||
    Math.max(...ys) < -margin || Math.min(...ys) > viewportHeight + margin;
}
