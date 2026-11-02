// The colour grade model: what a `grade` means, independent of how it is drawn. Pure functions only,
// so the studio, the runtime and the tests all share them. Numbers follow the slider conventions:
// multipliers are neutral at 1, amounts are neutral at 0 and run -1…1 unless noted.

export type GradeBand = "red" | "orange" | "yellow" | "green" | "aqua" | "blue" | "purple" | "magenta";
export const GRADE_BANDS: GradeBand[] = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"];

/** A colour wheel: x/y push towards a hue on the vectorscope disk (-1…1), level moves the brightness. */
export interface GradeWheel { x?: number; y?: number; level?: number }
export interface GradeWheels { shadows?: GradeWheel; midtones?: GradeWheel; highlights?: GradeWheel }
export type GradeCurvePoint = [number, number];
export interface GradeCurves { master?: GradeCurvePoint[]; r?: GradeCurvePoint[]; g?: GradeCurvePoint[]; b?: GradeCurvePoint[] }
export interface GradeHsl { hue?: number; saturation?: number; luminance?: number }
/** Shot matching result, applied before everything else so a look can sit on top of it. */
export interface GradeMatch { gains?: [number, number, number]; contrast?: number; saturation?: number; anchor?: string }

export interface GradeFields {
  // The original controls, drawn exactly as the CSS filters they started as.
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  hue?: number;
  // Primary
  /** Stops, -5…5. */
  exposure?: number;
  temperature?: number;
  tint?: number;
  highlights?: number;
  shadows?: number;
  whites?: number;
  blacks?: number;
  vibrance?: number;
  /** Contrast pivot, 0…1. */
  pivot?: number;
  blackPoint?: number;
  whitePoint?: number;
  gamma?: number;
  wheels?: GradeWheels;
  curves?: GradeCurves;
  hsl?: Partial<Record<GradeBand, GradeHsl>>;
  // Looks
  /** Built-in look id (see looks.ts). */
  look?: string;
  lookStrength?: number;
  /** A .cube file in the project ("assets/looks/x.cube"). */
  lut?: string;
  lutStrength?: number;
  /** 0…1: keep skin tones out of the colour changes. */
  skinProtect?: number;
  match?: GradeMatch;
  // Finish
  grain?: number;
  /** Grain size, 0.5…4 (1 = film-like at 1080p). */
  grainSize?: number;
  halation?: number;
  bloom?: number;
  /** -1…1: positive darkens the corners. */
  vignette?: number;
}

/** A grade at one frame (clip-local). `hold` jumps instead of easing into the next key. */
export type GradeKey = GradeFields & { frame: number; hold?: boolean };
export interface ColorGrade extends GradeFields { keys?: GradeKey[] }

const NEUTRAL: Record<string, number> = {
  brightness: 1, contrast: 1, saturation: 1, warmth: 0, hue: 0,
  exposure: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, vibrance: 0,
  pivot: 0.5, blackPoint: 0, whitePoint: 1, gamma: 1,
  skinProtect: 0, grain: 0, grainSize: 1, halation: 0, bloom: 0, vignette: 0,
  lookStrength: 1, lutStrength: 1,
};
const NUMERIC_FIELDS = Object.keys(NEUTRAL);
const LEGACY_FIELDS = new Set(["brightness", "contrast", "saturation", "warmth", "hue"]);
const FINISH_FIELDS = ["grain", "grainSize", "halation", "bloom", "vignette"] as const;
/** These only change how the other fields act, so alone they change nothing. */
const MODIFIER_FIELDS = new Set(["lookStrength", "lutStrength", "pivot", "grainSize", "skinProtect"]);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function isNeutralWheel(w?: GradeWheel) {
  return !w || (!w.x && !w.y && !w.level);
}

function curveIsIdentity(points?: GradeCurvePoint[]) {
  return !points || points.length < 2 || points.every(([x, y]) => Math.abs(x - y) < 1e-4);
}

export function hasCurves(fields: GradeFields): boolean {
  const c = fields.curves;
  return Boolean(c && !(curveIsIdentity(c.master) && curveIsIdentity(c.r) && curveIsIdentity(c.g) && curveIsIdentity(c.b)));
}

/** True when these fields change nothing. */
export function isNeutralGrade(grade: ColorGrade | undefined | null): boolean {
  if (!grade) return true;
  if (grade.keys?.length || grade.look || grade.lut || grade.match) return false;
  for (const key of NUMERIC_FIELDS) {
    if (MODIFIER_FIELDS.has(key)) continue;
    const value = grade[key as keyof GradeFields] as number | undefined;
    if (value !== undefined && Math.abs(value - NEUTRAL[key]) > 1e-6) return false;
  }
  const w = grade.wheels;
  if (w && !(isNeutralWheel(w.shadows) && isNeutralWheel(w.midtones) && isNeutralWheel(w.highlights))) return false;
  if (hasCurves(grade)) return false;
  if (grade.hsl && Object.values(grade.hsl).some((b) => b && (b.hue || b.saturation || b.luminance))) return false;
  return true;
}

/** True when the grade only uses the original five controls, which stay on CSS filters. */
export function isCssGrade(grade: ColorGrade | undefined | null): boolean {
  if (!grade) return true;
  return Object.entries(grade).every(([key, value]) => value === undefined || LEGACY_FIELDS.has(key));
}

/** CSS filter for the original five controls. */
export function gradeCssFilter(grade: ColorGrade | undefined | null): string | undefined {
  if (!grade) return undefined;
  const parts: string[] = [];
  if (grade.brightness !== undefined && grade.brightness !== 1) parts.push(`brightness(${grade.brightness})`);
  if (grade.contrast !== undefined && grade.contrast !== 1) parts.push(`contrast(${grade.contrast})`);
  if (grade.saturation !== undefined && grade.saturation !== 1) parts.push(`saturate(${grade.saturation})`);
  const warmth = grade.warmth ?? 0;
  if (warmth > 0) parts.push(`sepia(${(warmth * 0.35).toFixed(3)})`, `saturate(${(1 + warmth * 0.25).toFixed(3)})`);
  const hue = (grade.hue ?? 0) + (warmth < 0 ? warmth * -12 : warmth * -4);
  if (hue) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}

function mixWheel(a: GradeWheel | undefined, b: GradeWheel | undefined, t: number): GradeWheel {
  return { x: lerp(a?.x ?? 0, b?.x ?? 0, t), y: lerp(a?.y ?? 0, b?.y ?? 0, t), level: lerp(a?.level ?? 0, b?.level ?? 0, t) };
}

/** Fields between `a` and `b`. Numbers, wheels and the colour mixer ease; curves and files switch halfway. */
export function mixGrades(a: GradeFields, b: GradeFields, t: number): GradeFields {
  const out: GradeFields = t < 0.5 ? { ...a } : { ...b };
  for (const key of NUMERIC_FIELDS) {
    const from = a[key as keyof GradeFields] as number | undefined;
    const to = b[key as keyof GradeFields] as number | undefined;
    if (from === undefined && to === undefined) continue;
    (out as Record<string, unknown>)[key] = lerp(from ?? NEUTRAL[key], to ?? NEUTRAL[key], t);
  }
  if (a.wheels || b.wheels) {
    out.wheels = {
      shadows: mixWheel(a.wheels?.shadows, b.wheels?.shadows, t),
      midtones: mixWheel(a.wheels?.midtones, b.wheels?.midtones, t),
      highlights: mixWheel(a.wheels?.highlights, b.wheels?.highlights, t),
    };
  }
  if (a.hsl || b.hsl) {
    out.hsl = {};
    for (const band of GRADE_BANDS) {
      const x = a.hsl?.[band];
      const y = b.hsl?.[band];
      if (!x && !y) continue;
      out.hsl[band] = {
        hue: lerp(x?.hue ?? 0, y?.hue ?? 0, t),
        saturation: lerp(x?.saturation ?? 0, y?.saturation ?? 0, t),
        luminance: lerp(x?.luminance ?? 0, y?.luminance ?? 0, t),
      };
    }
  }
  return out;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** The grade at a clip-local frame: keys ease over the base fields (a key only overrides what it names). */
export function gradeAtFrame(grade: ColorGrade, frame: number): GradeFields {
  const { keys, ...base } = grade;
  if (!keys?.length) return base;
  const sorted = [...keys].sort((a, b) => a.frame - b.frame);
  const fieldsOf = (key: GradeKey): GradeFields => {
    const fields: GradeFields & { frame?: number; hold?: boolean } = { ...base, ...key };
    delete fields.frame;
    delete fields.hold;
    return fields;
  };
  if (frame <= sorted[0].frame) return fieldsOf(sorted[0]);
  const last = sorted[sorted.length - 1];
  if (frame >= last.frame) return fieldsOf(last);
  const nextIndex = sorted.findIndex((key) => key.frame > frame);
  const from = sorted[nextIndex - 1];
  const to = sorted[nextIndex];
  if (from.hold) return fieldsOf(from);
  return mixGrades(fieldsOf(from), fieldsOf(to), smooth((frame - from.frame) / (to.frame - from.frame)));
}

/** Fields scaled towards neutral: strength 0 changes nothing, 1 is the fields as written. */
export function scaleGrade(fields: GradeFields, strength: number): GradeFields {
  if (strength >= 1) return fields;
  const out = mixGrades({}, fields, strength);
  out.look = fields.look;
  out.lut = fields.lut;
  out.lutStrength = fields.lut ? (fields.lutStrength ?? 1) * strength : undefined;
  if (fields.curves) {
    const scale = (points?: GradeCurvePoint[]) =>
      points?.map(([x, y]): GradeCurvePoint => [x, lerp(x, y, strength)]);
    out.curves = { master: scale(fields.curves.master), r: scale(fields.curves.r), g: scale(fields.curves.g), b: scale(fields.curves.b) };
  }
  if (fields.match) out.match = fields.match;
  return out;
}

export type GradeLookResolver = (id: string) => GradeFields | null;

/**
 * The draw passes of one grade at a frame: the correction first, then the look on top. The finish
 * (grain, halation, …) moves to the last pass so a look never tints the grain.
 */
export function gradePasses(grade: ColorGrade, frame: number, resolveLook: GradeLookResolver): GradeFields[] {
  const fields = gradeAtFrame(grade, frame);
  const { look: lookId, lookStrength, ...primary } = fields;
  const look = lookId ? resolveLook(lookId) : null;
  if (!look) return isNeutralGrade(primary) ? [] : [primary];
  const scaled = scaleGrade(look, lookStrength ?? 1);
  const finish: GradeFields = {};
  for (const key of FINISH_FIELDS) {
    const value = primary[key] ?? scaled[key];
    if (value !== undefined) finish[key] = value;
    delete primary[key];
  }
  const passes: GradeFields[] = [];
  if (!isNeutralGrade(primary)) passes.push(primary);
  passes.push({ ...scaled, ...finish });
  return passes;
}

// ---------------------------------------------------------------------------
// Curves: a monotone cubic through the points, so a curve never overshoots or folds back.

function sortedCurve(points: GradeCurvePoint[]): GradeCurvePoint[] {
  const sorted = points
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    .map(([x, y]): GradeCurvePoint => [clamp(x, 0, 1), clamp(y, 0, 1)])
    .sort((a, b) => a[0] - b[0]);
  const unique: GradeCurvePoint[] = [];
  for (const point of sorted) {
    if (unique.length && point[0] - unique[unique.length - 1][0] < 1e-4) unique[unique.length - 1] = point;
    else unique.push(point);
  }
  if (!unique.length) return [[0, 0], [1, 1]];
  if (unique[0][0] > 0) unique.unshift([0, unique[0][1]]);
  if (unique[unique.length - 1][0] < 1) unique.push([1, unique[unique.length - 1][1]]);
  return unique;
}

/** Sample a curve at `size` evenly spaced inputs (Fritsch–Carlson monotone cubic). */
export function bakeCurve(points: GradeCurvePoint[] | undefined, size = 1024): Float32Array {
  const out = new Float32Array(size);
  const curve = sortedCurve(points?.length ? points : [[0, 0], [1, 1]]);
  const n = curve.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(curve[i + 1][0] - curve[i][0]);
    slope.push((curve[i + 1][1] - curve[i][1]) / dx[i]);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let segment = 0;
  for (let i = 0; i < size; i += 1) {
    const x = i / (size - 1);
    while (segment < n - 2 && x > curve[segment + 1][0]) segment += 1;
    const h = dx[segment];
    const t = (x - curve[segment][0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y =
      (2 * t3 - 3 * t2 + 1) * curve[segment][1] +
      (t3 - 2 * t2 + t) * h * m[segment] +
      (-2 * t3 + 3 * t2) * curve[segment + 1][1] +
      (t3 - t2) * h * m[segment + 1];
    out[i] = clamp(y, 0, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// .cube files

export interface CubeLut {
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /** RGBA floats, red changing fastest (the order WebGL's 3D textures want). */
  data: Float32Array;
}

export const MAX_CUBE_SIZE = 65;

/** Parse a 3D .cube file. Throws a readable error on anything else, including 1D LUTs. */
export function parseCube(text: string): CubeLut {
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  let data: Float32Array | null = null;
  let filled = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const head = line.split(/\s+/, 1)[0].toUpperCase();
    if (head === "TITLE") continue;
    if (head === "LUT_1D_SIZE") throw new Error("This is a 1D LUT. Only 3D .cube files are supported.");
    if (head === "LUT_3D_SIZE") {
      size = Number(line.split(/\s+/)[1]);
      if (!Number.isInteger(size) || size < 2 || size > MAX_CUBE_SIZE)
        throw new Error(`LUT_3D_SIZE must be between 2 and ${MAX_CUBE_SIZE}.`);
      data = new Float32Array(size * size * size * 4);
      continue;
    }
    if (head === "DOMAIN_MIN" || head === "DOMAIN_MAX") {
      const values = line.split(/\s+/).slice(1).map(Number);
      if (values.length !== 3 || values.some((v) => !Number.isFinite(v))) throw new Error(`${head} needs three numbers.`);
      if (head === "DOMAIN_MIN") domainMin = values as [number, number, number];
      else domainMax = values as [number, number, number];
      continue;
    }
    if (!/^[-+.\d]/.test(head)) continue;
    if (!data) throw new Error("This .cube file has values before LUT_3D_SIZE.");
    const values = line.split(/\s+/).map(Number);
    if (values.length < 3 || values.slice(0, 3).some((v) => !Number.isFinite(v))) throw new Error("This .cube file has an unreadable row.");
    if (filled >= size * size * size) throw new Error("This .cube file has too many rows for its LUT_3D_SIZE.");
    data.set([values[0], values[1], values[2], 1], filled * 4);
    filled += 1;
  }
  if (!data) throw new Error("This doesn't look like a .cube file (no LUT_3D_SIZE).");
  if (filled !== size * size * size) throw new Error(`This .cube file is incomplete: ${filled} of ${size * size * size} rows.`);
  if (domainMin.some((v, i) => v >= domainMax[i])) throw new Error("DOMAIN_MIN must be below DOMAIN_MAX.");
  return { size, domainMin, domainMax, data };
}

/** Write a .cube file from `lut(r, g, b)`. Values are 0…1 inputs and outputs. */
export function serializeCube(size: number, title: string, lut: (r: number, g: number, b: number) => [number, number, number]): string {
  const rows = [`TITLE "${title.replace(/["\r\n]/g, " ")}"`, `LUT_3D_SIZE ${size}`, ""];
  const last = size - 1;
  for (let b = 0; b < size; b += 1)
    for (let g = 0; g < size; g += 1)
      for (let r = 0; r < size; r += 1) {
        const [x, y, z] = lut(r / last, g / last, b / last);
        rows.push(`${clamp(x, 0, 1).toFixed(6)} ${clamp(y, 0, 1).toFixed(6)} ${clamp(z, 0, 1).toFixed(6)}`);
      }
  return `${rows.join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// Uniforms: the fields as the numbers the shader reads.

export type Vec3 = [number, number, number];
const REC709: Vec3 = [0.2126, 0.7152, 0.0722];

/** Rows of a 3×3 matrix. */
type Mat3 = [Vec3, Vec3, Vec3];
const IDENTITY: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function multiply(a: Mat3, b: Mat3): Mat3 {
  return a.map((row) =>
    [0, 1, 2].map((c) => row[0] * b[0][c] + row[1] * b[1][c] + row[2] * b[2][c]),
  ) as Mat3;
}

// The matrices from the CSS filter effects spec, so the GPU draws the same picture as the CSS path.
function saturateMatrix(s: number): Mat3 {
  return [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
}

function sepiaMatrix(a: number): Mat3 {
  const k = 1 - a;
  return [
    [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k],
    [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k],
    [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k],
  ];
}

function hueMatrix(degrees: number): Mat3 {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ];
}

/** Direction of a wheel's push as an RGB offset that keeps brightness about the same. */
function wheelRgb(wheel: GradeWheel | undefined): Vec3 {
  const x = wheel?.x ?? 0;
  const y = wheel?.y ?? 0;
  return [x, -0.5 * x + 0.866 * y, -0.5 * x - 0.866 * y];
}

/** White balance as linear channel gains, normalised to keep brightness. */
function whiteBalanceGains(temperature: number, tint: number): Vec3 {
  const r = Math.pow(2, temperature * 0.7 + tint * 0.2);
  const g = Math.pow(2, -tint * 0.5);
  const b = Math.pow(2, -temperature * 0.7 + tint * 0.2);
  const y = REC709[0] * r + REC709[1] * g + REC709[2] * b;
  return [r / y, g / y, b / y];
}

export interface GradeUniforms {
  brightness: number;
  contrast: number;
  pivot: number;
  /** Rows: saturate, warmth and hue as one matrix. */
  matrix: Mat3;
  gains: Vec3;
  matchContrast: number;
  matchSaturation: number;
  shadows: number;
  highlights: number;
  whites: number;
  blacks: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  lift: Vec3;
  wheelGamma: Vec3;
  gain: Vec3;
  vibrance: number;
  /** One [hue, saturation, luminance] per band in GRADE_BANDS order. */
  hsl: number[];
  hasHsl: boolean;
  skinProtect: number;
  lutStrength: number;
  grain: number;
  grainSize: number;
  halation: number;
  bloom: number;
  vignette: number;
}

export function gradeUniforms(fields: GradeFields): GradeUniforms {
  const warmth = fields.warmth ?? 0;
  let matrix = IDENTITY;
  const saturation = fields.saturation ?? 1;
  if (saturation !== 1) matrix = multiply(saturateMatrix(saturation), matrix);
  if (warmth > 0) {
    matrix = multiply(sepiaMatrix(warmth * 0.35), matrix);
    matrix = multiply(saturateMatrix(1 + warmth * 0.25), matrix);
  }
  const hue = (fields.hue ?? 0) + (warmth < 0 ? warmth * -12 : warmth * -4);
  if (hue) matrix = multiply(hueMatrix(hue), matrix);

  const exposure = Math.pow(2, fields.exposure ?? 0);
  const wb = whiteBalanceGains(fields.temperature ?? 0, fields.tint ?? 0);
  const match = fields.match?.gains ?? [1, 1, 1];
  const gains = wb.map((g, i) => g * exposure * match[i]) as Vec3;

  const wheels = fields.wheels;
  const lift = wheelRgb(wheels?.shadows).map((v) => v * 0.12 + (wheels?.shadows?.level ?? 0) * 0.12) as Vec3;
  const wheelGamma = wheelRgb(wheels?.midtones).map((v) => clamp(1 + v * 0.35 + (wheels?.midtones?.level ?? 0) * 0.45, 0.2, 3)) as Vec3;
  const gain = wheelRgb(wheels?.highlights).map((v) => Math.max(0, 1 + v * 0.3 + (wheels?.highlights?.level ?? 0) * 0.4)) as Vec3;

  let hasHsl = false;
  const hsl: number[] = [];
  for (const band of GRADE_BANDS) {
    const entry = fields.hsl?.[band];
    hsl.push(entry?.hue ?? 0, entry?.saturation ?? 0, entry?.luminance ?? 0);
    if (entry?.hue || entry?.saturation || entry?.luminance) hasHsl = true;
  }

  return {
    brightness: fields.brightness ?? 1,
    contrast: fields.contrast ?? 1,
    pivot: fields.pivot ?? 0.5,
    matrix,
    gains,
    matchContrast: fields.match?.contrast ?? 1,
    matchSaturation: fields.match?.saturation ?? 1,
    shadows: fields.shadows ?? 0,
    highlights: fields.highlights ?? 0,
    whites: fields.whites ?? 0,
    blacks: fields.blacks ?? 0,
    blackPoint: fields.blackPoint ?? 0,
    whitePoint: Math.max((fields.blackPoint ?? 0) + 0.001, fields.whitePoint ?? 1),
    gamma: Math.max(0.01, fields.gamma ?? 1),
    lift,
    wheelGamma,
    gain,
    vibrance: fields.vibrance ?? 0,
    hsl,
    hasHsl,
    skinProtect: fields.skinProtect ?? 0,
    lutStrength: fields.lut ? clamp(fields.lutStrength ?? 1, 0, 1) : 0,
    grain: fields.grain ?? 0,
    grainSize: fields.grainSize ?? 1,
    halation: fields.halation ?? 0,
    bloom: fields.bloom ?? 0,
    vignette: fields.vignette ?? 0,
  };
}
