import type { Metadata } from "next";
import { StylesGridClient } from "@/components/site/StylesGridClient";
import { PresetCard, type PresetSummary } from "@/components/site/TemplatesGallery";
import charcoalSketch from "@/motion/presets/charcoal-sketch/preset.json";
import punkCutPaper from "@/motion/presets/punk-cut-paper/preset.json";

export const metadata: Metadata = {
  title: "Styles and templates",
  description:
    "Editing styles that restyle captions, graphics, camera and texture in one word, plus whole-video templates like lyric videos. All built from Agentcut's motion components.",
  alternates: { canonical: "/templates" },
};

// Whole-video presets (motion/presets); their previews are copied to public/templates/<id>/.
const PRESETS: PresetSummary[] = [
  { id: "punk-cut-paper", ...punkCutPaper },
  { id: "charcoal-sketch", ...charcoalSketch },
];

export default function TemplatesPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-28 pt-14 md:px-8 md:pt-20">
      <p className="site-rise font-mono text-xs uppercase tracking-[0.22em] text-brand">Styles and templates</p>
      <h1
        className="site-rise mt-4 max-w-4xl font-display text-[clamp(3rem,7vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.05em]"
        style={{ ["--i" as string]: 1 }}
      >
        Same clip. <span className="site-cut">Eight</span> different videos.
      </h1>
      <p className="site-rise mt-6 max-w-2xl text-lg text-ink/60" style={{ ["--i" as string]: 2 }}>
        A style is a whole editing look: captions, graphics, camera moves and texture. Set it on a project and
        everything follows. Hover a reel to play it.
      </p>

      <section className="mt-16" aria-label="Editing styles">
        <StylesGridClient />
      </section>

      <section className="site-reveal mt-32" aria-labelledby="presets-title">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Video templates</p>
        <h2
          id="presets-title"
          className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] md:text-6xl"
        >
          Not a talking head? Start from a template.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-ink/60">
          Fill in a few blanks (a song, some photos, a title) and the agent builds the whole video from the
          recipe. Hover to preview.
        </p>
        <div className="mt-12 space-y-8">
          {PRESETS.map((preset) => (
            <PresetCard key={preset.id} preset={preset} />
          ))}
        </div>
      </section>
    </main>
  );
}
