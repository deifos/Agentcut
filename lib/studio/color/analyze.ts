// Measuring a frame: what the colour tools and the agent base their claims on. Pure and DOM-free.

export type Rgb = [number, number, number];

const REC709: Rgb = [0.2126, 0.7152, 0.0722];

function linearTable() {
  const table = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    table[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return table;
}
const LINEAR = linearTable();

export function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number) {
  const v = Math.max(0, c);
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** Oklab from linear light. */
export function linearToOklab(r: number, g: number, b: number): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Linear light from Oklab. */
export function oklabToLinear(L: number, a: number, b: number): Rgb {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

export interface FrameStats {
  /** Pixels measured (transparent ones don't count). */
  pixels: number;
  /** Brightness of the picture as displayed, 0…1. */
  luma: { mean: number; p02: number; p10: number; p50: number; p90: number; p98: number };
  /** Share of pixels, 0…100. */
  clippedHighlights: number;
  crushedShadows: number;
  /** Mean linear colour of the midtones: what exposure and white balance matching compare. */
  midtones: Rgb;
  /** Oklab lean of the near-neutral pixels. a: + magenta, − green. b: + warm, − cool. */
  cast: { a: number; b: number; neutralShare: number };
  /** Max minus min channel, 0…1. */
  saturation: { mean: number; p95: number };
  skin: {
    /** Share of pixels near the skin line, 0…100. */
    coverage: number;
    /** Degrees from the skin line on a vectorscope; null without enough skin. */
    hueOffset: number | null;
  };
  /** 64 bins of brightness. */
  histogram: number[];
}

const SKIN_ANGLE = (123 * Math.PI) / 180;

/** Angle and strength of a colour on the vectorscope. */
export function vectorscope(r: number, g: number, b: number) {
  const y = REC709[0] * r + REC709[1] * g + REC709[2] * b;
  const cb = (b - y) * 0.5389;
  const cr = (r - y) * 0.635;
  return { cb, cr, chroma: Math.hypot(cb, cr), angle: Math.atan2(cr, cb) };
}

function percentile(histogram: Uint32Array, total: number, p: number) {
  const target = total * p;
  let seen = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    seen += histogram[i];
    if (seen >= target) return i / (histogram.length - 1);
  }
  return 1;
}

/** Stats of RGBA pixels. `stride` skips pixels for speed on big frames. */
export function analyzePixels(data: Uint8ClampedArray | Uint8Array, stride = 1): FrameStats {
  const lumaHist = new Uint32Array(1024);
  const satHist = new Uint32Array(256);
  let pixels = 0;
  let lumaSum = 0;
  let clipped = 0;
  let crushed = 0;
  let satSum = 0;
  const mid: Rgb = [0, 0, 0];
  let midCount = 0;
  let castA = 0;
  let castB = 0;
  let neutrals = 0;
  let skinPixels = 0;
  let skinCos = 0;
  let skinSin = 0;
  const step = 4 * Math.max(1, stride);
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] < 128) continue;
    const r8 = data[i];
    const g8 = data[i + 1];
    const b8 = data[i + 2];
    pixels += 1;
    const r = r8 / 255;
    const g = g8 / 255;
    const b = b8 / 255;
    const y = REC709[0] * r + REC709[1] * g + REC709[2] * b;
    lumaSum += y;
    lumaHist[Math.min(1023, Math.round(y * 1023))] += 1;
    if (r8 >= 254 && g8 >= 254 && b8 >= 254) clipped += 1;
    else if (r8 <= 2 && g8 <= 2 && b8 <= 2) crushed += 1;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    satSum += sat;
    satHist[Math.round(sat * 255)] += 1;
    if (y < 0.1 || y > 0.92) continue;
    const lr = LINEAR[r8];
    const lg = LINEAR[g8];
    const lb = LINEAR[b8];
    if (y > 0.15 && y < 0.85) {
      mid[0] += lr;
      mid[1] += lg;
      mid[2] += lb;
      midCount += 1;
    }
    const [, a, labB] = linearToOklab(lr, lg, lb);
    if (Math.hypot(a, labB) < 0.05) {
      castA += a;
      castB += labB;
      neutrals += 1;
    }
    const scope = vectorscope(r, g, b);
    let off = scope.angle - SKIN_ANGLE;
    if (off > Math.PI) off -= 2 * Math.PI;
    if (off < -Math.PI) off += 2 * Math.PI;
    if (Math.abs(off) < (32 * Math.PI) / 180 && scope.chroma > 0.02 && scope.chroma < 0.3 && y > 0.18) {
      skinPixels += 1;
      skinCos += Math.cos(off);
      skinSin += Math.sin(off);
    }
  }
  const safe = Math.max(1, pixels);
  const histogram = new Array<number>(64).fill(0);
  for (let i = 0; i < lumaHist.length; i += 1) histogram[Math.floor((i / 1024) * 64)] += lumaHist[i] / safe;
  const skinShare = (skinPixels / safe) * 100;
  return {
    pixels,
    luma: {
      mean: lumaSum / safe,
      p02: percentile(lumaHist, safe, 0.02),
      p10: percentile(lumaHist, safe, 0.1),
      p50: percentile(lumaHist, safe, 0.5),
      p90: percentile(lumaHist, safe, 0.9),
      p98: percentile(lumaHist, safe, 0.98),
    },
    clippedHighlights: (clipped / safe) * 100,
    crushedShadows: (crushed / safe) * 100,
    midtones: midCount ? [mid[0] / midCount, mid[1] / midCount, mid[2] / midCount] : [0.18, 0.18, 0.18],
    cast: neutrals ? { a: castA / neutrals, b: castB / neutrals, neutralShare: (neutrals / safe) * 100 } : { a: 0, b: 0, neutralShare: 0 },
    saturation: { mean: satSum / safe, p95: percentile(satHist, safe, 0.95) },
    skin: {
      coverage: skinShare,
      hueOffset: skinShare >= 1.5 ? (Math.atan2(skinSin, skinCos) * 180) / Math.PI : null,
    },
    histogram,
  };
}

export interface ColorIssue {
  code: "clipped-highlights" | "crushed-shadows" | "underexposed" | "overexposed" | "flat" | "color-cast" | "oversaturated" | "washed-out" | "skin-off-line";
  severity: "warning" | "info";
  message: string;
}

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

/**
 * What stands out about a frame. These are the conventions colourists check against, not rules:
 * a night scene is meant to be dark, so the agent weighs them against the intent.
 */
export function colorIssues(stats: FrameStats): ColorIssue[] {
  const issues: ColorIssue[] = [];
  if (stats.clippedHighlights > 2)
    issues.push({ code: "clipped-highlights", severity: stats.clippedHighlights > 8 ? "warning" : "info", message: `${round(stats.clippedHighlights)}% of the frame is blown out to pure white.` });
  if (stats.crushedShadows > 5)
    issues.push({ code: "crushed-shadows", severity: stats.crushedShadows > 15 ? "warning" : "info", message: `${round(stats.crushedShadows)}% of the frame is crushed to pure black.` });
  if (stats.luma.p50 < 0.13)
    issues.push({ code: "underexposed", severity: "warning", message: `Median brightness is ${round(stats.luma.p50 * 100, 0)}%: very dark.` });
  if (stats.luma.p50 > 0.82)
    issues.push({ code: "overexposed", severity: "warning", message: `Median brightness is ${round(stats.luma.p50 * 100, 0)}%: very bright.` });
  if (stats.luma.p98 - stats.luma.p02 < 0.35)
    issues.push({ code: "flat", severity: "info", message: `Tonal range is only ${round((stats.luma.p98 - stats.luma.p02) * 100, 0)}% of the scale: flat.` });
  if (stats.cast.neutralShare > 8 && Math.hypot(stats.cast.a, stats.cast.b) > 0.018) {
    const lean = Math.abs(stats.cast.b) >= Math.abs(stats.cast.a) ? (stats.cast.b > 0 ? "warm" : "cool") : stats.cast.a > 0 ? "magenta" : "green";
    issues.push({ code: "color-cast", severity: "info", message: `Near-neutral areas lean ${lean} (a ${round(stats.cast.a, 3)}, b ${round(stats.cast.b, 3)}).` });
  }
  if (stats.saturation.p95 > 0.82)
    issues.push({ code: "oversaturated", severity: "info", message: `The most colourful 5% reach ${round(stats.saturation.p95 * 100, 0)}% saturation.` });
  if (stats.saturation.p95 < 0.1 && stats.saturation.mean > 0.01)
    issues.push({ code: "washed-out", severity: "info", message: `Very little colour: the most colourful 5% reach only ${round(stats.saturation.p95 * 100, 0)}%.` });
  if (stats.skin.hueOffset !== null && Math.abs(stats.skin.hueOffset) > 12)
    issues.push({ code: "skin-off-line", severity: "warning", message: `Skin-coloured areas sit ${round(Math.abs(stats.skin.hueOffset), 0)}° ${stats.skin.hueOffset > 0 ? "towards red" : "towards yellow"} of the skin line.` });
  return issues;
}

export interface ShotDifference {
  /** Stops brighter (+) or darker (−) than the reference shot. */
  exposure: number;
  /** Oklab distance between the midtone colours, ignoring brightness. */
  color: number;
  /** Saturation relative to the reference shot (1 = same). */
  saturation: number;
  /** Contrast relative to the reference shot (1 = same). */
  contrast: number;
}

const lumaOf = (c: Rgb) => REC709[0] * c[0] + REC709[1] * c[1] + REC709[2] * c[2];

export function shotDifference(shot: FrameStats, reference: FrameStats): ShotDifference {
  const [, a1, b1] = linearToOklab(...shot.midtones);
  const [, a2, b2] = linearToOklab(...reference.midtones);
  return {
    exposure: Math.log2(Math.max(1e-4, lumaOf(shot.midtones)) / Math.max(1e-4, lumaOf(reference.midtones))),
    color: Math.hypot(a1 - a2, b1 - b2),
    saturation: shot.saturation.mean / Math.max(1e-3, reference.saturation.mean),
    contrast: (shot.luma.p90 - shot.luma.p10) / Math.max(1e-3, reference.luma.p90 - reference.luma.p10),
  };
}

/** A cut between these two would be noticeable. */
export function shotsClash(difference: ShotDifference) {
  return Math.abs(difference.exposure) > 0.4 || difference.color > 0.02;
}

/** Several frames of one shot as one set of stats. */
export function averageStats(list: FrameStats[]): FrameStats {
  if (list.length === 1) return list[0];
  const n = list.length;
  const mean = (pick: (s: FrameStats) => number) => list.reduce((sum, s) => sum + pick(s), 0) / n;
  const offsets = list.map((s) => s.skin.hueOffset).filter((v): v is number => v !== null);
  return {
    pixels: list.reduce((sum, s) => sum + s.pixels, 0),
    luma: {
      mean: mean((s) => s.luma.mean), p02: mean((s) => s.luma.p02), p10: mean((s) => s.luma.p10),
      p50: mean((s) => s.luma.p50), p90: mean((s) => s.luma.p90), p98: mean((s) => s.luma.p98),
    },
    clippedHighlights: mean((s) => s.clippedHighlights),
    crushedShadows: mean((s) => s.crushedShadows),
    midtones: [mean((s) => s.midtones[0]), mean((s) => s.midtones[1]), mean((s) => s.midtones[2])],
    cast: { a: mean((s) => s.cast.a), b: mean((s) => s.cast.b), neutralShare: mean((s) => s.cast.neutralShare) },
    saturation: { mean: mean((s) => s.saturation.mean), p95: mean((s) => s.saturation.p95) },
    skin: { coverage: mean((s) => s.skin.coverage), hueOffset: offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : null },
    histogram: list[0].histogram.map((_, i) => mean((s) => s.histogram[i])),
  };
}

/** Stats with the numbers rounded for reading (agent results). */
export function roundStats(stats: FrameStats) {
  const r2 = (v: number) => round(v, 2);
  const r3 = (v: number) => round(v, 3);
  return {
    luma: { mean: r3(stats.luma.mean), p02: r3(stats.luma.p02), p10: r3(stats.luma.p10), p50: r3(stats.luma.p50), p90: r3(stats.luma.p90), p98: r3(stats.luma.p98) },
    clippedHighlightsPercent: r2(stats.clippedHighlights),
    crushedShadowsPercent: r2(stats.crushedShadows),
    cast: { a: r3(stats.cast.a), b: r3(stats.cast.b), neutralSharePercent: round(stats.cast.neutralShare) },
    saturation: { mean: r3(stats.saturation.mean), p95: r3(stats.saturation.p95) },
    skin: { coveragePercent: round(stats.skin.coverage), hueOffsetDegrees: stats.skin.hueOffset === null ? null : round(stats.skin.hueOffset) },
  };
}
