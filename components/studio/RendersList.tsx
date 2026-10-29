"use client";

// Finished videos in a project's renders/ folder: the Renders tab and the export dialog share this.
import { useState } from "react";
import { Download, ExternalLink, FolderOpen, Play, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { studioFileUrl } from "@/lib/studio/bundle";
import { fileName, formatBytes, formatRenderDuration } from "@/lib/studio/format";
import type { StudioBridge } from "@/lib/studio/bridge";
import type { AssetEntry } from "@/lib/studio/types";

/** Extras a browser export from this session knows about its file. */
export interface RenderExtra {
  lufs?: number | null;
}

const FRESH_MS = 10 * 60 * 1000;

/** The project's rendered videos, newest first. */
export function rendersFrom(assets: AssetEntry[]) {
  return assets
    .filter(
      (entry) =>
        entry.path.startsWith("renders/") && /\.mp4$/i.test(entry.path),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Show a file (or the renders/ folder) in Explorer / Finder, or open it in the default app. */
export function useRenderFileActions(
  slug: string,
  getBridge: () => StudioBridge | null,
) {
  const call = (
    method: "studio.file.reveal" | "studio.file.open",
    path: string,
  ) => {
    const bridge = getBridge();
    if (!bridge) {
      toast.error("The Agentcut helper isn't connected.");
      return;
    }
    bridge
      .request(method, { slug, path })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : String(error)),
      );
  };
  return {
    reveal: (path: string) => call("studio.file.reveal", path),
    open: (path: string) => call("studio.file.open", path),
    openFolder: () => call("studio.file.reveal", "renders"),
  };
}

export function RendersList({
  slug,
  renders,
  extras = {},
  getBridge,
  limit,
  layout = "row",
  className,
}: {
  slug: string;
  renders: AssetEntry[];
  extras?: Record<string, RenderExtra>;
  getBridge(): StudioBridge | null;
  limit?: number;
  /** "card": big thumbnail on top (the narrow Renders tab); "row": compact (the export dialog). */
  layout?: "row" | "card";
  className?: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const actions = useRenderFileActions(slug, getBridge);
  const shown = limit ? renders.slice(0, limit) : renders;
  return (
    <div
      className={cn(
        layout === "card" ? "space-y-2.5" : "space-y-1.5",
        className,
      )}
    >
      {shown.map((item) => (
        <RenderRow
          key={item.path}
          item={item}
          extra={extras[item.path]}
          src={studioFileUrl(slug, item.path)}
          playing={playing === item.path}
          layout={layout}
          onTogglePlay={() =>
            setPlaying((current) => (current === item.path ? null : item.path))
          }
          onReveal={() => actions.reveal(item.path)}
          onOpen={() => actions.open(item.path)}
        />
      ))}
      {limit && renders.length > limit ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          +{renders.length - limit} older in the Renders tab
        </p>
      ) : null}
    </div>
  );
}

/** "demo-wide-20261019-161935-local.mp4" → "wide" (the size it was rendered at). */
function variantOf(name: string) {
  return /-([a-z0-9]+)-\d{8}-\d{6}(?:[-.]|$)/i.exec(name)?.[1] ?? null;
}

function RenderRow({
  item,
  extra,
  src,
  playing,
  layout,
  onTogglePlay,
  onReveal,
  onOpen,
}: {
  item: AssetEntry;
  extra?: RenderExtra;
  src: string;
  playing: boolean;
  layout: "row" | "card";
  onTogglePlay(): void;
  onReveal(): void;
  onOpen(): void;
}) {
  const name = fileName(item.path);
  const local = /-local(-\d+)?\.mp4$/i.test(name);
  const variant = variantOf(name);
  // eslint-disable-next-line react-hooks/purity -- "new" only needs to be roughly right
  const fresh = Date.now() - item.updatedAt < FRESH_MS;
  const when = new Date(item.updatedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const card = layout === "card";

  const thumb = (
    <button
      type="button"
      onClick={onTogglePlay}
      className={cn(
        "group relative shrink-0 overflow-hidden bg-black",
        card ? "aspect-video w-full" : "h-10 w-16 rounded",
      )}
      aria-label={`Play ${name}`}
    >
      {/* A frame from the start as the thumbnail; range requests keep this to a small read. */}
      <video
        src={`${src}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        className="size-full object-contain"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-80 transition-opacity group-hover:opacity-100">
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-black/50",
            card ? "size-10" : "size-6",
          )}
        >
          <Play
            className={cn("fill-white text-white", card ? "size-4" : "size-3")}
          />
        </span>
      </span>
    </button>
  );
  const player = (
    <div className="relative bg-black">
      <video
        src={src}
        controls
        autoPlay
        className={cn("block w-full", card ? "aspect-video" : "max-h-72")}
      />
      <button
        type="button"
        onClick={onTogglePlay}
        className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        aria-label="Close player"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
  const info = (
    <div className="min-w-0 flex-1" title={item.path}>
      <p className="flex min-w-0 items-center gap-1.5 text-xs">
        <span className="font-semibold">{variant ?? name}</span>
        {fresh ? (
          <span className="rounded bg-emerald-500/15 px-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            New
          </span>
        ) : null}
        <span className="truncate text-muted-foreground">{when}</span>
      </p>
      <p className="truncate text-[11px] text-muted-foreground">
        {local ? "Rendered on this computer" : "Exported in browser"}
        {item.size ? ` · ${formatBytes(item.size)}` : ""}
        {extra?.lufs != null ? ` · ${extra.lufs.toFixed(1)} LUFS` : ""}
      </p>
      {item.renderDurationMs != null && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          Render time: {formatRenderDuration(item.renderDurationMs)}
        </p>
      )}
    </div>
  );
  const actions = (
    <div className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Show in folder"
        onClick={onReveal}
      >
        <FolderOpen className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Open in your video player"
        onClick={onOpen}
      >
        <ExternalLink className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Download a copy"
        asChild
      >
        <a href={src} download={name}>
          <Download className="size-4" />
        </a>
      </Button>
    </div>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border",
        fresh ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/70",
      )}
    >
      {card ? (
        <>
          {playing ? player : thumb}
          <div className="flex min-w-0 items-center gap-1 py-1.5 pl-2.5 pr-1">
            {info}
            {actions}
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-2.5 p-2">
            {thumb}
            {info}
            {actions}
          </div>
          {playing ? player : null}
        </>
      )}
    </div>
  );
}
