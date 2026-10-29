// One small decoded frame per file. Data URLs have no object-URL lifetime to leak.
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

async function decodePoster(url: string) {
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
    const sink = new CanvasSink(track, { width: 160, height: 160, fit: "cover" });
    const frame = await sink.getCanvas(start + 0.5) ?? await sink.getCanvas(start);
    if (!frame) throw new Error("No video frame is available.");
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 160;
    canvas.getContext("2d")!.drawImage(frame.canvas, 0, 0, 160, 160);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    window.clearTimeout(timeout);
    input.dispose();
  }
}

export function videoPoster(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;
  const result = decodePoster(url).then((poster) => {
    cache.set(url, poster);
    if (cache.size > 32) cache.delete(cache.keys().next().value!);
    return poster;
  }).finally(() => pending.delete(url));
  pending.set(url, result);
  return result;
}
