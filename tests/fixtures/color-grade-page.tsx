// Runs inside Chrome for tests/color-grade-browser.test.mjs: builds a small test video in the browser,
// then renders it through the real grade effect with the same web renderer the export uses.
import { renderMediaOnWeb, renderStillOnWeb } from "@remotion/web-renderer";
import { Video } from "@remotion/media";
import { AbsoluteFill, Img } from "remotion";
import type { ComponentType } from "react";
import { gradeCssFilter, parseCube, type ColorGrade, type CubeLut } from "../../motion/components/color/grade";
import { gradeEffects } from "../../motion/components/color/grade-effect";
import { GRADE_LOOKS } from "../../motion/components/color/looks";
import { bakeGradeCube, drawGradePreview, sharedGradePreview } from "../../lib/studio/color/preview";

const WIDTH = 320;
const HEIGHT = 180;
export const PATCHES: [string, string][] = [
  ["gray", "#808080"], ["dark", "#202020"], ["light", "#e0e0e0"], ["white", "#ffffff"],
  ["red", "#c03020"], ["green", "#30a040"], ["blue", "#2040c0"], ["skin", "#c89070"],
];

function Pattern() {
  return (
    <AbsoluteFill style={{ background: "#000", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "repeat(2, 1fr)" }}>
      {PATCHES.map(([name, color]) => <div key={name} style={{ background: color }} />)}
    </AbsoluteFill>
  );
}

const composition = (component: ComponentType<Record<string, unknown>>, frames = 8) => ({
  component, id: "test", width: WIDTH, height: HEIGHT, fps: 30, durationInFrames: frames, defaultProps: {},
});

let videoUrl: string | null = null;
async function testVideo() {
  if (videoUrl) return videoUrl;
  const result = await renderMediaOnWeb({
    composition: composition(Pattern as ComponentType<Record<string, unknown>>, 15),
    inputProps: {}, container: "webm", videoCodec: "vp8", audioCodec: null, muted: true, videoBitrate: "very-high", licenseKey: "free-license",
  } as Parameters<typeof renderMediaOnWeb>[0]);
  videoUrl = URL.createObjectURL(await result.getBlob());
  return videoUrl;
}

const IMAGE = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  PATCHES.forEach(([, color], i) => {
    ctx.fillStyle = color;
    ctx.fillRect((i % 4) * (WIDTH / 4), Math.floor(i / 4) * (HEIGHT / 2), WIDTH / 4, HEIGHT / 2);
  });
  return canvas.toDataURL("image/png");
})();

/** Average colour of the middle of each patch. */
async function readPatches(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const w = bitmap.width;
  const h = bitmap.height;
  bitmap.close();
  const out: Record<string, [number, number, number]> = {};
  PATCHES.forEach(([name], i) => {
    const cx = ((i % 4) + 0.5) * (w / 4);
    const cy = (Math.floor(i / 4) + 0.5) * (h / 2);
    const { data } = ctx.getImageData(Math.round(cx - w / 24), Math.round(cy - h / 12), Math.round(w / 12), Math.round(h / 6));
    const sum = [0, 0, 0];
    for (let p = 0; p < data.length; p += 4) for (let c = 0; c < 3; c += 1) sum[c] += data[p + c];
    const count = data.length / 4;
    out[name] = sum.map((v) => v / count) as [number, number, number];
  });
  return out;
}

interface Options { grade?: ColorGrade; css?: boolean; cube?: string; frame?: number; localFrame?: number; image?: boolean }

function comp(url: string, options: Options) {
  const luts = new Map<string, CubeLut>();
  if (options.cube) luts.set(options.grade?.lut ?? "test.cube", parseCube(options.cube));
  return function Comp() {
    const effects = options.grade && !options.css
      ? gradeEffects([{ grade: options.grade, frame: options.localFrame ?? 0 }], { seed: options.frame ?? 0, luts })
      : [];
    if (options.image) {
      return <AbsoluteFill><Img src={IMAGE} width={WIDTH} height={HEIGHT} effects={effects} style={{ objectFit: "fill" }} /></AbsoluteFill>;
    }
    return (
      <AbsoluteFill>
        <Video src={url} muted objectFit="fill" effects={effects}
          style={{ width: "100%", height: "100%", filter: options.css ? gradeCssFilter(options.grade) : undefined }} />
      </AbsoluteFill>
    );
  };
}

async function still(options: Options) {
  const url = await testVideo();
  const component = comp(url, options);
  const result = await renderStillOnWeb({
    composition: composition(component as ComponentType<Record<string, unknown>>),
    inputProps: {}, frame: options.frame ?? 2, scale: 1, licenseKey: "free-license", delayRenderTimeoutInMilliseconds: 30_000,
  } as Parameters<typeof renderStillOnWeb>[0]);
  return result.blob({ format: "png" });
}

async function exportFirstFrame(options: Options) {
  const url = await testVideo();
  const component = comp(url, options);
  const result = await renderMediaOnWeb({
    composition: composition(component as ComponentType<Record<string, unknown>>, 6),
    inputProps: {}, container: "webm", videoCodec: "vp8", audioCodec: null, muted: true, videoBitrate: "very-high", licenseKey: "free-license",
  } as Parameters<typeof renderMediaOnWeb>[0]);
  const exported = URL.createObjectURL(await result.getBlob());
  const again = comp(exported, {});
  const read = await renderStillOnWeb({
    composition: composition(again as ComponentType<Record<string, unknown>>),
    inputProps: {}, frame: 2, scale: 1, licenseKey: "free-license", delayRenderTimeoutInMilliseconds: 30_000,
  } as Parameters<typeof renderStillOnWeb>[0]);
  return read.blob({ format: "png" });
}

/** Spread of a frame's pixels in one patch: 0 for a flat colour, higher with grain. */
async function patchNoise(blob: Blob, patch: number) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  const w = bitmap.width / 4;
  const h = bitmap.height / 2;
  const { data } = ctx.getImageData((patch % 4) * w + w / 4, Math.floor(patch / 4) * h + h / 4, w / 2, h / 2);
  bitmap.close();
  let sum = 0;
  let sq = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i + 1];
    sq += data[i + 1] * data[i + 1];
  }
  return Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
}

/** A red top half over a blue bottom half, read back from the top and the bottom of a target. */
function thumbnailOrientation(grade: ColorGrade) {
  const source = new OffscreenCanvas(64, 36);
  const ctx = source.getContext("2d")!;
  ctx.fillStyle = "#c00000";
  ctx.fillRect(0, 0, 64, 18);
  ctx.fillStyle = "#0000c0";
  ctx.fillRect(0, 18, 64, 18);
  const target = document.createElement("canvas");
  drawGradePreview(sharedGradePreview()!, source, grade, target);
  const out = target.getContext("2d")!;
  return { top: [...out.getImageData(32, 4, 1, 1).data], bottom: [...out.getImageData(32, 32, 1, 1).data] };
}

/** Bake a grade and read what it says for pure red, green, blue, black and white. */
function bakedCorners(grade: ColorGrade) {
  const lut = parseCube(bakeGradeCube(grade, "test", null, 9));
  const at = (r: number, g: number, b: number) => [...lut.data.slice(((b * 81 + g * 9 + r) * 4), ((b * 81 + g * 9 + r) * 4) + 3)];
  return { black: at(0, 0, 0), red: at(8, 0, 0), green: at(0, 8, 0), blue: at(0, 0, 8), white: at(8, 8, 8) };
}

const api = {
  thumbnailOrientation,
  bakedCorners,
  lookIds: () => GRADE_LOOKS.map((look) => look.id),
  ready: () => testVideo().then(() => true),
  patches: async (options: Options) => readPatches(await still(options)),
  exported: async (options: Options) => readPatches(await exportFirstFrame(options)),
  noise: async (options: Options, patch: number) => patchNoise(await still(options), patch),
};
(window as unknown as { api: typeof api }).api = api;
document.title = "ready";
