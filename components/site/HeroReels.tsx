"use client";

// The hero's right side: one real clip, restyled by a prompt every few seconds. The center phone
// plays the current style's reel; the neighbours sit behind it as stills.
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { StyleReel } from "@/components/site/StyleReel";
import { cn } from "@/lib/utils";
import { MOTION_STYLES } from "@/motion/components";

const STYLES = Object.values(MOTION_STYLES);
const CYCLE_MS = 4800;

function Phone({ styleId, playing, className }: { styleId: string; playing: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[30px] border-[5px] border-ink bg-ink shadow-[0_40px_70px_-25px_rgba(40,20,10,0.6)]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[24px]">
        <StyleReel styleId={styleId} playing={playing} />
      </div>
    </div>
  );
}

export function HeroReels() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Advance through the styles; picking one by hand restarts the timer.
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % STYLES.length), CYCLE_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused]);

  const current = STYLES[index];
  const prev = STYLES[(index - 1 + STYLES.length) % STYLES.length];
  const next = STYLES[(index + 1) % STYLES.length];
  const words = `Restyle it as ${current.name}`.split(" ");

  return (
    <div
      className="relative mx-auto aspect-[11/10] w-full max-w-[620px] select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Neighbouring styles, tilted behind. */}
      <Phone
        styleId={prev.id}
        playing={false}
        className="absolute left-[6%] top-[12%] w-[30%] -rotate-[9deg] opacity-80 blur-[0.5px]"
      />
      <Phone
        styleId={next.id}
        playing={false}
        className="absolute right-[6%] top-[12%] w-[30%] rotate-[9deg] opacity-80 blur-[0.5px]"
      />

      {/* The current style, playing. */}
      <Phone styleId={current.id} playing className="absolute left-1/2 top-0 z-10 w-[42%] -translate-x-1/2" />

      {/* The prompt that restyles it. */}
      <div
        key={`prompt-${current.id}`}
        className="absolute left-0 top-[6%] z-20 max-w-[42%] rounded-2xl rounded-bl-md bg-ink px-4 py-3 text-sm font-medium text-paper shadow-xl"
      >
        {words.map((word, i) => (
          <span key={i} className="site-word" style={{ ["--i" as string]: i, animationDelay: `${0.1 + i * 0.09}s` }}>
            {word}{" "}
          </span>
        ))}
      </div>

      {/* What the agent changed. */}
      <div
        key={`done-${current.id}`}
        className="site-step absolute bottom-[16%] right-0 z-20 flex items-center gap-2 rounded-full border border-ink/10 bg-background/95 px-3.5 py-2 text-[12px] font-semibold shadow-lg backdrop-blur"
        style={{ animationDelay: "0.9s" }}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="size-3" />
        </span>
        Captions, camera and graphics restyled
      </div>

      {/* Every style: click to jump. */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Video style">
        {STYLES.map((style, i) => (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={i === index}
            onClick={() => setIndex(i)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
              i === index
                ? "border-ink bg-ink text-paper"
                : "border-ink/10 bg-background/80 text-ink/60 hover:border-ink/30 hover:text-ink",
            )}
          >
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ background: `linear-gradient(135deg, ${style.tokens.backdrop} 50%, ${style.tokens.accent} 50%)` }}
            />
            {style.name}
          </button>
        ))}
      </div>
    </div>
  );
}
