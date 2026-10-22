"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StyleReel } from "@/components/site/StyleReel";
import { MOTION_STYLES } from "@/motion/components";

const CAMERA_LABEL: Record<string, string> = {
  punch: "Punch-in cuts",
  snap: "Stop-motion steps",
  drift: "Slow drift",
  glitch: "Glitch jumps",
  tape: "Tape wobble",
  still: "Still camera",
};

/** One style: a still of its reel that plays while hovered or focused. */
function StyleCard({ styleId }: { styleId: string }) {
  const style = MOTION_STYLES[styleId];
  const [active, setActive] = useState(false);
  return (
    <article
      tabIndex={0}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className="group outline-none"
    >
      <div className="overflow-hidden rounded-[24px] bg-black shadow-[0_20px_40px_-20px_rgba(40,20,10,0.45)] ring-1 ring-ink/10 transition-transform duration-500 group-hover:-translate-y-1.5 group-focus-visible:ring-2 group-focus-visible:ring-brand">
        <StyleReel styleId={styleId} playing={active} />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span
          aria-hidden
          className="size-3.5 rounded-full ring-1 ring-ink/10"
          style={{ background: `linear-gradient(135deg, ${style.tokens.backdrop} 50%, ${style.tokens.accent} 50%)` }}
        />
        <h3 className="font-display text-xl font-extrabold tracking-tight">{style.name}</h3>
        <span className="ml-auto text-xs text-ink/45">{CAMERA_LABEL[style.camera.mode] ?? style.camera.mode}</span>
      </div>
      <p className="mt-1.5 text-[15px] leading-snug text-ink/60">{style.description}</p>
    </article>
  );
}

export function StylesGrid() {
  return (
    <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {Object.keys(MOTION_STYLES).map((id) => (
        <StyleCard key={id} styleId={id} />
      ))}
    </div>
  );
}

export interface PresetSummary {
  id: string;
  name: string;
  kind: string;
  description: string;
}

/** A whole-video preset: its preview plays on hover. */
export function PresetCard({ preset }: { preset: PresetSummary }) {
  return (
    <article className="group grid overflow-hidden rounded-[28px] border border-ink/10 bg-background md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <video
        src={`/templates/${preset.id}/preview.mp4`}
        poster={`/templates/${preset.id}/poster.jpg`}
        muted
        loop
        playsInline
        preload="none"
        onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
        onMouseLeave={(event) => event.currentTarget.pause()}
        className="aspect-video w-full bg-black object-cover"
      />
      <div className="flex flex-col p-7">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">{preset.kind}</p>
        <h3 className="mt-3 font-display text-3xl font-extrabold tracking-tight">{preset.name}</h3>
        <p className="mt-3 text-ink/60">{preset.description}</p>
        <Link
          href="/studio"
          className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-ink underline-offset-4 hover:underline"
        >
          Use it in the studio <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}
