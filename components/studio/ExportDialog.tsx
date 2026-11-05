"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { exportInBrowser, planLoudness } from "@/lib/studio/export";
import { fetchStudioBundle, evaluateStudioBundle } from "@/lib/studio/bundle";
import {
  exportCanvasVideos,
  exportVideoFingerprint,
  readExportVideo,
  type CanvasExportCut,
  type ExportVideo,
  type ExportFileProgress,
  type ExportFileResult,
} from "@/lib/studio/canvas-export";
import { studioPageWork } from "@/lib/studio/page-work";
import type { StudioBridge } from "@/lib/studio/bridge";
import type { ExportJob } from "./useStudioController";
import { RendersList, rendersFrom, useRenderFileActions } from "./RendersList";
import type {
  AssetEntry,
  LoadedModule,
  StudioDoc,
  StudioProject,
} from "@/lib/studio/types";
import { exportFormats } from "@/lib/studio/video-formats";
import {
  exportSize,
  type ExportResolution,
} from "@/packages/agentcut/src/studio/export-resolution";
import { LocalVideoViewer } from "./LocalVideoViewer";
interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  doc: StudioDoc;
  loaded: LoadedModule | null;
  assets: AssetEntry[];
  currentVariant: string;
  coverFrame: number;
  job: ExportJob | null;
  setJob(job: ExportJob | null): void;
  getBridge(): StudioBridge | null;
  flush(): Promise<void>;
  onSaveProject(project: StudioProject): Promise<void>;
  qualitySupported: boolean;
  resolutionSupported: boolean;
  fourKSupported: boolean;
  workspace?: string;
}
type Row = { slug: string; name: string; video?: ExportVideo; error?: string };
type Mode = "browser" | "local";
function SavedFiles({
  video,
  getBridge,
}: {
  video: ExportVideo;
  getBridge(): StudioBridge | null;
}) {
  const files = useRenderFileActions(video.slug, getBridge);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button variant="ghost" size="sm" onClick={files.openFolder}>
        {video.name}: open output folder
      </Button>
      <RendersList
        slug={video.slug}
        renders={rendersFrom(video.assets)}
        getBridge={getBridge}
        limit={2}
      />
    </div>
  );
}
export function ExportDialog({
  open,
  onOpenChange,
  doc,
  coverFrame,
  job,
  setJob,
  getBridge,
  flush,
  onSaveProject,
  qualitySupported,
  resolutionSupported,
  fourKSupported,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string[]>([doc.slug]);
  const [formats, setFormats] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalize, setNormalize] = useState(true);
  const [quality, setQuality] = useState<"high" | "maximum">("high");
  const [resolution, setResolution] = useState<ExportResolution>("project");
  const [mode, setMode] = useState<Mode | null>(null);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState<ExportFileProgress | null>(null);
  const [results, setResults] = useState<ExportFileResult[]>([]);
  const [message, setMessage] = useState("");
  const running = useRef(false),
    abort = useRef<AbortController | null>(null),
    localTarget = useRef<string | null>(null),
    anchor = useRef(doc.slug);
  const retry = useRef({ signature: "", saved: new Map<string, string>() });
  const busy = mode !== null || adding;
  useEffect(() => {
    if (!open || running.current) return;
    let disposed = false;
    anchor.current = doc.slug;
    retry.current = { signature: "", saved: new Map() };
    setSelected([doc.slug]);
    setRows([]);
    setFormats({});
    setError(null);
    setMessage("");
    setResults([]);
    setLoading(true);
    const bridge = getBridge();
    void (async () => {
      if (!bridge) throw new Error("The studio helper is not connected.");
      const canvas = await bridge.request<{ cuts: CanvasExportCut[] }>(
        "studio.canvas.read",
        { project: doc.slug },
      );
      const next = await Promise.all(
        canvas.cuts.map(async (cut): Promise<Row> => {
          const title = cut.title || cut.slug;
          const name = cut.version && cut.version !== "Original" ? `${title} · ${cut.version}` : title;
          try {
            return {
              slug: cut.slug,
              name,
              video: await readExportVideo(bridge, cut.slug, name),
            };
          } catch (reason) {
            return {
              slug: cut.slug,
              name,
              error: String(reason instanceof Error ? reason.message : reason),
            };
          }
        }),
      );
      if (!disposed) {
        setRows(next);
        const activeVideo = next.find((row) => row.slug === doc.slug)?.video;
        setSelected(activeVideo && !activeVideo.error && !activeVideo.draft ? [doc.slug] : []);
        setFormats(
          Object.fromEntries(
            next.map((row) => [
              row.slug,
              Object.keys(row.video?.doc.project?.variants ?? {}),
            ]),
          ),
        );
      }
    })()
      .catch((reason) => {
        if (!disposed)
          setError(String(reason instanceof Error ? reason.message : reason));
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [open, doc.slug, getBridge]);
  const selectedRows = selected.map((slug) =>
    rows.find((row) => row.slug === slug),
  );
  const choices = selectedRows.flatMap((row) =>
    row
      ? [{ slug: row.slug, name: row.name, variants: formats[row.slug] ?? [] }]
      : [],
  );
  const fileCount = choices.reduce(
    (sum, choice) => sum + choice.variants.length,
    0,
  );
  const invalid = selectedRows.find((row) => row?.error || row?.video?.error);
  const selectionError = !selected.length
    ? "Select at least one video."
    : selectedRows.some((row) => !row)
      ? "A selected video is missing from this canvas."
      : invalid?.error ||
        invalid?.video?.error ||
        (choices.some((choice) => !choice.variants.length)
          ? "Select an output format for each video."
          : null);
  const localSupported =
    qualitySupported &&
    (resolution === "project" ||
      (resolution === "2160p" ? fourKSupported : resolutionSupported));
  const canRun = !busy && !loading && !selectionError && fileCount > 0;
  async function toggleFormat(
    video: ExportVideo,
    format: ReturnType<typeof exportFormats>[number],
  ) {
    if (busy) return;
    if (!format.existing) {
      if (video.slug !== doc.slug || selected.length !== 1 || !doc.project)
        return;
      setAdding(true);
      try {
        await flush();
        await onSaveProject({
          ...doc.project,
          variants: {
            ...doc.project.variants,
            [format.id]: { width: format.width, height: format.height },
          },
        });
        const fresh = await readExportVideo(
          getBridge()!,
          video.slug,
          video.name,
        );
        setRows((previous) =>
          previous.map((row) =>
            row.slug === video.slug ? { ...row, video: fresh } : row,
          ),
        );
      } catch (reason) {
        setError(String(reason));
        return;
      } finally {
        setAdding(false);
      }
    }
    setFormats((previous) => ({
      ...previous,
      [video.slug]: (previous[video.slug] ?? []).includes(format.id)
        ? previous[video.slug].filter((id) => id !== format.id)
        : [...(previous[video.slug] ?? []), format.id],
    }));
  }
  async function run(where: Mode) {
    if (running.current || !canRun || (where === "local" && !localSupported))
      return;
    const bridge = getBridge();
    if (!bridge) {
      setError("The studio helper is not connected.");
      return;
    }
    running.current = true;
    const controller = new AbortController();
    abort.current = controller;
    setMode(where);
    setError(null);
    setMessage("");
    setProgress(null);
    const signature = JSON.stringify([
      choices,
      where,
      normalize,
      quality,
      resolution,
    ]);
    if (retry.current.signature !== signature) {
      retry.current = { signature, saved: new Map() };
      setResults([]);
    }
    let savedNow = 0;
    try {
      await flush();
      // A retry must not reuse an old file for a video that has since changed.
      for (const choice of choices) {
        const savedKeys = choice.variants
          .map((variant) => `${choice.slug}/${variant}`)
          .filter((key) => retry.current.saved.has(key));
        if (!savedKeys.length) continue;
        const fresh = await readExportVideo(bridge, choice.slug, choice.name);
        for (const key of savedKeys)
          if (retry.current.saved.get(key) !== exportVideoFingerprint(fresh))
            retry.current.saved.delete(key);
      }
      const pending = choices
        .map((choice) => ({
          ...choice,
          variants: choice.variants.filter(
            (variant) => !retry.current.saved.has(`${choice.slug}/${variant}`),
          ),
        }))
        .filter((choice) => choice.variants.length);
      await studioPageWork.run("studio_export", () =>
        exportCanvasVideos(pending, where, controller.signal, {
          members: async () =>
            (
              await bridge.request<{ cuts: CanvasExportCut[] }>(
                "studio.canvas.read",
                { project: anchor.current },
              )
            ).cuts.map((cut) => cut.slug),
          read: (slug, name) => readExportVideo(bridge, slug, name),
          load: async (video) => {
            const bundle = await fetchStudioBundle(
              video.slug,
              controller.signal,
            );
            return {
              slug: video.slug,
              revision: bundle.revision,
              module: evaluateStudioBundle(
                bundle.code,
                video.slug,
                bundle.revision,
              ),
            };
          },
          render: async (video, variant, loaded, report) => {
            if (where === "browser")
              return exportInBrowser({
                doc: video.doc,
                loaded: loaded!,
                variant,
                normalizeLoudness: normalize,
                quality: quality === "maximum" ? "very-high" : "high",
                resolution,
                coverFrame: video.slug === doc.slug ? coverFrame : 0,
                signal: controller.signal,
                onProgress: report,
              });
            const gain = normalize
              ? (await planLoudness(video.doc, variant)).gain
              : 1;
            controller.signal.throwIfAborted();
            localTarget.current = video.slug;
            try {
              return await bridge.request<{ path?: string }>(
                "studio.render.local",
                {
                  slug: video.slug,
                  variant,
                  masterGain: gain,
                  quality,
                  resolution,
                  expectedProjectHash: video.doc.projectHash,
                  expectedLayersHash: video.doc.layersHash,
                  expectedBundleRevision: video.bundle.revision,
                },
                60 * 60 * 1000,
              );
            } finally {
              localTarget.current = null;
            }
          },
          onProgress: (update) => {
            setProgress(update);
            setJob({
              slug: update.slug,
              variant: update.variant,
              stage: update.stage as ExportJob["stage"],
              progress: update.progress,
              message: update.message,
              where,
            });
          },
          onResult: (result, video) => {
            savedNow++;
            retry.current.saved.set(
              `${result.slug}/${result.variant}`,
              exportVideoFingerprint(video),
            );
            setResults((previous) => [...previous, result]);
          },
        }),
      );
      setMessage(
        `${savedNow} file${savedNow === 1 ? "" : "s"} saved. Each video uses its own output folder.`,
      );
      retry.current = { signature: "", saved: new Map() };
      const refreshResults = await Promise.allSettled(
        choices.map((choice) =>
          readExportVideo(bridge, choice.slug, choice.name),
        ),
      );
      const refreshed = refreshResults.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      setRows((previous) =>
        previous.map((row) => {
          const video = refreshed.find((video) => video.slug === row.slug);
          return video ? { ...row, video } : row;
        }),
      );
    } catch (reason) {
      setError(
        `${controller.signal.aborted ? "Export cancelled." : reason instanceof Error ? reason.message : String(reason)} ${retry.current.saved.size} file(s) saved. Retry skips these files for the same selection and settings.`,
      );
    } finally {
      running.current = false;
      setMode(null);
      setProgress(null);
      setJob(null);
      abort.current = null;
    }
  }
  function cancel() {
    abort.current?.abort();
    if (localTarget.current)
      void getBridge()
        ?.request("studio.render.cancel", { slug: localTarget.current })
        .catch(() => undefined);
  }
  const activeProgress =
    mode === "local" && job && job.slug === progress?.slug
      ? { ...progress, stage: job.stage, progress: job.progress }
      : progress;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-4 overflow-hidden sm:max-w-[1100px] [&>*]:min-w-0">
        <DialogHeader className="shrink-0">
          <DialogTitle>Export canvas videos</DialogTitle>
          <DialogDescription>
            Select videos, then select their output formats. MP4 files and cover
            images go to each video&apos;s own renders folder. Existing files
            stay in place.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-5 md:h-[min(60dvh,520px)] md:grid-cols-[0.9fr_1.1fr]">
          <ScrollArea
            className="min-h-0 max-h-[28dvh] md:max-h-[60dvh]"
            viewportProps={{ tabIndex: 0, "aria-label": "Canvas videos" }}
          >
            <div className="flex flex-col gap-3 pr-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">1. Videos</h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || loading}
                  onClick={() =>
                    setSelected(
                      rows
                        .filter(
                          (row) =>
                            row.video && !row.video.error && !row.video.draft,
                        )
                        .map((row) => row.slug),
                    )
                  }
                >
                  Select all ready
                </Button>
              </div>
              {loading ? (
                <p role="status">Checking videos…</p>
              ) : (
                rows.map((row) => (
                  <Label
                    key={row.slug}
                    className="flex items-start gap-3 rounded-md border p-3 font-normal"
                  >
                    <Checkbox
                      aria-label={`Export ${row.name}`}
                      disabled={
                        busy ||
                        Boolean(
                          (row.error || row.video?.error) &&
                          !selected.includes(row.slug),
                        )
                      }
                      checked={selected.includes(row.slug)}
                      onCheckedChange={(checked) =>
                        setSelected((previous) =>
                          checked
                            ? [...previous, row.slug]
                            : previous.filter((slug) => slug !== row.slug),
                        )
                      }
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="break-words font-medium">
                        {row.name}
                        {row.slug === doc.slug ? " (selected in editor)" : ""}
                      </span>
                      <span className="break-words text-xs text-muted-foreground">
                        {row.error ||
                          row.video?.error ||
                          (row.video?.draft
                            ? "Draft: no picture clips. Select this video only if you want this output."
                            : "Ready to export")}
                      </span>
                    </span>
                  </Label>
                ))
              )}
              {!loading && !rows.length ? (
                <p>No videos are available.</p>
              ) : null}
              {rows
                .filter(
                  (row) => row.video && rendersFrom(row.video.assets).length,
                )
                .map((row) => (
                  <SavedFiles
                    key={row.slug}
                    video={row.video!}
                    getBridge={getBridge}
                  />
                ))}
            </div>
          </ScrollArea>
          <ScrollArea
            className="min-h-0 max-h-[36dvh] md:max-h-[60dvh]"
            viewportProps={{ tabIndex: 0, "aria-label": "Output settings" }}
          >
            <div className="flex flex-col gap-4 pr-3">
              <h3 className="text-sm font-semibold">2. Output formats</h3>
              {selectedRows.map((row) =>
                row?.video?.doc.project ? (
                  <fieldset
                    key={row.slug}
                    disabled={busy}
                    className="flex min-w-0 flex-col gap-2"
                  >
                    <legend className="mb-2 break-words text-sm font-medium">
                      {row.name}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {exportFormats(row.video.doc.project)
                        .filter(
                          (format) =>
                            format.existing ||
                            (selected.length === 1 && row.slug === doc.slug),
                        )
                        .map((format) => {
                          const size = exportSize(format, resolution);
                          return (
                            <Label
                              key={format.id}
                              className="flex items-center gap-2 rounded-md border px-3 py-2 font-normal"
                            >
                              <Checkbox
                                aria-label={`${row.name}: ${format.label}`}
                                checked={(formats[row.slug] ?? []).includes(
                                  format.id,
                                )}
                                disabled={busy}
                                onCheckedChange={() =>
                                  void toggleFormat(row.video!, format)
                                }
                              />
                              <span className="flex flex-col gap-0.5 text-xs">
                                {format.label}
                                {!format.existing ? " (add)" : ""}
                                <span className="text-muted-foreground">
                                  {size.width} × {size.height}
                                </span>
                              </span>
                            </Label>
                          );
                        })}
                    </div>
                  </fieldset>
                ) : null,
              )}
              <div className="grid grid-cols-2 gap-3">
                <Label className="flex flex-col items-start gap-2">
                  Resolution
                  <select
                    aria-label="Resolution"
                    className="w-full rounded-md border bg-background p-2 text-sm"
                    disabled={busy}
                    value={resolution}
                    onChange={(event) =>
                      setResolution(event.target.value as ExportResolution)
                    }
                  >
                    <option value="project">Project size</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="2160p">4K</option>
                  </select>
                </Label>
                <Label className="flex flex-col items-start gap-2">
                  Quality
                  <select
                    aria-label="Quality"
                    className="w-full rounded-md border bg-background p-2 text-sm"
                    disabled={busy}
                    value={quality}
                    onChange={(event) =>
                      setQuality(event.target.value as "high" | "maximum")
                    }
                  >
                    <option value="high">High</option>
                    <option value="maximum">Maximum</option>
                  </select>
                </Label>
              </div>
              <Label className="flex items-start gap-2 text-xs font-normal">
                <Checkbox
                  disabled={busy}
                  checked={normalize}
                  onCheckedChange={(checked) => setNormalize(checked === true)}
                />
                Normalize loudness to -14 LUFS (peaks at most -1 dBTP)
              </Label>
              {!localSupported ? (
                <p className="text-xs text-muted-foreground">
                  Update the helper to use these settings for computer renders.
                </p>
              ) : null}
              <details>
                <summary className="cursor-pointer text-xs font-medium">
                  Watch a video from this computer
                </summary>
                <div className="pt-3">
                  <LocalVideoViewer />
                </div>
              </details>
            </div>
          </ScrollArea>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t pt-3">
          <p className="text-sm font-medium">
            {selected.length} video{selected.length === 1 ? "" : "s"} ·{" "}
            {fileCount} MP4 file{fileCount === 1 ? "" : "s"}
          </p>
          <p
            className="truncate text-xs text-muted-foreground"
            title={choices.map((choice) => choice.name).join(", ")}
          >
            {choices.map((choice) => choice.name).join(", ")}
          </p>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : !loading && selectionError ? (
            <p className="text-xs text-muted-foreground">{selectionError}</p>
          ) : null}
          {message ? (
            <p role="status" className="text-xs">
              {message}
            </p>
          ) : null}
          {activeProgress ? (
            <p role="status" className="text-xs">
              {activeProgress.index}/{activeProgress.total} ·{" "}
              {activeProgress.name} · {activeProgress.variant} ·{" "}
              {activeProgress.stage} {Math.round(activeProgress.progress * 100)}
              %
            </p>
          ) : null}
          {results.length ? (
            <p className="text-xs text-muted-foreground">
              Saved:{" "}
              {results
                .map((result) => `${result.name} (${result.variant})`)
                .join(", ")}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            {mode ? (
              <Button variant="outline" onClick={cancel}>
                Cancel export
              </Button>
            ) : (
              <>
                <Button disabled={!canRun} onClick={() => void run("browser")}>
                  Export {fileCount} file{fileCount === 1 ? "" : "s"} in browser
                </Button>
                <Button
                  variant="outline"
                  disabled={!canRun || !localSupported}
                  onClick={() => void run("local")}
                >
                  Render on this computer
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
