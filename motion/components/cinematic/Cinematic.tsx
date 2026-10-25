// Cinematic toolkit: a real 3D camera for product shots (screens, devices and UI pieces in depth,
// with lens blur, glare, shadows and reflections). Scenes import it from "agentcut/components".
//
// Every plane is one element with a full matrix3d(): the browser preview draws it natively and the
// browser export draws it through WebGL, so the two match. Never put CSS `perspective` or
// `preserve-3d` around it: the stage already projects every plane itself.
import { Video } from "@remotion/media";
import { createContext, useContext, useId, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import { alpha, glowStyle } from "../lib";
import {
  apply,
  EASES,
  identity,
  mul,
  perspective,
  placementMatrix,
  rotateX,
  rotateY,
  rotateZ,
  scale,
  toCss,
  translate,
  type EaseName,
  type M4,
  type Placement,
} from "./math";

export type { EaseName, M4, Placement };

// ─── Camera ──────────────────────────────────────────────────────────────────────────────────────

export interface CameraPose {
  /** The point the camera looks at, in world px (0,0,0 = frame center; y down, z toward the viewer). */
  x?: number;
  y?: number;
  z?: number;
  /** 1: things at z = 0 show at their size. 2: twice as close. 0.6: pulled back. */
  zoom?: number;
  /** Degrees. tilt > 0: the camera rises and looks down (floors and laptop decks show their top).
   * turn > 0: the camera orbits to the left, so the right side recedes. roll > 0: the frame rotates
   * clockwise. To lay a screen back like a laptop lid, tilt the Screen/Group itself (tilt 25–55). */
  tilt?: number;
  turn?: number;
  roll?: number;
  /** Vertical field of view in degrees: 15–25 flat telephoto (product), 35 natural, 50–70 dramatic. */
  fov?: number;
  /** What's sharp: a world point [x, y, z], or a distance in px toward the camera from the target (0 = target). */
  focus?: [number, number, number] | number;
  /** Lens blur away from the focus: 0 none, 0.4 subtle, 1 strong, 2 macro. */
  aperture?: number;
  /** Moves the target off-center on screen, in fractions of the frame (-0.5…0.5): room for a title. */
  shiftX?: number;
  shiftY?: number;
}

export interface CameraKey extends CameraPose {
  /** Frame (local to the clip) where the camera reaches this pose. */
  at: number;
  /** Easing of the move INTO this key. */
  ease?: EaseName;
}

const POSE_DEFAULTS: Required<Omit<CameraPose, "focus">> & { focus: CameraPose["focus"] } = {
  x: 0,
  y: 0,
  z: 0,
  zoom: 1,
  tilt: 0,
  turn: 0,
  roll: 0,
  fov: 24,
  focus: 0,
  aperture: 0,
  shiftX: 0,
  shiftY: 0,
};

type FullPose = typeof POSE_DEFAULTS;
const NUMERIC = ["x", "y", "z", "zoom", "tilt", "turn", "roll", "fov", "aperture", "shiftX", "shiftY"] as const;

/** The camera pose at `frame`: keys carry their values forward, each move eases into its key. */
export function cameraAt(frame: number, camera: CameraPose | CameraKey[]): FullPose {
  if (!Array.isArray(camera)) return { ...POSE_DEFAULTS, ...stripUndefined(camera) };
  const keys = [...camera].sort((a, b) => a.at - b.at);
  if (keys.length === 0) return { ...POSE_DEFAULTS };
  // Fill every key with the values before it.
  const full: (FullPose & { at: number; ease?: EaseName })[] = [];
  let prev: FullPose = { ...POSE_DEFAULTS };
  for (const k of keys) {
    const next = { ...prev, ...stripUndefined(k), at: k.at, ease: k.ease } as FullPose & { at: number; ease?: EaseName };
    full.push(next);
    prev = next;
  }
  if (frame <= full[0].at) return full[0];
  const last = full[full.length - 1];
  if (frame >= last.at) return last;
  let i = 0;
  while (full[i + 1].at < frame) i++;
  const a = full[i];
  const b = full[i + 1];
  const t = EASES[b.ease ?? "inOut"]((frame - a.at) / Math.max(1e-6, b.at - a.at));
  const out = { ...b } as FullPose;
  for (const key of NUMERIC) out[key] = a[key] + (b[key] - a[key]) * t;
  out.focus = mixFocus(a.focus, b.focus, t);
  return out;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function mixFocus(a: CameraPose["focus"], b: CameraPose["focus"], t: number): CameraPose["focus"] {
  if (Array.isArray(a) && Array.isArray(b)) return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as [number, number, number];
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
  return t < 0.5 ? a : b;
}

/** Slow, smooth drift that makes a locked-off shot feel filmed (deterministic). */
function floatOffset(frame: number, fps: number, amount: number, seed: number) {
  if (!amount) return { x: 0, y: 0, tilt: 0, turn: 0, roll: 0 };
  const t = frame / fps + seed * 7.31;
  const w = (a: number, b: number) => Math.sin(t * a + seed * b) * 0.6 + Math.sin(t * a * 2.3 + seed * b * 1.7) * 0.4;
  return {
    x: w(0.31, 1.1) * 10 * amount,
    y: w(0.23, 2.3) * 7 * amount,
    tilt: w(0.19, 3.7) * 0.5 * amount,
    turn: w(0.27, 4.1) * 0.6 * amount,
    roll: w(0.17, 5.3) * 0.25 * amount,
  };
}

// ─── Stage context ───────────────────────────────────────────────────────────────────────────────

interface StageContext {
  width: number;
  height: number;
  /** World px → screen px at zoom 1 (1 at 1080 px on the short side). */
  u: number;
  /** Viewer distance of the projection (px). */
  D: number;
  /** World → camera space. */
  view: M4;
  /** Camera space → screen (perspective + centering). */
  project: M4;
  focusDist: number;
  aperture: number;
  /** Lens and target shift, for renderers that draw through the same camera (Device3D). */
  fov: number;
  shiftX: number;
  shiftY: number;
  /** Parent placement (groups). */
  model: M4;
}

const StageCtx = createContext<StageContext | null>(null);

export function useStageContext(component: string) {
  const ctx = useContext(StageCtx);
  if (!ctx) throw new Error(`<${component}> must be inside a <Stage>.`);
  return ctx;
}

/** Frame size, world unit and orientation, for sizing things in both variants. */
export function useStage() {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  return { width, height, u, vertical: height > width, worldWidth: width / u, worldHeight: height / u };
}

export interface StageProps {
  /** One pose, or keyframes the camera moves through. */
  camera: CameraPose | CameraKey[];
  /** Handheld drift, 0 locked off, 0.5 gentle, 1 floating. */
  float?: number;
  /** Blur while the camera moves fast (whips, snaps): 0 off, 1 natural. */
  motionBlur?: number;
  seed?: number;
  /** Background behind the planes (a color, a linear-gradient, or a <Backdrop> as the first child). */
  background?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

function buildCamera(pose: FullPose, width: number, height: number) {
  const u = Math.min(width, height) / 1080;
  const fov = Math.min(110, Math.max(4, pose.fov));
  const D = height / 2 / Math.tan((fov * Math.PI) / 360);
  const d = D / Math.max(0.05, pose.zoom);
  const view = mul(
    translate(0, 0, D - d),
    rotateZ(pose.roll),
    // Camera above looking down (tilt > 0) = the world turns its top toward the lens.
    rotateX(-pose.tilt),
    rotateY(pose.turn),
    scale(u),
    translate(-pose.x, -pose.y, -pose.z),
  );
  const project = mul(translate(width / 2 + pose.shiftX * width, height / 2 + pose.shiftY * height, 0), perspective(D));
  let focusDist = d;
  if (Array.isArray(pose.focus)) focusDist = D - apply(view, ...pose.focus)[2];
  else if (typeof pose.focus === "number") focusDist = d - pose.focus * u;
  return { u, D, d, view, project, focusDist };
}

/** A 3D stage: everything inside (Plane, Screen, Lift, Group) is seen through one moving camera. */
export function Stage({ camera, float = 0, motionBlur = 0, seed = 1, background, children, style }: StageProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const poseAt = (f: number) => {
    const p = cameraAt(f, camera);
    const o = floatOffset(f, fps, float, seed);
    return { ...p, x: p.x + o.x, y: p.y + o.y, tilt: p.tilt + o.tilt, turn: p.turn + o.turn, roll: p.roll + o.roll };
  };
  const pose = poseAt(frame);
  const cam = buildCamera(pose, width, height);
  const ctx: StageContext = {
    width,
    height,
    u: cam.u,
    D: cam.D,
    view: cam.view,
    project: cam.project,
    focusDist: cam.focusDist,
    aperture: Math.max(0, pose.aperture),
    fov: Math.min(110, Math.max(4, pose.fov)),
    shiftX: pose.shiftX * width,
    shiftY: pose.shiftY * height,
    model: identity(),
  };

  // Motion blur from how far the frame center travels between neighbouring frames.
  let blur = 0;
  if (motionBlur > 0) {
    const travel = (f: number) => {
      const c = buildCamera(poseAt(f), width, height);
      const m = mul(c.project, c.view);
      const p = apply(m, pose.x, pose.y, pose.z);
      const s = apply(m, pose.x + 100, pose.y, pose.z);
      return { x: p[0] / p[3], y: p[1] / p[3], s: Math.hypot(s[0] / s[3] - p[0] / p[3], s[1] / s[3] - p[1] / p[3]) };
    };
    const a = travel(frame - 1);
    const b = travel(frame + 1);
    const speed = Math.hypot(b.x - a.x, b.y - a.y) / 2 + (Math.abs(b.s - a.s) / 100) * Math.min(width, height) * 0.25;
    // Screen px, so the thresholds follow the frame size (u = 1 at 1080).
    blur = Math.min(28 * cam.u, Math.max(0, speed - 6 * cam.u) * 0.22 * motionBlur);
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", background, ...style }}>
      <StageCtx.Provider value={ctx}>
        <AbsoluteFill style={blur > 0.4 * cam.u ? { filter: `blur(${blur.toFixed(2)}px)` } : undefined}>{children}</AbsoluteFill>
      </StageCtx.Provider>
    </AbsoluteFill>
  );
}

// ─── Groups and planes ───────────────────────────────────────────────────────────────────────────

/** Moves, turns and scales everything inside it together (a device and the UI lifted off it). */
export function Group({ children, ...placement }: Placement & { children?: ReactNode }) {
  const ctx = useStageContext("Group");
  return <StageCtx.Provider value={{ ...ctx, model: mul(ctx.model, placementMatrix(placement)) }}>{children}</StageCtx.Provider>;
}

export interface PlaneProps extends Placement {
  /** Size in world px (1080 = the short side of the frame). */
  width: number;
  height: number;
  radius?: number;
  background?: string;
  opacity?: number;
  /** Soft shadow cast behind the plane: 0 none, 1 strong. */
  shadow?: number;
  /** How far behind the plane the shadow falls (world px). Lifted cards: 40–120. */
  shadowDepth?: number;
  /** Mirror below the plane on a glossy floor: 0 none, 0.25 subtle, 0.5 strong. */
  reflection?: number;
  /** Lens blur from the camera's focus and aperture (true), or always sharp (false). */
  dof?: boolean;
  /** A thin light edge, like glass catching light: 0 none, 1 bright. */
  rim?: number;
  /** Extra softness in world px on top of the lens blur (soft shadows, glows). */
  blur?: number;
  /** Exact placement matrix (world, row-major) instead of x/y/z/tilt/turn/roll: for planes laid onto
   * other surfaces (lifts off a 3D device's screen). */
  basis?: M4;
  children?: ReactNode;
  style?: CSSProperties;
}

/** Lens blur cap in screen px at 1080 (scaled with the frame). */
// Room for macro close-ups (aperture 2–4): a razor-thin focus band with everything else melted.
const MAX_BLUR = 80;

/** Camera distance of a world-space point on this plane (local px). */
function distAt(m: M4, D: number, x: number, y: number) {
  return D - apply(m, x, y, 0)[2];
}

/** Lens blur in screen px for a point `dist` from the viewer. */
export function blurFor(ctx: StageContext, dist: number) {
  if (ctx.aperture <= 0 || dist <= 1) return 0;
  return Math.min(MAX_BLUR * ctx.u, (ctx.aperture * 0.09 * ctx.height * Math.abs(dist - ctx.focusDist)) / dist);
}

/** Camera-space px per local px of a plane (its placement scale times u, before perspective). */
export function localScale(camModel: M4) {
  const kx = Math.hypot(camModel[0], camModel[4], camModel[8]);
  const ky = Math.hypot(camModel[1], camModel[5], camModel[9]);
  return Math.max(1e-6, Math.sqrt(kx * ky));
}

// Fine enough that a macro shot's thin focus band stays smooth.
const STOPS = 49;

/**
 * Lens blur across a plane: none, one blur, or a gradient of blur along the plane's depth. Blurs come
 * back in the plane's local px: CSS (and the browser export) blur an element before its matrix3d()
 * projects it, so a screen-px blur is divided by how much the plane is magnified there.
 */
function planeFocus(ctx: StageContext, camModel: M4, w: number, h: number) {
  if (ctx.aperture <= 0) return { kind: "sharp" as const };
  const d00 = distAt(camModel, ctx.D, 0, 0);
  const d10 = distAt(camModel, ctx.D, w, 0);
  const d01 = distAt(camModel, ctx.D, 0, h);
  const gx = (d10 - d00) / Math.max(1, w);
  const gy = (d01 - d00) / Math.max(1, h);
  const k = localScale(camModel);
  const distAtLocal = (x: number, y: number) => d00 + gx * x + gy * y;
  // One local px covers k·D/dist screen px.
  const localBlur = (dist: number) => (dist <= 1 ? 0 : (blurFor(ctx, dist) * dist) / (ctx.D * k));
  const len = Math.hypot(gx, gy);
  if (len * Math.hypot(w, h) < 2) {
    const center = distAtLocal(w / 2, h / 2);
    return blurFor(ctx, center) < 0.5 ? { kind: "sharp" as const } : { kind: "uniform" as const, blur: localBlur(center) };
  }
  // CSS gradient angle: 0deg points up, 90deg right; direction of increasing distance.
  const dx = gx / len;
  const dy = gy / len;
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const L = Math.abs(w * dx) + Math.abs(h * dy);
  const screen: number[] = [];
  const local: number[] = [];
  const onScreen: boolean[] = [];
  const toScreen = mul(ctx.project, camModel);
  for (let i = 0; i < STOPS; i++) {
    const t = i / (STOPS - 1) - 0.5;
    const px = w / 2 + dx * t * L;
    const py = h / 2 + dy * t * L;
    const dist = distAtLocal(px, py);
    screen.push(blurFor(ctx, dist));
    local.push(localBlur(dist));
    const [sx, sy, , sw] = apply(toScreen, px, py, 0);
    const margin = 0.25;
    onScreen.push(
      sw > 0 &&
        sx / sw > -margin * ctx.width &&
        sx / sw < (1 + margin) * ctx.width &&
        sy / sw > -margin * ctx.height &&
        sy / sw < (1 + margin) * ctx.height,
    );
  }
  // Scale the blur copies to what's on screen. In a close-up most of the plane is out of frame, and its
  // far end (tiny on screen, so a huge blur in local px) would otherwise set the scale and leave the
  // visible part a faint mix of sharp and soft whatever the aperture.
  const visible = (values: number[]) => {
    const kept = values.filter((_, i) => onScreen[i]);
    return kept.length ? kept : values;
  };
  const maxScreen = Math.max(...visible(screen));
  const minScreen = Math.min(...visible(screen));
  const max = Math.max(...visible(local));
  if (maxScreen < 0.6) return { kind: "sharp" as const };
  if (maxScreen - minScreen < Math.max(1, maxScreen * 0.2)) return { kind: "uniform" as const, blur: (max + Math.min(...local)) / 2 };
  /** Local blur along the gradient line of the box padded by `pad` on every side (the copies' box). */
  const blursAcross = (pad: number) => {
    const Lp = Math.abs((w + 2 * pad) * dx) + Math.abs((h + 2 * pad) * dy);
    return Array.from({ length: STOPS }, (_, i) => {
      const t = i / (STOPS - 1) - 0.5;
      return Math.min(max, localBlur(distAtLocal(w / 2 + dx * t * Lp, h / 2 + dy * t * Lp)));
    });
  };
  return { kind: "gradient" as const, angle, max, blursAcross };
}

function maskFrom(angle: number, alphas: number[]): CSSProperties {
  const stops = alphas
    .map((a, i) => `rgba(0,0,0,${Math.min(1, Math.max(0, a)).toFixed(3)}) ${((i / (alphas.length - 1)) * 100).toFixed(1)}%`)
    .join(", ");
  const mask = `linear-gradient(${angle.toFixed(2)}deg, ${stops})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/**
 * Alphas for copies stacked bottom → top so copy i shows weights[i] of the result at `opacity`. A fading
 * plane keeps its opacity instead of compounding it once per copy.
 */
function stackAlphas(weights: number[], opacity: number) {
  const alphas = new Array<number>(weights.length).fill(0);
  let below = 1;
  for (let i = weights.length - 1; i >= 0; i--) {
    alphas[i] = below > 1e-4 ? Math.min(1, Math.max(0, (opacity * weights[i]) / below)) : 0;
    below *= 1 - alphas[i];
  }
  return alphas;
}

// Blur plus a no-op shadow: the browser export then blurs the copy as one picture, so its soft edge
// spills past the rounded box as in the preview instead of being cut at it.
const groupBlur = (px: number) => (px > 0.05 ? `blur(${px.toFixed(2)}px) drop-shadow(0 0 0 rgba(0,0,0,0))` : undefined);
const padFor = (px: number) => (px > 0.05 ? Math.ceil(px * 3) + 1 : 0);

const PlaneCopyCtx = createContext(false);

/**
 * `copy` is true inside the extra copies a Plane draws for lens blur and reflections. Content with sound
 * or heavy work checks it: a copy is only ever seen blurred or mirrored.
 */
export function usePlaneLayer() {
  return { copy: useContext(PlaneCopyCtx) };
}

/** A <Video> (@remotion/media) for plane and screen content: only the main copy plays its sound. */
export function PlaneVideo(props: ComponentProps<typeof Video>) {
  const { copy } = usePlaneLayer();
  return <Video {...props} muted={copy || props.muted} />;
}

export type { StageContext };

/** A flat surface in 3D: put any content inside (an <Img>, a <PlaneVideo>, a <Device>, text, a card). */
export function Plane({
  width,
  height,
  radius = 0,
  background,
  opacity = 1,
  shadow = 0,
  shadowDepth = 60,
  reflection = 0,
  dof = true,
  rim = 0,
  blur = 0,
  basis,
  children,
  style,
  ...placement
}: PlaneProps) {
  const ctx = useStageContext("Plane");
  const env = useRemotionEnvironment();
  // The live preview draws two copies for a depth blur instead of three (captures and exports get three).
  const lightPreview = env.isPlayer && !env.isRendering;
  const model = mul(ctx.model, basis ?? placementMatrix(placement));
  const camModel = mul(ctx.view, model, translate(-width / 2, -height / 2, 0));
  // A plane reaching behind the camera can't be projected as a whole: below, only its part in front of
  // the lens is drawn. Big surfaces (Floor) are also tiled.
  const nearest = Math.min(
    distAt(camModel, ctx.D, 0, 0),
    distAt(camModel, ctx.D, width, 0),
    distAt(camModel, ctx.D, 0, height),
    distAt(camModel, ctx.D, width, height),
  );
  if (opacity <= 0) return null;
  const near = ctx.D * 0.04;
  if (nearest < near) {
    // The plane passes the lens (macro close-ups, low fly-overs). Keep the part in front of the camera:
    // the largest edge-aligned rectangle whose corners are all safely in front, redrawn as a smaller
    // plane with the content offset so nothing moves.
    const d00 = distAt(camModel, ctx.D, 0, 0);
    const gx = (distAt(camModel, ctx.D, width, 0) - d00) / Math.max(1, width);
    const gy = (distAt(camModel, ctx.D, 0, height) - d00) / Math.max(1, height);
    const dist = (x: number, y: number) => d00 + gx * x + gy * y;
    const safe = near * 1.5;
    let [x0, y0, x1, y1] = [0, 0, width, height];
    for (let i = 0; i < 40; i++) {
      const corners: [number, number][] = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
      const worst = corners.reduce((a, c) => (dist(c[0], c[1]) < dist(a[0], a[1]) ? c : a));
      if (dist(worst[0], worst[1]) >= safe) break;
      // Pull in the two edges that meet at the closest corner, in proportion to how fast depth changes.
      const step = 0.05;
      if (Math.abs(gx) * width > 1e-6) {
        if (worst[0] === x0 && gx > 0) x0 += (x1 - x0) * step;
        else if (worst[0] === x1 && gx < 0) x1 -= (x1 - x0) * step;
      }
      if (Math.abs(gy) * height > 1e-6) {
        if (worst[1] === y0 && gy > 0) y0 += (y1 - y0) * step;
        else if (worst[1] === y1 && gy < 0) y1 -= (y1 - y0) * step;
      }
    }
    const sw = x1 - x0;
    const sh = y1 - y0;
    const ok = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].every(([x, y]) => dist(x, y) >= near);
    if (!ok || sw < 2 || sh < 2) return null;
    const subBasis = mul(basis ?? placementMatrix(placement), translate(x0 + sw / 2 - width / 2, y0 + sh / 2 - height / 2, 0));
    return (
      <Plane
        basis={subBasis}
        width={sw}
        height={sh}
        radius={radius}
        background={background}
        opacity={opacity}
        dof={dof}
        rim={rim}
        blur={blur}
        style={style}
      >
        <div style={{ position: "absolute", left: -x0, top: -y0, width, height }}>{children}</div>
      </Plane>
    );
  }

  // Extra softness asked for in world px, in this plane's local px.
  const extra = (blur * ctx.u) / localScale(camModel);
  const withExtra = (b: number) => Math.hypot(b, extra);
  const matrix = (m: M4) => toCss(mul(ctx.project, m));
  const focus = dof ? planeFocus(ctx, camModel, width, height) : ({ kind: "sharp" } as const);
  const surface: CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width,
    height,
    borderRadius: radius,
    overflow: "hidden",
    background,
    ...style,
  };
  const content = (
    <>
      {children}
      {rim > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            border: `${Math.max(1, width * 0.0015)}px solid ${alpha("#ffffff", 0.35 * rim)}`,
            background: `linear-gradient(160deg, ${alpha("#ffffff", 0.16 * rim)} 0%, ${alpha("#ffffff", 0)} 38%)`,
          }}
        />
      ) : null}
    </>
  );

  // One copy: a 3D box padded for the blur's spill (it carries the projection and the depth mask), the
  // blur inside it, then the clipped surface with the content.
  const copyOf = (
    key: string,
    m: M4,
    o: { blur: number; pad: number; mask?: CSSProperties; opacity: number; copy: boolean; body?: ReactNode },
  ) => (
    <div
      key={key}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: width + o.pad * 2,
        height: height + o.pad * 2,
        transformOrigin: "0 0",
        transform: matrix(mul(m, translate(-o.pad, -o.pad, 0))),
        ...o.mask,
      }}
    >
      <div style={{ position: "absolute", left: o.pad, top: o.pad, width, height, filter: groupBlur(o.blur) }}>
        <div style={{ ...surface, opacity: o.opacity }}>
          <PlaneCopyCtx.Provider value={o.copy}>{o.body ?? content}</PlaneCopyCtx.Provider>
        </div>
      </div>
    </div>
  );

  const layers: ReactNode[] = [];

  if (shadow > 0) {
    const sm = mul(ctx.view, model, translate(0, height * 0.06, -shadowDepth), scale(0.94), translate(-width / 2, -height / 2, 0));
    // World px of softness, in the shadow's local px.
    const sb = (24 + shadowDepth * 0.35) * (ctx.u / localScale(sm));
    const pad = padFor(sb);
    layers.push(
      <div
        key="shadow"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: width + pad * 2,
          height: height + pad * 2,
          transformOrigin: "0 0",
          transform: matrix(mul(sm, translate(-pad, -pad, 0))),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: pad,
            top: pad,
            width,
            height,
            borderRadius: radius,
            background: `rgba(0,0,0,${Math.min(0.85, 0.5 * shadow) * opacity})`,
            filter: groupBlur(sb),
          }}
        />
      </div>,
    );
  }

  if (reflection > 0) {
    const rm = mul(ctx.view, model, translate(0, height + 6, 0), scale(1, -1, 1), translate(-width / 2, -height / 2, 0));
    const rb = withExtra(1.5);
    const mask = `linear-gradient(0deg, rgba(0,0,0,${(0.9 * reflection).toFixed(3)}) 0%, rgba(0,0,0,0) 45%)`;
    layers.push(
      copyOf("reflection", rm, {
        blur: rb,
        pad: padFor(rb),
        mask: { maskImage: mask, WebkitMaskImage: mask },
        opacity: opacity * 0.9,
        copy: true,
        body: children,
      }),
    );
  }

  // The main copy is always last and keyed "main", so its content never remounts when the focus changes
  // (videos keep playing, loaded images stay); the blurred copies come and go under it.
  if (focus.kind === "sharp") {
    layers.push(copyOf("main", camModel, { blur: extra, pad: padFor(extra), opacity, copy: false }));
  } else if (focus.kind === "uniform") {
    const b = withExtra(focus.blur);
    layers.push(copyOf("main", camModel, { blur: b, pad: padFor(b), opacity, copy: false }));
  } else {
    // Copies at geometric blur levels (each about twice the last), cross-faded along the plane's depth:
    // each point mixes the two levels around its own blur. A screen-space blur that's even across a
    // tilted plane is a 10× range in the plane's own px (near parts are magnified), which one blurred
    // copy can't follow; macro close-ups need the full ladder. The preview climbs fewer rungs.
    const { max, angle } = focus;
    // Enough rungs to reach ~1 px, so the in-focus band resolves cleanly (capped for cost).
    const rungs = Math.max(1, Math.min(lightPreview ? 2 : 6, Math.ceil(Math.log(Math.max(1.01, max / 0.9)) / Math.log(2.2))));
    const levels = [0];
    for (let i = rungs - 1; i >= 0; i--) levels.push(max / Math.pow(2.2, i));
    const pad = padFor(withExtra(max));
    const weights = focus.blursAcross(pad).map((b) => {
      const w = new Array<number>(levels.length).fill(0);
      if (b <= 0) {
        w[0] = 1;
        return w;
      }
      let i = 0;
      while (i < levels.length - 2 && b > levels[i + 1]) i++;
      const t = Math.min(1, Math.max(0, (b - levels[i]) / Math.max(1e-6, levels[i + 1] - levels[i])));
      w[i] = 1 - t;
      w[i + 1] = t;
      return w;
    });
    // Stack from the blurriest copy (bottom) up to the sharp main copy (top).
    const order = levels.map((_, i) => levels.length - 1 - i);
    const alphas = weights.map((w) => stackAlphas(order.map((i) => w[i]), opacity));
    order.forEach((level, k) => {
      const isMain = level === 0;
      layers.push(
        copyOf(isMain ? "main" : `blur${level}`, camModel, {
          blur: isMain ? extra : withExtra(levels[level]),
          pad,
          mask: maskFrom(angle, alphas.map((a) => a[k])),
          opacity: 1,
          copy: !isMain,
        }),
      );
    });
  }
  return <>{layers}</>;
}

// ─── Devices and screens ─────────────────────────────────────────────────────────────────────────

// No flat MacBook: laptops are 3D (Device3D "macbook" / "macbook-pro"). A scene that still passes
// kind="macbook" gets a frameless screen.
export type DeviceKind = "none" | "browser" | "iphone" | "ipad" | "monitor";

/** Screen aspect (width / height) each device shows by default. */
export const DEVICE_ASPECT: Record<DeviceKind, number> = {
  none: 16 / 10,
  browser: 16 / 10,
  iphone: 9 / 19.5,
  ipad: 3 / 4,
  monitor: 16 / 9,
};

interface DeviceGeometry {
  /** Outer size for a screen of `width` world px. */
  outer: { width: number; height: number };
  screen: { left: number; top: number; width: number; height: number; radius: number };
  radius: number;
}

/** Outer size and screen rectangle of a device whose SCREEN is `screenWidth` wide. */
export function deviceGeometry(kind: DeviceKind, screenWidth: number, aspect = DEVICE_ASPECT[kind]): DeviceGeometry {
  const w = screenWidth;
  const h = w / aspect;
  switch (kind) {
    case "iphone": {
      const b = w * 0.045;
      return {
        outer: { width: w + b * 2, height: h + b * 2 },
        screen: { left: b, top: b, width: w, height: h, radius: w * 0.13 },
        radius: w * 0.16,
      };
    }
    case "ipad": {
      const b = w * 0.045;
      return {
        outer: { width: w + b * 2, height: h + b * 2 },
        screen: { left: b, top: b, width: w, height: h, radius: w * 0.025 },
        radius: w * 0.06,
      };
    }
    case "monitor": {
      const b = w * 0.012;
      return {
        outer: { width: w + b * 2, height: h + b * 2 },
        screen: { left: b, top: b, width: w, height: h, radius: w * 0.002 },
        radius: w * 0.01,
      };
    }
    case "browser": {
      const bar = w * 0.042;
      return {
        outer: { width: w, height: h + bar },
        screen: { left: 0, top: bar, width: w, height: h, radius: 0 },
        radius: w * 0.012,
      };
    }
    default:
      return { outer: { width: w, height: h }, screen: { left: 0, top: 0, width: w, height: h, radius: w * 0.012 }, radius: w * 0.012 };
  }
}

export interface DeviceProps {
  kind: DeviceKind;
  /** Width of the SCREEN in px (the device is a little larger: see deviceGeometry). */
  screenWidth: number;
  /** Screen width / height (defaults per device). Match the screenshot's aspect to avoid empty space. */
  aspect?: number;
  /** "black" or "silver" hardware; "light" or "dark" browser chrome. */
  finish?: "black" | "silver" | "light" | "dark";
  /** Address shown in the browser bar. */
  url?: string;
  /** Screen content. Images and video should fill the width: <Img style={{ width: "100%", display: "block" }} />. */
  children?: ReactNode;
  screenBackground?: string;
}

/** A flat device frame (iPhone, iPad, monitor, browser window) around its screen content. */
export function Device({ kind, screenWidth, aspect, finish, url, children, screenBackground = "#ffffff" }: DeviceProps) {
  const g = deviceGeometry(kind, screenWidth, aspect);
  const w = screenWidth;
  const dark = finish === "dark" || finish === "black" || (finish === undefined && kind === "iphone");
  const metal = finish === "silver" ? "#d9dce1" : "#1d1e22";
  const screen = (
    <div
      style={{
        position: "absolute",
        left: g.screen.left,
        top: g.screen.top,
        width: g.screen.width,
        height: g.screen.height,
        borderRadius: g.screen.radius,
        overflow: "hidden",
        background: screenBackground,
      }}
    >
      {children}
    </div>
  );
  if (kind === "browser") {
    const bar = g.screen.top;
    const chrome = dark ? "#202124" : "#eef0f3";
    const pill = dark ? "#303134" : "#ffffff";
    const ink = dark ? "#9aa0a6" : "#5f6368";
    return (
      <div style={{ position: "relative", width: g.outer.width, height: g.outer.height, borderRadius: g.radius, overflow: "hidden", background: chrome }}>
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: bar, display: "flex", alignItems: "center", gap: bar * 0.18, paddingLeft: bar * 0.45 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: bar * 0.26, height: bar * 0.26, borderRadius: "50%", background: c }} />
          ))}
          <div
            style={{
              marginLeft: bar * 0.6,
              width: w * 0.42,
              height: bar * 0.56,
              borderRadius: bar * 0.28,
              background: pill,
              display: "flex",
              alignItems: "center",
              paddingLeft: bar * 0.35,
              color: ink,
              font: `500 ${bar * 0.3}px Inter, system-ui, sans-serif`,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {url ?? ""}
          </div>
        </div>
        {screen}
      </div>
    );
  }
  const frameColor = kind === "iphone" || kind === "ipad" ? metal : dark ? "#111214" : "#e4e6ea";
  return (
    <div
      style={{
        position: "relative",
        width: g.outer.width,
        height: g.outer.height,
        borderRadius: g.radius,
        background: frameColor,
        border: kind === "iphone" || kind === "ipad" ? `${w * 0.006}px solid ${finish === "silver" ? "#b7bbc1" : "#3b3c41"}` : undefined,
        boxSizing: "border-box",
      }}
    >
      {screen}
      {kind === "iphone" ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: g.screen.top + w * 0.03,
            width: w * 0.3,
            height: w * 0.085,
            marginLeft: -w * 0.15,
            borderRadius: w * 0.05,
            background: "#000000",
          }}
        />
      ) : null}
    </div>
  );
}

export interface ScreenProps extends Placement, Omit<DeviceProps, "children" | "screenWidth"> {
  /** Width of the screen area in world px. */
  width: number;
  /** An image to show (asset("assets/…")). */
  src?: string;
  /** A screen recording to play instead (asset("assets/…")); only the sharp copy plays its sound. */
  video?: string;
  /** Extra <Video> props for `video` (volume, muted, loop, trimBefore, playbackRate, …). */
  videoProps?: Omit<ComponentProps<typeof Video>, "src">;
  /** Scrolls a tall screenshot: 0 top … 1 bottom (needs `imageAspect`). */
  scroll?: number;
  /** Width / height of the image, to scroll a tall page. */
  imageAspect?: number;
  shadow?: number;
  shadowDepth?: number;
  reflection?: number;
  rim?: number;
  dof?: boolean;
  opacity?: number;
  /** A light band sweeping across the glass: 0…1 is its position (leave out for none). */
  glare?: number;
  children?: ReactNode;
}

/** A screenshot or video in a device, placed in 3D: the workhorse of a product shot. */
export function Screen({
  kind,
  width,
  aspect,
  finish,
  url,
  src,
  video,
  videoProps,
  scroll = 0,
  imageAspect,
  screenBackground,
  shadow = 0.7,
  shadowDepth = 70,
  reflection = 0,
  rim = 0,
  dof,
  opacity,
  glare,
  children,
  ...placement
}: ScreenProps) {
  const g = deviceGeometry(kind, width, aspect);
  const screenH = g.screen.height;
  const imageH = imageAspect ? width / imageAspect : screenH;
  const offset = Math.max(0, imageH - screenH) * Math.min(1, Math.max(0, scroll));
  return (
    <Plane
      {...placement}
      width={g.outer.width}
      height={g.outer.height}
      radius={g.radius}
      shadow={shadow}
      shadowDepth={shadowDepth}
      reflection={reflection}
      rim={rim}
      dof={dof}
      opacity={opacity}
    >
      <Device kind={kind} screenWidth={width} aspect={aspect} finish={finish} url={url} screenBackground={screenBackground}>
        {src ? (
          <Img src={src} style={{ position: "absolute", left: 0, top: -offset, width: "100%", display: "block" }} />
        ) : video ? (
          <PlaneVideo
            {...videoProps}
            src={video}
            style={{ position: "absolute", left: 0, top: -offset, width: "100%", display: "block", ...videoProps?.style }}
          />
        ) : (
          children
        )}
      </Device>
      {glare !== undefined ? <Glare progress={glare} /> : null}
    </Plane>
  );
}

/** Where a Screen's picture sits inside its device, relative to the device center (for Lift). */
export function screenRect(kind: DeviceKind, width: number, aspect?: number) {
  const g = deviceGeometry(kind, width, aspect);
  return {
    x: g.screen.left + g.screen.width / 2 - g.outer.width / 2,
    y: g.screen.top + g.screen.height / 2 - g.outer.height / 2,
    width: g.screen.width,
    height: g.screen.height,
  };
}

export interface LiftProps {
  /** The same image the screen shows. */
  src: string;
  /** The region to lift, in fractions of the screen picture: [x, y, width, height] (0…1). */
  box: [number, number, number, number];
  /** The screen it comes from: the Screen's kind, width and aspect, so the lift starts exactly in place. */
  kind?: DeviceKind;
  width: number;
  aspect?: number;
  /** Height of the picture when the screenshot is taller than the screen (imageAspect), and the scroll. */
  imageAspect?: number;
  scroll?: number;
  /** How far it rises toward the camera (world px). 0 = flush with the screen. */
  z?: number;
  /** Extra scale while lifted (1.0–1.15 reads well). */
  scale?: number;
  /** Small extra offset or angle while lifted. */
  x?: number;
  y?: number;
  tilt?: number;
  turn?: number;
  roll?: number;
  radius?: number;
  shadow?: number;
  /** 0…1: fades the copy in (use with z for a pop-out). */
  opacity?: number;
  rim?: number;
  /** Fill behind the cut-out, in case the image has transparency. */
  background?: string;
}

/**
 * A piece of the screenshot that rises out of the screen toward the camera (a card, a button, a chart):
 * put it in the same <Group> as its <Screen>, so it starts exactly where it is on screen.
 */
export function Lift({
  src,
  box,
  kind = "none",
  width,
  aspect,
  imageAspect,
  scroll = 0,
  z = 0,
  scale: s = 1,
  x = 0,
  y = 0,
  tilt = 0,
  turn = 0,
  roll = 0,
  radius,
  shadow = 0.8,
  opacity = 1,
  rim = 0.4,
  background,
}: LiftProps) {
  const r = screenRect(kind, width, aspect);
  const imageH = imageAspect ? width / imageAspect : r.height;
  const offset = Math.max(0, imageH - r.height) * Math.min(1, Math.max(0, scroll));
  const [bx, by, bw, bh] = box;
  const w = bw * r.width;
  const h = bh * r.height;
  const cx = r.x - r.width / 2 + (bx + bw / 2) * r.width;
  const cy = r.y - r.height / 2 + (by + bh / 2) * r.height;
  return (
    <Plane
      x={cx + x}
      y={cy + y}
      z={z + 0.5}
      tilt={tilt}
      turn={turn}
      roll={roll}
      scale={s}
      width={w}
      height={h}
      radius={radius ?? Math.min(w, h) * 0.08}
      shadow={shadow * Math.min(1, z / 40)}
      shadowDepth={Math.max(10, z)}
      rim={rim}
      opacity={opacity}
      background={background}
    >
      <Img
        src={src}
        // Same sizing as the Screen's picture: full width, natural height unless imageAspect says otherwise.
        style={{ position: "absolute", left: -bx * r.width, top: -by * r.height - offset, width: r.width, height: imageAspect ? imageH : "auto", maxWidth: "none" }}
      />
    </Plane>
  );
}

// ─── Light and backgrounds ───────────────────────────────────────────────────────────────────────

/** A band of light sweeping across a plane (put it last inside a Plane or Device screen). */
export function Glare({ progress, angle = 115, width = 0.35, strength = 0.35, color = "#ffffff" }: { progress: number; angle?: number; width?: number; strength?: number; color?: string }) {
  const p = -0.6 + progress * 2.2;
  const g = `linear-gradient(${angle}deg, ${alpha(color, 0)} ${((p - width / 2) * 100).toFixed(1)}%, ${alpha(color, strength)} ${(p * 100).toFixed(1)}%, ${alpha(color, 0)} ${((p + width / 2) * 100).toFixed(1)}%)`;
  return <div style={{ position: "absolute", inset: 0, background: g, pointerEvents: "none" }} />;
}

export type BackdropLook = "studio" | "light" | "aurora" | "spotlight" | "mesh" | "solid";

/** A full-frame background for product shots. Put it first inside the Stage (it doesn't move with the camera). */
export function Backdrop({
  look = "studio",
  color = "#0b0b10",
  accent = "#7c5cff",
  accent2 = "#ff5ca8",
  glowX = 0.5,
  glowY = 0.42,
  intensity = 1,
}: {
  look?: BackdropLook;
  color?: string;
  accent?: string;
  accent2?: string;
  /** Where the main glow sits (fractions of the frame). Move it slowly for life. */
  glowX?: number;
  glowY?: number;
  intensity?: number;
}) {
  const { width, height } = useVideoConfig();
  const m = Math.max(width, height);
  const glow = (x: number, y: number, size: number, c: string, o: number) => (
    <div style={glowStyle(x * width, y * height, size * m, size * m, c, o * intensity)} />
  );
  if (look === "solid") return <AbsoluteFill style={{ background: color }} />;
  if (look === "light")
    return (
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #fbfbfd 0%, #eef0f4 60%, #e2e5eb 100%)" }}>
        {glow(glowX, glowY, 1.1, "#ffffff", 0.9)}
        {glow(glowX + 0.2, glowY + 0.3, 0.8, accent, 0.12)}
      </AbsoluteFill>
    );
  if (look === "aurora")
    return (
      <AbsoluteFill style={{ background: color }}>
        {glow(glowX - 0.25, glowY - 0.1, 1.0, accent, 0.55)}
        {glow(glowX + 0.3, glowY + 0.2, 1.0, accent2, 0.45)}
        {glow(glowX, glowY + 0.55, 0.9, accent, 0.25)}
      </AbsoluteFill>
    );
  if (look === "spotlight")
    return (
      <AbsoluteFill style={{ background: color }}>
        {glow(glowX, glowY, 0.9, "#ffffff", 0.16)}
        {glow(glowX, glowY, 0.45, accent, 0.22)}
      </AbsoluteFill>
    );
  if (look === "mesh")
    return (
      <AbsoluteFill style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent2} 100%)` }}>
        {glow(glowX - 0.2, glowY - 0.2, 0.9, "#ffffff", 0.35)}
        {glow(glowX + 0.3, glowY + 0.4, 0.9, color, 0.35)}
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${color} 0%, #050507 100%)` }}>
      {glow(glowX, glowY, 1.1, accent, 0.28)}
      {glow(glowX, glowY + 0.1, 0.5, "#ffffff", 0.06)}
    </AbsoluteFill>
  );
}

/** A floor grid that recedes with the camera (put it inside the Stage, behind the screens). */
export function Floor({
  y = 520,
  size = 5000,
  near = 600,
  spacing = 120,
  color = "#ffffff",
  opacity = 0.12,
  glow = "#7c5cff",
}: {
  y?: number;
  size?: number;
  /** How far the floor reaches toward the camera (world px from z = 0); it must stay in front of the lens. */
  near?: number;
  spacing?: number;
  color?: string;
  opacity?: number;
  glow?: string;
}) {
  const id = `floor${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // Tiles of at most ~1250 px: each one blurs with its own depth, the part at the lens drops out alone,
  // and no layer gets bigger than a GPU texture.
  const n = Math.max(1, Math.ceil(size / 1250));
  const tile = size / n;
  const z0 = near - size / 2;
  const count = Math.floor(size / spacing);
  const tiles: ReactNode[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = i * tile;
      const y0 = j * tile;
      const lines: ReactNode[] = [];
      for (let l = 0; l <= count; l++) {
        const p = l * spacing;
        if (p >= x0 - 2 && p <= x0 + tile + 2) lines.push(<line key={`v${l}`} x1={p} y1={y0} x2={p} y2={y0 + tile} />);
        if (p >= y0 - 2 && p <= y0 + tile + 2) lines.push(<line key={`h${l}`} x1={x0} y1={p} x2={x0 + tile} y2={p} />);
      }
      const tid = `${id}-${i}-${j}`;
      tiles.push(
        <Plane
          key={tid}
          x={x0 + tile / 2 - size / 2}
          y={y}
          z={z0 + y0 + tile / 2 - size / 2}
          tilt={90}
          width={tile}
          height={tile}
          dof
        >
          <svg width={tile} height={tile} viewBox={`${x0} ${y0} ${tile} ${tile}`} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <radialGradient id={`${tid}-fade`} gradientUnits="userSpaceOnUse" cx={size / 2} cy={size / 2} r={size / 2}>
                <stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
                <stop offset="70%" stopColor="#ffffff" stopOpacity={0} />
              </radialGradient>
              <mask id={`${tid}-mask`} maskUnits="userSpaceOnUse" x={x0} y={y0} width={tile} height={tile}>
                <rect x={x0} y={y0} width={tile} height={tile} fill={`url(#${tid}-fade)`} />
              </mask>
            </defs>
            <circle cx={size / 2} cy={size / 2} r={size * 0.3} fill={glow} opacity={0.18} mask={`url(#${tid}-mask)`} />
            <g stroke={color} strokeOpacity={opacity} strokeWidth={2} mask={`url(#${tid}-mask)`}>
              {lines}
            </g>
          </svg>
        </Plane>,
      );
    }
  }
  return <>{tiles}</>;
}

// ─── Small helpers for directing ────────────────────────────────────────────────────────────────

/** 0→1 between two frames with a named ease (for lifts, glare sweeps, text). */
export function progress(frame: number, from: number, to: number, ease: EaseName = "inOut") {
  return EASES[ease](interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
}
