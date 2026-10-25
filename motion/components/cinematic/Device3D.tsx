// Real 3D devices (iPhone 16 Pro Max model, MacBook, Studio Display) inside a cinematic <Stage>.
// three.js draws them on a full-frame canvas through exactly the Stage's camera, so they move, turn and
// blur with the CSS planes around them. Models come from ScreenSlick's device stage.
import { useLayoutEffect, useRef, useState } from "react";
import { Img, useDelayRender, useRemotionEnvironment, useVideoConfig } from "remotion";
import { blurFor, Group, Plane, useStageContext } from "./Cinematic";
import { mul, placementMatrix, type M4, type Placement } from "./math";
import type { DeviceRenderer, VideoDeviceModelId } from "./devices3d/runtime";

export type Device3DModel = "iphone" | "iphone-color" | "iphone-classic" | "macbook" | "macbook-pro" | "display";

const MODEL_IDS: Record<Device3DModel, VideoDeviceModelId> = {
  iphone: "iphone-16-pro-max",
  "iphone-color": "procedural-iphone",
  "iphone-classic": "procedural-iphone",
  macbook: "procedural-macbook",
  "macbook-pro": "macbook-pro-14",
  display: "procedural-display",
};

/** Default size: the device's largest dimension in world px. */
const DEFAULT_SIZE: Record<Device3DModel, number> = { iphone: 760, "iphone-color": 760, "iphone-classic": 760, macbook: 1250, "macbook-pro": 1250, display: 1150 };

/** Rough footprint (width, height as fractions of size) for the soft shadow behind the device. */
const FOOTPRINT: Record<Device3DModel, [number, number]> = {
  iphone: [0.47, 1],
  "iphone-color": [0.47, 1],
  "iphone-classic": [0.47, 1],
  macbook: [1, 0.62],
  "macbook-pro": [1, 0.62],
  display: [1, 0.86],
};

export const DEVICE_FINISHES: Record<string, string> = {
  silver: "#cfd1d3",
  starlight: "#d9cdb6",
  "space-gray": "#6f7174",
  // The deep anodised black of the current MacBook Pro (matched to a reference model).
  "space-black": "#3d3c40",
  // Colour iPhone finishes (iphone-color), most with calibrated logo tints in iphone-model.ts.
  lavender: "#c5a4df",
  "mist-blue": "#829dce",
  white: "#d9dad6",
  "cosmic-orange": "#c9643a",
  graphite: "#6a6a6a",
  midnight: "#2f3541",
  black: "#3c3d40",
};

export interface Device3DProps extends Placement {
  model: Device3DModel;
  /**
   * Your own GLB for this device (asset("library:models/…")). Required for "macbook-pro", whose model
   * can't ship with Agentcut; optional for the others.
   */
  modelSrc?: string;
  /** Screenshot on the screen (asset("assets/…")). It covers the screen; a taller one shows its top. */
  src?: string;
  /** Largest dimension of the device in world px (iPhone ≈ its height, MacBook ≈ its width). */
  size?: number;
  /**
   * Hardware colour, or any hex. MacBook / display: space-black (MacBook default), space-gray, silver,
   * starlight, midnight, black. iphone-color: graphite (default), lavender, mist-blue, white,
   * cosmic-orange, or a brand hex. The iPhone 16 Pro Max model has its own fixed finish.
   */
  finish?: string;
  /** MacBook lid angle in degrees: 110 open, 0 closed. Animate it for an opening shot. */
  lidAngle?: number;
  /** Scrolls a tall screenshot: 0 top … 1 bottom. */
  scroll?: number;
  /** Light: 1 normal, 0.8 moody, 1.3 bright. */
  exposure?: number;
  /** Soft shadow behind the device: 0 none, 1 strong. */
  shadow?: number;
  /** Lens blur from the Stage's focus and aperture (whole device). */
  dof?: boolean;
  opacity?: number;
  /**
   * Pieces of the screenshot that rise off the device's screen toward the camera (cards, buttons,
   * charts). `box` is [x, y, w, h] in fractions of the SCREENSHOT; `z` how far it rises (world px).
   */
  lifts?: Device3DLift[];
}

export interface Device3DLift {
  box: [number, number, number, number];
  /** Rise toward the viewer, world px (animate 0 → 40–140). */
  z: number;
  /** Extra scale while lifted (1.0–1.15). */
  scale?: number;
  /** Extra offset in world px while lifted (x right, y down). */
  x?: number;
  y?: number;
  radius?: number;
  shadow?: number;
  rim?: number;
  opacity?: number;
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Couldn't load the screen image ${src}.`));
    image.src = src;
  });
}

/** A real 3D device in the Stage, with a screenshot on its screen. */
export function Device3D({
  model,
  modelSrc,
  src,
  size,
  finish,
  lidAngle = 110,
  scroll = 0,
  exposure = 1,
  shadow = 0.6,
  dof = true,
  opacity = 1,
  lifts,
  ...placement
}: Device3DProps) {
  const ctx = useStageContext("Device3D");
  const { width, height } = useVideoConfig();
  const env = useRemotionEnvironment();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const holder = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const [device, setDevice] = useState<DeviceRenderer | null>(null);
  // The built-in MacBook defaults to space black; other devices keep their own default.
  const finishName = finish ?? (model === "macbook" ? "space-black" : model === "iphone-color" ? "graphite" : undefined);
  const finishColor = finishName ? (DEVICE_FINISHES[finishName] ?? finishName) : undefined;
  const deviceSize = size ?? DEFAULT_SIZE[model];

  // Load three, the model and the screenshot; hold the render until the first frame is drawn. A layout
  // effect, so the hold exists before the commit ends (an export or capture can look for holds right
  // after it) and is never created by a render React throws away.
  useLayoutEffect(() => {
    const box = holder.current;
    if (!box) return;
    // A reload (new model, finish or screenshot) holds the render again until it's drawn.
    pending.current ??= delayRender(`Loading the 3D ${model}`, { timeoutInMilliseconds: 60000 });
    const handle = pending.current;
    let alive = true;
    let created: DeviceRenderer | null = null;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%";
    box.appendChild(canvas);
    const image = src ? loadImage(src) : Promise.resolve(null);
    // Handled below; this keeps a failure while the model loads from being reported as unhandled.
    image.catch(() => {});
    (async () => {
      const { createDeviceRenderer } = await import("./devices3d/runtime");
      const renderer = await createDeviceRenderer(canvas, MODEL_IDS[model], finishColor, modelSrc);
      if (!alive) {
        renderer.dispose();
        return;
      }
      created = renderer;
      const loaded = await image;
      if (!alive) return;
      renderer.setImage(loaded);
      setDevice(renderer);
    })().catch((error) => {
      if (alive) cancelRender(error);
    });
    return () => {
      alive = false;
      created?.dispose();
      canvas.remove();
      setDevice(null);
      if (pending.current === handle) {
        continueRender(handle);
        pending.current = null;
      }
    };
  }, [model, modelSrc, finishColor, src, delayRender, continueRender, cancelRender]);

  const matrix = mul(ctx.view, ctx.model, placementMatrix(placement));
  const centerDist = ctx.D - matrix[11];
  const blur = dof ? blurFor(ctx, centerDist) : 0;
  const preview = env.isPlayer && !env.isRendering;

  useLayoutEffect(() => {
    if (!device) return;
    device.render({
      width,
      height,
      D: ctx.D,
      fov: ctx.fov,
      shiftX: ctx.shiftX,
      shiftY: ctx.shiftY,
      matrix,
      size: deviceSize,
      exposure,
      lidAngle,
      scroll,
      // The live preview draws the 3D device at half resolution; captures and exports at full.
      pixelRatio: preview ? 0.5 : 1,
    });
    if (pending.current !== null) {
      continueRender(pending.current);
      pending.current = null;
    }
  });

  const [fw, fh] = FOOTPRINT[model];
  const shadowFill = `rgba(0,0,0,${Math.min(0.8, 0.45 * shadow) * opacity})`;
  // World px: the Plane turns it into its own local px.
  const shadowBlur = Math.max(8, deviceSize * 0.04);
  // Phones float: their shadow falls on a wall behind them. Laptops and displays stand: it pools on
  // the floor under them.
  const laptop = model === "macbook" || model === "macbook-pro";
  const standing = laptop || model === "display";
  return (
    <>
      {shadow > 0 ? (
        <Group {...placement}>
          {standing ? (
            <Plane
              y={deviceSize * fh * 0.5}
              z={laptop ? deviceSize * 0.12 : 0}
              tilt={90}
              width={deviceSize * (laptop ? 1.02 : 0.5)}
              height={deviceSize * (laptop ? 0.72 : 0.3)}
              radius={deviceSize * 0.08}
              background={shadowFill}
              dof={false}
              blur={shadowBlur}
            />
          ) : (
            <Plane
              z={-deviceSize * 0.06}
              y={deviceSize * fh * 0.04}
              width={deviceSize * fw * 0.92}
              height={deviceSize * fh * 0.92}
              radius={deviceSize * fw * 0.12}
              background={shadowFill}
              dof={false}
              blur={shadowBlur}
            />
          )}
        </Group>
      ) : null}
      <div
        ref={holder}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          opacity,
          filter: blur > 0.5 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      />
      {device && src && lifts?.length ? (
        <Group {...placement}>
          {lifts.map((lift, i) => {
            // Lay the piece exactly over its spot on the screen, then raise it along the screen's normal.
            const k = deviceSize / device.targetSize;
            const toWorld = (x: number, y: number): V3 => {
              const p = device.imagePoint(x, y, scroll, lidAngle);
              return [p[0] * k, -p[1] * k, p[2] * k];
            };
            const [bx, by, bw, bh] = lift.box;
            const p0 = toWorld(bx, by);
            const ax = sub(toWorld(bx + bw, by), p0);
            const ay = sub(toWorld(bx, by + bh), p0);
            const w = len(ax);
            const h = len(ay);
            const ex = norm(ax);
            const ey = norm(ay);
            const n = norm(cross(ex, ey));
            // The normal must face the viewer (z+) side of the screen.
            const out: V3 = n[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
            const s = lift.scale ?? 1;
            const c: V3 = [
              p0[0] + ax[0] / 2 + ay[0] / 2 + out[0] * (lift.z + 0.6) + (lift.x ?? 0),
              p0[1] + ax[1] / 2 + ay[1] / 2 + out[1] * (lift.z + 0.6) + (lift.y ?? 0),
              p0[2] + ax[2] / 2 + ay[2] / 2 + out[2] * (lift.z + 0.6),
            ];
            const basis: M4 = [
              ex[0] * s, ey[0] * s, out[0] * s, c[0],
              ex[1] * s, ey[1] * s, out[1] * s, c[1],
              ex[2] * s, ey[2] * s, out[2] * s, c[2],
              0, 0, 0, 1,
            ];
            const fullW = w / bw;
            const fullH = h / bh;
            return (
              <Plane
                key={i}
                basis={basis}
                width={w}
                height={h}
                radius={lift.radius ?? Math.min(w, h) * 0.08}
                shadow={(lift.shadow ?? 0.8) * Math.min(1, lift.z / 40)}
                shadowDepth={Math.max(10, lift.z)}
                rim={lift.rim ?? 0.4}
                opacity={(lift.opacity ?? 1) * opacity}
              >
                <Img src={src} style={{ position: "absolute", left: -bx * fullW, top: -by * fullH, width: fullW, height: fullH }} />
              </Plane>
            );
          })}
        </Group>
      ) : null}
    </>
  );
}
