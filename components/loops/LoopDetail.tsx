"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Pause, Play } from "lucide-react";
import { LoopPreview } from "@/components/loops/LoopPreview";
import { BRAND_PAIRS, ColorField, ToneSwitch } from "@/components/loops/LoopsGallery";
import type { LoopTone } from "@/motion/components/loops/engine";
import { getLoop, LOOPS } from "@/motion/components/loops/library";

function CopyBlock({ title, code, wrap = false }: { title: string; code: string; wrap?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), 1600);
            } catch {}
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? `${title} copied` : ""}
        </span>
      </div>
      <pre className={`overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-muted-foreground ${wrap ? "whitespace-pre-wrap" : ""}`}>{code}</pre>
    </div>
  );
}

export function LoopDetail({ id }: { id: string }) {
  const loop = getLoop(id);
  const [accent, setAccent] = useState(BRAND_PAIRS[1][0]);
  const [accent2, setAccent2] = useState(BRAND_PAIRS[1][1]);
  const [tone, setTone] = useState<LoopTone>("dark");
  const [seed, setSeed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const related = LOOPS.filter((l) => l.category === loop.category && l.id !== loop.id).slice(0, 3);
  const props = { loop: loop.id, tone, accent, accent2, ...(seed ? { seed } : {}), ...(speed !== 1 ? { speed } : {}) };

  return (
    <div>
      <Link href="/loops" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All loops
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-border shadow-xl">
            <LoopPreview id={loop.id} accent={accent} accent2={accent2} tone={tone} seed={seed} speed={speed} playing={playing} className="absolute inset-0 size-full" />
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
              className="absolute bottom-4 left-4 flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/70"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ColorField label="Brand" value={accent} onChange={setAccent} />
            <ColorField label="Second" value={accent2} onChange={setAccent2} />
            <ToneSwitch tone={tone} onChange={setTone} />
            <label className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium">
              Layout
              <input type="range" min={0} max={20} value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-24 accent-brand" />
            </label>
            <label className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium">
              Speed
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-transparent">
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
              </select>
            </label>
          </div>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-brand">{loop.category} · seamless 12 s loop</p>
          <h1 className="mt-3 font-display text-5xl font-extrabold tracking-[-0.04em]">{loop.name}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{loop.description}</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {loop.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {tag}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-4">
            <CopyBlock
              wrap
              title="Ask your agent"
              code={`Put the "${loop.name}" motion loop behind this shot in my brand colours (${accent}, ${accent2}), ${tone === "accent" ? "brand" : tone} tone.`}
            />
            <CopyBlock title="Timeline clip (layers.json)" code={JSON.stringify({ component: "motion-loop", props }, null, 2)} />
            <CopyBlock
              title="In a scene"
              code={`import { LoopCanvas } from "agentcut/components";\n\n<LoopCanvas loop="${loop.id}" accent="${accent}" accent2="${accent2}" tone="${tone}"${seed ? ` seed={${seed}}` : ""}${speed !== 1 ? ` speed={${speed}}` : ""} />`}
            />
          </div>
        </div>
      </div>
      {related.length ? (
        <div className="mt-20">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">More {loop.category.toLowerCase()} loops</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.id} href={`/loops/${r.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative aspect-video">
                  <LoopPreview id={r.id} accent={accent} accent2={accent2} tone={tone} className="absolute inset-0 size-full" />
                </div>
                <h3 className="p-4 font-display text-lg font-extrabold tracking-tight group-hover:text-brand">{r.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
