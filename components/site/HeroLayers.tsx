"use client";

// The hero's right side: the agent building a video. Timeline clips land one by one, the playhead
// sweeps through, the agent's actions pop up, and a live library component plays on top.
import { AudioLines, Captions, Clapperboard, Scissors, Sparkles, Type, Wand2 } from "lucide-react";
import { ComponentPlayer } from "@/components/motion/ComponentPlayer";
import { cn } from "@/lib/utils";

interface Clip {
  left: number;
  width: number;
  label?: string;
  delay: number;
}

const TRACKS: { icon: typeof Type; name: string; color: string; clips: Clip[] }[] = [
  {
    icon: Clapperboard,
    name: "Scenes",
    color: "bg-violet-100 border-violet-200 text-violet-950",
    clips: [
      { left: 0, width: 24, label: "Hook", delay: 0.2 },
      { left: 25, width: 30, label: "Product", delay: 0.6 },
      { left: 56, width: 22, label: "Stat", delay: 1 },
      { left: 79, width: 21, label: "End card", delay: 1.4 },
    ],
  },
  {
    icon: Type,
    name: "Text",
    color: "bg-amber-100 border-amber-200 text-amber-950",
    clips: [
      { left: 6, width: 18, label: "Title", delay: 1.9 },
      { left: 58, width: 26, label: "Kinetic punch", delay: 2.3 },
    ],
  },
  {
    icon: Captions,
    name: "Captions",
    color: "bg-yellow-100 border-yellow-200 text-yellow-950",
    clips: [{ left: 25, width: 52, label: "Word by word", delay: 2.8 }],
  },
  {
    icon: AudioLines,
    name: "Music",
    color: "bg-emerald-100 border-emerald-200 text-emerald-950",
    clips: [{ left: 0, width: 100, delay: 3.3 }],
  },
];

const CHIPS = [
  { icon: Wand2, text: "Placed Kinetic Punch at 0:12", delay: 2.4, className: "right-[4%] top-[47%]" },
  { icon: Scissors, text: "Cut on the beat at 0:06", delay: 4.4, className: "left-[8%] top-[58%]" },
  { icon: Sparkles, text: "Music synced to 112 BPM", delay: 6.2, className: "right-[10%] bottom-[2%]" },
];

// Bar heights in whole percents, so the server and browser render the same markup.
const WAVE = Array.from({ length: 90 }, (_, index) =>
  Math.round(25 + 45 * Math.abs(Math.sin(index * 1.7) * Math.cos(index * 0.43))),
);

export function HeroLayers({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative aspect-[10/9] w-full select-none", className)}>
      {/* Live preview: a real library component, floating over the timeline. */}
      <div
        className="hl-float absolute right-[2%] top-[2%] w-[62%] overflow-hidden rounded-2xl shadow-[0_30px_60px_-20px_rgba(40,20,10,0.5)] ring-1 ring-ink/10"
        style={{ ["--r" as string]: "2deg" }}
      >
        <ComponentPlayer
          id="kinetic-punch"
          props={{
            words: ["Say it.", "Cut it.", "Ship it."],
            accent: "#ff5a36",
            flashBackground: "#ff5a36",
            background: "#14110f",
          }}
        />
      </div>

      {/* The prompt that started it. */}
      <div
        className="hl-float absolute left-0 top-[10%] max-w-[46%] rounded-2xl rounded-bl-md bg-ink px-4 py-3 text-sm leading-snug text-paper shadow-xl"
        style={{ ["--r" as string]: "-2deg", animationDelay: "-2s" }}
      >
        Make it punchier, cut on the beat
        <span className="mt-2 flex items-center gap-1.5 text-[11px] text-paper/50">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" /> Claude is editing…
        </span>
      </div>

      {/* The timeline building itself. */}
      <div className="absolute inset-x-0 bottom-[8%] rounded-3xl border border-ink/10 bg-background p-4 shadow-[0_30px_60px_-30px_rgba(40,20,10,0.45)]">
        <div className="mb-3 flex justify-between pl-[86px] font-mono text-[10px] tabular-nums text-ink/35">
          {["0:00", "0:05", "0:10", "0:15", "0:20"].map((time) => (
            <span key={time}>{time}</span>
          ))}
        </div>
        <div className="space-y-2">
          {TRACKS.map((track) => (
            <div key={track.name} className="flex items-center gap-3">
              <span className="flex w-[74px] shrink-0 items-center gap-1.5 text-[11px] font-semibold text-ink/60">
                <track.icon className="size-3.5" /> {track.name}
              </span>
              <div className="relative h-8 flex-1 rounded-lg bg-muted/70">
                {track.clips.map((clip) => (
                  <div
                    key={clip.left}
                    className={cn(
                      "hl-clip absolute inset-y-0.5 overflow-hidden truncate rounded-md border px-2 text-[11px] font-semibold leading-[26px]",
                      track.color,
                    )}
                    style={{ left: `${clip.left}%`, width: `${clip.width}%`, ["--d" as string]: `${clip.delay}s` }}
                  >
                    {clip.label ?? (
                      <span className="flex h-full items-center justify-between">
                        {WAVE.map((height, index) => (
                          <span
                            key={index}
                            className="hl-wave w-[2px] shrink-0 rounded-full bg-emerald-600/45"
                            style={{ height: `${height}%`, ["--d" as string]: `${(index % 7) * -0.13}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Playhead sweeping across the clip area. */}
        <div className="pointer-events-none absolute bottom-3 left-[102px] right-4 top-3">
          <div className="hl-sweep h-full w-full">
            <div className="relative h-full w-0.5 rounded-full bg-brand">
              <span className="absolute -left-[5px] -top-1 size-3 rounded-full border-2 border-background bg-brand" />
            </div>
          </div>
        </div>
      </div>

      {/* What the agent just did. */}
      {CHIPS.map((chip) => (
        <div
          key={chip.text}
          className={cn(
            "hl-chip absolute z-10 flex items-center gap-2 rounded-full border border-ink/10 bg-background/95 px-3.5 py-2 text-[12px] font-semibold text-ink shadow-lg backdrop-blur",
            chip.className,
          )}
          style={{ ["--d" as string]: `${chip.delay}s` }}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-brand/10 text-brand">
            <chip.icon className="size-3" />
          </span>
          {chip.text}
        </div>
      ))}
    </div>
  );
}
