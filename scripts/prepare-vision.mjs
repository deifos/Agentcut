import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// The pinned npm dependency supplies both SIMD and non-SIMD CPU runtimes.
const root = new URL("../", import.meta.url);
const target = new URL("public/vision/wasm/", root);
mkdirSync(target, { recursive: true });
for (const name of [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
]) {
  cpSync(
    fileURLToPath(
      new URL(`node_modules/@mediapipe/tasks-vision/wasm/${name}`, root),
    ),
    fileURLToPath(new URL(name, target)),
  );
}
// MediaPipe loads its WASM loader with importScripts, so use a classic worker.
await build({
  entryPoints: [
    fileURLToPath(new URL("lib/studio/face-detector.worker.ts", root)),
  ],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: fileURLToPath(new URL("public/vision/face-detector.js", root)),
  legalComments: "inline",
});
