"use client";

// The way into the style gallery: a folder tab on the chat panel's right edge, cut from the same
// surface as the panels (background, border, label type) so it reads as part of the studio.
import { TooltipHint } from "@/components/ui/tooltip";
import { Palette, Plus } from "lucide-react";
import type { MotionStyle } from "@/motion/components";

export function StylesTab({
  style,
  onClick,
  onSave,
  saveDisabled,
}: {
  style: MotionStyle | null;
  onClick(): void;
  onSave(): void;
  saveDisabled: boolean;
}) {
  return (
    <div className="flex w-7 flex-col">
      <TooltipHint
        content={
          style ? `Style: ${style.name}. Browse styles` : "Browse styles"
        }
      >
        <button
          type="button"
          onClick={onClick}
          aria-label="Browse styles"
          className="group flex w-7 flex-col items-center gap-2 rounded-tr-lg border border-l-0 border-brand/70 bg-background py-2.5 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Palette className="size-3.5 text-brand" />
          <span className="text-[10px] font-black tracking-wider uppercase [writing-mode:vertical-rl]">
            {style ? style.name : "Styles"}
          </span>
          {style ? (
            <span className="flex flex-col -space-y-1">
              {[style.tokens.backdrop, style.tokens.accent].map((color, i) => (
                <span
                  key={i}
                  className="size-2.5 rounded-full border border-border"
                  style={{ background: color }}
                />
              ))}
            </span>
          ) : null}
        </button>
      </TooltipHint>
      <TooltipHint content="Save current style">
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          aria-label="Save current style"
          className="flex h-8 w-7 items-center justify-center rounded-br-lg border border-t-0 border-l-0 border-brand/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          <Plus className="size-4" />
        </button>
      </TooltipHint>
    </div>
  );
}
