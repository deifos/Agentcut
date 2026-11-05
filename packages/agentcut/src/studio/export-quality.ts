export type ExportQuality = "high" | "maximum";

export function exportQuality(value: unknown): ExportQuality {
  if (value === undefined) return "high";
  if (value === "high" || value === "maximum") return value;
  throw new Error('Unknown export quality. Use "high" or "maximum".');
}

export function localEncodingArgs(quality: ExportQuality = "high") {
  // Keep full resolution/fps. Adaptive quality avoids a bitrate cap that can
  // damage detailed scenes. Both choices favor compression over encoding speed.
  // JPEG frame capture adds artifacts around text and flat colors before H.264
  // encoding. Use lossless frames for both quality levels; CRF controls the MP4.
  return [`--crf=${quality === "maximum" ? 14 : 20}`, "--x264-preset=slow", "--image-format=png"];
}
