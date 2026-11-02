// Scopes: pictures of a frame's colour. Each returns RGBA pixels, so they can be tested without a page.
import { vectorscope } from "./analyze";

export type ScopeKind = "waveform" | "parade" | "vectorscope" | "histogram";

export interface ScopeImage { width: number; height: number; data: Uint8ClampedArray }

function blank(width: number, height: number): ScopeImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Add `amount` of a colour to one scope pixel, so busy areas glow brighter. */
function plot(image: ScopeImage, x: number, y: number, r: number, g: number, b: number) {
  const i = (Math.round(y) * image.width + Math.round(x)) * 4;
  if (i < 0 || i + 3 >= image.data.length) return;
  image.data[i] += r;
  image.data[i + 1] += g;
  image.data[i + 2] += b;
  image.data[i + 3] = 255;
}

/** Brightness (or one channel) up the side, position in the frame along the bottom. */
export function waveform(pixels: Uint8ClampedArray | Uint8Array, frameWidth: number, frameHeight: number, width = 256, height = 128): ScopeImage {
  const image = blank(width, height);
  const gain = Math.max(6, Math.min(48, ((width * height) / (frameWidth * frameHeight)) * 40));
  for (let py = 0; py < frameHeight; py += 1) {
    for (let px = 0; px < frameWidth; px += 1) {
      const i = (py * frameWidth + px) * 4;
      if (pixels[i + 3] < 128) continue;
      const y = (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) / 255;
      plot(image, (px / frameWidth) * (width - 1), (1 - y) * (height - 1), gain * 0.7, gain, gain * 0.8);
    }
  }
  return image;
}

/** Red, green and blue waveforms side by side: unequal heights in neutral areas show a colour cast. */
export function parade(pixels: Uint8ClampedArray | Uint8Array, frameWidth: number, frameHeight: number, width = 256, height = 128): ScopeImage {
  const image = blank(width, height);
  const lane = Math.floor(width / 3);
  const gain = Math.max(6, Math.min(48, ((lane * height) / (frameWidth * frameHeight)) * 40));
  for (let py = 0; py < frameHeight; py += 1) {
    for (let px = 0; px < frameWidth; px += 1) {
      const i = (py * frameWidth + px) * 4;
      if (pixels[i + 3] < 128) continue;
      const x = (px / frameWidth) * (lane - 2);
      plot(image, x, (1 - pixels[i] / 255) * (height - 1), gain, gain * 0.15, gain * 0.15);
      plot(image, x + lane, (1 - pixels[i + 1] / 255) * (height - 1), gain * 0.15, gain, gain * 0.15);
      plot(image, x + lane * 2, (1 - pixels[i + 2] / 255) * (height - 1), gain * 0.2, gain * 0.2, gain);
    }
  }
  return image;
}

/** Hue around the circle, saturation out from the middle. Skin of any complexion lies on one line. */
export function vectorscopeImage(pixels: Uint8ClampedArray | Uint8Array, frameWidth: number, frameHeight: number, size = 128): ScopeImage {
  const image = blank(size, size);
  const center = (size - 1) / 2;
  const count = frameWidth * frameHeight;
  const gain = Math.max(8, Math.min(60, ((size * size) / count) * 60));
  for (let i = 0; i < count * 4; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const scope = vectorscope(r / 255, g / 255, b / 255);
    const scale = center / 0.6;
    plot(image, center + scope.cb * scale, center - scope.cr * scale, (r / 255) * gain + gain * 0.2, (g / 255) * gain + gain * 0.2, (b / 255) * gain + gain * 0.2);
  }
  return image;
}

/** Share of pixels at each brightness, per channel. */
export function histogramImage(pixels: Uint8ClampedArray | Uint8Array, width = 256, height = 96): ScopeImage {
  const image = blank(width, height);
  const bins = [new Float32Array(width), new Float32Array(width), new Float32Array(width)];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    for (let c = 0; c < 3; c += 1) bins[c][Math.round((pixels[i + c] / 255) * (width - 1))] += 1;
  }
  // Ignoring the end bins, so a little clipping doesn't flatten the rest of the graph.
  let peak = 1;
  for (const bin of bins) for (let x = 1; x < width - 1; x += 1) peak = Math.max(peak, bin[x]);
  for (let x = 0; x < width; x += 1) {
    for (let c = 0; c < 3; c += 1) {
      const top = height - Math.min(height, Math.round(Math.sqrt(bins[c][x] / peak) * (height - 1)));
      for (let y = top; y < height; y += 1) plot(image, x, y, c === 0 ? 150 : 0, c === 1 ? 150 : 0, c === 2 ? 150 : 0);
    }
  }
  return image;
}

export function drawScope(kind: ScopeKind, pixels: Uint8ClampedArray, frameWidth: number, frameHeight: number): ScopeImage {
  switch (kind) {
    case "waveform":
      return waveform(pixels, frameWidth, frameHeight);
    case "parade":
      return parade(pixels, frameWidth, frameHeight);
    case "vectorscope":
      return vectorscopeImage(pixels, frameWidth, frameHeight);
    case "histogram":
      return histogramImage(pixels);
  }
}
