export type ExportResolution = "project" | "1080p" | "720p";

export function exportResolution(value: unknown): ExportResolution {
  if (value === undefined) return "project";
  if (value === "project" || value === "1080p" || value === "720p") return value;
  throw new Error('Unknown export resolution. Use "project", "1080p", or "720p".');
}

/** Scale the output, not the composition layout. Never enlarge smaller projects. */
export function exportSize(size: { width: number; height: number }, resolution: ExportResolution = "project") {
  const { width, height } = size;
  if (![width, height].every((value) => Number.isInteger(value) && value >= 2)) {
    throw new Error("Export dimensions must be integers of at least 2 pixels.");
  }
  const limit = resolution === "1080p" ? 1080 : resolution === "720p" ? 720 : Infinity;
  const scale = Math.min(1, limit / Math.min(width, height));
  // Both Remotion H.264 renderers round scaled dimensions down to even pixels.
  const even = (value: number) => Math.max(2, Math.floor(Math.round(value * scale) / 2) * 2);
  return { scale, width: even(width), height: even(height) };
}
