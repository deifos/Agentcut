"use client";

import dynamic from "next/dynamic";

// WebGL, browser only.
const GradientASCII = dynamic(() => import("@/components/site/GradientASCII"), { ssr: false });

/** The hero's backdrop: soft brand-colored glows drawn in ASCII, fading out toward the studio. */
export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[880px] [mask-image:linear-gradient(to_bottom,black_45%,transparent_95%)]"
    >
      <GradientASCII
        lightMode
        shape="horizon"
        colors={["#ff5a36", "#ffb37a", "#f6c7e8", "#b9a6ff"]}
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
