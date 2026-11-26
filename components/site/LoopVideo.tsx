"use client";

import { cn } from "@/lib/utils";

/** A silent looping clip that plays only while it is on screen, and not at all with reduced motion. */
export function LoopVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster: string;
  className?: string;
}) {
  return (
    <video
      ref={(video) => {
        if (!video) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) video.play().catch(() => {});
          else video.pause();
        });
        observer.observe(video);
        return () => observer.disconnect();
      }}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}
