// Draws a seamless loop (or your own draw function) on a canvas for the current frame.
import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import { LOOP, loopPalette, M, type LoopDraw, type LoopPalette, type LoopTone } from "./engine";
import { getLoop } from "./library";

export interface LoopCanvasProps {
  /** A library loop id (see LOOPS) or your own draw function with the same contract. */
  loop: string | LoopDraw;
  /** Brand colours; the palette's three tones derive from them. */
  accent?: string;
  accent2?: string;
  tone?: LoopTone;
  /** Or a full palette (overrides accent, accent2 and tone). */
  palette?: LoopPalette;
  /** Playback speed (1 = the loop's 12 s cycle). Seamless at any speed; to repeat a clip, make duration × speed a multiple of 12 s. */
  speed?: number;
  /** Shifts where in the cycle it starts (seconds). */
  offset?: number;
  /** Varies the layout of the loop's elements. */
  seed?: number;
  /** Don't fill the background (shapes over footage or a Stage). */
  transparent?: boolean;
  /** Motion blur sub-frames in captures and exports (1 = none, 4 default, 8 for fast loops); the live preview draws 1. */
  blur?: number;
  /**
   * Size in world px. Without them the loop is frame-sized and stretches to fill its parent (a
   * full-frame parent, or one with the frame's aspect). With them it is drawn at exactly that size
   * (CSS too), so it never distorts: pass the size of the box it sits in (a card, a Plane).
   */
  width?: number;
  height?: number;
  style?: CSSProperties;
}

/** A seamless motion loop drawn from the brand palette, frame-accurate in preview and export. */
export function LoopCanvas({
  loop,
  accent = "#7c5cff",
  accent2 = "#ff5ca8",
  tone = "dark",
  palette,
  speed = 1,
  offset = 0,
  seed = 0,
  transparent = false,
  blur = 4,
  width,
  height,
  style,
}: LoopCanvasProps) {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const env = useRemotionEnvironment();
  const ref = useRef<HTMLCanvasElement>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const acc = useRef<Float32Array | null>(null);
  const w = Math.round(width ?? config.width);
  const h = Math.round(height ?? config.height);
  const draw = typeof loop === "function" ? loop : getLoop(loop).draw;
  const P = palette ?? loopPalette(accent, accent2, tone);
  // The live preview skips motion blur; captures and exports draw every sub-frame.
  const samples = env.isPlayer && !env.isRendering ? 1 : Math.max(1, Math.min(12, Math.round(blur)));

  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const paint = (target: CanvasRenderingContext2D, t: number) => {
      target.save();
      target.clearRect(0, 0, w, h);
      if (!transparent) {
        target.fillStyle = P.bg;
        target.fillRect(0, 0, w, h);
      }
      draw(target, w, h, ((t % LOOP) + LOOP) % LOOP, P, M, seed);
      target.restore();
    };
    const t0 = (frame / config.fps) * speed + offset;
    if (samples === 1) {
      paint(ctx, t0);
      return;
    }
    // Average sub-frames across a 180° shutter (half a frame), in premultiplied float so transparent
    // pixels average correctly and 8-bit rounding happens once.
    scratch.current ??= document.createElement("canvas");
    const sc = scratch.current;
    if (sc.width !== w || sc.height !== h) {
      sc.width = w;
      sc.height = h;
    }
    const sctx = sc.getContext("2d", { willReadFrequently: true });
    if (!sctx) return;
    if (acc.current?.length !== w * h * 4) acc.current = new Float32Array(w * h * 4);
    const sum = acc.current;
    sum.fill(0);
    for (let i = 0; i < samples; i++) {
      const dt = ((i + 0.5) / samples - 0.5) * 0.5 * (speed / config.fps);
      paint(sctx, t0 + dt);
      const d = sctx.getImageData(0, 0, w, h).data;
      for (let p = 0; p < d.length; p += 4) {
        const a = d[p + 3];
        if (!a) continue;
        sum[p] += d[p] * a;
        sum[p + 1] += d[p + 1] * a;
        sum[p + 2] += d[p + 2] * a;
        sum[p + 3] += a;
      }
    }
    const out = ctx.createImageData(w, h);
    const o = out.data;
    for (let p = 0; p < o.length; p += 4) {
      const a = sum[p + 3];
      if (!a) continue;
      o[p] = sum[p] / a;
      o[p + 1] = sum[p + 1] / a;
      o[p + 2] = sum[p + 2] / a;
      o[p + 3] = a / samples;
    }
    ctx.putImageData(out, 0, 0);
  });

  const sized = width !== undefined || height !== undefined;
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ position: "absolute", left: 0, top: 0, width: sized ? w : "100%", height: sized ? h : "100%", ...style }}
    />
  );
}
