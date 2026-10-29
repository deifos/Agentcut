"use client";

import { useRef, useState } from "react";
import { Upload, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";

/** Files are saved as project context. Only the first video fills the preview. */
export function SimpleVideoInput({ disabled, onFiles, onRecord }: {
  disabled: boolean;
  onFiles(files: File[]): Promise<void>;
  onRecord(): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dropping, setDropping] = useState(false);
  const upload = async (files: File[]) => {
    if (disabled || busy || !files.length) return;
    setBusy(true);
    try { await onFiles(files); }
    catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return (
    <Empty className="simple-video-input" data-dropping={dropping}
      onDragOver={(event) => { if (!disabled && event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDropping(true); } }}
      onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDropping(false); }}
      onDrop={(event) => { event.preventDefault(); setDropping(false); void upload(Array.from(event.dataTransfer.files)); }}>
      <EmptyHeader>
        <EmptyTitle>Your next video starts here</EmptyTitle>
        <EmptyDescription>Drop footage, images, or audio here.<br />Or describe a video below and start from an idea.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" disabled={disabled || busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy ? "Adding files…" : "Upload files"}</Button>
          <Button variant="outline" disabled={disabled || busy} onClick={onRecord}><Video /> Record yourself</Button>
        </div>
        <p className="text-xs text-muted-foreground">One project. One video. Make it yours.</p>
      </EmptyContent>
      <input ref={input} className="hidden" type="file" multiple aria-label="Upload video files" accept="video/*,image/*,audio/*" onChange={(event) => { if (event.target.files) void upload(Array.from(event.target.files)); event.target.value = ""; }} />
    </Empty>
  );
}
