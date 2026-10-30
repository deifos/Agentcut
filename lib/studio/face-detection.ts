import type { FaceBox, FaceSample } from "./framing";

let worker: Worker | undefined;
let sequence = 0;
// Serialize all calls: a shared detector must never receive simultaneous inference requests.
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<
  string,
  Promise<{ width: number; height: number; samples: FaceSample[] }>
>();

function detect(image: ImageBitmap): Promise<FaceBox[]> {
  worker ??= new Worker("/vision/face-detector.js");
  const active = worker;
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      active.removeEventListener("message", onMessage);
      active.removeEventListener("error", onError);
    };
    const fail = (message: string) => {
      clean();
      active.terminate();
      if (worker === active) worker = undefined;
      reject(new Error(message));
    };
    const onMessage = ({
      data,
    }: MessageEvent<{ id: number; faces?: FaceBox[]; error?: string }>) => {
      if (data.id !== id) return;
      clean();
      if (data.error) reject(new Error(data.error));
      else resolve(data.faces ?? []);
    };
    const onError = () =>
      fail(
        "Local face detection could not start. Reload the studio and check that its /vision resources are available.",
      );
    const timer = setTimeout(
      () =>
        fail(
          "Local face detection timed out. Try a shorter clip or reload the studio.",
        ),
      45_000,
    );
    active.addEventListener("message", onMessage);
    active.addEventListener("error", onError);
    active.postMessage({ id, image }, [image]);
  });
}

async function sampleVideo(url: string, times: number[]) {
  const { Input, UrlSource, ALL_FORMATS, CanvasSink } =
    await import("mediabunny");
  const input = new Input({
    source: new UrlSource(url, {
      maxCacheSize: 16 * 1024 * 1024,
      parallelism: 1,
      getRetryDelay: () => null,
    }),
    formats: ALL_FORMATS,
  });
  const timer = setTimeout(() => input.dispose(), 300_000);
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode()))
      throw new Error(
        "This browser cannot decode the source video. Use a supported MP4 or WebM source.",
      );
    const width = await track.getDisplayWidth(),
      height = await track.getDisplayHeight();
    const duration = await input.computeDuration();
    if (times.some((t) => !Number.isFinite(t) || t < 0 || t >= duration))
      throw new Error(
        "The clip trim or duration extends beyond its source. Correct the clip range before framing.",
      );
    // CanvasSink applies source rotation, flip and pixel aspect ratio before resizing.
    const sink = new CanvasSink(track, {
      width: Math.min(640, width),
      poolSize: 1,
    });
    const samples: FaceSample[] = [];
    const scratch = document.createElement("canvas");
    scratch.width = 32;
    scratch.height = 18;
    const pixels = scratch.getContext("2d", { willReadFrequently: true })!;
    let previousLuma: number[] | undefined;
    const firstTimestamp = await track.getFirstTimestamp();
    let index = 0;
    for await (const frame of sink.canvasesAtTimestamps(
      times.map((t) => Math.max(firstTimestamp, t)),
    )) {
      const seconds = times[index++];
      if (!frame)
        throw new Error(
          "A sampled source frame could not be decoded. No crop was applied.",
        );
      const image = await createImageBitmap(frame.canvas);
      pixels.drawImage(frame.canvas, 0, 0, 32, 18);
      const data = pixels.getImageData(0, 0, 32, 18).data;
      const luma = Array.from(
        { length: 32 * 18 },
        (_, p) =>
          (data[p * 4] * 0.299 +
            data[p * 4 + 1] * 0.587 +
            data[p * 4 + 2] * 0.114) /
          255,
      );
      const change = previousLuma
        ? luma.reduce(
            (sum, value, p) => sum + Math.abs(value - previousLuma![p]),
            0,
          ) / luma.length
        : 0;
      samples.push({
        seconds,
        faces: await detect(image),
        ...(change > 0.32 ? { sceneChange: true } : {}),
      });
      previousLuma = luma;
    }
    return { width, height, samples };
  } finally {
    clearTimeout(timer);
    input.dispose();
  }
}

/** Cache only within the page lifetime; file validators prevent reuse after replacement. */
export async function detectSourceFaces(url: string, times: number[]) {
  const headers = await fetch(url, { method: "HEAD", cache: "no-cache" });
  if (!headers.ok)
    throw new Error("The source video is unavailable. Check its project path.");
  const validator =
    headers.headers.get("etag") ?? headers.headers.get("last-modified");
  const key = validator
    ? JSON.stringify([
        url,
        validator,
        headers.headers.get("content-length"),
        times,
      ])
    : null;
  const hit = key ? cache.get(key) : undefined;
  if (hit) return hit;
  const task = queue.catch(() => undefined).then(() => sampleVideo(url, times));
  queue = task;
  if (key) {
    cache.set(key, task);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
    task.catch(() => {
      if (cache.get(key) === task) cache.delete(key);
    });
  }
  return task;
}
