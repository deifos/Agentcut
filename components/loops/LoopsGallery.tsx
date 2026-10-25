"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoopPreview } from "@/components/loops/LoopPreview";
import { LOOP_CATEGORIES, type LoopTone } from "@/motion/components/loops/engine";
import { LOOPS } from "@/motion/components/loops/library";

const ALL = "All";

export const BRAND_PAIRS: [string, string][] = [
  ["#7c5cff", "#ff5ca8"],
  ["#f97316", "#ec4899"],
  ["#22d3ee", "#a78bfa"],
  ["#10b981", "#facc15"],
  ["#2563eb", "#f472b6"],
  ["#e11d48", "#fbbf24"],
];

export function ToneSwitch({ tone, onChange }: { tone: LoopTone; onChange(tone: LoopTone): void }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Tone">
      {(["dark", "accent", "light"] as const).map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={tone === t}
          onClick={() => onChange(t)}
          className={cn(
            "h-8 rounded-full px-3.5 text-sm font-semibold capitalize transition-colors",
            tone === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t === "accent" ? "Brand" : t}
        </button>
      ))}
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card pl-1.5 pr-3.5 text-sm font-medium">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
      />
      {label}
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}

/** Every loop playing live, recoloured with your brand colours. */
export function LoopsGallery() {
  const [accent, setAccent] = useState(BRAND_PAIRS[0][0]);
  const [accent2, setAccent2] = useState(BRAND_PAIRS[0][1]);
  const [tone, setTone] = useState<LoopTone>("dark");
  const [category, setCategory] = useState<string>(ALL);
  const shown = LOOPS.filter((l) => category === ALL || l.category === category);
  const used = LOOP_CATEGORIES.filter((c) => LOOPS.some((l) => l.category === c));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ColorField label="Brand" value={accent} onChange={setAccent} />
        <ColorField label="Second" value={accent2} onChange={setAccent2} />
        <button
          type="button"
          onClick={() => {
            const pair = BRAND_PAIRS[(BRAND_PAIRS.findIndex((p) => p[0] === accent) + 1) % BRAND_PAIRS.length];
            setAccent(pair[0]);
            setAccent2(pair[1]);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <Shuffle className="size-4" /> Another palette
        </button>
        <ToneSwitch tone={tone} onChange={setTone} />
      </div>
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Categories">
        {[ALL, ...used].map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
              category === name
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
            <span className="ml-1.5 font-mono text-xs opacity-60">
              {name === ALL ? LOOPS.length : LOOPS.filter((l) => l.category === name).length}
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((loop) => (
          <Link
            key={loop.id}
            href={`/loops/${loop.id}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-brand"
          >
            <div className="relative aspect-video">
              {/* Default layout (seed 0), the same as the loop's page and a clip without a seed. */}
              <LoopPreview id={loop.id} accent={accent} accent2={accent2} tone={tone} className="absolute inset-0 size-full" />
              <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 backdrop-blur">
                {loop.category}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-5">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-extrabold tracking-tight">{loop.name}</h2>
                <ArrowUpRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
              </div>
              <p className="line-clamp-2 text-[15px] leading-snug text-muted-foreground">{loop.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
