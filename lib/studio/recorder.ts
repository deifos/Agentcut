// Camera takes for talking-head videos. With WebCodecs, mediabunny encodes the live tracks straight
// to an H.264/AAC MP4 that seeks precisely on the timeline; without, MediaRecorder is the fallback.

import {
  BufferTarget,
  getFirstEncodableVideoCodec,
  MediaStreamAudioTrackSource,
  MediaStreamVideoTrackSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
} from "mediabunny";
import { ensureAac } from "@/lib/studio/audio/master";

export interface CameraChoice {
  videoDeviceId?: string;
  audioDeviceId?: string;
}

/** 1080p landscape: vertical videos are framed in the editor, which leaves room to reframe. */
export function openCamera({ videoDeviceId, audioDeviceId }: CameraChoice) {
  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 },
    },
    audio: {
      deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
      // A steady voice level: no gain pumping between sentences.
      autoGainControl: false,
      noiseSuppression: true,
      echoCancellation: true,
      channelCount: 1,
    },
  });
}

export async function listDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: devices.filter((d) => d.kind === "videoinput" && d.deviceId),
    mics: devices.filter((d) => d.kind === "audioinput" && d.deviceId),
  };
}

export interface Take {
  blob: Blob;
  extension: "mp4" | "webm";
  seconds: number;
  /** Where the take starts: recording begins with the countdown so the encoder is warm by then. */
  startSeconds: number;
}

export interface TakeRecorder {
  /** Mark "now" as the start of the take (the end of the countdown). */
  markStart(): void;
  /** Finish the file. */
  stop(): Promise<Take>;
  /** Throw the recording away. */
  discard(): Promise<void>;
}

export async function startRecording(
  stream: MediaStream,
  onError: (error: Error) => void,
): Promise<TakeRecorder> {
  const video = stream.getVideoTracks()[0];
  const audio = stream.getAudioTracks()[0];
  if (!video) throw new Error("No camera found.");
  if (typeof VideoEncoder !== "undefined") {
    const settings = video.getSettings();
    const size = { width: settings.width ?? 1920, height: settings.height ?? 1080 };
    const codec = await getFirstEncodableVideoCodec(["avc", "vp9"], size);
    if (codec === "avc" || codec === "vp9") return startEncoded(video, audio, codec, onError);
  }
  return startMediaRecorder(stream, onError);
}

async function startEncoded(
  video: MediaStreamVideoTrack,
  audio: MediaStreamAudioTrack | undefined,
  codec: "avc" | "vp9",
  onError: (error: Error) => void,
): Promise<TakeRecorder> {
  const mp4 = codec === "avc";
  const output = new Output({
    format: mp4
      ? new Mp4OutputFormat({ fastStart: "in-memory" })
      : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const videoSource = new MediaStreamVideoTrackSource(video, {
    codec,
    bitrate: QUALITY_HIGH,
    latencyMode: "realtime",
  });
  output.addVideoTrack(videoSource, { frameRate: 30 });
  videoSource.errorPromise.catch(onError);
  if (audio) {
    const aac = mp4 ? await ensureAac().then(() => true).catch(() => false) : false;
    const audioSource = new MediaStreamAudioTrackSource(audio, {
      codec: aac ? "aac" : "opus",
      bitrate: 192_000,
    });
    output.addAudioTrack(audioSource);
    audioSource.errorPromise.catch(onError);
  }
  const started = performance.now();
  let startSeconds = 0;
  await output.start();
  return {
    markStart() {
      startSeconds = (performance.now() - started) / 1000;
    },
    async stop() {
      const seconds = (performance.now() - started) / 1000;
      await output.finalize();
      const buffer = (output.target as BufferTarget).buffer!;
      return {
        blob: new Blob([buffer], { type: mp4 ? "video/mp4" : "video/webm" }),
        extension: mp4 ? "mp4" : "webm",
        seconds,
        startSeconds,
      };
    },
    async discard() {
      await output.cancel();
    },
  };
}

function startMediaRecorder(
  stream: MediaStream,
  onError: (error: Error) => void,
): TakeRecorder {
  const mimeType = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(
    (type) => MediaRecorder.isTypeSupported(type),
  );
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.onerror = () => onError(new Error("Recording failed."));
  const started = performance.now();
  let startSeconds = 0;
  recorder.start(1000);
  const finished = () =>
    new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
  return {
    markStart() {
      startSeconds = (performance.now() - started) / 1000;
    },
    async stop() {
      const seconds = (performance.now() - started) / 1000;
      await finished();
      const type = recorder.mimeType || "video/webm";
      return {
        blob: new Blob(chunks, { type }),
        extension: type.startsWith("video/mp4") ? "mp4" : "webm",
        seconds,
        startSeconds,
      };
    },
    async discard() {
      await finished();
      chunks.length = 0;
    },
  };
}
