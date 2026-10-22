"use client";

import { useRef, useState } from "react";
import { FolderOpen, Laptop, Loader2, MonitorPlay, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { exportInBrowser, type BrowserExportResult } from "@/lib/studio/export";
import type { StudioBridge } from "@/lib/studio/bridge";
import type { ExportJob } from "@/components/studio/useStudioController";
import {
  RendersList,
  rendersFrom,
  useRenderFileActions,
  type RenderExtra,
} from "@/components/studio/RendersList";
import type { AssetEntry, LoadedModule, StudioDoc } from "@/lib/studio/types";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  doc: StudioDoc;
  loaded: LoadedModule | null;
  /** The project's files (renders/ included); kept live by the helper's file watcher. */
  assets: AssetEntry[];
  currentVariant: string;
  coverFrame: number;
  job: ExportJob | null;
  setJob(job: ExportJob | null): void;
  getBridge(): StudioBridge | null;
}

type Mode = "browser" | "local";

const STAGE_LABEL: Record<string, string> = {
  preparing: "Preparing",
  installing: "Installing Remotion (first local render only)",
  rendering: "Rendering frames",
  encoding: "Encoding",
  uploading: "Saving to renders/",
  done: "Done",
};

export function ExportDialog({
  open,
  onOpenChange,
  doc,
  loaded,
  assets,
  currentVariant,
  coverFrame,
  job,
  setJob,
  getBridge,
}: Props) {
  const variants = Object.keys(doc.project?.variants ?? {});
  const [chosen, setChosen] = useState<string[]>(() => variants);
  const [normalize, setNormalize] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [extras, setExtras] = useState<Record<string, RenderExtra>>({});
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const busy = mode !== null;
  const renders = rendersFrom(assets);
  const files = useRenderFileActions(doc.slug, getBridge);

  const selected = chosen.filter((variant) => variants.includes(variant));

  const runBrowser = async () => {
    if (!loaded || selected.length === 0) return;
    setMode("browser");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      for (const variant of selected) {
        setJob({
          slug: doc.slug,
          variant,
          stage: "preparing",
          progress: 0,
          where: "browser",
        });
        let result: BrowserExportResult;
        try {
          result = await exportInBrowser({
            doc,
            loaded,
            variant,
            normalizeLoudness: normalize,
            coverFrame,
            signal: controller.signal,
            onProgress: (stage, progress, message) =>
              setJob({
                slug: doc.slug,
                variant,
                stage,
                progress,
                message,
                where: "browser",
              }),
          });
        } catch (error) {
          if (controller.signal.aborted) {
            toast("Export cancelled");
            return;
          }
          const message =
            error instanceof Error ? error.message : String(error);
          toast.error(`Export failed (${variant}): ${message}`);
          return;
        }
        // The file is already saved to renders/; play it from there instead of
        // pinning the whole MP4 in tab memory with a blob URL.
        setExtras((map) => ({
          ...map,
          [result.path]: {
            lufs:
              result.measured?.integratedLufs ??
              result.loudness?.resultLufs ??
              null,
          },
        }));
      }
      toast.success(
        selected.length > 1
          ? `${selected.length} videos saved to renders/`
          : "Video saved to renders/",
      );
    } finally {
      setMode(null);
      setJob(null);
      abortRef.current = null;
    }
  };

  const runLocal = async () => {
    const bridge = getBridge();
    if (!bridge || selected.length === 0) return;
    setMode("local");
    cancelledRef.current = false;
    try {
      for (const variant of selected) {
        setJob({
          slug: doc.slug,
          variant,
          stage: "preparing",
          progress: 0,
          where: "local",
        });
        let gain: number | undefined;
        if (normalize) {
          const { planLoudness } = await import("@/lib/studio/export");
          gain = (await planLoudness(doc, variant)).gain;
        }
        if (cancelledRef.current) return;
        await bridge.request(
          "studio.render.local",
          { slug: doc.slug, variant, masterGain: gain },
          60 * 60 * 1000,
        );
      }
      toast.success(
        selected.length > 1
          ? `${selected.length} videos rendered to renders/`
          : "Video rendered to renders/",
      );
    } catch (error) {
      if (cancelledRef.current) toast("Render cancelled");
      else
        // The helper's message already starts with "Local render failed".
        toast.error(
          error instanceof Error
            ? error.message
            : `Local render failed: ${String(error)}`,
          {
            duration: 15000,
          },
        );
    } finally {
      setMode(null);
      setJob(null);
    }
  };

  const cancel = () => {
    if (mode === "browser") abortRef.current?.abort();
    if (mode === "local") {
      cancelledRef.current = true;
      void getBridge()
        ?.request("studio.render.cancel", {})
        .catch(() => undefined);
    }
  };

  const progress = busy && job && job.slug === doc.slug ? job : null;
  const known = progress && progress.progress > 0;
  const percent = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <Dialog
      open={open}
      // Closing never stops an export: progress stays on the Export button and the tab title.
      onOpenChange={onOpenChange}
    >
      {/* min-w-0 on the grid children: a long file name must truncate, not stretch the dialog. */}
      <DialogContent className="sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            MP4 (H.264 + AAC) with a cover image, saved to this project&apos;s
            renders/ folder. Nothing is overwritten.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Sizes
            </p>
            {variants.map((variant) => {
              const size = doc.project!.variants[variant];
              const checked = selected.includes(variant);
              return (
                <Label
                  key={variant}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md border border-border/70 px-3 py-2 text-sm font-normal hover:bg-muted/50",
                    busy && "pointer-events-none opacity-60",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={busy}
                    onCheckedChange={() =>
                      setChosen(
                        checked
                          ? selected.filter((v) => v !== variant)
                          : [...selected, variant],
                      )
                    }
                  />
                  <span className="font-semibold">{variant}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {size.width}×{size.height}
                  </span>
                  {variant === currentVariant ? (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      on screen
                    </Badge>
                  ) : null}
                </Label>
              );
            })}
          </div>

          <Label
            className={cn(
              "flex cursor-pointer items-center gap-2.5 text-sm font-normal",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <Checkbox
              checked={normalize}
              disabled={busy}
              onCheckedChange={(value) => setNormalize(value === true)}
            />
            Normalize loudness to −14 LUFS (peaks ≤ −1 dBTP)
          </Label>

          {busy ? (
            <div className="space-y-1.5 rounded-md border border-border/70 bg-muted/30 p-3">
              <p className="flex min-w-0 items-center gap-2 text-xs">
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                <span className="font-semibold">
                  {progress?.variant ?? selected[0]}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-muted-foreground"
                  title={progress?.message}
                >
                  {STAGE_LABEL[progress?.stage ?? "preparing"] ??
                    progress?.stage}
                  {progress?.message && progress.stage !== "installing"
                    ? ` · ${progress.message}`
                    : ""}
                </span>
                {known ? <span className="font-mono">{percent}%</span> : null}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full bg-primary transition-[width]",
                    !known && "w-1/4 animate-pulse",
                  )}
                  style={known ? { width: `${percent}%` } : undefined}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {mode === "local"
                  ? "Rendering with Remotion on this computer. You can close this window; progress shows on the Export button, and the video lands in the Renders tab."
                  : "You can close this window; progress shows on the Export button and the tab. Keep this tab open until it finishes."}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {mode === "browser" ? (
              <Button
                variant="outline"
                className="h-10 flex-1"
                onClick={cancel}
              >
                <X className="size-4" /> Cancel export
              </Button>
            ) : (
              <Button
                className="h-10 flex-1"
                disabled={busy || !loaded || selected.length === 0}
                onClick={() => void runBrowser()}
              >
                <MonitorPlay className="size-4" /> Export in browser
              </Button>
            )}
            {mode === "local" ? (
              <Button variant="outline" className="h-10" onClick={cancel}>
                <X className="size-4" /> Cancel render
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-10"
                disabled={busy || selected.length === 0}
                onClick={() => void runLocal()}
                title="Uses Remotion on your computer (the first time installs it into the workspace). Use this if a scene uses CSS the browser export can't draw."
              >
                <Laptop className="size-4" /> Render on this computer
              </Button>
            )}
          </div>

          {renders.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Latest renders
                </p>
                <button
                  type="button"
                  onClick={files.openFolder}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <FolderOpen className="size-3.5" /> Open renders folder
                </button>
              </div>
              <RendersList
                slug={doc.slug}
                renders={renders}
                extras={extras}
                getBridge={getBridge}
                limit={3}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
