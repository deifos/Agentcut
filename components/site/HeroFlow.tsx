"use client";

// The hero's motion graphic: a prompt turning into a video. Ribbons of light flow out of the prompt,
// undulating, and particles race along them into the timeline tracks, which pulse as they land.
// Drawn on a canvas; pauses offscreen and holds a still frame under reduced motion.
import { useEffect, useRef } from "react";
import { AudioLines, Captions, Clapperboard, Image as ImageIcon, Type } from "lucide-react";
import { cn } from "@/lib/utils";

// Track rows on the right (y as a fraction of the height), each with its own color.
const TRACKS = [
  { name: "Scenes", icon: Clapperboard, y: 0.2, rgb: [139, 92, 246], clip: "bg-violet-100 border-violet-200 text-violet-950", clips: [[0, 30], [32, 28], [62, 38]] },
  { name: "Text", icon: Type, y: 0.35, rgb: [245, 158, 11], clip: "bg-amber-100 border-amber-200 text-amber-950", clips: [[8, 34], [58, 30]] },
  { name: "Captions", icon: Captions, y: 0.5, rgb: [234, 179, 8], clip: "bg-yellow-100 border-yellow-200 text-yellow-950", clips: [[18, 64]] },
  { name: "Images", icon: ImageIcon, y: 0.65, rgb: [20, 184, 166], clip: "bg-teal-100 border-teal-200 text-teal-950", clips: [[4, 30], [44, 26]] },
  { name: "Music", icon: AudioLines, y: 0.8, rgb: [16, 185, 129], clip: "bg-emerald-100 border-emerald-200 text-emerald-950", clips: [[0, 100]] },
] as const;

const BRAND: [number, number, number] = [240, 83, 45];
const SOURCE = { x: 0.14, y: 0.5 };
const TRACK_X = 0.5;
const STRANDS = 7;

interface Strand {
  track: number;
  offset: number;
  phase: number;
  speed: number;
  width: number;
}

interface Particle {
  strand: number;
  u: number;
  speed: number;
  size: number;
}

/** A point on a cubic Bézier. */
function bezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const m = 1 - t;
  return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3;
}

// Deterministic "random" so every load draws the same composition.
function seeded(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

const STRAND_LIST: Strand[] = TRACKS.flatMap((_, track) =>
  Array.from({ length: STRANDS }, (_, k) => ({
    track,
    offset: (k - (STRANDS - 1) / 2) * 0.012,
    phase: seeded(track * 10 + k) * Math.PI * 2,
    speed: 0.35 + seeded(track * 7 + k * 3) * 0.4,
    width: 0.6 + seeded(track + k * 11) * 1.1,
  })),
);

const PARTICLE_SEEDS: Particle[] = Array.from({ length: 64 }, (_, i) => ({
  strand: Math.floor(seeded(i * 3.7) * STRAND_LIST.length),
  u: seeded(i * 9.1),
  speed: 0.0025 + seeded(i * 5.3) * 0.004,
  size: 1.6 + seeded(i * 2.9) * 2.2,
}));

export function HeroFlow({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!wrap || !canvas || !ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizer = new ResizeObserver(resize);
    resizer.observe(wrap);

    // The strand's control points move with time, so the ribbons breathe and sway.
    const strandPath = (strand: Strand, time: number) => {
      const track = TRACKS[strand.track];
      const sx = SOURCE.x * width;
      const sy = SOURCE.y * height;
      const ex = TRACK_X * width;
      const ey = (track.y + strand.offset) * height;
      const wave = Math.sin(time * strand.speed + strand.phase);
      const wave2 = Math.cos(time * strand.speed * 0.8 + strand.phase * 1.3);
      return {
        x: [sx, sx + width * 0.16, ex - width * 0.18, ex],
        y: [sy, sy + wave * height * 0.32, ey + wave2 * height * 0.12, ey],
      };
    };

    const particles = PARTICLE_SEEDS.map((particle) => ({ ...particle }));
    const pulses = TRACKS.map(() => 0);
    let raf = 0;
    let running = false;

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Faint concentric rings around the prompt, slowly turning: the "motion graphics" layer.
      const cx = SOURCE.x * width;
      const cy = SOURCE.y * height;
      for (let r = 1; r <= 4; r += 1) {
        ctx.beginPath();
        ctx.setLineDash([2, 10 + r * 4]);
        ctx.lineDashOffset = (r % 2 ? 1 : -1) * time * 12;
        ctx.strokeStyle = `rgba(29, 25, 22, ${0.12 - r * 0.02})`;
        ctx.lineWidth = 1;
        ctx.arc(cx, cy, 34 + r * 26, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Ribbons: brand at the prompt, fading into each track's color.
      ctx.globalCompositeOperation = "multiply";
      for (const strand of STRAND_LIST) {
        const path = strandPath(strand, time);
        const [r, g, b] = TRACKS[strand.track].rgb;
        const gradient = ctx.createLinearGradient(path.x[0], 0, path.x[3], 0);
        gradient.addColorStop(0, `rgba(${BRAND.join(",")}, 0.55)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.6)`);
        ctx.beginPath();
        ctx.moveTo(path.x[0], path.y[0]);
        ctx.bezierCurveTo(path.x[1], path.y[1], path.x[2], path.y[2], path.x[3], path.y[3]);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = strand.width;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";

      // Particles with short glowing trails; landing pulses their track.
      for (const particle of particles) {
        const strand = STRAND_LIST[particle.strand];
        const path = strandPath(strand, time);
        const [r, g, b] = TRACKS[strand.track].rgb;
        for (let k = 6; k >= 0; k -= 1) {
          const t = Math.max(0, particle.u - k * 0.012);
          const x = bezier(t, path.x[0], path.x[1], path.x[2], path.x[3]);
          const y = bezier(t, path.y[0], path.y[1], path.y[2], path.y[3]);
          const mix = Math.min(1, t * 1.4);
          const color = BRAND.map((c, i) => Math.round(c + ([r, g, b][i] - c) * mix)).join(",");
          ctx.beginPath();
          ctx.fillStyle = `rgba(${color}, ${k === 0 ? 0.95 : 0.35 * (1 - k / 7)})`;
          ctx.arc(x, y, particle.size * (1 - k / 9), 0, Math.PI * 2);
          ctx.fill();
        }
        particle.u += particle.speed;
        if (particle.u >= 1) {
          particle.u = 0;
          pulses[strand.track] = 1;
        }
      }

      // Track pulses decay; drive them through a CSS variable on each row.
      pulses.forEach((value, index) => {
        trackRefs.current[index]?.style.setProperty("--pulse", value.toFixed(3));
        pulses[index] = value * 0.93;
      });
    };

    const loop = (now: number) => {
      draw(now / 1000);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) {
      draw(2.4);
      return () => resizer.disconnect();
    }
    const visibility = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    visibility.observe(wrap);
    return () => {
      stop();
      visibility.disconnect();
      resizer.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} aria-hidden className={cn("relative aspect-[11/10] w-full select-none", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {/* The prompt the ribbons come out of. */}
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${SOURCE.x * 100}%`, top: `${SOURCE.y * 100}%` }}
      >
        <div className="relative flex size-[88px] items-center justify-center rounded-full bg-ink text-paper shadow-[0_20px_40px_-12px_rgba(40,20,10,0.55)]">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/25 [animation-duration:2.4s]" />
          <span className="relative text-center font-display text-[13px] font-extrabold leading-tight">
            your
            <br />
            prompt
          </span>
        </div>
      </div>

      {/* The tracks the video lands on. */}
      {TRACKS.map((track, index) => (
        <div
          key={track.name}
          ref={(node) => {
            trackRefs.current[index] = node;
          }}
          className="absolute z-10 flex -translate-y-1/2 items-center gap-2"
          style={{ left: `${TRACK_X * 100}%`, right: 0, top: `${track.y * 100}%`, ["--pulse" as string]: 0 }}
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-ink/10"
            style={{ transform: "scale(calc(1 + var(--pulse) * 0.25))" }}
          >
            <track.icon className="size-3.5 text-ink/70" />
          </span>
          <div
            className="relative h-9 flex-1 rounded-xl bg-background/80 p-1 shadow-sm ring-1 ring-ink/5 backdrop-blur"
            style={{ boxShadow: `0 0 calc(var(--pulse) * 28px) rgba(${track.rgb.join(",")}, calc(var(--pulse) * 0.55))` }}
          >
            {track.clips.map(([left, clipWidth]) => (
              <div
                key={left}
                className={cn("absolute inset-y-1 truncate rounded-lg border px-2 text-[10px] font-semibold leading-[26px]", track.clip)}
                style={{ left: `calc(${left}% + 4px)`, width: `calc(${clipWidth}% - 8px)` }}
              >
                {left === track.clips[0][0] ? track.name : ""}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Playhead sweeping the tracks. */}
      <div className="pointer-events-none absolute bottom-[12%] right-0 top-[12%] z-20" style={{ left: `calc(${TRACK_X * 100}% + 36px)` }}>
        <div className="hl-sweep h-full w-full">
          <div className="relative h-full w-0.5 rounded-full bg-brand shadow-[0_0_12px_var(--brand)]">
            <span className="absolute -left-[5px] -top-1.5 size-3 rounded-full border-2 border-background bg-brand" />
          </div>
        </div>
      </div>
    </div>
  );
}
