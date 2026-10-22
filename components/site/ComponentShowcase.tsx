import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ComponentTile } from "@/components/motion/ComponentGallery";
import { COMPONENT_METAS } from "@/motion/components/catalog";

// A spread across categories; previews stay still until interaction.
const FEATURED = [
  "kinetic-poster",
  "prompt-box",
  "stat-counter",
  "chat-thread",
  "split-flap",
  "sticker-slam",
];

export function ComponentShowcase() {
  const count = Object.keys(COMPONENT_METAS).length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            Components
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] md:text-6xl">
            {count} motion components, ready to drop in.
          </h2>
        </div>
        <Link
          href="/components"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 px-5 text-sm font-semibold transition-colors hover:border-ink"
        >
          Browse all {count} <ArrowRight className="size-4" />
        </Link>
      </div>
      <p className="mt-4 max-w-xl text-lg text-ink/60">
        Titles, lower thirds, stats, chat threads, transitions. Hover to play.
        The agent uses them by name, and you tune their props in the inspector.
      </p>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED.filter((id) => COMPONENT_METAS[id]).map((id) => (
          <ComponentTile key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
