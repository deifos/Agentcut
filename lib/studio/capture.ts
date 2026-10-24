import type { LoadedModule, StudioDoc } from "@/lib/studio/types";
import { buildInputProps, variantSize } from "@/lib/studio/composition-props";
import { formatFrameTime } from "@/lib/studio/format";

export interface CaptureRequest {
  doc: StudioDoc;
  loaded: LoadedModule;
  variant: string;
  frame: number;
  /** Output scale (1 = full size). */
  scale?: number;
  format?: "png" | "jpeg" | "webp";
  quality?: number;
}

/**
 * Render one frame with Remotion's web renderer — the same renderer the
 * browser export uses — so unsupported CSS shows up here, not after export.
 */
export async function captureFrame(request: CaptureRequest): Promise<Blob> {
  const { doc, loaded, variant } = request;
  if (!doc.project || !doc.layers) throw new Error("The project files are invalid; fix them first.");
  const { renderStillOnWeb } = await import("@remotion/web-renderer");
  const size = variantSize(doc.project, variant);
  const frame = Math.max(0, Math.min(doc.project.durationInFrames - 1, Math.round(request.frame)));
  const inputProps = buildInputProps(doc.slug, doc.project, doc.layers, variant);
  const result = await renderStillOnWeb({
    composition: {
      component: loaded.module.StudioComposition,
      id: `studio-${doc.slug}-${variant}`,
      width: size.width,
      height: size.height,
      fps: doc.project.fps,
      durationInFrames: doc.project.durationInFrames,
      defaultProps: inputProps,
    },
    inputProps,
    frame,
    scale: request.scale ?? 1,
    licenseKey: "free-license",
    delayRenderTimeoutInMilliseconds: 30_000,
  });
  return result.blob({ format: request.format ?? "png", quality: request.quality });
}

/** Cut `region` (composition pixels) out of a frame captured at `scale`, as PNG. */
export async function cropToRegion(
  blob: Blob,
  region: { x: number; y: number; width: number; height: number },
  scale: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const width = Math.round(region.width * scale);
  const height = Math.round(region.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // Same scale in and out: a straight pixel copy, no resampling.
  canvas.getContext("2d")!.drawImage(bitmap, Math.round(region.x * scale), Math.round(region.y * scale), width, height, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((out) => (out ? resolve(out) : reject(new Error("Couldn't encode the region."))), "image/png"),
  );
}

export interface ContactSheetOptions {
  doc: StudioDoc;
  loaded: LoadedModule;
  variant: string;
  frames: number[];
  columns?: number;
  thumbWidth?: number;
}

/** A grid of frames with frame/time labels in one PNG. */
export async function captureContactSheet(options: ContactSheetOptions): Promise<Blob> {
  const { doc, loaded, variant, frames } = options;
  if (!doc.project) throw new Error("The project file is invalid.");
  const size = variantSize(doc.project, variant);
  const thumbWidth = options.thumbWidth ?? (size.height > size.width ? 270 : 480);
  const scale = thumbWidth / size.width;
  const thumbHeight = Math.round(size.height * scale);
  const columns = Math.max(1, Math.min(options.columns ?? (size.height > size.width ? 6 : 4), frames.length));
  const rows = Math.ceil(frames.length / columns);
  const label = 28;
  const gap = 8;
  const canvas = document.createElement("canvas");
  canvas.width = columns * thumbWidth + (columns + 1) * gap;
  canvas.height = rows * (thumbHeight + label) + (rows + 1) * gap;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't create a canvas.");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (let i = 0; i < frames.length; i += 1) {
    const blob = await captureFrame({ doc, loaded, variant, frame: frames[i], scale, format: "jpeg", quality: 0.9 });
    const bitmap = await createImageBitmap(blob);
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = gap + col * (thumbWidth + gap);
    const y = gap + row * (thumbHeight + label + gap);
    ctx.drawImage(bitmap, x, y, thumbWidth, thumbHeight);
    bitmap.close();
    ctx.fillStyle = "#e5e5e5";
    ctx.fillText(`#${frames[i]}  ${formatFrameTime(frames[i], doc.project.fps)}`, x + 4, y + thumbHeight + label / 2);
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the contact sheet."))), "image/png"),
  );
}
