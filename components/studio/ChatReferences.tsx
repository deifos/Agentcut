"use client";

// Files the user points Claude at: chips in the chat composer and on sent messages,
// plus the drag-and-drop format the assets list uses to drop a file into the chat.
import { AudioLines, File as FileIcon, Film, Image as ImageIcon, Type, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileName } from "@/lib/studio/format";
import type { AssetEntry, ChatReference } from "@/lib/studio/types";

export const ASSET_DRAG_TYPE = "application/x-agentcut-asset";

export function referenceFromAsset(asset: Pick<AssetEntry, "path" | "kind">): ChatReference {
  const kind = /\.(woff2?|ttf|otf)$/i.test(asset.path) ? "font" : asset.kind;
  return { path: asset.path, kind };
}

export function readDraggedReference(data: DataTransfer): ChatReference | null {
  const raw = data.getData(ASSET_DRAG_TYPE);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ChatReference;
    return typeof value.path === "string" ? { path: value.path, kind: String(value.kind ?? "other") } : null;
  } catch {
    return null;
  }
}

function ReferenceIcon({ kind }: { kind: string }) {
  const className = "size-3 shrink-0";
  if (kind === "audio") return <AudioLines className={className} />;
  if (kind === "image") return <ImageIcon className={className} />;
  if (kind === "video") return <Film className={className} />;
  if (kind === "font") return <Type className={className} />;
  return <FileIcon className={className} />;
}

export function ReferenceChip({
  reference,
  onRemove,
  className,
}: {
  reference: ChatReference;
  onRemove?(): void;
  className?: string;
}) {
  return (
    <span
      title={reference.path}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-border/80 bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      <ReferenceIcon kind={reference.kind} />
      <span className="min-w-0 truncate">{fileName(reference.path)}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${fileName(reference.path)}`} className="-mr-0.5 rounded p-px text-muted-foreground hover:bg-background hover:text-foreground">
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
