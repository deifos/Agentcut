"use client";

import dynamic from "next/dynamic";

// Reel stills are drawn by Remotion in the browser and can't match a server render.
export const StyleCarouselClient = dynamic(
  () => import("@/components/site/StyleCarousel").then((mod) => mod.StyleCarousel),
  {
    ssr: false,
    loading: () => <div className="mx-auto aspect-[11/10] w-full max-w-[620px]" />,
  },
);
