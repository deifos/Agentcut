// Small frame grabs from video files for the timeline's film strips. One hidden <video> does all
// the work, one frame at a time (browsers cap how many media players a page may create), and
// every frame is cached as an object URL for the session.

const THUMB_HEIGHT = 90;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

interface Job {
  url: string;
  time: number;
  resolve(value: string | null): void;
}

const queue: Job[] = [];
let running = false;

const key = (url: string, time: number) => `${url}#${time}`;

function waitFor(video: HTMLVideoElement, event: "loadedmetadata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      video.removeEventListener(event, done);
      video.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => {
      video.removeEventListener(event, done);
      video.removeEventListener("error", fail);
      reject(new Error("video error"));
    };
    video.addEventListener(event, done);
    video.addEventListener("error", fail);
  });
}

async function grab(
  video: HTMLVideoElement,
  time: number,
): Promise<string | null> {
  const target = Math.min(
    Math.max(0, time),
    Math.max(0, video.duration - 0.05),
  );
  if (Math.abs(video.currentTime - target) > 0.01) {
    const seeked = waitFor(video, "seeked");
    video.currentTime = target;
    await seeked;
  }
  const scale = THUMB_HEIGHT / Math.max(1, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = THUMB_HEIGHT;
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.72),
  );
  return blob ? URL.createObjectURL(blob) : null;
}

async function run() {
  if (running) return;
  running = true;
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  let currentUrl = "";
  try {
    while (queue.length) {
      // Finish one file before moving to the next, so the element isn't reloaded per frame.
      const index = Math.max(
        0,
        queue.findIndex((job) => job.url === currentUrl),
      );
      const job = queue.splice(index, 1)[0];
      try {
        if (job.url !== currentUrl) {
          currentUrl = job.url;
          const loaded = waitFor(video, "loadedmetadata");
          video.src = job.url;
          await loaded;
        }
        job.resolve(await grab(video, job.time));
      } catch {
        currentUrl = "";
        job.resolve(null);
      }
    }
  } finally {
    video.removeAttribute("src");
    video.load();
    running = false;
  }
}

/** A frame of `url` at `time` seconds (rounded to the cache step), or null if it can't be read. */
export function videoFrame(url: string, time: number): Promise<string | null> {
  const k = key(url, time);
  const hit = cache.get(k);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(k);
  if (inFlight) return inFlight;
  const promise = new Promise<string | null>((resolve) => {
    queue.push({
      url,
      time,
      resolve: (value) => {
        pending.delete(k);
        if (value) cache.set(k, value);
        resolve(value);
      },
    });
    void run();
  });
  pending.set(k, promise);
  return promise;
}

/** Already-grabbed frame, if any (for a synchronous first paint). */
export function cachedVideoFrame(url: string, time: number) {
  return cache.get(key(url, time)) ?? null;
}
