"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ComponentPlayer } from "@/components/motion/ComponentPlayer";
import { cn } from "@/lib/utils";
import { COMPONENT_CATEGORIES, MOTION_COMPONENTS } from "@/motion/components";

const ALL = "All";

/** One library component as a card: a still that plays on hover (or always), linking to its page. */
export function ComponentTile({ id, autoPlay = false }: { id: string; autoPlay?: boolean }) {
  const { meta } = MOTION_COMPONENTS[id];
  // Previews play while hovered (or focused); otherwise each shows a still frame.
  const [hovered, setHovered] = useState(false);
  const active = autoPlay || hovered;
  return (
    <Link
      href={`/components/${id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="relative bg-[#0b0d10]">
        <ComponentPlayer
          id={id}
          props={meta.examples[0]?.props}
          playing={active}
        />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 backdrop-blur">
          {meta.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg font-extrabold tracking-tight">{meta.name}</h3>
          <ArrowUpRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" />
        </div>
        <p className="line-clamp-2 text-[15px] leading-snug text-muted-foreground">
          {meta.description}
        </p>
      </div>
    </Link>
  );
}

export function ComponentGallery() {
  const ids = Object.keys(MOTION_COMPONENTS);
  const used = COMPONENT_CATEGORIES.filter((category) =>
    ids.some((id) => MOTION_COMPONENTS[id].meta.category === category),
  );
  const [category, setCategory] = useState<string>(ALL);
  const shown = ids.filter(
    (id) =>
      category === ALL || MOTION_COMPONENTS[id].meta.category === category,
  );
  return (
    <div>
      <div
        className="mb-8 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Categories"
      >
        {[ALL, ...used].map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={category === name}
            onClick={() => setCategory(name)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
              category === name
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((id) => (
          <ComponentTile key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
