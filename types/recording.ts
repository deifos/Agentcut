import type { CompanionRecordingTelemetry } from "@/lib/companion-protocol";
import type {
  Device3DArrangement,
  Device3DMotion,
} from "@/lib/device-stage/types";
import type { AnimationSoundEffectSet } from "@/types/editor";
import { DEFAULT_ANIMATION_SOUND_EFFECT } from "@/types/editor";

// Recording modes
export type RecordingMode = "screen-and-camera" | "screen-demo";

// Aspect ratio
export type AspectRatio = "16:9" | "9:16" | "1:1";

export type LandscapeCameraLayout =
  | "overlay"
  | "side-by-side-left"
  | "side-by-side-right"
  | "stacked-camera-top"
  | "stacked-camera-bottom"
  | "camera-fullscreen";

export type PortraitCameraLayout =
  | "stacked-camera-top"
  | "stacked-camera-bottom"
  | "portrait-cursor-follow"
  | "portrait-cursor-follow-screen-bottom"
  | "portrait-overlay"
  | "camera-fullscreen";

// Camera position for overlay mode
export type CameraPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface CameraOffset {
  x: number;
  y: number;
}

export type CameraLayout = LandscapeCameraLayout | PortraitCameraLayout;

// Background settings for canvas compositing
export interface DynamicBackgroundSettings {
  preset: string;
  colors: [string, string, string, string];
  speed: number; // 0.1–1.0
  blur: number; // 10–80
  beatReactive?: boolean;
}

export const DYNAMIC_BACKGROUND_PRESETS: Record<
  string,
  {
    name: string;
    colors: [string, string, string, string];
    speed: number;
    blur: number;
  }
> = {
  lava: {
    name: "Lava",
    colors: ["#ff2200", "#ff6600", "#ffcc00", "#ff4400"],
    speed: 0.3,
    blur: 50,
  },
  aurora: {
    name: "Aurora",
    colors: ["#00ff88", "#0066ff", "#8800ff", "#00ffcc"],
    speed: 0.2,
    blur: 60,
  },
  sunset: {
    name: "Sunset",
    colors: ["#ff4466", "#ff8844", "#ffcc22", "#cc2266"],
    speed: 0.25,
    blur: 55,
  },
  ocean: {
    name: "Ocean",
    colors: ["#003366", "#0066cc", "#0099ff", "#00ccff"],
    speed: 0.15,
    blur: 60,
  },
  neon: {
    name: "Neon",
    colors: ["#ff00ff", "#00ffff", "#ff0088", "#8800ff"],
    speed: 0.35,
    blur: 45,
  },
  minimal: {
    name: "Minimal",
    colors: ["#333333", "#555555", "#888888", "#444444"],
    speed: 0.1,
    blur: 70,
  },
  cloud: {
    name: "Cloud",
    colors: ["#ffffff", "#dff2ff", "#c9e7ff", "#f4f8ff"],
    speed: 0.12,
    blur: 72,
  },
  sorbet: {
    name: "Sorbet",
    colors: ["#fff6fb", "#ffd8ea", "#ffd7b8", "#ffeeb8"],
    speed: 0.18,
    blur: 68,
  },
  mint: {
    name: "Mint",
    colors: ["#f7fff9", "#dcfff1", "#d9f7ff", "#f4ffe0"],
    speed: 0.16,
    blur: 70,
  },
};

export interface GradientBackgroundSettings {
  preset: string;
  colors: [string, string, string, string];
  angle: number; // 0–360
  type: "linear" | "radial" | "mesh";
}

export const GRADIENT_BACKGROUND_PRESETS: Record<
  string,
  {
    name: string;
    colors: [string, string, string, string];
    angle: number;
    type: "linear" | "radial" | "mesh";
  }
> = {
  warm: {
    name: "Warm",
    colors: ["#ff6b35", "#f7931e", "#ffd166", "#ef476f"],
    angle: 135,
    type: "mesh",
  },
  cool: {
    name: "Cool",
    colors: ["#0077b6", "#00b4d8", "#90e0ef", "#023e8a"],
    angle: 225,
    type: "mesh",
  },
  sunset: {
    name: "Sunset",
    colors: ["#ff006e", "#fb5607", "#ffbe0b", "#8338ec"],
    angle: 160,
    type: "mesh",
  },
  forest: {
    name: "Forest",
    colors: ["#2d6a4f", "#40916c", "#74c69d", "#1b4332"],
    angle: 180,
    type: "mesh",
  },
  berry: {
    name: "Berry",
    colors: ["#7b2cbf", "#c77dff", "#e0aaff", "#5a189a"],
    angle: 135,
    type: "mesh",
  },
  mono: {
    name: "Mono",
    colors: ["#212529", "#495057", "#adb5bd", "#343a40"],
    angle: 145,
    type: "mesh",
  },
  cotton: {
    name: "Cotton",
    colors: ["#fffdf8", "#ffe3f1", "#dff3ff", "#f4efff"],
    angle: 140,
    type: "mesh",
  },
  daylight: {
    name: "Daylight",
    colors: ["#ffffff", "#dff1ff", "#b8e8ff", "#fff7d6"],
    angle: 120,
    type: "linear",
  },
  gelato: {
    name: "Gelato",
    colors: ["#fff7f2", "#ffd9d9", "#dfffdc", "#dce7ff"],
    angle: 155,
    type: "mesh",
  },
};

export interface BackgroundSettings {
  id: string; // preset ID, 'none', 'dynamic', or 'gradient'
  padding: number; // 0-50
  borderRadius: number; // 0-50
  shadowIntensity: number; // 0-100
  backgroundBlur: number; // 0-40
  glassBorder: number; // 0-20
  clipOffsetX: number; // -50 to 50
  clipOffsetY: number; // -50 to 50
  clipTilt: number; // rotateY, -45 to 45
  clipTiltX: number; // rotateX, -45 to 45
  clipEntrance?: string; // ClipAnimation — global intro animation
  clipExit?: string; // ClipAnimation — global outro animation
  clipAnimationDuration?: number; // seconds — entrance/exit duration
  clipSoundEffect?: AnimationSoundEffectSet;
  cinematicFadesEnabled?: boolean;
  customImage?: string; // data URL
  solidBackgroundColor?: string;
  dynamicBackground?: DynamicBackgroundSettings;
  gradientBackground?: GradientBackgroundSettings;
  mockupId?: string; // device mockup ID from lib/mockups.ts
  mockupOrientation?: "portrait" | "landscape";
  /** Camera orbit elevation in degrees (-60 to 80). Positive looks down. */
  mockup3dRotationX?: number;
  /** Camera orbit turn in degrees (any value). Positive shows the left side. */
  mockup3dRotationY?: number;
  /** Camera roll in degrees (-30 to 30). */
  mockup3dRoll?: number;
  /** Camera zoom, 1 frames the whole device (0.5 to 4.5). */
  mockup3dZoom?: number;
  /** Lens field of view in degrees (10 to 70). */
  mockup3dFov?: number;
  /** Camera shift across the frame, -0.5 to 0.5 of the frame. */
  mockup3dPanX?: number;
  mockup3dPanY?: number;
  /** Aim point on the device screen, 0-1 from the screen's top-left. */
  mockup3dTargetU?: number;
  mockup3dTargetV?: number;
  /** Depth of field amount, 0-1. */
  mockup3dDepth?: number;
  /** Focus point on the device screen, 0-1 from the screen's top-left. */
  mockup3dFocusU?: number;
  mockup3dFocusV?: number;
  /** Device pose in the scene (degrees), set by shot presets. */
  mockup3dPoseX?: number;
  mockup3dPoseY?: number;
  mockup3dPoseZ?: number;
  mockup3dMotion?: Device3DMotion;
  mockup3dMotionDuration?: number; // seconds per motion cycle or intro
  mockup3dMotionIntensity?: number; // 0-1
  /** Laptop lid opening in degrees (60 to 135). */
  mockup3dLidAngle?: number;
  mockup3dArrangement?: Device3DArrangement;
  /** Key light angle in degrees (-90 left to 90 right). Unset = automatic. */
  mockup3dLightAngle?: number;
  /** Key light height in degrees (0-85). Unset = automatic. */
  mockup3dLightHeight?: number;
  /** Key light strength multiplier (0-2). */
  mockup3dLightIntensity?: number;
  /** Key light color. Unset = scene/default color. */
  mockup3dLightColor?: string;
  /** Rim (back) light strength multiplier (0-2). */
  mockup3dRimIntensity?: number;
  /** Rim light color. Unset = scene/default color. */
  mockup3dRimColor?: string;
  /** Overall brightness of the device (0.5-1.5). */
  mockup3dExposure?: number;
  /** Device shadow strength 0-100. Unset follows the background shadow. */
  mockup3dShadowStrength?: number;
  /** Device shadow softness 0-100. */
  mockup3dShadowSoftness?: number;
  /** How far the device sits from the surface it shadows, 0-100. */
  mockup3dShadowDistance?: number;
  /** Colored glow behind the device, 0-100. */
  mockup3dGlow?: number;
  mockup3dGlowColor?: string;
  /** Last lighting preset applied from the Devices panel. */
  mockup3dLightPreset?: string;
  /** Last shot preset applied from the Devices panel. */
  mockup3dPreset?: string;
  /** @deprecated legacy camera distance (70-280 percent); use mockup3dZoom. */
  mockup3dDistance?: number;
  studioScene?: StudioSceneSettings;
  glowEnabled?: boolean;
  glowColor?: string; // any CSS color
  glowStrength?: number; // 0-100, drives both reach and punch
  glowReactive?: boolean; // pulse on detected music beats
}

export type StudioScenePreset =
  | "daylight"
  | "warm"
  | "midnight"
  | "diagonal-ray"
  | "midnight-ray"
  | "neon"
  | "golden-hour"
  | "aurora"
  | "poolside"
  | "botanical"
  | "stage"
  | "candy"
  | "loft";
export type StudioWindowLightDirection = "left" | "right";

export interface StudioSceneSettings {
  preset: StudioScenePreset;
  surfaceHeight: number; // 55-92 percent from the top of the composition
  shadowStrength: number; // 0-100
  windowLightEnabled: boolean;
  windowLightDirection: StudioWindowLightDirection;
  windowLightIntensity: number; // 0-100
  windowLightSoftness: number; // 0-100
  windowLightWarmth: number; // 0-100
  /** Ambient motion on/off (light drift, flicker, caustics, swaying leaves…). */
  windowLightDrift: boolean;
  /** Ambient motion speed, 0-100. */
  motionSpeed?: number;
  /** Accent color for scenes with colored light (neon, aurora, candy, stage). */
  accentColor?: string;
  /** Floating dust motes drifting through the light. */
  dust?: boolean;
}

export const DEFAULT_STUDIO_SCENE_SETTINGS: StudioSceneSettings = {
  preset: "daylight",
  surfaceHeight: 84,
  shadowStrength: 55,
  windowLightEnabled: true,
  windowLightDirection: "left",
  windowLightIntensity: 58,
  windowLightSoftness: 62,
  windowLightWarmth: 68,
  windowLightDrift: true,
  motionSpeed: 50,
  dust: false,
};

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  id: "none",
  padding: 0,
  borderRadius: 0,
  shadowIntensity: 30,
  backgroundBlur: 0,
  glassBorder: 0,
  clipOffsetX: 0,
  clipOffsetY: 0,
  clipTilt: 0,
  clipTiltX: 0,
  mockup3dRotationX: 0,
  mockup3dRotationY: 0,
  mockup3dMotion: "none",
  mockup3dMotionDuration: 6,
  studioScene: DEFAULT_STUDIO_SCENE_SETTINGS,
  clipSoundEffect: DEFAULT_ANIMATION_SOUND_EFFECT,
  cinematicFadesEnabled: true,
  solidBackgroundColor: "#111111",
  glowEnabled: false,
  glowColor: "#ff3b3b",
  glowStrength: 60,
  glowReactive: false,
};

// Watermark settings
export interface WatermarkSettings {
  enabled: boolean;
  imageSrc: string; // data URL
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size: number; // 5-30%
  opacity: number; // 0-1
  borderRadius: number; // 0-50
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: false,
  imageSrc: "",
  position: "bottom-right",
  size: 10,
  opacity: 0.9,
  borderRadius: 0,
};

// Camera style settings
export interface CameraStyle {
  borderRadius: number; // 0-50% (50 = fully circular)
  borderWidth: number; // 0-10px
  borderColor: string; // hex color
  shadowIntensity: number; // 0-100
}

export const DEFAULT_CAMERA_STYLE: CameraStyle = {
  borderRadius: 15,
  borderWidth: 0,
  borderColor: "#ffffff",
  shadowIntensity: 30,
};

// Recorded video data
export interface RecordedVideo {
  blob: Blob;
  url: string;
  timestamp: number;
  hasAudio: boolean;
  duration: number;
  width?: number;
  height?: number;
  frameRate?: number;
  companionTelemetry?: CompanionRecordingTelemetry;
  cameraLayer?: {
    blob: Blob;
    url: string;
    width?: number;
    height?: number;
    startOffsetMs?: number;
    duration?: number;
  };
}
