import type { StudioToolContext } from "./agent-tools";
import type { VideoClip, StudioDoc } from "./types";
import {
  addCutoutClip,
  cutoutClip,
  cutoutPlacement,
  cutoutRange,
  rangeNeedsFullClip,
  retimedVariant,
} from "./cutout";
import type { CutoutProgress, CutoutResult } from "./cutout-render";
import type { CutoutRequest } from "./cutout.worker";
import { findClip } from "./edit";
import { studioFileUrl } from "./file-url";

/** Without WebGPU each frame takes several times longer, so keep those jobs short. */
const MAX_FRAMES_WEBGPU = 5400;
const MAX_FRAMES_WASM = 1800;

export interface CutoutDeps {
  render(
    request: CutoutRequest,
    onProgress: (progress: CutoutProgress) => void,
  ): Promise<CutoutResult>;
  exists(url: string): Promise<boolean>;
  sourceVersion(url: string): Promise<string | null>;
  upload(slug: string, path: string, blob: Blob): Promise<string>;
  onProgress?(progress: CutoutProgress): void;
  hasWebGpu?: boolean;
}

const defaultDeps: CutoutDeps = {
  render: async (request, onProgress) =>
    (await import("./cutout-render")).renderCutout(request, onProgress),
  exists: async (url) => {
    const response = await fetch(url, { method: "HEAD", cache: "no-cache" });
    return response.ok;
  },
  sourceVersion: async (url) => {
    const response = await fetch(url, { method: "HEAD", cache: "no-cache" });
    if (!response.ok) throw new Error("The source video could not be read.");
    return response.headers.get("x-studio-revision");
  },
  upload: async (slug, path, blob) =>
    (await import("./export")).uploadToProject(slug, path, blob),
};

async function cutoutPath(src: string, start: number, end: number, frameStep: number, version: string) {
  const base = (src.split("/").pop() ?? "clip")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-");
  const key = new TextEncoder().encode(JSON.stringify(["v2", src, start, end, frameStep, version]));
  const digest = await crypto.subtle.digest("SHA-256", key);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `assets/cutouts/${base}-${hash}.webm`;
}

function sameFootage(a: VideoClip, b: VideoClip) {
  return (
    a.src === b.src &&
    a.from === b.from &&
    a.duration === b.duration &&
    a.trimStart === b.trimStart &&
    a.playbackRate === b.playbackRate
  );
}

export async function runPersonCutout(
  params: Record<string, unknown>,
  doc: StudioDoc,
  context: StudioToolContext,
  overrides: Partial<CutoutDeps> = {},
) {
  if (!doc.project || !doc.layers)
    throw new Error("Open a valid project first.");
  const deps = { ...defaultDeps, ...overrides };
  const candidates = doc.layers.tracks
    .filter((t) => t.kind === "video" && !t.hidden && !t.locked)
    .flatMap((t) => t.clips);
  const selection = context
    .getSelection()
    .filter((id) => candidates.some((c) => c.id === id));
  const id =
    typeof params.clipId === "string"
      ? params.clipId
      : selection.length === 1
        ? selection[0]
        : candidates.length === 1
          ? candidates[0].id
          : null;
  if (!id)
    return {
      status: "selection_required",
      next: "Select the footage clip or pass clipId. Nothing was changed.",
      candidates: candidates.map((c) => ({ id: c.id, name: c.name })),
    };
  const found = findClip(doc.layers, id);
  if (!found || found.track.kind !== "video" || found.track.hidden || found.track.locked)
    return {
      status: "unsupported_selection",
      clipId: id,
      next: "Choose a visible video clip on an unlocked track. Video inside a scene is not supported.",
    };
  const clip = found.clip as VideoClip;
  if (/^(https?:|data:|blob:)/i.test(clip.src))
    return {
      status: "unsupported_source",
      clipId: id,
      next: "Import remote footage into the project first.",
    };
  const retimed = retimedVariant(clip);
  if (retimed)
    return {
      status: "unsupported_variant",
      variant: retimed,
      next: "This clip uses different footage or timing in that variant, so one cutout can't line up with both. Remove the override, or use a separate clip.",
    };
  const range = cutoutRange(
    clip,
    doc.project.fps,
    params.fromFrame as number | undefined,
    params.durationInFrames as number | undefined,
  );
  if (!range)
    return {
      status: "invalid_range",
      clip: { from: clip.from, duration: clip.duration },
      next: "fromFrame and durationInFrames are timeline frames and must stay inside the clip.",
    };
  if (rangeNeedsFullClip(clip, range, Boolean(doc.project.style)))
    return {
      status: "needs_full_clip",
      clipId: id,
      next: "A style camera or an enter/exit animation on this range depends on the whole clip. Omit fromFrame and durationInFrames.",
    };
  const hasWebGpu = deps.hasWebGpu ?? "gpu" in navigator;
  const limit = hasWebGpu ? MAX_FRAMES_WEBGPU : MAX_FRAMES_WASM;
  if (range.duration > limit)
    return {
      status: "range_too_long",
      limit,
      next: `Cut out at most ${limit} frames at a time on this computer. Pass only the frames where a graphic sits behind the person.`,
    };
  const behind = Array.isArray(params.behind)
    ? params.behind.filter((value): value is string => typeof value === "string")
    : [];
  const placement = cutoutPlacement(doc.layers, id, behind);
  if (!placement.ok) return { ...placement, applied: false };

  let attemptedSave = false;
  try {
    const sourceUrl = studioFileUrl(doc.slug, clip.src);
    const version = await deps.sourceVersion(sourceUrl);
    const path = await cutoutPath(clip.src, range.sourceStart, range.sourceEnd, (clip.playbackRate ?? 1) / doc.project.fps, version ?? crypto.randomUUID());
    let saved = path;
    let result: CutoutResult | null = null;
    if (!(await deps.exists(studioFileUrl(doc.slug, path)))) {
      result = await deps.render(
        {
          url: studioFileUrl(doc.slug, clip.src),
          start: range.sourceStart,
          end: range.sourceEnd,
          frameStep: (clip.playbackRate ?? 1) / doc.project.fps,
        },
        (progress) => deps.onProgress?.(progress),
      );
      if (!result.blob)
        return {
          status: "no_person",
          applied: false,
          coverage: result.coverage,
          next: "No person was found in most of this range. Choose a range where someone is clearly visible.",
        };
      saved = await deps.upload(doc.slug, path, result.blob);
    }

    // Cutting out can take minutes and the user keeps editing: apply to the timeline as it is now.
    const sourceChanged = version !== null && await deps.sourceVersion(sourceUrl) !== version;
    const current = context.getDoc();
    const latest = current?.layers ? findClip(current.layers, id) : null;
    if (
      sourceChanged ||
      !current?.layers ||
      current.slug !== doc.slug ||
      current.project?.fps !== doc.project.fps ||
      !latest ||
      latest.track.kind !== "video" || latest.track.hidden || latest.track.locked ||
      retimedVariant(latest.clip as VideoClip) ||
      rangeNeedsFullClip(latest.clip as VideoClip, range, Boolean(current.project?.style)) ||
      !sameFootage(latest.clip as VideoClip, clip)
    )
      return {
        status: "stale_project",
        applied: false,
        file: saved,
        next: "The footage clip changed while this ran. Check its timing and run the tool again.",
      };
    const finalPlacement = cutoutPlacement(current.layers, id, behind);
    if (!finalPlacement.ok)
      return { ...finalPlacement, applied: false, file: saved };
    const clipId = `${id}-cutout-${range.from}`;
    attemptedSave = true;
    await context.applyToolLayers(
      addCutoutClip(
        current.layers,
        id,
        cutoutClip(latest.clip as VideoClip, range, saved, clipId),
        finalPlacement.index,
      ),
      current,
    );
    return {
      status: "applied",
      project: doc.slug,
      clipId,
      trackId: `cutout-${id}`,
      file: saved,
      from: range.from,
      duration: range.duration,
      reused: !result,
      ...(result
        ? {
            frames: result.frames,
            device: result.device,
            coverage: result.coverage,
            size: { width: result.width, height: result.height },
          }
        : {}),
      local: true,
      next: behind.length
        ? "Check captures where the graphic overlaps the person."
        : "Put the graphic on a track between the footage track and this cutout track, then check captures where they overlap.",
      note: "The cutout copied the clip's trim, speed, box, crop and grade once. After changing those on the footage, run this tool again.",
      undo: "Use Undo, or delete the cutout clip.",
    };
  } catch (error) {
    return {
      status: "error",
      applied: attemptedSave ? "unconfirmed" : false,
      message: error instanceof Error ? error.message : String(error),
      next: "Check the source and the connection to the helper. Inspect the timeline after a save error. Do not install a segmentation package or write a script instead.",
    };
  }
}
