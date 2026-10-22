"use client";

// The pictures a chat step showed the agent (studio frame captures, contact sheets, images it read).
import { createContext, useContext, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { studioFileUrl } from "@/lib/studio/bundle";
import { useAgentName } from "@/components/studio/StudioAgent";

/** The open project's slug, so chat rows can build file URLs without threading props. */
export const ChatSlugContext = createContext<string | null>(null);

const SHOWN = 6;

export function StepImages({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const slug = useContext(ChatSlugContext);
  const agentName = useAgentName();
  const [open, setOpen] = useState<number | null>(null);
  if (!slug || images.length === 0) return null;
  const url = (path: string) => studioFileUrl(slug, path);
  const extra = images.length - SHOWN;
  return (
    <>
      <div className="flex flex-wrap gap-1 pl-6">
        {images.slice(0, SHOWN).map((path, index) => (
          <button
            key={path}
            type="button"
            onClick={() => setOpen(index)}
            className="relative h-12 overflow-hidden rounded border border-border/70 bg-black transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open picture ${index + 1} of ${images.length}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the local helper */}
            <img
              src={url(path)}
              alt=""
              loading="lazy"
              className="h-full w-auto max-w-28 object-contain"
            />
            {index === SHOWN - 1 && extra > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold text-white">
                +{extra}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <Dialog
        open={open !== null}
        onOpenChange={(value) => !value && setOpen(null)}
      >
        <DialogContent className="max-w-[min(92vw,1200px)] gap-3 p-4 sm:max-w-[min(92vw,1200px)]">
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            What {agentName} looked at in this step.
          </DialogDescription>
          {open !== null ? (
            <>
              <div className="relative flex items-center justify-center overflow-hidden rounded-md bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- served by the local helper */}
                <img
                  src={url(images[open])}
                  alt={`Picture ${open + 1}`}
                  className="max-h-[70vh] w-auto object-contain"
                />
                {images.length > 1 ? (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-2 top-1/2 size-8 -translate-y-1/2 rounded-full opacity-80"
                      onClick={() =>
                        setOpen((open - 1 + images.length) % images.length)
                      }
                      aria-label="Previous"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-1/2 size-8 -translate-y-1/2 rounded-full opacity-80"
                      onClick={() => setOpen((open + 1) % images.length)}
                      aria-label="Next"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : null}
              </div>
              {images.length > 1 ? (
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {images.map((path, index) => (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setOpen(index)}
                      className={cn(
                        "h-12 shrink-0 overflow-hidden rounded border-2 bg-black",
                        index === open
                          ? "border-primary"
                          : "border-transparent opacity-70 hover:opacity-100",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by the local helper */}
                      <img src={url(path)} alt="" className="h-full w-auto" />
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
