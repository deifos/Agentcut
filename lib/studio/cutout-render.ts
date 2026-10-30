import type { CutoutMessage, CutoutRequest } from "./cutout.worker";

export type CutoutResult = Extract<CutoutMessage, { type: "done" }>;
export type CutoutProgress = Extract<CutoutMessage, { type: "progress" }>;

/** One worker per cutout: the model and decoded frames are large, so nothing stays loaded afterwards. */
export function renderCutout(
  request: CutoutRequest,
  onProgress: (progress: CutoutProgress) => void,
): Promise<CutoutResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./cutout.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = (settle: () => void) => {
      worker.terminate();
      settle();
    };
    worker.onmessage = ({ data }: MessageEvent<CutoutMessage>) => {
      if (data.type === "progress") onProgress(data);
      else if (data.type === "done") finish(() => resolve(data));
      else finish(() => reject(new Error(data.message)));
    };
    worker.onerror = () =>
      finish(() =>
        reject(new Error("The cutout could not start. Reload the studio and try again.")),
      );
    worker.postMessage(request);
  });
}
