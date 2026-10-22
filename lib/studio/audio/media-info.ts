import { decodeAudioUrl } from "@/lib/studio/audio/decode";

const AUDIO = /\.(wav|mp3|m4a|aac|ogg|opus|flac)$/i;
const VIDEO = /\.(mp4|m4v|webm|mov)$/i;
const IMAGE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

function videoMetadata(url: string) {
  return new Promise<{ duration: number; width: number; height: number }>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.muted = true;
    const timer = setTimeout(() => reject(new Error("Timed out reading video metadata.")), 20_000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("The browser couldn't read this video."));
    };
    video.src = url;
  });
}

function imageMetadata(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The browser couldn't read this image."));
    image.src = url;
  });
}

export async function mediaInfo(url: string, path: string, fps: number) {
  if (AUDIO.test(path)) {
    const buffer = await decodeAudioUrl(url);
    return {
      kind: "audio",
      seconds: Number(buffer.duration.toFixed(3)),
      frames: Math.round(buffer.duration * fps),
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
    };
  }
  if (VIDEO.test(path)) {
    const meta = await videoMetadata(url);
    let hasAudio = false;
    try {
      const audio = await decodeAudioUrl(url);
      hasAudio = audio.length > 0;
    } catch {}
    return {
      kind: "video",
      seconds: Number(meta.duration.toFixed(3)),
      frames: Math.round(meta.duration * fps),
      width: meta.width,
      height: meta.height,
      hasAudio,
    };
  }
  if (IMAGE.test(path)) {
    return { kind: "image", ...(await imageMetadata(url)) };
  }
  throw new Error("Unknown media type.");
}
