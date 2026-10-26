// Scenes for pops, typing and foley: each sound shows what it is (a cork leaving a bottle, a drop
// plinking into a glass, a terminal being typed into, a mirror flipping up in a camera).
import {
  type Frame,
  type Scene,
  TAU,
  alpha,
  bump,
  burst,
  circle,
  clamp,
  cursor,
  ease,
  easeIn,
  fill,
  label,
  lerp,
  line,
  rand,
  ripples,
  rrect,
  shake,
  sparkle,
  spring,
  stroke,
  wave,
  withT,
} from "./kit";

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

/** Progress while playing, a chosen pose at rest. */
const P = (f: Frame, rest: number) => (f.playing ? f.t : rest);
/** 0…1 between a and b. */
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

type Paint = { fill?: string; stroke?: string; width?: number };

function paint(f: Frame, o: Paint = {}) {
  const { ctx } = f;
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  if (o.stroke ?? !o.fill) {
    ctx.strokeStyle = o.stroke ?? f.ink;
    ctx.lineWidth = o.width ?? f.lw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

/** Erase what is under a shape, so an outline drawn on top looks solid. */
function cut(f: Frame, build: (c: CanvasRenderingContext2D) => void) {
  const { ctx } = f;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  build(ctx);
  ctx.fill();
  ctx.restore();
}

/** Left-aligned (or any) text; returns its width. */
function text(
  f: Frame,
  str: string,
  x: number,
  y: number,
  size: number,
  color = f.ink,
  align: CanvasTextAlign = "left",
  family = MONO,
  weight = 600,
) {
  const { ctx } = f;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

/** A union of circles drawn as one outline (popcorn, foam). */
function cloud(f: Frame, pts: [number, number, number][], tint: string) {
  const { ctx } = f;
  const path = () => {
    ctx.beginPath();
    for (const [x, y, r] of pts) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  };
  ctx.save();
  path();
  ctx.strokeStyle = f.ink;
  ctx.lineWidth = f.lw * 2;
  ctx.stroke();
  ctx.globalCompositeOperation = "destination-out";
  path();
  ctx.fill();
  ctx.restore();
  path();
  ctx.fillStyle = tint;
  ctx.fill();
}

function bubble(f: Frame, x: number, y: number, r: number, wob = 0) {
  stroke(f, (c) => c.ellipse(x, y, r * (1 + wob), r * (1 - wob), 0, 0, TAU));
  stroke(f, (c) => c.arc(x, y, r * 0.68, Math.PI * 1.08, Math.PI * 1.42), f.brand);
}

/** A teardrop, tip up, its round part centred on (x, y). */
function drop(f: Frame, x: number, y: number, r: number, o: Paint = { fill: f.brand }) {
  const { ctx } = f;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2.2);
  ctx.bezierCurveTo(x + r * 0.35, y - r * 1.4, x + r, y - r * 0.75, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.bezierCurveTo(x - r, y - r * 0.75, x - r * 0.35, y - r * 1.4, x, y - r * 2.2);
  ctx.closePath();
  paint(f, o);
}

function star(f: Frame, x: number, y: number, r: number, rot = 0, o: Paint = {}, points = 5, inner = 0.45) {
  const { ctx } = f;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  paint(f, o);
}

function heart(f: Frame, x: number, y: number, r: number, o: Paint = {}) {
  const { ctx } = f;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.6, y - r * 1.15, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.15, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
  paint(f, o);
}

/** An eighth note, its head at (x, y). */
function note(f: Frame, x: number, y: number, r: number, color = f.brand) {
  fill(f, (c) => c.ellipse(x, y, r * 1.25, r * 0.9, -0.4, 0, TAU), color);
  line(f, x + r * 1.1, y - r * 0.2, x + r * 1.1, y - r * 4, color);
  stroke(f, (c) => {
    c.moveTo(x + r * 1.1, y - r * 4);
    c.quadraticCurveTo(x + r * 2.6, y - r * 3.2, x + r * 2.2, y - r * 1.9);
  }, color);
}

/** A keycap seen from the front: skirt plus top; press 0…1 sinks the top. (x, y) = top-left. */
function keycap(f: Frame, x: number, y: number, w: number, h: number, press: number, o: { glyph?: string; tint?: string } = {}) {
  const d = h * 0.12 * clamp(press);
  rrect(f, x, y + h * 0.1, w, h * 0.9, h * 0.14);
  const tx = x + w * 0.1;
  const ty = y + d;
  const tw = w * 0.8;
  const th = h * 0.72;
  cut(f, (c) => c.roundRect(tx, ty, tw, th, h * 0.12));
  rrect(f, tx, ty, tw, th, h * 0.12, o.tint ? { fill: o.tint, stroke: f.ink } : {});
  if (o.glyph) label(f, o.glyph, tx + tw / 2, ty + th * 0.48, th * 0.45, f.ink, 700, SANS);
}

/** A fist from the side, knuckles at (x, y) pointing down (rotate to aim), z = size. */
function fist(f: Frame, x: number, y: number, z: number, rot = 0) {
  withT(f, x, y, rot, 1, () => {
    stroke(f, (c) => {
      c.moveTo(-z * 0.5, -z * 0.1);
      for (let i = 0; i < 4; i++) c.arc(-z * 0.375 + i * z * 0.25, -z * 0.1, z * 0.125, Math.PI, 0, true);
      c.lineTo(z * 0.5, -z * 0.75);
      c.quadraticCurveTo(z * 0.5, -z * 0.9, z * 0.35, -z * 0.9);
      c.lineTo(-z * 0.35, -z * 0.9);
      c.quadraticCurveTo(-z * 0.5, -z * 0.9, -z * 0.5, -z * 0.75);
      c.closePath();
    });
    for (let i = 1; i < 4; i++) line(f, -z * 0.5 + i * z * 0.25, -z * 0.12, -z * 0.5 + i * z * 0.25, -z * 0.32, alpha(f.ink, 0.45));
    stroke(f, (c) => {
      c.moveTo(-z * 0.5, -z * 0.55);
      c.quadraticCurveTo(-z * 0.1, -z * 0.5, z * 0.05, -z * 0.4);
    });
    line(f, -z * 0.33, -z * 0.9, -z * 0.38, -z * 1.45);
    line(f, z * 0.33, -z * 0.9, z * 0.36, -z * 1.45);
  });
}

/** A camera aperture: n blades leaving a hole of radius r * open. */
function iris(f: Frame, x: number, y: number, r: number, open: number, n = 6, rot = 0) {
  const hole = r * clamp(0.08 + 0.9 * open, 0.05, 0.97);
  const chord = 2 * Math.sqrt(r * r - hole * hole);
  const b = Math.acos(hole / r);
  circle(f, x, y, hole * 0.9, { fill: alpha(f.brand, 0.2) });
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    const dx = x + Math.cos(a + b) * hole - px;
    const dy = y + Math.sin(a + b) * hole - py;
    const d = Math.hypot(dx, dy) || 1;
    line(f, px, py, px + (dx / d) * chord, py + (dy / d) * chord, alpha(f.ink, 0.7));
  }
  circle(f, x, y, r);
}

/** Lines of "text" revealed in order; returns the caret position. */
function textRows(f: Frame, x: number, y: number, maxW: number, gap: number, widths: number[], reveal: number, barH: number, first?: string) {
  const total = widths.reduce((a, b) => a + b, 0);
  let left = reveal * total;
  let caret: [number, number] = [x, y];
  widths.forEach((wf, i) => {
    const yy = y + i * gap;
    if (wf === 0 || left <= 0) return;
    const shown = clamp(left / wf);
    left -= wf;
    rrect(f, x, yy - barH / 2, maxW * wf * shown, barH, barH / 2, { fill: i === 0 && first ? first : alpha(f.ink, 0.45) });
    caret = [x + maxW * wf * shown + barH * 0.8, yy];
  });
  return caret;
}

export const popTypingFoleyScenes: Record<string, Scene> = {
  // ---------- pops ----------

  // A soap bubble that bursts into droplets.
  "pop-bubble-01": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.06);
    const k = seg(p, 0.1, 0.7);
    const r = s * 0.22;
    if (k <= 0) {
      bubble(f, cx, cy, r, Math.sin(f.time * 40) * 0.05 * f.level);
      circle(f, cx + r * 0.38, cy - r * 0.42, s * 0.014, { fill: f.brand });
      return;
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + rand(i, 2) * 0.4;
      const d = r * (1 + 0.8 * ease(k) * (0.6 + 0.4 * rand(i, 5)));
      circle(f, cx + Math.cos(a) * d, cy + Math.sin(a) * d + k * k * s * 0.08, s * 0.016 * (1 - k), {
        fill: i % 3 ? alpha(f.ink, 0.6) : f.brand,
      });
    }
    burst(f, cx, cy, r * 0.5, r * 0.95, 8, k, f.brand, 0.2);
  },

  // A little gumdrop that springs up, singing one low note.
  "pop-cute-01": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.45);
    const k = spring(seg(p, 0, 0.55));
    const g = cy + s * 0.28;
    const x0 = cx - s * 0.06;
    line(f, cx - s * 0.36, g, cx + s * 0.36, g, alpha(f.ink, 0.35));
    const bw = s * 0.17 * (1 + 0.25 * (1 - clamp(k)));
    const bh = s * 0.3 * Math.max(0.15, k);
    const dome = (c: CanvasRenderingContext2D) => {
      c.ellipse(x0, g, bw, bh, 0, Math.PI, TAU);
      c.closePath();
    };
    fill(f, dome, alpha(f.brand, 0.18));
    stroke(f, dome);
    const ey = g - bh * 0.55;
    circle(f, x0 - bw * 0.3, ey, s * 0.014, { fill: f.ink });
    circle(f, x0 + bw * 0.3, ey, s * 0.014, { fill: f.ink });
    stroke(f, (c) => c.arc(x0, ey + s * 0.01, s * 0.03, 0.2 * Math.PI, 0.8 * Math.PI));
    const nk = seg(p, 0.1, 1);
    note(f, x0 + s * 0.32, cy - s * 0.02 - nk * s * 0.12, s * 0.035, alpha(f.brand, 1 - nk * 0.6));
  },

  // Lips popping open and puffing out a ring of air.
  "pop-cute-02": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    const open = f.playing ? clamp(bump(p, 0.1, 0.25) * 0.7 + f.level * 0.5) : 0.7;
    const mx = cx - s * 0.12;
    const mw = s * 0.22;
    const up = s * (0.05 + 0.03 * open);
    const lo = s * (0.06 + 0.07 * open);
    stroke(f, (c) => {
      c.moveTo(mx - mw, cy);
      c.quadraticCurveTo(mx - mw * 0.5, cy - up * 1.6, mx, cy - up * 0.7);
      c.quadraticCurveTo(mx + mw * 0.5, cy - up * 1.6, mx + mw, cy);
      c.quadraticCurveTo(mx, cy + lo * 2, mx - mw, cy);
    });
    fill(f, (c) => c.ellipse(mx, cy + lo * 0.3, mw * 0.32 * (0.4 + open), lo * 0.55 * open + 1, 0, 0, TAU), f.ink);
    const k = seg(p, 0.08, 0.9);
    if (k > 0) circle(f, mx + mw + k * s * 0.42, cy - k * s * 0.06, s * (0.03 + 0.06 * k), { stroke: alpha(f.brand, 1 - k), width: f.lw * 1.4 });
  },

  // A bloop underwater: a wobbling bubble rising to the surface with its trail.
  "pop-cute-03": (f) => {
    const { s, cx, cy, w, h } = f;
    const p = P(f, 0.45);
    wave(f, w * 0.14, w * 0.86, h * 0.14, s * 0.012, 5, f.time * 5, alpha(f.ink, 0.4));
    const y = lerp(cy + s * 0.28, cy - s * 0.12, ease(p));
    const r = s * (0.09 + 0.025 * (f.playing ? f.level : 0.4));
    bubble(f, cx, y, r, Math.sin(f.time * 24 + 1) * 0.08 * f.level);
    for (let i = 0; i < 4; i++) {
      const yy = Math.min(y + s * (0.15 + i * 0.08), h * 0.9);
      circle(f, cx + Math.sin(i * 1.9 + p * 6) * s * 0.04, yy, s * (0.032 - i * 0.006), { stroke: alpha(f.ink, 0.7 - i * 0.12) });
    }
  },

  // An app icon springing in with a burst.
  "pop-icon-01": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    const k = spring(seg(p, 0, 0.45));
    const q = s * 0.19;
    withT(f, cx, cy, (1 - clamp(k)) * 0.35, Math.max(0.01, k), () => {
      rrect(f, -q, -q, q * 2, q * 2, q * 0.45);
      star(f, 0, 0, q * 0.55, 0, { fill: f.brand });
    });
    burst(f, cx, cy, s * 0.27, s * 0.38, 8, seg(p, 0.04, 0.5), f.brand, Math.PI / 8);
  },

  // A wooden block hopping off the floor.
  "pop-jump-01": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.35);
    const g = cy + s * 0.3;
    const air = Math.sin(seg(p, 0.04, 0.7) * Math.PI);
    const sq = 1 + 0.3 * bump(p, 0.02, 0.05) + 0.22 * bump(p, 0.72, 0.07);
    const bw = s * 0.28 * sq;
    const bh = (s * 0.2) / sq;
    const y = g - bh - air * s * 0.3;
    fill(f, (c) => c.ellipse(cx, g + s * 0.012, bw * (0.55 - air * 0.25), s * 0.02, 0, 0, TAU), alpha(f.ink, 0.12));
    line(f, cx - s * 0.4, g, cx + s * 0.4, g, alpha(f.ink, 0.35));
    withT(f, cx, y + bh / 2, air * 0.25, 1, () => {
      rrect(f, -bw / 2, -bh / 2, bw, bh, s * 0.02, { fill: alpha(f.brand, 0.16), stroke: f.ink });
      for (let i = 0; i < 3; i++) wave(f, -bw * 0.38, bw * 0.38, -bh * 0.25 + i * bh * 0.25, s * 0.008, 1.5 + i * 0.3, i, alpha(f.ink, 0.35));
    });
  },

  // A ball bouncing three times, smaller each time, leaving a dotted path.
  "pop-jump-02": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.62);
    const g = cy + s * 0.3;
    const x0 = cx - s * 0.5;
    const x1 = cx + s * 0.5;
    const r = s * 0.06;
    const at = (u: number): [number, number] => {
      const b = Math.min(2, Math.floor(u * 3));
      const l = u * 3 - b;
      return [lerp(x0, x1, u), g - r - s * 0.5 * [1, 0.5, 0.25][b]! * 4 * l * (1 - l)];
    };
    line(f, x0 - s * 0.06, g, x1 + s * 0.06, g, alpha(f.ink, 0.35));
    for (let j = 0; j < 48; j++) {
      const u = j / 48;
      if (u > p) break;
      const [x, y] = at(u);
      circle(f, x, y, s * 0.006, { fill: alpha(f.ink, 0.35) });
    }
    const [x, y] = at(p);
    const near = clamp(1 - (g - r - y) / (s * 0.04));
    fill(f, (c) => c.ellipse(x, y + near * s * 0.012, r * (1 + 0.25 * near), r * (1 - 0.25 * near), 0, 0, TAU), f.brand);
  },

  // A glass marble bouncing on a glass shelf, glinting on contact.
  "pop-jump-03": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.2);
    const g = cy + s * 0.22;
    const r = s * 0.075;
    const hgt = s * 0.26 * Math.abs(Math.cos(p * Math.PI * 2.5)) * (1 - p * 0.7);
    line(f, cx - s * 0.34, g, cx + s * 0.34, g);
    line(f, cx - s * 0.3, g + s * 0.025, cx + s * 0.3, g + s * 0.025, alpha(f.ink, 0.3));
    const y = g - r - hgt;
    circle(f, cx, y, r);
    withT(f, cx, y, p * 6, 1, () =>
      stroke(f, (c) => {
        c.moveTo(-r * 0.6, r * 0.2);
        c.bezierCurveTo(-r * 0.2, -r * 0.8, r * 0.2, r * 0.8, r * 0.6, -r * 0.2);
      }, f.brand),
    );
    circle(f, cx - r * 0.4, y - r * 0.45, r * 0.12, { fill: alpha(f.ink, 0.5) });
    const hit = clamp(1 - hgt / (s * 0.03));
    if (hit > 0) {
      sparkle(f, cx + r * 1.5, g - r * 0.9, s * 0.04 * hit);
      sparkle(f, cx - r * 1.4, g - r * 0.5, s * 0.025 * hit);
    }
  },

  // A big drop falling into a pool: wide rings and a rebound column.
  "es-drip-bloop": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.42);
    const sy = cy + s * 0.24;
    stroke(f, (c) => c.ellipse(cx, sy, s * 0.55, s * 0.09, 0, 0, TAU), alpha(f.ink, 0.35));
    const fall = seg(p, 0, 0.18);
    if (fall < 1) drop(f, cx, lerp(cy - s * 0.3, sy - s * 0.02, easeIn(fall)), s * 0.07);
    const k = seg(p, 0.18, 1);
    if (k <= 0) return;
    for (let i = 0; i < 3; i++) {
      const q = clamp(k * 1.3 - i * 0.18);
      if (q <= 0) continue;
      const rx = s * (0.06 + 0.45 * ease(q));
      stroke(f, (c) => c.ellipse(cx, sy, rx, rx * 0.17, 0, 0, TAU), alpha(f.brand, 1 - q));
    }
    const col = Math.sin(seg(p, 0.2, 0.75) * Math.PI);
    if (col > 0) {
      stroke(f, (c) => {
        c.moveTo(cx - s * 0.03, sy);
        c.quadraticCurveTo(cx, sy - col * s * 0.3, cx + s * 0.03, sy);
      });
      circle(f, cx, sy - col * s * 0.3 - s * 0.045, s * 0.025 * col, { fill: f.brand });
    }
  },

  // A bubble rising off the sea floor with a small daughter bubble behind it.
  "es-drip-bubble": (f) => {
    const { s, cx, w, h } = f;
    const p = P(f, 0.5);
    wave(f, w * 0.15, w * 0.85, h * 0.86, s * 0.01, 3, 0, alpha(f.ink, 0.4));
    for (let i = 0; i < 5; i++) circle(f, w * (0.22 + i * 0.14), h * 0.86 + s * 0.025, s * 0.012, { fill: alpha(f.ink, 0.25) });
    const y = lerp(h * 0.74, h * 0.26, ease(p));
    const r = s * (0.07 + 0.02 * ease(p));
    bubble(f, cx, y, r, Math.sin(f.time * 30) * 0.06 * f.level);
    const d = seg(p, 0.15, 0.7);
    if (d > 0) circle(f, cx + s * 0.05 + d * s * 0.06, y + r + s * 0.04 + d * s * 0.06, s * 0.03, { stroke: f.brand });
    for (let i = 1; i < 6; i++) {
      const yy = y + r + i * s * 0.05;
      if (yy > h * 0.82) break;
      circle(f, cx - s * 0.03 + Math.sin(i * 2 + p * 8) * s * 0.015, yy, s * 0.006, { fill: alpha(f.ink, 0.35) });
    }
  },

  // A drop landing on a flat surface and splashing a crown of droplets.
  "es-drip-drop": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.4);
    const g = cy + s * 0.3;
    const r = s * 0.065;
    line(f, cx - s * 0.6, g, cx + s * 0.6, g, alpha(f.ink, 0.5));
    // The drop falls; at rest the next one is already on its way down.
    const fall = seg(p, 0, 0.22);
    if (fall < 1) drop(f, cx, lerp(cy - s * 0.3, g - r, easeIn(fall)), r);
    else if (!f.playing) {
      drop(f, cx, cy - s * 0.24, r);
      for (const d of [-1, 0, 1]) line(f, cx + d * r * 0.5, cy - s * 0.24 - r * 2.6, cx + d * r * 0.5, cy - s * 0.24 - r * 3.6, alpha(f.ink, 0.35));
    }
    const k = seg(p, 0.22, 0.95);
    if (k <= 0) return;
    // A crown of water rising from the impact, droplets flung off its points.
    const ch = Math.sin(k * Math.PI) * s * 0.2;
    const cw = s * (0.08 + 0.16 * ease(k));
    const crown = (c: CanvasRenderingContext2D) => {
      c.moveTo(cx - cw, g);
      for (let i = 0; i < 5; i++) {
        const tx = cx + lerp(-cw * 0.85, cw * 0.85, i / 4);
        c.lineTo(tx - cw * 0.1, g - ch * 0.45);
        c.lineTo(tx, g - ch * (0.8 + 0.2 * (i % 2)));
        c.lineTo(tx + cw * 0.1, g - ch * 0.45);
      }
      c.lineTo(cx + cw, g);
    };
    if (ch > 1) {
      fill(f, crown, alpha(f.brand, 0.15));
      stroke(f, crown, f.brand);
      for (let i = 0; i < 5; i++) {
        const tx = cx + lerp(-cw * 0.85, cw * 0.85, i / 4) * (1 + 0.3 * k);
        circle(f, tx, g - ch * (1.15 + 0.2 * (i % 2)) - k * s * 0.04, s * 0.02 * (1 - k * 0.4), { fill: i % 2 ? alpha(f.ink, 0.6) : f.brand });
      }
    }
    stroke(f, (c) => c.ellipse(cx, g, s * 0.5 * ease(k), s * 0.04 * ease(k), 0, 0, TAU), alpha(f.brand, 1 - k));
  },

  // A small drop plinking into a glass of water.
  "es-drip-plink": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.35);
    const top = cy - s * 0.12;
    const bot = cy + s * 0.34;
    const tw = s * 0.17;
    const bw = s * 0.12;
    stroke(f, (c) => {
      c.moveTo(cx - tw, top);
      c.lineTo(cx - bw, bot);
      c.lineTo(cx + bw, bot);
      c.lineTo(cx + tw, top);
    });
    const wl = cy + s * 0.08;
    const wx = lerp(tw, bw, (wl - top) / (bot - top)) - s * 0.012;
    const k = seg(p, 0.2, 1);
    wave(f, cx - wx, cx + wx, wl, s * 0.008 * (1 - k) * (f.playing ? 1 : 0.5), 3, k * 20, f.brand);
    const fall = seg(p, 0, 0.2);
    if (fall < 1) drop(f, cx, lerp(cy - s * 0.38, wl - s * 0.02, easeIn(fall)), s * 0.022);
    if (k > 0) {
      sparkle(f, cx + tw + s * 0.06, top - s * 0.04, s * 0.05 * (1 - k) + s * 0.012);
      circle(f, cx, wl - Math.sin(k * Math.PI) * s * 0.08, s * 0.01 * (1 - k), { fill: f.brand });
    }
  },

  // A tiny drop forming on a tap and falling into the basin.
  "es-drip-tiny": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.12);
    const px = cx - s * 0.02;
    stroke(f, (c) => {
      c.moveTo(px - s * 0.4, cy - s * 0.34);
      c.lineTo(px, cy - s * 0.34);
      c.quadraticCurveTo(px + s * 0.06, cy - s * 0.34, px + s * 0.06, cy - s * 0.28);
      c.lineTo(px + s * 0.06, cy - s * 0.18);
      c.lineTo(px - s * 0.02, cy - s * 0.18);
      c.lineTo(px - s * 0.02, cy - s * 0.26);
      c.lineTo(px - s * 0.4, cy - s * 0.26);
    });
    line(f, px - s * 0.2, cy - s * 0.34, px - s * 0.2, cy - s * 0.41);
    line(f, px - s * 0.26, cy - s * 0.41, px - s * 0.14, cy - s * 0.41, f.brand);
    const tipX = px + s * 0.02;
    const tipY = cy - s * 0.18;
    const basin = cy + s * 0.32;
    line(f, cx - s * 0.25, basin, cx + s * 0.3, basin, alpha(f.ink, 0.4));
    const form = seg(p, 0, 0.05);
    const fall = seg(p, 0.05, 0.2);
    if (fall <= 0) drop(f, tipX, tipY + s * 0.012 + s * 0.015 * form, s * (0.012 + 0.005 * form));
    else if (fall < 1) drop(f, tipX, lerp(tipY + s * 0.03, basin - s * 0.017, easeIn(fall)), s * 0.017);
    const k = seg(p, 0.2, 1);
    if (k > 0) stroke(f, (c) => c.ellipse(tipX, basin, s * 0.12 * ease(k), s * 0.02 * ease(k), 0, 0, TAU), alpha(f.brand, 1 - k));
  },

  // A cork shooting out of a tilted bottle with a spray of foam.
  "es-pop-0": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    withT(f, cx - s * 0.22, cy + s * 0.2, 0.55, 1, () => {
      stroke(f, (c) => {
        c.moveTo(-s * 0.04, -s * 0.2);
        c.lineTo(-s * 0.04, -s * 0.12);
        c.quadraticCurveTo(-s * 0.1, -s * 0.08, -s * 0.1, 0);
        c.lineTo(-s * 0.1, s * 0.16);
        c.lineTo(s * 0.1, s * 0.16);
        c.lineTo(s * 0.1, 0);
        c.quadraticCurveTo(s * 0.1, -s * 0.08, s * 0.04, -s * 0.12);
        c.lineTo(s * 0.04, -s * 0.2);
      });
      rrect(f, -s * 0.1, s * 0.02, s * 0.2, s * 0.08, 0, { fill: alpha(f.brand, 0.25) });
      const k = seg(p, 0, 0.75);
      withT(f, 0, -s * 0.24 - ease(k) * s * 0.4, k * 5, 1, () =>
        rrect(f, -s * 0.035, -s * 0.04, s * 0.07, s * 0.08, s * 0.015, { fill: f.brand }),
      );
      const fk = seg(p, 0, 0.6);
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (rand(i, 4) - 0.5) * 1.3;
        const d = s * (0.03 + 0.2 * ease(fk) * (0.4 + 0.6 * rand(i, 8)));
        circle(f, Math.cos(a) * d, -s * 0.21 + Math.sin(a) * d, s * 0.012 * (1 - fk) + 1, { stroke: alpha(f.ink, 1 - fk) });
      }
    });
  },

  // A liquid blob wobbling as a droplet pinches off it.
  "es-pop-1": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.5);
    const k = ease(seg(p, 0, 0.7));
    const R = s * 0.25;
    const bx = cx - s * 0.12;
    const dr = s * 0.075;
    const dx = bx + R + s * 0.05 + k * s * 0.17;
    const dy = cy - k * s * 0.05;
    const blob = (c: CanvasRenderingContext2D) => {
      for (let i = 0; i <= 56; i++) {
        const a = (i / 56) * TAU;
        const rr = R * (1 + 0.06 * Math.sin(a * 3 + f.time * 6) + 0.05 * f.level * Math.sin(a * 5 - f.time * 4));
        if (i) c.lineTo(bx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else c.moveTo(bx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      c.closePath();
    };
    // A neck that thins until the droplet pinches off.
    const pinch = 1 - clamp(k / 0.6);
    if (pinch > 0) {
      const nw = s * 0.05 * pinch + s * 0.004;
      const mx = (bx + R * 0.9 + dx) / 2;
      const my = (cy + dy) / 2;
      const neck = (c: CanvasRenderingContext2D) => {
        c.moveTo(bx + R * 0.9, cy - nw * 2);
        c.quadraticCurveTo(mx, my - nw, dx - dr * 0.4, dy - dr * 0.8);
        c.lineTo(dx - dr * 0.4, dy + dr * 0.8);
        c.quadraticCurveTo(mx, my + nw, bx + R * 0.9, cy + nw * 2);
        c.closePath();
      };
      fill(f, neck, alpha(f.brand, 0.3));
      stroke(f, neck);
    } else {
      for (const d of [-1, 1]) line(f, dx - dr * 1.6, dy + d * dr * 0.9, dx - dr * 2.3, dy + d * dr * 1.3, alpha(f.brand, 0.6));
    }
    cut(f, blob);
    fill(f, blob, alpha(f.brand, 0.18));
    stroke(f, blob);
    stroke(f, (c) => c.arc(bx, cy, R * 0.72, Math.PI * 1.1, Math.PI * 1.4), alpha(f.ink, 0.35));
    cut(f, (c) => c.arc(dx, dy, dr, 0, TAU));
    circle(f, dx, dy, dr, { fill: f.brand });
  },

  // A gum bubble blown from the lips that pops into strands.
  "es-pop-3": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.05);
    const my = cy + s * 0.27;
    stroke(f, (c) => c.ellipse(cx, my, s * 0.08, s * 0.03, 0, 0, TAU));
    const k = seg(p, 0.08, 0.6);
    if (k <= 0) {
      const R = s * (0.24 + 0.02 * f.level);
      const by = my - s * 0.02 - R;
      fill(f, (c) => c.arc(cx, by, R, 0, TAU), alpha(f.brand, 0.2));
      circle(f, cx, by, R, { stroke: f.brand });
      stroke(f, (c) => c.arc(cx, by, R * 0.72, Math.PI * 1.1, Math.PI * 1.4), alpha(f.brand, 0.7));
      return;
    }
    for (let i = -2; i <= 2; i++) {
      const ex = cx + i * s * 0.06 * (1 + k);
      const ey = my - s * 0.1 * (1 - k) + Math.abs(i) * s * 0.02 + k * s * 0.04;
      stroke(f, (c) => {
        c.moveTo(cx + i * s * 0.012, my - s * 0.02);
        c.quadraticCurveTo(cx + i * s * 0.05, my - s * 0.12 * (1 - k * 0.6), ex, ey);
      }, f.brand, f.lw * 1.4);
    }
    burst(f, cx, my - s * 0.2, s * 0.16, s * 0.3, 10, k, alpha(f.ink, 0.8));
  },

  // A popcorn kernel bursting out of the pan.
  "es-pop-4": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.35);
    const g = cy + s * 0.3;
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.28, g - s * 0.06);
      c.lineTo(cx - s * 0.24, g);
      c.lineTo(cx + s * 0.24, g);
      c.lineTo(cx + s * 0.28, g - s * 0.06);
    });
    line(f, cx + s * 0.28, g - s * 0.03, cx + s * 0.5, g - s * 0.08);
    for (let i = 0; i < 4; i++) drop(f, cx - s * 0.17 + i * s * 0.1 + (i > 1 ? s * 0.05 : 0), g - s * 0.018, s * 0.012, { fill: alpha(f.ink, 0.5) });
    const k = seg(p, 0.05, 1);
    const sc = spring(seg(p, 0.03, 0.4));
    const x = cx + k * s * 0.08;
    const y = g - s * 0.08 - Math.sin(k * Math.PI) * s * 0.32;
    const pts: [number, number, number][] = [
      [0, 0, 0.07],
      [0.06, -0.03, 0.055],
      [-0.06, -0.02, 0.05],
      [0.02, -0.07, 0.05],
      [-0.03, 0.04, 0.045],
    ];
    withT(f, x, y, k * 2.5, Math.max(0.05, sc), () => cloud(f, pts.map(([a, b, r]) => [a * s, b * s, r * s]), alpha(f.brand, 0.15)));
    burst(f, cx, g - s * 0.08, s * 0.05, s * 0.14, 6, seg(p, 0.03, 0.4), f.brand, -0.3);
  },

  // An app icon whose red notification badge pops onto its corner.
  "es-pro-pop-boop": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.5);
    const q = s * 0.19;
    rrect(f, cx - q, cy - q, q * 2, q * 2, q * 0.42);
    rrect(f, cx - q * 0.55, cy - q * 0.35, q * 1.1, q * 0.75, q * 0.08);
    stroke(f, (c) => {
      c.moveTo(cx - q * 0.55, cy - q * 0.3);
      c.lineTo(cx, cy + q * 0.08);
      c.lineTo(cx + q * 0.55, cy - q * 0.3);
    });
    const k = spring(seg(p, 0, 0.5));
    const bx = cx + q * 0.95;
    const by = cy - q * 0.95;
    const br = s * 0.075 * Math.max(0, k);
    circle(f, bx, by, br, { fill: f.brand });
    if (k > 0.3) label(f, "3", bx, by + 1, br * 1.2, "#fff", 800);
  },

  // A word chirping in letter by letter, then underlined.
  "es-pro-pop-chirp": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.7);
    const word = "Wow!";
    const size = s * 0.26;
    ctx.font = `800 ${size}px ${SANS}`;
    const ws = [...word].map((ch) => ctx.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0);
    let x = cx - total / 2;
    [...word].forEach((ch, i) => {
      const cw = ws[i] ?? 0;
      const k = spring(seg(p, i * 0.1, i * 0.1 + 0.4));
      if (k > 0) {
        withT(f, x + cw / 2, cy - (1 - clamp(k)) * s * 0.1, 0, Math.max(0.01, k), () =>
          label(f, ch, 0, 0, size, i === word.length - 1 ? f.brand : f.ink, 800, SANS),
        );
      }
      x += cw;
    });
    const u = ease(seg(p, 0.3, 0.8));
    line(f, cx - total / 2, cy + size * 0.62, cx - total / 2 + total * u, cy + size * 0.62, f.brand);
  },

  // Two badges popping in one after the other: a check, then a star.
  "es-pro-pop-double": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.8);
    for (const i of [0, 1]) {
      const k = spring(seg(p, i * 0.4, i * 0.4 + 0.45));
      if (k <= 0) continue;
      const r = s * 0.13;
      withT(f, cx + (i ? 1 : -1) * s * 0.17, cy, 0, k, () => {
        if (i) {
          circle(f, 0, 0, r, { fill: f.brand });
          star(f, 0, 0, r * 0.5, 0, { fill: "#fff" });
        } else {
          circle(f, 0, 0, r);
          stroke(f, (c) => {
            c.moveTo(-r * 0.4, 0);
            c.lineTo(-r * 0.1, r * 0.3);
            c.lineTo(r * 0.45, -r * 0.3);
          }, f.brand, f.lw * 1.5);
        }
      });
    }
  },

  // A price tag dropping onto its string and swinging.
  "es-pro-pop-thup": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.6);
    const k = seg(p, 0, 0.3);
    const ax = cx - s * 0.06;
    const ay = cy - s * 0.38;
    const hy = cy - s * 0.12 - (1 - ease(k)) * s * 0.22;
    const swing = Math.sin(p * 18) * 0.35 * Math.exp(-p * 4) * clamp(k * 3);
    line(f, ax, ay, ax, hy, alpha(f.ink, 0.5));
    circle(f, ax, ay, s * 0.01, { fill: f.ink });
    withT(f, ax, hy, swing - 0.15, 1, () => {
      stroke(f, (c) => {
        c.moveTo(0, -s * 0.06);
        c.lineTo(s * 0.1, s * 0.02);
        c.lineTo(s * 0.1, s * 0.34);
        c.lineTo(-s * 0.1, s * 0.34);
        c.lineTo(-s * 0.1, s * 0.02);
        c.closePath();
      });
      fill(f, (c) => c.rect(-s * 0.1, s * 0.12, s * 0.2, s * 0.12), alpha(f.brand, 0.2));
      circle(f, 0, 0, s * 0.016);
      label(f, "NEW", 0, s * 0.18, s * 0.06, f.brand, 800, SANS);
    });
  },

  // A star badge spinning in with little glints.
  "es-pro-pop-tink": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.45);
    const k = spring(seg(p, 0, 0.5));
    withT(f, cx, cy, (1 - clamp(k)) * -Math.PI * 0.8, Math.max(0.01, k), () =>
      star(f, 0, 0, s * 0.2, 0, { fill: alpha(f.brand, 0.2), stroke: f.ink }),
    );
    const glints: [number, number, number][] = [
      [0.3, -0.22, 0.1],
      [-0.28, -0.12, 0.25],
      [0.24, 0.2, 0.4],
    ];
    for (const [dx, dy, at] of glints) sparkle(f, cx + dx * s, cy + dy * s, s * 0.05 * bump(p, at + 0.15, 0.3));
  },

  // A heart popping in, little hearts floating off it.
  "es-pro-pop-in-airy": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.5);
    const k = spring(seg(p, 0, 0.45));
    withT(f, cx, cy + s * 0.06, 0, Math.max(0.01, k), () => heart(f, 0, 0, s * 0.17, { fill: f.brand }));
    for (let i = 0; i < 3; i++) {
      const q = seg(p, 0.1 + i * 0.1, 0.9);
      if (q <= 0) continue;
      heart(f, cx + (i - 1) * s * 0.22 + Math.sin(q * 6 + i) * s * 0.02, cy - s * 0.1 - q * s * 0.25, s * 0.04, { stroke: alpha(f.brand, 1 - q) });
    }
  },

  // A dock of app icons, the new one bouncing in.
  "es-pro-pop-in-deep": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.25);
    const dy = cy + s * 0.17;
    const q = s * 0.18;
    const gap = s * 0.235;
    rrect(f, cx - gap * 2.5, dy - s * 0.13, gap * 5, s * 0.26, s * 0.07, { fill: alpha(f.ink, 0.05), stroke: f.ink });
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * gap;
      const hero = i === 3;
      const k = hero ? spring(seg(p, 0, 0.6)) : 1;
      const lift = hero ? Math.abs(Math.sin(p * Math.PI * 3)) * Math.exp(-p * 3) * s * 0.3 : 0;
      const y = dy - lift;
      if (hero && lift > s * 0.02) for (const d of [-1, 0, 1]) line(f, x + d * q * 0.25, y + q * 0.62, x + d * q * 0.25, y + q * 0.62 + lift * 0.5, alpha(f.ink, 0.3));
      withT(f, x, y, 0, Math.max(0.01, k), () => {
        rrect(f, -q / 2, -q / 2, q, q, q * 0.26, hero ? { fill: f.brand } : { stroke: f.ink });
        const g = hero ? "#fff" : alpha(f.ink, 0.55);
        if (hero) star(f, 0, 0, q * 0.28, 0, { fill: g });
        else if (i === 0) circle(f, 0, 0, q * 0.2, { stroke: g });
        else if (i === 1) for (let j = -1; j <= 1; j++) line(f, -q * 0.2, j * q * 0.15, q * 0.2, j * q * 0.15, g);
        else if (i === 2)
          fill(f, (c) => {
            c.moveTo(-q * 0.12, -q * 0.18);
            c.lineTo(q * 0.18, 0);
            c.lineTo(-q * 0.12, q * 0.18);
            c.closePath();
          }, g);
        else for (let j = 0; j < 4; j++) circle(f, (j % 2 ? 1 : -1) * q * 0.12, (j < 2 ? -1 : 1) * q * 0.12, q * 0.06, { fill: g });
      });
      if (hero) circle(f, x, dy + s * 0.11, s * 0.012, { fill: f.ink });
    }
  },

  // Two chat bubbles popping in, a reply after a message.
  "es-pro-pop-in-double": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.8);
    const bh = s * 0.15;
    const msgs = [
      { ax: cx - s * 0.32, ay: cy, w: s * 0.38, at: 0, me: false },
      { ax: cx + s * 0.32, ay: cy + s * 0.24, w: s * 0.3, at: 0.4, me: true },
    ];
    for (const m of msgs) {
      const k = spring(seg(p, m.at, m.at + 0.45));
      if (k <= 0) continue;
      withT(f, m.ax, m.ay, 0, k, () => {
        const x0 = m.me ? -m.w : 0;
        rrect(f, x0, -bh, m.w, bh, bh * 0.4, m.me ? { fill: f.brand } : {});
        const tail = (c: CanvasRenderingContext2D) => {
          const d = m.me ? 1 : -1;
          c.moveTo(-d * s * 0.03, -bh * 0.3);
          c.lineTo(d * s * 0.025, s * 0.012);
          c.lineTo(-d * s * 0.07, -bh * 0.08);
        };
        if (m.me) fill(f, tail, f.brand);
        else stroke(f, tail);
        const bar = m.me ? "#fff" : alpha(f.ink, 0.45);
        rrect(f, x0 + m.w * 0.15, -bh * 0.66, m.w * 0.62, s * 0.022, s * 0.011, { fill: bar });
        rrect(f, x0 + m.w * 0.15, -bh * 0.36, m.w * 0.4, s * 0.022, s * 0.011, { fill: bar });
      });
    }
  },

  // A map pin dropping in and knocking onto the map.
  "es-pro-pop-in-knock": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.35);
    const g = cy + s * 0.28;
    const k = seg(p, 0, 0.2);
    const land = seg(p, 0.2, 1);
    const y = lerp(cy - s * 0.5, g, easeIn(k));
    const sq = 1 - 0.2 * bump(p, 0.24, 0.08);
    fill(f, (c) => c.ellipse(cx, g, s * 0.07 * (0.5 + k * 0.5), s * 0.018, 0, 0, TAU), alpha(f.ink, 0.15));
    if (land > 0) stroke(f, (c) => c.ellipse(cx, g, s * 0.3 * ease(land), s * 0.05 * ease(land), 0, 0, TAU), alpha(f.brand, 1 - land));
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(1 / sq, sq);
    fill(f, (c) => {
      c.moveTo(0, 0);
      c.bezierCurveTo(-s * 0.04, -s * 0.06, -s * 0.09, -s * 0.11, -s * 0.09, -s * 0.17);
      c.arc(0, -s * 0.17, s * 0.09, Math.PI, 0);
      c.bezierCurveTo(s * 0.09, -s * 0.11, s * 0.04, -s * 0.06, 0, 0);
    }, f.brand);
    circle(f, 0, -s * 0.17, s * 0.035, { fill: "#fff" });
    ctx.restore();
  },

  // An avatar popping in with a ring and an online dot.
  "es-pro-pop-in-round": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.35);
    const k = spring(seg(p, 0, 0.45));
    const r = s * 0.2;
    withT(f, cx, cy, 0, Math.max(0.01, k), () => {
      circle(f, 0, 0, r);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.clip();
      circle(f, 0, -r * 0.2, r * 0.32, { fill: alpha(f.brand, 0.3), stroke: f.ink });
      stroke(f, (c) => c.ellipse(0, r * 0.85, r * 0.62, r * 0.5, 0, Math.PI, TAU));
      ctx.restore();
      circle(f, r * 0.72, r * 0.72, r * 0.15, { fill: f.brand });
    });
    const q = seg(p, 0.05, 0.7);
    if (q > 0 && q < 1) circle(f, cx, cy, r * (1.05 + 0.45 * ease(q)), { stroke: alpha(f.brand, 1 - q) });
  },

  // A tooltip blipping open above a hovered button.
  "es-ui-pop-blip": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.5);
    const by = cy + s * 0.22;
    rrect(f, cx - s * 0.13, by - s * 0.055, s * 0.26, s * 0.11, s * 0.055);
    rrect(f, cx - s * 0.07, by - s * 0.008, s * 0.14, s * 0.016, s * 0.008, { fill: alpha(f.ink, 0.4) });
    cursor(f, cx + s * 0.06, by, s * 0.11);
    const k = spring(seg(p, 0, 0.45));
    const tw = s * 0.44;
    const th = s * 0.2;
    withT(f, cx, by - s * 0.09, 0, Math.max(0.01, k), () => {
      rrect(f, -tw / 2, -s * 0.035 - th, tw, th, s * 0.04);
      fill(f, (c) => {
        c.moveTo(-s * 0.03, -s * 0.035);
        c.lineTo(0, 0);
        c.lineTo(s * 0.03, -s * 0.035);
        c.closePath();
      }, f.ink);
      rrect(f, -tw * 0.38, -s * 0.035 - th * 0.68, tw * 0.4, s * 0.025, s * 0.012, { fill: f.brand });
      rrect(f, -tw * 0.38, -s * 0.035 - th * 0.36, tw * 0.7, s * 0.025, s * 0.012, { fill: alpha(f.ink, 0.4) });
    });
  },

  // A dot sliding down a pitch curve, nine semitones on the scale beside it.
  "es-ui-pop-boop": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.55);
    const A = [cx - s * 0.42, cy - s * 0.22] as const;
    const C = [cx + s * 0.05, cy - s * 0.3] as const;
    const B = [cx + s * 0.42, cy + s * 0.25] as const;
    const pt = (u: number): [number, number] => [
      (1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * C[0] + u * u * B[0],
      (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * C[1] + u * u * B[1],
    ];
    stroke(f, (c) => {
      c.setLineDash([f.lw * 2, f.lw * 2.5]);
      c.moveTo(A[0], A[1]);
      c.quadraticCurveTo(C[0], C[1], B[0], B[1]);
    }, alpha(f.ink, 0.4));
    ctx.setLineDash([]);
    for (let i = 0; i <= 9; i++) {
      const y = lerp(A[1], B[1], i / 9);
      line(f, cx - s * 0.6, y, cx - s * 0.55, y, alpha(f.ink, 0.3));
    }
    const u = ease(seg(p, 0, 0.7));
    for (let j = 1; j < 6; j++) {
      const [tx, ty] = pt(Math.max(0, u - j * 0.04));
      circle(f, tx, ty, s * 0.04 * (1 - j / 6), { fill: alpha(f.brand, 0.25 * (1 - j / 6)) });
    }
    const [x, y] = pt(u);
    circle(f, x, y, s * 0.05, { fill: f.brand });
    line(f, cx - s * 0.6, y, cx - s * 0.5, y, f.brand);
  },

  // A card dropping into place, then a small dot popping on its corner.
  "es-ui-pop-fall": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.75);
    const k = seg(p, 0, 0.45);
    const cw = s * 0.44;
    const ch = s * 0.26;
    const y = lerp(cy - s * 0.6, cy - ch / 2, spring(k));
    if (k < 1 && k > 0) for (let i = 0; i < 3; i++) line(f, cx - cw * 0.3 + i * cw * 0.3, y - s * 0.04, cx - cw * 0.3 + i * cw * 0.3, y - s * 0.04 - s * 0.12 * (1 - k), alpha(f.ink, 0.35));
    rrect(f, cx - cw / 2, y, cw, ch, s * 0.03);
    circle(f, cx - cw * 0.3, y + ch / 2, s * 0.045, { fill: alpha(f.brand, 0.25), stroke: f.ink });
    rrect(f, cx - cw * 0.12, y + ch * 0.36, cw * 0.48, s * 0.022, s * 0.011, { fill: alpha(f.ink, 0.5) });
    rrect(f, cx - cw * 0.12, y + ch * 0.58, cw * 0.32, s * 0.022, s * 0.011, { fill: alpha(f.ink, 0.3) });
    const d = spring(seg(p, 0.55, 0.9));
    if (d > 0) circle(f, cx + cw / 2, y, s * 0.04 * d, { fill: f.brand });
  },

  // A soft pill button squishing as it pops, soft rings around it.
  "es-ui-pop-soft": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.3);
    const lv = f.playing ? f.level : 0.5;
    for (let i = 0; i < 3; i++) {
      const q = clamp(seg(p, 0, 0.9) * 1.3 - i * 0.2);
      if (q <= 0 || q >= 1) continue;
      const g = s * 0.12 * ease(q);
      rrect(f, cx - s * 0.26 - g, cy - s * 0.1 - g, s * 0.52 + 2 * g, s * 0.2 + 2 * g, s * 0.1 + g, { stroke: alpha(f.brand, (1 - q) * 0.8) });
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + 0.12 * lv, 1 - 0.1 * lv);
    rrect(f, -s * 0.26, -s * 0.1, s * 0.52, s * 0.2, s * 0.1, { fill: alpha(f.brand, 0.15), stroke: f.ink });
    label(f, "Done", 0, 0, s * 0.08, f.ink, 700, SANS);
    ctx.restore();
  },

  // A vertical fader whose knob steps down one notch and pops as it lands.
  "es-ui-pop-step": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.5);
    const top = cy - s * 0.34;
    const bot = cy + s * 0.34;
    const notches = 9;
    const ny = (i: number) => lerp(top, bot, i / (notches - 1));
    for (let i = 0; i < notches; i++) {
      const major = i % 4 === 0;
      const tl = s * (major ? 0.07 : 0.045);
      line(f, cx - s * 0.06 - tl, ny(i), cx - s * 0.06, ny(i), alpha(f.ink, major ? 0.6 : 0.35));
      line(f, cx + s * 0.06, ny(i), cx + s * 0.06 + tl, ny(i), alpha(f.ink, major ? 0.6 : 0.35));
    }
    rrect(f, cx - s * 0.015, top, s * 0.03, bot - top, s * 0.015);
    const from = 3;
    const u = seg(p, 0, 0.3);
    const y = lerp(ny(from), ny(from + 1), clamp(spring(u), 0, 1.15));
    rrect(f, cx - s * 0.011, y, s * 0.022, bot - y, s * 0.011, { fill: f.brand });
    const kw = s * 0.26;
    const kh = s * 0.1;
    rrect(f, cx - kw / 2, ny(from) - kh / 2, kw, kh, s * 0.02, { stroke: alpha(f.ink, 0.25) });
    cut(f, (c) => c.roundRect(cx - kw / 2, y - kh / 2, kw, kh, s * 0.02));
    rrect(f, cx - kw / 2, y - kh / 2, kw, kh, s * 0.02, { fill: alpha(f.brand, 0.15), stroke: f.ink });
    line(f, cx - kw * 0.3, y, cx + kw * 0.3, y, f.ink);
    const pop = seg(p, 0.25, 0.8);
    if (pop > 0 && pop < 1) {
      for (const d of [-1, 1]) {
        for (const a of [-0.5, 0, 0.5]) {
          const r0 = kw / 2 + s * (0.03 + 0.04 * pop);
          const r1 = r0 + s * 0.05 * (1 - pop * 0.5);
          line(f, cx + d * Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.6, cx + d * Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.6, alpha(f.brand, 1 - pop));
        }
      }
    }
    text(f, "−1", cx + kw / 2 + s * 0.14, ny(from + 1), s * 0.06, alpha(f.ink, 0.6 * clamp(pop * 3)), "left");
  },

  // A wide pill stretching out to both sides.
  "es-ui-pop-wide": (f) => {
    const { s, cx, cy, w } = f;
    const p = P(f, 0.45);
    const k = spring(seg(p, 0, 0.5));
    const pw = lerp(s * 0.12, w * 0.5, clamp(k, 0, 1.2));
    rrect(f, cx - pw / 2, cy - s * 0.09, pw, s * 0.18, s * 0.09, { fill: alpha(f.brand, 0.15), stroke: f.ink });
    rrect(f, cx - pw * 0.3, cy - s * 0.012, pw * 0.6, s * 0.024, s * 0.012, { fill: alpha(f.ink, 0.35) });
    for (const d of [-1, 1]) {
      const x = cx + d * (pw / 2 + s * 0.05);
      stroke(f, (c) => {
        c.moveTo(x, cy);
        c.lineTo(x + d * s * 0.08, cy);
        c.moveTo(x + d * s * 0.05, cy - s * 0.03);
        c.lineTo(x + d * s * 0.08, cy);
        c.lineTo(x + d * s * 0.05, cy + s * 0.03);
      }, alpha(f.ink, clamp(k)));
    }
  },

  // ---------- typing ----------

  // A letter blipping onto the end of a word, caret after it.
  "es-pro-typing-key-blip": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.35);
    const size = s * 0.22;
    ctx.font = `700 ${size}px ${SANS}`;
    const nw = ctx.measureText("e").width;
    const bw = ctx.measureText("typ").width;
    const x0 = cx - (bw + nw) / 2;
    text(f, "typ", x0, cy, size, f.ink, "left", SANS, 700);
    const k = spring(seg(p, 0, 0.4));
    withT(f, x0 + bw + nw / 2, cy, 0, Math.max(0.01, k), () => label(f, "e", 0, 0, size, f.brand, 700, SANS));
    const caretX = x0 + bw + nw + s * 0.025;
    line(f, caretX, cy - size * 0.45, caretX, cy + size * 0.45, f.ink, f.lw * 1.2);
    line(f, x0, cy + size * 0.6, caretX, cy + size * 0.6, alpha(f.ink, 0.2));
    ripples(f, x0 + bw + nw / 2, cy, seg(p, 0, 0.8), s * 0.22, 2);
  },

  // A letter crackling into place with sparks.
  "es-pro-typing-key-crackle": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    const k = spring(seg(p, 0, 0.35));
    withT(f, cx, cy, 0, Math.max(0.01, k), () => label(f, "K", 0, 0, s * 0.42, f.ink, 800, SANS));
    const live = f.playing ? f.level : 0.6;
    const frame = Math.floor(f.time * 30);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rand(i, frame) * 0.6;
      const r0 = s * (0.22 + 0.05 * rand(i, frame + 1));
      const r1 = r0 + s * 0.11 * live;
      const m = (r0 + r1) / 2;
      stroke(f, (c) => {
        c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        c.lineTo(cx + Math.cos(a + 0.12) * m, cy + Math.sin(a + 0.12) * m);
        c.lineTo(cx + Math.cos(a - 0.05) * m, cy + Math.sin(a - 0.05) * m);
        c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }, i % 2 ? f.brand : alpha(f.ink, 0.7));
    }
  },

  // One key struck twice: "ll" appears above it.
  "es-pro-typing-key-double": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.55);
    const press = f.playing ? Math.max(bump(p, 0.1, 0.15), bump(p, 0.5, 0.15)) : 0.3;
    keycap(f, cx - s * 0.11, cy - s * 0.02, s * 0.22, s * 0.22, press, { glyph: "L" });
    const n = p > 0.45 ? 2 : p > 0.05 ? 1 : 0;
    for (let i = 0; i < n; i++) label(f, "l", cx - s * 0.025 + i * s * 0.05, cy - s * 0.24, s * 0.15, i ? f.brand : f.ink, 700, SANS);
    label(f, "×2", cx + s * 0.22, cy + s * 0.09, s * 0.07, f.brand, 800, SANS);
  },

  // A clear glass keycap with reflections, pressed.
  "es-pro-typing-key-glass": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.3);
    const press = f.playing ? f.level : 0.4;
    const kw = s * 0.38;
    const x = cx - kw / 2;
    const y = cy - kw / 2;
    keycap(f, x, y, kw, kw, press, { tint: alpha(f.brand, 0.08) });
    const d = kw * 0.12 * press;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + kw * 0.1, y + d, kw * 0.8, kw * 0.72, kw * 0.12);
    ctx.clip();
    for (let i = 0; i < 2; i++) {
      const o = kw * (0.15 + i * 0.22);
      line(f, x + o, y + d + kw * 0.75, x + o + kw * 0.5, y + d - kw * 0.05, alpha(f.brand, 0.55 - i * 0.2), f.lw * (2 - i));
    }
    ctx.restore();
    sparkle(f, x + kw * 0.95, y - kw * 0.05, s * (0.015 + 0.045 * bump(p, 0.15, 0.3)));
    sparkle(f, x + kw * 0.05, y + kw * 0.95, s * (0.01 + 0.03 * bump(p, 0.3, 0.3)));
  },

  // A caret ticking along a ruler, one notch per key.
  "es-pro-typing-key-tick": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.5);
    const x0 = cx - s * 0.45;
    const step = s * 0.15;
    const base = cy + s * 0.12;
    line(f, x0, base, x0 + 6 * step, base, alpha(f.ink, 0.45));
    for (let i = 0; i <= 6; i++) line(f, x0 + i * step, base, x0 + i * step, base - s * (i % 3 === 0 ? 0.07 : 0.04), alpha(f.ink, 0.45));
    const u = p * 6;
    const i = Math.floor(u);
    const x = x0 + Math.min(6, i + ease((u - i) * 4)) * step;
    for (let j = 0; j < Math.min(6, i); j++) circle(f, x0 + (j + 0.5) * step, cy - s * 0.04, s * 0.014, { fill: alpha(f.ink, 0.6) });
    rrect(f, x - f.lw, cy - s * 0.16, f.lw * 2.2, s * 0.22, f.lw, { fill: f.brand });
  },

  // A code editor filling with lines of code.
  "es-pro-typing-run-blip": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.6);
    const ww = s * 1.0;
    const wh = s * 0.66;
    const x = cx - ww / 2;
    const y = cy - wh / 2;
    rrect(f, x, y, ww, wh, s * 0.04);
    line(f, x, y + s * 0.09, x + ww, y + s * 0.09, alpha(f.ink, 0.3));
    for (let i = 0; i < 3; i++) circle(f, x + s * (0.05 + i * 0.04), y + s * 0.045, s * 0.012, { fill: i === 0 ? f.brand : alpha(f.ink, 0.3) });
    const rows = [[0.14, 0.32], [0.08, 0.22, 0.14], [0.08, 0.3], [0.14, 0.1], [0.2, 0.24]];
    const indents = [0, 1, 1, 0, 0];
    const total = rows.flat().reduce((a, b) => a + b, 0);
    let left = p * total;
    let caret: [number, number] | null = null;
    rows.forEach((row, r) => {
      const ty = y + s * 0.15 + r * s * 0.1;
      text(f, String(r + 1), x + s * 0.06, ty, s * 0.045, alpha(f.ink, 0.35), "center");
      let tx = x + s * 0.13 + (indents[r] ?? 0) * s * 0.06;
      row.forEach((wf, j) => {
        if (left <= 0) return;
        const shown = clamp(left / wf);
        left -= wf;
        rrect(f, tx, ty - s * 0.016, ww * wf * shown, s * 0.032, s * 0.016, { fill: j === 0 ? f.brand : alpha(f.ink, 0.45) });
        caret = [tx + ww * wf * shown + s * 0.015, ty];
        tx += ww * wf + s * 0.02;
      });
    });
    const [kx, ky] = caret ?? [x + s * 0.13, y + s * 0.15];
    line(f, kx, ky - s * 0.03, kx, ky + s * 0.03, f.ink);
  },

  // A chat: "typing…" dots while the reply fills the message field.
  "es-pro-typing-run-double": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.6);
    rrect(f, cx - s * 0.46, cy - s * 0.32, s * 0.44, s * 0.13, s * 0.065);
    rrect(f, cx - s * 0.4, cy - s * 0.265, s * 0.3, s * 0.022, s * 0.011, { fill: alpha(f.ink, 0.45) });
    rrect(f, cx - s * 0.46, cy - s * 0.14, s * 0.2, s * 0.11, s * 0.055);
    const tt = f.playing ? f.time : 0.3;
    for (let i = 0; i < 3; i++) {
      const b = Math.max(0, Math.sin(tt * 12 - i * 0.9)) * s * 0.02;
      circle(f, cx - s * 0.4 + i * s * 0.04, cy - s * 0.085 - b, s * 0.012, { fill: alpha(f.ink, 0.6) });
    }
    const iy = cy + s * 0.2;
    rrect(f, cx - s * 0.48, iy - s * 0.07, s * 0.82, s * 0.14, s * 0.07);
    const tw = s * 0.62 * ease(p);
    if (tw > 1) rrect(f, cx - s * 0.42, iy - s * 0.014, tw, s * 0.028, s * 0.014, { fill: alpha(f.ink, 0.5) });
    line(f, cx - s * 0.41 + tw, iy - s * 0.035, cx - s * 0.41 + tw, iy + s * 0.035, f.ink);
    circle(f, cx + s * 0.44, iy, s * 0.065, { fill: f.brand });
    stroke(f, (c) => {
      c.moveTo(cx + s * 0.44, iy + s * 0.03);
      c.lineTo(cx + s * 0.44, iy - s * 0.03);
      c.moveTo(cx + s * 0.415, iy - s * 0.005);
      c.lineTo(cx + s * 0.44, iy - s * 0.03);
      c.lineTo(cx + s * 0.465, iy - s * 0.005);
    }, "#fff");
  },

  // A search box being typed into, suggestions dropping below.
  "es-pro-typing-run-glass": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.65);
    const bx = cx - s * 0.5;
    const bw = s * 1.0;
    const by = cy - s * 0.24;
    const bh = s * 0.16;
    const my = by + bh / 2;
    rrect(f, bx, by, bw, bh, bh / 2);
    circle(f, bx + s * 0.09, my - s * 0.008, s * 0.03);
    line(f, bx + s * 0.112, my + s * 0.014, bx + s * 0.135, my + s * 0.037);
    const q = "sound effects";
    const n = Math.round(q.length * ease(seg(p, 0, 0.85)));
    const tw = text(f, q.slice(0, n), bx + s * 0.17, my, s * 0.07, f.ink, "left", SANS, 500);
    line(f, bx + s * 0.18 + tw, my - s * 0.04, bx + s * 0.18 + tw, my + s * 0.04, f.brand);
    const sk = seg(p, 0.3, 0.9);
    for (let i = 0; i < 3; i++) {
      const a = clamp(sk * 3 - i);
      if (a <= 0) continue;
      const yy = by + bh + s * 0.08 + i * s * 0.09;
      circle(f, bx + s * 0.09, yy, s * 0.016, { stroke: alpha(f.ink, 0.4 * a) });
      rrect(f, bx + s * 0.15, yy - s * 0.011, s * (0.5 - i * 0.1), s * 0.022, s * 0.011, { fill: alpha(f.ink, 0.35 * a) });
    }
  },

  // A sticky note being written on, line by line.
  "es-pro-typing-run-soft": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.6);
    const q = s * 0.36;
    withT(f, cx, cy, -0.05, 1, () => {
      rrect(f, -q, -q, q * 2, q * 0.22, 0, { fill: alpha(f.brand, 0.25) });
      stroke(f, (c) => {
        c.moveTo(-q, -q);
        c.lineTo(q, -q);
        c.lineTo(q, q * 0.65);
        c.lineTo(q * 0.65, q);
        c.lineTo(-q, q);
        c.closePath();
      });
      stroke(f, (c) => {
        c.moveTo(q, q * 0.65);
        c.lineTo(q * 0.65, q * 0.65);
        c.lineTo(q * 0.65, q);
      });
      const lens = [1.5, 1.3, 1.45, 0.8];
      const total = lens.reduce((a, b) => a + b, 0);
      let left = p * total;
      lens.forEach((len, i) => {
        const y = -q * 0.42 + i * q * 0.36;
        line(f, -q * 0.85, y, q * 0.85, y, alpha(f.ink, 0.12));
        if (left <= 0) return;
        const shown = clamp(left / len);
        left -= len;
        const span = q * len * shown;
        if (span > 2) wave(f, -q * 0.8, -q * 0.8 + span, y - q * 0.07, s * 0.012, 7 * len * shown, i, f.ink);
      });
    });
  },

  // A document page filling with a heading and paragraphs.
  "es-pro-typing-run-standard": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.6);
    const pw = s * 0.52;
    const ph = s * 0.76;
    const x = cx - pw / 2;
    const y = cy - ph / 2;
    const fold = s * 0.1;
    stroke(f, (c) => {
      c.moveTo(x, y);
      c.lineTo(x + pw - fold, y);
      c.lineTo(x + pw, y + fold);
      c.lineTo(x + pw, y + ph);
      c.lineTo(x, y + ph);
      c.closePath();
    });
    stroke(f, (c) => {
      c.moveTo(x + pw - fold, y);
      c.lineTo(x + pw - fold, y + fold);
      c.lineTo(x + pw, y + fold);
    });
    const [kx, ky] = textRows(f, x + s * 0.06, y + s * 0.1, pw - s * 0.12, s * 0.065, [0.55, 0, 1, 0.95, 1, 0.6, 0, 1, 0.85], p, s * 0.022, f.brand);
    line(f, kx, ky - s * 0.025, kx, ky + s * 0.025, f.ink);
  },

  // A terminal: a command typed after the prompt, then its output.
  "es-pro-typing-run-tick": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.7);
    const ww = s * 1.0;
    const wh = s * 0.6;
    const x = cx - ww / 2;
    const y = cy - wh / 2;
    rrect(f, x, y, ww, wh, s * 0.035, { fill: alpha(f.ink, 0.92), stroke: f.ink });
    for (let i = 0; i < 3; i++) circle(f, x + s * (0.05 + i * 0.04), y + s * 0.05, s * 0.011, { fill: alpha("#fff", i ? 0.3 : 0.7) });
    const ly = y + s * 0.2;
    text(f, "$", x + s * 0.06, ly, s * 0.065, f.brand, "left", MONO, 700);
    const cmd = "npx agentcut";
    const n = Math.round(cmd.length * clamp(p / 0.75));
    const tw = text(f, cmd.slice(0, n), x + s * 0.12, ly, s * 0.065, "#fff", "left", MONO, 500);
    const blink = !f.playing || Math.floor(f.time * 4) % 2 === 0;
    if (blink) rrect(f, x + s * 0.125 + tw, ly - s * 0.035, s * 0.035, s * 0.07, 0, { fill: f.brand });
    if (p > 0.8) text(f, "ready on :3000", x + s * 0.06, ly + s * 0.12, s * 0.055, alpha("#fff", 0.55), "left", MONO, 500);
  },

  // A clicky (blue) switch cut away: stem, spring and the click jacket snapping.
  "es-typing-key-clicky": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    const press = f.playing ? clamp(f.level * 1.2) : 0.6;
    const d = press * s * 0.08;
    const hy = cy + s * 0.02;
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.2, hy);
      c.lineTo(cx - s * 0.2, cy + s * 0.3);
      c.lineTo(cx + s * 0.2, cy + s * 0.3);
      c.lineTo(cx + s * 0.2, hy);
    });
    line(f, cx - s * 0.26, hy, cx - s * 0.09, hy);
    line(f, cx + s * 0.09, hy, cx + s * 0.26, hy);
    const top = hy + s * 0.12 + d;
    const bot = cy + s * 0.29;
    stroke(f, (c) => {
      c.moveTo(cx, top);
      for (let i = 1; i <= 8; i++) c.lineTo(cx + (i % 2 ? 1 : -1) * s * 0.05, lerp(top, bot, i / 8.5));
      c.lineTo(cx, bot);
    }, alpha(f.ink, 0.6));
    rrect(f, cx - s * 0.04, hy - s * 0.12 + d, s * 0.08, s * 0.24, s * 0.015);
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.26, hy - s * 0.12 + d);
      c.lineTo(cx - s * 0.22, hy - s * 0.26 + d);
      c.lineTo(cx + s * 0.22, hy - s * 0.26 + d);
      c.lineTo(cx + s * 0.26, hy - s * 0.12 + d);
      c.closePath();
    });
    fill(f, (c) => c.rect(cx + s * 0.04, hy - s * 0.02 + d + (press > 0.5 ? s * 0.03 : 0), s * 0.05, s * 0.035), f.brand);
    burst(f, cx + s * 0.12, hy + s * 0.02, s * 0.04, s * 0.1, 5, f.playing ? bump(p, 0.12, 0.15) : 0.5, f.brand, -0.6);
  },

  // A row of keys from the side, one snapping down crisply.
  "es-typing-key-crisp": (f) => {
    const { s, cx, cy } = f;
    const n = 5;
    const kw = s * 0.2;
    const gap = s * 0.03;
    const x0 = cx - (n * kw + (n - 1) * gap) / 2;
    const base = cy + s * 0.18;
    rrect(f, x0 - s * 0.04, base, n * kw + (n - 1) * gap + s * 0.08, s * 0.08, s * 0.02);
    const press = f.playing ? f.level : 0.7;
    for (let i = 0; i < n; i++) {
      const hero = i === 2;
      const d = hero ? press * s * 0.04 : 0;
      const x = x0 + i * (kw + gap);
      const shape = (c: CanvasRenderingContext2D) => {
        c.moveTo(x, base - s * 0.04 + d);
        c.lineTo(x + kw * 0.12, base - s * 0.2 + d);
        c.lineTo(x + kw * 0.88, base - s * 0.2 + d);
        c.lineTo(x + kw, base - s * 0.04 + d);
        c.closePath();
      };
      if (hero) fill(f, shape, alpha(f.brand, 0.2));
      stroke(f, shape);
    }
    const hx = x0 + 2 * (kw + gap) + kw / 2;
    for (const dx of [-1, 0, 1]) line(f, hx + dx * s * 0.07, base - s * 0.26, hx + dx * s * 0.1, base - s * 0.33, alpha(f.brand, press));
  },

  // One key with long travel, a ruler measuring how deep it goes.
  "es-typing-key-deep": (f) => {
    const { s, cx, cy } = f;
    const press = f.playing ? ease(clamp(f.level * 1.3)) : 0.75;
    const travel = s * 0.2;
    const kx = cx - s * 0.1;
    const top0 = cy - s * 0.32;
    stroke(f, (c) => {
      c.moveTo(kx - s * 0.17, top0 + s * 0.12);
      c.lineTo(kx - s * 0.17, top0 + s * 0.48);
      c.lineTo(kx + s * 0.17, top0 + s * 0.48);
      c.lineTo(kx + s * 0.17, top0 + s * 0.12);
    }, alpha(f.ink, 0.4));
    keycap(f, kx - s * 0.15, top0 + press * travel, s * 0.3, s * 0.18, 0, { tint: alpha(f.brand, 0.12) });
    const dx = kx + s * 0.28;
    line(f, dx, top0, dx, top0 + travel, alpha(f.ink, 0.4));
    line(f, dx - s * 0.025, top0, dx + s * 0.025, top0, alpha(f.ink, 0.4));
    line(f, dx - s * 0.025, top0 + travel, dx + s * 0.025, top0 + travel, alpha(f.ink, 0.4));
    line(f, dx, top0, dx, top0 + press * travel, f.brand, f.lw * 2);
    text(f, `${(press * 4).toFixed(1)} mm`, dx + s * 0.05, top0 + travel / 2, s * 0.06, f.ink, "left");
  },

  // A big wide keycap thocking down, low rings spreading under it.
  "es-typing-key-thock": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    const press = f.playing ? f.level : 0.6;
    const kw = s * 0.8;
    const kh = s * 0.22;
    const q = seg(p, 0, 0.9);
    for (let i = 0; i < 3; i++) {
      const k = clamp(q * 1.3 - i * 0.2);
      if (k <= 0 || k >= 1) continue;
      stroke(f, (c) => c.ellipse(cx, cy + s * 0.1, kw * 0.3 + kw * 0.3 * ease(k), s * 0.04 + s * 0.12 * ease(k), 0, 0, Math.PI), alpha(f.ink, (1 - k) * 0.6), f.lw * (2 - k));
    }
    keycap(f, cx - kw / 2, cy - kh / 2 - s * 0.08, kw, kh, press, { tint: alpha(f.brand, 0.14) });
  },

  // ---------- foley ----------

  // A knuckle rapping on a desk; the desk shakes.
  "es-knock-desk": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.1);
    const top = cy + s * 0.14;
    const [dx, dy] = shake(f, 0.02);
    rrect(f, cx - s * 0.55 + dx, top + dy, s * 1.1, s * 0.06, s * 0.01, { fill: alpha(f.brand, 0.12), stroke: f.ink });
    line(f, cx - s * 0.48 + dx, top + s * 0.06 + dy, cx - s * 0.48, cy + s * 0.42);
    line(f, cx + s * 0.48 + dx, top + s * 0.06 + dy, cx + s * 0.48, cy + s * 0.42);
    const hit = bump(p, 0.1, 0.12);
    fist(f, cx, top - s * 0.12 * (1 - hit) - s * 0.005, s * 0.26);
    const k = f.playing ? f.level : 0.6;
    for (const d of [-1, 1]) {
      line(f, cx + d * s * 0.17, top - s * 0.015, cx + d * s * 0.24, top - s * 0.07, alpha(f.brand, k * hit));
      line(f, cx + d * s * 0.2, top - s * 0.005, cx + d * s * 0.29, top - s * 0.025, alpha(f.brand, k * hit));
    }
    for (let i = 0; i < 3; i++) stroke(f, (c) => c.arc(cx, top + s * 0.04, s * (0.1 + i * 0.06), 0.2 * Math.PI, 0.8 * Math.PI), alpha(f.brand, k * (1 - i / 3) * 0.7));
  },

  // Knock-knock on a panelled door.
  "es-knock-double": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.12);
    const dw = s * 0.42;
    const dh = s * 0.8;
    const x = cx - s * 0.32;
    const y = cy - dh / 2;
    rrect(f, x, y, dw, dh, s * 0.015);
    rrect(f, x + s * 0.05, y + s * 0.06, dw - s * 0.1, dh * 0.36, s * 0.01, { stroke: alpha(f.ink, 0.4) });
    rrect(f, x + s * 0.05, y + dh * 0.5, dw - s * 0.1, dh * 0.42, s * 0.01, { stroke: alpha(f.ink, 0.4) });
    circle(f, x + dw - s * 0.06, cy + s * 0.04, s * 0.02, { fill: f.brand });
    const hit = Math.max(bump(p, 0.1, 0.12), bump(p, 0.45, 0.12));
    const ky = cy - s * 0.12;
    fist(f, x + dw + s * 0.015 + (1 - hit) * s * 0.09, ky, s * 0.2, Math.PI / 2);
    for (const at of [0.1, 0.45]) {
      const k = seg(p, at, at + 0.4);
      if (k <= 0 || k >= 1) continue;
      for (let i = 0; i < 2; i++) stroke(f, (c) => c.arc(x + dw, ky, s * (0.05 + 0.12 * k + i * 0.04), Math.PI * 0.62, Math.PI * 1.38), alpha(f.brand, (1 - k) * (1 - i * 0.4)));
    }
  },

  // A plastic case snapping shut and bouncing back open a touch.
  "es-knock-plastic": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.2);
    const hx = cx - s * 0.3;
    const hy = cy + s * 0.05;
    const L = s * 0.6;
    rrect(f, hx, hy, L, s * 0.16, s * 0.03, { fill: alpha(f.brand, 0.12), stroke: f.ink });
    const a =
      p < 0.12
        ? lerp(-1.0, 0, easeIn(p / 0.12))
        : -0.22 * Math.abs(Math.sin(seg(p, 0.12, 0.6) * Math.PI)) * (1 - seg(p, 0.12, 0.9) * 0.5);
    withT(f, hx, hy, a, 1, () => rrect(f, 0, -s * 0.07, L, s * 0.07, s * 0.03, { fill: alpha(f.brand, 0.25), stroke: f.ink }));
    circle(f, hx, hy, s * 0.016, { fill: f.ink });
    const k = f.playing ? Math.max(bump(p, 0.12, 0.08), bump(p, 0.6, 0.1) * 0.6) : 0.7;
    for (const d of [-1, 0, 1]) line(f, hx + L + s * 0.04, hy + d * s * 0.04, hx + L + s * 0.1, hy + d * s * 0.07, alpha(f.brand, k));
  },

  // A finger snap: the middle finger whips down off the thumb.
  "es-knock-snap": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    const k = ease(seg(p, 0, 0.18));
    const px = cx - s * 0.05;
    const py = cy + s * 0.1;
    rrect(f, px - s * 0.2, py - s * 0.05, s * 0.26, s * 0.3, s * 0.08);
    withT(f, px + s * 0.02, py, 0.7, 1, () => rrect(f, -s * 0.04, -s * 0.28, s * 0.08, s * 0.28, s * 0.04, { fill: alpha(f.brand, 0.12), stroke: f.ink }));
    const fx = px - s * 0.1;
    const fy = py - s * 0.05;
    const a0 = 0.6;
    const a = lerp(a0, 2.3, k);
    if (k > 0) stroke(f, (c) => c.arc(fx, fy, s * 0.3, a0 - Math.PI / 2, a - Math.PI / 2), alpha(f.brand, 0.5 * (1 - seg(p, 0.2, 0.8))));
    withT(f, fx, fy, a, 1, () => rrect(f, -s * 0.04, -s * 0.32, s * 0.08, s * 0.32, s * 0.04));
    const tipX = px + s * 0.02 + Math.sin(0.7) * s * 0.26;
    const tipY = py - Math.cos(0.7) * s * 0.26;
    burst(f, tipX, tipY, s * 0.05, s * 0.14, 8, seg(p, 0.1, 0.6), f.brand);
  },

  // A mallet striking a slotted wood block.
  "es-knock-wood": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.1);
    const bx = cx - s * 0.05;
    const by = cy + s * 0.12;
    rrect(f, bx - s * 0.26, by - s * 0.1, s * 0.52, s * 0.2, s * 0.05, { fill: alpha(f.brand, 0.14), stroke: f.ink });
    rrect(f, bx - s * 0.18, by + s * 0.01, s * 0.36, s * 0.025, s * 0.012, { fill: f.ink });
    wave(f, bx - s * 0.2, bx + s * 0.2, by - s * 0.05, s * 0.006, 2, 0, alpha(f.ink, 0.3));
    const pvx = cx + s * 0.4;
    const pvy = cy - s * 0.08;
    const L = s * 0.4;
    const a0 = Math.atan2(by - s * 0.15 - pvy, L);
    const swing = f.playing ? 1 - bump(p, 0.08, 0.12) : 0.15;
    const a = a0 - 0.75 * swing;
    const hx = pvx - L * Math.cos(a);
    const hy = pvy + L * Math.sin(a);
    line(f, pvx, pvy, hx, hy);
    circle(f, hx, hy, s * 0.05, { fill: alpha(f.ink, 0.15), stroke: f.ink });
    const k = seg(p, 0.08, 0.8);
    for (let i = 0; i < 3; i++) {
      const r = s * (0.3 + i * 0.06 + 0.06 * k);
      const al = alpha(f.brand, (f.playing ? 1 - k : 0.6) * (1 - i * 0.3));
      stroke(f, (c) => c.arc(bx, by, r, Math.PI * 1.08, Math.PI * 1.25), al);
      stroke(f, (c) => c.arc(bx, by, r, Math.PI * 1.75, Math.PI * 1.92), al);
    }
  },

  // A DSLR: the shutter button pressed, the lens aperture snapping shut.
  "es-shutter-dslr": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.25);
    const bw = s * 0.74;
    const bh = s * 0.44;
    const x = cx - bw / 2;
    const y = cy - bh / 2 + s * 0.05;
    const r = s * 0.04;
    stroke(f, (c) => {
      c.moveTo(x + r, y);
      c.lineTo(cx - s * 0.12, y);
      c.lineTo(cx - s * 0.08, y - s * 0.1);
      c.lineTo(cx + s * 0.08, y - s * 0.1);
      c.lineTo(cx + s * 0.12, y);
      c.lineTo(x + bw - r, y);
      c.quadraticCurveTo(x + bw, y, x + bw, y + r);
      c.lineTo(x + bw, y + bh - r);
      c.quadraticCurveTo(x + bw, y + bh, x + bw - r, y + bh);
      c.lineTo(x + r, y + bh);
      c.quadraticCurveTo(x, y + bh, x, y + bh - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
    });
    line(f, x + s * 0.13, y + s * 0.04, x + s * 0.13, y + bh - s * 0.04, alpha(f.ink, 0.35));
    const press = f.playing ? bump(p, 0.05, 0.15) : 0.6;
    rrect(f, x + s * 0.04, y - s * 0.035 + press * s * 0.02, s * 0.08, s * 0.035 - press * s * 0.02 + 1, s * 0.01, { fill: f.brand });
    const lx = cx + s * 0.04;
    const ly = y + bh / 2;
    circle(f, lx, ly, s * 0.17);
    const open = f.playing ? 1 - bump(p, 0.12, 0.2) * 0.95 : 0.35;
    iris(f, lx, ly, s * 0.13, open, 6, p * 2);
    sparkle(f, cx, y - s * 0.17, s * 0.05 * (f.playing ? bump(p, 0.12, 0.2) : 0.5));
  },

  // A film camera; after the shot the film strip advances a frame.
  "es-shutter-film": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.4);
    const bw = s * 0.8;
    const bh = s * 0.32;
    const x = cx - bw / 2;
    const y = cy - s * 0.34;
    rrect(f, x, y, bw, bh, s * 0.04);
    rrect(f, x + s * 0.06, y + s * 0.05, s * 0.12, s * 0.07, s * 0.01);
    rrect(f, x + bw - s * 0.18, y + s * 0.05, s * 0.1, s * 0.07, s * 0.01);
    const shot = f.playing ? bump(p, 0.15, 0.2) : 0.3;
    circle(f, cx, y + bh * 0.58, s * 0.11);
    circle(f, cx, y + bh * 0.58, s * 0.06, { fill: alpha(f.brand, 0.2 + 0.6 * shot), stroke: f.ink });
    const lev = f.playing ? -0.9 * bump(p, 0.6, 0.3) : -0.4;
    withT(f, x + bw - s * 0.1, y, lev, 1, () => line(f, 0, 0, -s * 0.16, -s * 0.03));
    circle(f, x + bw - s * 0.1, y, s * 0.015, { fill: f.ink });
    const fy = cy + s * 0.12;
    const fh = s * 0.22;
    const ex = s * 0.64;
    const adv = ease(seg(p, 0.35, 1)) * s * 0.3;
    line(f, cx - ex, fy, cx + ex, fy);
    line(f, cx - ex, fy + fh, cx + ex, fy + fh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - ex, fy, ex * 2, fh);
    ctx.clip();
    for (let i = -3; i <= 4; i++) {
      const fx = cx + i * s * 0.3 - adv;
      rrect(f, fx - s * 0.12, fy + s * 0.045, s * 0.24, fh - s * 0.09, s * 0.01, i === 1 ? { fill: alpha(f.brand, 0.2), stroke: f.ink } : { stroke: alpha(f.ink, 0.5) });
      for (let j = 0; j < 3; j++) {
        const hx = fx - s * 0.11 + j * s * 0.1;
        rrect(f, hx, fy + s * 0.012, s * 0.03, s * 0.018, s * 0.004, { fill: alpha(f.ink, 0.45) });
        rrect(f, hx, fy + fh - s * 0.03, s * 0.03, s * 0.018, s * 0.004, { fill: alpha(f.ink, 0.45) });
      }
    }
    ctx.restore();
  },

  // A mirror box cut away: the mirror flips up and light reaches the sensor.
  "es-shutter-mirror": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.25);
    const bx = cx - s * 0.3;
    const by = cy - s * 0.2;
    const bw = s * 0.6;
    const bh = s * 0.46;
    rrect(f, bx, by, bw, bh, s * 0.02);
    stroke(f, (c) => c.ellipse(bx - s * 0.05, cy + s * 0.03, s * 0.03, s * 0.15, 0, 0, TAU));
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.14, by);
      c.lineTo(cx - s * 0.05, by - s * 0.14);
      c.lineTo(cx + s * 0.05, by - s * 0.14);
      c.lineTo(cx + s * 0.14, by);
    });
    const up = Math.sin(seg(p, 0, 1) * Math.PI);
    const sx = bx + bw - s * 0.05;
    line(f, sx, cy - s * 0.12, sx, cy + s * 0.18, up > 0.5 ? f.brand : f.ink, f.lw * 2);
    const hx = cx + s * 0.1;
    const hy = cy - s * 0.12;
    const ang = lerp(Math.PI * 0.75, Math.PI, up);
    line(f, hx, hy, hx + Math.cos(ang) * s * 0.3, hy + Math.sin(ang) * s * 0.3, f.ink, f.lw * 2);
    circle(f, hx, hy, s * 0.012, { fill: f.ink });
    const ry = cy + s * 0.03;
    const ray = alpha(f.brand, 0.85);
    if (up < 0.5) {
      line(f, bx - s * 0.02, ry, cx - s * 0.05, ry, ray);
      line(f, cx - s * 0.05, ry, cx - s * 0.05, by - s * 0.07, ray);
    } else {
      line(f, bx - s * 0.02, ry, sx - s * 0.01, ry, ray);
    }
  },

  // A focal-plane shutter: two curtains racing past, leaving a slit of light.
  "es-shutter-quick": (f) => {
    const { s, cx, cy, ctx } = f;
    const p = P(f, 0.3);
    const fw = s * 0.6;
    const fh = s * 0.44;
    const x = cx - fw / 2;
    const y = cy - fh / 2 - s * 0.04;
    rrect(f, x - s * 0.03, y - s * 0.03, fw + s * 0.06, fh + s * 0.06, s * 0.03);
    const first = ease(seg(p, 0, 0.3));
    const second = ease(seg(p, 0.12, 0.5));
    const slats = 5;
    const sh = fh / slats;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, fw, fh);
    ctx.clip();
    const slitTop = y - fh + second * fh + fh;
    const slitBot = y + first * fh;
    if (slitBot > slitTop) fill(f, (c) => c.rect(x, slitTop, fw, slitBot - slitTop), alpha(f.brand, 0.15 + 0.3 * (f.playing ? f.level : 0.5)));
    for (let i = 0; i < slats; i++) {
      const y1 = y + first * fh + i * sh;
      if (y1 < y + fh) rrect(f, x, y1, fw, sh * 0.88, 2, { fill: alpha(f.ink, 0.1), stroke: alpha(f.ink, 0.6) });
      const y2 = y - fh + second * fh + i * sh;
      if (y2 + sh > y) rrect(f, x, y2, fw, sh * 0.88, 2, { fill: alpha(f.brand, 0.12), stroke: alpha(f.brand, 0.8) });
    }
    ctx.restore();
    text(f, "1/4000", cx, y + fh + s * 0.1, s * 0.06, alpha(f.ink, 0.6), "center");
  },

  // A snap zoom: viewfinder brackets punch in, the focus box locks and flashes.
  "es-shutter-snap": (f) => {
    const { s, cx, cy } = f;
    const p = P(f, 0.3);
    const k = ease(seg(p, 0, 0.2));
    const z = lerp(1.25, 0.85, k);
    const fw = s * 0.62 * z;
    const fh = s * 0.42 * z;
    const L = s * 0.08;
    const fl = f.playing ? bump(p, 0.12, 0.12) : 0.3;
    if (fl > 0) fill(f, (c) => c.rect(cx - fw / 2, cy - fh / 2, fw, fh), alpha(f.brand, fl * 0.25));
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = cx + (sx * fw) / 2;
        const y = cy + (sy * fh) / 2;
        stroke(f, (c) => {
          c.moveTo(x - sx * L, y);
          c.lineTo(x, y);
          c.lineTo(x, y - sy * L);
        });
        if (k < 1) line(f, x + sx * s * 0.04, y + sy * s * 0.04, x + sx * s * (0.04 + 0.1 * (1 - k)), y + sy * s * (0.04 + 0.1 * (1 - k)), alpha(f.ink, 0.4 * (1 - k)));
      }
    }
    line(f, cx - s * 0.03, cy, cx + s * 0.03, cy, alpha(f.ink, 0.5));
    line(f, cx, cy - s * 0.03, cx, cy + s * 0.03, alpha(f.ink, 0.5));
    const locked = k >= 1 || !f.playing;
    rrect(f, cx - s * 0.08, cy - s * 0.08, s * 0.16, s * 0.16, 0, { stroke: locked ? f.brand : alpha(f.ink, 0.5) });
    circle(f, cx - fw / 2 + s * 0.06, cy - fh / 2 + s * 0.06, s * 0.014, { fill: f.brand });
  },
};
