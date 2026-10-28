"use client";

import dynamic from "next/dynamic";
import { useInView } from "@/hooks/use-in-view";

const PLACEHOLDER = "mx-auto aspect-[11/10] w-full max-w-[620px]";

// Reel stills are drawn by Remotion in the browser and can't match a server render.
const StyleCarousel = dynamic(
  () => import("@/components/site/StyleCarousel").then((mod) => mod.StyleCarousel),
  {
    ssr: false,
    loading: () => <div className={PLACEHOLDER} />,
  },
);

/** Loads the carousel (its code and the demo clip) only as it nears the viewport. */
export function StyleCarouselClient(props: { tone?: "light" | "dark" }) {
  const [ref, inView] = useInView<HTMLDivElement>("600px");
  if (inView) return <StyleCarousel {...props} />;
  return <div ref={ref} className={PLACEHOLDER} />;
}
