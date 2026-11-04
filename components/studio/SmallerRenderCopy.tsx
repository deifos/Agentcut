"use client";

import { useId, useState } from "react";
import { Loader2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/studio/format";
import type { StudioBridge } from "@/lib/studio/bridge";

export function SmallerRenderCopy({ slug, path, getBridge }: { slug: string; path: string; getBridge(): StudioBridge | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState("1080p");
  const [quality, setQuality] = useState("high");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const create = async () => {
    const bridge = getBridge();
    if (!bridge) { setError("Start the helper to create a smaller copy."); return; }
    setBusy(true); setError(""); setResult("");
    try {
      const info = await bridge.request<{ features?: string[] }>("studio.info", {});
      if (!info.features?.includes("resize-render")) throw new Error("Update the helper to create smaller copies of rendered videos.");
      const copy = await bridge.request<{ bytes: number; originalBytes: number }>("studio.render.resize", { slug, path, resolution, quality }, 2 * 60 * 60 * 1000);
      setResult(`Saved a ${formatBytes(copy.bytes)} copy (${Math.round(100 * (1 - copy.bytes / copy.originalBytes))}% smaller). It appears in Latest renders and the Renders tab.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create the smaller copy."); }
    finally { setBusy(false); }
  };
  return <div className="border-t border-border/50 px-2.5 py-2">
    <Button variant="outline" size="sm" className="h-8 w-full justify-center" aria-expanded={open} aria-controls={`${id}-options`} disabled={busy} onClick={() => setOpen(!open)}>
      <Minimize2 className="size-3.5" />Create smaller copy
    </Button>
    {open ? <div id={`${id}-options`} className="mt-3 space-y-3">
      <p className="text-xs text-muted-foreground">Resize this finished video. Keeps the original and saves a separate MP4. No new AI edit is needed.</p>
      <label className="block space-y-1 text-xs font-medium" htmlFor={`${id}-resolution`}>
        <span>Copy resolution</span>
        <select id={`${id}-resolution`} value={resolution} disabled={busy} onChange={(e) => setResolution(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs">
          <option value="1080p">1080p — social media</option><option value="720p">720p — smaller file</option>
        </select>
      </label>
      <label className="block space-y-1 text-xs font-medium" htmlFor={`${id}-quality`}>
        <span>Copy quality</span>
        <select id={`${id}-quality`} value={quality} disabled={busy} onChange={(e) => setQuality(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs">
          <option value="high">High quality, smaller file</option><option value="maximum">Maximum quality</option>
        </select>
      </label>
      <p className="text-xs text-muted-foreground">1080p is 1080×1920 for 9:16 portrait or 1920×1080 for landscape. Keeps the aspect ratio; smaller videos are not enlarged. Existing phone links keep the original video.</p>
      <Button size="sm" className="w-full" disabled={busy} onClick={() => void create()}>{busy ? <><Loader2 className="size-3.5 animate-spin" />Creating smaller copy…</> : "Create copy"}</Button>
      {busy ? <p role="status" className="text-xs text-muted-foreground">Keep the helper running. Large videos can take several minutes.</p> : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      {result ? <p role="status" className="text-xs text-muted-foreground">{result}</p> : null}
    </div> : null}
  </div>;
}
