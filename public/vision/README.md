# Local face detector

Agentcut hosts these resources itself. No source frames are uploaded for detection.

- Runtime: `@mediapipe/tasks-vision` **0.10.32**, Apache-2.0, installed by npm. `scripts/prepare-vision.mjs` copies its WASM files and builds a classic worker here before development and production builds. Generated `wasm/` and `face-detector.js` files are not checked in.
- Model: Google's BlazeFace short-range, float16, **version 1**, downloaded unmodified from https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite . See the [official model documentation](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector) and [MediaPipe model catalog](https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/models.md).
- MediaPipe is Copyright Google LLC, Apache-2.0. The license is included in LICENSE.

The model is for nearby faces, such as webcam footage. It is not an arbitrary-object detector or a guarantee that a person will be detected. Detection runs on sampled source frames in a local worker. The result is a persisted, smoothed crop path for sampled face following, or an explicit fixed crop. This is not identity recognition or frame-by-frame tracking.
