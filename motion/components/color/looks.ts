// Built-in looks, written as grades so they scale with a strength slider and need no LUT files.
import type { GradeFields } from "./grade";

export interface GradeLook {
  id: string;
  name: string;
  group: "Film" | "Cinematic" | "Clean" | "Mono" | "Stylized";
  description: string;
  fields: GradeFields;
}

const S_CURVE: GradeFields["curves"] = { master: [[0, 0], [0.25, 0.2], [0.75, 0.82], [1, 1]] };
const SOFT_S: GradeFields["curves"] = { master: [[0, 0], [0.25, 0.225], [0.75, 0.785], [1, 1]] };
const FADED: GradeFields["curves"] = { master: [[0, 0.07], [0.25, 0.25], [0.75, 0.76], [1, 0.95]] };

export const GRADE_LOOKS: GradeLook[] = [
  {
    id: "golden-stock", name: "Golden Stock", group: "Film",
    description: "Warm print film: rich skin, soft amber highlights, gentle halation",
    fields: {
      temperature: 0.14, vibrance: 0.1, skinProtect: 0.2, curves: SOFT_S, halation: 0.25, grain: 0.14,
      wheels: { shadows: { x: 0.08, y: -0.12 }, highlights: { x: 0.2, y: 0.08 } },
      hsl: { orange: { saturation: 0.08 }, green: { hue: -0.08, saturation: -0.18 }, blue: { saturation: -0.12 } },
    },
  },
  {
    id: "faded-print", name: "Faded Print", group: "Film",
    description: "Lifted blacks and quiet colour, like an old print in the sun",
    fields: {
      saturation: 0.86, temperature: 0.06, curves: FADED, grain: 0.2, halation: 0.12,
      wheels: { shadows: { x: -0.18, y: -0.12 }, highlights: { x: 0.12, y: 0.06 } },
    },
  },
  {
    id: "seventies-stock", name: "70s Stock", group: "Film",
    description: "Brown shadows, creamy yellows and heavy grain",
    fields: {
      temperature: 0.18, tint: 0.04, saturation: 0.9, curves: FADED, grain: 0.34, grainSize: 1.5, halation: 0.34, vignette: 0.16,
      wheels: { shadows: { x: 0.2, y: 0.06 }, midtones: { x: 0.06, y: 0.06 } },
      hsl: { blue: { hue: -0.1, saturation: -0.28 }, green: { hue: -0.18, saturation: -0.25 } },
    },
  },
  {
    id: "teal-amber", name: "Teal & Amber", group: "Cinematic",
    description: "The blockbuster split: teal shadows with warm, protected skin",
    fields: {
      vibrance: 0.14, skinProtect: 0.65, curves: S_CURVE,
      wheels: { shadows: { x: -0.38, y: -0.1 }, midtones: { x: -0.02 }, highlights: { x: 0.24, y: 0.08 } },
      hsl: { blue: { hue: -0.14, saturation: 0.14 }, aqua: { hue: 0.08, saturation: 0.1 }, orange: { saturation: 0.08 }, green: { hue: 0.2, saturation: -0.22 } },
    },
  },
  {
    id: "cold-thriller", name: "Cold Thriller", group: "Cinematic",
    description: "Green-blue cold light, dense shadows and muted skin",
    fields: {
      temperature: -0.2, tint: -0.08, saturation: 0.82, skinProtect: 0.25, curves: S_CURVE, vignette: 0.24,
      wheels: { shadows: { x: -0.24, y: 0.08 }, highlights: { x: -0.08, y: 0.06 } },
    },
  },
  {
    id: "desert-sun", name: "Desert Sun", group: "Cinematic",
    description: "Bleached orange heat with muted blues",
    fields: {
      temperature: 0.26, exposure: 0.08, saturation: 0.96, curves: SOFT_S, bloom: 0.14, halation: 0.18,
      wheels: { shadows: { x: 0.12, y: -0.1 }, highlights: { x: 0.26, y: 0.14 } },
      hsl: { blue: { hue: -0.2, saturation: -0.38 }, aqua: { saturation: -0.4 }, green: { hue: -0.25, saturation: -0.42 } },
    },
  },
  {
    id: "moody-forest", name: "Moody Forest", group: "Cinematic",
    description: "Deep, shifted greens and quiet highlights",
    fields: {
      exposure: -0.12, highlights: -0.18, skinProtect: 0.4, curves: SOFT_S, vignette: 0.22,
      wheels: { shadows: { x: -0.16, y: 0.14 } },
      hsl: { green: { hue: 0.22, saturation: -0.14, luminance: -0.22 }, yellow: { hue: 0.2, saturation: -0.16 }, blue: { saturation: -0.2 } },
    },
  },
  {
    id: "day-for-night", name: "Day for Night", group: "Cinematic",
    description: "Turns daylight into moonlight: dark, blue and low-key",
    fields: {
      exposure: -1.25, temperature: -0.42, saturation: 0.58, highlights: -0.3, curves: S_CURVE, vignette: 0.38,
      wheels: { shadows: { x: -0.26, y: -0.2 }, highlights: { x: -0.2, y: -0.1 } },
    },
  },
  {
    id: "clean-commercial", name: "Clean Commercial", group: "Clean",
    description: "Bright, true colour with a touch of snap for products and talking heads",
    fields: { exposure: 0.08, contrast: 1.05, vibrance: 0.18, skinProtect: 0.6, shadows: 0.08, highlights: -0.08 },
  },
  {
    id: "warm-documentary", name: "Warm Documentary", group: "Clean",
    description: "Natural and gently warm, with honest skin",
    fields: { temperature: 0.1, vibrance: 0.06, skinProtect: 0.5, curves: SOFT_S, shadows: 0.06, grain: 0.06 },
  },
  {
    id: "soft-pastel", name: "Soft Pastel", group: "Clean",
    description: "Airy, low contrast and light, for lifestyle footage",
    fields: {
      exposure: 0.22, shadows: 0.22, highlights: -0.12, saturation: 0.86, vibrance: 0.1, curves: FADED, bloom: 0.12,
      wheels: { shadows: { x: 0.06, y: -0.1 } },
    },
  },
  {
    id: "silver-mono", name: "Silver Mono", group: "Mono",
    description: "Neutral black and white with real contrast",
    fields: { saturation: 0, curves: S_CURVE, grain: 0.2, vignette: 0.12 },
  },
  {
    id: "warm-mono", name: "Warm Mono", group: "Mono",
    description: "Black and white, toned like a darkroom print",
    fields: { saturation: 0, curves: SOFT_S, grain: 0.18, wheels: { shadows: { x: 0.12, y: -0.04 }, highlights: { x: 0.14, y: 0.08 } } },
  },
  {
    id: "noir", name: "Noir", group: "Mono",
    description: "Hard black and white with crushed shadows and heavy corners",
    fields: { saturation: 0, contrast: 1.2, blacks: -0.18, curves: S_CURVE, grain: 0.3, vignette: 0.48 },
  },
  {
    id: "bleach-bypass", name: "Bleach Bypass", group: "Stylized",
    description: "Silver retained in the print: hard contrast, little colour",
    fields: { saturation: 0.45, contrast: 1.22, whites: 0.08, blacks: -0.08, skinProtect: 0.1, grain: 0.14 },
  },
  {
    id: "cross-process", name: "Cross Process", group: "Stylized",
    description: "Wrong-chemistry colour: cyan shadows and yellow highlights",
    fields: {
      vibrance: 0.3, contrast: 1.1, bloom: 0.08,
      curves: { r: [[0, 0.04], [0.5, 0.56], [1, 1]], g: [[0, 0], [0.5, 0.52], [1, 1]], b: [[0, 0.14], [0.5, 0.42], [1, 0.82]] },
    },
  },
  {
    id: "neon-night", name: "Neon Night", group: "Stylized",
    description: "Magenta and cyan city light with glowing highlights",
    fields: {
      contrast: 1.12, vibrance: 0.32, bloom: 0.32, halation: 0.2, vignette: 0.2,
      wheels: { shadows: { x: -0.2, y: -0.3 }, highlights: { x: 0.22, y: -0.18 } },
      hsl: { blue: { hue: 0.14, saturation: 0.25 }, magenta: { saturation: 0.25 }, red: { hue: 0.14, saturation: 0.1 } },
    },
  },
  {
    id: "vhs-memory", name: "VHS Memory", group: "Stylized",
    description: "Washed tape colour with a warm tint and heavy noise",
    fields: {
      saturation: 1.12, temperature: 0.12, tint: 0.1, curves: FADED, grain: 0.48, grainSize: 2.2, bloom: 0.18, vignette: 0.14,
    },
  },
];

const LOOK_BY_ID = new Map(GRADE_LOOKS.map((look) => [look.id, look]));

export function gradeLook(id: string): GradeFields | null {
  return LOOK_BY_ID.get(id)?.fields ?? null;
}
