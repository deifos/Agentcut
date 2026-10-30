import type { Box, FramingKeyframe } from "./types";

/** Stateless source-time interpolation: identical for seeking, preview and every export frame. */
export function framingCropAt(
  framing: { crop: Box; path?: FramingKeyframe[] },
  seconds: number,
): Box {
  const path = framing.path;
  if (!path?.length || !Number.isFinite(seconds)) return framing.crop;
  if (seconds <= path[0].seconds) return path[0].crop;
  if (seconds >= path[path.length - 1].seconds)
    return path[path.length - 1].crop;
  let low = 0,
    high = path.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (path[mid].seconds <= seconds) low = mid;
    else high = mid;
  }
  const a = path[low],
    b = path[high];
  const progress = (seconds - a.seconds) / (b.seconds - a.seconds);
  return {
    x: a.crop.x + (b.crop.x - a.crop.x) * progress,
    y: a.crop.y + (b.crop.y - a.crop.y) * progress,
    width: a.crop.width + (b.crop.width - a.crop.width) * progress,
    height: a.crop.height + (b.crop.height - a.crop.height) * progress,
  };
}
