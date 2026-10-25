// 4×4 matrix math for the cinematic camera (row-major, column vectors, CSS axes: x right, y down,
// z toward the viewer). No DOM, no React: the stage computes one matrix3d() per plane.
import { Easing } from "remotion";

export type M4 = number[];

export const identity = (): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function mul(...ms: M4[]): M4 {
  return ms.reduce((a, b) => {
    const o = new Array<number>(16).fill(0);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 4; k++) o[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
    return o;
  });
}

export const translate = (x: number, y: number, z = 0): M4 => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
export const scale = (x: number, y = x, z = x): M4 => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Positive tilts the top edge away from the viewer. */
export function rotateX(deg: number): M4 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

/** Positive turns the right edge away from the viewer. */
export function rotateY(deg: number): M4 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

/** Positive rolls clockwise on screen. */
export function rotateZ(deg: number): M4 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** CSS perspective(d): the viewer sits at z = d. */
export const perspective = (d: number): M4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / d, 1];

export function apply(m: M4, x: number, y: number, z = 0): [number, number, number, number] {
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
    m[12] * x + m[13] * y + m[14] * z + m[15],
  ];
}

/** CSS matrix3d() takes columns. */
export function toCss(m: M4) {
  const cols: number[] = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) cols.push(m[i * 4 + j]);
  return `matrix3d(${cols.map((v) => (Math.abs(v) < 1e-12 ? 0 : +v.toPrecision(10))).join(",")})`;
}

/** Object placement shared by planes and groups. */
export interface Placement {
  /** World px from the frame center (y down, z toward the viewer). */
  x?: number;
  y?: number;
  z?: number;
  /** Degrees. tilt: top edge leans back; turn: right edge goes back; roll: clockwise. */
  tilt?: number;
  turn?: number;
  roll?: number;
  scale?: number;
}

export function placementMatrix(p: Placement): M4 {
  return mul(
    translate(p.x ?? 0, p.y ?? 0, p.z ?? 0),
    rotateZ(p.roll ?? 0),
    rotateX(p.tilt ?? 0),
    rotateY(p.turn ?? 0),
    scale(p.scale ?? 1),
  );
}

export const EASES = {
  linear: (t: number) => t,
  in: Easing.bezier(0.55, 0, 0.75, 0.25),
  out: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Fast start, very long landing: the premium glide. */
  expo: Easing.bezier(0.16, 1, 0.3, 1),
  /** Overshoots a little, then settles. */
  back: Easing.bezier(0.34, 1.4, 0.64, 1),
  /** Slow out, very fast middle, slow in: whip pans between subjects. */
  whip: Easing.bezier(0.8, 0, 0.2, 1),
} as const;

export type EaseName = keyof typeof EASES;
