/**
 * Shared settings for the 3D device stage (phones and laptops).
 *
 * The stage follows a product-shot camera model: the camera orbits a target
 * point on or around the device, zooms toward it, and can blur everything
 * outside a focus plane. Shot presets and motions only write these values.
 */

export type Device3DMotion =
  // Looping camera moves
  | "none"
  | "drift"
  | "cinematic-turn"
  | "push"
  | "glide"
  | "spiral"
  | "focus-pull"
  // Looping device moves
  | "full-spin"
  | "float"
  | "sway"
  | "flip"
  // One-shot intros
  | "present"
  | "flip-reveal"
  | "rise"
  | "drop"
  | "fly-in"
  | "pop"
  // One-shot screen moves
  | "zoom-screen"
  | "wake"
  | "unfold";

export type DeviceCategory = "phone" | "laptop" | "desktop";

export type Device3DArrangement = "single" | "row" | "trio" | "bokeh";

export interface ScreenPoint {
  /** 0 = left edge of the screen, 1 = right edge. */
  u: number;
  /** 0 = top edge of the screen, 1 = bottom edge. */
  v: number;
}

export interface Device3DSettings {
  /** Camera elevation in degrees. Positive looks down at the device. */
  orbitX: number;
  /** Camera turn in degrees. Positive reveals the device's left side. */
  orbitY: number;
  /** Camera roll in degrees. */
  roll: number;
  /** 1 fits the whole device into its frame. */
  zoom: number;
  /** Vertical field of view in degrees. */
  fov: number;
  panX: number;
  panY: number;
  /** Screen point the camera aims at. Null aims at the device's center. */
  target: ScreenPoint | null;
  /** Depth of field amount (0-1). */
  depth: number;
  /** Screen point that stays sharp. Null focuses on the aim point. */
  focus: ScreenPoint | null;
  /** Device pose in degrees, applied before the camera orbit. */
  poseX: number;
  poseY: number;
  poseZ: number;
  motion: Device3DMotion;
  motionDuration: number;
  motionIntensity: number;
  lidAngle: number;
  arrangement: Device3DArrangement;
  lighting: Device3DLighting;
}

export interface Device3DLighting {
  /** Null keeps the scene's automatic key position. */
  angle: number | null;
  height: number | null;
  intensity: number;
  color: string | null;
  rimIntensity: number;
  rimColor: string | null;
  exposure: number;
  /** Null follows the background's shadow setting. */
  shadowStrength: number | null;
  shadowSoftness: number;
  shadowDistance: number;
  glow: number;
  glowColor: string;
}

export const DEVICE_3D_LIMITS = {
  orbitX: [-60, 80],
  roll: [-30, 30],
  zoom: [0.5, 4.5],
  fov: [10, 70],
  pan: [-0.5, 0.5],
  pose: [-180, 180],
  motionDuration: [2, 20],
  lidAngle: [60, 135],
} as const;

export const DEFAULT_DEVICE_3D_FOV = 31;
export const DEFAULT_LAPTOP_LID_ANGLE = 110;
