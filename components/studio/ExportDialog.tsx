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
import {
  Clapperboard,
  Check,
  ChevronDown,
  Monitor,
  Smartphone,
  Square,
  RectangleVertical,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ExportVideoThumbnail, exportDuration } from "./ExportVideoThumbnail";
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
type Row = {
  slug: string;
  name: string;
  video?: ExportVideo;
  error?: string;
  poster?: CanvasExportCut["poster"];
};
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
  loaded,
  currentVariant,
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
  const [advanced, setAdvanced] = useState(false);
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
          const name =
            cut.version && cut.version !== "Original"
              ? `${title} · ${cut.version}`
              : title;
          try {
            return {
              slug: cut.slug,
              name,
              poster: cut.poster,
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
        setSelected(
          activeVideo && !activeVideo.error && !activeVideo.draft
            ? [doc.slug]
            : [],
        );
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
      setFormats((previous) => {
        const next = { ...previous };
        for (const video of refreshed) {
          const variants = video.doc.project?.variants ?? {};
          next[video.slug] = (previous[video.slug] ?? []).filter((id) =>
            Object.hasOwn(variants, id),
          );
        }
        return next;
      });
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
  const singleVideo =
    selectedRows.length === 1 ? selectedRows[0]?.video : undefined;
  const summarySize =
    singleVideo?.doc.project && choices[0]?.variants.length === 1
      ? exportSize(
          singleVideo.doc.project.variants[choices[0].variants[0]],
          resolution,
        )
      : null;
  const selectedDuration = exportDuration(singleVideo);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px] [&>*]:min-w-0">
        <DialogHeader className="shrink-0 px-5 pt-5 pb-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="size-5" />
            Export videos
          </DialogTitle>
          <DialogDescription>
            Select videos and output formats. MP4 files and cover images go to
            each video&apos;s own renders folder.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="studio-export-body grid min-h-0 md:grid-cols-[0.95fr_1.05fr]">
          <ScrollArea
            className="max-h-[25dvh] min-h-0 md:max-h-[min(52dvh,430px)]"
            viewportProps={{ tabIndex: 0, "aria-label": "Canvas videos" }}
          >
            <div className="flex min-w-0 flex-col gap-3 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Videos ({rows.length})
                </h3>
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
                <div
                  className="flex flex-col gap-3"
                  role="status"
                  aria-label="Checking videos"
                >
                  {[0, 1].map((item) => (
                    <Skeleton key={item} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                rows.map((row) => {
                  const checked = selected.includes(row.slug);
                  const issue = row.error || row.video?.error;
                  return (
                    <Field
                      key={row.slug}
                      orientation="horizontal"
                      data-disabled={busy || Boolean(issue && !checked)}
                    >
                      <FieldLabel
                        className={cn(
                          "studio-export-video flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border p-3",
                          checked && "studio-export-video-selected",
                        )}
                      >
                        <Checkbox
                          aria-label={`Export ${row.name}`}
                          disabled={busy || Boolean(issue && !checked)}
                          checked={checked}
                          onCheckedChange={(value) =>
                            setSelected((previous) =>
                              value
                                ? [...previous, row.slug]
                                : previous.filter((slug) => slug !== row.slug),
                            )
                          }
                        />
                        <ExportVideoThumbnail
                          video={row.video}
                          poster={row.poster}
                          loaded={row.slug === doc.slug ? loaded : null}
                          variant={
                            row.slug === doc.slug
                              ? currentVariant
                              : (row.video?.doc.project?.defaultVariant ?? "")
                          }
                          frame={row.slug === doc.slug ? coverFrame : 0}
                          paused={busy || !open}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="break-words text-sm font-semibold">
                            {row.name}
                          </span>
                          {row.slug === doc.slug ? (
                            <span className="text-xs font-normal text-muted-foreground">
                              Selected in editor
                            </span>
                          ) : null}
                          {issue ? (
                            <span className="break-words text-xs font-normal text-muted-foreground">
                              {issue}
                            </span>
                          ) : row.video?.draft ? (
                            <Badge variant="outline">
                              Draft · no picture clips
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Check />
                              Ready to export
                            </Badge>
                          )}
                        </span>
                      </FieldLabel>
                    </Field>
                  );
                })
              )}
              {!loading && !rows.length ? (
                <p className="text-sm text-muted-foreground">
                  No videos are available.
                </p>
              ) : null}
            </div>
          </ScrollArea>
          <ScrollArea
            className="max-h-[37dvh] min-h-0 border-t md:max-h-[min(52dvh,430px)] md:border-t-0 md:border-l"
            viewportProps={{ tabIndex: 0, "aria-label": "Output settings" }}
          >
            <div className="flex min-w-0 flex-col gap-3 px-5 py-4 sm:px-6">
              <h3 className="text-sm font-semibold">Output formats</h3>
              {selectedRows.map((row) =>
                row?.video?.doc.project ? (
                  <FieldSet key={row.slug} disabled={busy} className="gap-2">
                    <FieldLegend className="mb-0 break-words text-sm">
                      {row.name}
                    </FieldLegend>
                    <ToggleGroup
                      type="multiple"
                      variant="outline"
                      spacing={2}
                      className={cn(
                        "studio-export-formats grid w-full items-stretch gap-2",
                        selected.length > 1
                          ? "grid-cols-2"
                          : "grid-cols-2 sm:grid-cols-4",
                      )}
                      value={formats[row.slug] ?? []}
                      onValueChange={(values) => {
                        const changed = [
                          ...new Set([...(formats[row.slug] ?? []), ...values]),
                        ].find(
                          (id) =>
                            (formats[row.slug] ?? []).includes(id) !==
                            values.includes(id),
                        );
                        const format = exportFormats(
                          row.video!.doc.project!,
                        ).find((format) => format.id === changed);
                        if (format) void toggleFormat(row.video!, format);
                      }}
                    >
                      {exportFormats(row.video.doc.project)
                        .filter(
                          (format) =>
                            format.existing ||
                            (selected.length === 1 && row.slug === doc.slug),
                        )
                        .map((format) => {
                          const size = exportSize(format, resolution);
                          const ratio = (format.width / format.height).toFixed(
                            2,
                          );
                          const Icon =
                            format.width === format.height
                              ? Square
                              : format.width > format.height
                                ? Monitor
                                : ratio === "0.56"
                                  ? Smartphone
                                  : RectangleVertical;
                          const [aspect, ...name] = format.label.split(" ");
                          return (
                            <ToggleGroupItem
                              key={format.id}
                              value={format.id}
                              disabled={busy}
                              aria-label={`${row.name}: ${format.label}`}
                              className={cn(
                                "studio-export-format h-auto min-w-0 gap-1 rounded-lg! border! px-2",
                                selected.length > 1
                                  ? "flex-row flex-wrap justify-start gap-x-2 py-2"
                                  : "flex-col py-2.5",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "size-5",
                                  selected.length === 1 && "mb-1",
                                )}
                              />
                              <span className="font-semibold">{aspect}</span>
                              <span className="text-xs font-normal">
                                {name.join(" ")}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-normal text-muted-foreground",
                                  selected.length > 1 && "w-full text-left",
                                )}
                              >
                                {size.width} × {size.height}
                              </span>
                              {!format.existing ? (
                                <span className="text-[10px] font-normal text-muted-foreground">
                                  Add format
                                </span>
                              ) : null}
                            </ToggleGroupItem>
                          );
                        })}
                    </ToggleGroup>
                  </FieldSet>
                ) : null,
              )}
              {!selected.length ? (
                <p className="text-sm text-muted-foreground">
                  Select a video to choose its formats.
                </p>
              ) : null}
              <Separator />
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="size-4" />
                Resolution &amp; quality
              </h3>
              <FieldGroup className="grid grid-cols-2 gap-3">
                <Field className="gap-2">
                  <FieldLabel htmlFor="export-resolution">
                    Resolution
                  </FieldLabel>
                  <Select
                    disabled={busy}
                    value={resolution}
                    onValueChange={(value) =>
                      setResolution(value as ExportResolution)
                    }
                  >
                    <SelectTrigger
                      id="export-resolution"
                      aria-label="Resolution"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="project">Project size</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                        <SelectItem value="2160p">4K</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-2">
                  <FieldLabel htmlFor="export-quality">Quality</FieldLabel>
                  <Select
                    disabled={busy}
                    value={quality}
                    onValueChange={(value) =>
                      setQuality(value as "high" | "maximum")
                    }
                  >
                    <SelectTrigger
                      id="export-quality"
                      aria-label="Quality"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectGroup>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="maximum">Maximum</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              {summarySize ? (
                <p className="-mt-2 text-xs text-muted-foreground">
                  {summarySize.width} × {summarySize.height} ·{" "}
                  {resolution === "project"
                    ? "Uses the video’s format size"
                    : "Scaled for this output"}
                </p>
              ) : null}
              {!localSupported ? (
                <p className="text-xs text-muted-foreground">
                  Update the helper to use these settings for computer renders.
                </p>
              ) : null}
              <Separator />
              <Collapsible open={advanced} onOpenChange={setAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between px-0"
                  >
                    Advanced
                    <ChevronDown
                      className={cn(
                        "transition-transform",
                        advanced && "rotate-180",
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-4 pt-3">
                  <Field orientation="horizontal">
                    <Checkbox
                      id="export-normalize"
                      disabled={busy}
                      checked={normalize}
                      onCheckedChange={(value) => setNormalize(value === true)}
                    />
                    <FieldLabel
                      htmlFor="export-normalize"
                      className="text-xs font-normal"
                    >
                      Normalize loudness to -14 LUFS (peaks at most -1 dBTP)
                    </FieldLabel>
                  </Field>
                  <LocalVideoViewer />
                  {rows
                    .filter(
                      (row) =>
                        row.video && rendersFrom(row.video.assets).length,
                    )
                    .map((row) => (
                      <SavedFiles
                        key={row.slug}
                        video={row.video!}
                        getBridge={getBridge}
                      />
                    ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </div>
        <Separator />
        <div className="flex shrink-0 flex-col gap-3 px-5 py-4 sm:px-6">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : !loading && selectionError ? (
            <p className="text-xs text-muted-foreground">{selectionError}</p>
          ) : null}
          {message ? (
            <p role="status" className="text-xs">
              {message}
            </p>
          ) : null}
          {activeProgress ? (
            <p role="status" className="truncate text-xs">
              {activeProgress.index}/{activeProgress.total} ·{" "}
              {activeProgress.name} · {activeProgress.variant} ·{" "}
              {activeProgress.stage} {Math.round(activeProgress.progress * 100)}
              %
            </p>
          ) : null}
          {results.length ? (
            <p
              className="truncate text-xs text-muted-foreground"
              title={results
                .map((result) => `${result.name} (${result.variant})`)
                .join(", ")}
            >
              Saved {results.length} file{results.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Monitor className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {selected.length} video{selected.length === 1 ? "" : "s"}{" "}
                  selected · {fileCount} MP4 file{fileCount === 1 ? "" : "s"}
                </p>
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={choices.map((choice) => choice.name).join(", ")}
                >
                  {[
                    selectedDuration,
                    summarySize
                      ? `${summarySize.width} × ${summarySize.height}`
                      : null,
                    `${quality === "maximum" ? "Maximum" : "High"} quality`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
            <div
              className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end"
              data-export-actions
            >
              {mode ? (
                <Button variant="outline" onClick={cancel}>
                  Cancel export
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={!canRun || !localSupported}
                    onClick={() => void run("local")}
                  >
                    <Monitor data-icon="inline-start" />
                    Render on this computer
                  </Button>
                  <Button
                    disabled={!canRun}
                    onClick={() => void run("browser")}
                  >
                    <Upload data-icon="inline-start" />
                    Export {fileCount} file{fileCount === 1 ? "" : "s"} in
                    browser
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
