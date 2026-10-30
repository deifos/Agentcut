"use client";

import { Loader2 } from "lucide-react";

/** Reports actual running/checking state. It never estimates progress. */
export function PreviewWorkingStatus({
  agentName,
  checking,
}: {
  agentName: string;
  checking: boolean;
}) {
  return (
    <div
      className="preview-working-status pointer-events-none absolute inset-x-3 top-4 z-10 flex justify-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex max-w-full items-center gap-3 rounded-2xl border border-white/20 bg-neutral-950/85 px-4 py-3 text-white shadow-xl backdrop-blur-md sm:gap-4 sm:px-5 sm:py-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10"
          aria-hidden="true"
        >
          <Loader2 className="size-5 animate-spin text-white motion-reduce:animate-none" />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[clamp(14px,1.2vw,18px)] leading-snug font-semibold">
            {checking
              ? `${agentName} is checking playback`
              : `${agentName} is editing your video`}
          </span>
          <span className="max-w-sm text-xs leading-relaxed text-white/75 sm:text-sm">
            {checking
              ? "The preview plays while performance is checked."
              : "Your preview stays visible while the agent works."}
          </span>
        </span>
      </div>
    </div>
  );
}
