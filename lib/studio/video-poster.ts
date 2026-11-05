// One small decoded frame per file. Data URLs have no object-URL lifetime to leak.
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

async function decodePoster(url: string, seconds: number, maxEdge?: number) {
  const { Input, UrlSource, ALL_FORMATS, CanvasSink } = await import("mediabunny");
  const input = new Input({
    source: new UrlSource(url, { maxCacheSize: 4 * 1024 * 1024, parallelism: 1, getRetryDelay: () => null }),
    formats: ALL_FORMATS,
  });
  const timeout = window.setTimeout(() => input.dispose(), 15_000);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error("This browser cannot decode a preview of this video.");
    const start = await track.getFirstTimestamp();
    let width = 160;
    let height = 160;
    if (maxEdge) {
      const [w, h] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()]);
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      width = Math.max(1, Math.round(w * scale));
      height = Math.max(1, Math.round(h * scale));
    }
    const sink = new CanvasSink(track, { width, height, fit: "cover" });
    const frame = await sink.getCanvas(start + seconds) ?? await sink.getCanvas(start);
    if (!frame) throw new Error("No video frame is available.");
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(frame.canvas, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", maxEdge ? 0.9 : 0.82);
  } finally {
    window.clearTimeout(timeout);
    input.dispose();
  }
}

export function videoPoster(url: string, seconds = 0.5, maxEdge?: number): Promise<string> {
  const key = JSON.stringify([url, seconds, maxEdge]);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const result = decodePoster(url, seconds, maxEdge).then((poster) => {
    cache.set(key, poster);
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
    return poster;
  }).finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
}
