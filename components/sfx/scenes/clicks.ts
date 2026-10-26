// Click sounds: each one shows the thing that makes it (a key, a mouse, a toggle, a tap on glass).
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

/** Press depth 0…1: follows the loudness, with a dip at the start; 0 at rest. */
const press = (f: Frame, at = 0.08, width = 0.25) => (f.playing ? clamp(Math.max(bump(f.t, at, width), f.level)) : 0);
/** Progress of the action: the real progress while playing, `rest` otherwise. */
const prog = (f: Frame, rest = 1) => (f.playing ? f.t : rest);
const faint = (f: Frame, a = 0.4) => alpha(f.ink, a);

/** Clear what is under a shape so it occludes the lines behind it. */
function erase(f: Frame, build: (c: CanvasRenderingContext2D) => void) {
  const { ctx } = f;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  build(ctx);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();
}

function clip(f: Frame, build: (c: CanvasRenderingContext2D) => void, draw: () => void) {
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  build(ctx);
  ctx.clip();
  draw();
  ctx.restore();
}

/** Draw the first k (0…1) of a polyline. */
function poly(f: Frame, pts: [number, number][], k: number, color = f.ink, width = f.lw) {
  if (k <= 0) return;
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let left = lens.reduce((a, b) => a + b, 0) * clamp(k);
  stroke(f, (c) => {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const u = Math.min(1, left / lens[i - 1]);
      c.lineTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u));
      left -= lens[i - 1];
    }
  }, color, width);
}

/** A keycap seen from the side: `y` is the bottom of its switch housing. */
function keySide(f: Frame, x: number, y: number, u: number, p: number, accent = false) {
  rrect(f, x - u * 0.42, y - u * 0.2, u * 0.84, u * 0.2, u * 0.04, { stroke: faint(f, 0.45) });
  const top = y - u * 0.66 + p * u * 0.16;
  line(f, x, top + u * 0.44, x, y - u * 0.2, faint(f, 0.45));
  const cap = (c: CanvasRenderingContext2D) => {
    c.moveTo(x - u * 0.47, top + u * 0.44);
    c.lineTo(x - u * 0.34, top);
    c.lineTo(x + u * 0.34, top);
    c.lineTo(x + u * 0.47, top + u * 0.44);
    c.closePath();
  };
  erase(f, cap);
  if (accent) fill(f, cap, alpha(f.brand, 0.9));
  stroke(f, cap);
}

/** A finger pointing along +y in its own frame, tip at (x, y), rotated by rot. */
function finger(f: Frame, x: number, y: number, wd: number, len: number, rot = 0) {
  withT(f, x, y, rot, 1, () => {
    const body = (c: CanvasRenderingContext2D) => c.roundRect(-wd / 2, -len, wd, len, wd / 2);
    erase(f, body);
    stroke(f, body);
    rrect(f, -wd * 0.28, -wd * 0.98, wd * 0.56, wd * 0.66, wd * 0.26, { stroke: faint(f, 0.5) });
    line(f, -wd * 0.3, -len * 0.55, wd * 0.3, -len * 0.55, faint(f, 0.3));
  });
}

/** A rounded bar from (x0, y0) to (x1, y1). */
function capsule(f: Frame, x0: number, y0: number, x1: number, y1: number, wd: number, accent = false) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  withT(f, x0, y0, Math.atan2(y1 - y0, x1 - x0), 1, () => {
    const b = (c: CanvasRenderingContext2D) => c.roundRect(-wd / 2, -wd / 2, len + wd, wd, wd / 2);
    erase(f, b);
    if (accent) fill(f, b, alpha(f.brand, 0.2));
    stroke(f, b);
  });
}

/** Sound arcs fanning out from (x, y) towards angle `dir`. */
function soundArcs(f: Frame, x: number, y: number, dir: number, r: number, k: number, n = 3, color = f.brand) {
  for (let i = 0; i < n; i++) {
    const a = clamp(k * 1.2 - i * 0.2);
    if (a <= 0) continue;
    stroke(f, (c) => c.arc(x, y, r * (0.45 + 0.35 * i), dir - 0.55, dir + 0.55), alpha(color, 1 - a * 0.7));
  }
}

function heart(f: Frame, x: number, y: number, r: number) {
  return (c: CanvasRenderingContext2D) => {
    c.moveTo(x, y + r * 0.9);
    c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.1, x, y - r * 0.45);
    c.bezierCurveTo(x + r * 0.75, y - r * 1.1, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
    c.closePath();
  };
}

function toggle(f: Frame, on: boolean) {
  const { s, cx, cy } = f;
  const k = f.playing ? ease(f.t * 2.4) : 1;
  const pos = on ? k : 1 - k;
  const tw = s * 0.62;
  const th = s * 0.3;
  const x0 = cx - tw / 2;
  const track = (c: CanvasRenderingContext2D) => c.roundRect(x0, cy - th / 2, tw, th, th / 2);
  fill(f, track, alpha(f.brand, 0.85 * pos));
  stroke(f, track);
  const r = th * 0.38;
  const stretch = r * 0.5 * bump(k, 0.5, 0.5) * (f.playing ? 1 : 0);
  const kx = lerp(x0 + th / 2, x0 + tw - th / 2, pos);
  const knob = (c: CanvasRenderingContext2D) => c.roundRect(kx - r - stretch / 2, cy - r, r * 2 + stretch, r * 2, r);
  erase(f, knob);
  stroke(f, knob);
  label(f, on ? "ON" : "OFF", cx, cy + th * 0.95, s * 0.075, faint(f, 0.55), 700);
}

function drop(f: Frame, x: number, y: number, r: number, color: string) {
  fill(f, (c) => {
    c.moveTo(x, y - r * 2);
    c.bezierCurveTo(x + r * 0.4, y - r * 1.2, x + r, y - r * 0.6, x + r, y);
    c.arc(x, y, r, 0, Math.PI);
    c.bezierCurveTo(x - r, y - r * 0.6, x - r * 0.4, y - r * 1.2, x, y - r * 2);
  }, color);
}

export const clickScenes: Record<string, Scene> = {
  // A keyboard from above, a random key lighting with each tap (about 8 a second).
  "click-keyboard-01": (f) => {
    const { s, cx, cy } = f;
    const cols = 10;
    const rows = 3;
    const k = s * 0.105;
    const g = k * 0.18;
    const W = cols * k + (cols - 1) * g;
    const H = (rows + 1) * k + rows * g;
    const x0 = cx - W / 2;
    const y0 = cy - H / 2;
    rrect(f, x0 - k * 0.45, y0 - k * 0.45, W + k * 0.9, H + k * 0.9, k * 0.4);
    const tap = f.playing ? Math.floor(f.time * 8) : 4;
    const p = f.playing ? 1 - clamp(((f.time * 8) % 1) * 2) : 0.6;
    const lit = Math.floor(rand(tap, 5) * cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const on = r * cols + c === lit;
        const d = on ? p * k * 0.08 : 0;
        rrect(f, x0 + c * (k + g) + d, y0 + r * (k + g) + d, k - d * 2, k - d * 2, k * 0.22, on ? { fill: f.brand } : { stroke: faint(f, 0.55) });
      }
    rrect(f, cx - W * 0.3, y0 + rows * (k + g), W * 0.6, k, k * 0.22, { stroke: faint(f, 0.55) });
  },

  // Mechanical keys in profile, pressing one after another with a typewriter clack.
  "click-keyboard-02": (f) => {
    const { s, cx, cy } = f;
    const u = s * 0.22;
    const base = cy + s * 0.22;
    const active = f.playing ? Math.floor(f.time * 6) % 5 : 2;
    const p = f.playing ? 1 - clamp(((f.time * 6) % 1) * 2.2) : 0.8;
    line(f, cx - u * 2.9, base, cx + u * 2.9, base, faint(f, 0.5));
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * u * 1.1;
      keySide(f, x, base, u, i === active ? p : 0, i === active);
      if (i === active) burst(f, x, base - u * 0.75, u * 0.1, u * 0.32, 5, p, f.brand, -Math.PI / 2 - 0.9);
    }
  },

  // A typewriter: the paper fills with lines while the carriage slides.
  "click-keyboard-03": (f) => {
    const { s, cx, cy } = f;
    const p = prog(f, 0.45) * 4;
    const li = Math.min(3, Math.floor(p));
    const frac = p - li;
    const off = (0.5 - frac) * s * 0.22;
    const px = cx - s * 0.28 + off;
    rrect(f, px, cy - s * 0.42, s * 0.56, s * 0.42, s * 0.015, { stroke: faint(f, 0.6) });
    for (let i = 0; i <= li; i++) {
      const n = Math.floor((i < li ? 1 : frac) * 12);
      for (let j = 0; j < n; j++) {
        if (rand(j, i + 3) < 0.15) continue;
        const x = px + s * 0.05 + j * s * 0.038;
        line(f, x, cy - s * 0.32 + i * s * 0.065, x + s * 0.022, cy - s * 0.32 + i * s * 0.065, alpha(f.ink, 0.75));
      }
    }
    rrect(f, cx - s * 0.42 + off, cy - s * 0.06, s * 0.84, s * 0.08, s * 0.04);
    circle(f, cx - s * 0.47 + off, cy - s * 0.02, s * 0.035, { fill: f.brand });
    const body = (c: CanvasRenderingContext2D) => {
      c.moveTo(cx - s * 0.45, cy + s * 0.04);
      c.lineTo(cx + s * 0.45, cy + s * 0.04);
      c.lineTo(cx + s * 0.6, cy + s * 0.42);
      c.lineTo(cx - s * 0.6, cy + s * 0.42);
      c.closePath();
    };
    erase(f, body);
    stroke(f, body);
    const hit = f.playing ? Math.floor(f.time * 7) : 5;
    const lit = Math.floor(rand(hit, 2) * 15);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < (r ? 7 : 8); c++) {
        const i = r * 8 + c;
        const x = cx + (c - (r ? 3 : 3.5)) * s * 0.12;
        const y = cy + s * (0.15 + r * 0.13);
        circle(f, x, y, s * 0.04, i === lit ? { fill: f.brand } : { stroke: faint(f, 0.6) });
      }
  },

  // A laser pointer: the beam swells in and ticks run along it.
  "click-laser-01": (f) => {
    const { s, cx, cy } = f;
    const p = press(f);
    rrect(f, cx - s * 0.62, cy - s * 0.05, s * 0.28, s * 0.1, s * 0.05);
    rrect(f, cx - s * 0.52, cy - s * 0.09 + p * s * 0.02, s * 0.07, s * 0.04, s * 0.015, { fill: p > 0.3 ? f.brand : faint(f, 0.5) });
    const a = f.playing ? clamp(f.t * 5) * (0.35 + 0.65 * f.level) : 0.85;
    const x0 = cx - s * 0.32;
    const x1 = cx + s * 0.56;
    line(f, x0, cy, x1, cy, alpha(f.brand, a * 0.2), f.lw * 5);
    line(f, x0, cy, x1, cy, alpha(f.brand, a), f.lw * 1.4);
    circle(f, x1, cy, s * 0.03, { fill: alpha(f.brand, Math.max(0.3, a)) });
    ripples(f, x1, cy, prog(f, 0.5), s * 0.16, 2);
    const ticks = f.playing ? f.time * 16 : 6;
    for (let i = 0; i < 8; i++) {
      if (i >= ticks) break;
      const x = lerp(x0 + s * 0.08, x1 - s * 0.08, i / 7);
      const hgt = s * (i % 2 ? 0.04 : 0.07);
      line(f, x, cy - s * 0.06 - hgt, x, cy - s * 0.06, i === Math.floor(ticks) - 1 ? f.brand : faint(f, 0.5));
    }
  },

  // A computer mouse from above: the left button presses softly.
  "click-mouse-01": (f) => {
    const { s, cx, cy } = f;
    const p = press(f);
    const bx = cx - s * 0.17;
    const by = cy - s * 0.32;
    const bw = s * 0.34;
    const bh = s * 0.7;
    const split = by + bh * 0.4;
    stroke(f, (c) => {
      c.moveTo(cx, by);
      c.bezierCurveTo(cx, by - s * 0.06, cx + s * 0.08, by - s * 0.03, cx + s * 0.06, cy - s * 0.44);
    }, faint(f, 0.5));
    const body = (c: CanvasRenderingContext2D) => c.roundRect(bx, by, bw, bh, [bw * 0.5, bw * 0.5, bw * 0.45, bw * 0.45]);
    clip(f, body, () => {
      f.ctx.fillStyle = alpha(f.brand, 0.15 + 0.75 * (f.playing ? p : 0.6));
      f.ctx.fillRect(bx, by, bw / 2, split - by);
    });
    stroke(f, body);
    line(f, cx, by, cx, split);
    line(f, bx, split, bx + bw, split, faint(f, 0.6));
    rrect(f, cx - s * 0.02, by + s * 0.08, s * 0.04, s * 0.09, s * 0.02, { fill: f.ink });
    ripples(f, cx - bw * 0.25, by + s * 0.12, prog(f, 0.4), s * 0.32, 2);
  },

  // A cursor clicks a button, which sinks and fills.
  "click-mouse-02": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.5;
    const bw = s * 0.66;
    const bh = s * 0.22;
    const y = cy - bh / 2 + p * s * 0.025;
    line(f, cx - bw / 2 + s * 0.04, cy + bh / 2 + s * 0.04, cx + bw / 2 - s * 0.04, cy + bh / 2 + s * 0.04, faint(f, 0.3 * (1 - p)), f.lw * 2);
    rrect(f, cx - bw / 2, y, bw, bh, bh / 2, { fill: alpha(f.brand, 0.12 + 0.7 * p), stroke: f.ink });
    label(f, "Click", cx, y + bh / 2, s * 0.09, f.ink, 700);
    const tx = cx + s * 0.16;
    const ty = cy + s * 0.04;
    burst(f, tx, ty, s * 0.05, s * 0.13, 6, prog(f, 0.45) * 1.6, f.brand, -0.4);
    cursor(f, tx, ty, s * 0.24, p);
  },

  // A scroll wheel turning one notch, the page beside it moving a line.
  "click-snap-01": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? ease(f.t * 5) : 0.5;
    const wx = cx + s * 0.18;
    const r = s * 0.27;
    circle(f, wx, cy, r);
    circle(f, wx, cy, s * 0.04, { fill: f.ink });
    const step = TAU / 20;
    for (let i = 0; i < 20; i++) {
      const a = i * step + k * step;
      line(f, wx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, wx + Math.cos(a) * r, cy + Math.sin(a) * r, faint(f, 0.6));
    }
    fill(f, (c) => {
      c.moveTo(wx - s * 0.03, cy - r - s * 0.07);
      c.lineTo(wx + s * 0.03, cy - r - s * 0.07);
      c.lineTo(wx, cy - r - s * 0.015);
      c.closePath();
    });
    const lx = cx - s * 0.58;
    rrect(f, lx, cy - s * 0.3, s * 0.4, s * 0.6, s * 0.03, { stroke: faint(f, 0.5) });
    clip(f, (c) => c.rect(lx, cy - s * 0.3, s * 0.4, s * 0.6), () => {
      for (let i = -1; i < 7; i++) {
        const y = cy - s * 0.24 + (i - k) * s * 0.09;
        line(f, lx + s * 0.05, y, lx + s * (0.15 + 0.2 * rand(i + 9, 2)), y, i === 2 ? f.brand : faint(f, 0.55));
      }
    });
  },

  // A triangle struck by its beater, ringing outward.
  "click-tap-01": (f) => {
    const { s, cx, cy } = f;
    const p = press(f, 0.05, 0.2);
    const ring = f.playing ? f.level : 0.6;
    const top: [number, number] = [cx - s * 0.1, cy - s * 0.26];
    withT(f, top[0], top[1], f.playing ? Math.sin(f.time * 30) * 0.035 * f.level : 0, 1, () => {
      const tri = (sc: number, open: boolean) => (c: CanvasRenderingContext2D) => {
        const a: [number, number] = [0, 0];
        const b: [number, number] = [-s * 0.3 * sc, s * 0.5 * sc];
        const d: [number, number] = [s * 0.3 * sc, s * 0.5 * sc];
        c.moveTo(open ? lerp(a[0], b[0], 0.14) : a[0], open ? lerp(a[1], b[1], 0.14) : a[1]);
        c.lineTo(b[0], b[1]);
        c.lineTo(d[0], d[1]);
        c.lineTo(a[0], a[1]);
        if (!open) c.closePath();
      };
      for (let i = 1; i <= 2; i++) stroke(f, (c) => withRing(c, i), alpha(f.brand, ring * (0.6 - i * 0.2)));
      stroke(f, tri(1, true), f.ink, f.lw * 1.4);
      function withRing(c: CanvasRenderingContext2D, i: number) {
        c.save();
        c.translate(0, s * 0.3);
        c.scale(1 + i * 0.16, 1 + i * 0.16);
        c.translate(0, -s * 0.3);
        tri(1, false)(c);
        c.restore();
      }
    });
    line(f, top[0], top[1], top[0], cy - s * 0.42, faint(f, 0.5));
    const hx = cx + s * 0.05 + (1 - p) * s * 0.12;
    const hy = cy - s * 0.01;
    line(f, hx, hy, hx + s * 0.45, hy - s * 0.18);
    circle(f, hx, hy, s * 0.02, { fill: f.brand });
  },

  // A finger taps an app icon on a phone, a punchy ripple spreading.
  "click-tap-screen-01": (f) => {
    const { s, cx, cy } = f;
    const p = press(f);
    const [dx, dy] = shake(f, 0.02);
    const pw = s * 0.36;
    const ph = s * 0.78;
    const x0 = cx - pw / 2 + dx;
    const y0 = cy - ph / 2 + dy;
    rrect(f, x0, y0, pw, ph, s * 0.06);
    line(f, cx - s * 0.04 + dx, y0 + s * 0.04, cx + s * 0.04 + dx, y0 + s * 0.04);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) {
        const on = r === 1 && c === 1;
        const ix = x0 + s * 0.045 + c * s * 0.1;
        const iy = y0 + s * 0.1 + r * s * 0.12;
        rrect(f, ix, iy, s * 0.07, s * 0.07, s * 0.02, on ? { fill: alpha(f.brand, 0.35 + 0.65 * (f.playing ? p : 1)) } : { stroke: faint(f, 0.45) });
      }
    const tx = x0 + s * 0.18;
    const ty = y0 + s * 0.255;
    ripples(f, tx, ty, prog(f, 0.4), s * 0.3, 3);
    circle(f, tx, ty, s * 0.08 * (1 - 0.2 * p), { fill: alpha(f.ink, 0.12), stroke: f.ink });
  },

  // A drop falls into water: rings spread and a little droplet jumps back up.
  "click-tap-water-01": (f) => {
    const { s, cx, cy } = f;
    const sy = cy + s * 0.14;
    const t = prog(f, 0.45);
    const k = clamp((t - 0.12) / 0.88);
    wave(f, cx - s * 0.66, cx + s * 0.66, sy, (u) => s * 0.012 * Math.sin(u * Math.PI) * (1 - k), 9, f.time * 8, faint(f, 0.6));
    for (let i = 0; i < 3; i++) {
      const e = clamp(k * 1.3 - i * 0.22);
      if (e <= 0 || e >= 1) continue;
      stroke(f, (c) => c.ellipse(cx, sy, s * 0.6 * ease(e), s * 0.08 * ease(e), 0, 0, TAU), alpha(f.brand, 1 - e));
    }
    if (t < 0.12) drop(f, cx, lerp(cy - s * 0.38, sy - s * 0.04, t / 0.12), s * 0.045, f.brand);
    else {
      const j = bump(k, 0.3, 0.3);
      line(f, cx, sy, cx, sy - s * 0.12 * j, alpha(f.brand, j), f.lw * 1.6);
      circle(f, cx, sy - s * 0.2 * j - s * 0.02, s * 0.025 * j, { fill: f.brand });
      for (const side of [-1, 1]) circle(f, cx + side * s * 0.1 * ease(k * 2), sy - s * 0.08 * bump(k, 0.2, 0.2), s * 0.012 * (1 - k), { fill: f.brand });
    }
  },

  // A game coin flips up and is collected with a sparkle and a +1.
  "click-tech-01": (f) => {
    const { s, cx, cy } = f;
    const t = prog(f, 0.45);
    const spin = f.playing ? f.t * 16 : 0.7;
    const y = cy + s * 0.12 - s * 0.26 * ease(t * 1.6);
    const r = s * 0.17;
    const rx = r * Math.max(0.1, Math.abs(Math.cos(spin)));
    line(f, cx - s * 0.2, cy + s * 0.36, cx + s * 0.2, cy + s * 0.36, faint(f, 0.3));
    const coin = (c: CanvasRenderingContext2D) => c.ellipse(cx, y, rx, r, 0, 0, TAU);
    fill(f, coin, alpha(f.brand, 0.85));
    stroke(f, coin);
    if (rx > r * 0.35) {
      stroke(f, (c) => c.ellipse(cx, y, rx * 0.72, r * 0.72, 0, 0, TAU), alpha(f.ink, 0.6));
      line(f, cx, y - r * 0.38, cx, y + r * 0.38, f.ink, f.lw * 1.4);
    }
    const k = clamp((t - 0.3) * 2);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      sparkle(f, cx + Math.cos(a) * s * (0.22 + 0.08 * k), y + Math.sin(a) * s * (0.2 + 0.08 * k), s * 0.04 * bump(k, 0.5, 0.5), f.brand);
    }
    label(f, "+1", cx + s * 0.34, y - s * 0.12 - k * s * 0.08, s * 0.1, alpha(f.ink, 0.25 + 0.75 * k), 800);
  },

  // A toast notification slides up from the bottom edge of a laptop screen.
  "click-tech-02": (f) => {
    const { s, cx, cy } = f;
    const sx = cx - s * 0.5;
    const sy = cy - s * 0.4;
    const sw = s * 1.0;
    const sh = s * 0.6;
    rrect(f, sx, sy, sw, sh, s * 0.03);
    stroke(f, (c) => {
      c.moveTo(sx - s * 0.08, sy + sh + s * 0.1);
      c.lineTo(sx + sw + s * 0.08, sy + sh + s * 0.1);
      c.lineTo(sx + sw, sy + sh);
      c.lineTo(sx, sy + sh);
      c.closePath();
    });
    line(f, cx - s * 0.07, sy + sh + s * 0.05, cx + s * 0.07, sy + sh + s * 0.05, faint(f, 0.4));
    for (let i = 0; i < 3; i++) line(f, sx + s * 0.08, sy + s * (0.1 + i * 0.07), sx + s * (0.4 + 0.2 * rand(i, 4)), sy + s * (0.1 + i * 0.07), faint(f, 0.3));
    const k = f.playing ? spring(f.t * 2.5) : 1;
    const tw = s * 0.52;
    const th = s * 0.15;
    const ty = lerp(sy + sh + s * 0.02, sy + sh - th - s * 0.06, k);
    clip(f, (c) => c.rect(sx, sy, sw, sh), () => {
      const toast = (c: CanvasRenderingContext2D) => c.roundRect(cx - tw / 2 + s * 0.12, ty, tw, th, s * 0.04);
      erase(f, toast);
      stroke(f, toast);
      circle(f, cx - tw / 2 + s * 0.2, ty + th / 2, s * 0.035, { fill: f.brand });
      line(f, cx - tw / 2 + s * 0.27, ty + th * 0.36, cx + tw / 2 + s * 0.02, ty + th * 0.36);
      line(f, cx - tw / 2 + s * 0.27, ty + th * 0.66, cx + s * 0.12, ty + th * 0.66, faint(f, 0.45));
    });
  },

  // A pure tone: a wave packet pulsing at C5.
  "click-tech-03": (f) => {
    const { s, cx, cy } = f;
    const lvl = f.playing ? f.level : 0.8;
    line(f, cx - s * 0.62, cy, cx + s * 0.62, cy, faint(f, 0.2));
    wave(f, cx - s * 0.62, cx + s * 0.62, cy, (u) => s * 0.22 * Math.exp(-Math.pow((u - 0.5) / 0.2, 2)) * (0.25 + 0.75 * lvl), 9, -f.time * 24, f.brand, f.lw * 1.4);
    circle(f, cx, cy, s * 0.02, { fill: f.ink });
    label(f, "C5", cx + s * 0.5, cy - s * 0.3, s * 0.08, faint(f, 0.55));
  },

  // A thick low string plucked between two pegs (C3).
  "click-tech-04": (f) => {
    const { s, cx, cy } = f;
    const x0 = cx - s * 0.6;
    const x1 = cx + s * 0.6;
    const A = s * 0.13 * (f.playing ? f.level : 0.6);
    const ph = f.playing ? Math.cos(f.time * 40) : 1;
    for (const k of f.playing ? [ph] : [1, -1]) stroke(f, (c) => {
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const y = cy + Math.sin(u * Math.PI) * A * k;
        if (i) c.lineTo(x0 + (x1 - x0) * u, y);
        else c.moveTo(x0, y);
      }
    }, f.playing ? f.ink : faint(f, 0.3), f.lw * 2.2);
    if (!f.playing) line(f, x0, cy, x1, cy, f.ink, f.lw * 2.2);
    circle(f, x0, cy, s * 0.035, { fill: f.ink });
    circle(f, x1, cy, s * 0.035, { fill: f.ink });
    fill(f, (c) => {
      c.moveTo(cx + s * 0.16, cy - s * 0.36);
      c.quadraticCurveTo(cx + s * 0.32, cy - s * 0.36, cx + s * 0.26, cy - s * 0.2);
      c.quadraticCurveTo(cx + s * 0.1, cy - s * 0.28, cx + s * 0.16, cy - s * 0.36);
    });
    label(f, "C3", cx - s * 0.48, cy - s * 0.3, s * 0.08, faint(f, 0.55));
  },

  // A row of LEDs beeping on one after another.
  "click-tech-05": (f) => {
    const { s, cx, cy } = f;
    const n = f.playing ? Math.floor(f.t * 9) : 4;
    rrect(f, cx - s * 0.66, cy - s * 0.14, s * 1.32, s * 0.28, s * 0.06, { stroke: faint(f, 0.5) });
    for (let i = 0; i < 7; i++) {
      const x = cx + (i - 3) * s * 0.17;
      const on = i < n;
      const last = i === n - 1;
      circle(f, x, cy, s * 0.05, on ? { fill: alpha(f.brand, last ? 1 : 0.35) } : { stroke: faint(f, 0.5) });
      if (last) soundArcs(f, x, cy - s * 0.04, -Math.PI / 2, s * 0.22, f.playing ? f.level : 0.6, 2);
    }
  },

  // A bright star pops in with rays and sparkles.
  "click-tech-06": (f) => {
    const { s, cx, cy } = f;
    const k = prog(f, 0.4);
    const sc = f.playing ? spring(k * 3) : 1;
    burst(f, cx, cy, s * 0.24, s * 0.42, 10, k * 1.6, f.brand, 0.3);
    withT(f, cx, cy, -0.2 + 0.2 * sc, Math.max(0.01, sc), () => {
      const star = (c: CanvasRenderingContext2D) => {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 ? s * 0.08 : s * 0.19;
          if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
      };
      fill(f, star, f.brand);
      stroke(f, star);
    });
    for (let i = 0; i < 3; i++) sparkle(f, cx + s * [-0.45, 0.42, 0.3][i], cy + s * [-0.25, -0.3, 0.3][i], s * 0.04 * (0.5 + 0.5 * Math.sin(f.time * 9 + i * 2)), f.ink);
  },

  // A music box: pins on a turning cylinder pluck the tines of a steel comb.
  "click-tech-07": (f) => {
    const { s, cx, cy } = f;
    const n = 11;
    const x0 = cx - s * 0.45;
    const x1 = cx + s * 0.45;
    const cTop = cy - s * 0.36;
    const cBot = cy - s * 0.02;
    const ch = cBot - cTop;
    rrect(f, x0, cTop, x1 - x0, ch, s * 0.05);
    const ph = f.playing ? f.time * 0.9 : 0.27;
    let plucked = -1;
    clip(f, (c) => c.rect(x0, cTop, x1 - x0, ch), () => {
      for (let j = 0; j < 14; j++) {
        const col = Math.floor(rand(j, 5) * n);
        const v = (rand(j, 8) + ph) % 1;
        const x = lerp(x0 + s * 0.06, x1 - s * 0.06, col / (n - 1));
        const y = cTop + v * ch;
        if (v > 0.9) plucked = col;
        circle(f, x, y, s * 0.012 * (0.4 + 0.6 * Math.sin(v * Math.PI)), { fill: v > 0.9 ? f.brand : f.ink });
      }
    });
    for (let i = 0; i < 3; i++) line(f, x0 + s * 0.02, cTop + ch * (0.25 + i * 0.25), x1 - s * 0.02, cTop + ch * (0.25 + i * 0.25), faint(f, 0.15));
    const ca = ph * TAU * 2;
    line(f, x1, cy - s * 0.19, x1 + s * 0.08, cy - s * 0.19);
    line(f, x1 + s * 0.08, cy - s * 0.19, x1 + s * 0.08 + Math.cos(ca) * s * 0.07, cy - s * 0.19 + Math.sin(ca) * s * 0.07);
    circle(f, x1 + s * 0.08 + Math.cos(ca) * s * 0.07, cy - s * 0.19 + Math.sin(ca) * s * 0.07, s * 0.018, { fill: f.ink });
    rrect(f, x0 - s * 0.02, cy + s * 0.24, x1 - x0 + s * 0.04, s * 0.1, s * 0.02);
    for (let i = 0; i < n; i++) {
      const x = lerp(x0 + s * 0.06, x1 - s * 0.06, i / (n - 1));
      const on = i === plucked;
      const vib = on ? Math.sin(f.time * 80) * s * 0.01 * (0.4 + f.level) : 0;
      const tipY = cBot + s * 0.02 + (i / (n - 1)) * s * 0.06;
      line(f, x, cy + s * 0.24, x + vib, tipY, on ? f.brand : f.ink, f.lw * (on ? 1.8 : 1.2));
    }
  },

  // A harp: its strings plucked one after another, each left vibrating.
  "click-tech-long": (f) => {
    const { s, cx, cy } = f;
    const left = cx - s * 0.36;
    const neck = (u: number) => cy - s * 0.38 + s * 0.12 * u - Math.sin(u * Math.PI) * s * 0.06;
    const board = (u: number) => lerp(cy + s * 0.4, cy - s * 0.24, u);
    line(f, left, cy - s * 0.4, left, cy + s * 0.42, f.ink, f.lw * 1.8);
    stroke(f, (c) => {
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const x = lerp(left, cx + s * 0.4, u);
        if (i) c.lineTo(x, neck(u));
        else c.moveTo(x, neck(u));
      }
    }, f.ink, f.lw * 1.6);
    line(f, left, board(0), cx + s * 0.4, board(1), f.ink, f.lw * 2.2);
    const pos = f.playing ? f.t * 9 : 4.3;
    for (let i = 0; i < 9; i++) {
      const u = (i + 0.8) / 10;
      const x = lerp(left, cx + s * 0.4, u);
      const y0 = neck(u) + s * 0.015;
      const y1 = board(u) - s * 0.015;
      const age = pos - i;
      const amp = age >= 0 ? Math.exp(-age * 0.9) * s * 0.03 : 0;
      const off = f.playing ? Math.sin(f.time * 55 + i) * amp : amp;
      const on = age >= 0 && age < 1;
      stroke(f, (c) => {
        c.moveTo(x, y0);
        c.quadraticCurveTo(x + off * 2, (y0 + y1) / 2, x, y1);
      }, on ? f.brand : alpha(f.ink, 0.75), f.lw * (on ? 1.6 : 1));
      if (!f.playing && on) stroke(f, (c) => {
        c.moveTo(x, y0);
        c.quadraticCurveTo(x - off * 2, (y0 + y1) / 2, x, y1);
      }, alpha(f.brand, 0.35));
    }
  },

  // A key springing back up as it's released.
  "click-tick-01": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? spring(f.t * 3) : 1;
    const p = 1 - k;
    keySide(f, cx, cy + s * 0.32, s * 0.5, clamp(p, -0.3, 1), false);
    const a = f.playing ? 1 - f.t : 0.8;
    const y = cy - s * 0.2 - (f.playing ? f.t * s * 0.1 : s * 0.04);
    poly(f, [[cx - s * 0.07, y + s * 0.05], [cx, y - s * 0.02], [cx + s * 0.07, y + s * 0.05]], 1, alpha(f.brand, a), f.lw * 1.6);
    sparkle(f, cx + s * 0.22, cy - s * 0.12, s * 0.04 * (f.playing ? bump(f.t, 0.15, 0.2) : 0.8), f.brand);
  },

  // Fast typing in a text box, the caret racing along.
  "click-type-fast-01": (f) => {
    const { s, cx, cy } = f;
    const x0 = cx - s * 0.6;
    const y0 = cy - s * 0.26;
    rrect(f, x0, y0, s * 1.2, s * 0.52, s * 0.05);
    const n = Math.floor(f.playing ? f.time * 12 : 20) % 48;
    let x = x0 + s * 0.06;
    let row = 0;
    for (let i = 0; i <= n; i++) {
      const wch = s * (0.025 + 0.02 * rand(i, 4));
      if (x + wch > x0 + s * 1.12) {
        row++;
        x = x0 + s * 0.06;
      }
      const y = y0 + s * 0.1 + row * s * 0.14;
      if (i === n) {
        if (!f.playing || (f.time * 3) % 1 < 0.6) line(f, x, y - s * 0.04, x, y + s * 0.04, f.brand, f.lw * 1.4);
        break;
      }
      if (rand(i, 8) > 0.82) x += s * 0.03;
      else {
        rrect(f, x, y - s * 0.03, wch, s * 0.06, s * 0.01, { fill: alpha(f.ink, 0.7) });
        x += wch + s * 0.012;
      }
    }
  },

  // Wooden temple blocks tapped in a quick run by a mallet.
  "click-ui-01": (f) => {
    const { s, cx, cy } = f;
    const hs = [0.22, 0.3, 0.26, 0.18];
    const base = cy + s * 0.3;
    const active = f.playing ? Math.floor(f.time * 10) % 4 : 1;
    const p = f.playing ? 1 - clamp(((f.time * 10) % 1) * 2) : 0.8;
    line(f, cx - s * 0.6, base, cx + s * 0.6, base, faint(f, 0.5));
    let bx = 0;
    let top = 0;
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * s * 0.27;
      const hh = s * hs[i];
      const jig = i === active ? Math.sin(f.time * 80) * s * 0.006 * p : 0;
      rrect(f, x - s * 0.1 + jig, base - hh, s * 0.2, hh, s * 0.05, i === active ? { fill: alpha(f.brand, 0.25 * p), stroke: f.ink } : {});
      for (let g = 0; g < 2; g++)
        stroke(f, (c) => {
          c.moveTo(x - s * 0.06 + jig, base - hh * (0.35 + g * 0.3));
          c.quadraticCurveTo(x + jig, base - hh * (0.45 + g * 0.3), x + s * 0.06 + jig, base - hh * (0.35 + g * 0.3));
        }, faint(f, 0.35));
      if (i === active) {
        bx = x;
        top = base - hh;
      }
    }
    const by = top - s * 0.045 - (1 - p) * s * 0.07;
    line(f, bx + s * 0.02, by - s * 0.02, bx + s * 0.28, by - s * 0.26);
    circle(f, bx, by, s * 0.04, { fill: f.brand });
  },

  // A document double-clicked: two rings, one after the other.
  "es-click-double": (f) => {
    const { s, cx, cy } = f;
    const dx = cx - s * 0.12;
    const dy = cy - s * 0.24;
    const dw = s * 0.32;
    const dh = s * 0.44;
    const k1 = f.playing ? clamp(f.t * 2.5) : 0.5;
    const k2 = f.playing ? clamp(f.t * 2.5 - 0.45) : 0.15;
    stroke(f, (c) => {
      c.moveTo(dx, dy);
      c.lineTo(dx + dw - s * 0.09, dy);
      c.lineTo(dx + dw, dy + s * 0.09);
      c.lineTo(dx + dw, dy + dh);
      c.lineTo(dx, dy + dh);
      c.closePath();
      c.moveTo(dx + dw - s * 0.09, dy);
      c.lineTo(dx + dw - s * 0.09, dy + s * 0.09);
      c.lineTo(dx + dw, dy + s * 0.09);
    });
    if (k2 > 0) rrect(f, dx - s * 0.03, dy - s * 0.03, dw + s * 0.06, dh + s * 0.06, s * 0.03, { fill: alpha(f.brand, 0.15 * ease(k2 * 3)), stroke: alpha(f.brand, ease(k2 * 3)) });
    for (let i = 0; i < 3; i++) line(f, dx + s * 0.05, dy + s * (0.17 + i * 0.08), dx + dw - s * 0.06, dy + s * (0.17 + i * 0.08), faint(f, 0.4));
    const tx = cx + s * 0.12;
    const ty = cy + s * 0.08;
    for (const k of [k1, k2]) if (k > 0 && k < 1) circle(f, tx, ty, s * 0.2 * ease(k), { stroke: alpha(f.brand, 1 - k) });
    cursor(f, tx, ty, s * 0.22, press(f));
  },

  // A ballpoint pen clicked: the button goes down and the tip comes out.
  "es-click-snap": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f, 0.06, 0.2) : 0;
    const k = f.playing ? ease(f.t * 4) : 1;
    withT(f, cx, cy, 0.55, 1, () => {
      const wd = s * 0.1;
      const top = -s * 0.3;
      const bot = s * 0.24;
      rrect(f, -wd * 0.3, top - s * 0.1 + p * s * 0.05, wd * 0.6, s * 0.12, wd * 0.2, { fill: alpha(f.brand, 0.3 + 0.6 * p), stroke: f.ink });
      const body = (c: CanvasRenderingContext2D) => c.roundRect(-wd / 2, top, wd, bot - top, wd * 0.3);
      erase(f, body);
      stroke(f, body);
      stroke(f, (c) => {
        c.moveTo(wd / 2, top + s * 0.03);
        c.lineTo(wd / 2 + s * 0.035, top + s * 0.05);
        c.lineTo(wd / 2 + s * 0.035, top + s * 0.24);
      });
      line(f, -wd / 2, bot - s * 0.12, wd / 2, bot - s * 0.12, faint(f, 0.4));
      stroke(f, (c) => {
        c.moveTo(-wd / 2, bot);
        c.lineTo(-wd * 0.12, bot + s * 0.08);
        c.lineTo(wd * 0.12, bot + s * 0.08);
        c.lineTo(wd / 2, bot);
      });
      line(f, 0, bot + s * 0.08, 0, bot + s * 0.08 + k * s * 0.045, f.ink, f.lw * 1.6);
      circle(f, 0, bot + s * 0.08 + k * s * 0.045, s * 0.008, { fill: f.brand });
    });
    soundArcs(f, cx - s * 0.2, cy - s * 0.32, -Math.PI * 0.75, s * 0.2, f.playing ? p : 0.4, 2);
  },

  // A radio button group: the selection moves to the next option.
  "es-click-soft": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? spring(f.t * 3) : 1;
    for (let i = 0; i < 3; i++) {
      const y = cy + (i - 1) * s * 0.22;
      const x = cx - s * 0.32;
      circle(f, x, y, s * 0.06, { stroke: i === 1 ? f.ink : faint(f, 0.55) });
      const r = i === 1 ? s * 0.032 * k : i === 0 ? s * 0.032 * (1 - clamp(k)) : 0;
      if (r > 0.5) circle(f, x, y, r, { fill: f.brand });
      line(f, x + s * 0.12, y, x + s * (0.4 + 0.15 * rand(i, 3)), y, i === 1 ? f.ink : faint(f, 0.4));
    }
    ripples(f, cx - s * 0.32, cy, prog(f, 0.45), s * 0.2, 2);
  },

  // A big chunky Enter keycap bottoming out with a deep thock.
  "es-click-thock": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.4;
    const [dx] = shake(f, 0.015);
    const d = p * s * 0.07;
    rrect(f, cx - s * 0.36, cy + s * 0.18, s * 0.72, s * 0.12, s * 0.03, { stroke: faint(f, 0.5) });
    const sk = (c: CanvasRenderingContext2D) => c.roundRect(cx - s * 0.32 + dx, cy - s * 0.28 + d, s * 0.64, s * 0.46, s * 0.08);
    erase(f, sk);
    stroke(f, sk);
    rrect(f, cx - s * 0.24 + dx, cy - s * 0.25 + d, s * 0.48, s * 0.33, s * 0.06, { fill: alpha(f.brand, 0.2 + 0.5 * p), stroke: f.ink });
    label(f, "enter", cx + dx, cy - s * 0.085 + d, s * 0.09, f.ink, 800);
    for (const side of [-1, 1])
      for (let i = 0; i < 2; i++) stroke(f, (c) => c.arc(cx, cy + s * 0.05, s * (0.46 + i * 0.08), side < 0 ? Math.PI - 0.3 : -0.3 + 0, side < 0 ? Math.PI + 0.3 : 0.3), alpha(f.brand, p * (0.8 - i * 0.35)), f.lw * 1.8);
  },

  // A small heart button tinked: it fills and throws tiny sparkles.
  "es-click-tink": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? spring(f.t * 3) : 1;
    circle(f, cx, cy, s * 0.24, { stroke: faint(f, 0.5) });
    withT(f, cx, cy, 0, 0.8 + 0.2 * k, () => {
      fill(f, heart(f, 0, 0, s * 0.12), alpha(f.brand, clamp(k)));
      stroke(f, heart(f, 0, 0, s * 0.12));
    });
    const sp = prog(f, 0.4);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      const d = s * (0.28 + 0.12 * ease(sp * 2));
      sparkle(f, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * 0.03 * (1 - clamp(sp * 1.4 - 0.4)), f.brand);
    }
  },

  // A list: the hover highlight passes down the rows.
  "es-hover-tick-air": (f) => {
    const { s, cx, cy } = f;
    const x0 = cx - s * 0.46;
    const y0 = cy - s * 0.4;
    rrect(f, x0, y0, s * 0.92, s * 0.8, s * 0.05, { stroke: faint(f, 0.5) });
    const pos = f.playing ? f.t * 4.5 : 2;
    const hy = y0 + s * 0.05 + pos * s * 0.145;
    rrect(f, x0 + s * 0.03, hy, s * 0.86, s * 0.12, s * 0.03, { fill: alpha(f.brand, 0.14), stroke: f.brand });
    for (let i = 0; i < 5; i++) {
      const y = y0 + s * 0.11 + i * s * 0.145;
      circle(f, x0 + s * 0.1, y, s * 0.03, { stroke: faint(f, 0.6) });
      line(f, x0 + s * 0.18, y, x0 + s * (0.45 + 0.3 * rand(i, 6)), y, faint(f, 0.55));
    }
    cursor(f, x0 + s * 0.8, hy + s * 0.04, s * 0.15);
  },

  // A tab bar: the underline jumps from item to item under the cursor.
  "es-hover-tick-high": (f) => {
    const { s, cx, cy } = f;
    rrect(f, cx - s * 0.68, cy - s * 0.13, s * 1.36, s * 0.26, s * 0.13, { stroke: faint(f, 0.5) });
    const pos = f.playing ? Math.min(4, Math.floor(f.t * 5)) + ease(((f.t * 5) % 1) * 3) : 2;
    const ux = cx + (Math.min(4, pos) - 2) * s * 0.25;
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * s * 0.25;
      const wd = s * (0.08 + 0.05 * rand(i, 2));
      line(f, x - wd, cy - s * 0.01, x + wd, cy - s * 0.01, Math.round(pos) === i ? f.ink : faint(f, 0.45));
    }
    line(f, ux - s * 0.09, cy + s * 0.07, ux + s * 0.09, cy + s * 0.07, f.brand, f.lw * 2);
    cursor(f, ux + s * 0.02, cy - s * 0.04, s * 0.17);
  },

  // A ratchet gear stepping round, its pawl clicking tooth by tooth.
  "es-hover-tick-mid": (f) => {
    const { s, cx, cy } = f;
    const gx = cx - s * 0.12;
    const n = 14;
    const step = f.playing ? Math.floor(f.time * 10) + ease(((f.time * 10) % 1) * 3) : 0.3;
    const rot = (step * TAU) / n;
    const ro = s * 0.3;
    const ri = s * 0.23;
    stroke(f, (c) => {
      for (let i = 0; i < n; i++) {
        const a0 = rot + (i / n) * TAU;
        const a1 = rot + ((i + 1) / n) * TAU;
        if (i) c.lineTo(gx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri);
        else c.moveTo(gx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri);
        c.lineTo(gx + Math.cos(a1 - 0.02) * ro, cy + Math.sin(a1 - 0.02) * ro);
        c.lineTo(gx + Math.cos(a1) * ri, cy + Math.sin(a1) * ri);
      }
      c.closePath();
    });
    circle(f, gx, cy, s * 0.06);
    const lift = f.playing ? (1 - ((f.time * 10) % 1)) * 0.12 : 0.05;
    const px = gx + s * 0.48;
    const py = cy - s * 0.32;
    line(f, px, py, gx + Math.cos(-0.75 - lift) * ro, cy + Math.sin(-0.75 - lift) * ro, f.brand, f.lw * 1.8);
    circle(f, px, py, s * 0.025, { fill: f.ink });
    stroke(f, (c) => c.arc(gx, cy, s * 0.4, 0.5, 1.4), faint(f, 0.4));
  },

  // A cursor glides over a dot grid; each dot it touches pings.
  "es-hover-tick-ping": (f) => {
    const { s, cx, cy } = f;
    const u = f.playing ? f.t : 0.5;
    const mx = lerp(cx - s * 0.55, cx + s * 0.55, u);
    const my = cy + Math.sin(u * Math.PI * 2) * s * 0.08;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 9; c++) {
        const x = cx + (c - 4) * s * 0.15;
        const y = cy + (r - 1.5) * s * 0.17;
        const d = Math.hypot(x - mx, y - my);
        const hot = clamp(1 - d / (s * 0.12));
        circle(f, x, y, s * (0.012 + 0.018 * hot), { fill: hot > 0.1 ? alpha(f.brand, 0.4 + 0.6 * hot) : faint(f, 0.4) });
        if (hot > 0.4) circle(f, x, y, s * 0.06 * hot, { stroke: alpha(f.brand, hot * 0.6) });
      }
    cursor(f, mx, my, s * 0.16);
  },

  // A glass button: a glint sweeps across it as it's pressed.
  "es-pro-click-glass": (f) => {
    const { s, cx, cy } = f;
    const p = press(f);
    const sz = s * 0.46 * (1 - 0.05 * p);
    const x0 = cx - sz / 2;
    const y0 = cy - sz / 2;
    const b = (c: CanvasRenderingContext2D) => c.roundRect(x0, y0, sz, sz, sz * 0.24);
    const g = f.playing ? f.t * 1.8 - 0.4 : 0.45;
    clip(f, b, () => {
      const { ctx } = f;
      for (const [o, wd, a] of [[0, 0.22, 0.35], [0.3, 0.08, 0.25]] as const) {
        ctx.beginPath();
        const gx = x0 + (g - o) * sz * 1.6;
        ctx.moveTo(gx, y0 + sz);
        ctx.lineTo(gx + sz * wd, y0 + sz);
        ctx.lineTo(gx + sz * wd + sz * 0.6, y0);
        ctx.lineTo(gx + sz * 0.6, y0);
        ctx.closePath();
        ctx.fillStyle = alpha(f.brand, a);
        ctx.fill();
      }
    });
    stroke(f, b);
    stroke(f, (c) => c.arc(x0 + sz * 0.3, y0 + sz * 0.3, sz * 0.16, Math.PI, Math.PI * 1.5), faint(f, 0.5));
    sparkle(f, x0 + sz * 0.92, y0 + sz * 0.08, s * 0.05 * (f.playing ? bump(f.t, 0.4, 0.3) : 0.7), f.brand);
  },

  // A cursor clicks a folder; a selection box snaps around it.
  "es-pro-click-mouse": (f) => {
    const { s, cx, cy } = f;
    const p = press(f);
    const k = f.playing ? clamp(f.t * 4) : 1;
    const fx = cx - s * 0.2;
    const fy = cy - s * 0.14;
    const folder = (c: CanvasRenderingContext2D) => {
      c.moveTo(fx, fy + s * 0.32);
      c.lineTo(fx, fy);
      c.lineTo(fx + s * 0.13, fy);
      c.lineTo(fx + s * 0.17, fy + s * 0.05);
      c.lineTo(fx + s * 0.4, fy + s * 0.05);
      c.lineTo(fx + s * 0.4, fy + s * 0.32);
      c.closePath();
    };
    fill(f, folder, alpha(f.brand, 0.15 + 0.55 * k));
    stroke(f, folder);
    line(f, fx, fy + s * 0.1, fx + s * 0.4, fy + s * 0.1, faint(f, 0.5));
    f.ctx.setLineDash([s * 0.025, s * 0.02]);
    rrect(f, fx - s * 0.06, fy - s * 0.06, s * 0.52, s * 0.44 + s * 0.08, s * 0.03, { stroke: alpha(f.brand, k) });
    f.ctx.setLineDash([]);
    line(f, fx + s * 0.05, fy + s * 0.48, fx + s * 0.35, fy + s * 0.48, faint(f, 0.5));
    cursor(f, cx + s * 0.08, cy + s * 0.06, s * 0.2, p);
  },

  // A puzzle piece slides in and snaps into its slot.
  "es-pro-click-snap": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? ease(f.t * 3.5) : 0.75;
    const a = s * 0.3;
    const tx = cx - a * 0.55;
    const ty = cy - a / 2;
    const piece = (x: number, y: number) => (c: CanvasRenderingContext2D) => {
      c.moveTo(x, y);
      c.lineTo(x + a, y);
      c.lineTo(x + a, y + a * 0.35);
      c.bezierCurveTo(x + a * 1.3, y + a * 0.2, x + a * 1.3, y + a * 0.8, x + a, y + a * 0.65);
      c.lineTo(x + a, y + a);
      c.lineTo(x, y + a);
      c.lineTo(x, y + a * 0.65);
      c.bezierCurveTo(x + a * 0.3, y + a * 0.8, x + a * 0.3, y + a * 0.2, x, y + a * 0.35);
      c.closePath();
    };
    rrect(f, cx - s * 0.62, cy - s * 0.32, s * 1.24, s * 0.64, s * 0.03, { stroke: faint(f, 0.5) });
    stroke(f, piece(tx - a, ty), faint(f, 0.45));
    stroke(f, piece(tx + a, ty), faint(f, 0.45));
    f.ctx.setLineDash([s * 0.02, s * 0.018]);
    stroke(f, piece(tx, ty), faint(f, 0.6));
    f.ctx.setLineDash([]);
    const px = tx - (1 - k) * s * 0.42;
    const py = ty - (1 - k) * s * 0.18;
    erase(f, piece(px, py));
    fill(f, piece(px, py), alpha(f.brand, 0.3 + 0.55 * k));
    stroke(f, piece(px, py));
    if (k > 0.98) burst(f, tx + a / 2, cy, a * 0.75, a * 1.05, 8, f.playing ? clamp((f.t - 0.28) * 3) : 0.5, f.brand);
  },

  // A soft cushion button squashing under a press.
  "es-pro-click-soft": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.3;
    const sx = 1 + 0.14 * p;
    const sy = 1 - 0.22 * p;
    const bw = s * 0.62 * sx;
    const bh = s * 0.34 * sy;
    const base = cy + s * 0.18;
    stroke(f, (c) => c.ellipse(cx, base + s * 0.04, bw * 0.55, s * 0.035, 0, 0, TAU), faint(f, 0.3));
    rrect(f, cx - bw / 2, base - bh, bw, bh, bh * 0.5, { fill: alpha(f.brand, 0.18), stroke: f.ink });
    stroke(f, (c) => {
      c.moveTo(cx - bw * 0.25, base - bh);
      c.quadraticCurveTo(cx, base - bh + s * 0.07 * (0.3 + p), cx + bw * 0.25, base - bh);
    }, faint(f, 0.6));
    for (const side of [-1, 1]) line(f, cx + side * bw * 0.32, base - bh * 0.5, cx + side * bw * 0.38, base - bh * 0.5, faint(f, 0.4));
  },

  // A spoon tinks the rim of a wine glass.
  "es-pro-click-tink": (f) => {
    const { s, cx, cy } = f;
    const p = press(f, 0.05, 0.18);
    const gx = cx - s * 0.08;
    stroke(f, (c) => {
      c.moveTo(gx - s * 0.16, cy - s * 0.36);
      c.bezierCurveTo(gx - s * 0.18, cy - s * 0.06, gx - s * 0.06, cy + s * 0.04, gx, cy + s * 0.04);
      c.bezierCurveTo(gx + s * 0.06, cy + s * 0.04, gx + s * 0.18, cy - s * 0.06, gx + s * 0.16, cy - s * 0.36);
    });
    line(f, gx, cy + s * 0.04, gx, cy + s * 0.32);
    stroke(f, (c) => c.ellipse(gx, cy + s * 0.33, s * 0.12, s * 0.025, 0, 0, TAU));
    line(f, gx - s * 0.14, cy - s * 0.2, gx + s * 0.14, cy - s * 0.2, alpha(f.brand, 0.5));
    const sx = gx + s * 0.18 + (1 - p) * s * 0.08;
    const sy = cy - s * 0.33;
    line(f, sx + s * 0.04, sy - s * 0.02, sx + s * 0.4, sy - s * 0.12);
    stroke(f, (c) => c.ellipse(sx + s * 0.02, sy - s * 0.005, s * 0.035, s * 0.02, -0.28, 0, TAU), f.ink);
    soundArcs(f, gx - s * 0.18, cy - s * 0.34, Math.PI + 0.3, s * 0.3, f.playing ? f.level : 0.6, 3);
  },

  // A detent knob clicking round to its next mark.
  "es-pro-hover-tick-detent": (f) => {
    const { s, cx, cy } = f;
    const a0 = Math.PI * 0.75;
    const span = Math.PI * 1.5;
    const step = 4 + (f.playing ? ease(f.t * 4) : 0);
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (span * i) / 10;
      const on = i === Math.round(step);
      line(f, cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3, cx + Math.cos(a) * s * (on ? 0.42 : 0.37), cy + Math.sin(a) * s * (on ? 0.42 : 0.37), on ? f.brand : faint(f, 0.5), f.lw * (on ? 1.6 : 1));
    }
    circle(f, cx, cy, s * 0.22);
    const a = a0 + (span * step) / 10;
    for (let i = 0; i < 24; i++) {
      const b = a + (i / 24) * TAU;
      line(f, cx + Math.cos(b) * s * 0.19, cy + Math.sin(b) * s * 0.19, cx + Math.cos(b) * s * 0.22, cy + Math.sin(b) * s * 0.22, faint(f, 0.35));
    }
    line(f, cx + Math.cos(a) * s * 0.05, cy + Math.sin(a) * s * 0.05, cx + Math.cos(a) * s * 0.16, cy + Math.sin(a) * s * 0.16, f.brand, f.lw * 2);
  },

  // A radar screen: the sweep passes and a blip pings.
  "es-pro-hover-tick-ping": (f) => {
    const { s, cx, cy } = f;
    for (let i = 1; i <= 3; i++) circle(f, cx, cy, s * 0.13 * i, { stroke: faint(f, 0.3) });
    line(f, cx - s * 0.4, cy, cx + s * 0.4, cy, faint(f, 0.2));
    line(f, cx, cy - s * 0.4, cx, cy + s * 0.4, faint(f, 0.2));
    const sw = f.playing ? -1 + f.t * 3 : -0.6;
    for (let i = 0; i < 8; i++) {
      const a = sw - i * 0.06;
      line(f, cx, cy, cx + Math.cos(a) * s * 0.39, cy + Math.sin(a) * s * 0.39, alpha(f.brand, (1 - i / 8) * 0.6));
    }
    const blips: [number, number][] = [[-0.7, 0.26], [0.5, 0.18], [1.5, 0.32]];
    for (const [a, r] of blips) {
      const d = ((sw - a) % TAU + TAU) % TAU;
      const hot = clamp(1 - d / 2);
      const x = cx + Math.cos(a) * s * r;
      const y = cy + Math.sin(a) * s * r;
      circle(f, x, y, s * 0.022, { fill: alpha(f.brand, 0.25 + 0.75 * hot) });
      if (hot > 0) circle(f, x, y, s * 0.02 + s * 0.08 * (1 - hot), { stroke: alpha(f.brand, hot) });
    }
  },

  // A counter ticking up: the last digit rolls over.
  "es-pro-hover-tick-soft": (f) => {
    const { s, cx, cy } = f;
    const n = 127 + (f.playing ? Math.floor(f.time * 8) : 0);
    const roll = f.playing ? ease(((f.time * 8) % 1) * 3) : 0.35;
    const bw = s * 0.22;
    const bh = s * 0.32;
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * bw * 1.15 - bw / 2;
      const y = cy - bh / 2;
      rrect(f, x, y, bw, bh, s * 0.04, { stroke: i === 2 ? f.ink : faint(f, 0.5) });
      const d = Math.floor(n / Math.pow(10, 2 - i)) % 10;
      clip(f, (c) => c.rect(x, y, bw, bh), () => {
        if (i < 2) label(f, String(d), x + bw / 2, cy, s * 0.2, f.ink, 800);
        else {
          label(f, String(d), x + bw / 2, cy - roll * bh, s * 0.2, f.ink, 800);
          label(f, String((d + 1) % 10), x + bw / 2, cy + (1 - roll) * bh, s * 0.2, f.brand, 800);
        }
      });
    }
    line(f, cx - bw * 1.7, cy, cx + bw * 1.7, cy, faint(f, 0.15));
  },

  // A trackpad double-tapped: two quick touches, two ripples.
  "es-pro-tap-double": (f) => {
    const { s, cx, cy } = f;
    rrect(f, cx - s * 0.5, cy - s * 0.32, s * 1.0, s * 0.64, s * 0.06);
    line(f, cx - s * 0.5, cy + s * 0.22, cx + s * 0.5, cy + s * 0.22, faint(f, 0.3));
    const t = prog(f, 0.6);
    for (let i = 0; i < 2; i++) {
      const k = clamp((t - i * 0.4) * 2.5);
      if (k > 0 && k < 1) circle(f, cx, cy - s * 0.04, s * 0.06 + s * 0.22 * ease(k), { stroke: alpha(f.brand, 1 - k) });
    }
    const touch = f.playing ? Math.max(bump(t, 0.05, 0.12), bump(t, 0.45, 0.12)) : 0.6;
    circle(f, cx, cy - s * 0.04, s * 0.06, { fill: alpha(f.ink, 0.1 + 0.25 * touch), stroke: f.ink });
    label(f, "2×", cx + s * 0.38, cy - s * 0.22, s * 0.07, faint(f, 0.55), 800);
  },

  // A fingerprint pressing down, soft rings around it.
  "es-pro-tap-finger": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.4;
    ripples(f, cx, cy, prog(f, 0.45), s * 0.44, 2);
    withT(f, cx, cy, -0.15, 1 - 0.08 * p, () => {
      for (let i = 1; i <= 6; i++) {
        const st = rand(i, 3) * 1.2;
        stroke(f, (c) => c.ellipse(0, 0, i * s * 0.03, i * s * 0.045, 0, -Math.PI + st * 0.3, st + 0.4), i === 6 ? f.ink : alpha(f.ink, 0.35 + 0.1 * i));
        stroke(f, (c) => c.ellipse(0, 0, i * s * 0.03, i * s * 0.045, 0, st + 0.75, st + 2.3), alpha(f.brand, 0.3 + 0.6 * p));
      }
    });
  },

  // A tap on a glass pane: a sharp point and flattened ripples.
  "es-pro-tap-glass": (f) => {
    const { s, cx, cy } = f;
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.6, cy + s * 0.3);
      c.lineTo(cx - s * 0.32, cy - s * 0.3);
      c.lineTo(cx + s * 0.6, cy - s * 0.3);
      c.lineTo(cx + s * 0.32, cy + s * 0.3);
      c.closePath();
    });
    line(f, cx - s * 0.2, cy - s * 0.2, cx - s * 0.34, cy + s * 0.1, faint(f, 0.35));
    line(f, cx - s * 0.12, cy - s * 0.2, cx - s * 0.2, cy - s * 0.03, faint(f, 0.35));
    const k = prog(f, 0.45);
    for (let i = 0; i < 3; i++) {
      const e = clamp(k * 1.4 - i * 0.2);
      if (e <= 0 || e >= 1) continue;
      stroke(f, (c) => c.ellipse(cx + s * 0.05, cy, s * 0.4 * ease(e), s * 0.15 * ease(e), 0, 0, TAU), alpha(f.brand, 1 - e));
    }
    burst(f, cx + s * 0.05, cy, s * 0.02, s * 0.07, 8, clamp(k * 2.5), f.brand);
    circle(f, cx + s * 0.05, cy, s * 0.012, { fill: f.ink });
  },

  // A stylus taps a tablet, leaving an ink dot that ripples out.
  "es-pro-tap-knock": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.9;
    const x0 = cx - s * 0.26;
    const y0 = cy - s * 0.42;
    rrect(f, x0, y0, s * 0.52, s * 0.84, s * 0.05);
    stroke(f, (c) => {
      c.moveTo(x0 + s * 0.08, y0 + s * 0.2);
      c.bezierCurveTo(x0 + s * 0.2, y0 + s * 0.08, x0 + s * 0.3, y0 + s * 0.32, x0 + s * 0.42, y0 + s * 0.18);
    }, faint(f, 0.45));
    const tx = cx;
    const ty = cy + s * 0.08;
    const k = prog(f, 0.45);
    const dot = f.playing ? s * 0.035 * ease(f.t * 4) : s * 0.035;
    ripples(f, tx, ty, k, s * 0.22, 3);
    circle(f, tx, ty, dot, { fill: f.brand });
    const lift = (1 - p) * s * 0.06;
    const sx = tx + lift * 0.7;
    const sy = ty - lift;
    capsule(f, sx + s * 0.06, sy - s * 0.08, sx + s * 0.42, sy - s * 0.52, s * 0.055);
    stroke(f, (c) => {
      c.moveTo(sx, sy);
      c.lineTo(sx + s * 0.04, sy - s * 0.1);
      c.lineTo(sx + s * 0.085, sy - s * 0.06);
      c.closePath();
    });
  },

  // A smartwatch face tapped softly.
  "es-pro-tap-soft": (f) => {
    const { s, cx, cy } = f;
    rrect(f, cx - s * 0.13, cy - s * 0.46, s * 0.26, s * 0.16, s * 0.03, { stroke: faint(f, 0.45) });
    rrect(f, cx - s * 0.13, cy + s * 0.3, s * 0.26, s * 0.16, s * 0.03, { stroke: faint(f, 0.45) });
    rrect(f, cx - s * 0.2, cy - s * 0.3, s * 0.4, s * 0.6, s * 0.1);
    rrect(f, cx + s * 0.2, cy - s * 0.07, s * 0.035, s * 0.1, s * 0.015, { fill: f.ink });
    const p = f.playing ? press(f) : 0.4;
    circle(f, cx, cy, s * 0.07 * (1 - 0.15 * p), { fill: alpha(f.brand, 0.2 + 0.6 * p), stroke: f.brand });
    ripples(f, cx, cy, prog(f, 0.45), s * 0.19, 2, f.brand);
    label(f, "10:09", cx, cy - s * 0.2, s * 0.06, faint(f, 0.55), 700);
  },

  // A finger taps an icon on a tablet.
  "es-tap-finger": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.6;
    rrect(f, cx - s * 0.6, cy - s * 0.36, s * 1.2, s * 0.72, s * 0.06);
    for (let i = 0; i < 5; i++) {
      const x = cx - s * 0.4 + i * s * 0.2;
      rrect(f, x - s * 0.05, cy - s * 0.2, s * 0.1, s * 0.1, s * 0.025, i === 3 ? { fill: alpha(f.brand, 0.3 + 0.7 * p) } : { stroke: faint(f, 0.45) });
    }
    const tx = cx + s * 0.2;
    const ty = cy - s * 0.15 + (1 - p) * s * 0.07;
    ripples(f, tx, cy - s * 0.15, prog(f, 0.4), s * 0.2, 2);
    finger(f, tx, ty, s * 0.12, s * 0.5, Math.PI - 0.35);
  },

  // A fingernail taps a glass of water; the surface trembles.
  "es-tap-glass": (f) => {
    const { s, cx, cy } = f;
    const lvl = f.playing ? f.level : 0.5;
    const top = cy - s * 0.34;
    const bot = cy + s * 0.36;
    const ly = cy - s * 0.06;
    const glass = (c: CanvasRenderingContext2D) => {
      c.moveTo(cx - s * 0.2, top);
      c.lineTo(cx - s * 0.15, bot);
      c.lineTo(cx + s * 0.15, bot);
      c.lineTo(cx + s * 0.2, top);
    };
    clip(f, (c) => {
      c.moveTo(cx - s * 0.2, top);
      c.lineTo(cx - s * 0.15, bot);
      c.lineTo(cx + s * 0.15, bot);
      c.lineTo(cx + s * 0.2, top);
      c.closePath();
    }, () => {
      f.ctx.fillStyle = alpha(f.brand, 0.14);
      f.ctx.fillRect(cx - s * 0.25, ly, s * 0.5, bot - ly);
      wave(f, cx - s * 0.2, cx + s * 0.2, ly, s * 0.02 * lvl, 4, f.time * 30, f.brand);
    });
    stroke(f, glass);
    line(f, cx - s * 0.15, bot, cx + s * 0.15, bot, f.ink, f.lw * 1.6);
    const p = press(f, 0.05, 0.2);
    finger(f, cx - s * 0.19 - (1 - p) * s * 0.06, cy - s * 0.16, s * 0.1, s * 0.4, Math.PI / 2);
    soundArcs(f, cx + s * 0.22, cy - s * 0.16, 0, s * 0.3, lvl, 3);
  },

  // A fist's knuckles rap on a surface.
  "es-tap-knuckle": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.9;
    const surf = cy + s * 0.28;
    line(f, cx - s * 0.6, surf, cx + s * 0.6, surf);
    const by = surf - s * 0.05 - (1 - p) * s * 0.12;
    const fist = (c: CanvasRenderingContext2D) => {
      c.moveTo(cx - s * 0.3, by - s * 0.06);
      c.lineTo(cx - s * 0.3, by - s * 0.36);
      c.quadraticCurveTo(cx - s * 0.3, by - s * 0.44, cx - s * 0.2, by - s * 0.44);
      c.lineTo(cx + s * 0.22, by - s * 0.44);
      c.quadraticCurveTo(cx + s * 0.3, by - s * 0.44, cx + s * 0.3, by - s * 0.34);
      c.lineTo(cx + s * 0.3, by - s * 0.06);
      for (let i = 3; i >= 0; i--) c.arc(cx - s * 0.225 + i * s * 0.15, by - s * 0.06, s * 0.075, 0, Math.PI);
    };
    erase(f, fist);
    stroke(f, fist);
    for (let i = 1; i < 4; i++) line(f, cx - s * 0.3 + i * s * 0.15, by - s * 0.1, cx - s * 0.3 + i * s * 0.15, by - s * 0.24, faint(f, 0.4));
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.3, by - s * 0.3);
      c.quadraticCurveTo(cx - s * 0.05, by - s * 0.22, cx + s * 0.14, by - s * 0.3);
    }, faint(f, 0.55));
    for (const x of [-0.45, 0.45]) burst(f, cx + x * s, surf - s * 0.03, s * 0.02, s * 0.08, 3, p, f.brand, x < 0 ? Math.PI * 1.1 : -0.3);
  },

  // A cat's paw pads pressing down softly.
  "es-tap-soft": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.3;
    ripples(f, cx, cy + s * 0.04, prog(f, 0.45), s * 0.44, 2, f.ink);
    withT(f, cx, cy + s * 0.04, 0, 1 - 0.08 * p, () => {
      const col = { fill: alpha(f.brand, 0.25 + 0.55 * p), stroke: f.ink };
      const { ctx } = f;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.08, s * 0.15, s * 0.12, 0, 0, TAU);
      ctx.fillStyle = col.fill;
      ctx.fill();
      ctx.strokeStyle = col.stroke;
      ctx.lineWidth = f.lw;
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.55;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * s * 0.24, s * 0.04 + Math.sin(a) * s * 0.22, s * 0.05, s * 0.065, a + Math.PI / 2, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    });
  },

  // A finger taps a wooden table; vibration runs along the grain.
  "es-tap-table": (f) => {
    const { s, cx, cy } = f;
    const p = f.playing ? press(f) : 0.8;
    const ty = cy + s * 0.06;
    rrect(f, cx - s * 0.64, ty, s * 1.28, s * 0.1, s * 0.02);
    for (let i = 0; i < 2; i++) wave(f, cx - s * 0.58, cx + s * 0.58, ty + s * (0.035 + i * 0.03), s * 0.006 + s * 0.008 * p, 3 + i, i * 2, faint(f, 0.35));
    line(f, cx - s * 0.54, ty + s * 0.1, cx - s * 0.54, cy + s * 0.42);
    line(f, cx + s * 0.54, ty + s * 0.1, cx + s * 0.54, cy + s * 0.42);
    const tx = cx + s * 0.08;
    for (const side of [-1, 1]) for (let i = 1; i <= 3; i++) {
      const x = tx + side * s * 0.1 * i;
      line(f, x, ty - s * 0.02, x, ty - s * (0.02 + 0.05 * p * (1 - i * 0.25)), alpha(f.brand, p * (1 - i * 0.25)));
    }
    finger(f, tx, ty - (1 - p) * s * 0.08, s * 0.1, s * 0.42, Math.PI + 0.25);
  },

  // A padlock's shackle drops in and latches.
  "es-toggle-latch": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? ease(f.t * 3) : 1;
    const lift = (1 - k) * s * 0.12;
    const by = cy - s * 0.04;
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.13, by + s * 0.02 - lift);
      c.lineTo(cx - s * 0.13, by - s * 0.18 - lift);
      c.arc(cx, by - s * 0.18 - lift, s * 0.13, Math.PI, 0);
      c.lineTo(cx + s * 0.13, by + s * 0.02 - (k < 1 ? lift * 0.3 : 0));
    }, f.ink, f.lw * 1.8);
    const body = (c: CanvasRenderingContext2D) => c.roundRect(cx - s * 0.22, by, s * 0.44, s * 0.38, s * 0.06);
    erase(f, body);
    fill(f, body, alpha(f.brand, 0.15 + 0.6 * k));
    stroke(f, body);
    circle(f, cx, by + s * 0.16, s * 0.035, { fill: f.ink });
    line(f, cx, by + s * 0.17, cx, by + s * 0.27, f.ink, f.lw * 1.6);
    if (f.playing && k > 0.98) burst(f, cx, by - s * 0.02, s * 0.3, s * 0.4, 6, clamp((f.t - 0.33) * 3), f.brand, -Math.PI / 2 - 0.5);
  },

  // A checkbox ticks on beside its label.
  "es-toggle-micro": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? ease(f.t * 3.5) : 1;
    const p = press(f);
    const bs = s * 0.2 * (1 - 0.08 * p);
    const bx = cx - s * 0.42;
    rrect(f, bx - bs / 2, cy - bs / 2, bs, bs, s * 0.04, { fill: alpha(f.brand, 0.85 * k), stroke: f.ink });
    poly(f, [[bx - s * 0.05, cy], [bx - s * 0.012, cy + s * 0.04], [bx + s * 0.055, cy - s * 0.045]], k, "#fff", f.lw * 1.8);
    line(f, cx - s * 0.22, cy - s * 0.02, cx + s * 0.4, cy - s * 0.02);
    line(f, cx - s * 0.22, cy + s * 0.06, cx + s * 0.18, cy + s * 0.06, faint(f, 0.4));
    for (const dy of [-0.26, 0.26]) {
      rrect(f, bx - s * 0.08, cy + dy * s - s * 0.08, s * 0.16, s * 0.16, s * 0.035, { stroke: faint(f, 0.35) });
      line(f, cx - s * 0.22, cy + dy * s, cx + s * (0.1 + dy), cy + dy * s, faint(f, 0.3));
    }
  },

  // A switch sliding off.
  "es-toggle-off": (f) => toggle(f, false),

  // A switch sliding on, filling with colour.
  "es-toggle-on": (f) => toggle(f, true),

  // A rocker switch rocking from O to I.
  "es-toggle-rocker": (f) => {
    const { s, cx, cy } = f;
    const k = f.playing ? ease(f.t * 3) : 1;
    rrect(f, cx - s * 0.2, cy - s * 0.38, s * 0.4, s * 0.76, s * 0.05);
    const x0 = cx - s * 0.14;
    const rw = s * 0.28;
    const top = cy - s * 0.32;
    const mid = cy + lerp(0.03, -0.03, k) * s;
    const bot = cy + s * 0.32;
    rrect(f, x0, top, rw, mid - top, s * 0.03, { fill: alpha(f.brand, 0.75 * k), stroke: f.ink });
    rrect(f, x0, mid, rw, bot - mid, s * 0.03, { fill: alpha(f.ink, 0.12 * (1 - k) + 0.04), stroke: f.ink });
    line(f, cx, top + s * 0.08, cx, top + s * 0.2, f.ink, f.lw * 1.8);
    circle(f, cx, bot - s * 0.14, s * 0.055, { stroke: f.ink, width: f.lw * 1.6 });
    if (f.playing) burst(f, cx + s * 0.22, mid, s * 0.04, s * 0.13, 4, clamp((f.t - 0.15) * 3), f.brand, -0.6);
  },
};
