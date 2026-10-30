"use client";

// Files the user points Claude at: chips in the chat composer and on sent messages,
// plus the drag-and-drop format the assets list uses to drop a file into the chat.
import { TooltipHint } from "@/components/ui/tooltip";
import { AudioLines, File as FileIcon, Film, Image as ImageIcon, Type, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileName } from "@/lib/studio/format";
import { exportStamp, uploadToProject } from "@/lib/studio/export";
import { AttachmentMedia } from "@/components/studio/AttachmentMedia";
import { studioFileUrl } from "@/lib/studio/bundle";
import type { AssetEntry, ChatReference } from "@/lib/studio/types";

export const ASSET_DRAG_TYPE = "application/x-agentcut-asset";

export function referenceFromAsset(asset: Pick<AssetEntry, "path" | "kind">): ChatReference {
  const kind = /\.(woff2?|ttf|otf)$/i.test(asset.path) ? "font" : asset.kind;
  return { path: asset.path, kind };
}

/** Images, videos, audio and fonts; anything else (`null`) stays out of the project. */
function kindOfFile(file: File): string | null {
  if (/\.(woff2?|ttf|otf)$/i.test(file.name) || file.type.startsWith("font/")) return "font";
  const type = file.type.split("/")[0];
  if (type === "image" || type === "video" || type === "audio") return type;
  if (/\.(png|jpe?g|webp|gif|svg|avif|heic|bmp)$/i.test(file.name)) return "image";
  if (/\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name)) return "video";
  if (/\.(mp3|wav|m4a|aac|ogg|oga|opus|flac)$/i.test(file.name)) return "audio";
  return null;
}

// The helper takes up to 4 GB; stop well before so a huge drop fails here, not mid-upload.
const MAX_FILE_BYTES = 2 * 1024 ** 3;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** A file name that is safe on every OS, keeps non-Latin letters and its extension. */
export function safeFileName(name: string, fallback = "file") {
  const match = /(\.[\p{L}\p{N}]{1,10})$/u.exec(name);
  const ext = (match?.[1] ?? "").toLowerCase();
  const trimEnds = (value: string) => value.replace(/^[.\s]+|[.\s]+$/g, "");
  const cleaned = trimEnds(
    (match ? name.slice(0, -match[1].length) : name)
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}\p{M}._\- ]+/gu, "_")
      .replace(/([._\- ])\1+/g, "$1"),
  );
  // Cap by characters, not UTF-16 units, so a cut never splits an emoji or a CJK pair.
  let base = trimEnds([...cleaned].slice(0, 80).join("")) || fallback;
  // Windows refuses CON, NUL, COM1… as a name, with or without more dots after.
  if (WINDOWS_RESERVED.test(base.split(".")[0])) base = `_${base}`;
  return `${base}${ext}`;
}

export interface ChatUploadResult {
  added: ChatReference[];
  /** Files that were skipped or failed, with the reason. */
  failed: { name: string; reason: string }[];
}

/**
 * Files dropped or pasted into the chat: saved to the project's assets and returned as references,
 * so the next message points the agent at them. Pasted screenshots (no real name) get a timestamp.
 * Each file uploads on its own: one failure never drops the others.
 */
export async function uploadChatFiles(slug: string, files: File[]): Promise<ChatUploadResult> {
  const stamp = exportStamp();
  const results = await Promise.allSettled(
    files.map(async (file, index) => {
      const kind = kindOfFile(file);
      if (!kind) throw new Error("not an image, video, audio file or font");
      if (file.size > MAX_FILE_BYTES) throw new Error("over 2 GB");
      const generic = !file.name || /^(image|blob|clipboard|screenshot)\.[a-z0-9]+$/i.test(file.name);
      const named = /\.[a-z0-9]+$/i.exec(file.name)?.[0];
      // "image/svg+xml" → ".svg"
      const ext = (named ?? `.${file.type.split("/")[1]?.split("+")[0] || "bin"}`).toLowerCase();
      const base = generic
        ? `pasted-${stamp}${files.length > 1 ? `-${index + 1}` : ""}${ext}`
        : safeFileName(named ? file.name : `${file.name}${ext}`);
      return { path: await uploadToProject(slug, `assets/${base}`, file), kind };
    }),
  );
  const out: ChatUploadResult = { added: [], failed: [] };
  results.forEach((result, index) => {
    if (result.status === "fulfilled") out.added.push(result.value);
    else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      out.failed.push({ name: files[index].name || "pasted file", reason });
    }
  });
  return out;
}

/** "Couldn't add 2 of 5 files: a.txt (not an image…), b.png (over 2 GB)". */
export function uploadFailureMessage(total: number, failed: ChatUploadResult["failed"]) {
  const listed = failed.slice(0, 3).map((f) => `${f.name} (${f.reason})`);
  if (failed.length > 3) listed.push(`and ${failed.length - 3} more`);
  const head = total === 1 ? "Couldn't add the file" : `Couldn't add ${failed.length} of ${total} files`;
  return `${head}: ${listed.join(", ")}`;
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
  slug,
  showPreview = false,
}: {
  reference: ChatReference;
  onRemove?(): void;
  className?: string;
  slug?: string | null;
  /** Composer attachments get previews; sent-message chips stay compact. */
  showPreview?: boolean;
}) {
  const preview = showPreview && slug && ["image", "video"].includes(reference.kind);
  const url = preview ? studioFileUrl(slug, reference.path) : null;
  if (url) return <AttachmentMedia key={`${reference.kind}:${url}`} reference={reference} url={url} onRemove={onRemove} className={className} />;
  return (
    <TooltipHint content={reference.path}>
      <span tabIndex={0}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md border border-border/80 bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium",
          preview && "w-64 gap-2.5 rounded-xl bg-background/40 p-2",
          className,
        )}
      >
        <ReferenceIcon kind={reference.kind} />
        <span className={cn("min-w-0 truncate", preview && "flex flex-1 flex-col gap-1")}>
          <span className="truncate text-foreground">{fileName(reference.path)}</span>
          {preview ? <span className="text-[10px] text-muted-foreground">{reference.kind === "video" ? "Video" : "Image"}</span> : null}
        </span>
        {onRemove ? (
          <button type="button" onClick={onRemove} aria-label={`Remove ${fileName(reference.path)}`} className={cn("-mr-0.5 rounded p-px text-muted-foreground hover:bg-background hover:text-foreground", preview && "m-0 flex size-7 shrink-0 items-center justify-center self-start rounded-full p-1")}>
            <X className="size-3" />
          </button>
        ) : null}
      </span>
    </TooltipHint>
  );
}
