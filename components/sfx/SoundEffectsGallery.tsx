"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Pause, Play, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { envelopeOf } from "@/components/sfx/sfx-animations";
import { drawScene } from "@/components/sfx/scenes";
import { REST_LEVEL, REST_T } from "@/components/sfx/scenes/kit";
import { SFX_CATEGORIES, SFX_LIBRARY, sfxUrl, type SfxCategory, type SfxEntry } from "@/lib/sfx-library";

const ALL = "all";
type Source = "all" | "recorded" | "designed";

const CATEGORY_LABEL: Record<SfxCategory, string> = {
  click: "Clicks",
  pop: "Pops",
  swoosh: "Swooshes",
  whoosh: "Whooshes",
  impact: "Impacts",
  riser: "Risers",
  sting: "Logo stings",
  notify: "Chimes",
  shimmer: "Shimmers",
  glitch: "Glitches",
  typing: "Typing",
  foley: "Foley",
  divider: "Transitions",
};

/** "es-whoosh-fast-crisp" → "Whoosh fast crisp"; "pop-cute-01" → "Pop cute 01". */
export function sfxTitle(e: SfxEntry) {
  const words = e.id.replace(/^es-/, "").replace(/^pro-/, "").split("-");
  const t = words.join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const downloadName = (e: SfxEntry) => `${e.id.replace(/^es-/, "")}.mp3`;

const MIN_ANIM_S = 0.9;

// One sound at a time across the page.
let stopCurrent: (() => void) | null = null;

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function SfxCard({ entry, index }: { entry: SfxEntry; index: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const env = useRef<Float32Array | null>(null);
  const raf = useRef(0);
  const [playing, setPlaying] = useState(false);

  const paint = (t: number, level: number, time: number, playing = false) => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    drawScene(entry, {
      ctx,
      playing,
      w,
      h,
      t,
      level,
      time,
      brand: cssColor("--brand", "#e8603c"),
      ink: cssColor("--ink", "#2a2622"),
      seed: index,
    });
  };

  const rest = () => paint(REST_T, REST_LEVEL, 0);

  // A still frame at rest (and again when the sound ends).
  useEffect(() => {
    rest();
    const c = canvas.current;
    if (!c) return;
    const ro = new ResizeObserver(() => rest());
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
      audio.current?.pause();
    };
    // paint reads only refs and the stable entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    audio.current?.pause();
    if (audio.current) audio.current.currentTime = 0;
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    rest();
  };

  const play = async () => {
    if (playing) {
      stop();
      stopCurrent = null;
      return;
    }
    stopCurrent?.();
    stopCurrent = stop;
    const src = sfxUrl(entry.file);
    audio.current ??= new Audio(src);
    // Decode once for the loudness envelope that drives the motion.
    if (!env.current) {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new AC();
        const buf = await ac.decodeAudioData(await (await fetch(src)).arrayBuffer());
        env.current = envelopeOf(buf);
        void ac.close();
      } catch {
        env.current = new Float32Array([0.6]);
      }
    }
    const a = audio.current;
    a.currentTime = 0;
    setPlaying(true);
    await a.play().catch(() => undefined);
    const started = performance.now();
    const tick = () => {
      const time = (performance.now() - started) / 1000;
      const dur = a.duration && Number.isFinite(a.duration) ? a.duration : entry.seconds;
      // Tiny ticks last a few frames: give every animation time to play out, with the loudness
      // envelope stretched over it, while the sound itself plays at its real length.
      const span = Math.max(MIN_ANIM_S, dur);
      const t = Math.min(1, time / span);
      const e = env.current!;
      const level = e[Math.min(e.length - 1, Math.floor(t * dur * 100))] ?? 0;
      paint(t, level, time, true);
      if (t >= 1) {
        setPlaying(false);
        rest();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => void play()}
        aria-label={`${playing ? "Stop" : "Play"} ${sfxTitle(entry)}`}
        className="relative block aspect-[16/10] w-full bg-paper focus-visible:outline-2 focus-visible:outline-brand"
      >
        <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
        <span
          className={cn(
            "absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-full bg-ink text-paper shadow transition-transform group-hover:scale-105",
            playing && "bg-brand text-brand-foreground",
          )}
        >
          {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {entry.recorded ? "Recording" : "Designed"}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start gap-2">
          <h3 className="font-display text-base font-extrabold leading-tight tracking-tight">{sfxTitle(entry)}</h3>
          <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">{entry.seconds.toFixed(1)}s</span>
        </div>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {entry.description.replace(/\s*\(earshot [^)]*\)$/, "")}
        </p>
        <a
          href={sfxUrl(entry.file)}
          download={downloadName(entry)}
          className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          <Download className="size-3.5" /> Download MP3
        </a>
      </div>
    </div>
  );
}

/** Every sound effect, playable with its motion graphic, free to download. */
export function SoundEffectsGallery() {
  const [category, setCategory] = useState<string>(ALL);
  const [source, setSource] = useState<Source>("all");
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(
    () =>
      SFX_LIBRARY.filter(
        (e) =>
          (category === ALL || e.category === category) &&
          (source === "all" || (source === "recorded") === e.recorded) &&
          (!words.length ||
            words.every((w) => `${e.id} ${e.category} ${e.description} ${e.useFor}`.toLowerCase().includes(w))),
      ),
    // words is derived from query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, source, query],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of SFX_LIBRARY) if (source === "all" || (source === "recorded") === e.recorded) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [source]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm sm:max-w-sm">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: soft whoosh, logo, typing…"
            className="w-full bg-transparent outline-none"
            aria-label="Search sound effects"
          />
        </label>
        <div className="inline-flex rounded-full border border-border bg-card p-1" role="radiogroup" aria-label="Source">
          {(["all", "recorded", "designed"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={source === s}
              onClick={() => setSource(s)}
              className={cn(
                "h-8 rounded-full px-3.5 text-sm font-semibold transition-colors",
                source === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : s === "recorded" ? "Recordings" : "Designed"}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Categories">
        {[ALL, ...SFX_CATEGORIES.filter((c) => counts[c])].map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
              category === c
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c === ALL ? "All" : CATEGORY_LABEL[c as SfxCategory]}
            <span className="ml-1.5 font-mono text-xs opacity-60">
              {c === ALL ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[c]}
            </span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((e) => (
            <SfxCard key={e.id} entry={e} index={SFX_LIBRARY.indexOf(e)} />
          ))}
        </div>
      ) : (
        <p className="py-20 text-center text-muted-foreground">No sound matches that search.</p>
      )}
    </div>
  );
}
