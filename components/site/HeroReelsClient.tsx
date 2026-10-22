"use client";

import dynamic from "next/dynamic";

// Reel stills are drawn by Remotion in the browser and can't match a server render.
export const HeroReelsClient = dynamic(
  () => import("@/components/site/HeroReels").then((mod) => mod.HeroReels),
  {
    ssr: false,
    loading: () => <div className="mx-auto aspect-[11/10] w-full max-w-[620px]" />,
  },
);
