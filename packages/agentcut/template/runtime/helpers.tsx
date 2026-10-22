// The `agentcut` module that scenes import.
// Same animation helpers as video-studio's shared/anim.ts, plus asset URLs and
// browser-export-safe building blocks (SVG radial glows instead of CSS radial-gradient).
import { createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { Easing, interpolate, spring, staticFile, useRemotionEnvironment, type SpringConfig } from "remotion";
import type { StudioProject } from "./types";

export interface StudioRuntimeContextValue {
  project: StudioProject;
  variant: string;
  width: number;
  height: number;
  fps: number;
  assetBase: string;
  libraryBase: string;
}

const runtimeState: { fps: number; assetBase: string; libraryBase: string } = {
  fps: 30,
  assetBase: "",
  libraryBase: "",
};

/** Called by StudioComposition on every render so helpers work outside hooks too. */
export function setRuntimeState(next: { fps: number; assetBase: string; libraryBase: string }) {
  runtimeState.fps = next.fps;
  runtimeState.assetBase = next.assetBase;
  runtimeState.libraryBase = next.libraryBase;
}

export const StudioRuntimeContext = createContext<StudioRuntimeContextValue | null>(null);

/** Project size, fps and variant for the frame being drawn. */
export function useStudio(): StudioRuntimeContextValue {
  const value = useContext(StudioRuntimeContext);
  if (!value) throw new Error("useStudio() must be used inside a Studio composition.");
  return value;
}

/**
 * Live preview vs. final pixels. The Player has to draw 30 frames a second on the page's
 * main thread; captures and the export can take as long as they need. Heavy scenes (three.js,
 * big canvases) should draw cheaper in the preview: lower pixel ratio, smaller shadow maps,
 * redraw canvas textures less often. Captures and the export always get full quality.
 */
export function usePreviewQuality() {
  const env = useRemotionEnvironment();
  const isPreview = env.isPlayer && !env.isRendering;
  return {
    isPreview,
    /** For renderer.setPixelRatio() / canvas resolution. */
    pixelRatio: isPreview ? 0.5 : 1,
    /** For light.shadow.mapSize. */
    shadowMapSize: isPreview ? 512 : 2048,
    /** Redraw expensive canvas textures every Nth frame in the preview. */
    textureEvery: isPreview ? 2 : 1,
  };
}

/** True when the composition is drawn in a tall (9:16-like) variant. */
export function useIsVertical() {
  const { width, height } = useStudio();
  return height > width;
}

function joinUrl(base: string, path: string) {
  if (base.startsWith("static:")) {
    // Local Remotion render: files come from the render's public dir.
    const prefix = base.slice("static:".length).replace(/^\/+|\/+$/g, "");
    return staticFile(prefix ? `${prefix}/${path.replace(/^\/+/, "")}` : path.replace(/^\/+/, ""));
  }
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${cleanBase}/${cleanPath}`;
}

/**
 * Resolve a project file to a URL.
 * - `assets/voice.wav` → this project's folder
 * - `library:sfx/whoosh.wav` → the workspace library
 * - `https://…` → unchanged
 */
export function asset(src: string): string {
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith("library:")) {
    return joinUrl(runtimeState.libraryBase, src.slice("library:".length));
  }
  return joinUrl(runtimeState.assetBase, src);
}

// ---------------------------------------------------------------------------
// Animation helpers (frame-based, same names as video-studio's shared/anim.ts)

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0→1 progress between two frames with an easing curve (clamped). */
export const ease = (
  frame: number,
  from: number,
  to: number,
  easing: (t: number) => number = Easing.inOut(Easing.cubic),
) => interpolate(frame, [from, Math.max(from + 0.0001, to)], [0, 1], { ...clamp, easing });

export const SPRING = {
  smooth: { damping: 200 },
  snappy: { damping: 20, stiffness: 200 },
  bouncy: { damping: 11, stiffness: 140 },
  pop: { damping: 9, stiffness: 180, mass: 0.7 },
  land: { damping: 14, stiffness: 150, mass: 0.9 },
} satisfies Record<string, Partial<SpringConfig>>;

/** Spring that starts at `start` (same frame basis as `frame`), at the project's fps. */
export const sp = (
  frame: number,
  start: number,
  config: Partial<SpringConfig> = SPRING.snappy,
  durationInFrames?: number,
) => spring({ frame: frame - start, fps: runtimeState.fps, config, durationInFrames });

/** Seconds → frames at the project's fps. */
export const sec = (seconds: number) => Math.round(seconds * runtimeState.fps);

// ---------------------------------------------------------------------------
// Browser-export-safe building blocks

export interface RadialGlowProps {
  /** Center, as fractions of the box (0..1). Default 0.5 / 0.5. */
  x?: number;
  y?: number;
  /** Radius as a fraction of the box's larger side. Default 0.6. */
  radius?: number;
  color: string;
  /** Opacity at the center. Default 1. */
  opacity?: number;
  /** Where the glow reaches 0 (0..1 of the radius). Default 1. */
  falloff?: number;
  style?: CSSProperties;
}

/**
 * A radial glow drawn with SVG. Use instead of CSS `radial-gradient`, which the
 * browser export cannot draw.
 */
export function RadialGlow({
  x = 0.5,
  y = 0.5,
  radius = 0.6,
  color,
  opacity = 1,
  falloff = 1,
  style,
}: RadialGlowProps) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }}
    >
      <defs>
        <radialGradient
          id={`glow-${id}`}
          cx={x * 100}
          cy={y * 100}
          r={radius * 100}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={color} stopOpacity={opacity} />
          <stop offset={Math.max(0.01, Math.min(1, falloff))} stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#glow-${id})`} />
    </svg>
  );
}

/** Absolutely positioned box in frame fractions (0..1). */
export function FrameBox({
  x = 0,
  y = 0,
  width = 1,
  height = 1,
  style,
  children,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type {
  AudioClip,
  Box,
  CaptionWord,
  ClipAnim,
  SceneProps,
  StudioClip,
  StudioLayers,
  StudioProject,
  StudioTrack,
  TextStyle,
} from "./types";
