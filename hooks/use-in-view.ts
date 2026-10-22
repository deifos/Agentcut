"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True once the element has come near the viewport (and stays true): for rendering expensive
 * previews only when they're about to be seen.
 */
export function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, seen]);
  return [ref, seen] as const;
}
