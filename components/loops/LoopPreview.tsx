"use client";

import { useEffect, useRef } from "react";
import { LOOP, loopPalette, M, type LoopTone } from "@/motion/components/loops/engine";
import { getLoop } from "@/motion/components/loops/library";

/**
 * A library loop playing live on the site (requestAnimationFrame, only while on screen and playing;
 * a still frame under prefers-reduced-motion). The video pipeline draws the same function per frame
 * through <LoopCanvas>, so what you see is what renders.
 */
export function LoopPreview({
  id,
  accent,
  accent2,
  tone,
  seed = 0,
  speed = 1,
  playing = true,
  className,
}: {
  id: string;
  accent: string;
  accent2: string;
  tone: LoopTone;
  seed?: number;
  speed?: number;
  playing?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ id, accent, accent2, tone, seed, speed, playing });
  // Set by the drawing effect: repaint (or start/stop the clock) after a prop change.
  const update = useRef(() => {});
  useEffect(() => {
    settings.current = { id, accent, accent2, tone, seed, speed, playing };
    update.current();
  }, [id, accent, accent2, tone, seed, speed, playing]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let alive = true;
    let visible = false;
    let raf = 0;
    let clock = 2.4;
    let last = performance.now();
    // Animate only on screen, while playing and without reduced motion; otherwise hold a still frame.
    const animating = () => alive && visible && settings.current.playing && !reduced.matches;
    const paint = () => {
      const s = settings.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const P = loopPalette(s.accent, s.accent2, s.tone);
      ctx.save();
      ctx.fillStyle = P.bg;
      ctx.fillRect(0, 0, w, h);
      getLoop(s.id).draw(ctx, w, h, clock, P, M, s.seed);
      ctx.restore();
    };
    const tick = (now: number) => {
      raf = 0;
      if (!animating()) return;
      clock = (clock + Math.min(0.1, (now - last) / 1000) * settings.current.speed) % LOOP;
      last = now;
      paint();
      raf = requestAnimationFrame(tick);
    };
    const refresh = () => {
      if (!alive) return;
      if (animating()) {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
        return;
      }
      cancelAnimationFrame(raf);
      raf = 0;
      if (visible) paint();
    };
    update.current = refresh;
    const io = new IntersectionObserver(([entry]) => {
      if (!alive) return;
      visible = entry.isIntersecting;
      refresh();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      if (alive && !animating()) paint();
    });
    ro.observe(canvas);
    reduced.addEventListener("change", refresh);
    // One still frame before it scrolls into view (and the frame held for reduced motion or pause).
    paint();
    return () => {
      alive = false;
      update.current = () => {};
      io.disconnect();
      ro.disconnect();
      reduced.removeEventListener("change", refresh);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
