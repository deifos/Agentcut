// Getting pixels to measure: one clip on its own, through the same renderer as the export, so graphics
// on other tracks never skew the numbers.
import type { ColorGrade, ImageClip, LoadedModule, StudioClip, StudioDoc, StudioTrack, VideoClip } from "../types";

export interface FramePixels { data: Uint8ClampedArray; width: number; height: number }

export async function blobToPixels(blob: Blob): Promise<FramePixels> {
  const bitmap = await createImageBitmap(blob);
  const pixels = bitmapToPixels(bitmap);
  bitmap.close();
  return pixels;
}

export function bitmapToPixels(bitmap: ImageBitmap): FramePixels {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { data, width, height };
}

/**
 * What's left of the grade when measuring:
 * - "source": nothing, the footage as recorded;
 * - "balanced": only shot matching, what a look is built on top of;
 * - "graded": everything: the clip's grade, adjustment layers and the project grade.
 */
export type GradeStage = "source" | "balanced" | "graded";

function stageGrade(grade: ColorGrade | undefined, stage: GradeStage): ColorGrade | undefined {
  if (stage === "graded") return grade;
  if (stage === "balanced" && grade?.match) return { match: grade.match };
  return undefined;
}

/** A project with only this clip, filling the frame, with its colour reduced to `stage`. */
export function isolateClip(doc: StudioDoc, clip: VideoClip | ImageClip, kind: "video" | "image", stage: GradeStage, variant: string): StudioDoc {
  const resolved = { ...clip, ...(clip as { variants?: Record<string, Partial<VideoClip>> }).variants?.[variant] } as VideoClip;
  const single = {
    ...resolved,
    grade: stageGrade(resolved.grade, stage),
    box: undefined,
    radius: undefined,
    enter: undefined,
    exit: undefined,
    opacity: undefined,
    cursor: undefined,
    camera: "none",
    muted: true,
    fit: "cover",
    variants: undefined,
  } as unknown as StudioClip;
  const tracks = doc.layers!.tracks;
  const clipTrack = tracks.findIndex((track) => track.clips.some((entry) => entry.id === clip.id));
  const adjustments = stage === "graded" && clipTrack >= 0
    ? tracks.slice(0, clipTrack).filter((track) => track.kind === "adjustment" && !track.hidden)
    : [];
  const track = { id: "measure", name: "Measure", kind, clips: [single] } as StudioTrack;
  return {
    ...doc,
    project: { ...doc.project!, style: undefined, grade: stage === "graded" ? doc.project!.grade : undefined },
    layers: { version: 1, markers: [], tracks: [...adjustments, track] },
  };
}

/** Frames of one clip at small size, spread evenly through it. */
export async function captureClipPixels(options: {
  doc: StudioDoc;
  loaded: LoadedModule;
  variant: string;
  clip: VideoClip | ImageClip;
  kind?: "video" | "image";
  stage: GradeStage;
  /** How many frames to measure. */
  samples?: number;
  /** Clip-local frames, instead of spreading `samples` through the clip. */
  at?: number[];
  width?: number;
}): Promise<FramePixels[]> {
  const { doc, loaded, variant, clip, stage } = options;
  const { captureFrame } = await import("../capture");
  const isolated = isolateClip(doc, clip, options.kind ?? "video", stage, variant);
  const size = doc.project!.variants[variant];
  const scale = Math.min(1, (options.width ?? 320) / size.width);
  const samples = Math.max(1, options.samples ?? 3);
  const local = options.at ?? Array.from({ length: samples }, (_, i) => Math.floor(((i + 0.5) / samples) * clip.duration));
  const out: FramePixels[] = [];
  for (const offset of local) {
    const blob = await captureFrame({
      doc: isolated,
      loaded,
      variant,
      frame: clip.from + Math.min(clip.duration - 1, Math.max(0, offset)),
      scale,
      format: "png",
    });
    out.push(await blobToPixels(blob));
  }
  return out;
}
