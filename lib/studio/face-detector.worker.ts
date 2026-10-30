import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

// One detector per worker; local IMAGE inference avoids inter-clip timestamp state.
let detector: Promise<FaceDetector> | undefined;
function load() {
  return (detector ??= FilesetResolver.forVisionTasks(
    new URL("/vision/wasm", self.location.origin).href,
  )
    .then((files) =>
      FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL(
            "/vision/blaze_face_short_range.tflite",
            self.location.origin,
          ).href,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3,
      }),
    )
    .catch((error) => {
      detector = undefined;
      throw error;
    }));
}

self.onmessage = async ({
  data,
}: MessageEvent<{ id: number; image: ImageBitmap }>) => {
  const { id, image } = data;
  try {
    const model = await load();
    const result = model.detect(image);
    const faces = result.detections.flatMap((detection) => {
      const b = detection.boundingBox;
      if (!b) return [];
      const x = Math.max(0, b.originX / image.width),
        y = Math.max(0, b.originY / image.height);
      return [
        {
          x,
          y,
          width: Math.min(1 - x, b.width / image.width),
          height: Math.min(1 - y, b.height / image.height),
          score: detection.categories[0]?.score ?? 0,
        },
      ];
    });
    self.postMessage({ id, faces });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    image.close();
  }
};
