import { pageMetadata } from "@/lib/seo";
import { LoopsGallery } from "@/components/loops/LoopsGallery";
import { LOOPS } from "@/motion/components/loops/library";

export const metadata = pageMetadata(
  "Seamless motion loops for video",
  `${LOOPS.length} free seamless motion loops in your brand colours: animated backgrounds, shape animations, kaleidoscopes, morphing shapes, retro games and generative art. Recolour them live and drop them into Remotion videos with Agentcut.`,
  "/loops",
);

export default function LoopsPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-28 pt-14 md:px-8 md:pt-20">
      <p className="site-rise font-mono text-xs uppercase tracking-[0.22em] text-brand">
        {LOOPS.length} seamless motion loops
      </p>
      <h1
        className="site-rise mt-4 max-w-4xl font-display text-[clamp(3rem,7vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.05em]"
        style={{ ["--i" as string]: 1 }}
      >
        Motion loops in <span className="site-cut">your colours.</span>
      </h1>
      <p className="site-rise mt-6 max-w-2xl text-lg text-ink/60" style={{ ["--i" as string]: 2 }}>
        Animated backgrounds, shapes, kaleidoscopes, morphing shapes, little games and generative art. Each one is
        code: a 12 second cycle with no seam, any size, any brand colour. Pick your colours below, then ask your agent
        to use one or drop it on the timeline.
      </p>
      <div className="mt-14">
        <LoopsGallery />
      </div>
    </main>
  );
}
