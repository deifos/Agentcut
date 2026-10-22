"use client";

import dynamic from "next/dynamic";

// The studio talks to a helper on this computer and plays Remotion in the
// browser; nothing to render on the server.
const StudioApp = dynamic(() => import("@/components/studio/StudioApp").then((mod) => mod.StudioApp), {
  ssr: false,
  loading: () => <div className="h-dvh bg-background" />,
});

// Created once: the root layout re-renders its children often in development (and on
// navigation), and the studio must not re-render with it while the preview plays.
const studio = <StudioApp />;

export default function StudioPage() {
  return studio;
}
