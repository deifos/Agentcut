"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StyleReel } from "@/components/site/StyleReel";
import { cn } from "@/lib/utils";
import { MOTION_STYLES } from "@/motion/components";

const STYLES = Object.values(MOTION_STYLES);

/** Landing section: one talking-head clip, restyled live by picking a style. */
export function StyleShowcase() {
  const [styleId, setStyleId] = useState(STYLES[0]?.id ?? "");
  const active = MOTION_STYLES[styleId];
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-20">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Styles</p>
        <h2 className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] text-paper md:text-6xl">
          One word restyles the whole video.
        </h2>
        <p className="mt-5 max-w-lg text-lg text-paper/60">
          Captions, graphics, camera moves and texture all follow the project&apos;s style. Same clip, same
          edit: pick one and watch it change.
        </p>
        <div className="mt-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Video style">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={style.id === styleId}
              onClick={() => setStyleId(style.id)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                style.id === styleId
                  ? "border-paper bg-paper text-ink"
                  : "border-paper/15 text-paper/70 hover:border-paper/40 hover:text-paper",
              )}
            >
              <span
                aria-hidden
                className="size-3 rounded-full ring-1 ring-white/20"
                style={{ background: `linear-gradient(135deg, ${style.tokens.backdrop} 50%, ${style.tokens.accent} 50%)` }}
              />
              {style.name}
            </button>
          ))}
        </div>
        <p className="mt-6 min-h-12 max-w-lg text-sm text-paper/50">{active?.description}</p>
        <Link
          href="/templates"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-paper underline-offset-4 hover:underline"
        >
          All styles and templates <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="mx-auto w-full max-w-[340px] rotate-[1.5deg] overflow-hidden rounded-[32px] border-[6px] border-paper/10 bg-black shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
        <StyleReel styleId={styleId} playing />
      </div>
    </div>
  );
}
