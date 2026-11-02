// The numbers behind "match shots" and "match a reference". Pure, so they can be tested without a page.
import { serializeCube } from "@/motion/components/color/grade";
import type { GradeFields } from "../types";
import { linearToOklab, linearToSrgb, oklabToLinear, srgbToLinear, type FrameStats, type Rgb } from "./analyze";

type GradeMatch = NonNullable<GradeFields["match"]>;

const REC709: Rgb = [0.2126, 0.7152, 0.0722];
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lumaOf = (c: Rgb) => REC709[0] * c[0] + REC709[1] * c[1] + REC709[2] * c[2];

/**
 * No correction goes past this many stops. Past it, two shots differ because they show different scenes,
 * and forcing them together blows out the darker one and shows up compression noise.
 */
const MAX_MATCH_STOPS = 1;
const MAX_CHANNEL_BALANCE = 1.4;

/**
 * Gains the format can store and the footage can take, however the numbers got there: brightness within
 * MAX_MATCH_STOPS, and no channel far from the others.
 */
function limitGains(gains: number[]): [number, number, number] {
  const safe = gains.map((g) => (Number.isFinite(g) && g > 0 ? g : 1));
  const luma = Math.max(1e-4, REC709[0] * safe[0] + REC709[1] * safe[1] + REC709[2] * safe[2]);
  const level = clamp(luma, Math.pow(2, -MAX_MATCH_STOPS), Math.pow(2, MAX_MATCH_STOPS));
  return safe.map((g) => Number((level * clamp(g / luma, 1 / MAX_CHANNEL_BALANCE, MAX_CHANNEL_BALANCE)).toFixed(4))) as [number, number, number];
}

/** Too little picture to compare: black frames, a fade, a dark title. Correcting these only adds noise. */
export function canMatchShot(stats: FrameStats) {
  return stats.pixels > 0 && stats.luma.p90 > 0.06;
}

/**
 * The correction that brings `shot` to `anchor`. Brightness is matched fully; colour less so, because
 * two shots can differ in colour simply by showing different things, and limits stop a green field
 * being "corrected" into a grey one.
 */
export function computeShotMatch(shot: FrameStats, anchor: FrameStats, { strength = 1, anchorId }: { strength?: number; anchorId?: string } = {}): GradeMatch {
  const exposure = clamp(Math.log2(Math.max(1e-4, lumaOf(anchor.midtones)) / Math.max(1e-4, lumaOf(shot.midtones))), -2, 2) * strength;
  const shotLuma = Math.max(1e-4, lumaOf(shot.midtones));
  const anchorLuma = Math.max(1e-4, lumaOf(anchor.midtones));
  const gains = [0, 1, 2].map((c) => {
    const shotBalance = shot.midtones[c] / shotLuma;
    const anchorBalance = anchor.midtones[c] / anchorLuma;
    const balance = clamp(anchorBalance / Math.max(1e-4, shotBalance), 0.72, 1.38);
    return Math.pow(2, exposure) * Math.pow(balance, 0.75 * strength);
  }) as [number, number, number];
  // Gains on a shot change its brightness a touch: put it back so the correction only moves colour.
  const after = lumaOf(gains.map((g, c) => g * shot.midtones[c]) as Rgb);
  const fix = (shotLuma * Math.pow(2, exposure)) / Math.max(1e-4, after);
  const contrast = clamp((anchor.luma.p90 - anchor.luma.p10) / Math.max(0.02, shot.luma.p90 - shot.luma.p10), 0.8, 1.25);
  // The offset keeps two black and white shots at 1, where a plain ratio has nothing to divide.
  const saturation = clamp((anchor.saturation.mean + 0.01) / (shot.saturation.mean + 0.01), 0.75, 1.3);
  return {
    gains: limitGains(gains.map((g) => g * fix)),
    contrast: Number((1 + (contrast - 1) * strength).toFixed(3)),
    saturation: Number((1 + (saturation - 1) * strength).toFixed(3)),
    ...(anchorId ? { anchor: anchorId } : {}),
  };
}

/** One correction on top of another. */
export function combineMatches(first: GradeMatch, second: GradeMatch): GradeMatch {
  const a = first.gains ?? [1, 1, 1];
  const b = second.gains ?? [1, 1, 1];
  return {
    gains: limitGains(a.map((v, i) => v * b[i])),
    contrast: Number(clamp((first.contrast ?? 1) * (second.contrast ?? 1), 0.8, 1.25).toFixed(3)),
    saturation: Number(clamp((first.saturation ?? 1) * (second.saturation ?? 1), 0.75, 1.3).toFixed(3)),
    ...(second.anchor ?? first.anchor ? { anchor: second.anchor ?? first.anchor } : {}),
  };
}

// ---------------------------------------------------------------------------
// Look transfer: a LUT that moves one set of pixels towards the colour of another.

/** Tones split into three soft bands, so a look's teal shadows and warm highlights both come across. */
const BAND_CENTERS = [0.22, 0.52, 0.82];
const BAND_WIDTH = 0.26;

function bandWeights(L: number): Rgb {
  const w = BAND_CENTERS.map((c) => Math.exp(-Math.pow((L - c) / BAND_WIDTH, 2)));
  const sum = w[0] + w[1] + w[2];
  return [w[0] / sum, w[1] / sum, w[2] / sum];
}

interface ChromaBand { meanA: number; meanB: number; aa: number; ab: number; bb: number; weight: number }

export interface LookProfile {
  /** Cumulative share of pixels at each of 256 brightness levels. */
  cdf: Float64Array;
  bands: ChromaBand[];
  pixels: number;
}

/** What a set of RGBA pixels looks like, in Oklab. */
export function lookProfile(frames: (Uint8ClampedArray | Uint8Array)[], stride = 1): LookProfile {
  const hist = new Float64Array(256);
  const bands: ChromaBand[] = BAND_CENTERS.map(() => ({ meanA: 0, meanB: 0, aa: 0, ab: 0, bb: 0, weight: 0 }));
  let pixels = 0;
  const samples: [number, number, number, Rgb][] = [];
  for (const data of frames) {
    for (let i = 0; i < data.length; i += 4 * Math.max(1, stride)) {
      if (data[i + 3] < 128) continue;
      const [L, a, b] = linearToOklab(srgbToLinear(data[i] / 255), srgbToLinear(data[i + 1] / 255), srgbToLinear(data[i + 2] / 255));
      hist[clamp(Math.round(L * 255), 0, 255)] += 1;
      const w = bandWeights(L);
      samples.push([L, a, b, w]);
      for (let k = 0; k < 3; k += 1) {
        bands[k].meanA += w[k] * a;
        bands[k].meanB += w[k] * b;
        bands[k].weight += w[k];
      }
      pixels += 1;
    }
  }
  for (const band of bands) {
    const n = Math.max(1e-6, band.weight);
    band.meanA /= n;
    band.meanB /= n;
  }
  for (const [, a, b, w] of samples) {
    for (let k = 0; k < 3; k += 1) {
      const da = a - bands[k].meanA;
      const db = b - bands[k].meanB;
      bands[k].aa += w[k] * da * da;
      bands[k].ab += w[k] * da * db;
      bands[k].bb += w[k] * db * db;
    }
  }
  for (const band of bands) {
    const n = Math.max(1e-6, band.weight);
    band.aa /= n;
    band.ab /= n;
    band.bb /= n;
  }
  const cdf = new Float64Array(256);
  let seen = 0;
  for (let i = 0; i < 256; i += 1) {
    seen += hist[i];
    cdf[i] = seen / Math.max(1, pixels);
  }
  return { cdf, bands, pixels };
}

type Mat2 = [number, number, number, number];

function sqrtSym([a, b, , d]: Mat2): Mat2 {
  // The square root of a symmetric 2×2 matrix.
  const det = Math.max(0, a * d - b * b);
  const s = Math.sqrt(det);
  const t = Math.sqrt(Math.max(1e-12, a + d + 2 * s));
  return [(a + s) / t, b / t, b / t, (d + s) / t];
}

const mul = (x: Mat2, y: Mat2): Mat2 => [
  x[0] * y[0] + x[1] * y[2], x[0] * y[1] + x[1] * y[3],
  x[2] * y[0] + x[3] * y[2], x[2] * y[1] + x[3] * y[3],
];

function inv(x: Mat2): Mat2 {
  const det = x[0] * x[3] - x[1] * x[2];
  const safe = Math.abs(det) < 1e-12 ? 1e-12 : det;
  return [x[3] / safe, -x[1] / safe, -x[2] / safe, x[0] / safe];
}

/**
 * Monge–Kantorovich: the gentlest linear map that gives colours with covariance `s` the covariance
 * `t`. Unlike scaling each axis on its own, it doesn't drag hues sideways.
 */
function chromaMap(s: ChromaBand, t: ChromaBand): Mat2 {
  // A little regularising, so a nearly grey shot or reference doesn't explode the map.
  const eps = 2e-4;
  const S: Mat2 = [s.aa + eps, s.ab, s.ab, s.bb + eps];
  const T: Mat2 = [t.aa + eps, t.ab, t.ab, t.bb + eps];
  const root = sqrtSym(S);
  const rootInv = inv(root);
  const map = mul(mul(rootInv, sqrtSym(mul(mul(root, T), root))), rootInv);
  // Limit how far colour can be squeezed or stretched.
  const norm = Math.sqrt(Math.max(1e-9, (map[0] * map[0] + 2 * map[1] * map[1] + map[3] * map[3]) / 2));
  const scale = clamp(norm, 0.45, 1.6) / norm;
  return [map[0] * scale, map[1] * scale, map[2] * scale, map[3] * scale];
}

function quantile(cdf: Float64Array, q: number) {
  for (let i = 0; i < 256; i += 1) if (cdf[i] >= q) return i / 255;
  return 1;
}

/**
 * Where each of 256 source brightness levels should go to take on the target's distribution. Built
 * from matching quantiles, not bin by bin: flat-coloured pictures (screen recordings, graphics) leave
 * most levels empty, and a bin-by-bin map is undefined there and steps wildly around each colour.
 */
function toneMap(source: Float64Array, target: Float64Array) {
  const byLevel = new Map<number, { sum: number; count: number }>();
  const steps = 64;
  for (let i = 0; i <= steps; i += 1) {
    const q = 0.005 + (0.99 * i) / steps;
    const level = quantile(source, q);
    const entry = byLevel.get(level) ?? { sum: 0, count: 0 };
    entry.sum += quantile(target, q);
    entry.count += 1;
    byLevel.set(level, entry);
  }
  const anchors = [...byLevel.entries()].map(([level, { sum, count }]) => [level, sum / count]).sort((x, y) => x[0] - y[0]);
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  // Past the source's own range, keep moving at the same rate as the original.
  anchors.unshift([0, clamp(first[1] - first[0], 0, 1)]);
  anchors.push([1, clamp(last[1] + (1 - last[0]), 0, 1)]);
  const map = new Float64Array(256);
  let segment = 0;
  for (let i = 0; i < 256; i += 1) {
    const x = i / 255;
    while (segment < anchors.length - 2 && x > anchors[segment + 1][0]) segment += 1;
    const [x0, y0] = anchors[segment];
    const [x1, y1] = anchors[segment + 1];
    map[i] = x1 > x0 ? y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) : y1;
  }
  // Smooth, stay monotonic, and stay near the original so very different scenes keep some of their contrast.
  const smooth = new Float64Array(256);
  const radius = 4;
  for (let i = 0; i < 256; i += 1) {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - radius); k <= Math.min(255, i + radius); k += 1) {
      sum += map[k];
      n += 1;
    }
    smooth[i] = 0.25 * (i / 255) + 0.75 * (sum / n);
  }
  for (let i = 1; i < 256; i += 1) smooth[i] = Math.max(smooth[i], smooth[i - 1]);
  return smooth;
}

export type LookTransfer = (r: number, g: number, b: number) => [number, number, number];

/** The function from source colour to matched colour. Inputs and outputs are display values, 0…1. */
export function lookTransfer(source: LookProfile, target: LookProfile): LookTransfer {
  const tone = toneMap(source.cdf, target.cdf);
  const maps = source.bands.map((band, k) => chromaMap(band, target.bands[k]));
  return (r, g, b) => {
    const [L, A, B] = linearToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
    const position = clamp(L, 0, 1) * 255;
    const low = Math.floor(position);
    const high = Math.min(255, low + 1);
    const newL = tone[low] + (tone[high] - tone[low]) * (position - low);
    const w = bandWeights(L);
    let newA = 0;
    let newB = 0;
    for (let k = 0; k < 3; k += 1) {
      const s = source.bands[k];
      const t = target.bands[k];
      const da = A - s.meanA;
      const db = B - s.meanB;
      const m = maps[k];
      newA += w[k] * (m[0] * da + m[1] * db + t.meanA);
      newB += w[k] * (m[2] * da + m[3] * db + t.meanB);
    }
    // The chroma plane narrows towards black and white, so ease colour off near the ends.
    const room = clamp(Math.min(newL, 1 - newL) / 0.12, 0, 1);
    const [lr, lg, lb] = oklabToLinear(newL, newA * room, newB * room);
    return [clamp(linearToSrgb(lr), 0, 1), clamp(linearToSrgb(lg), 0, 1), clamp(linearToSrgb(lb), 0, 1)];
  };
}

export function lookCube(transfer: LookTransfer, title: string, size = 33) {
  return serializeCube(size, title, transfer);
}

/** How far apart two profiles are: 0 is identical. Compare before and after to prove a match helped. */
export function lookDistance(a: LookProfile, b: LookProfile) {
  let tone = 0;
  for (let i = 0; i < 256; i += 1) tone += Math.abs(a.cdf[i] - b.cdf[i]);
  tone /= 256;
  let chroma = 0;
  let weight = 0;
  a.bands.forEach((band, k) => {
    const other = b.bands[k];
    const w = Math.min(band.weight, other.weight);
    chroma += w * (Math.hypot(band.meanA - other.meanA, band.meanB - other.meanB) +
      Math.abs(Math.sqrt(band.aa + band.bb) - Math.sqrt(other.aa + other.bb)));
    weight += w;
  });
  return { tone: Number(tone.toFixed(4)), chroma: Number((chroma / Math.max(1e-6, weight)).toFixed(4)) };
}
