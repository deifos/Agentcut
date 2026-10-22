import { STUDIO_BRIDGE_ORIGIN } from "@/lib/studio/bundle";
import { buildInputProps, variantSize } from "@/lib/studio/composition-props";
import { captureFrame } from "@/lib/studio/capture";
import type { LoadedModule, StudioDoc } from "@/lib/studio/types";

export const EXPORT_TARGET_LUFS = -14;
export const EXPORT_MAX_TRUE_PEAK_DB = -1;
/** AAC encoding can add 1–2 dB of peak on sharp transients; limit below the ceiling. */
const CODEC_PEAK_MARGIN_DB = 1;
/** The render's PCM is 16-bit: keep the planned mix under this so nothing clips before mastering. */
const RENDER_HEADROOM_DB = -1;

/** PUT a file into the project folder (never overwrites; returns the saved path). */
export async function uploadToProject(slug: string, path: string, body: Blob, signal?: AbortSignal) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${STUDIO_BRIDGE_ORIGIN}/studio/upload/${slug}/${encoded}`, {
    method: "PUT",
    body,
    signal,
    headers: { "content-type": body.type || "application/octet-stream" },
  });
  const result = (await response.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!response.ok || !result.path) throw new Error(result.error ?? `Upload failed (${response.status}).`);
  return result.path;
}

export function exportStamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export interface LoudnessPlan {
  gain: number;
  measuredLufs: number | null;
  truePeakDb: number | null;
  resultLufs: number | null;
  limitedByPeak: boolean;
}

/**
 * Master gain that brings the project's mix to −14 LUFS without pushing the
 * true peak above −1 dBTP (linear, like ffmpeg loudnorm's linear mode).
 */
export async function planLoudness(doc: StudioDoc, variant: string): Promise<LoudnessPlan> {
  const { mixProjectAudio } = await import("@/lib/studio/audio/mix");
  const { measureLoudness } = await import("@/lib/studio/audio/loudness");
  const mix = await mixProjectAudio(doc, variant);
  if (!mix) return { gain: 1, measuredLufs: null, truePeakDb: null, resultLufs: null, limitedByPeak: false };
  const measured = measureLoudness(mix);
  if (!Number.isFinite(measured.integratedLufs)) {
    return { gain: 1, measuredLufs: null, truePeakDb: measured.truePeakDb, resultLufs: null, limitedByPeak: false };
  }
  const lufsGainDb = EXPORT_TARGET_LUFS - measured.integratedLufs;
  const peakRoomDb = EXPORT_MAX_TRUE_PEAK_DB - CODEC_PEAK_MARGIN_DB - measured.truePeakDb;
  const gainDb = Math.min(lufsGainDb, peakRoomDb);
  return {
    gain: Math.pow(10, gainDb / 20),
    measuredLufs: measured.integratedLufs,
    truePeakDb: measured.truePeakDb,
    resultLufs: measured.integratedLufs + gainDb,
    limitedByPeak: peakRoomDb < lufsGainDb,
  };
}

export interface BrowserExportOptions {
  doc: StudioDoc;
  loaded: LoadedModule;
  variant: string;
  normalizeLoudness?: boolean;
  coverFrame?: number;
  quality?: "medium" | "high" | "very-high";
  /** H.264 by default (plays everywhere). VP9/AV1 only for browsers without an H.264 encoder. */
  videoCodec?: "h264" | "vp9" | "av1";
  signal?: AbortSignal;
  onProgress?: (stage: "preparing" | "rendering" | "uploading", progress: number, message?: string) => void;
}

export interface ExportedAudioCheck {
  integratedLufs: number;
  truePeakDb: number;
  samplePeakDb: number;
}

export type { MasteringReport } from "@/lib/studio/audio/master";

/** Decode the exported file's audio and measure what was actually encoded. */
async function measureExportedAudio(blob: Blob): Promise<ExportedAudioCheck | null> {
  try {
    const { measureLoudness, roundDb } = await import("@/lib/studio/audio/loudness");
    const context = new OfflineAudioContext(2, 1, 48_000);
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    const measured = measureLoudness(buffer);
    return {
      integratedLufs: roundDb(measured.integratedLufs),
      truePeakDb: roundDb(measured.truePeakDb),
      samplePeakDb: roundDb(measured.samplePeakDb),
    };
  } catch {
    return null;
  }
}

export interface BrowserExportResult {
  path: string;
  coverPath: string | null;
  size: number;
  loudness: LoudnessPlan | null;
  /** What mastering did to the rendered audio (null when the video has no audio). */
  mastering: import("@/lib/studio/audio/master").MasteringReport | null;
  /** Loudness of the encoded file (null when the browser can't decode it back). */
  measured: ExportedAudioCheck | null;
  blob: Blob;
  fileName: string;
}

/** Render one variant to MP4 (H.264/AAC, mastered to −14 LUFS) in the browser and save it to renders/. */
export async function exportInBrowser(options: BrowserExportOptions): Promise<BrowserExportResult> {
  const { doc, loaded, variant, signal } = options;
  if (!doc.project || !doc.layers) throw new Error("The project files are invalid; fix them before exporting.");
  const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
  const size = variantSize(doc.project, variant);

  const videoCodec = options.videoCodec ?? "h264";
  const check = await canRenderMediaOnWeb({
    container: "mp4",
    videoCodec,
    audioCodec: "pcm-s16",
    width: size.width,
    height: size.height,
  });
  if (!check.canRender) {
    const reasons = check.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
    throw new Error(`This browser can't export the video: ${reasons.join(" ")}. Use Chrome or Edge, or "Render on this computer".`);
  }

  // The page renders lossless PCM; mastering (loudness, limiter, AAC, priming) happens after.
  // The offline mix only sets a pre-gain so the 16-bit render can't clip.
  options.onProgress?.("preparing", 0, "Measuring loudness");
  let loudness: LoudnessPlan | null = null;
  try {
    loudness = await planLoudness(doc, variant);
  } catch (error) {
    console.warn("[studio] loudness measurement failed", error);
  }
  const preGainDb =
    loudness?.truePeakDb != null && Number.isFinite(loudness.truePeakDb) && loudness.truePeakDb > RENDER_HEADROOM_DB
      ? RENDER_HEADROOM_DB - loudness.truePeakDb
      : 0;

  const inputProps = buildInputProps(doc.slug, doc.project, doc.layers, variant, preGainDb ? Math.pow(10, preGainDb / 20) : undefined);
  const result = await renderMediaOnWeb({
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
    container: "mp4",
    videoCodec,
    audioCodec: "pcm-s16",
    videoBitrate: options.quality ?? "high",
    licenseKey: "free-license",
    signal: signal ?? null,
    delayRenderTimeoutInMilliseconds: 60_000,
    metadata: {},
    onProgress: (progress) => options.onProgress?.("rendering", progress.progress * 0.95),
  });
  const rendered = await result.getBlob();

  options.onProgress?.("rendering", 0.95, "Mastering audio");
  const { masterExport } = await import("@/lib/studio/audio/master");
  const mastered = await masterExport(rendered, {
    targetLufs: EXPORT_TARGET_LUFS,
    ceilingDb: EXPORT_MAX_TRUE_PEAK_DB - CODEC_PEAK_MARGIN_DB,
    normalize: options.normalizeLoudness !== false,
    baseGainDb: -preGainDb,
    fps: doc.project.fps,
    signal,
  });
  const blob = mastered?.blob ?? rendered;
  const stamp = exportStamp();
  const fileName = `${doc.slug}-${variant}-${stamp}${videoCodec === "h264" ? "" : `-${videoCodec}`}.mp4`;
  options.onProgress?.("uploading", 0, "Saving to renders/");
  const path = await uploadToProject(doc.slug, `renders/${fileName}`, blob, signal);

  let coverPath: string | null = null;
  try {
    const coverFrame = options.coverFrame ?? Math.round(doc.project.durationInFrames * 0.2);
    const cover = await captureFrame({ doc, loaded, variant, frame: coverFrame, format: "png" });
    coverPath = await uploadToProject(doc.slug, `renders/${doc.slug}-${variant}-${stamp}-cover.png`, cover, signal);
  } catch (error) {
    console.warn("[studio] cover capture failed", error);
  }
  options.onProgress?.("uploading", 1);
  const measured = await measureExportedAudio(blob);
  return { path, coverPath, size: blob.size, loudness, mastering: mastered?.report ?? null, measured, blob, fileName };
}
