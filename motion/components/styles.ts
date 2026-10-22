// Project styles: one look for a whole video. A project picks one in project.json (`"style": "loud"`)
// and every prop tagged with a token in its meta.json (`"style": "accent"`) follows it unless the
// clip sets that prop itself. Captions and text clips follow it too. The styles themselves live in
// styles.json (the helper reads it too). Metadata only (no React).
import stylesData from "./styles.json";
import type { PropSpec, PropValues } from "./types";

/** What a style decides. Props opt in with `"style": "<token>"` in their meta.json. */
export type StyleToken =
  /** Graphic language of the talking-head components (looks.tsx): ink, paper, notebook, crt, clean. */
  | "look"
  /** Headline font: FONTS keys in order of preference ("condensed,wide"); the first the prop offers wins. */
  | "font"
  /** Headline weight; the prop's nearest option is used. */
  | "weight"
  /** Text over footage. */
  | "text"
  | "accent"
  /** Text sitting on the accent color (marker highlights). */
  | "onAccent"
  /** Card / panel fill behind small text. */
  | "panel"
  /** Text on that panel. */
  | "panelText"
  /** Borders, hard shadows and pen strokes. */
  | "line"
  /** "dark" or "light" UI cards. */
  | "theme"
  /** Fill of full-frame components. */
  | "backdrop";

export interface MotionStyle {
  id: string;
  name: string;
  /** One line: what it looks like. */
  description: string;
  /** Graphic language of the talking-head components, captions and overlay (looks.tsx). */
  look: "ink" | "paper" | "notebook" | "crt" | "neon" | "line" | "vhs" | "clean";
  tokens: Record<StyleToken, string>;
  /**
   * Camera on footage clips (style-layer.tsx): "punch" jump-cut zooms with a shake, "snap"
   * stop-motion steps, "drift" a slow push-in, "glitch" jumps, "still" none. `every` in frames.
   */
  camera: {
    mode: "punch" | "snap" | "drift" | "glitch" | "tape" | "still";
    zoom: number;
    every: number;
    shake: number;
    /** A color grade for the footage, as a CSS filter ("saturate(1.2) sepia(0.2)"). */
    grade?: string;
  };
  /** Texture over the whole video. */
  overlay: { kind: "grain" | "scanlines" | "neon" | "vhs" | "vignette" | "none"; amount: number };
  /**
   * Caption tracks: drawn in the look (position, words per line). The font and colors are the
   * fallback for pages that can't draw the look.
   */
  captions: {
    fontFamily: string;
    fontWeight: number;
    color: string;
    highlight: string;
    preset: "pop" | "karaoke" | "plain";
    position: "top" | "center" | "lower" | "bottom";
    wordsPerLine: number;
  };
  /** Defaults for text clips. */
  text: { fontFamily: string; fontWeight: number; color: string };
  /** How to edit in this style: pacing, camera, positions (for Claude and the style picker). */
  guide: string[];
  /** The component to reach for, by job in the edit, with the props that make it this style. */
  shots: { job: string; component: string; props?: PropValues }[];
}

export const MOTION_STYLES: Record<string, MotionStyle> = Object.fromEntries(
  (stylesData as unknown as MotionStyle[]).map((style) => [style.id, style]),
);

export const STYLE_TOKENS: StyleToken[] = [
  "look",
  "font",
  "weight",
  "text",
  "accent",
  "onAccent",
  "panel",
  "panelText",
  "line",
  "theme",
  "backdrop",
];

export function getMotionStyle(id: string | null | undefined): MotionStyle | null {
  return (id && MOTION_STYLES[id]) || null;
}

/** The style's value for one prop, if the prop follows that token and the value fits the prop. */
export function styleValueFor(spec: PropSpec, style: MotionStyle | null): PropValues[string] | undefined {
  if (!style || !spec.style) return undefined;
  const value = style.tokens[spec.style];
  if (spec.type === "select") {
    const options = spec.options.map((o) => o.value);
    if (spec.style === "weight") {
      const target = Number(value);
      const numeric = options.filter((o) => Number.isFinite(Number(o)));
      if (!numeric.length || !Number.isFinite(target)) return undefined;
      return numeric.reduce((best, o) => (Math.abs(Number(o) - target) < Math.abs(Number(best) - target) ? o : best));
    }
    return value.split(",").map((v) => v.trim()).find((v) => options.includes(v));
  }
  if (spec.type === "color" || spec.type === "text") return value;
  return undefined;
}
