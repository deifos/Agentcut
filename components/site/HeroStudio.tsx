"use client";

// The hero: a studio window that plays itself. The prompt types, the agent's steps tick in, and a
// real Remotion reel plays above a mini timeline whose playhead follows the player.
import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ArrowUp, Check } from "lucide-react";
import { REEL_FRAMES, REEL_SHOTS, ShowcaseReel } from "@/components/site/showcase-reel";
import { cn } from "@/lib/utils";

const PROMPT = "Make a 20s launch video for my app";

const STEPS = [
  "Read the brief and the app's README",
  "Wrote scenes/Hook.tsx",
  "Placed 6 library components",
  "Checked 4 frames, fixed one overlap",
  "Done: 20 s, wide and mobile",
];

// Pastel clip colors, the same family as the studio timeline.
const CLIP_COLORS = [
  "bg-violet-100 text-violet-950 border-violet-200",
  "bg-sky-100 text-sky-950 border-sky-200",
  "bg-amber-100 text-amber-950 border-amber-200",
  "bg-emerald-100 text-emerald-950 border-emerald-200",
  "bg-rose-100 text-rose-950 border-rose-200",
  "bg-teal-100 text-teal-950 border-teal-200",
];

export function HeroStudio() {
  const playerRef = useRef<PlayerRef>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Follow the player's frame with a CSS variable, so the playhead moves without re-rendering.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => {
      timelineRef.current?.style.setProperty("--p", String(event.detail.frame / REEL_FRAMES));
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, []);

  return (
    <div className="overflow-hidden rounded-[28px] border border-ink/10 bg-background shadow-[0_40px_80px_-30px_rgba(40,20,10,0.35)]">
      <div className="flex h-11 items-center gap-3 border-b border-ink/5 px-5 text-xs text-ink/50">
        <span className="font-display text-sm font-bold text-ink">launch-video</span>
        <span className="hidden sm:inline">wide · 1920×1080 · 30 fps</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" /> Claude Code
        </span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 border-b border-ink/5 p-5 md:border-b-0 md:border-r">
          <p className="ml-auto max-w-full rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-paper">
            {PROMPT.split(" ").map((word, index) => (
              <span key={index} className="site-word" style={{ ["--i" as string]: index }}>
                {word}{" "}
              </span>
            ))}
          </p>
          <ul className="mt-1 space-y-2 text-[13px] text-ink/70">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className="site-step flex items-start gap-2"
                style={{ ["--i" as string]: index }}
              >
                <Check
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    index === STEPS.length - 1 ? "text-brand" : "text-emerald-600",
                  )}
                />
                <span className={cn(index === STEPS.length - 1 && "font-semibold text-ink")}>{step}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center gap-2 rounded-2xl border border-ink/10 px-3.5 py-2.5 text-[13px] text-ink/40">
            Describe a change, or point at a frame
            <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-ink text-paper">
              <ArrowUp className="size-3.5" />
            </span>
          </div>
        </div>
        <div className="min-w-0 bg-muted/60 p-4 md:p-5">
          <div className="overflow-hidden rounded-xl shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
            <Player
              ref={playerRef}
              component={ShowcaseReel}
              durationInFrames={REEL_FRAMES}
              fps={30}
              compositionWidth={1920}
              compositionHeight={1080}
              autoPlay
              loop
              initiallyMuted
              clickToPlay={false}
              acknowledgeRemotionLicense
              style={{ width: "100%", aspectRatio: "16 / 9" }}
            />
          </div>
          <div ref={timelineRef} className="relative mt-4 space-y-1.5" style={{ ["--p" as string]: 0 }}>
            <div className="flex gap-1">
              {REEL_SHOTS.map((shot, index) => (
                <div
                  key={shot.id}
                  className={cn(
                    "h-7 min-w-0 truncate rounded-lg border px-2 text-[11px] font-semibold leading-[26px]",
                    CLIP_COLORS[index % CLIP_COLORS.length],
                  )}
                  style={{ flexGrow: shot.durationInFrames, flexBasis: 0 }}
                >
                  {shot.label}
                </div>
              ))}
            </div>
            <div className="h-5 rounded-lg border border-emerald-200 bg-emerald-50 bg-[repeating-linear-gradient(90deg,transparent_0_3px,rgb(16_185_129/0.35)_3px_4px)] bg-[length:100%_60%] bg-center bg-no-repeat" />
            <div
              aria-hidden
              className="pointer-events-none absolute -top-1.5 bottom-[-6px] w-0.5 rounded-full bg-ink"
              style={{ left: "calc(var(--p) * 100%)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
