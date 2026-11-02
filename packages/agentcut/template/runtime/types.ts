// Agentcut project format (v1).
// Keep in sync with lib/studio/types.ts (repo root) and src/studio/schema.ts.

export type TrackKind = "scene" | "video" | "image" | "text" | "captions" | "audio" | "adjustment";

export interface StudioProject {
  version: 1;
  name: string;
  fps: number;
  durationInFrames: number;
  background: string;
  variants: Record<string, { width: number; height: number }>;
  defaultVariant: string;
  /** Google Fonts specs ("Inter:400;800") or local font files. */
  fonts: StudioFont[];
  /** Look for the whole video (components/styles.ts): components, captions and text follow it. */
  style?: string;
  /** A grade over all footage, after each clip's own grade and any adjustment layers. */
  grade?: ColorGrade;
}

export type StudioFont = string | { family: string; src: string; weight?: string; style?: "normal" | "italic" };

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ClipAnimPreset =
  | "fade"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "pop"
  | "scale"
  | "blur"
  | "none";

export interface ClipAnim {
  preset: ClipAnimPreset;
  frames: number;
}

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  shadow?: string;
}

export interface CaptionStyle {
  preset?: "pop" | "karaoke" | "plain";
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  highlight?: string;
  position?: "bottom" | "center" | "top";
  maxWordsPerLine?: number;
}

interface BaseClipFields {
  id: string;
  name?: string;
  from: number;
  duration: number;
  enter?: ClipAnim;
  exit?: ClipAnim;
  opacity?: number;
  note?: string;
}

export interface SceneClipFields {
  /** A scene file in scenes/ ("Hook" → scenes/Hook.tsx)… */
  scene?: string;
  /** …or an Agentcut library component ("text-reveal"). Exactly one of the two. */
  component?: string;
  props?: Record<string, unknown>;
}

/** A colour wheel: x/y push towards a hue on the vectorscope disk (-1…1), level moves the brightness. */
export interface GradeWheel { x?: number; y?: number; level?: number }
export type GradeBand = "red" | "orange" | "yellow" | "green" | "aqua" | "blue" | "purple" | "magenta";
export type GradeCurvePoint = [number, number];

/** See skills/agentcut/references/color.md. Multipliers are neutral at 1, amounts at 0 (-1…1 unless noted). */
export interface GradeFields {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  /** -1 (cool) … 1 (warm). */
  warmth?: number;
  /** Degrees. */
  hue?: number;
  /** Stops, -5…5. */
  exposure?: number;
  temperature?: number;
  tint?: number;
  highlights?: number;
  shadows?: number;
  whites?: number;
  blacks?: number;
  vibrance?: number;
  pivot?: number;
  blackPoint?: number;
  whitePoint?: number;
  gamma?: number;
  wheels?: { shadows?: GradeWheel; midtones?: GradeWheel; highlights?: GradeWheel };
  curves?: { master?: GradeCurvePoint[]; r?: GradeCurvePoint[]; g?: GradeCurvePoint[]; b?: GradeCurvePoint[] };
  hsl?: Partial<Record<GradeBand, { hue?: number; saturation?: number; luminance?: number }>>;
  /** Built-in look id (agentcut_color_looks). */
  look?: string;
  lookStrength?: number;
  /** A .cube file in the project. */
  lut?: string;
  lutStrength?: number;
  /** 0…1: keep skin tones out of the colour changes. */
  skinProtect?: number;
  /** Written by shot matching. */
  match?: { gains?: [number, number, number]; contrast?: number; saturation?: number; anchor?: string };
  grain?: number;
  grainSize?: number;
  halation?: number;
  bloom?: number;
  vignette?: number;
}

/** A grade at one clip-local frame. `hold` jumps instead of easing into the next key. */
export type GradeKey = GradeFields & { frame: number; hold?: boolean };

/** Color grade for footage and images. */
export interface ColorGrade extends GradeFields {
  keys?: GradeKey[];
}

export interface FramingKeyframe { seconds: number; crop: Box }

export interface VideoClipFields {
  src: string;
  trimStart?: number;
  grade?: ColorGrade;
  /** false keeps the project grade and adjustment layers off this clip (default true). */
  inheritGrade?: boolean;
  volume?: number;
  muted?: boolean;
  fit?: "cover" | "contain";
  box?: Box;
  /** Corner radius in px (half the short side makes a circle). */
  radius?: number;
  playbackRate?: number;
  /** Draw the recorded mouse over this clip (Companion recordings). */
  cursor?: VideoCursor;
  /** "none" keeps the project style's camera moves off this clip. */
  camera?: "style" | "none";
  /** Stable crop in upright source fractions, shared by preview and export. */
  framing?: { crop: Box; path?: FramingKeyframe[]; before?: Box | null; beforePath?: FramingKeyframe[] };
}

export interface VideoCursor {
  /** `<video>.cursor.json`: path, clicks and scrolls in frames of the video file. */
  src: string;
  /** "hidden" draws no pointer (the video already shows one) but keeps click effects. */
  style?: "classic" | "accent" | "spotlight" | "hand" | "hidden";
  /** Percent of the default size (50–200). */
  size?: number;
  /** Ring that spreads from each click. */
  clicks?: boolean;
  /** 0 follows the raw path, 1 glides. */
  smoothing?: number;
}

/** Contents of a `<video>.cursor.json`. */
export interface CursorTrack {
  version: 1;
  fps: number;
  durationInFrames: number;
  width?: number;
  height?: number;
  space: "video" | "source";
  cursorInVideo: boolean;
  path: [number, number | null, number | null][];
  kinds: [number, string][];
  clicks: { frame: number; x: number; y: number; button: string }[];
  scrolls: { frame: number; x: number; y: number; dy: number }[];
}

export interface ImageClipFields {
  src: string;
  grade?: ColorGrade;
  /** true also applies the project grade and adjustment layers (default false, so logos keep their colours). */
  inheritGrade?: boolean;
  fit?: "cover" | "contain";
  box?: Box;
  radius?: number;
}

export interface TextClipFields {
  text: string;
  box?: Box;
  style?: TextStyle;
}

export interface CaptionWord {
  text: string;
  from: number;
  to: number;
}

export interface CaptionsClipFields {
  words: CaptionWord[];
  style?: CaptionStyle;
}

export interface AudioClipFields {
  src: string;
  volume?: number;
  trimStart?: number;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
  playbackRate?: number;
  role?: "voice" | "music" | "sfx" | "ambience";
}

type WithVariants<T> = T & {
  variants?: Record<string, Partial<Omit<T, "id">>>;
};

/** A grade over the footage below it on the timeline, for as long as the clip runs. */
export interface AdjustmentClipFields {
  grade: ColorGrade;
}

export type SceneClip = WithVariants<BaseClipFields & SceneClipFields>;
export type VideoClip = WithVariants<BaseClipFields & VideoClipFields>;
export type ImageClip = WithVariants<BaseClipFields & ImageClipFields>;
export type TextClip = WithVariants<BaseClipFields & TextClipFields>;
export type CaptionsClip = WithVariants<BaseClipFields & CaptionsClipFields>;
export type AudioClip = WithVariants<BaseClipFields & AudioClipFields>;
export type AdjustmentClip = WithVariants<BaseClipFields & AdjustmentClipFields>;

export type StudioClip =
  | SceneClip
  | VideoClip
  | ImageClip
  | TextClip
  | CaptionsClip
  | AudioClip
  | AdjustmentClip;

export interface ClipByKind {
  scene: SceneClip;
  video: VideoClip;
  image: ImageClip;
  text: TextClip;
  captions: CaptionsClip;
  audio: AudioClip;
  adjustment: AdjustmentClip;
}

export interface StudioTrack<K extends TrackKind = TrackKind> {
  id: string;
  name: string;
  kind: K;
  hidden?: boolean;
  muted?: boolean;
  locked?: boolean;
  volume?: number;
  clips: ClipByKind[K][];
}

export interface StudioMarker {
  id: string;
  frame: number;
  label: string;
  kind?: "beat" | "cue" | "section";
}

export interface StudioLayers {
  version: 1;
  tracks: StudioTrack[];
  markers: StudioMarker[];
}

/** Props the runtime passes to `StudioComposition`. */
export interface StudioCompositionProps extends Record<string, unknown> {
  project: StudioProject;
  layers: StudioLayers;
  variant: string;
  /** Base URL for `assets/…` paths, e.g. http://127.0.0.1:32118/studio/files/<slug> */
  assetBase: string;
  /** Base URL for `library:` paths, e.g. http://127.0.0.1:32118/studio/library */
  libraryBase: string;
  /** Linear gain applied to every audio clip (export loudness normalization). */
  masterGain?: number;
  /** Fast-seeking copies of footage, project path → URL. Only the live preview passes these. */
  previewProxies?: Record<string, string>;
}

/** Props every scene component receives (plus the clip's own `props`). */
export interface SceneProps {
  clip: { id: string; from: number; duration: number };
  variant: string;
  width: number;
  height: number;
  fps: number;
}
