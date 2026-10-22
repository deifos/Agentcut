"use client";

import dynamic from "next/dynamic";

// Reel stills are drawn by Remotion with random jitter and measured fonts, so they can't match a
// server render: draw the grid in the browser only.
export const StylesGridClient = dynamic(
  () => import("@/components/site/TemplatesGallery").then((mod) => mod.StylesGrid),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="aspect-[9/16] animate-pulse rounded-[24px] bg-ink/5" />
        ))}
      </div>
    ),
  },
);
