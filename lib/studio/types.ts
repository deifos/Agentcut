// Agentcut project format (v1).
// Mirror of packages/agentcut/template/runtime/types.ts — keep the two in sync.

import type { ComponentType } from "react";

export type TrackKind =
  | "scene"
  | "video"
  | "image"
  | "text"
  | "captions"
  | "audio";

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
  /** Look for the whole video (motion/components/styles.ts): components, captions and text follow it. */
  style?: string;
}

export type StudioFont =
  | string
  | {
      family: string;
      src: string;
      weight?: string;
      style?: "normal" | "italic";
    };

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

/** Color grade for footage. 1 = unchanged; warmth -1 (cool) … 1 (warm); hue in degrees. */
export interface ColorGrade {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  hue?: number;
}

export interface VideoClipFields {
  src: string;
  trimStart?: number;
  grade?: ColorGrade;
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
}

export const VIDEO_CURSOR_STYLES = [
  "classic",
  "accent",
  "spotlight",
  "hand",
  "hidden",
] as const;
export type VideoCursorStyle = (typeof VIDEO_CURSOR_STYLES)[number];

export interface VideoCursor {
  /** `<video>.cursor.json`: path, clicks and scrolls in frames of the video file. */
  src: string;
  /** "hidden" draws no pointer (the video already shows one) but keeps click effects. */
  style?: VideoCursorStyle;
  /** Percent of the default size (50–200). */
  size?: number;
  /** Ring that spreads from each click. */
  clicks?: boolean;
  /** 0 follows the raw path, 1 glides. */
  smoothing?: number;
}

export interface ImageClipFields {
  src: string;
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

export type SceneClip = WithVariants<BaseClipFields & SceneClipFields>;
export type VideoClip = WithVariants<BaseClipFields & VideoClipFields>;
export type ImageClip = WithVariants<BaseClipFields & ImageClipFields>;
export type TextClip = WithVariants<BaseClipFields & TextClipFields>;
export type CaptionsClip = WithVariants<BaseClipFields & CaptionsClipFields>;
export type AudioClip = WithVariants<BaseClipFields & AudioClipFields>;

export type StudioClip =
  | SceneClip
  | VideoClip
  | ImageClip
  | TextClip
  | CaptionsClip
  | AudioClip;

export interface ClipByKind {
  scene: SceneClip;
  video: VideoClip;
  image: ImageClip;
  text: TextClip;
  captions: CaptionsClip;
  audio: AudioClip;
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
}

/** Props every scene component receives (plus the clip's own `props`). */
export interface SceneProps {
  clip: { id: string; from: number; duration: number };
  variant: string;
  width: number;
  height: number;
  fps: number;
}

// ---------------------------------------------------------------------------
// Web app side (not part of the file format)

/** What a project bundle exports (see runtime/index.tsx). */
export interface StudioModule {
  runtimeVersion: number;
  StudioComposition: ComponentType<StudioCompositionProps>;
  scenes: string[];
}

export interface ValidationIssue {
  file: "project.json" | "layers.json";
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface BundleMessage {
  text: string;
  file?: string;
  line?: number;
  column?: number;
  lineText?: string;
}

export interface BundleSummary {
  slug: string;
  revision: number;
  ok: boolean;
  hasCode: boolean;
  errors: BundleMessage[];
  warnings: BundleMessage[];
  scenes: string[];
  builtAt: number;
  durationMs: number;
}

export interface ProjectSummary {
  slug: string;
  name: string;
  updatedAt: number;
  durationInFrames?: number;
  fps?: number;
}

export interface AssetEntry {
  path: string;
  size: number;
  kind: "audio" | "video" | "image" | "other";
  updatedAt: number;
}

/** A coding agent CLI the helper can drive for the chat (Claude Code, Codex, …). */
export interface AgentInfo {
  id: string;
  /** Short name for the chat copy: "Claude is working". */
  name: string;
  /** What to install: "Claude Code". */
  product: string;
  found: boolean;
  path: string | null;
  version: string | null;
  error?: string;
  installUrl: string;
  /** Run once in a terminal to sign in. */
  loginCommand: string;
}

export interface StudioInfo {
  version: string;
  workspace: string;
  /** Every agent the helper knows, installed or not (older helpers only send `claude`). */
  agents?: AgentInfo[];
  defaultAgent?: string | null;
  claude?: {
    found: boolean;
    path: string | null;
    version: string | null;
    error?: string;
  } | null;
  allowBash: boolean;
  projects: ProjectSummary[];
  bridgePort: number;
  /** What this helper supports beyond the basics ("styles": project.json may have a style). */
  features?: string[];
}

export type ChatPart =
  | { type: "text"; text: string }
  | {
      type: "tool";
      id: string;
      name: string;
      summary: string;
      file?: string;
      status: "running" | "done" | "error";
      error?: string;
      /** Pictures the agent looked at in this step (project-relative paths). */
      images?: string[];
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  at: number;
  /** assistant: the agent that wrote it. */
  agent?: string;
  text?: string;
  parts?: ChatPart[];
  status?: "running" | "done" | "error" | "cancelled" | "queued";
  error?: string;
  costUsd?: number;
  durationMs?: number;
  attachments?: string[];
  /** Project files the user pointed Claude at with this message. */
  references?: ChatReference[];
}

export interface ChatReference {
  path: string;
  /** audio | image | video | font | other */
  kind: string;
}

export interface ChatHistory {
  sessionId: string | null;
  /** The agent the session belongs to. */
  agent?: string | null;
  messages: ChatMessage[];
  running: string | null;
}

/** Payload of `studio.project.open` and `studio.project` events. */
export interface ProjectPayload {
  slug: string;
  project: unknown;
  layers: unknown;
  layersHash: string | null;
  projectHash: string | null;
  issues: ValidationIssue[];
  scenes: string[];
  projectValid: boolean;
  layersValid: boolean;
}

export interface OpenProjectResult extends ProjectPayload {
  bundle: BundleSummary;
  assets: AssetEntry[];
  chat: ChatHistory;
  dir: string;
}

/** The open project as the page holds it (last valid project/layers + current issues). */
export interface StudioDoc {
  slug: string;
  project: StudioProject | null;
  layers: StudioLayers | null;
  layersHash: string | null;
  projectHash: string | null;
  issues: ValidationIssue[];
  scenes: string[];
  dir: string | null;
}

export interface LoadedModule {
  slug: string;
  revision: number;
  module: StudioModule;
}
