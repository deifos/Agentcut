// Strokes drawn on the preview to show the agent where things go. Points are in composition
// pixels, so the drawing means the same thing at any zoom and in the frame the agent sees.
import { getStroke } from "perfect-freehand";

/** x, y in composition pixels; pressure 0..1. */
export type DrawPoint = [x: number, y: number, pressure: number];

export interface DrawStroke {
  points: DrawPoint[];
  /** Pen width in composition pixels (taken from the zoom it was drawn at, so it feels the same on screen). */
  size: number;
  /** A real pen reports pressure; a mouse or finger gets simulated pressure from speed. */
  pen: boolean;
}

export const DRAW_COLOR = "#ff3b5c";

/** The outline of a stroke (perfect-freehand, the pen tldraw uses), as an SVG path. */
export function strokePath(stroke: DrawStroke, done = true) {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: !stroke.pen,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
    last: done,
  });
  return svgPathFromOutline(outline);
}

function svgPathFromOutline(points: number[][]) {
  const n = points.length;
  if (n < 4) return "";
  const avg = (a: number, b: number) => (a + b) / 2;
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0]).toFixed(2)},${avg(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2; i < n - 1; i += 1) {
    a = points[i];
    b = points[i + 1];
    result += `${avg(a[0], b[0]).toFixed(2)},${avg(a[1], b[1]).toFixed(2)} `;
  }
  return `${result}Z`;
}

const round = (value: number) => Math.round(value);
const at = ([x, y]: DrawPoint | [number, number]) => `(${round(x)}, ${round(y)})`;

/** Up to `count` points evenly spaced along the stroke, ends included. */
function samplePath(points: DrawPoint[], count: number): [number, number][] {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    lengths.push(lengths[i - 1] + Math.hypot(x1 - x0, y1 - y0));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0 || points.length <= count) return points.map(([x, y]) => [x, y]);
  const out: [number, number][] = [];
  let j = 0;
  for (let k = 0; k < count; k += 1) {
    const target = (total * k) / (count - 1);
    while (j < lengths.length - 2 && lengths[j + 1] < target) j += 1;
    const span = lengths[j + 1] - lengths[j] || 1;
    const t = Math.min(1, (target - lengths[j]) / span);
    const [x0, y0] = points[j];
    const [x1, y1] = points[j + 1];
    out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  }
  return out;
}

/** One line per stroke, in drawing order: a point, a loop around an area, or a path with a direction. */
export function describeStrokes(
  strokes: DrawStroke[],
  size: { width: number; height: number },
) {
  const lines = [
    `The user drew on the frame (${size.width}×${size.height} px, origin top-left). The attached frame shows the drawing in red with each stroke numbered in the order it was drawn:`,
  ];
  strokes.forEach((stroke, index) => {
    const xs = stroke.points.map((p) => p[0]);
    const ys = stroke.points.map((p) => p[1]);
    const box = {
      left: Math.min(...xs),
      top: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
    const diagonal = Math.hypot(box.width, box.height);
    const first = stroke.points[0];
    const last = stroke.points[stroke.points.length - 1];
    const gap = Math.hypot(last[0] - first[0], last[1] - first[1]);
    const label = `${index + 1}.`;
    if (diagonal < Math.max(12, size.width * 0.01)) {
      lines.push(`${label} a point at ${at(first)}`);
    } else if (gap < diagonal * 0.25 && stroke.points.length > 8) {
      const center: [number, number] = [box.left + box.width / 2, box.top + box.height / 2];
      lines.push(
        `${label} a loop around the area centered at ${at(center)}, about ${round(box.width)}×${round(box.height)} px`,
      );
    } else {
      const path = samplePath(stroke.points, 10).map(at).join(" ");
      lines.push(`${label} a line from ${at(first)} to ${at(last)}, path: ${path}`);
    }
  });
  return lines.join("\n");
}

/**
 * Where each stroke's number goes: just behind its first point, so it doesn't sit on the line,
 * pushed aside when an earlier number is already there (a line that starts at a circle).
 */
export function badgePositions(strokes: DrawStroke[], radius: number) {
  const placed: [number, number][] = [];
  for (const stroke of strokes) {
    const [x, y] = stroke.points[0];
    // The direction the stroke sets off in, from the first point a little way along.
    const ahead =
      stroke.points.find((p) => Math.hypot(p[0] - x, p[1] - y) > radius) ??
      stroke.points[stroke.points.length - 1];
    const length = Math.hypot(ahead[0] - x, ahead[1] - y);
    // A dot has no direction: up and to the left.
    const back: [number, number] = length
      ? [(x - ahead[0]) / length, (y - ahead[1]) / length]
      : [-Math.SQRT1_2, -Math.SQRT1_2];
    let spot: [number, number] = [x + back[0] * radius * 1.6, y + back[1] * radius * 1.6];
    for (let tries = 0; tries < 8; tries += 1) {
      const clash = placed.find((q) => Math.hypot(q[0] - spot[0], q[1] - spot[1]) < radius * 2.2);
      if (!clash) break;
      const away = Math.hypot(spot[0] - clash[0], spot[1] - clash[1]) || 1;
      const dir: [number, number] =
        away > 1 ? [(spot[0] - clash[0]) / away, (spot[1] - clash[1]) / away] : [-back[1], back[0]];
      spot = [clash[0] + dir[0] * radius * 2.3, clash[1] + dir[1] * radius * 2.3];
    }
    placed.push(spot);
  }
  return placed;
}

/** Draws the strokes (and their numbers, when there are several) onto a frame snapshot. */
export async function burnStrokes(frame: Blob, strokes: DrawStroke[], compositionWidth: number) {
  const bitmap = await createImageBitmap(frame);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't create a canvas.");
  ctx.drawImage(bitmap, 0, 0);
  const scale = bitmap.width / compositionWidth;
  ctx.scale(scale, scale);
  for (const stroke of strokes) {
    const path = new Path2D(strokePath(stroke));
    // A dark halo keeps the red readable on light and busy frames alike.
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = stroke.size * 0.35;
    ctx.stroke(path);
    ctx.fillStyle = DRAW_COLOR;
    ctx.fill(path);
  }
  if (strokes.length > 1) {
    const radius = Math.max(14, strokes[0].size * 2.2);
    badgePositions(strokes, radius).forEach(([x, y], index) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#111";
      ctx.fill();
      ctx.lineWidth = radius * 0.16;
      ctx.strokeStyle = DRAW_COLOR;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${radius * 1.2}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), x, y + radius * 0.06);
    });
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the frame."))), "image/png"),
  );
}
