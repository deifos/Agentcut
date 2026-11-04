import type { StudioProject } from "./types";

export const VIDEO_FORMATS = [
  { id: "landscape", label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
  { id: "portrait", label: "Portrait", ratio: "9:16", width: 1080, height: 1920 },
  { id: "square", label: "Square", ratio: "1:1", width: 1080, height: 1080 },
  { id: "portrait-4-5", label: "Portrait", ratio: "4:5", width: 1080, height: 1350 },
] as const;

export const sameRatio = (a: { width: number; height: number }, b: { width: number; height: number }) =>
  Math.abs(a.width / a.height - b.width / b.height) < 0.001;

export function exportFormats(project: StudioProject) {
  const existing = Object.entries(project.variants).map(([id, size]) => {
    const format = VIDEO_FORMATS.find((format) => sameRatio(size, format));
    return { id, ...size, label: format ? `${format.ratio} ${format.label}` : id, existing: true };
  });
  const missing = VIDEO_FORMATS.filter((format) => !existing.some((size) => sameRatio(size, format))).map((format) => {
    let id: string = format.id;
    for (let n = 2; project.variants[id]; n++) id = `${format.id}-${n}`;
    return { id, width: format.width, height: format.height, label: `${format.ratio} ${format.label}`, existing: false };
  });
  return [...existing, ...missing];
}
