import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StyleCarouselClient } from "@/components/site/StyleCarouselClient";
import { MOTION_STYLES } from "@/motion/components/styles";

/** Landing section: one talking-head clip, restyled live by picking a style. */
export function StyleShowcase() {
  const count = Object.keys(MOTION_STYLES).length;
  return (
    <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Styles</p>
        <h2 className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] text-paper md:text-6xl">
          One word restyles the whole video.
        </h2>
        <p className="mt-5 max-w-lg text-lg text-paper/60">
          Captions, graphics, camera moves and texture all follow the project&apos;s style. Same clip, same
          edit, {count} completely different videos. Pick one and watch it slide in.
        </p>
        <Link
          href="/templates"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-paper underline-offset-4 hover:underline"
        >
          All styles and templates <ArrowRight className="size-4" />
        </Link>
      </div>
      <StyleCarouselClient tone="dark" />
    </div>
  );
}
