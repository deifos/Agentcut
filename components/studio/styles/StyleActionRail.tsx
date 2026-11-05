"use client";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
/** The rail takes its own width and cannot extend into the timeline. */
export function StyleActionRail({ children }: { children: ReactNode }) {
  return (
    <ScrollArea
      className="studio-style-rail w-7 min-h-0 shrink-0 self-stretch"
      style={{ containerType: "size", containerName: "style-rail" }}
      viewportProps={{ tabIndex: 0, "aria-label": "Style actions" }}
    >
      <div className="flex flex-col gap-2 py-2">{children}</div>
    </ScrollArea>
  );
}
