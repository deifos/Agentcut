// The Agentcut motion component library: ready-made Remotion animations that people and Claude
// drop on the timeline and tune through props. One folder per component (see README.md).
import type { ComponentType } from "react";
import type { StyleToken } from "./styles";

/** One editable prop. The same description drives the inspector form, the gallery and Claude's catalog. */
export type PropSpec = (
  | { type: "text"; label: string; default: string; multiline?: boolean; maxLength?: number; help?: string }
  | { type: "lines"; label: string; default: string[]; max?: number; help?: string }
  | { type: "color"; label: string; default: string; help?: string }
  | { type: "number"; label: string; default: number; min: number; max: number; step: number; unit?: string; help?: string }
  | { type: "select"; label: string; default: string; options: { value: string; label: string }[]; help?: string }
  | { type: "boolean"; label: string; default: boolean; help?: string }
) & {
  /** Follows this token of the project's style when the clip doesn't set it (see styles.ts). */
  style?: StyleToken;
};

export type PropValues = Record<string, string | string[] | number | boolean>;

export interface ComponentMeta {
  /** kebab-case, matches the folder name: the `component` value in layers.json. */
  id: string;
  name: string;
  category: ComponentCategory;
  /** One sentence: what it is. */
  description: string;
  /** When to reach for it (Claude reads this). */
  useWhen: string;
  /** Good length at 30 fps; it adapts to any clip length. */
  durationInFrames: number;
  /** "overlay": sits over other layers (transparent background). "full": fills the frame. */
  layer: "overlay" | "full";
  tags: string[];
  props: Record<string, PropSpec>;
  /** Named prop sets: gallery variations and examples Claude can copy. */
  examples: { name: string; props: PropValues }[];
  /** Where the still preview sits, as a fraction of the duration (default 0.55): pick a sharp, fully-in moment. */
  stillAt?: number;
}

export type ComponentCategory =
  | "Talking Head"
  | "Text & Titles"
  | "Overlays"
  | "Charts & Stats"
  | "AI & Product"
  | "Backgrounds"
  | "Transitions";

/** What every component receives besides its own props. */
export interface MotionBaseProps {
  width: number;
  height: number;
  fps: number;
  /** Length of the clip on the timeline (local frames 0…durationInFrames-1). */
  durationInFrames: number;
  /** "wide", "mobile", … */
  variant: string;
}

export interface MotionComponent {
  meta: ComponentMeta;
  // Props are resolved (defaults filled in) before the component renders.
  Component: ComponentType<MotionBaseProps & PropValues>;
}
