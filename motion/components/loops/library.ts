// Agentcut's motion loop library: original seamless loops (12 s, every period divides 12) drawn on a
// 2D canvas from the brand palette. Backgrounds fill the frame; shapes are one centered subject.
import type { LoopCategory, LoopDef, LoopDraw, LoopPalette } from "./engine";
import { LOOPS_MORE } from "./library2";

/** Second motif colour that still reads in every tone. */
const second = (P: LoopPalette) => (P.tone === "accent" ? P.paper : P.fg2);

// ─── Backgrounds ─────────────────────────────────────────────────────────────────────────────────

const perspectiveGrid: LoopDraw = (ctx, w, h, t, P, M) => {
  const u = h / 100;
  const cx = w / 2;
  const hy = h * 0.4;
  const g = ctx.createRadialGradient(cx, hy, 0, cx, hy, w * 0.55);
  g.addColorStop(0, M.rgba(P.fg, 0.38));
  g.addColorStop(1, M.rgba(P.fg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const p = M.phase(t, 1.5);
  const depth = (z: number) => M.smoothstep(0.32, 0.7, z) * (1 - M.smoothstep(6, 16, z));
  ctx.lineWidth = Math.max(1, 0.22 * u);
  // Rows stream toward the camera: one row spacing per 1.5 s.
  for (let k = 0; k < 40; k++) {
    const z = 0.3 + (k + 1 - p) * 0.45;
    const y = hy + (h * 0.5) / z;
    if (y > h + 2) continue;
    ctx.strokeStyle = M.rgba(P.fg, 0.75 * depth(z));
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Rails toward the vanishing point, faded into the horizon in depth segments.
  const zs = [0.3, 0.5, 0.8, 1.3, 2.2, 4, 8, 16];
  for (let i = -26; i <= 26; i++) {
    for (let s = 0; s < zs.length - 1; s++) {
      const a = zs[s];
      const b = zs[s + 1];
      ctx.strokeStyle = M.rgba(P.fg, 0.55 * depth((a + b) / 2));
      ctx.beginPath();
      ctx.moveTo(cx + (i * w * 0.09) / a, hy + (h * 0.5) / a);
      ctx.lineTo(cx + (i * w * 0.09) / b, hy + (h * 0.5) / b);
      ctx.stroke();
    }
  }
};

const dotWave: LoopDraw = (ctx, w, h, t, P, M) => {
  const cols = 34;
  const s = w / cols;
  const rows = Math.ceil(h / s) + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * s;
      const y = (j + 0.5) * s;
      const v = 0.5 + 0.5 * Math.sin(M.TAU * (t / 4) - (x / w) * 7 - (y / h) * 4);
      ctx.fillStyle = M.mixColor(P.mid, P.fg, v);
      ctx.beginPath();
      ctx.arc(x, y, s * (0.06 + 0.32 * M.ease.inOutSine(v)), 0, M.TAU);
      ctx.fill();
    }
  }
};

const flowLines: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const u = h / 100;
  const n = 16;
  const periods = [3, 4, 6, 12];
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const y0 = (h * (i + 0.5)) / n;
    const T = periods[Math.floor(M.rand(i, seed + 1) * periods.length)];
    const k = 1 + Math.floor(M.rand(i, seed + 2) * 3);
    const amp = u * (2 + 5 * M.rand(i, seed + 3)) * (0.7 + 0.3 * Math.sin(M.TAU * (t / 12) + i));
    ctx.strokeStyle = i % 5 === 2 ? M.rgba(second(P), 0.9) : M.rgba(P.fg, i % 2 ? 0.35 : 0.75);
    ctx.lineWidth = u * (i % 5 === 2 ? 0.6 : 0.3);
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 90) {
      const y = y0 + Math.sin(M.TAU * ((x / w) * k + M.phase(t, T)) + i) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

const gradientBlobs: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const colors = [P.fg, second(P), M.mixColor(P.fg, second(P), 0.5), P.fg, M.mixColor(P.bg, P.paper, 0.5)];
  colors.forEach((c, i) => {
    const a = 1 + Math.floor(M.rand(i, seed + 4) * 2);
    const b = 1 + Math.floor(M.rand(i, seed + 5) * 2);
    const x = w * (0.5 + 0.34 * Math.sin(M.TAU * (a * t) / 12 + M.rand(i, seed + 6) * M.TAU));
    const y = h * (0.5 + 0.32 * Math.cos(M.TAU * (b * t) / 12 + M.rand(i, seed + 7) * M.TAU));
    const r = Math.max(w, h) * (0.32 + 0.12 * M.loopNoise(t, i + seed * 7, 6));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, M.rgba(c, P.tone === "light" ? 0.45 : 0.6));
    g.addColorStop(1, M.rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
};

const stripesScroll: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = h / 9;
  const unit = s * 5;
  const off = M.phase(t, 3) * unit;
  const L = Math.hypot(w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  for (let x = -L - unit; x < L + unit; x += s) {
    const k = Math.round((x + L + unit) / s) % 5;
    ctx.fillStyle = k === 4 ? second(P) : k % 2 ? P.mid : P.bg;
    ctx.fillRect(x + off, -L, s + 1, 2 * L);
  }
  ctx.restore();
};

const concentricPulse: LoopDraw = (ctx, w, h, t, P, M) => {
  const u = h / 100;
  const cx = w / 2;
  const cy = h / 2;
  const d = h / 9;
  const p = M.phase(t, 1.5);
  const R = Math.hypot(w, h) / 2;
  for (let k = 0; k * d < R + d; k++) {
    const r = (k + p) * d;
    const fade = 1 - M.smoothstep(R * 0.4, R, r);
    // Colour follows the ring, not the slot, so the pattern doesn't jump each cycle.
    const hot = M.mod(k - Math.floor(t / 1.5), 4) === 0;
    ctx.strokeStyle = M.rgba(hot ? second(P) : P.fg, (hot ? 0.9 : 0.45) * fade * M.smoothstep(0, d, r));
    ctx.lineWidth = u * (hot ? 0.9 : 0.35);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, M.TAU);
    ctx.stroke();
  }
  const beat = M.ease.outBack(M.win(p, 0, 0.35)) * (1 - M.ease.inCubic(M.win(p, 0.6, 1)));
  ctx.fillStyle = P.fg;
  ctx.beginPath();
  ctx.arc(cx, cy, u * (2.5 + 2 * beat), 0, M.TAU);
  ctx.fill();
};

const checkerTwist: LoopDraw = (ctx, w, h, t, P, M) => {
  const cols = 14;
  const s = w / cols;
  const rows = Math.ceil(h / s);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * s;
      const y = (j + 0.5) * s;
      const p = M.phase(t, 3, -(i + j) * 0.035);
      const k = M.ease.inOutCubic(M.win(p, 0, 0.45));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((k * Math.PI) / 2);
      const sc = 1 - 0.32 * Math.sin(k * Math.PI);
      ctx.fillStyle = (i + j) % 2 ? P.fg : P.mid;
      ctx.fillRect((-s / 2) * sc * 0.92, (-s / 2) * sc * 0.92, s * sc * 0.92, s * sc * 0.92);
      ctx.restore();
    }
  }
};

const halftoneSweep: LoopDraw = (ctx, w, h, t, P, M) => {
  const cols = 44;
  const s = w / cols;
  const rows = Math.ceil(h / s) + 1;
  // Two bands half a cycle apart, so one is always crossing the frame.
  const bandAt = (o: number) => -0.35 + 1.7 * M.ease.inOutSine(M.phase(t, 4, o));
  const bands = [bandAt(0), bandAt(0.5)];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * s;
      const y = (j + 0.5) * s;
      const along = (x / w) * 0.75 + (y / h) * 0.25;
      const v = Math.max(...bands.map((b) => Math.exp(-((along - b) * (along - b)) / 0.012)));
      ctx.fillStyle = v > 0.5 ? second(P) : M.rgba(P.fg, 0.25 + 0.75 * v);
      ctx.beginPath();
      ctx.arc(x, y, s * (0.08 + 0.36 * v), 0, M.TAU);
      ctx.fill();
    }
  }
};

const terrainRidges: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const u = h / 100;
  const n = 26;
  const p = M.phase(t, 2);
  const cycle = Math.floor(t / 2);
  // Far to near; each ridge hides the ones behind it.
  for (let k = n; k >= 0; k--) {
    const depth = k + 1 - p;
    const y0 = h * 0.12 + (h * 0.95 * (n - depth)) / n;
    const id = M.mod(k + cycle, 6);
    const near = 1 - depth / n;
    ctx.beginPath();
    ctx.moveTo(-2, h + 2);
    for (let x = 0; x <= w; x += w / 120) {
      const c = Math.exp(-Math.pow((x - w / 2) / (w * 0.22), 2));
      const noise =
        Math.sin((x / w) * 19 + M.rand(id, seed + 1) * 6.28) * 0.5 +
        Math.sin((x / w) * 41 + M.rand(id, seed + 2) * 6.28) * 0.3 +
        Math.sin((x / w) * 77 + M.rand(id, seed + 3) * 6.28) * 0.2;
      ctx.lineTo(x, y0 - c * (4 + 10 * Math.abs(noise)) * u * (0.5 + near));
    }
    ctx.lineTo(w + 2, h + 2);
    ctx.closePath();
    ctx.fillStyle = P.bg;
    ctx.fill();
    ctx.strokeStyle = M.rgba(id === 3 ? second(P) : P.fg, M.smoothstep(0, 4, depth) * (1 - M.smoothstep(n - 4, n, depth)));
    ctx.lineWidth = u * 0.3;
    ctx.stroke();
  }
};

const starfieldWarp: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const u = h / 100;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h) * 0.6;
  ctx.lineCap = "round";
  for (let i = 0; i < 260; i++) {
    const a = M.rand(i, seed + 1) * M.TAU;
    const life = M.phase(t, 3, M.rand(i, seed + 2));
    const r = M.ease.inCubic(life) * R;
    const r0 = r * 0.82;
    ctx.strokeStyle = M.rgba(M.rand(i, seed + 3) > 0.8 ? second(P) : P.fg, M.smoothstep(0, 0.25, life));
    ctx.lineWidth = u * (0.15 + 0.5 * life);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
};

const bokehDrift: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const u = h / 100;
  for (let i = 0; i < 34; i++) {
    const speed = 1 + Math.floor(M.rand(i, seed + 1) * 2);
    const y = h * 1.15 - M.fract(M.rand(i, seed + 2) + (t / 12) * speed) * h * 1.3;
    const x = M.rand(i, seed + 3) * w + Math.sin(M.TAU * M.phase(t, 6) + i) * u * 3;
    const r = u * (2 + 9 * M.rand(i, seed + 4));
    const c = [P.fg, second(P), P.paper][i % 3];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, M.rgba(c, 0.5));
    g.addColorStop(0.7, M.rgba(c, 0.32));
    g.addColorStop(1, M.rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, M.TAU);
    ctx.fill();
  }
};

const isoCubes: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = w / 18;
  const top = M.mixColor(P.fg, P.paper, P.tone === "light" ? 0 : 0.25);
  const left = M.mixColor(P.fg, "#000000", 0.35);
  const right = M.mixColor(P.fg, "#000000", 0.6);
  const cols = 22;
  const rows = 22;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const ix = i - cols / 2;
      const iy = j - rows / 2;
      const x = w / 2 + (ix - iy) * s * 0.866;
      const y = h * 0.55 + (ix + iy) * s * 0.5;
      if (x < -s * 2 || x > w + s * 2 || y < -s * 3 || y > h + s * 3) continue;
      const d = Math.hypot(ix, iy);
      const lift = s * (0.4 + 1.1 * Math.pow(0.5 + 0.5 * Math.sin(M.TAU * (t / 4) - d * 0.7), 2));
      const yt = y - lift;
      ctx.fillStyle = left;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.866, yt);
      ctx.lineTo(x, yt + s * 0.5);
      ctx.lineTo(x, y + s * 0.5);
      ctx.lineTo(x - s * 0.866, y);
      ctx.fill();
      ctx.fillStyle = right;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.866, yt);
      ctx.lineTo(x, yt + s * 0.5);
      ctx.lineTo(x, y + s * 0.5);
      ctx.lineTo(x + s * 0.866, y);
      ctx.fill();
      ctx.fillStyle = (i * 7 + j * 3) % 11 === 0 ? second(P) : top;
      ctx.beginPath();
      ctx.moveTo(x, yt - s * 0.5);
      ctx.lineTo(x + s * 0.866, yt);
      ctx.lineTo(x, yt + s * 0.5);
      ctx.lineTo(x - s * 0.866, yt);
      ctx.fill();
    }
  }
};

const ribbonWeave: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const u = h / 100;
  const periods = [4, 6, 12, 6, 4];
  const colors = [P.fg, second(P), P.mid, P.fg, M.mixColor(P.fg, P.paper, 0.4)];
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const cy = h * (0.2 + 0.15 * i);
    const f = 0.6 + M.rand(i, seed + 1) * 0.9;
    ctx.strokeStyle = M.rgba(colors[i], 0.85);
    ctx.lineWidth = u * (3 + 4 * M.rand(i, seed + 2));
    ctx.beginPath();
    for (let x = -u * 10; x <= w + u * 10; x += w / 80) {
      const y = cy + Math.sin(M.TAU * ((x / w) * f + M.phase(t, periods[i])) + i * 1.3) * u * 9;
      if (x <= -u * 10) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
};

const tileMosaic: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const cols = 15;
  const s = w / cols;
  const rows = Math.ceil(h / s);
  const gap = s * 0.08;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const id = j * cols + i;
      const p = M.phase(t, 6, M.rand(id, seed + 1));
      const a = M.win(p, 0, 0.1);
      const b = M.win(p, 0.5, 0.6);
      const flipped = (a >= 0.5 ? 1 : 0) - (b >= 0.5 ? 1 : 0);
      const squash = Math.abs(Math.cos(Math.PI * (a < 1 ? a : b)));
      const base = M.rand(id, seed + 2) > 0.85 ? second(P) : P.mid;
      ctx.fillStyle = flipped ? P.fg : base;
      const hh = (s - gap) * squash;
      ctx.beginPath();
      ctx.roundRect(i * s + gap / 2, j * s + (s - hh) / 2, s - gap, hh, s * 0.18);
      ctx.fill();
    }
  }
};

// ─── Shapes ──────────────────────────────────────────────────────────────────────────────────────

const orbitRings: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const cy = h / 2;
  const rings = [
    { rx: 30, ry: 9, rot: -0.35, T: 3, c: P.fg },
    { rx: 36, ry: 13, rot: 0.5, T: 4, c: second(P) },
    { rx: 25, ry: 20, rot: 1.4, T: 6, c: P.mid },
  ];
  const drawRing = (front: boolean) => {
    rings.forEach((r, i) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(r.rot);
      ctx.strokeStyle = M.rgba(r.c, 0.7);
      ctx.lineWidth = s * 0.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r.rx * s, r.ry * s, 0, front ? 0 : Math.PI, front ? Math.PI : M.TAU);
      ctx.stroke();
      const a = M.TAU * M.phase(t, r.T, i * 0.3);
      if (Math.sin(a) >= 0 === front) {
        ctx.fillStyle = r.c;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r.rx * s, Math.sin(a) * r.ry * s, s * (2 + Math.sin(a)), 0, M.TAU);
        ctx.fill();
      }
      ctx.restore();
    });
  };
  drawRing(false);
  const R = s * (14 + 0.8 * Math.sin(M.TAU * M.phase(t, 3)));
  const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  g.addColorStop(0, M.mixColor(P.fg, P.paper, 0.55));
  g.addColorStop(1, P.fg);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, M.TAU);
  ctx.fill();
  drawRing(true);
};

const morphBlob: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const cy = h / 2;
  const R = s * 30;
  const rot = M.TAU * (t / 12);
  ctx.beginPath();
  for (let k = 0; k <= 120; k++) {
    const a = (k / 120) * M.TAU;
    const r =
      R *
      (1 +
        0.09 * Math.sin(2 * a + M.TAU * M.phase(t, 6) + M.rand(1, seed) * 6) +
        0.07 * Math.sin(3 * a - M.TAU * M.phase(t, 4) + M.rand(2, seed) * 6) +
        0.04 * Math.sin(5 * a + M.TAU * M.phase(t, 3) + M.rand(3, seed) * 6));
    const x = cx + Math.cos(a + rot) * r;
    const y = cy + Math.sin(a + rot) * r;
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  g.addColorStop(0, P.fg);
  g.addColorStop(1, second(P));
  ctx.fillStyle = g;
  ctx.fill();
  const hl = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.45, 0, cx - R * 0.35, cy - R * 0.45, R * 0.7);
  hl.addColorStop(0, M.rgba(P.paper, 0.45));
  hl.addColorStop(1, M.rgba(P.paper, 0));
  ctx.fillStyle = hl;
  ctx.fill();
};

const bouncingBall: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const ground = h / 2 + s * 24;
  const p = M.phase(t, 1.5);
  const air = 4 * p * (1 - p);
  const r = s * 9;
  const contact = 1 - M.smoothstep(0, 0.09, Math.min(p, 1 - p));
  const v = Math.abs(1 - 2 * p);
  const sy = 1 - 0.32 * contact + 0.18 * v * (1 - contact);
  const sx = 1 / Math.pow(sy, 0.75);
  const y = ground - r * sy - air * s * 38;
  ctx.fillStyle = M.rgba(P.tone === "light" ? P.ink : "#000000", 0.25 * (1 - 0.6 * air));
  ctx.beginPath();
  ctx.ellipse(cx, ground, r * (1.3 - 0.6 * air), r * 0.25 * (1 - 0.5 * air), 0, 0, M.TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.35, y - r * 0.4, r * 0.1, cx, y, r * 1.1);
  g.addColorStop(0, M.mixColor(P.fg, P.paper, 0.5));
  g.addColorStop(1, P.fg);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, y, r * sx, r * sy, 0, 0, M.TAU);
  ctx.fill();
};

const spinnerPetals: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const cy = h / 2;
  const p = M.phase(t, 1.5);
  const base = (M.TAU / 4) * (Math.floor(t / 1.5) + M.ease.inOutCubic(M.win(p, 0.1, 0.7)));
  const pulse = 0.85 + 0.15 * Math.sin(M.TAU * p);
  for (let k = 0; k < 8; k++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(base + (k * M.TAU) / 8);
    ctx.fillStyle = k % 2 ? second(P) : P.fg;
    ctx.beginPath();
    ctx.ellipse(0, -s * 16 * pulse, s * 5, s * 13 * pulse, 0, 0, M.TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = P.paper;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 5, 0, M.TAU);
  ctx.fill();
};

const stackedSquares: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const cy = h / 2;
  const colors = [P.mid, P.fg, second(P), P.paper];
  for (let i = 0; i < 4; i++) {
    const p = M.phase(t, 3, -i * 0.07);
    const turn = M.ease.outBack(M.win(p, 0.1, 0.55));
    const size = s * (44 - i * 10);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((turn * Math.PI) / 2 + Math.PI / 4);
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.14);
    ctx.fill();
    ctx.restore();
  }
};

const rippleDrop: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const cy = h / 2 + s * 8;
  const p = M.phase(t, 3);
  const fall = M.ease.inCubic(M.win(p, 0, 0.28));
  if (p < 0.28) {
    // Fade the drop in at the top so the loop point doesn't pop.
    ctx.fillStyle = M.rgba(P.fg, M.smoothstep(0, 0.08, p));
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 40 * (1 - fall), s * 2.2, s * (2.2 + 2 * fall), 0, 0, M.TAU);
    ctx.fill();
  }
  for (let k = 0; k < 3; k++) {
    const q = M.win(p, 0.28 + k * 0.08, 0.95);
    if (q <= 0 || q >= 1) continue;
    const r = M.ease.outCubic(q) * s * (34 - k * 6);
    ctx.strokeStyle = M.rgba(k === 1 ? second(P) : P.fg, 1 - q);
    ctx.lineWidth = s * (1.2 - k * 0.3);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, M.TAU);
    ctx.stroke();
  }
};

const cubeSpin: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const cy = h / 2 + Math.sin(M.TAU * M.phase(t, 3)) * s * 2;
  const a = M.TAU * (t / 6);
  const tilt = -0.5;
  const V = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])));
  const pts = V.map(([x, y, z]) => {
    const x1 = x * Math.cos(a) - z * Math.sin(a);
    const z1 = x * Math.sin(a) + z * Math.cos(a);
    const y1 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
    return { ...M.proj(x1 * s * 16, y1 * s * 16, z2 * 16 + 70, 70, cx, cy), z: z2 };
  });
  const faces = [
    [0, 1, 3, 2],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 3, 7, 5],
  ];
  // Shade from the motif colour toward black and white, so every face reads in every tone.
  const c = P.fg;
  const shades = [c, M.mixColor(c, "#000000", 0.3), second(P), M.mixColor(c, "#ffffff", 0.35), M.mixColor(c, "#000000", 0.5), M.mixColor(second(P), "#000000", 0.25)];
  faces
    .map((f, i) => ({ f, i, z: f.reduce((sum, k) => sum + pts[k].z, 0) / 4 }))
    .sort((p1, p2) => p2.z - p1.z)
    .forEach(({ f, i }) => {
      ctx.fillStyle = shades[i];
      ctx.strokeStyle = M.rgba(P.paper, 0.35);
      ctx.lineWidth = s * 0.3;
      ctx.beginPath();
      f.forEach((k, j) => (j ? ctx.lineTo(pts[k].x, pts[k].y) : ctx.moveTo(pts[k].x, pts[k].y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
};

const dnaHelix: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cy = h / 2;
  const n = 26;
  const span = Math.min(w * 0.8, s * 140);
  const x0 = w / 2 - span / 2;
  const items: { x: number; y: number; z: number; c: string; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 0.48 + M.TAU * M.phase(t, 3);
    const x = x0 + (i / (n - 1)) * span;
    const y1 = cy + Math.sin(a) * s * 14;
    const y2 = cy - Math.sin(a) * s * 14;
    ctx.strokeStyle = M.rgba(P.mid, 0.9);
    ctx.lineWidth = s * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    items.push({ x, y: y1, z: Math.cos(a), c: P.fg, r: s * (2 + Math.cos(a)) });
    items.push({ x, y: y2, z: -Math.cos(a), c: second(P), r: s * (2 - Math.cos(a)) });
  }
  items
    .sort((a, b) => a.z - b.z)
    .forEach((d) => {
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(d.x, d.y, Math.max(s * 0.6, d.r), 0, M.TAU);
      ctx.fill();
    });
};

const pieBurst: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const cx = w / 2;
  const cy = h / 2;
  const p = M.phase(t, 3);
  const out = M.ease.outBack(M.win(p, 0.08, 0.32)) * (1 - M.ease.inCubic(M.win(p, 0.62, 0.86)));
  // Half a turn per cycle: the three-colour pattern repeats every three slices.
  const rot = (M.TAU / 2) * (Math.floor(t / 3) + M.ease.inOutCubic(M.win(p, 0.62, 0.9)));
  const colors = [P.fg, second(P), P.mid];
  for (let k = 0; k < 6; k++) {
    const a0 = rot + (k * M.TAU) / 6;
    const mid = a0 + M.TAU / 12;
    const d = out * s * 6;
    ctx.fillStyle = colors[k % 3];
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(mid) * d, cy + Math.sin(mid) * d);
    ctx.arc(cx + Math.cos(mid) * d, cy + Math.sin(mid) * d, s * 26, a0, a0 + M.TAU / 6);
    ctx.closePath();
    ctx.fill();
  }
};

const waveBars: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const n = 26;
  const span = Math.min(w * 0.82, s * 150);
  const bw = span / n;
  const cy = h / 2;
  for (let i = 0; i < n; i++) {
    const env = Math.sin((Math.PI * (i + 0.5)) / n);
    const v = (0.5 + 0.5 * Math.sin(M.TAU * M.phase(t, 1.5) - i * 0.55)) * (0.7 + 0.3 * Math.sin(M.TAU * (t / 6) + i));
    const bh = s * (3 + 34 * env * v);
    ctx.fillStyle = M.mixColor(P.fg, second(P), i / (n - 1));
    ctx.beginPath();
    ctx.roundRect(w / 2 - span / 2 + i * bw + bw * 0.18, cy - bh / 2, bw * 0.64, bh, bw * 0.32);
    ctx.fill();
  }
};

const LOOPS_BASE: LoopDef[] = [
  { id: "perspective-grid", name: "Perspective Grid", kind: "background", draw: perspectiveGrid, tags: ["grid", "3d", "tech", "retro", "synthwave"], description: "A grid floor streaming toward the camera under a glowing horizon. Tech launches, retro, gaming, energetic intros." },
  { id: "dot-wave", name: "Dot Wave", kind: "background", draw: dotWave, tags: ["dots", "wave", "pattern", "calm"], description: "A field of dots swelling in a diagonal wave. Calm, modern product backdrops behind titles." },
  { id: "flow-lines", name: "Flow Lines", kind: "background", draw: flowLines, tags: ["lines", "waves", "calm", "data"], description: "Thin horizontal lines drifting like a breathing signal. Data, finance, calm explainers." },
  { id: "gradient-blobs", name: "Gradient Blobs", kind: "background", draw: gradientBlobs, tags: ["gradient", "mesh", "soft", "premium"], description: "Big soft brand-colour blobs drifting into each other: a living mesh gradient. The safe premium backdrop for titles and product shots." },
  { id: "stripes-scroll", name: "Stripe Scroll", kind: "background", draw: stripesScroll, tags: ["stripes", "bold", "sport", "loud"], description: "Bold diagonal stripes sliding past, with an accent stripe every fifth. Loud promos, sport, sales." },
  { id: "concentric-pulse", name: "Concentric Pulse", kind: "background", draw: concentricPulse, tags: ["rings", "radar", "beat", "focus"], description: "Rings rippling out from a pulsing center on the beat. Draws the eye to the middle: reveals, notifications, music." },
  { id: "checker-twist", name: "Checker Twist", kind: "background", draw: checkerTwist, tags: ["checker", "tiles", "playful", "pattern"], description: "A checkerboard whose tiles twist a quarter turn in a diagonal wave. Playful, design-y, transitions." },
  { id: "halftone-sweep", name: "Halftone Sweep", kind: "background", draw: halftoneSweep, tags: ["halftone", "print", "sweep", "editorial"], description: "A halftone dot field with a band of light swelling across it. Editorial, print, comic energy." },
  { id: "terrain-ridges", name: "Terrain Ridges", kind: "background", draw: terrainRidges, tags: ["ridges", "terrain", "music", "moody"], description: "Stacked ridgelines rolling toward the viewer, peaks in the middle. Moody, music, data, night." },
  { id: "starfield-warp", name: "Starfield Warp", kind: "background", draw: starfieldWarp, tags: ["stars", "warp", "speed", "space"], description: "Streaks rushing out of the center at warp speed. Hype intros, launches, 'faster' messages." },
  { id: "bokeh-drift", name: "Bokeh Drift", kind: "background", draw: bokehDrift, tags: ["bokeh", "soft", "dreamy", "light"], description: "Soft out-of-focus lights rising slowly. Dreamy, warm, lifestyle, behind 3D devices." },
  { id: "iso-cubes", name: "Iso Cubes", kind: "background", draw: isoCubes, tags: ["isometric", "cubes", "3d", "tech", "blocks"], description: "An isometric city of cubes rising and settling in a wave from the center. Infrastructure, building, data, dev tools." },
  { id: "ribbon-weave", name: "Ribbon Weave", kind: "background", draw: ribbonWeave, tags: ["ribbons", "waves", "fluid", "playful"], description: "Thick colour ribbons waving across the frame. Playful, fluid, consumer apps." },
  { id: "tile-mosaic", name: "Tile Mosaic", kind: "background", draw: tileMosaic, tags: ["tiles", "flip", "grid", "pattern"], description: "Rounded tiles flipping colour at random moments. Busy-but-tidy energy: marketplaces, many features." },
  { id: "orbit-rings", name: "Orbit Rings", kind: "shape", draw: orbitRings, tags: ["orbit", "planet", "atom", "ai"], description: "A glowing sphere with three tilted rings and moons orbiting it. AI, platforms, 'everything connects'." },
  { id: "morph-blob", name: "Morph Blob", kind: "shape", draw: morphBlob, tags: ["blob", "organic", "soft", "ai"], description: "A glossy gradient blob slowly morphing and turning. AI assistants, organic brands, a soft centerpiece." },
  { id: "bouncing-ball", name: "Bouncing Ball", kind: "shape", draw: bouncingBall, tags: ["bounce", "playful", "loading", "beat"], description: "A ball bouncing with squash and stretch and a contact shadow. Playful beats, loading, kids, games." },
  { id: "spinner-petals", name: "Spinner Petals", kind: "shape", draw: spinnerPetals, tags: ["flower", "spinner", "loading", "playful"], description: "Eight petals snapping a quarter turn with a breath. Loading, blooming, wellness, playful logos." },
  { id: "stacked-squares", name: "Stacked Squares", kind: "shape", draw: stackedSquares, tags: ["squares", "stack", "layers", "design"], description: "Four nested rounded squares turning in a staggered overshoot. Layers, design tools, structure." },
  { id: "ripple-drop", name: "Ripple Drop", kind: "shape", draw: rippleDrop, tags: ["drop", "ripple", "water", "calm"], description: "A drop falls and sends ripples across a surface. Calm, impact, 'one change spreads'." },
  { id: "cube-spin", name: "Cube Spin", kind: "shape", draw: cubeSpin, tags: ["cube", "3d", "product", "tech"], description: "A shaded 3D cube spinning and bobbing. Products, packages, building blocks, tech." },
  { id: "dna-helix", name: "DNA Helix", kind: "shape", draw: dnaHelix, tags: ["helix", "science", "data", "health"], description: "Two strands of dots twisting around each other. Science, health, data, 'in our DNA'." },
  { id: "pie-burst", name: "Pie Burst", kind: "shape", draw: pieBurst, tags: ["pie", "chart", "burst", "data"], description: "A pie that bursts into slices, turns and snaps back. Data, analytics, splitting, sharing." },
  { id: "wave-bars", name: "Wave Bars", kind: "shape", draw: waveBars, tags: ["equalizer", "audio", "music", "voice"], description: "Equalizer bars rolling in a wave. Audio, voice, music, podcasts, 'listening'." },
];

/** Every loop, each with its gallery category. */
export const LOOPS: (LoopDef & { category: LoopCategory })[] = [...LOOPS_BASE, ...LOOPS_MORE].map((l) => ({
  ...l,
  category: l.category ?? (l.kind === "shape" ? "Shapes" : "Backgrounds"),
}));

export const LOOP_IDS = LOOPS.map((l) => l.id);
/** The loop `motion-loop` defaults to, and what an unknown id falls back to. */
export const DEFAULT_LOOP_ID = "gradient-blobs";
const warned = new Set<string>();
/** A loop by id; an unknown id warns once and falls back to DEFAULT_LOOP_ID. */
export const getLoop = (id: string) => {
  const found = LOOPS.find((l) => l.id === id);
  if (found) return found;
  if (!warned.has(id)) {
    warned.add(id);
    console.warn(`Unknown motion loop "${id}", using "${DEFAULT_LOOP_ID}". Ids: ${LOOP_IDS.join(", ")}`);
  }
  return LOOPS.find((l) => l.id === DEFAULT_LOOP_ID) ?? LOOPS[0];
};
