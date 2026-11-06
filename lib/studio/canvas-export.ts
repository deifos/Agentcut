import type {
  AssetEntry,
  BundleSummary,
  LoadedModule,
  OpenProjectResult,
  StudioDoc,
  StudioLayers,
  StudioProject,
} from "./types";
import type { StudioBridge } from "./bridge";

export interface CanvasExportCut {
  slug: string;
  title: string;
  version: string;
  sourceOnly?: boolean;
  poster?: { project: string; path: string; seconds?: number };
}
export interface ExportVideo {
  slug: string;
  name: string;
  doc: StudioDoc;
  assets: AssetEntry[];
  bundle: BundleSummary;
  editing: boolean;
  queued: boolean;
  error: string | null;
  draft: boolean;
}
export interface ExportChoice {
  slug: string;
  name: string;
  variants: string[];
}
export interface ExportFileProgress {
  slug: string;
  name: string;
  variant: string;
  index: number;
  total: number;
  stage: string;
  progress: number;
  message?: string;
}
export interface ExportFileResult {
  slug: string;
  name: string;
  variant: string;
  path?: string;
}

/** studio.project.snapshot returns a snapshot; only the controller's openProject changes selection. */
export async function readExportVideo(
  bridge: Pick<StudioBridge, "request">,
  slug: string,
  name?: string,
): Promise<ExportVideo> {
  const snapshot = await bridge
    .request<OpenProjectResult>("studio.project.snapshot", { slug }, 120_000)
    .catch((reason) => {
      if (/Unknown studio method/i.test(String(reason)))
        throw new Error(
          "Update the studio helper to select and export canvas videos.",
        );
      throw reason;
    });
  if (snapshot.slug !== slug)
    throw new Error(
      "The helper returned a different video. Export was stopped.",
    );
  const doc: StudioDoc = {
    slug,
    project: snapshot.projectValid ? (snapshot.project as StudioProject) : null,
    layers: snapshot.layersValid ? (snapshot.layers as StudioLayers) : null,
    projectHash: snapshot.projectHash,
    layersHash: snapshot.layersHash,
    issues: snapshot.issues,
    scenes: snapshot.scenes,
    dir: snapshot.dir,
  };
  const editing = Boolean(snapshot.chat.running);
  const queued = snapshot.chat.messages.some(
    (message) => message.status === "queued",
  );
  const hasContent = doc.layers?.tracks.some((track) => track.clips.length > 0);
  const hasPicture = doc.layers?.tracks.some(
    (track) =>
      !["audio", "adjustment"].includes(track.kind) && track.clips.length > 0,
  );
  const error = editing
    ? "Editing now — wait for this video to finish."
    : queued
      ? "An edit is queued for this video."
      : !doc.project ||
          !doc.layers ||
          snapshot.issues.some((issue) => issue.severity === "error")
        ? "Fix this video's file errors before export."
        : !snapshot.bundle?.ok || !snapshot.bundle.hasCode
          ? "Fix this video's build errors before export."
          : !hasContent
            ? "This video is empty."
            : null;
  return {
    slug,
    name: name ?? doc.project?.name ?? slug,
    doc,
    assets: snapshot.assets,
    bundle: snapshot.bundle,
    editing,
    queued,
    error,
    draft: !hasPicture,
  };
}

export function exportVideoFingerprint(video: ExportVideo) {
  return JSON.stringify([
    video.doc.projectHash,
    video.doc.layersHash,
    video.bundle.revision,
    video.assets
      .filter((asset) => asset.path.startsWith("assets/"))
      .map((asset) => [asset.path, asset.size, asset.updatedAt])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ]);
}

function assertExportable(video: ExportVideo, choice: ExportChoice) {
  if (video.error) throw new Error(`${choice.name}: ${video.error}`);
  if (!choice.variants.length)
    throw new Error(`Choose an output format for ${choice.name}.`);
  for (const variant of choice.variants)
    if (!video.doc.project?.variants[variant])
      throw new Error(
        `${choice.name}: the ${variant} format is no longer available. Review the selection.`,
      );
}

export interface CanvasExportDependencies {
  members(): Promise<string[]>;
  read(slug: string, name: string): Promise<ExportVideo>;
  load(video: ExportVideo): Promise<LoadedModule>;
  render(
    video: ExportVideo,
    variant: string,
    loaded: LoadedModule | null,
    report: (stage: string, progress: number, message?: string) => void,
  ): Promise<{ path?: string }>;
  onProgress(progress: ExportFileProgress): void;
  onResult(result: ExportFileResult, video: ExportVideo): void;
}

/** Serial explicit exports. Preflight all targets before rendering any; never change editor selection. */
export async function exportCanvasVideos(
  choices: ExportChoice[],
  mode: "browser" | "local",
  signal: AbortSignal,
  deps: CanvasExportDependencies,
) {
  const unique = new Map<string, ExportChoice>();
  for (const choice of choices)
    unique.set(choice.slug, {
      ...choice,
      variants: [...new Set(choice.variants)],
    });
  const selected = [...unique.values()];
  if (!selected.length) throw new Error("Choose at least one video.");
  const members = new Set(await deps.members());
  for (const choice of selected)
    if (!members.has(choice.slug))
      throw new Error(
        `${choice.name} is no longer in this canvas. Refresh the video list.`,
      );
  const videos = await Promise.all(
    selected.map((choice) => deps.read(choice.slug, choice.name)),
  );
  videos.forEach((video, index) => assertExportable(video, selected[index]));
  const total = selected.reduce(
    (sum, choice) => sum + choice.variants.length,
    0,
  );
  const saved: ExportFileResult[] = [];
  for (let index = 0; index < selected.length; index++) {
    const choice = selected[index];
    for (const variant of choice.variants) {
      signal.throwIfAborted();
      const video = await deps.read(choice.slug, choice.name);
      assertExportable(video, choice);
      if (
        exportVideoFingerprint(video) !== exportVideoFingerprint(videos[index])
      )
        throw new Error(
          `${choice.name} changed after export was started. Review it and export again.`,
        );
      const report = (stage: string, progress: number, message?: string) =>
        deps.onProgress({
          slug: choice.slug,
          name: choice.name,
          variant,
          index: saved.length + 1,
          total,
          stage,
          progress,
          message,
        });
      report("preparing", 0);
      const loaded = mode === "browser" ? await deps.load(video) : null;
      if (
        loaded &&
        (loaded.slug !== choice.slug ||
          loaded.revision !== video.bundle.revision)
      )
        throw new Error(
          `${choice.name}: its preview bundle changed. Review it before export.`,
        );
      signal.throwIfAborted();
      const fresh = await deps.read(choice.slug, choice.name);
      assertExportable(fresh, choice);
      if (exportVideoFingerprint(fresh) !== exportVideoFingerprint(video))
        throw new Error(
          `${choice.name} changed while preparing export. Review it before exporting.`,
        );
      signal.throwIfAborted();
      const result = await deps.render(video, variant, loaded, report);
      const file = {
        slug: choice.slug,
        name: choice.name,
        variant,
        path: result.path,
      };
      saved.push(file);
      deps.onResult(file, video);
      // A render may finish while a user edits. Report that saved file, but do not claim a clean batch.
      const after = await deps.read(choice.slug, choice.name);
      if (
        after.error ||
        exportVideoFingerprint(after) !== exportVideoFingerprint(video)
      )
        throw new Error(
          `${choice.name} changed during export. A file was saved; review it before use. The remaining exports were stopped.`,
        );
    }
  }
  return saved;
}
