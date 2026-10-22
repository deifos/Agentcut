import { pageMetadata } from "@/lib/seo";
import { ComponentGallery } from "@/components/motion/ComponentGallery";
import { COMPONENT_METAS } from "@/motion/components/catalog";

export const metadata = pageMetadata(
  "Remotion motion components",
  "Browse ready-made Remotion animations: kinetic titles, lower thirds, captions, counters, and transitions. Preview and customize them in Agentcut.",
  "/components",
);

export default function ComponentsPage() {
  const count = Object.keys(COMPONENT_METAS).length;
  return (
    <main className="mx-auto max-w-7xl px-5 pb-28 pt-14 md:px-8 md:pt-20">
      <p className="site-rise font-mono text-xs uppercase tracking-[0.22em] text-brand">
        {count} motion components
      </p>
      <h1
        className="site-rise mt-4 max-w-4xl font-display text-[clamp(3rem,7vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.05em]"
        style={{ ["--i" as string]: 1 }}
      >
        Animations you tune, <span className="site-cut">not code.</span>
      </h1>
      <p
        className="site-rise mt-6 max-w-2xl text-lg text-ink/60"
        style={{ ["--i" as string]: 2 }}
      >
        Hover to preview, open one to tune its props, then ask your agent to use
        it or drop it on the timeline yourself. Every one works in 16:9 and 9:16
        and exports right in the browser.
      </p>
      <div className="mt-14">
        <ComponentGallery />
      </div>
    </main>
  );
}
