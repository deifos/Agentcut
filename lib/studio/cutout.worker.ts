import { AutoModel, Tensor, type PreTrainedModel } from "@huggingface/transformers";
import {
  ALL_FORMATS,
  BufferTarget,
  CanvasSink,
  Input,
  Output,
  QUALITY_HIGH,
  UrlSource,
  VideoSample,
  VideoSampleSource,
  WebMOutputFormat,
} from "mediabunny";
import {
  cutoutSize,
  hasPerson,
  matteCoverage,
  matteSize,
  smoothMatte,
} from "./cutout";

const MODEL_ID = "Xenova/modnet";

export interface CutoutRequest {
  url: string;
  start: number;
  end: number;
  /** Seconds between frames the clip can show; denser source frames are skipped. */
  frameStep: number;
}

export type CutoutMessage =
  | { type: "progress"; stage: "model" | "frames"; progress: number; device?: Device }
  | {
      type: "done";
      blob: Blob | null;
      frames: number;
      device: Device;
      coverage: number;
      width: number;
      height: number;
    }
  | { type: "error"; message: string };

type Device = "webgpu" | "wasm";

const post = (message: CutoutMessage) => self.postMessage(message);

async function loadModel(width: number, height: number) {
  const open = async (device: Device) => {
    const model = await AutoModel.from_pretrained(MODEL_ID, {
      device,
      dtype: device === "webgpu" ? "fp32" : "q8",
      progress_callback: (progress: { status?: string; progress?: number }) => {
        if (progress.status === "progress")
          post({
            type: "progress",
            stage: "model",
            progress: (progress.progress ?? 0) / 100,
          });
      },
    });
    // Shader compilation can fail even after the model loads.
    await run(model, new Float32Array(3 * width * height), width, height);
    return { model, device };
  };
  if (!("gpu" in navigator)) return open("wasm");
  try {
    return await open("webgpu");
  } catch {
    return open("wasm");
  }
}

async function run(
  model: PreTrainedModel,
  pixels: Float32Array,
  width: number,
  height: number,
) {
  const { output } = await model({
    input: new Tensor("float32", pixels, [1, 3, height, width]),
  });
  return output.data as Float32Array;
}

async function cutOut({ url, start, end, frameStep }: CutoutRequest) {
  const input = new Input({
    source: new UrlSource(url, { maxCacheSize: 64 * 1024 * 1024 }),
    formats: ALL_FORMATS,
  });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode()))
      throw new Error(
        "This browser cannot decode the source video. Use a supported MP4 or WebM source.",
      );
    const display = {
      width: await track.getDisplayWidth(),
      height: await track.getDisplayHeight(),
    };
    const size = cutoutSize(display.width, display.height);
    const matte = matteSize(display.width, display.height);
    const { model, device } = await loadModel(matte.width, matte.height);

    const small = new OffscreenCanvas(matte.width, matte.height);
    const smallContext = small.getContext("2d", { willReadFrequently: true })!;
    const mask = new OffscreenCanvas(matte.width, matte.height);
    const maskContext = mask.getContext("2d")!;
    const maskImage = new ImageData(matte.width, matte.height);
    const composite = new OffscreenCanvas(size.width, size.height);
    const context = composite.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    const pixels = new Float32Array(3 * matte.width * matte.height);

    const source = new VideoSampleSource({
      codec: "vp9",
      bitrate: QUALITY_HIGH,
      alpha: "keep",
      keyFrameInterval: 1,
    });
    const output = new Output({
      format: new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    output.addVideoTrack(source);
    await output.start();

    const sink = new CanvasSink(track, {
      width: size.width,
      height: size.height,
      fit: "fill",
      poolSize: 1,
    });
    let smoothed: Float32Array | null = null;
    let frames = 0;
    const coverages: number[] = [];
    const timestamps = Array.from(
      { length: Math.ceil((end - start) / frameStep - 1e-8) },
      (_, index) => start + index * frameStep,
    );
    for await (const frame of sink.canvasesAtTimestamps(timestamps)) {
      if (!frame) throw new Error("No source frame is available at the requested time.");

      smallContext.drawImage(frame.canvas, 0, 0, matte.width, matte.height);
      const { data } = smallContext.getImageData(0, 0, matte.width, matte.height);
      const count = matte.width * matte.height;
      for (let i = 0; i < count; i += 1) {
        pixels[i] = data[i * 4] / 127.5 - 1;
        pixels[count + i] = data[i * 4 + 1] / 127.5 - 1;
        pixels[count * 2 + i] = data[i * 4 + 2] / 127.5 - 1;
      }
      const raw = await run(model, pixels, matte.width, matte.height);
      smoothed = smoothMatte(smoothed, raw);
      coverages.push(matteCoverage(smoothed));
      for (let i = 0; i < count; i += 1) {
        maskImage.data[i * 4 + 3] = Math.round(smoothed[i] * 255);
      }
      maskContext.putImageData(maskImage, 0, 0);

      context.globalCompositeOperation = "copy";
      context.drawImage(mask, 0, 0, size.width, size.height);
      context.globalCompositeOperation = "source-in";
      context.drawImage(frame.canvas, 0, 0, size.width, size.height);

      const sample = new VideoSample(composite, {
        timestamp: frames * frameStep,
        duration: Math.min(frameStep, end - start - frames * frameStep),
      });
      await source.add(sample);
      sample.close();
      frames += 1;
      post({
        type: "progress",
        stage: "frames",
        device,
        progress: Math.max(0, Math.min(1, (frame.timestamp - start) / (end - start))),
      });
    }
    if (!frames) throw new Error("No frames could be read in this range.");
    const coverage = coverages.reduce((a, b) => a + b, 0) / coverages.length;
    if (!hasPerson(coverages)) {
      await output.cancel();
      post({
        type: "done",
        blob: null,
        frames,
        device,
        coverage,
        width: size.width,
        height: size.height,
      });
      return;
    }
    await output.finalize();
    post({
      type: "done",
      blob: new Blob([output.target.buffer!], { type: "video/webm" }),
      frames,
      device,
      coverage,
      width: size.width,
      height: size.height,
    });
  } finally {
    input.dispose();
  }
}

self.onmessage = async ({ data }: MessageEvent<CutoutRequest>) => {
  try {
    await cutOut(data);
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
