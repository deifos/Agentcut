export type ExportResolution = "project" | "2160p" | "1080p" | "720p";

export function exportResolution(value: unknown): ExportResolution {
  if (value === undefined) return "project";
  if (value === "project" || value === "2160p" || value === "1080p" || value === "720p") return value;
  throw new Error('Unknown export resolution. Use "project", "2160p", "1080p", or "720p".');
}

/** Scale the output, not the layout. Only explicit 4K allows enlargement. */
export function exportSize(size: { width: number; height: number }, resolution: ExportResolution = "project") {
  const { width, height } = size;
  if (![width, height].every((value) => Number.isInteger(value) && value >= 2)) {
    throw new Error("Export dimensions must be integers of at least 2 pixels.");
  }
  const limit = resolution === "1080p" ? 1080 : resolution === "720p" ? 720 : Infinity;
  // Fit 4K within 3840×2160 (or portrait), and respect Remotion's 16× limit.
  const scale = resolution === "2160p"
    ? Math.min(16, 2160 / Math.min(width, height), 3840 / Math.max(width, height))
    : Math.min(1, limit / Math.min(width, height));
  // Remotion reduces the source dimension until its scaled size is even.
  // With enlargement, this can skip more than one output pixel.
  const even = (value: number) => {
    while (Math.round(value * scale) % 2 !== 0) value--;
    return Math.max(2, Math.round(value * scale));
  };
  return { scale, width: even(width), height: even(height) };
}
