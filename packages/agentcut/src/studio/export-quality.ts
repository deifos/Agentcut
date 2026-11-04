export type ExportQuality = "high" | "maximum";

export function exportQuality(value: unknown): ExportQuality {
  if (value === undefined) return "high";
  if (value === "high" || value === "maximum") return value;
  throw new Error('Unknown export quality. Use "high" or "maximum".');
}

export function localEncodingArgs(quality: ExportQuality = "high") {
  // Keep full resolution/fps. Adaptive quality avoids a bitrate cap that can
  // damage detailed scenes. Both choices favor compression over encoding speed.
  return [`--crf=${quality === "maximum" ? 18 : 20}`, "--x264-preset=slow"];
}
