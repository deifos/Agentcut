// Drawing grades outside a render: look thumbnails from one real frame, and baking a grade to a .cube.
import { gradePasses, serializeCube, type ColorGrade, type CubeLut, type GradeFields } from "@/motion/components/color/grade";
import { cleanupGradeRenderer, drawGrade, setupGradeRenderer, type GradeRendererState } from "@/motion/components/color/grade-effect";
import { gradeLook } from "@/motion/components/color/looks";

export interface GradePreview {
  canvas: HTMLCanvasElement;
  state: GradeRendererState;
  dispose(): void;
}

export function createGradePreview(): GradePreview | null {
  try {
    const canvas = document.createElement("canvas");
    const state = setupGradeRenderer(canvas);
    return {
      canvas,
      state,
      dispose: () => {
        cleanupGradeRenderer(state);
        state.gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
  } catch {
    return null;
  }
}

let shared: GradePreview | null | undefined;
/** One renderer for every thumbnail: browsers only allow a handful of WebGL contexts. */
export function sharedGradePreview() {
  if (shared === undefined) shared = createGradePreview();
  return shared;
}

const previewQueue: (() => void)[] = [];
let previewFrame: number | null = null;

/** Run `task` on a later frame, one per frame, so opening the looks grid never stalls the page. */
export function queueGradePreview(task: () => void) {
  previewQueue.push(task);
  const pump = () => {
    previewFrame = null;
    previewQueue.shift()?.();
    if (previewQueue.length) previewFrame = requestAnimationFrame(pump);
  };
  if (previewFrame === null) previewFrame = requestAnimationFrame(pump);
  return () => {
    const index = previewQueue.indexOf(task);
    if (index >= 0) previewQueue.splice(index, 1);
  };
}

function drawPasses(preview: GradePreview, source: TexImageSource, width: number, height: number, passes: GradeFields[], flipSourceY: boolean, lut: CubeLut | null = null) {
  const { canvas, state } = preview;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  let input = source;
  for (const fields of passes) {
    drawGrade(state, { source: input, width, height, flipSourceY, params: { fields, lut: fields.lut ? lut : null, seed: 1 } });
    input = canvas;
  }
}

/**
 * Draw `source` through `grade` onto a 2D canvas. Files (LUTs) aren't loaded for thumbnails. `source` has
 * to be a canvas: WebGL ignores its flip setting for an ImageBitmap, which draws it upside down.
 */
export function drawGradePreview(preview: GradePreview, source: OffscreenCanvas, grade: ColorGrade, target: HTMLCanvasElement) {
  const passes = gradePasses(grade, 0, gradeLook);
  drawPasses(preview, source, source.width, source.height, passes.length ? passes : [{}], true);
  target.width = source.width;
  target.height = source.height;
  // CPU canvases: a grid of GPU ones means a compositor layer each, which makes scrolling heavy.
  target.getContext("2d", { willReadFrequently: true })?.drawImage(preview.canvas, 0, 0);
}

/** The colour part of a grade as a 3D LUT. Grain, glow and vignette depend on position, so they're left out. */
export function bakeGradeCube(fields: GradeFields, title: string, lut: CubeLut | null = null, size = 33) {
  const { grain: _grain, grainSize: _size, halation: _halation, bloom: _bloom, vignette: _vignette, ...color } = fields;
  void _grain; void _size; void _halation; void _bloom; void _vignette;
  const passes = gradePasses(color, 0, gradeLook).map((pass) => {
    const { grain: _g, grainSize: _s, halation: _h, bloom: _b, vignette: _v, ...rest } = pass;
    void _g; void _s; void _h; void _b; void _v;
    return rest;
  });
  const preview = createGradePreview();
  if (!preview) throw new Error("Saving a look needs WebGL2.");
  try {
    // Every grid colour as one pixel of a strip, run through the shader, read back.
    const width = size * size;
    const height = size;
    const strip = new OffscreenCanvas(width, height);
    const stripCtx = strip.getContext("2d", { willReadFrequently: true })!;
    const image = stripCtx.createImageData(width, height);
    const last = size - 1;
    for (let b = 0; b < size; b += 1)
      for (let g = 0; g < size; g += 1)
        for (let r = 0; r < size; r += 1) {
          const i = (g * size + r + b * width) * 4;
          image.data[i] = Math.round((r / last) * 255);
          image.data[i + 1] = Math.round((g / last) * 255);
          image.data[i + 2] = Math.round((b / last) * 255);
          image.data[i + 3] = 255;
        }
    stripCtx.putImageData(image, 0, 0);
    drawPasses(preview, strip, width, height, passes.length ? passes : [{}], true, lut);
    stripCtx.clearRect(0, 0, width, height);
    stripCtx.drawImage(preview.canvas, 0, 0);
    const { data } = stripCtx.getImageData(0, 0, width, height);
    return serializeCube(size, title, (r, g, b) => {
      const ri = Math.round(r * last);
      const gi = Math.round(g * last);
      const bi = Math.round(b * last);
      const i = (gi * size + ri + bi * width) * 4;
      return [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    });
  } finally {
    preview.dispose();
  }
}
