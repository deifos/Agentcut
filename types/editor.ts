import type { CompanionRecordingTelemetry } from "@/lib/companion-protocol";
import type { BackgroundSettings, CameraLayout } from "@/types/recording";

export interface FreezeSegment {
  id: string;
  sourceTime: number; // which video frame to hold (source seconds)
  timelineStartTime?: number; // assembled timeline position for multi-clip holds
  sourceClipId?: string;
  sourceAssetId?: string;
  duration: number; // how long to hold it (seconds, user-resizable, min 0.1s)
  kind?: "freeze" | "intermission";
  // Boundary anchoring for intermissions placed BETWEEN clips:
  //   undefined -> in-clip anchor (uses sourceClipId + sourceTime)
  //   string    -> anchored at the END of that clip's timeline range; survives
  //               trim/speed changes on either neighbor and re-links to the
  //               previous surviving clip if this one is removed
  //   null      -> anchored at the START of the timeline (before any clip)
  boundaryAfterClipId?: string | null;
}

export interface VideoAsset {
  id: string;
  blob: Blob;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  sourceKey: string;
  duration: number;
  width: number;
  height: number;
  hasAudio?: boolean;
  companionTelemetry?: CompanionRecordingTelemetry;
}

export interface TimelineClip {
  id: string;
  assetId: string;
  sourceStart: number;
  sourceEnd: number;
  sourceRemovedRanges?: SilenceRegion[];
  subtitleSkippedRanges?: SubtitleSkippedRange[];
  speed: number;
  deleted?: boolean;
  muted?: boolean;
  cameraHidden?: boolean;
  cameraLayout?: CameraLayout;
  background?: BackgroundSettings;
}

export interface TimelineClipRange {
  clip: TimelineClip;
  index: number;
  timelineStart: number;
  timelineEnd: number;
}

export interface TimelineSourcePosition {
  clip: TimelineClip;
  clipIndex: number;
  assetId: string;
  sourceTime: number;
  clipTimelineStart: number;
  clipTimelineEnd: number;
}

export type DragType = "playhead" | "cutpoint" | null;

export interface SilenceRegion {
  startTime: number;
  endTime: number;
}

export interface SubtitleSkippedRange extends SilenceRegion {
  skipId: string;
}

export interface ZoomKeyframe {
  id: string;
  timestamp: number; // when zoom reaches full scale
  timelineTimestamp?: number; // output timeline hold start for freeze-aware timing
  scale: number; // 1.5 = 50% zoom, 2.0 = 2x zoom
  panX: number; // 0-1 normalized horizontal pan (0.5 = center)
  panY: number; // 0-1 normalized vertical pan (0.5 = center)
  duration: number; // seconds to hold at full zoom
  easeIn: number; // seconds to ramp up to full scale
  easeOut: number; // seconds to ramp back to 1x
  follow?: ZoomFollowPath;
}

export interface ZoomFollowPoint {
  id: string;
  progress: number; // 0-1 position inside the full-zoom hold
  panX: number; // 0-1 normalized horizontal focus
  panY: number; // 0-1 normalized vertical focus
}

export interface ZoomFollowPath {
  source: "cursor" | "manual";
  points: ZoomFollowPoint[];
}

export interface BlurRegion {
  id: string;
  startTime: number;
  endTime: number;
  timelineStartTime?: number; // output timeline start for freeze-aware timing
  timelineEndTime?: number; // output timeline end for freeze-aware timing
  x: number; // 0-1 normalized
  y: number;
  width: number;
  height: number;
  intensity: number; // 50-100
}

export type AnimationSoundEffectMode = "off" | "auto" | "custom";

export type AnimationSoundEffectPhase = "entrance" | "exit";

export interface AnimationSoundEffectBinding {
  mode: AnimationSoundEffectMode;
  effectId?: string;
  volume: number; // 0-1
  offsetMs: number; // preview/export timing nudge
}

export interface AnimationSoundEffectSet {
  entrance?: AnimationSoundEffectBinding;
  exit?: AnimationSoundEffectBinding;
}

export type ImageWaypointSoundEffectMode = "off" | "repeat-entrance" | "custom";

export interface ImageWaypointSoundEffect {
  mode: ImageWaypointSoundEffectMode;
  effectId?: string;
  volume: number; // 0-1 multiplier for each waypoint hit
}

export interface LegacyAnimationSoundEffectBinding extends AnimationSoundEffectBinding {
  trigger?: AnimationSoundEffectPhase;
}

export const DEFAULT_ANIMATION_SOUND_EFFECT_BINDING: AnimationSoundEffectBinding =
  {
    mode: "off",
    volume: 0.8,
    offsetMs: 0,
  };

export const DEFAULT_ANIMATION_SOUND_EFFECT: AnimationSoundEffectSet = {
  entrance: DEFAULT_ANIMATION_SOUND_EFFECT_BINDING,
  exit: DEFAULT_ANIMATION_SOUND_EFFECT_BINDING,
};

export const DEFAULT_IMAGE_WAYPOINT_SOUND_EFFECT: ImageWaypointSoundEffect = {
  mode: "off",
  volume: 0.65,
};

export type TextAnimationPreset =
  | "none"
  | "fade"
  | "fade-in"
  | "fade-out"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "staggered-up"
  | "staggered-down"
  | "zoom-in"
  | "zoom-out"
  | "pop"
  | "typewriter"
  | "elastic"
  | "explode"
  | "particle-implode"
  | "particle-explode"
  | "scramble"
  | "blur-in"
  | "gradient";

export type TextOverlayLayoutMode = "freeform" | "corner-wrap";

export type TextOverlayCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface TextOverlay {
  id: string;
  text: string;
  startTime: number; // source time for clip-linked overlays
  timelineStartTime?: number; // output timeline time for intermission/title-card text
  duration: number; // hold duration in seconds
  easeIn: number; // entry animation duration
  easeOut: number; // exit animation duration
  exitAnimationEnabled?: boolean; // when false, easeOut folds into hold — no exit animation plays
  x: number; // 0-1 normalized
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number; // px (24-480)
  color: string; // hex
  borderColor: string; // text stroke color
  borderWidth: number; // 0-12 px
  shadowBlur: number; // 0-160 px
  shadowOpacity: number; // 0-1
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundOpacity: number; // 0-1, background only
  backgroundPaddingX: number; // px
  backgroundPaddingY: number; // px
  backgroundBorderRadius: number; // px
  backgroundBlur: number; // px, backdrop-style blur
  animation: TextAnimationPreset;
  gradientColors?: string[]; // hex colors for gradient animation
  layoutMode: TextOverlayLayoutMode;
  frameCorner: TextOverlayCorner;
  frameInset: number; // 0-20 (% of frame min dimension)
  frameTopSpan: number; // 20-100 (% of frame width)
  frameSideSpan: number; // 20-100 (% of frame height)
  frameBandThickness: number; // 6-40 (% of frame min dimension)
  frameProgress: number; // 0-1 progress along the chosen frame corner path
  soundEffect?: AnimationSoundEffectSet;
}

// Image overlay — logo / brand mark placed on the composition with its own
// entrance/exit animation. Mirrors TextOverlay timing/layout semantics so the
// shared animation engine can drive both.
export interface ImageOverlay {
  id: string;
  src: string; // data: URL (base64), self-contained for preset round-tripping
  startTime: number; // source time for clip-linked overlays
  timelineStartTime?: number; // output timeline time for intermission overlays
  duration: number; // hold duration in seconds
  easeIn: number;
  easeOut: number;
  exitAnimationEnabled?: boolean;
  x: number; // 0-1 normalized (top-left corner)
  y: number;
  width: number; // 0-1 normalized
  height: number;
  fit: "contain" | "cover" | "fill";
  borderRadius: number; // px
  shadowBlur: number; // px
  shadowOpacity: number; // 0-1
  rotation?: number; // radians — static tilt applied to the overlay
  spin?: boolean; // when true, the entrance adds a full spin on top of the preset
  animation:
    | "none"
    | "fade"
    | "fade-in"
    | "fade-out"
    | "slide-up"
    | "slide-down"
    | "slide-left"
    | "slide-right"
    | "zoom-in"
    | "pop"
    | "jumpy";
  // Ordered stops the image hops through during the entrance when the
  // animation is "jumpy". Normalized 0-1 composition coordinates; the final
  // rest position is the overlay's own x/y and is not stored here.
  entranceWaypoints?: Array<{ x: number; y: number }>;
  soundEffect?: AnimationSoundEffectSet;
  waypointSoundEffect?: ImageWaypointSoundEffect;
}

export type CameraBackgroundMode =
  | "none"
  | "blur-portrait"
  | "blur-strong"
  | "image";

/**
 * Camera background treatment applied after recording. Blur modes only need
 * `mode`; image mode carries the picked image's id + src so presets can
 * round-trip without the option list.
 */
export interface CameraBackgroundSettings {
  mode: CameraBackgroundMode;
  imageId?: string;
  imageSrc?: string;
}

export interface CameraOverlay {
  id: string;
  src: string;
  blob?: Blob;
  sourceAssetId?: string;
  layout?: CameraLayout;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceOffset?: number; // seconds into the camera source at screen time 0
  duration?: number; // seconds of usable camera source
  frameAspectRatio?: number; // rendered camera frame width / height; defaults to 1 for older square overlays
  borderRadius: number; // 0-50% (50 = fully circular)
  borderWidth: number;
  borderColor: string;
  shadowIntensity: number;
  glassBorder?: boolean;
  autoFraming?: boolean;
  screenFit?: "contain" | "cover";
  cursorFollowScreenZoom?: boolean;
  mirrored?: boolean;
  hidden?: boolean;
  background?: CameraBackgroundSettings;
}

export type CameraOverlayPreset = Omit<CameraOverlay, "src" | "blob"> & {
  src?: string;
};

// Spotlight border effect styles
export type SpotlightBorderEffect = "none" | "traveling-light" | "neon-pulse";

type LegacySpotlightBorderEffect =
  | "subtle-glow"
  | "strong-glow"
  | "clean-border";

export function normalizeSpotlightBorderEffect(
  effect: SpotlightBorderEffect | LegacySpotlightBorderEffect | undefined,
): SpotlightBorderEffect {
  if (!effect || effect === "strong-glow") {
    return "neon-pulse";
  }

  if (effect === "subtle-glow" || effect === "clean-border") {
    return "none";
  }

  return effect;
}

export const SPOTLIGHT_BORDER_EFFECTS: {
  value: SpotlightBorderEffect;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "traveling-light", label: "Traveling Light" },
  { value: "neon-pulse", label: "Neon Pulse" },
];

// Spotlight effect for app-demo style zoom + dim
export interface SpotlightEffect {
  id: string;
  startTime: number; // when effect begins (hold start)
  timelineStartTime?: number; // output timeline hold start for freeze-aware timing
  sourceClipId?: string; // timeline clip this effect was authored against in multi-clip timelines
  sourceAssetId?: string; // source asset this effect was authored against in multi-clip timelines
  duration: number; // hold duration at full spotlight
  easeIn: number; // global zoom + dim transition in
  easeOut: number; // undim + global zoom out transition
  // Zoom 1: Global zoom (whole screen)
  globalScale: number; // e.g. 1.1x - subtle zoom on entire recording
  globalPanX: number; // 0-1, auto-centered on spotlight region
  globalPanY: number; // 0-1, auto-centered on spotlight region
  // Zoom 2: Spotlight zoom (selected area magnification)
  spotlightScale: number; // e.g. 1.05x - additional zoom within the spotlight
  spotlightX: number; // 0-1 normalized (region center X)
  spotlightY: number; // 0-1 normalized (region center Y)
  spotlightWidth: number; // 0-1 normalized
  spotlightHeight: number; // 0-1 normalized
  // Visual
  dimOpacity: number; // 0-1 (e.g. 0.6)
  dimColor: string;
  borderRadius: number; // px for spotlight cutout corners
  glowColor: string; // e.g. "rgba(255, 255, 255, 0.6)"
  glowIntensity: number; // 0-100
  borderEffect: SpotlightBorderEffect;
  travelDistance: number; // 0-100 (% of default pop-out travel)
  tilt: number; // 0-30 degrees perspective tilt (rotateX)
  dofEnabled: boolean;
  dofMode: "dir" | "radial";
  dofBlur: number;
  dofFocusX: number;
  dofFocusY: number;
  dofFocusAngle: number;
  dofFocusSize: number;
  dofFeather: number;
}

export const DEFAULT_SPOTLIGHT_SETTINGS = {
  globalScale: 1.0,
  spotlightScale: 1.0,
  duration: 2.0,
  easeIn: 0.6,
  easeOut: 0.6,
  dimOpacity: 0.6,
  dimColor: "#000000",
  borderRadius: 12,
  glowColor: "rgba(255, 255, 255, 0.6)",
  glowIntensity: 50,
  borderEffect: "neon-pulse" as SpotlightBorderEffect,
  travelDistance: 100,
  tilt: 0,
  dofEnabled: false,
  dofMode: "radial" as const,
  dofBlur: 12,
  dofFocusX: 50,
  dofFocusY: 42,
  dofFocusAngle: 320,
  dofFocusSize: 30,
  dofFeather: 18,
};

// Tap marker — animated demo cue (circle, hand, pulse) placed at a point in
// time + space. Any variant can be given optional endpoints (endX/endY) to
// animate along a path; without endpoints it renders as a point event.
// These variants describe editor animation cues, not live recording input.
export type TapMarkerVariant = "tap" | "hand-tap" | "pulse";

export const TAP_MARKER_VARIANT_OPTIONS: {
  value: TapMarkerVariant;
  label: string;
}[] = [
  { value: "tap", label: "Circle (ripple)" },
  { value: "hand-tap", label: "Hand emoji" },
  { value: "pulse", label: "Pulse wave" },
];

export interface TapMarker {
  id: string;
  variant: TapMarkerVariant;
  timestamp: number; // source time when the tap animation starts (seconds)
  timelineTimestamp?: number; // output timeline time for freeze-aware timing
  sourceClipId?: string; // timeline clip this marker belongs to in multi-clip timelines
  sourceAssetId?: string; // source asset this marker belongs to in multi-clip timelines
  x: number; // 0-1 normalized horizontal position on composition
  y: number; // 0-1 normalized vertical position on composition
  // Endpoint for "swipe" variant — ignored for tap/hand-tap/pulse.
  endX?: number;
  endY?: number;
  duration: number; // total animation length in seconds
  color: string; // hex/rgba used for ripple ring + pulse fill
  size: number; // base radius in px at composition dimensions
  // Rotation in radians applied to the hand glyph around the fingertip.
  // 0 = finger pointing up (default). Only affects hand-tap.
  rotation?: number;
  // Overall opacity multiplier (0-1, default 1). Applied on top of the
  // variant's built-in alpha curves.
  opacity?: number;
  // When a path is set, whether to draw the dotted trail behind the marker.
  // Default true. Ignored for point-event (no-path) markers.
  trail?: boolean;
  // Single sound effect binding fired at the marker's start time. Tap
  // markers don't have separate entrance/exit phases, so a single
  // binding (off / auto / custom) is enough.
  soundEffect?: AnimationSoundEffectBinding;
}

export const DEFAULT_TAP_MARKER_SETTINGS = {
  variant: "tap" as TapMarkerVariant,
  duration: 1.1,
  // Fingertip-sized touch target on a 1080px reference composition.
  // Color is fully opaque — translucency is controlled via `opacity` so the
  // slider is the single source of truth.
  color: "#ffffff",
  size: 48,
};

// Clip position animations
export type ClipAnimation =
  | "none"
  | "fade"
  | "iris"
  | "slide-left"
  | "slide-right"
  | "slide-top"
  | "slide-bottom";

export type ClipCameraMove =
  | "none"
  | "close-up"
  | "pan-up"
  | "pan-down"
  | "pan-left"
  | "pan-right"
  | "push-in"
  | "pull-out";

export type ClipCameraPathMove = Exclude<ClipCameraMove, "none">;

export interface ClipCameraPathStep {
  id: string;
  move: ClipCameraPathMove;
  strength: number;
  /** Optional Motion Shot-style target within the source clip. */
  focusX?: number;
  focusY?: number;
  /** Absolute zoom reached at a focus target. */
  zoom?: number;
}

export const CLIP_CAMERA_MOVE_OPTIONS: {
  value: ClipCameraMove;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "close-up", label: "Close Up" },
  { value: "pan-up", label: "Pan Up" },
  { value: "pan-down", label: "Pan Down" },
  { value: "pan-left", label: "Pan Left" },
  { value: "pan-right", label: "Pan Right" },
  { value: "push-in", label: "Push In" },
  { value: "pull-out", label: "Pull Out" },
];

export const CLIP_ANIMATION_OPTIONS: { value: ClipAnimation; label: string }[] =
  [
    { value: "none", label: "None" },
    { value: "fade", label: "Fade In" },
    { value: "iris", label: "Circle Reveal" },
    { value: "slide-left", label: "Slide from Left" },
    { value: "slide-right", label: "Slide from Right" },
    { value: "slide-top", label: "Slide from Top" },
    { value: "slide-bottom", label: "Slide from Bottom" },
  ];

export const CLIP_EXIT_ANIMATION_OPTIONS: {
  value: ClipAnimation;
  label: string;
}[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade Out" },
  { value: "iris", label: "Circle Close" },
  { value: "slide-left", label: "Slide to Left" },
  { value: "slide-right", label: "Slide to Right" },
  { value: "slide-top", label: "Slide to Top" },
  { value: "slide-bottom", label: "Slide to Bottom" },
];

// Clip position segment for animated clip positioning
export interface ClipPositionSegment {
  id: string;
  startTime: number; // seconds - when this position begins
  timelineStartTime?: number; // output timeline hold start for freeze-aware timing
  sourceClipId?: string; // timeline clip this segment belongs to in multi-clip timelines
  sourceAssetId?: string; // source asset this segment belongs to in multi-clip timelines
  duration: number; // seconds - hold duration
  easeIn: number; // seconds - entrance animation duration
  easeOut: number; // seconds - exit animation duration
  offsetX: number; // % offset from center (-50 to 50)
  offsetY: number; // % offset from center (-50 to 50)
  scale: number; // shot scale (1-3)
  endOffsetX?: number; // optional end % offset for camera move presets
  endOffsetY?: number; // optional end % offset for camera move presets
  endScale?: number; // optional end shot scale for camera move presets
  cameraMove?: ClipCameraMove;
  cameraMoveSpeed?: number; // 1 = default drift, higher = wider/faster move
  cameraPath?: ClipCameraPathStep[]; // ordered moves across the held segment
  tiltY: number; // degrees Y-axis rotation (-45 to 45)
  tiltX: number; // degrees X-axis rotation (-45 to 45)
  entrance: ClipAnimation;
  exit: ClipAnimation;
  dofEnabled: boolean;
  dofMode: "dir" | "radial";
  dofBlur: number;
  dofFocusX: number;
  dofFocusY: number;
  dofFocusAngle: number;
  dofFocusSize: number;
  dofFeather: number;
  soundEffect?: AnimationSoundEffectSet;
}

export const DEFAULT_CLIP_POSITION_SETTINGS = {
  duration: 3.0,
  easeIn: 0.8,
  easeOut: 0.8,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  cameraMove: "none" as ClipCameraMove,
  cameraMoveSpeed: 1,
  cameraPath: [] as ClipCameraPathStep[],
  tiltY: 0,
  tiltX: 0,
  entrance: "none" as ClipAnimation,
  exit: "none" as ClipAnimation,
  dofEnabled: false,
  dofMode: "radial" as const,
  dofBlur: 12,
  dofFocusX: 50,
  dofFocusY: 42,
  dofFocusAngle: 320,
  dofFocusSize: 30,
  dofFeather: 18,
};

// Music clip on the timeline
export interface MusicClip {
  id: string;
  trackId: string; // references MusicTrack.id
  trackName: string; // display name
  filename: string; // audio file name for URL resolution
  sourceUrl?: string; // session-only object URL for a user-uploaded custom track
  isCustom?: boolean;
  trackDuration: number; // total duration of source track (seconds)
  videoTime: number; // position on video timeline (seconds)
  sourceOffset: number; // offset into source audio file (seconds)
  duration: number; // clip length (seconds)
  volume: number; // 0-1
  audioBlob?: Blob; // export-time resolved custom audio; not stored in presets
}

// ── AI Subtitles ──

export interface WordTimestamp {
  text: string;
  timestamp: [number, number]; // [start, end] in seconds
  sourceAssetId?: string;
  sourceClipId?: string;
  sourceTimestamp?: [number, number]; // [start, end] in source-asset seconds
}

export interface TranscriptSegment {
  message: string;
  start: number; // ms from start
  end: number; // ms from start
  words?: WordTimestamp[];
  sourceAssetId?: string;
  sourceClipId?: string;
  /** Timeline-anchored voiceover clip that owns this subtitle. */
  voiceoverClipId?: string;
  hidden?: boolean; // hide but keep in video
  skipped?: boolean; // omit the matching video range while retaining this row
  videoSkipId?: string; // links the row to its reversible clip exclusions
}

export type VoiceoverClipSourceType =
  | "manual"
  | "transcript"
  | "recorded-microphone"
  | "companion-microphone"
  | "companion-system-audio"
  /** Audio an agent brought in from outside ScreenSlick (its own TTS take). */
  | "imported-audio";

export interface VoiceoverClip {
  id: string;
  text: string;
  voice: string;
  speed: number;
  provider?: "local" | "gemini";
  style?: string;
  direction?: string;
  audioStorageKey?: string;
  audioMimeType?: string;
  videoTimeMs: number; // playback start on the video timeline
  durationMs: number; // synthesized audio length
  audioUrl: string; // object URL for the WAV blob; empty if needs (re)gen
  createdAt: number;
  sourceType?: VoiceoverClipSourceType;
  sourceStartMs?: number;
  sourceOffsetMs?: number;
  /**
   * True when the clip was hydrated from a preset/autosave and still needs
   * its audio synthesized before it can play.
   */
  needsRegen?: boolean;
}

/**
 * Serializable subset of VoiceoverClip used for presets and autosave. Blobs
 * and object URLs can't survive JSON, so only the parameters needed to
 * re-synthesize are stored.
 */
export interface VoiceoverClipStub {
  id: string;
  text: string;
  voice: string;
  speed: number;
  provider?: "local" | "gemini";
  style?: string;
  direction?: string;
  audioStorageKey?: string;
  audioMimeType?: string;
  videoTimeMs: number;
  durationMs: number;
  sourceType?: VoiceoverClipSourceType;
  sourceStartMs?: number;
  sourceOffsetMs?: number;
}

export interface SubtitleStyle {
  backgroundColor: string;
  textColor: string;
  activeWordColor: string;
  borderRadius: number; // 0-20 px
  mode: "phrase" | "word";
  fontFamily: string;
  fontSize: number; // scale factor (1.0 = 24px on a 640px-wide composition)
  position: "bottom" | "middle" | "top";
  showBackground: boolean;
  textBorder: boolean;
  textBorderColor: string;
  textBorderWidth: number; // 1-2 px
  textShadow: boolean;
  textShadowBlur: number; // 0-10 px
  maxWordsPerLine: number; // 3-20
}

export const SUBTITLE_BASE_FONT_SIZE_PX = 24;

export const SUBTITLE_FONTS = [
  { name: "Poppins", value: "Poppins, sans-serif" },
  { name: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
  { name: "Archivo Black", value: "'Archivo Black', sans-serif" },
  { name: "Bungee", value: "Bungee, sans-serif" },
  { name: "Righteous", value: "Righteous, sans-serif" },
  { name: "Bangers", value: "Bangers, sans-serif" },
  { name: "Fredoka One", value: "'Fredoka One', sans-serif" },
  { name: "Titan One", value: "'Titan One', sans-serif" },
  { name: "Permanent Marker", value: "'Permanent Marker', cursive" },
  { name: "Pacifico", value: "Pacifico, cursive" },
  { name: "Anton", value: "Anton, sans-serif" },
  { name: "Russo One", value: "'Russo One', sans-serif" },
  { name: "Lobster", value: "Lobster, cursive" },
  { name: "Black Ops One", value: "'Black Ops One', sans-serif" },
  { name: "Alfa Slab One", value: "'Alfa Slab One', sans-serif" },
  { name: "Staatliches", value: "Staatliches, sans-serif" },
  { name: "Fugaz One", value: "'Fugaz One', sans-serif" },
  { name: "Chewy", value: "Chewy, sans-serif" },
] as const;

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  textColor: "#ffffff",
  activeWordColor: "#fbbf24",
  borderRadius: 8,
  mode: "phrase",
  fontFamily: "Poppins, sans-serif",
  fontSize: 1.0,
  position: "bottom",
  showBackground: true,
  textBorder: false,
  textBorderColor: "#000000",
  textBorderWidth: 2,
  textShadow: true,
  textShadowBlur: 4,
  maxWordsPerLine: 6,
};
