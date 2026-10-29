import { apply, type M4 } from "./math";

/** Clip in homogeneous space before dividing by w. Never send unbounded coordinates to SVG. */
export function projectLine(matrix: M4, a: [number, number, number], b: [number, number, number], width: number, height: number) {
  let p = apply(matrix, ...a);
  let q = apply(matrix, ...b);
  if ([...p, ...q].some((v) => !Number.isFinite(v))) return null;
  const planes = [
    (v: number[]) => v[3] - 0.001,
    (v: number[]) => v[0], (v: number[]) => width * v[3] - v[0],
    (v: number[]) => v[1], (v: number[]) => height * v[3] - v[1],
  ];
  for (const plane of planes) {
    const d0 = plane(p), d1 = plane(q);
    if (d0 < 0 && d1 < 0) return null;
    if (d0 < 0 || d1 < 0) {
      const t = d0 / (d0 - d1);
      const cut = p.map((v, i) => v + (q[i] - v) * t) as typeof p;
      if (d0 < 0) p = cut; else q = cut;
    }
  }
  return [p[0] / p[3], p[1] / p[3], q[0] / q[3], q[1] / q[3]];
}
