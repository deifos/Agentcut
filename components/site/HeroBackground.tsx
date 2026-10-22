"use client";

import dynamic from "next/dynamic";

// WebGL, browser only.
const GradientASCII = dynamic(() => import("@/components/site/GradientASCII"), { ssr: false });

const COLORS = ["#ff5a36", "#ffb37a", "#f6c7e8", "#b9a6ff"];

/** The hero's backdrop: soft brand-colored glows drawn in ASCII, fading out toward the studio. */
export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[880px] [mask-image:linear-gradient(to_bottom,black_45%,transparent_95%)]"
    >
      {/* Painted with the HTML, so the hero has its color before the ASCII layer loads. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: [
            `radial-gradient(55% 60% at 62% 0%, ${COLORS[1]} 0%, transparent 70%)`,
            `radial-gradient(40% 55% at 92% 10%, ${COLORS[3]} 0%, transparent 70%)`,
            `radial-gradient(45% 50% at 78% 45%, ${COLORS[0]}66 0%, transparent 70%)`,
            `radial-gradient(40% 45% at 40% 15%, ${COLORS[2]} 0%, transparent 70%)`,
          ].join(", "),
        }}
      />
      <GradientASCII
        className="site-fade"
        lightMode
        intro={false}
        shape="horizon"
        colors={COLORS}
        glyphOpacity={0.4}
        gradientOpacity={0.5}
        cellSize={16}
        speed={0.7}
        clickEffect="none"
      />
      {/* Keeps the headline and copy readable over the glyphs. */}
      <div className="absolute inset-0 bg-gradient-to-r from-paper/85 via-paper/35 to-transparent" />
    </div>
  );
}
