// Swoosh and whoosh scenes: each one shows the thing that makes the sound (a blade, a zipper, a jet, a cape).
import {
  type Frame,
  type Scene,
  TAU,
  alpha,
  bump,
  burst,
  circle,
  clamp,
  ease,
  easeIn,
  easeInOut,
  fill,
  lerp,
  line,
  rand,
  ripples,
  rrect,
  shake,
  sparkle,
  speedLines,
  stroke,
  wave,
  withT,
} from "./kit";

/** x across the safe area, u 0…1. */
const X = (f: Frame, u: number) => f.w * (0.1 + 0.8 * u);
const frac = (v: number) => v - Math.floor(v);

function poly(f: Frame, pts: number[][], color = f.ink, width = f.lw) {
  stroke(f, (c) => pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))), color, width);
}

/** A UI card with two lines of content, centred on (x, y). */
function card(f: Frame, x: number, y: number, cw: number, ch: number, rot = 0, a = 1) {
  withT(f, x, y, rot, 1, () => {
    rrect(f, -cw / 2, -ch / 2, cw, ch, ch * 0.14, { stroke: alpha(f.ink, a) });
    line(f, -cw * 0.34, -ch * 0.12, cw * 0.2, -ch * 0.12, alpha(f.brand, a));
    line(f, -cw * 0.34, ch * 0.14, cw * 0.06, ch * 0.14, alpha(f.ink, a * 0.5));
  });
}

/** A wind line from x0 to x1 that curls up at its head. */
function windCurl(f: Frame, x0: number, x1: number, y: number, curl: number, color: string) {
  stroke(f, (c) => {
    c.moveTo(x0, y);
    c.lineTo(x1, y);
    for (let i = 1; i <= 24; i++) {
      const k = i / 24;
      const a = Math.PI / 2 - k * TAU * 0.8;
      const r = curl * (1 - k * 0.55);
      c.lineTo(x1 + Math.cos(a) * r, y - curl + Math.sin(a) * r);
    }
  }, color);
}

/** Strokes fanning out between angles a0…a1 (a partial burst). */
function fan(f: Frame, x: number, y: number, r0: number, r1: number, a0: number, a1: number, n: number, k: number, color = f.brand) {
  if (k <= 0 || k >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = lerp(a0, a1, n === 1 ? 0.5 : i / (n - 1));
    const d0 = lerp(r0, r1, clamp(k * 1.5 - 0.5));
    const d1 = lerp(r0, r1, ease(k));
    line(f, x + Math.cos(a) * d0, y + Math.sin(a) * d0, x + Math.cos(a) * d1, y + Math.sin(a) * d1, alpha(color, 1 - k));
  }
}

function leaf(f: Frame, x: number, y: number, r: number, rot: number, color = f.ink) {
  withT(f, x, y, rot, 1, () => {
    fill(f, (c) => {
      c.moveTo(-r, 0);
      c.quadraticCurveTo(0, -r * 0.75, r, 0);
      c.quadraticCurveTo(0, r * 0.75, -r, 0);
    }, alpha(f.brand, 0.18));
    stroke(f, (c) => {
      c.moveTo(-r, 0);
      c.quadraticCurveTo(0, -r * 0.75, r, 0);
      c.quadraticCurveTo(0, r * 0.75, -r, 0);
      c.moveTo(-r * 1.3, 0);
      c.lineTo(r * 0.7, 0);
    }, color);
  });
}

function feather(f: Frame, x: number, y: number, L: number, rot: number) {
  withT(f, x, y, rot, 1, () => {
    const vane = (c: CanvasRenderingContext2D) => {
      c.moveTo(-L * 0.35, 0);
      c.quadraticCurveTo(-L * 0.1, -L * 0.2, L * 0.5, -L * 0.02);
      c.quadraticCurveTo(-L * 0.05, L * 0.2, -L * 0.35, 0);
    };
    fill(f, vane, alpha(f.brand, 0.2));
    stroke(f, vane);
    line(f, -L * 0.5, 0, L * 0.5, -L * 0.02);
    for (let i = 1; i < 5; i++) {
      const x0 = lerp(-L * 0.25, L * 0.35, i / 5);
      line(f, x0, 0, x0 + L * 0.06, -L * 0.11 * (1 - i / 6), alpha(f.ink, 0.45));
      line(f, x0, 0, x0 + L * 0.06, L * 0.11 * (1 - i / 6), alpha(f.ink, 0.45));
    }
  });
}

/** A swinging limb/stick motion arc around a pivot: from angle a back by `back` radians. */
function motionArc(f: Frame, x: number, y: number, r: number, a: number, back: number, color = f.brand) {
  stroke(f, (c) => c.arc(x, y, r, Math.min(a, a + back), Math.max(a, a + back)), alpha(color, 0.7));
}

export const swooshWhooshScenes: Record<string, Scene> = {
  // ── Swooshes ──────────────────────────────────────────────────────────────

  // A fast airy whoosh: three wind lines curling as they pass.
  "swoosh-air-01": (f) => {
    const k = ease(f.t * 1.3);
    [0.32, 0.5, 0.68].forEach((v, i) => {
      const head = X(f, 0.22 + 0.6 * clamp(k * 1.1 - i * 0.1));
      const tail = Math.max(X(f, 0), head - f.w * (0.2 + 0.18 * f.level));
      windCurl(f, tail, head, f.h * v + f.s * 0.05, f.s * (0.045 + 0.015 * i), i === 1 ? f.brand : f.ink);
    });
  },

  // A soft low fast whoosh: a soft pill sliding with fading ghosts.
  "swoosh-soft-01": (f) => {
    const { cy, s } = f;
    const p = easeInOut(f.t * 1.2);
    for (let i = 4; i >= 0; i--) {
      const x = X(f, 0.14 + 0.72 * clamp(p - i * 0.06 * (0.5 + f.level)));
      if (i) rrect(f, x - s * 0.16, cy - s * 0.09, s * 0.32, s * 0.18, s * 0.09, { fill: alpha(f.brand, 0.06 * (5 - i)) });
      else rrect(f, x - s * 0.16, cy - s * 0.09, s * 0.32, s * 0.18, s * 0.09, { fill: alpha(f.brand, 0.85), stroke: f.ink });
    }
  },

  // A soft quick swipe: a finger swipes a phone's screen to the next panel.
  "swoosh-soft-02": (f) => {
    const { ctx, cx, cy, s, t } = f;
    const pw = s * 0.42;
    const ph = s * 0.74;
    const x0 = cx - pw / 2;
    const y0 = cy - ph / 2;
    rrect(f, x0, y0, pw, ph, s * 0.06);
    const p = easeInOut(t * 1.4);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0 + f.lw * 2, y0 + f.lw * 2, pw - f.lw * 4, ph - f.lw * 4, s * 0.05);
    ctx.clip();
    for (let i = 0; i < 2; i++) {
      const px = x0 + pw * (i - p);
      rrect(f, px + pw * 0.12, y0 + ph * 0.14, pw * 0.76, ph * 0.42, s * 0.03, { stroke: i ? f.brand : f.ink });
      line(f, px + pw * 0.14, y0 + ph * 0.68, px + pw * 0.7, y0 + ph * 0.68, alpha(f.ink, 0.45));
      line(f, px + pw * 0.14, y0 + ph * 0.78, px + pw * 0.5, y0 + ph * 0.78, alpha(f.ink, 0.45));
    }
    ctx.restore();
    const fx = cx + pw * 0.6 - pw * 1.1 * p;
    const fy = cy + ph * 0.12;
    line(f, fx + s * 0.06, fy, fx + s * 0.06 + s * 0.2 * bump(t, 0.35, 0.35), fy, alpha(f.brand, 0.6));
    circle(f, fx, fy, s * 0.05, { fill: alpha(f.brand, 0.3 + 0.4 * f.level), stroke: f.brand });
  },

  // A clean fast whoosh that passes by: a ball grows as it passes in front, Doppler arcs behind.
  "swoosh-soft-03": (f) => {
    const { cy, s } = f;
    const u = clamp(f.t * 1.2);
    const x = X(f, u);
    const r = s * (0.05 + 0.14 * Math.sin(u * Math.PI));
    for (let i = 1; i <= 3; i++) stroke(f, (c) => c.arc(x, cy, r + i * s * 0.055, Math.PI * 0.62, Math.PI * 1.38), alpha(f.ink, 0.5 - i * 0.12));
    line(f, X(f, 0), cy + s * 0.32, X(f, 1), cy + s * 0.32, alpha(f.ink, 0.2));
    stroke(f, (c) => c.ellipse(x, cy + s * 0.32, r * 0.9, r * 0.12, 0, 0, TAU), alpha(f.ink, 0.25));
    circle(f, x, cy, r, { fill: f.brand, stroke: f.ink });
  },

  // A soft round fast whoosh: a dot orbiting on a circle, its arc trailing.
  "swoosh-soft-04": (f) => {
    const { cx, cy, s } = f;
    const R = s * 0.3;
    const a = -Math.PI * 0.5 + ease(f.t * 1.2) * TAU * 0.85;
    circle(f, cx, cy, R, { stroke: alpha(f.ink, 0.18) });
    stroke(f, (c) => c.arc(cx, cy, R, a - 1.6, a), f.brand, f.lw * 1.6);
    circle(f, cx, cy, s * 0.05);
    circle(f, cx + Math.cos(a) * R, cy + Math.sin(a) * R, s * (0.045 + 0.02 * f.level), { fill: f.brand });
  },

  // A short low swish that ends in a soft punch: a ball flies into a wall and squashes.
  "swoosh-swish-01": (f) => {
    const { cy, s, t } = f;
    const wallX = X(f, 0.9);
    line(f, wallX, cy - s * 0.32, wallX, cy + s * 0.32, f.ink, f.lw * 1.4);
    for (let i = 0; i < 5; i++) line(f, wallX, cy - s * 0.3 + i * s * 0.14, wallX + s * 0.05, cy - s * 0.25 + i * s * 0.14, alpha(f.ink, 0.35));
    const p = easeIn(clamp(t / 0.7));
    const hit = clamp((t - 0.7) / 0.3);
    const sq = 0.35 * bump(hit, 0.1, 0.4);
    const r = s * 0.08;
    const x = lerp(X(f, 0.05) + r, wallX - r * (1 - sq), Math.max(p, 0.25));
    speedLines(f, x - r, cy, 0, s * 0.55, r * 1.4, 4, Math.max(p, 0.25) * (1 - hit));
    withT(f, x, cy, 0, 1, () => {
      f.ctx.scale(1 - sq, 1 + sq);
      circle(f, 0, 0, r, { fill: f.brand, stroke: f.ink });
    });
    fan(f, wallX - s * 0.02, cy, s * 0.08, s * 0.22, Math.PI * 0.65, Math.PI * 1.35, 5, hit);
  },

  // A fast stick-through-the-air swish: a stick swings in an arc from a pivot.
  "swoosh-swish-02": (f) => {
    const { cx, h, s } = f;
    const px = cx;
    const py = h * 0.86;
    const L = s * 0.62;
    const a = lerp(-Math.PI * 0.92, -Math.PI * 0.08, easeInOut(f.t * 1.15));
    for (let i = 1; i <= 5; i++) {
      const ai = a - i * 0.12 * (0.4 + f.level);
      line(f, px, py, px + Math.cos(ai) * L, py + Math.sin(ai) * L, alpha(f.ink, 0.25 - i * 0.04));
    }
    motionArc(f, px, py, L * 1.05, a, -0.9);
    line(f, px, py, px + Math.cos(a) * L, py + Math.sin(a) * L, f.ink, f.lw * 2);
    circle(f, px, py, s * 0.025, { fill: f.ink });
  },

  // A bright metallic swish with a ring: a spinning metal ring throwing out echoes.
  "swoosh-tech-01": (f) => {
    const { ctx, cx, cy, s, t } = f;
    const spin = t * TAU * 1.5 + f.time * 2;
    ripples(f, cx, cy, clamp(t * 1.4), s * 0.44, 3, f.brand);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.14, Math.abs(Math.cos(spin))), 1);
    circle(f, 0, 0, s * 0.22, { stroke: f.ink, width: f.lw * 2 });
    circle(f, 0, 0, s * 0.17, { stroke: alpha(f.ink, 0.5) });
    ctx.restore();
    sparkle(f, cx + s * 0.13, cy - s * 0.17, s * (0.03 + 0.05 * f.level), f.brand);
  },

  // A bright metallic sweep, like a blade being drawn from its sheath.
  "swoosh-tech-02": (f) => {
    const { ctx, w, cy, s } = f;
    const s0 = w * 0.08;
    const s1 = w * 0.44;
    const bl = w * 0.34;
    const bh = s * 0.05;
    const g = w * 0.46 + ease(f.t * 1.3) * w * 0.32;
    rrect(f, s0, cy - bh * 1.4, s1 - s0, bh * 2.8, bh * 1.4);
    line(f, s0 + w * 0.04, cy - bh * 1.4, s0 + w * 0.04, cy + bh * 1.4, alpha(f.ink, 0.4));
    ctx.save();
    ctx.beginPath();
    ctx.rect(s1, 0, w, f.h);
    ctx.clip();
    stroke(f, (c) => {
      c.moveTo(g, cy - bh);
      c.lineTo(g - bl * 0.9, cy - bh);
      c.lineTo(g - bl, cy);
      c.lineTo(g - bl * 0.9, cy + bh);
      c.lineTo(g, cy + bh);
    });
    line(f, g, cy, g - bl * 0.85, cy, alpha(f.ink, 0.3));
    ctx.restore();
    line(f, g, cy - bh * 2.6, g, cy + bh * 2.6, f.ink, f.lw * 2);
    rrect(f, g + f.lw, cy - bh * 0.8, s * 0.13, bh * 1.6, bh * 0.8, { fill: f.brand });
    sparkle(f, Math.max(s1 + s * 0.04, g - bl * 0.45), cy - bh * 1.9, s * (0.02 + 0.05 * f.level), f.brand);
  },

  // A bright swelling swoosh like a reverse cymbal: rings converge onto a cymbal.
  "swoosh-tech-03": (f) => {
    const { cx, cy, h, s, t } = f;
    const y = cy - s * 0.08;
    line(f, cx, y, cx, h * 0.86);
    line(f, cx, h * 0.86, cx - s * 0.12, h * 0.9);
    line(f, cx, h * 0.86, cx + s * 0.12, h * 0.9);
    for (let i = 0; i < 3; i++) {
      const p = frac(t * 1.6 + i / 3);
      const r = s * (0.5 - 0.38 * p);
      stroke(f, (c) => c.ellipse(cx, y, r * 1.3, r * 0.3, 0, 0, TAU), alpha(f.brand, p * 0.8));
    }
    const tilt = f.playing ? Math.sin(f.time * 20) * 0.06 * f.level : -0.06;
    stroke(f, (c) => c.ellipse(cx, y, s * 0.26, s * 0.05, tilt, 0, TAU), f.ink, f.lw * 1.5);
    stroke(f, (c) => c.ellipse(cx, y - s * 0.015, s * 0.06, s * 0.03, tilt, Math.PI, TAU));
  },

  // A bright buzzy digital glitch swoosh: a pixel streak that breaks up behind its head.
  "swoosh-tech-04": (f) => {
    const { cy, s } = f;
    const px = s * 0.06;
    const head = X(f, 0.15 + 0.8 * ease(f.t * 1.3));
    const fr = Math.floor(f.time * 20);
    for (let i = 0; i < 14; i++) {
      for (let r = -1; r <= 1; r++) {
        if (rand(i * 3 + r, fr + f.seed) < i / 14) continue;
        const x = head - (i + 1) * px * 1.15;
        const y = cy + r * px * 1.15 + (rand(i, fr) - 0.5) * px * f.level * 1.4;
        if (x < X(f, 0)) continue;
        rrect(f, x - px / 2, y - px / 2, px, px, 1, { fill: alpha(r === 0 ? f.brand : f.ink, 1 - i / 14) });
      }
    }
    rrect(f, head - px * 0.7, cy - px * 1.75, px * 1.4, px * 3.5, 2, { fill: f.brand });
  },

  // Tonal sweep down: a zipper running fast down a jacket, opening behind it.
  "es-pro-zip-down": (f) => {
    const { cx, h, s } = f;
    const y0 = h * 0.1;
    const y1 = h * 0.9;
    const n = 18;
    const sy = lerp(y0 + s * 0.06, y1 - s * 0.1, easeInOut(f.t * 1.4));
    const L: number[][] = [];
    const R: number[][] = [];
    for (let i = 0; i < n; i++) {
      const y = lerp(y0, y1, i / (n - 1));
      const open = y < sy;
      const gap = s * 0.022 + (open ? clamp((sy - y) / (s * 0.55)) * s * 0.14 : 0);
      L.push([cx - gap - s * 0.09, y]);
      R.push([cx + gap + s * 0.09, y]);
      if (i % 2) line(f, cx - gap - s * 0.05, y, cx - gap + (open ? 0 : s * 0.022), y, f.ink, f.lw * 1.3);
      else line(f, cx + gap - (open ? 0 : s * 0.022), y, cx + gap + s * 0.05, y, f.ink, f.lw * 1.3);
    }
    poly(f, L, alpha(f.ink, 0.4));
    poly(f, R, alpha(f.ink, 0.4));
    rrect(f, cx - s * 0.06, sy - s * 0.06, s * 0.12, s * 0.1, s * 0.025, { fill: f.brand, stroke: f.ink });
    const swing = f.playing ? Math.sin(f.time * 18) * 0.35 * f.level : 0.12;
    withT(f, cx, sy + s * 0.03, swing, 1, () => rrect(f, -s * 0.025, 0, s * 0.05, s * 0.13, s * 0.02, { stroke: f.ink }));
  },

  // A warmer, slower zip: a pouch's zipper opening, its pull tab swinging.
  "es-pro-zip-down-warm": (f) => {
    const { cy, s, w } = f;
    const x0 = w * 0.16;
    const x1 = w * 0.84;
    const top = cy - s * 0.2;
    const body = (c: CanvasRenderingContext2D) => {
      c.moveTo(x0, top);
      c.lineTo(x0 + s * 0.02, cy + s * 0.26);
      c.quadraticCurveTo(x0 + s * 0.04, cy + s * 0.34, x0 + s * 0.14, cy + s * 0.34);
      c.lineTo(x1 - s * 0.14, cy + s * 0.34);
      c.quadraticCurveTo(x1 - s * 0.04, cy + s * 0.34, x1 - s * 0.02, cy + s * 0.26);
      c.lineTo(x1, top);
    };
    fill(f, body, alpha(f.brand, 0.08));
    stroke(f, body);
    const sx = lerp(x0 + s * 0.1, x1 - s * 0.1, easeInOut(f.t * 1.05));
    const n = 24;
    const up: number[][] = [];
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n);
      const o = x < sx ? clamp((sx - x) / (s * 0.6)) * s * 0.07 : 0;
      const sep = o > 0 ? s * 0.012 : 0;
      if (i % 2) line(f, x, top - s * 0.032 - o, x, top + s * 0.008 - o - sep, f.ink, f.lw * 1.2);
      else line(f, x, top - s * 0.008 + o + sep, x, top + s * 0.032 + o, f.ink, f.lw * 1.2);
      up.push([x, top - s * 0.045 - o]);
    }
    poly(f, up, alpha(f.ink, 0.45));
    rrect(f, sx - s * 0.05, top - s * 0.05, s * 0.1, s * 0.1, s * 0.03, { fill: f.brand, stroke: f.ink });
    const swing = f.playing ? Math.sin(f.time * 9) * 0.4 * f.level : 0.25;
    withT(f, sx, top + s * 0.04, swing, 1, () => {
      rrect(f, -s * 0.026, 0, s * 0.052, s * 0.16, s * 0.026, { stroke: f.ink });
      circle(f, 0, s * 0.12, s * 0.01, { stroke: f.ink });
    });
  },

  // Cloth: a flag flapping on its pole.
  "es-swipe-cloth": (f) => {
    const { ctx, h, s, w } = f;
    const px = w * 0.24;
    const top = h * 0.16;
    line(f, px, top - s * 0.04, px, h * 0.9, f.ink, f.lw * 1.5);
    circle(f, px, top - s * 0.05, s * 0.018, { fill: f.ink });
    const cw = w * 0.52;
    const ch = s * 0.42;
    const ph = f.t * TAU * 2 + f.time * 5;
    const amp = s * (0.03 + 0.07 * f.level);
    const edge = (u: number, o: number) => Math.sin(ph - u * 5 - o) * amp * u;
    const n = 30;
    ctx.beginPath();
    ctx.moveTo(px, top);
    for (let i = 1; i <= n; i++) ctx.lineTo(px + cw * (i / n), top + edge(i / n, 0));
    for (let i = n; i >= 0; i--) ctx.lineTo(px + cw * (i / n) * (1 - 0.08 * Math.sin(ph)), top + ch + edge(i / n, 0.6));
    ctx.closePath();
    ctx.fillStyle = alpha(f.brand, 0.2);
    ctx.fill();
    ctx.strokeStyle = f.ink;
    ctx.lineWidth = f.lw;
    ctx.stroke();
    for (let j = 1; j < 4; j++) {
      const u = j / 4;
      line(f, px + cw * u, top + edge(u, 0) + s * 0.03, px + cw * u * 0.98, top + ch + edge(u, 0.6) - s * 0.03, alpha(f.brand, 0.5));
    }
  },

  // A card flicked off the top of a stack.
  "es-swipe-flick": (f) => {
    const { cx, cy, s, t } = f;
    const p = easeInOut(clamp((t - 0.05) / 0.65));
    card(f, cx, cy + s * 0.04, s * 0.5, s * 0.34, 0, 0.45);
    card(f, cx + p * f.w * 0.3, cy - p * s * 0.3, s * 0.5, s * 0.34, p * 0.7, 1 - p * 0.3);
    stroke(f, (c) => {
      c.moveTo(cx - s * 0.4, cy + s * 0.34);
      c.quadraticCurveTo(cx - s * 0.1, cy + s * 0.38, cx + s * 0.08, cy + s * 0.26);
    }, alpha(f.brand, 0.8 * (1 - p * 0.6)));
    circle(f, cx + s * 0.08, cy + s * 0.26, s * 0.02, { fill: alpha(f.brand, 1 - p * 0.6) });
  },

  // A card gliding along a track, its shadow following.
  "es-swipe-glide": (f) => {
    const { cy, s, t } = f;
    const x = X(f, 0.18 + 0.64 * easeInOut(t * 1.1));
    const lift = Math.sin(clamp(t * 1.1) * Math.PI) * s * 0.05;
    line(f, X(f, 0), cy + s * 0.32, X(f, 1), cy + s * 0.32, alpha(f.ink, 0.25));
    stroke(f, (c) => c.ellipse(x, cy + s * 0.32, s * 0.22, s * 0.02, 0, 0, TAU), alpha(f.ink, 0.25));
    speedLines(f, x - s * 0.27, cy - lift, 0, s * 0.35, s * 0.2, 3, 0.3 + 0.7 * bump(t, 0.45, 0.45));
    card(f, x, cy - s * 0.02 - lift, s * 0.48, s * 0.3, -0.03);
  },

  // Paper: a book's page turning over.
  "es-swipe-paper": (f) => {
    const { cx, cy, s } = f;
    const pw = s * 0.5;
    const ph = s * 0.6;
    const top = cy - ph / 2;
    rrect(f, cx - pw, top, pw, ph, s * 0.02);
    rrect(f, cx, top, pw, ph, s * 0.02);
    for (let i = 0; i < 4; i++) {
      const y = top + ph * (0.2 + i * 0.17);
      line(f, cx - pw * 0.82, y, cx - pw * (0.2 + 0.1 * (i % 2)), y, alpha(f.ink, 0.3));
      line(f, cx + pw * 0.18, y, cx + pw * (0.8 - 0.1 * (i % 2)), y, alpha(f.ink, 0.3));
    }
    const k = easeInOut(f.t * 1.2);
    const tw = pw * Math.cos(k * Math.PI);
    const lift = Math.sin(k * Math.PI) * s * 0.07;
    const pg = (c: CanvasRenderingContext2D) => {
      c.moveTo(cx, top);
      c.quadraticCurveTo(cx + tw * 0.6, top - lift, cx + tw, top - lift * 0.5);
      c.lineTo(cx + tw, top + ph - lift * 0.5);
      c.quadraticCurveTo(cx + tw * 0.6, top + ph - lift, cx, top + ph);
    };
    fill(f, pg, alpha(f.brand, 0.14));
    stroke(f, pg, f.brand);
  },

  // Velvet: heavy stage curtains sliding closed.
  "es-swipe-velvet": (f) => {
    const { cx, h, s, w } = f;
    const top = h * 0.12;
    const bot = h * 0.88;
    const L = w * 0.1;
    const R = w * 0.9;
    line(f, L - s * 0.02, top, R + s * 0.02, top, f.ink, f.lw * 1.6);
    const k = easeInOut(f.t * 1.1);
    const edge = lerp(L + (cx - L) * 0.3, cx - s * 0.01, k);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? L : R;
      const x1 = side < 0 ? edge : 2 * cx - edge;
      const folds = 6;
      for (let i = 0; i <= folds; i++) {
        const x = lerp(x0, x1, i / folds);
        const sway = f.playing ? Math.sin(i * 1.3 + f.time * 6) * s * 0.015 * f.level : side * s * 0.008;
        stroke(f, (c) => {
          c.moveTo(x, top);
          c.quadraticCurveTo(x + sway, (top + bot) / 2, x + sway * 2, bot);
        }, i === folds ? f.ink : alpha(f.brand, 0.65), i === folds ? f.lw * 1.4 : f.lw);
      }
      wave(f, Math.min(x0, x1), Math.max(x0, x1), bot, s * 0.012, folds, 0, alpha(f.ink, 0.6));
    }
  },

  // A blade slash: a crescent cut across the frame.
  "es-swish-blade": (f) => {
    const { cx, cy, s, t } = f;
    const k = ease(t * 1.6);
    const fade = 1 - clamp((t - 0.6) / 0.4);
    const ox = cx + s * 0.45;
    const oy = cy + s * 0.6;
    const r = s * 0.85;
    const a0 = Math.PI * 1.08;
    const a1 = lerp(a0, Math.PI * 1.42, k);
    stroke(f, (c) => c.arc(ox, oy, r, a0 + (a1 - a0) * 0.3, a1), alpha(f.brand, fade), f.lw * (1.5 + 3 * f.level));
    stroke(f, (c) => c.arc(ox, oy, r - s * 0.03, a0, a1), alpha(f.ink, fade * 0.8));
    sparkle(f, ox + Math.cos(a1) * r, oy + Math.sin(a1) * r, s * (0.03 + 0.04 * f.level), f.brand);
  },

  // A bright quick swish: a spark streak arcing over, shedding sparks.
  "es-swish-bright": (f) => {
    const { cy, s } = f;
    const u = ease(f.t * 1.4);
    const at = (v: number) => [X(f, 0.05 + 0.9 * v), cy + s * 0.18 - Math.sin(v * Math.PI) * s * 0.32];
    const pts: number[][] = [];
    for (let i = 0; i <= 20; i++) pts.push(at(clamp(u - 0.35 + (i / 20) * 0.35)));
    poly(f, pts, alpha(f.brand, 0.7), f.lw * 1.4);
    for (let i = 1; i <= 6; i++) {
      const [x, y] = at(clamp(u - i * 0.05));
      circle(f, x + (rand(i, 2) - 0.5) * s * 0.06, y + i * i * s * 0.006, s * 0.008 * (7 - i) * 0.4, { fill: alpha(f.brand, 1 - i / 7) });
    }
    const [hx, hy] = at(u);
    sparkle(f, hx, hy, s * (0.05 + 0.06 * f.level), f.brand);
    sparkle(f, hx, hy, s * 0.025, f.ink);
  },

  // A cane swung fast through the air.
  "es-swish-cane": (f) => {
    const { cx, h, s } = f;
    const px = cx;
    const py = h * 0.2;
    const L = s * 0.56;
    const a = lerp(-1.05, 1.05, easeInOut(f.t * 1.15));
    motionArc(f, px, py, L, Math.PI / 2 + a, -0.7);
    const cane = (alphaK: number, ang: number) =>
      withT(f, px, py, ang, 1, () => {
        stroke(f, (c) => {
          c.moveTo(0, L);
          c.lineTo(0, 0);
          c.arc(s * 0.07, 0, s * 0.07, Math.PI, 0);
          c.lineTo(s * 0.14, s * 0.05);
        }, alpha(f.ink, alphaK), f.lw * (alphaK === 1 ? 1.8 : 1));
      });
    cane(0.15, a - 0.36);
    cane(0.3, a - 0.18);
    cane(1, a);
    circle(f, px, py, s * 0.022, { fill: f.brand });
  },

  // A high flick that rises and stops dead against a bar.
  "es-swish-flick": (f) => {
    const { cx, h, s, t } = f;
    const stopY = h * 0.2;
    const r = s * 0.045;
    line(f, cx - s * 0.18, stopY - r - f.lw, cx + s * 0.18, stopY - r - f.lw, f.ink, f.lw * 1.6);
    const at = (u: number) => {
      const a = [cx - s * 0.5, h * 0.85];
      const c = [cx - s * 0.02, h * 0.82];
      const b = [cx, stopY];
      return [0, 1].map((j) => (1 - u) * (1 - u) * a[j] + 2 * (1 - u) * u * c[j] + u * u * b[j]);
    };
    const all: number[][] = [];
    for (let i = 0; i <= 30; i++) all.push(at(i / 30));
    poly(f, all, alpha(f.ink, 0.15));
    const k = clamp(t / 0.5);
    const p = easeIn(k);
    const tr: number[][] = [];
    for (let i = 0; i <= 12; i++) tr.push(at(clamp(p - 0.3 + (i / 12) * 0.3)));
    poly(f, tr, f.brand, f.lw * 1.4);
    const [x, y] = at(p);
    circle(f, x, y, r, { fill: f.brand, stroke: f.ink });
    if (k >= 1) {
      const d = clamp((t - 0.5) / 0.3);
      line(f, x - r * 1.6, y - r * 0.2, x - r * 2.6, y + r * 0.2, alpha(f.ink, 1 - d));
      line(f, x + r * 1.6, y - r * 0.2, x + r * 2.6, y + r * 0.2, alpha(f.ink, 1 - d));
    }
  },

  // A soft swish: a feather drifting along an S-curve.
  "es-swish-soft": (f) => {
    const { cy, s } = f;
    const path = (v: number) => [X(f, 0.08 + 0.84 * v), cy + Math.sin(v * TAU) * s * 0.14];
    const u = easeInOut(f.t * 1.05);
    for (let i = 0; i < 12; i++) {
      const v = (i / 12) * u;
      const [x, y] = path(v);
      circle(f, x, y, s * 0.006, { fill: alpha(f.ink, 0.25) });
    }
    const [x, y] = path(u);
    feather(f, x, y, s * 0.36, Math.cos(u * TAU) * 0.45 - 0.25 + (f.playing ? Math.sin(f.time * 7) * 0.1 * f.level : 0));
  },

  // A stick swung fast: a baton twirling as it crosses.
  "es-swish-stick": (f) => {
    const { cy, s, t } = f;
    const x = X(f, 0.18 + 0.64 * ease(t * 1.2));
    const rot = t * TAU * 2.2;
    const L = s * 0.22;
    for (let i = 3; i >= 0; i--) {
      const r = rot - i * 0.28;
      const a = i ? 0.12 * (4 - i) : 1;
      const dx = Math.cos(r) * L;
      const dy = Math.sin(r) * L;
      line(f, x - dx, cy - dy, x + dx, cy + dy, alpha(f.ink, a), i ? f.lw : f.lw * 1.8);
      if (!i) {
        circle(f, x + dx, cy + dy, s * 0.03, { fill: f.brand });
        circle(f, x - dx, cy - dy, s * 0.025, { fill: f.ink });
      }
    }
    stroke(f, (c) => c.arc(x, cy, L * 1.15, rot - 1.2, rot), alpha(f.brand, 0.5));
  },

  // A zing: an arrow flies through with a vibrating wake.
  "es-swish-zing": (f) => {
    const { cy, s } = f;
    const x = X(f, 0.38 + 0.6 * ease(f.t * 1.5));
    const L = s * 0.4;
    const tail = x - L;
    wave(f, Math.max(X(f, 0), tail - s * 0.6), tail, cy, (u) => s * 0.05 * u * (0.4 + f.level), 5, -f.time * 30, alpha(f.brand, 0.7));
    line(f, tail, cy, x - s * 0.04, cy, f.ink, f.lw * 1.4);
    fill(f, (c) => {
      c.moveTo(x + s * 0.03, cy);
      c.lineTo(x - s * 0.05, cy - s * 0.035);
      c.lineTo(x - s * 0.05, cy + s * 0.035);
      c.closePath();
    }, f.brand);
    for (const d of [-1, 1]) {
      line(f, tail + s * 0.02, cy, tail - s * 0.04, cy + d * s * 0.05, f.ink);
      line(f, tail + s * 0.07, cy, tail + s * 0.01, cy + d * s * 0.05, f.ink);
    }
  },

  // ── Whooshes ──────────────────────────────────────────────────────────────

  // A deep low whoosh with a thumping body: a heavy ball rolls past, denting the ground.
  "whoosh-deep-01": (f) => {
    const { h, s } = f;
    const gy = h * 0.84;
    const r = s * 0.22;
    const x = lerp(f.w * 0.1 + r, f.w * 0.9 - r, easeInOut(f.t * 1.1));
    const [dx, dy] = shake(f, 0.02);
    const g: number[][] = [];
    for (let i = 0; i <= 40; i++) {
      const gx = lerp(X(f, 0), X(f, 1), i / 40);
      g.push([gx, gy + dy + Math.exp(-Math.pow((gx - x) / (r * 1.2), 2)) * s * 0.03 * (0.4 + f.level)]);
    }
    poly(f, g);
    speedLines(f, x - r, gy - r, 0, s * 0.4, r * 1.3, 5, 0.3 + 0.7 * bump(f.t, 0.5, 0.5));
    circle(f, x + dx, gy - r - f.lw + dy, r, { stroke: f.ink, width: f.lw * 1.5 });
    circle(f, x + dx, gy - r + dy, r * (0.35 + 0.25 * f.level), { fill: alpha(f.brand, 0.85) });
  },

  // A deep cinematic whoosh: a camera push through a perspective tunnel.
  "whoosh-deep-02": (f) => {
    const { cx, cy, w, h } = f;
    const fw = w * 0.82;
    const fh = h * 0.78;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) line(f, cx + sx * fw * 0.03, cy + sy * fh * 0.03, cx + sx * fw / 2, cy + sy * fh / 2, alpha(f.ink, 0.2));
    rrect(f, cx - fw / 2, cy - fh / 2, fw, fh, f.s * 0.03, { stroke: f.ink });
    const z = f.t * 2 + f.time * 0.4;
    for (let i = 0; i < 5; i++) {
      const p = frac(z + i / 5);
      const sc = Math.pow(p, 2.2);
      rrect(f, cx - (fw * sc) / 2, cy - (fh * sc) / 2, fw * sc, fh * sc, f.s * 0.02 * sc, {
        stroke: alpha(i % 2 ? f.ink : f.brand, p * 0.9),
        width: f.lw * (0.6 + p * (0.6 + f.level)),
      });
    }
    circle(f, cx, cy, f.s * 0.02, { fill: f.brand });
  },

  // A long air whoosh with a slow build: dashed streamlines that speed up.
  "whoosh-long-01": (f) => {
    const { ctx, h, s, t } = f;
    const build = 0.2 + 0.8 * easeIn(t);
    for (let i = 0; i < 6; i++) {
      ctx.setLineDash([s * (0.06 + 0.4 * build), s * 0.07]);
      ctx.lineDashOffset = -(t * s * 6 * build + i * s * 0.13);
      wave(f, X(f, 0), X(f, 1), h * (0.22 + i * 0.112), s * 0.015 * (1 + (i % 2)), 1.2, i, i === 2 || i === 4 ? f.brand : alpha(f.ink, 0.3 + 0.5 * build), f.lw * (0.8 + f.level * 0.6));
    }
    ctx.setLineDash([]);
  },

  // A quiet low soft whoosh: a few leaves drifting on a breeze.
  "whoosh-soft-01": (f) => {
    const { h, s, t } = f;
    wave(f, X(f, 0), X(f, 1), h * 0.5, s * 0.05, 1.1, f.time * 2, alpha(f.ink, 0.15));
    for (let i = 0; i < 3; i++) {
      const u = clamp(t * 0.85 + i * 0.16);
      const x = X(f, 0.05 + 0.9 * u);
      const y = h * (0.3 + i * 0.18) + Math.sin(u * TAU + i) * s * 0.05;
      leaf(f, x, y, s * (0.07 + 0.015 * i), Math.sin(u * 5 + i * 2) * 0.9, i === 1 ? f.brand : f.ink);
    }
  },

  // A low soft whoosh that starts late with a heartbeat-like pulse: an ECG, then a sweep over it.
  "whoosh-soft-02": (f) => {
    const { cx, cy, s, t } = f;
    const amp = s * (0.16 + 0.14 * f.level);
    const beat = (u: number) => {
      let y = 0;
      for (const c of [0.24, 0.52]) {
        const d = u - c;
        y += -amp * bump(d, 0, 0.018) + amp * 0.45 * bump(d, 0.03, 0.015) - amp * 0.12 * bump(d, 0.09, 0.03);
      }
      return y;
    };
    const pts: number[][] = [];
    for (let i = 0; i <= 140; i++) pts.push([X(f, i / 140), cy + s * 0.14 + beat(i / 140)]);
    poly(f, pts, alpha(f.ink, 0.85));
    const scan = clamp(t * 1.1);
    circle(f, X(f, scan), cy + s * 0.14 + beat(scan), s * 0.025, { fill: f.brand });
    const k = f.playing ? clamp((t - 0.3) / 0.55) : 0.45;
    if (k > 0) {
      const a0 = Math.PI * 1.1;
      const a1 = lerp(a0, Math.PI * 1.9, ease(k));
      stroke(f, (c) => c.arc(cx, cy + s * 0.55, s * 0.62, Math.max(a0, a1 - 0.7), a1), alpha(f.brand, 1 - clamp(k * 1.3 - 0.4)), f.lw * 1.6);
    }
  },

  // A designed low swell, gritty: a stream of sand grains.
  "es-pro-whoosh-big-gritty": (f) => {
    const { cy, s, t } = f;
    const front = X(f, ease(t * 1.3));
    for (let i = 0; i < 70; i++) {
      const u = frac(rand(i, 1) + t * 0.5 * (0.6 + 0.4 * rand(i, 2)));
      const x = X(f, u);
      if (x > front) continue;
      const spread = 0.08 + 0.32 * u;
      const y = cy + (rand(i, 3) - 0.5) * s * spread * 2 + (f.playing ? (rand(i, Math.floor(f.time * 30)) - 0.5) * s * 0.02 * f.level : 0);
      const r = s * (0.005 + 0.012 * rand(i, 4));
      if (i % 5 === 0) rrect(f, x - r, y - r, r * 2, r * 2, 0, { fill: alpha(f.brand, 0.9) });
      else circle(f, x, y, r, { fill: alpha(f.ink, 0.35 + 0.5 * rand(i, 5)) });
    }
  },

  // A designed long swell: a comet with a long winding trail.
  "es-pro-whoosh-big-long": (f) => {
    const { cy, s } = f;
    const u = ease(f.t * 1.1);
    const at = (v: number) => [X(f, v), cy + Math.sin(v * TAU * 1.1 + 0.5) * s * 0.2];
    for (let i = 0; i < 24; i++) {
      const v0 = clamp(u - 0.6 + (i / 24) * 0.6);
      const v1 = clamp(u - 0.6 + ((i + 1) / 24) * 0.6);
      const [x0, y0] = at(v0);
      const [x1, y1] = at(v1);
      line(f, x0, y0, x1, y1, alpha(i > 18 ? f.brand : f.ink, (i / 24) * 0.9), f.lw * (0.4 + (i / 24) * 2));
    }
    const [x, y] = at(u);
    circle(f, x, y, s * (0.035 + 0.02 * f.level), { fill: f.brand });
  },

  // A designed reverse swell: particles rushing inward to one point.
  "es-pro-whoosh-big-reverse": (f) => {
    const { cx, cy, s, t } = f;
    const k = ease(t * 1.1);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + rand(i, 1) * 0.3;
      const r = s * (0.08 + (0.4 + 0.1 * rand(i, 2)) * (1 - k));
      const tail = s * 0.12 * (0.3 + f.level);
      const x = cx + Math.cos(a) * r * 1.4;
      const y = cy + Math.sin(a) * r;
      line(f, x, y, x + Math.cos(a) * tail * 1.4, y + Math.sin(a) * tail, alpha(i % 3 ? f.ink : f.brand, 0.3 + 0.6 * k));
      circle(f, x, y, s * 0.01, { fill: i % 3 ? f.ink : f.brand });
    }
    circle(f, cx, cy, s * (0.03 + 0.06 * k * f.level), { fill: f.brand });
  },

  // A designed swell: a vortex winding up.
  "es-pro-whoosh-big-swell": (f) => {
    const { cx, cy, s, t } = f;
    const grow = 0.35 + 0.65 * ease(t * 1.2);
    for (let arm = 0; arm < 2; arm++) {
      const pts: number[][] = [];
      for (let i = 0; i <= 120; i++) {
        const v = i / 120;
        const a = v * TAU * 2.6 + f.time * 4 + t * 6 + arm * Math.PI;
        const r = s * (0.02 + 0.4 * v) * grow;
        pts.push([cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r]);
      }
      poly(f, pts, arm ? alpha(f.brand, 0.9) : alpha(f.ink, 0.7), f.lw * (0.8 + 0.6 * f.level));
    }
  },

  // A designed tonal swell: a sine sweep gliding up on a scope screen.
  "es-pro-whoosh-big-tonal": (f) => {
    const { cy, s, t, w, h } = f;
    const x0 = w * 0.12;
    const x1 = w * 0.88;
    rrect(f, x0, h * 0.14, x1 - x0, h * 0.72, s * 0.04);
    for (let i = 1; i < 6; i++) line(f, lerp(x0, x1, i / 6), h * 0.16, lerp(x0, x1, i / 6), h * 0.84, alpha(f.ink, 0.08));
    line(f, x0, cy, x1, cy, alpha(f.ink, 0.15));
    wave(f, x0 + s * 0.04, x1 - s * 0.04, cy, (u) => s * 0.22 * (0.3 + 0.7 * f.level) * Math.sin(u * Math.PI), (u) => (1 + 5 * u) * (0.6 + t), -f.time * 20, f.brand, f.lw * 1.3);
  },

  // A designed windy swell: wind lines tumbling in loops.
  "es-pro-whoosh-big-windy": (f) => {
    const { h, s, t } = f;
    for (let j = 0; j < 3; j++) {
      const y0 = h * (0.3 + j * 0.2);
      const head = ease(t * 1.2 + j * 0.05);
      const pts: number[][] = [];
      for (let i = 0; i <= 80; i++) {
        const v = (i / 80) * head;
        const phi = v * TAU * 2.2 + j + f.time * 2;
        const b = s * (0.04 + 0.02 * j);
        pts.push([X(f, v) - Math.sin(phi) * b * 1.3, y0 - Math.cos(phi) * b]);
      }
      poly(f, pts, j === 1 ? f.brand : alpha(f.ink, 0.6), f.lw * (0.8 + 0.5 * f.level));
    }
  },

  // A big cape whooshing out behind a hero standing tall.
  "es-whoosh-big-cape": (f) => {
    const { s, w, h } = f;
    const hx = w * 0.3;
    const sh = h * 0.32;
    const flap = f.playing ? Math.sin(f.time * 8) * (0.4 + f.level) : 0.6;
    const L = w * (0.36 + 0.06 * Math.sin(flap * 1.5 + f.t * 3));
    const tipY = sh + s * (0.06 + 0.06 * Math.sin(flap * 2));
    const cape = (c: CanvasRenderingContext2D) => {
      c.moveTo(hx - s * 0.08, sh);
      c.lineTo(hx + s * 0.08, sh);
      c.quadraticCurveTo(hx + L * 0.55, sh - s * 0.1 * (0.5 + 0.5 * Math.sin(flap)), hx + L, tipY);
      for (let i = 1; i <= 4; i++) {
        const u = i / 4;
        const x = lerp(hx + L, hx + s * 0.06, u);
        const y = lerp(tipY, h * 0.78, u) + s * 0.035 * Math.sin(flap * 3 + i * 1.7);
        c.quadraticCurveTo(x + s * 0.06, y - s * 0.07, x, y);
      }
      c.closePath();
    };
    fill(f, cape, alpha(f.brand, 0.3));
    stroke(f, cape, f.brand);
    for (let i = 1; i < 3; i++) line(f, hx + s * 0.08, sh + s * 0.02, lerp(hx + L, hx + s * 0.06, i / 3) - s * 0.02, lerp(tipY, h * 0.78, i / 3), alpha(f.brand, 0.45));
    const body = (c: CanvasRenderingContext2D) => {
      c.moveTo(hx - s * 0.1, sh);
      c.lineTo(hx + s * 0.1, sh);
      c.lineTo(hx + s * 0.13, sh + s * 0.12);
      c.lineTo(hx + s * 0.07, sh + s * 0.18);
      c.lineTo(hx + s * 0.06, h * 0.56);
      c.lineTo(hx + s * 0.08, h * 0.88);
      c.lineTo(hx + s * 0.02, h * 0.88);
      c.lineTo(hx, h * 0.62);
      c.lineTo(hx - s * 0.02, h * 0.88);
      c.lineTo(hx - s * 0.08, h * 0.88);
      c.lineTo(hx - s * 0.06, h * 0.56);
      c.lineTo(hx - s * 0.07, sh + s * 0.18);
      c.lineTo(hx - s * 0.13, sh + s * 0.12);
      c.closePath();
    };
    fill(f, body, f.ink);
    rrect(f, hx - s * 0.025, sh - s * 0.05, s * 0.05, s * 0.06, s * 0.01, { fill: f.ink });
    circle(f, hx, sh - s * 0.1, s * 0.065, { fill: f.ink });
    fill(f, (c) => {
      c.moveTo(hx, sh + s * 0.04);
      c.lineTo(hx + s * 0.04, sh + s * 0.08);
      c.lineTo(hx, sh + s * 0.12);
      c.lineTo(hx - s * 0.04, sh + s * 0.08);
      c.closePath();
    }, f.brand);
    speedLines(f, hx + L + s * 0.06, tipY + s * 0.12, Math.PI, s * 0.18, s * 0.22, 3, 0.4 + 0.6 * f.level);
  },

  // Big and deep: a ringed planet sliding past through the stars.
  "es-whoosh-big-deep": (f) => {
    const { ctx, s, w, h, cy } = f;
    const u = easeInOut(f.t * 1.1);
    for (let i = 0; i < 8; i++) {
      const x = w * (0.1 + 0.8 * frac(rand(i, 1) - u * 0.15));
      sparkle(f, x, h * (0.14 + 0.72 * rand(i, 2)), s * 0.012 * (1 + rand(i, 3)), alpha(f.ink, 0.45));
    }
    const r = s * 0.2;
    const rx = r * 1.6;
    const px = lerp(w * 0.1 + rx, w * 0.9 - rx, u);
    const ring = (a0: number, a1: number) => stroke(f, (c) => c.ellipse(px, cy, rx, r * 0.34, -0.2, a0, a1), f.brand, f.lw * 1.4);
    ring(Math.PI, TAU);
    circle(f, px, cy, r, { fill: alpha(f.brand, 0.12), stroke: f.ink, width: f.lw * 1.4 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, cy, r, 0, TAU);
    ctx.clip();
    for (let i = 1; i < 4; i++) {
      const y = cy - r + (2 * r * i) / 4;
      stroke(f, (c) => {
        c.moveTo(px - r, y);
        c.quadraticCurveTo(px, y + r * 0.18, px + r, y);
      }, alpha(f.ink, 0.25));
    }
    ctx.restore();
    ring(0, Math.PI);
    speedLines(f, px - rx - s * 0.02, cy, 0, s * 0.2, r, 3, 0.3 + 0.7 * bump(f.t, 0.45, 0.45));
  },

  // A big gust: grass bends while leaves tumble across.
  "es-whoosh-big-gust": (f) => {
    const { h, s, t } = f;
    const gy = h * 0.88;
    const gust = (0.3 + 0.7 * bump(t, 0.45, 0.5)) * (0.5 + f.level);
    for (let i = 0; i < 16; i++) {
      const x = X(f, i / 15);
      const L = s * (0.16 + 0.1 * rand(i, 1));
      const bend = gust * 0.9 + (f.playing ? Math.sin(f.time * 9 + i) * 0.1 : 0);
      stroke(f, (c) => {
        c.moveTo(x, gy);
        c.quadraticCurveTo(x, gy - L * 0.6, x + Math.sin(bend) * L, gy - Math.cos(bend) * L);
      }, alpha(f.ink, 0.6));
    }
    for (let i = 0; i < 4; i++) {
      const u = clamp(t * 1.1 + i * 0.12 - 0.1);
      leaf(f, X(f, u), h * (0.25 + i * 0.12) + Math.sin(u * 9 + i) * s * 0.05, s * 0.055, u * 14 + i, i % 2 ? f.brand : f.ink);
    }
    speedLines(f, X(f, 0.95), h * 0.3, 0, s * 0.4, s * 0.25, 3, gust * 0.6);
  },

  // A jet flies by, drawing contrails.
  "es-whoosh-big-jet": (f) => {
    const { h, s } = f;
    const u = easeInOut(f.t * 1.1);
    const x = X(f, 0.2 + 0.72 * u);
    const y = h * (0.62 - 0.3 * u);
    const ang = -0.38;
    for (const d of [-1, 1]) {
      const sx = x - s * 0.06;
      const sy = y + d * s * 0.04;
      for (let i = 0; i < 10; i++) {
        const a0 = s * 0.06 * i;
        line(f, sx - Math.cos(ang) * a0, sy - Math.sin(ang) * a0, sx - Math.cos(ang) * (a0 + s * 0.05), sy - Math.sin(ang) * (a0 + s * 0.05), alpha(f.ink, 0.5 * (1 - i / 10)), f.lw * (1 + i * 0.25));
      }
    }
    withT(f, x, y, ang, 1, () => {
      const body = (c: CanvasRenderingContext2D) => {
        c.moveTo(s * 0.16, 0);
        c.quadraticCurveTo(s * 0.12, -s * 0.025, 0, -s * 0.025);
        c.lineTo(-s * 0.13, -s * 0.02);
        c.lineTo(-s * 0.17, -s * 0.09);
        c.lineTo(-s * 0.13, 0);
        c.lineTo(-s * 0.13, s * 0.02);
        c.lineTo(0, s * 0.025);
        c.quadraticCurveTo(s * 0.12, s * 0.025, s * 0.16, 0);
        c.moveTo(s * 0.04, -s * 0.02);
        c.lineTo(-s * 0.04, -s * 0.14);
        c.lineTo(-s * 0.06, -s * 0.02);
        c.moveTo(s * 0.04, s * 0.02);
        c.lineTo(-s * 0.04, s * 0.14);
        c.lineTo(-s * 0.06, s * 0.02);
      };
      fill(f, body, alpha(f.brand, 0.3));
      stroke(f, body);
    });
  },

  // A big reverse: everything sucked into a swirling portal.
  "es-whoosh-big-reverse": (f) => {
    const { ctx, h, s, t } = f;
    const px = X(f, 0.75);
    const py = h * 0.5;
    for (let i = 0; i < 3; i++) stroke(f, (c) => c.ellipse(px, py, s * (0.08 + 0.05 * i), s * (0.16 + 0.08 * i), 0, f.time * (2 + i) + i, f.time * (2 + i) + i + Math.PI * 1.4), alpha(i ? f.ink : f.brand, 0.8 - i * 0.2));
    ctx.setLineDash([f.s * 0.05, f.s * 0.04]);
    ctx.lineDashOffset = -(t * s * 3 + f.time * s * 0.8);
    for (let i = 0; i < 4; i++) {
      const y0 = h * (0.2 + 0.2 * i);
      stroke(f, (c) => {
        c.moveTo(X(f, 0), y0);
        c.quadraticCurveTo(X(f, 0.45), y0, px, py);
      }, alpha(f.ink, 0.35));
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) {
      const u = frac(t * 1.5 + i / 3);
      const y0 = h * (0.25 + 0.25 * i);
      const x = lerp(X(f, 0.05), px, u);
      const y = lerp(y0, py, u * u);
      const q = s * 0.06 * (1 - u);
      withT(f, x, y, u * 6, 1, () => rrect(f, -q / 2, -q / 2, q, q, q * 0.2, { fill: i === 1 ? f.brand : alpha(f.ink, 0.7) }));
    }
  },

  // A big swell of wind: a sailboat's sail fills and bellies out.
  "es-whoosh-big-swell": (f) => {
    const { h, s, t } = f;
    const wy = h * 0.8;
    const gust = clamp(0.25 + 0.75 * (f.playing ? f.level : 0.7));
    wave(f, X(f, 0), X(f, 1), wy, s * 0.012, 7, -f.time * 3, alpha(f.ink, 0.5));
    speedLines(f, X(f, 0.22), h * 0.35, 0, s * 0.3, s * 0.3, 4, gust);
    const bx = X(f, 0.42 + 0.14 * easeInOut(t));
    withT(f, bx, wy, gust * 0.12, 1, () => {
      const hull = (c: CanvasRenderingContext2D) => {
        c.moveTo(-s * 0.26, -s * 0.05);
        c.lineTo(s * 0.28, -s * 0.05);
        c.quadraticCurveTo(s * 0.2, s * 0.04, s * 0.12, s * 0.04);
        c.lineTo(-s * 0.18, s * 0.04);
        c.closePath();
      };
      fill(f, hull, alpha(f.ink, 0.12));
      stroke(f, hull);
      const top = -s * 0.6;
      const boom = -s * 0.1;
      line(f, 0, -s * 0.05, 0, top - s * 0.02, f.ink, f.lw * 1.3);
      line(f, 0, boom, s * 0.3, boom);
      const belly = s * (0.03 + 0.13 * gust);
      const len = Math.hypot(s * 0.3, boom - top);
      const nx = (boom - top) / len;
      const ny = -(s * 0.3) / len;
      const sail = (c: CanvasRenderingContext2D) => {
        c.moveTo(0, top);
        c.quadraticCurveTo(s * 0.15 + nx * belly * 2, (top + boom) / 2 + ny * belly * 2, s * 0.3, boom);
        c.quadraticCurveTo(s * 0.15, boom + belly * 0.3, 0, boom);
        c.closePath();
      };
      fill(f, sail, alpha(f.brand, 0.3));
      stroke(f, sail, f.brand);
      for (let i = 1; i < 3; i++) line(f, 0, lerp(top, boom, i / 3), s * 0.08 + nx * belly * 0.6 * i, lerp(top, boom, i / 3) + s * 0.02, alpha(f.brand, 0.5));
      const flutter = f.playing ? Math.sin(f.time * 20) * s * 0.01 : 0;
      fill(f, (c) => {
        c.moveTo(0, top - s * 0.02);
        c.lineTo(s * (0.06 + 0.04 * gust), top + flutter);
        c.lineTo(0, top + s * 0.03);
        c.closePath();
      }, f.ink);
    });
  },

  // A big low whoosh that lands with a thump: a meteor strikes the ground.
  "es-whoosh-big-thump": (f) => {
    const { h, s, t } = f;
    const gy = h * 0.84;
    const [dx, dy] = shake(f, 0.025);
    const r = s * 0.06;
    const ex = X(f, 0.62);
    const k = clamp(t / 0.5);
    const p = easeIn(k);
    const hit = clamp((t - 0.5) / 0.5);
    const crater = hit > 0 ? s * 0.03 : 0;
    poly(f, [[X(f, 0), gy + dy], [ex - s * 0.14 + dx, gy + dy], [ex + dx, gy + crater + dy], [ex + s * 0.14 + dx, gy + dy], [X(f, 1), gy + dy]]);
    if (hit <= 0) {
      const x = lerp(X(f, 0.05), ex, p);
      const y = lerp(h * 0.1, gy - r, p);
      const dir = Math.atan2(gy - r - h * 0.1, ex - X(f, 0.05));
      for (let i = 1; i <= 5; i++) line(f, x - Math.cos(dir) * r * i * 0.9, y - Math.sin(dir) * r * i * 0.9, x - Math.cos(dir) * r * (i + 1) * 0.9, y - Math.sin(dir) * r * (i + 1) * 0.9, alpha(f.brand, 1 - i / 6), f.lw * (3.5 - i * 0.5));
      circle(f, x, y, r, { fill: f.ink });
    } else {
      circle(f, ex + dx, gy - r * 0.4 + dy, r * 0.8, { fill: f.ink });
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1;
        circle(f, ex + side * s * (0.06 + 0.12 * ease(hit)) * (1 + i * 0.3), gy - s * 0.05 * (1 + i * 0.4) * ease(hit), s * (0.03 + 0.03 * ease(hit)), { stroke: alpha(f.ink, 1 - hit) });
      }
      burst(f, ex, gy - r, s * 0.08, s * 0.24, 8, hit, f.brand);
    }
  },

  // The thump-whoosh, airier: a paper plane swoops down and lands in a puff.
  "es-whoosh-big-thump-airy": (f) => {
    const { h, s, t } = f;
    const gy = h * 0.82;
    line(f, X(f, 0), gy, X(f, 1), gy, alpha(f.ink, 0.35));
    const k = clamp(t / 0.6);
    const at = (u: number) => [X(f, 0.08 + 0.62 * u), lerp(h * 0.18, gy - s * 0.03, Math.sin((u * Math.PI) / 2) ** 0.7)];
    const pts: number[][] = [];
    for (let i = 0; i <= 20; i++) pts.push(at((i / 20) * ease(k)));
    f.ctx.setLineDash([s * 0.02, s * 0.03]);
    poly(f, pts, alpha(f.ink, 0.35));
    f.ctx.setLineDash([]);
    const u = ease(k);
    const [x, y] = at(u);
    const [x2, y2] = at(Math.min(1, u + 0.02));
    withT(f, x, y, Math.atan2(y2 - y, x2 - x || 1) * (1 - clamp((t - 0.6) * 4)), 1, () => {
      const plane = (c: CanvasRenderingContext2D) => {
        c.moveTo(s * 0.12, 0);
        c.lineTo(-s * 0.1, -s * 0.07);
        c.lineTo(-s * 0.05, 0);
        c.lineTo(-s * 0.1, s * 0.04);
        c.closePath();
      };
      fill(f, plane, alpha(f.brand, 0.3));
      stroke(f, plane);
      line(f, s * 0.12, 0, -s * 0.05, 0, alpha(f.ink, 0.6));
    });
    const hit = clamp((t - 0.6) / 0.4);
    if (hit > 0) for (let i = 0; i < 3; i++) circle(f, x + (i - 1) * s * 0.1 * (0.5 + hit), gy - s * 0.03 - s * 0.03 * hit, s * (0.02 + 0.04 * hit), { stroke: alpha(f.ink, 1 - hit) });
  },

  // The thump-whoosh, deeper: a heavy safe drops and slams down in a cloud of dust.
  "es-whoosh-big-thump-deep": (f) => {
    const { cx, h, s, t } = f;
    const gy = h * 0.86;
    const [dx, dy] = shake(f, 0.03);
    const sw = s * 0.34;
    const sh = s * 0.38;
    const fall = easeIn(clamp(t / 0.45));
    const hit = clamp((t - 0.45) / 0.55);
    const squash = 0.08 * bump(hit, 0.05, 0.2);
    const y = lerp(h * 0.04, gy - sh, fall);
    const rot = hit > 0 ? 0 : 0.12 * (1 - fall);
    line(f, X(f, 0), gy + dy, X(f, 1), gy + dy);
    if (hit <= 0) speedLines(f, cx, y, -Math.PI / 2, s * 0.3, sw * 0.8, 4, fall);
    withT(f, cx + dx, y + sh + dy, rot, 1, () => {
      f.ctx.scale(1 + squash, 1 - squash);
      rrect(f, -sw / 2, -sh, sw, sh * 0.94, s * 0.02, { fill: alpha(f.ink, 0.1), stroke: f.ink, width: f.lw * 1.5 });
      rrect(f, -sw * 0.38, -sh * 0.88, sw * 0.76, sh * 0.74, s * 0.012, { stroke: alpha(f.ink, 0.6) });
      circle(f, -sw * 0.06, -sh * 0.52, sw * 0.14, { stroke: f.brand, width: f.lw * 1.3 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + f.t * 4;
        line(f, -sw * 0.06 + Math.cos(a) * sw * 0.1, -sh * 0.52 + Math.sin(a) * sw * 0.1, -sw * 0.06 + Math.cos(a) * sw * 0.14, -sh * 0.52 + Math.sin(a) * sw * 0.14, f.brand);
      }
      line(f, sw * 0.22, -sh * 0.62, sw * 0.22, -sh * 0.42, f.ink, f.lw * 2);
      rrect(f, -sw * 0.44, -sh * 0.06, sw * 0.14, sh * 0.06, 2, { fill: f.ink });
      rrect(f, sw * 0.3, -sh * 0.06, sw * 0.14, sh * 0.06, 2, { fill: f.ink });
    });
    if (hit > 0) {
      for (let i = 0; i < 5; i++) {
        for (const d of [-1, 1]) {
          const k = ease(hit);
          const x = cx + d * (sw / 2 + s * (0.02 + 0.07 * i) * (0.4 + k));
          const yy = gy - s * (0.03 + 0.025 * (i % 3)) * (0.5 + k);
          circle(f, x, yy, s * (0.025 + 0.02 * k) * (1 - i * 0.12), { fill: alpha(f.ink, 0.12 * (1 - hit)), stroke: alpha(f.ink, 0.6 * (1 - hit)) });
        }
      }
    }
  },

  // A fast crisp whip pan: a strip of frames blurs past.
  "es-whoosh-fast-crisp": (f) => {
    const { cy, s, t } = f;
    const fw = s * 0.5;
    const fh = s * 0.38;
    const blur = bump(t, 0.35, 0.35) * (0.4 + 0.6 * f.level);
    const off = -ease(t * 1.4) * (fw + s * 0.06) * 2;
    for (let i = 0; i < 5; i++) {
      const x = f.w * 0.1 + i * (fw + s * 0.06) + off;
      if (x > f.w * 0.92 || x + fw < f.w * 0.08) continue;
      rrect(f, x, cy - fh / 2, fw, fh, s * 0.02, { stroke: alpha(f.ink, 0.85) });
      circle(f, x + fw * 0.72, cy - fh * 0.2, s * 0.03, { fill: i % 2 ? f.brand : alpha(f.ink, 0.5) });
      poly(f, [[x + fw * 0.08, cy + fh * 0.38], [x + fw * 0.35, cy - fh * 0.05], [x + fw * 0.55, cy + fh * 0.2], [x + fw * 0.92, cy + fh * 0.38]], alpha(f.ink, 0.6));
      for (let j = 0; j < 4; j++) line(f, x - fw * 0.1, cy - fh * 0.35 + j * fh * 0.23, x + fw * (1.1 + blur), cy - fh * 0.35 + j * fh * 0.23, alpha(f.ink, blur * 0.5));
    }
  },

  // A fast heavy whoosh: an iron block flying past.
  "es-whoosh-fast-heavy": (f) => {
    const { cy, s, t } = f;
    const q = s * 0.3;
    const x = X(f, 0.18 + 0.64 * ease(t * 1.3));
    speedLines(f, x - q * 0.6, cy, 0, s * 0.6, q * 0.9, 6, 0.4 + 0.6 * f.level);
    withT(f, x, cy, -0.08 + t * 0.12, 1, () => {
      rrect(f, -q / 2, -q / 2, q, q, q * 0.08, { fill: alpha(f.ink, 0.9) });
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) circle(f, (a * q) / 3, (b * q) / 3, q * 0.04, { fill: f.brand });
    });
    stroke(f, (c) => c.ellipse(x, cy + s * 0.32, q * 0.6, s * 0.02, 0, 0, TAU), alpha(f.ink, 0.25));
  },

  // A fast reverse whoosh: something flies back right to left, with a rewind sign.
  "es-whoosh-fast-reverse": (f) => {
    const { cy, s, t } = f;
    const x = X(f, 0.82 - 0.64 * ease(t * 1.3));
    const r = s * 0.08;
    speedLines(f, x + r, cy, Math.PI, s * 0.5, r * 1.6, 4, 0.4 + 0.6 * f.level);
    circle(f, x, cy, r, { stroke: f.ink, width: f.lw * 1.4 });
    stroke(f, (c) => c.arc(x, cy, r * 0.55, -Math.PI * 0.2, Math.PI * 1.2), f.brand);
    const ix = X(f, 0.12);
    const iy = f.h * 0.22;
    const g = f.playing ? 0.4 + 0.6 * f.level : 1;
    for (let i = 0; i < 2; i++) {
      fill(f, (c) => {
        c.moveTo(ix + i * s * 0.07, iy);
        c.lineTo(ix + i * s * 0.07 + s * 0.07, iy - s * 0.045);
        c.lineTo(ix + i * s * 0.07 + s * 0.07, iy + s * 0.045);
        c.closePath();
      }, alpha(f.brand, g));
    }
  },

  // A fast sleeve whoosh: an arm in a sleeve swings through.
  "es-whoosh-fast-sleeve": (f) => {
    const { s, w, h } = f;
    const px = w * 0.42;
    const py = h * 0.2;
    const L = s * 0.5;
    const a = lerp(Math.PI * 0.82, Math.PI * 0.1, easeInOut(f.t * 1.2));
    motionArc(f, px, py, L * 1.05, a, 0.8);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const nx = -dy * s * 0.05;
    const ny = dx * s * 0.05;
    const ex = px + dx * L * 0.85;
    const ey = py + dy * L * 0.85;
    const tube = (c: CanvasRenderingContext2D) => {
      c.moveTo(px + nx * 1.2, py + ny * 1.2);
      c.lineTo(ex + nx, ey + ny);
      c.lineTo(ex - nx, ey - ny);
      c.lineTo(px - nx * 1.2, py - ny * 1.2);
    };
    fill(f, tube, alpha(f.brand, 0.18));
    stroke(f, tube);
    for (let i = 1; i < 4; i++) {
      const u = i / 4.5;
      const fx = px + dx * L * 0.85 * u;
      const fy = py + dy * L * 0.85 * u;
      line(f, fx + nx * 0.8, fy + ny * 0.8, fx + dx * s * 0.03 - nx * 0.2, fy + dy * s * 0.03 - ny * 0.2, alpha(f.ink, 0.4));
    }
    line(f, ex + nx * 1.1, ey + ny * 1.1, ex - nx * 1.1, ey - ny * 1.1, f.ink, f.lw * 2);
    circle(f, px + dx * L, py + dy * L, s * 0.045, { fill: f.brand });
    circle(f, px, py, s * 0.06);
  },

  // A fast tight whoosh: a dart thrown into a board.
  "es-whoosh-fast-tight": (f) => {
    const { cy, s, t } = f;
    const bx = X(f, 0.85);
    for (let i = 3; i >= 1; i--) circle(f, bx, cy, s * 0.08 * i, { stroke: i === 1 ? f.brand : f.ink });
    const k = clamp(t / 0.45);
    const tipX = lerp(X(f, 0.2), bx - s * 0.02, easeIn(k));
    const wob = k >= 1 ? Math.sin((t - 0.45) * 60) * 0.25 * (1 - clamp((t - 0.45) * 2.5)) : 0;
    if (k < 1) speedLines(f, tipX - s * 0.3, cy, 0, s * 0.35, s * 0.08, 3, k);
    withT(f, tipX, cy, wob, 1, () => {
      line(f, 0, 0, -s * 0.06, 0, f.ink, f.lw * 0.8);
      rrect(f, -s * 0.2, -s * 0.022, s * 0.14, s * 0.044, s * 0.02, { fill: f.ink });
      line(f, -s * 0.2, 0, -s * 0.28, 0, f.ink);
      fill(f, (c) => {
        c.moveTo(-s * 0.24, 0);
        c.lineTo(-s * 0.32, -s * 0.06);
        c.lineTo(-s * 0.32, s * 0.06);
        c.closePath();
      }, f.brand);
    });
  },

  // A designed bright whip: a whip's wave runs to the tip and cracks.
  "es-whoosh-fast-whip": (f) => {
    const { h, s, t } = f;
    const hx = X(f, 0.04);
    const hy = h * 0.72;
    withT(f, hx, hy, -0.5, 1, () => rrect(f, -s * 0.02, -s * 0.02, s * 0.16, s * 0.04, s * 0.02, { fill: f.ink }));
    const sx = hx + s * 0.13;
    const sy = hy - s * 0.07;
    const ex = X(f, 0.92);
    const ey = h * 0.36;
    const pk = ease(t * 1.5);
    const pts: number[][] = [];
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      const d = (u - pk) / 0.12;
      const disp = Math.exp(-d * d) * Math.sin(u * 24) * s * 0.1 * (0.5 + f.level) * (1 - u * 0.4);
      pts.push([lerp(sx, ex, u), lerp(sy, ey, u) + Math.sin(u * Math.PI) * s * 0.12 + disp]);
    }
    poly(f, pts, f.ink, f.lw * 1.3);
    const crack = clamp((t - 0.55) / 0.4);
    burst(f, ex, ey, s * 0.03, s * 0.16, 9, crack, f.brand);
    if (crack > 0 && crack < 0.5) sparkle(f, ex, ey, s * 0.07 * (1 - crack * 2), f.brand);
  },

  // A whistling fly-in: a firework rocket climbs on a spiral trail and pops.
  "es-whoosh-fast-whistle": (f) => {
    const { cx, h, s, t } = f;
    const k = ease(clamp(t / 0.75));
    const at = (u: number) => [lerp(cx - s * 0.45, cx + s * 0.25, u), lerp(h * 0.9, h * 0.24, u)];
    const pts: number[][] = [];
    for (let i = 0; i <= 50; i++) {
      const u = (i / 50) * k;
      const [x, y] = at(u);
      const wig = Math.sin(u * 40 - f.time * 20) * s * 0.025 * (u / Math.max(k, 0.01));
      pts.push([x + wig, y + wig * 0.4]);
    }
    poly(f, pts, alpha(f.brand, 0.8));
    const [x, y] = at(k);
    const ang = Math.atan2(h * 0.24 - h * 0.9, s * 0.7);
    withT(f, x, y, ang, 1, () => {
      rrect(f, -s * 0.09, -s * 0.025, s * 0.09, s * 0.05, s * 0.01, { stroke: f.ink });
      fill(f, (c) => {
        c.moveTo(0, -s * 0.025);
        c.lineTo(s * 0.05, 0);
        c.lineTo(0, s * 0.025);
        c.closePath();
      }, f.brand);
    });
    burst(f, x, y, s * 0.04, s * 0.2, 10, clamp((t - 0.75) / 0.25), f.brand);
  },
};
