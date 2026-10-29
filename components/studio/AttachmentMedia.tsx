"use client";

import { useEffect, useState } from "react";
import { Film, Image as ImageIcon, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MediaPlayer } from "@/components/studio/AssetPreview";
import { fileName } from "@/lib/studio/format";
import { cn } from "@/lib/utils";
import type { ChatReference } from "@/lib/studio/types";

/** A preview is local UI state; opening it never changes or sends the attachment. */
export function AttachmentMedia({ reference, url, onRemove, className }: {
  reference: ChatReference;
  url: string;
  onRemove?(): void;
  className?: string;
}) {
  const video = reference.kind === "video";
  const name = fileName(reference.path);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [poster, setPoster] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    void import("@/lib/studio/video-poster").then(({ videoPoster }) => videoPoster(url)).then((image) => {
      if (!cancelled) { setPoster(image); setState("ready"); }
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [url, video]);
  const image = video ? poster : url;
  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) setPreviewError(false); }}>
    <span className={cn("inline-flex w-64 max-w-full items-start gap-2 rounded-xl border border-border/80 bg-background/40 p-2 text-[11px] font-medium", className)}>
      <DialogTrigger asChild>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Preview ${video ? "video" : "image"} ${name}`}>
          <span className="reference-thumbnail relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted" aria-hidden="true">
            {state === "loading" ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : state === "error" ? video ? <Film className="size-6 text-muted-foreground" /> : <ImageIcon className="size-6 text-muted-foreground" /> : null}
            {image && state !== "error" ? (
              // eslint-disable-next-line @next/next/no-img-element -- local attachment or decoded in-memory poster
              <img src={image} alt="" decoding="async" className={cn("absolute inset-0 size-full object-cover", state !== "ready" && "opacity-0")} onLoad={() => setState("ready")} onError={() => setState("error")} />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-foreground" title={name}>{name}</span>
            <span className="text-[10px] text-muted-foreground">{state === "loading" ? "Loading preview…" : state === "error" ? "Preview unavailable · open file" : video ? "Video · open preview" : "Image · open preview"}</span>
          </span>
        </button>
      </DialogTrigger>
      {onRemove ? <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3.5" /></button> : null}
    </span>
    <DialogContent className="max-h-[88dvh] overflow-y-auto text-foreground sm:max-w-3xl" onKeyDown={(event) => event.stopPropagation()}>
      <DialogTitle className="truncate pr-6" title={name}>{name}</DialogTitle>
      <DialogDescription>Inspect this attachment. Closing the preview keeps your draft and files.</DialogDescription>
      {video ? <MediaPlayer url={url} kind="video" poster={poster ?? undefined} onError={() => setPreviewError(true)} /> : (
        // eslint-disable-next-line @next/next/no-img-element -- full-size local attachment inspection
        <img src={url} alt={name} className="max-h-[60dvh] w-full rounded-lg object-contain" onError={() => setPreviewError(true)} />
      )}
      {previewError ? <p role="alert" className="text-sm text-destructive">This file could not be previewed. It may be unavailable or use an unsupported format. Your attachment is still in the request.</p> : null}
    </DialogContent>
  </Dialog>;
}
