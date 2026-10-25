// More seamless loops: symmetry, shape morphing, little games, physics and generative pieces.
// Same contract as library.ts: a pure function of t, every period divides 12 s, colours from P.
import type { LoopDef, LoopDraw, LoopPalette } from "./engine";

const second = (P: LoopPalette) => (P.tone === "accent" ? P.paper : P.fg2);

// ─── Symmetry ────────────────────────────────────────────────────────────────────────────────────

/** Draw `paint` in one wedge, then rotate (and mirror) it n times around (cx, cy). */
function symmetric(ctx: CanvasRenderingContext2D, cx: number, cy: number, n: number, mirror: boolean, paint: () => void) {
  for (let k = 0; k < n; k++) {
    for (const flip of mirror ? [1, -1] : [1]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI * 2) / n);
      ctx.scale(1, flip);
      paint();
      ctx.restore();
    }
  }
}

const kaleidoscope: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const u = h / 100;
  const R = Math.hypot(w, h) / 2;
  const cols = [P.fg, second(P), P.mid, M.mixColor(P.fg, P.paper, 0.4)];
  symmetric(ctx, w / 2, h / 2, 8, true, () => {
    for (let i = 0; i < 14; i++) {
      // Each piece drifts out from the center and wraps: whole cycles per 12 s.
      const life = M.phase(t, [3, 4, 6][i % 3], M.rand(i, seed + 1));
      const r = life * R;
      const a = M.rand(i, seed + 2) * (Math.PI / 8) + Math.sin(M.TAU * M.phase(t, 6) + i) * 0.04;
      const size = u * (1.5 + 5 * M.rand(i, seed + 3)) * (0.4 + life);
      ctx.fillStyle = M.rgba(cols[i % cols.length], Math.sin(Math.PI * life));
      ctx.save();
      ctx.translate(Math.cos(a) * r, Math.sin(a) * r);
      ctx.rotate(M.TAU * M.phase(t, 4) + i);
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, M.TAU);
        ctx.fill();
      } else if (i % 3 === 1) ctx.fillRect(-size, -size * 0.4, size * 2, size * 0.8);
      else {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.9, size * 0.6);
        ctx.lineTo(-size * 0.9, size * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  });
};

const mandalaBloom: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const rings = [
    { n: 6, r: 9, len: 9, dir: 1, c: P.fg },
    { n: 12, r: 19, len: 8, dir: -1, c: second(P) },
    { n: 18, r: 29, len: 7, dir: 1, c: P.mid },
    { n: 24, r: 38, len: 5, dir: -1, c: P.fg },
  ];
  rings.forEach((ring, i) => {
    const breathe = 1 + 0.12 * Math.sin(M.TAU * M.phase(t, 3, i * 0.15));
    // One petal step per 3 s: the ring looks identical after each step.
    const step = (M.TAU / ring.n) * ring.dir * (Math.floor(t / 3) + M.ease.inOutCubic(M.win(M.phase(t, 3), 0.2, 0.8)));
    for (let k = 0; k < ring.n; k++) {
      const a = step + (k * M.TAU) / ring.n;
      ctx.save();
      ctx.translate(w / 2 + Math.cos(a) * ring.r * s * breathe, h / 2 + Math.sin(a) * ring.r * s * breathe);
      ctx.rotate(a);
      ctx.fillStyle = ring.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.len * s * 0.55, ring.len * s * 0.22, 0, 0, M.TAU);
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.fillStyle = P.paper;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, s * (4 + Math.sin(M.TAU * M.phase(t, 1.5))), 0, M.TAU);
  ctx.fill();
};

const spirograph: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const R = 30;
  const r = 11.25; // R / r = 8/3: the curve closes after 3 turns
  const d = 16;
  const point = (a: number) => ({
    x: w / 2 + ((R - r) * Math.cos(a) + d * Math.cos(((R - r) / r) * a)) * s,
    y: h / 2 + ((R - r) * Math.sin(a) - d * Math.sin(((R - r) / r) * a)) * s,
  });
  const total = M.TAU * 3;
  const head = M.phase(t, 6) * total;
  const tail = total * 0.55;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Faint full curve, then a bright trail that sweeps around it.
  ctx.strokeStyle = M.rgba(P.mid, 0.5);
  ctx.lineWidth = s * 0.3;
  ctx.beginPath();
  for (let i = 0; i <= 600; i++) {
    const p = point((i / 600) * total);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
  const steps = 240;
  for (let i = 0; i < steps; i++) {
    const a0 = head - tail + (i / steps) * tail;
    const a1 = head - tail + ((i + 1) / steps) * tail;
    const p0 = point(a0);
    const p1 = point(a1);
    const k = i / steps;
    ctx.strokeStyle = M.rgba(M.mixColor(second(P), P.fg, k), k);
    ctx.lineWidth = s * (0.3 + 0.9 * k);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  const p = point(head);
  ctx.fillStyle = P.fg;
  ctx.beginPath();
  ctx.arc(p.x, p.y, s * 1.6, 0, M.TAU);
  ctx.fill();
};

const mirrorTiles: LoopDraw = (ctx, w, h, t, P, M) => {
  const cols = 16;
  const s = w / cols;
  const rows = Math.ceil(h / s);
  ctx.lineCap = "round";
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      // Mirror the tile orientation around the frame's center lines (four-way symmetry).
      const mi = Math.min(i, cols - 1 - i);
      const mj = Math.min(j, rows - 1 - j);
      // Count turns on the tile's own (offset) clock, so 12 s is exactly two quarter turns everywhere.
      const q = t / 6 - (mi + mj) * 0.04;
      const turn = Math.floor(q) + M.ease.inOutCubic(M.win(M.fract(q), 0.1, 0.4));
      const flipX = i >= cols / 2 ? -1 : 1;
      const flipY = j >= rows / 2 ? -1 : 1;
      ctx.save();
      ctx.translate((i + 0.5) * s, (j + 0.5) * s);
      ctx.scale(flipX, flipY);
      ctx.rotate((turn * Math.PI) / 2);
      ctx.strokeStyle = (mi + mj) % 3 === 0 ? second(P) : P.fg;
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.arc(-s / 2, -s / 2, s / 2, 0, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2, Math.PI, Math.PI * 1.5);
      ctx.stroke();
      ctx.restore();
    }
  }
};

const radialBurst: LoopDraw = (ctx, w, h, t, P, M) => {
  const R = Math.hypot(w, h);
  const n = 24;
  // Two rays per 3 s: the alternating pattern lines up again each cycle.
  const rot = ((M.TAU * 2) / n) * (t / 3);
  for (let k = 0; k < n; k++) {
    const a = rot + (k * M.TAU) / n;
    ctx.fillStyle = k % 2 ? P.mid : M.rgba(P.fg, 0.9);
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.arc(w / 2, h / 2, R, a, a + M.TAU / n);
    ctx.closePath();
    ctx.fill();
  }
  const p = M.phase(t, 1.5);
  const s = Math.min(w, h) / 100;
  const pop = 1 + 0.18 * M.ease.outBack(M.win(p, 0, 0.3)) * (1 - M.win(p, 0.5, 1));
  ctx.fillStyle = second(P);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, s * 13 * pop, 0, M.TAU);
  ctx.fill();
  ctx.fillStyle = P.bg;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, s * 8 * pop, 0, M.TAU);
  ctx.fill();
};

// ─── Morphing ────────────────────────────────────────────────────────────────────────────────────

const N = 96;

/** A unit shape (radius 1) sampled at N angles, so any two shapes can be interpolated point by point. */
function polygon(sides: number, rot = -Math.PI / 2, inner = 1): [number, number][] {
  const out: [number, number][] = [];
  const corners: [number, number][] = [];
  const count = inner < 1 ? sides * 2 : sides;
  for (let k = 0; k < count; k++) {
    const a = rot + (k * Math.PI * 2) / count;
    const r = inner < 1 && k % 2 ? inner : 1;
    corners.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i < N; i++) {
    const f = (i / N) * count;
    const k = Math.floor(f);
    const a = corners[k % count];
    const b = corners[(k + 1) % count];
    const e = f - k;
    out.push([a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]);
  }
  return out;
}

const circle = (): [number, number][] =>
  Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)] as [number, number];
  });

const SHAPES = [circle(), polygon(4, -Math.PI / 4), polygon(3), polygon(5, -Math.PI / 2, 0.45), polygon(6)];
// Squares and triangles look smaller than circles at the same radius: scale for equal visual weight.
const WEIGHT = [1, 1.12, 1.25, 1.18, 1.04];

function drawMorph(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, b: number, k: number, rot: number) {
  const A = SHAPES[a];
  const B = SHAPES[b];
  const wa = WEIGHT[a] + (WEIGHT[b] - WEIGHT[a]) * k;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const px = (A[i][0] + (B[i][0] - A[i][0]) * k) * r * wa;
    const py = (A[i][1] + (B[i][1] - A[i][1]) * k) * r * wa;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const X = x + px * c - py * s;
    const Y = y + px * s + py * c;
    if (i) ctx.lineTo(X, Y);
    else ctx.moveTo(X, Y);
  }
  ctx.closePath();
}

const shapeMorph: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  // Five shapes, 2.4 s each would not divide 12: use 4 morphs of 3 s through a closed cycle of 4 shapes.
  const order = [0, 1, 2, 3];
  const step = Math.floor(t / 3) % order.length;
  const p = M.phase(t, 3);
  const k = M.ease.spring(M.win(p, 0.45, 0.85), 0.42, 2.2);
  const a = order[step];
  const b = order[(step + 1) % order.length];
  const squash = 1 - 0.1 * Math.sin(Math.PI * M.win(p, 0.3, 0.5));
  const rot = (Math.PI / 2) * (step + M.ease.inOutCubic(M.win(p, 0.45, 0.85)));
  const colors = [P.fg, second(P), P.fg, M.mixColor(P.fg, second(P), 0.5)];
  ctx.fillStyle = M.mixColor(colors[step], colors[(step + 1) % colors.length], M.clamp(k));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(1 / squash, squash);
  drawMorph(ctx, 0, 0, s * 22, a, b, k, rot);
  ctx.restore();
  ctx.fill();
  ctx.fillStyle = M.rgba(P.tone === "light" ? P.ink : "#000000", 0.18);
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2 + s * 32, s * 18 * squash, s * 2.4, 0, 0, M.TAU);
  ctx.fill();
};

const morphGrid: LoopDraw = (ctx, w, h, t, P, M) => {
  const cols = 12;
  const cell = w / cols;
  const rows = Math.ceil(h / cell);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const p = M.phase(t, 4, -(i + j) * 0.05);
      // Circle → square → diamond (rotated square) → circle within each 4 s cycle.
      const stage = p * 3;
      const st = Math.min(2, Math.floor(stage));
      const k = M.ease.inOutCubic(stage - st);
      const from = [0, 1, 1][st];
      const to = [1, 1, 0][st];
      const rot = st === 1 ? (k * Math.PI) / 4 : st === 2 ? Math.PI / 4 : 0;
      ctx.fillStyle = (i + j) % 4 === 0 ? second(P) : M.mixColor(P.mid, P.fg, 0.5 + 0.5 * Math.sin(M.TAU * p));
      drawMorph(ctx, (i + 0.5) * cell, (j + 0.5) * cell, cell * 0.32, from, to, st === 1 ? 1 : k, rot);
      ctx.fill();
    }
  }
};

const shapeShuffle: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const slots = [-28, 0, 28];
  const colors = [P.fg, second(P), P.mid];
  // Every 4 s the three shapes hop one slot right (the last wraps left) and become the next shape:
  // three hops per 12 s bring every shape home.
  const cycle = Math.floor(t / 4);
  const p = M.phase(t, 4);
  const k = M.ease.inOutCubic(M.win(p, 0.35, 0.75));
  for (let i = 0; i < 3; i++) {
    const from = (i + cycle) % 3;
    const to = (i + cycle + 1) % 3;
    const wrap = from === 2;
    const x = wrap ? slots[2] + (slots[0] - slots[2]) * k : slots[from] + (slots[to] - slots[from]) * k;
    const hop = Math.sin(Math.PI * k) * (wrap ? -16 : 10);
    ctx.fillStyle = colors[i];
    drawMorph(ctx, w / 2 + x * s, h / 2 - hop * s, s * 9, [0, 1, 2][from], [0, 1, 2][to], k, 0);
    ctx.fill();
  }
};

let scratch: HTMLCanvasElement | undefined;

const metaballs: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  // A coarse field, thresholded with a soft edge, then scaled up smoothly.
  const gw = 192;
  const gh = Math.max(1, Math.round((gw * h) / w));
  const field = new ImageData(gw, gh);
  const balls = Array.from({ length: 6 }, (_, i) => ({
    x: gw * (0.5 + 0.32 * Math.sin(M.TAU * (t / 12) * (1 + (i % 2)) + M.rand(i, seed + 1) * M.TAU)),
    y: gh * (0.5 + 0.3 * Math.cos(M.TAU * (t / 6) + M.rand(i, seed + 2) * M.TAU)),
    r: gh * (0.1 + 0.06 * M.rand(i, seed + 3)),
  }));
  const parse = (c: string) => {
    const m = /(\d+),(\d+),(\d+)/.exec(M.mixColor(c, c, 0));
    return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
  };
  const fg = parse(P.fg);
  const fg2 = parse(second(P));
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let v = 0;
      let wx = 0;
      for (let b = 0; b < balls.length; b++) {
        const dx = x - balls[b].x;
        const dy = y - balls[b].y;
        const f = (balls[b].r * balls[b].r) / (dx * dx + dy * dy + 1);
        v += f;
        wx += (b % 2) * f;
      }
      const a = M.smoothstep(0.9, 1.1, v);
      const k = v > 0 ? wx / v : 0;
      const i = (y * gw + x) * 4;
      field.data[i] = fg[0] + (fg2[0] - fg[0]) * k;
      field.data[i + 1] = fg[1] + (fg2[1] - fg[1]) * k;
      field.data[i + 2] = fg[2] + (fg2[2] - fg[2]) * k;
      field.data[i + 3] = a * 255;
    }
  }
  scratch ??= document.createElement("canvas");
  scratch.width = gw;
  scratch.height = gh;
  scratch.getContext("2d")?.putImageData(field, 0, 0);
  const small = scratch;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, w, h);
};

// ─── Games ───────────────────────────────────────────────────────────────────────────────────────

/** A closed path over a cols × rows board (a serpentine plus the return lane): the snake's track. */
function snakeTrack(cols: number, rows: number) {
  const path: [number, number][] = [];
  for (let x = 0; x < cols; x++) path.push([x, 0]);
  for (let col = cols - 1; col >= 1; col--) {
    const down = (cols - 1 - col) % 2 === 0;
    for (let y = 1; y < rows; y++) path.push([col, down ? y : rows - y]);
  }
  // Up the first column back to the start.
  for (let y = rows - 1; y >= 1; y--) path.push([0, y]);
  return path;
}

const snakeGame: LoopDraw = (ctx, w, h, t, P, M) => {
  const rows = 9;
  const cell = Math.min(h / (rows + 2), w / 18);
  const cols = Math.max(4, Math.floor((w / cell - 2) / 2) * 2);
  const track = snakeTrack(cols, rows);
  const L = track.length;
  const ox = (w - cols * cell) / 2;
  const oy = (h - rows * cell) / 2;
  const at = (i: number) => track[M.mod(Math.floor(i), L)];
  // The head runs the whole track once per 12 s: L cells.
  const head = (t / 12) * L;
  const len = Math.max(6, Math.round(L * 0.09));
  const gap = cell * 0.12;
  // Board.
  ctx.fillStyle = P.mid;
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      ctx.globalAlpha = 0.25;
      ctx.fillRect(ox + x * cell + gap, oy + y * cell + gap, cell - 2 * gap, cell - 2 * gap);
    }
  ctx.globalAlpha = 1;
  // Food on the track ahead of the head; eaten with a pop when the head reaches it.
  const foods = [0.13, 0.38, 0.61, 0.86].map((f) => Math.round(f * L));
  foods.forEach((f) => {
    const ahead = M.mod(f - head, L);
    const [fx, fy] = at(f);
    const cx = ox + (fx + 0.5) * cell;
    const cy = oy + (fy + 0.5) * cell;
    if (ahead < L * 0.6) {
      const blink = 0.85 + 0.15 * Math.sin(M.TAU * M.phase(t, 1));
      ctx.fillStyle = second(P);
      ctx.fillRect(cx - cell * 0.3 * blink, cy - cell * 0.3 * blink, cell * 0.6 * blink, cell * 0.6 * blink);
    }
    const since = M.mod(head - f, L);
    if (since < 3) {
      const q = since / 3;
      ctx.strokeStyle = M.rgba(second(P), 1 - q);
      ctx.lineWidth = cell * 0.12;
      ctx.strokeRect(cx - cell * (0.4 + q), cy - cell * (0.4 + q), cell * (0.8 + 2 * q), cell * (0.8 + 2 * q));
    }
  });
  // Snake body, tail to head, with a sub-cell slide on the head and tail.
  const frac = head - Math.floor(head);
  for (let k = len; k >= 0; k--) {
    const [x, y] = at(head - k);
    const [nx, ny] = at(head - k + 1);
    const slide = k === 0 ? frac : 0;
    const px = ox + (x + (nx - x) * slide) * cell;
    const py = oy + (y + (ny - y) * slide) * cell;
    ctx.fillStyle = k === 0 ? P.fg : M.mixColor(P.fg, P.mid, (k / len) * 0.6);
    ctx.fillRect(px + gap * 0.5, py + gap * 0.5, cell - gap, cell - gap);
    if (k === 0) {
      ctx.fillStyle = P.bg;
      const ex = (nx - x) || 0;
      const ey = (ny - y) || 0;
      const e = cell * 0.12;
      ctx.fillRect(px + cell / 2 + ex * cell * 0.15 - ey * cell * 0.18 - e / 2, py + cell / 2 + ey * cell * 0.15 - ex * cell * 0.18 - e / 2, e, e);
      ctx.fillRect(px + cell / 2 + ex * cell * 0.15 + ey * cell * 0.18 - e / 2, py + cell / 2 + ey * cell * 0.15 + ex * cell * 0.18 - e / 2, e, e);
    }
  }
};

const fallingBlocks: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const cols = 10;
  const rows = 16;
  const cell = Math.min((h * 0.9) / rows, (w * 0.9) / cols);
  const ox = (w - cols * cell) / 2;
  const oy = (h - rows * cell) / 2;
  const colors = [P.fg, second(P), M.mixColor(P.fg, P.paper, 0.35), P.mid];
  ctx.strokeStyle = M.rgba(P.mid, 0.6);
  ctx.lineWidth = cell * 0.06;
  ctx.strokeRect(ox, oy, cols * cell, rows * cell);
  // Pieces enter from above the well: clip so a waiting piece never shows.
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, cols * cell, rows * cell);
  ctx.clip();
  // Twenty pieces (2×1 and 1×2 bars and squares) drop one after another and fill the bottom 4 rows,
  // which flash and clear at the end of the 12 s cycle.
  const layout: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < cols; c += 2) layout.push({ x: c, y: rows - 1 - r, w: 2, h: 1 });
  const order = layout.map((_, i) => i).sort((a, b) => Math.floor(a / 5) - Math.floor(b / 5) || M.rand(a, seed) - M.rand(b, seed));
  const per = 10.5 / order.length;
  const clear = M.win(t, 11.2, 11.9);
  order.forEach((idx, n) => {
    const piece = layout[idx];
    const start = n * per;
    const land = M.ease.inCubic(M.win(t, start, start + per * 1.4));
    if (t < start) return;
    const y = -2 + (piece.y + 2) * land;
    ctx.fillStyle = clear > 0 ? M.mixColor(colors[idx % colors.length], P.paper, Math.sin(Math.PI * clear * 3) ** 2) : colors[idx % colors.length];
    ctx.globalAlpha = 1 - M.smoothstep(0.6, 1, clear);
    ctx.fillRect(ox + piece.x * cell + cell * 0.06, oy + y * cell + cell * 0.06, piece.w * cell - cell * 0.12, piece.h * cell - cell * 0.12);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
};

const pong: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const tri = (x: number) => 1 - Math.abs(1 - 2 * M.fract(x));
  // x bounces paddle to paddle every 1.5 s, y wall to wall every 2 s: both close at 12 s.
  const bx = 0.12 + 0.76 * tri(t / 3);
  const by = 0.1 + 0.8 * tri(t / 4 + 0.15);
  const pad = (side: number) => {
    // Each paddle follows the ball loosely, snapping to it as it arrives.
    const near = side ? bx : 1 - bx;
    return 0.5 + (by - 0.5) * (0.4 + 0.6 * near ** 2);
  };
  ctx.fillStyle = M.rgba(P.mid, 0.8);
  for (let y = 0; y < h; y += s * 6) ctx.fillRect(w / 2 - s * 0.5, y, s, s * 3);
  ctx.fillStyle = P.fg;
  const ph = s * 18;
  ctx.fillRect(w * 0.1 - s * 1.5, pad(0) * h - ph / 2, s * 3, ph);
  ctx.fillRect(w * 0.9 - s * 1.5, pad(1) * h - ph / 2, s * 3, ph);
  for (let k = 4; k >= 0; k--) {
    const tk = t - k * 0.03;
    const x = 0.12 + 0.76 * tri(tk / 3);
    const y = 0.1 + 0.8 * tri(tk / 4 + 0.15);
    ctx.fillStyle = M.rgba(second(P), 1 - k * 0.2);
    ctx.fillRect(x * w - s * 1.6, y * h - s * 1.6, s * 3.2, s * 3.2);
  }
};

const GLIDER = [
  [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 1], [2, 1], [1, 2], [2, 2], [1, 3]],
  [[2, 1], [0, 2], [2, 2], [1, 3], [2, 3]],
  [[1, 1], [2, 2], [3, 2], [1, 3], [2, 3]],
];

const lifeGliders: LoopDraw = (ctx, w, h, t, P, M) => {
  // Gliders on a torus: each moves one cell diagonally every 4 generations, so a 12 × 12 board brings
  // them home after 48 generations (4 per second).
  const size = 12;
  const cell = Math.min(w, h) / (size + 2);
  const ox = (w - size * cell) / 2;
  const oy = (h - size * cell) / 2;
  const gen = Math.floor((t / 12) * 48);
  const shift = Math.floor(gen / 4);
  const pattern = GLIDER[gen % 4];
  const starts = [[0, 0], [6, 1], [3, 6], [9, 7]];
  ctx.fillStyle = M.rgba(P.mid, 0.35);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ctx.fillRect(ox + x * cell + cell * 0.1, oy + y * cell + cell * 0.1, cell * 0.8, cell * 0.8);
  starts.forEach(([sx, sy], g) => {
    ctx.fillStyle = g % 2 ? second(P) : P.fg;
    for (const [px, py] of pattern) {
      const x = M.mod(sx + px + shift, size);
      const y = M.mod(sy + py + shift, size);
      ctx.fillRect(ox + x * cell + cell * 0.06, oy + y * cell + cell * 0.06, cell * 0.88, cell * 0.88);
    }
  });
};

// ─── Physics ─────────────────────────────────────────────────────────────────────────────────────

const newtonsCradle: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  const n = 5;
  const r = s * 5;
  const len = s * 34;
  const top = h / 2 - s * 26;
  const swing = Math.sin(M.TAU * M.phase(t, 1.5)) * 0.55;
  ctx.strokeStyle = P.mid;
  ctx.lineWidth = s * 0.8;
  ctx.beginPath();
  ctx.moveTo(w / 2 - s * 22, top);
  ctx.lineTo(w / 2 + s * 22, top);
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const px = w / 2 + (i - (n - 1) / 2) * r * 2;
    let a = 0;
    if (i === 0 && swing < 0) a = swing;
    if (i === n - 1 && swing > 0) a = swing;
    const bx = px + Math.sin(a) * len;
    const by = top + Math.cos(a) * len;
    ctx.strokeStyle = M.rgba(P.mid, 0.9);
    ctx.lineWidth = s * 0.3;
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const g = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.4, r * 0.1, bx, by, r);
    g.addColorStop(0, M.mixColor(P.fg, P.paper, 0.6));
    g.addColorStop(1, i % 2 ? M.mixColor(P.fg, second(P), 0.4) : P.fg);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, M.TAU);
    ctx.fill();
  }
};

function gear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, a: number, color: string, hole: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < teeth * 2; k++) {
    const rr = k % 2 ? r : r * 1.16;
    const a0 = (k / (teeth * 2)) * Math.PI * 2;
    const a1 = ((k + 1) / (teeth * 2)) * Math.PI * 2;
    ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const clockGears: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  // Tooth counts 24 / 12 / 8: one turn of the big gear per 12 s, two of the middle, three of the small.
  const big = (M.TAU * t) / 12;
  gear(ctx, w / 2 - s * 10, h / 2, s * 24, 24, big, P.fg, P.bg);
  gear(ctx, w / 2 + s * 26.5, h / 2 - s * 6, s * 12, 12, -2 * big + Math.PI / 12, second(P), P.bg);
  gear(ctx, w / 2 - s * 10 + s * 30 * Math.cos(2.3), h / 2 + s * 30 * Math.sin(2.3), s * 8, 8, -3 * big + 0.2, P.mid, P.bg);
};

const liquidFill: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const s = Math.min(w, h) / 100;
  const R = s * 28;
  const cx = w / 2;
  const cy = h / 2;
  // Fills over 8 s, drains over 4 s.
  const level = t < 8 ? M.ease.inOutSine(t / 8) : 1 - M.ease.inOutSine((t - 8) / 4);
  const surface = cy + R - level * 2 * R;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, M.TAU);
  ctx.clip();
  ctx.fillStyle = M.rgba(P.mid, 0.4);
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  for (const [k, col] of [[0, second(P)], [1, P.fg]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy + R);
    for (let x = -R; x <= R; x += R / 40) {
      const y = surface + Math.sin((x / R) * 3 + M.TAU * M.phase(t, 2) + k * 1.5) * s * 2 * (0.4 + Math.sin(Math.PI * level)) + k * s * 2;
      ctx.lineTo(cx + x, y);
    }
    ctx.lineTo(cx + R, cy + R);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const life = M.phase(t, 3, M.rand(i, seed + 1));
    const bx = cx + (M.rand(i, seed + 2) - 0.5) * R * 1.4;
    const by = cy + R - life * (cy + R - surface);
    if (by > surface + s) {
      ctx.strokeStyle = M.rgba(P.paper, 0.6);
      ctx.lineWidth = s * 0.4;
      ctx.beginPath();
      ctx.arc(bx, by, s * (0.8 + M.rand(i, seed + 3)), 0, M.TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = P.fg;
  ctx.lineWidth = s * 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, M.TAU);
  ctx.stroke();
};

const dominoWave: LoopDraw = (ctx, w, h, t, P, M) => {
  const u = h / 100;
  const rows = 5;
  const cols = 22;
  const gapX = w / cols;
  for (let r = 0; r < rows; r++) {
    const y = h * (0.22 + r * 0.15);
    for (let c = 0; c < cols; c++) {
      // A wave knocks each domino down in turn, then it stands back up: one wave per 6 s.
      const p = M.phase(t, 6, -c * 0.025 - r * 0.08);
      const fall = M.ease.inCubic(M.win(p, 0, 0.12));
      const rise = M.ease.outBack(M.win(p, 0.55, 0.75));
      const a = (fall - rise) * 1.25;
      ctx.save();
      ctx.translate((c + 0.5) * gapX, y + u * 5);
      ctx.rotate(a);
      ctx.fillStyle = (c + r) % 6 === 0 ? second(P) : P.fg;
      ctx.beginPath();
      ctx.roundRect(-u * 1.2, -u * 10, u * 2.4, u * 10, u * 0.6);
      ctx.fill();
      ctx.restore();
    }
  }
};

// ─── Generative ──────────────────────────────────────────────────────────────────────────────────

const vortex: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const s = Math.min(w, h) / 100;
  const R = Math.hypot(w, h) * 0.55;
  for (let i = 0; i < 420; i++) {
    const life = M.phase(t, 6, M.rand(i, seed + 1));
    const arm = i % 3;
    const r = R * (1 - M.ease.inCubic(life));
    // Spin faster near the center; whole turns per cycle keep the seam closed.
    const a = (arm * M.TAU) / 3 + M.rand(i, seed + 2) * 0.5 + M.TAU * (2 * life) + (M.TAU * t) / 12;
    const x = w / 2 + Math.cos(a) * r;
    const y = h / 2 + Math.sin(a) * r * 0.62;
    ctx.fillStyle = M.rgba(arm === 1 ? second(P) : P.fg, Math.sin(Math.PI * life));
    ctx.beginPath();
    ctx.arc(x, y, s * (0.25 + 0.9 * (1 - life)), 0, M.TAU);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, s * 14);
  g.addColorStop(0, M.rgba(P.paper, 0.85));
  g.addColorStop(1, M.rgba(P.fg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

const lissajousTrail: LoopDraw = (ctx, w, h, t, P, M) => {
  const s = Math.min(w, h) / 100;
  // 3:2 Lissajous: x every 4 s, y every 6 s, the whole figure every 12 s.
  const at = (tt: number) => ({
    x: w / 2 + Math.sin((M.TAU * tt) / 4) * s * 40,
    y: h / 2 + Math.sin((M.TAU * tt) / 6 + Math.PI / 4) * s * 30,
  });
  ctx.lineCap = "round";
  const steps = 160;
  for (let i = 0; i < steps; i++) {
    const a = at(t - 3 + (i / steps) * 3);
    const b = at(t - 3 + ((i + 1) / steps) * 3);
    const k = i / steps;
    ctx.strokeStyle = M.rgba(M.mixColor(second(P), P.fg, k), k);
    ctx.lineWidth = s * (0.2 + 2.2 * k);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const p = at(t);
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 8);
  g.addColorStop(0, M.rgba(P.paper, 0.9));
  g.addColorStop(1, M.rgba(P.fg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(p.x - s * 8, p.y - s * 8, s * 16, s * 16);
};

const bubblePop: LoopDraw = (ctx, w, h, t, P, M, seed) => {
  const u = h / 100;
  for (let i = 0; i < 26; i++) {
    const life = M.phase(t, [3, 4, 6][i % 3], M.rand(i, seed + 1));
    const popAt = 0.55 + 0.35 * M.rand(i, seed + 2);
    const x = M.rand(i, seed + 3) * w + Math.sin(M.TAU * life * 2 + i) * u * 2;
    const r = u * (2 + 4 * M.rand(i, seed + 4));
    const y = h + r - life * (h + 2 * r);
    const col = i % 4 === 0 ? second(P) : P.fg;
    if (life < popAt) {
      ctx.strokeStyle = M.rgba(col, 0.9);
      ctx.lineWidth = u * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.6 + 0.4 * M.smoothstep(0, 0.1, life)), 0, M.TAU);
      ctx.stroke();
      ctx.fillStyle = M.rgba(P.paper, 0.5);
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.18, 0, M.TAU);
      ctx.fill();
    } else {
      // Pop: a ring of sparks flying out and fading.
      const q = M.clamp((life - popAt) / 0.12);
      if (q < 1) {
        const py = h + r - popAt * (h + 2 * r);
        for (let k = 0; k < 8; k++) {
          const a = (k * M.TAU) / 8;
          ctx.fillStyle = M.rgba(col, 1 - q);
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r * (1 + q * 1.5), py + Math.sin(a) * r * (1 + q * 1.5), u * 0.5 * (1 - q), 0, M.TAU);
          ctx.fill();
        }
      }
    }
  }
};

export const LOOPS_MORE: LoopDef[] = [
  { id: "kaleidoscope", name: "Kaleidoscope", kind: "background", category: "Symmetry", draw: kaleidoscope, tags: ["kaleidoscope", "symmetry", "mirror", "psychedelic"], description: "Shapes drifting out of the center through an eight-way mirror. Music, festivals, creative tools, hypnotic openers." },
  { id: "mandala-bloom", name: "Mandala Bloom", kind: "shape", category: "Symmetry", draw: mandalaBloom, tags: ["mandala", "symmetry", "petals", "wellness"], description: "Four rings of petals turning in alternate directions and breathing. Wellness, meditation, craft, elegant openers." },
  { id: "spirograph", name: "Spirograph", kind: "shape", category: "Symmetry", draw: spirograph, tags: ["spirograph", "curve", "line", "symmetry"], description: "A glowing pen tracing a spirograph curve around its own faint outline. Precision, engineering, design, math." },
  { id: "mirror-tiles", name: "Mirror Tiles", kind: "background", category: "Symmetry", draw: mirrorTiles, tags: ["truchet", "tiles", "symmetry", "arcs"], description: "Arc tiles mirrored four ways, turning in waves from the edges: a pattern that keeps redrawing itself. Design, architecture, playful tech." },
  { id: "radial-burst", name: "Radial Burst", kind: "background", category: "Symmetry", draw: radialBurst, tags: ["sunburst", "rays", "pop", "retro"], description: "Retro sunburst rays turning behind a pulsing ring. Announcements, sales, 'new!', game shows, comic pop." },
  { id: "shape-morph", name: "Shape Morph", kind: "shape", category: "Morphing", draw: shapeMorph, tags: ["morph", "shapes", "circle", "square", "triangle", "star"], description: "A shape that springs from circle to square to triangle to star and back, squashing before each change. Transformation, 'one tool, many uses', playful brands." },
  { id: "morph-grid", name: "Morph Grid", kind: "background", category: "Morphing", draw: morphGrid, tags: ["morph", "grid", "shapes", "wave"], description: "A grid of circles that become squares, turn into diamonds and round off again in a diagonal wave. Systems, design tools, modular products." },
  { id: "shape-shuffle", name: "Shape Shuffle", kind: "shape", category: "Morphing", draw: shapeShuffle, tags: ["shuffle", "morph", "shapes", "playful"], description: "Three shapes hopping one slot over and turning into the next shape. Options, choices, 'mix and match', onboarding." },
  { id: "metaballs", name: "Metaballs", kind: "background", category: "Morphing", draw: metaballs, tags: ["liquid", "blobs", "metaballs", "lava"], description: "Liquid blobs that merge and split like lava. Fluid, organic, AI, creative tools, music." },
  { id: "snake-game", name: "Snake", kind: "background", category: "Games", draw: snakeGame, tags: ["snake", "game", "retro", "pixel", "arcade"], description: "The classic snake game: the snake winds across a pixel board eating food with a pop. Gaming, retro, nostalgia, 'level up'." },
  { id: "falling-blocks", name: "Falling Blocks", kind: "shape", category: "Games", draw: fallingBlocks, tags: ["blocks", "tetris", "stack", "game", "retro"], description: "Blocks drop into a well, stack up and clear in a flash. Building, organizing, productivity, games." },
  { id: "pong", name: "Pong", kind: "background", category: "Games", draw: pong, tags: ["pong", "game", "retro", "arcade", "back and forth"], description: "Two paddles rallying a ball with a motion trail. Retro, back-and-forth, collaboration, versus." },
  { id: "life-gliders", name: "Life Gliders", kind: "shape", category: "Games", draw: lifeGliders, tags: ["game of life", "pixel", "cellular", "generative"], description: "Conway's Game of Life gliders sailing across a wrapped board. Code, dev tools, emergence, nerdy brands." },
  { id: "newtons-cradle", name: "Newton's Cradle", kind: "shape", category: "Physics", draw: newtonsCradle, tags: ["newton", "cradle", "physics", "momentum"], description: "A Newton's cradle clicking back and forth. Momentum, cause and effect, focus, steady progress." },
  { id: "clock-gears", name: "Clock Gears", kind: "shape", category: "Physics", draw: clockGears, tags: ["gears", "machine", "process", "automation"], description: "Three meshing gears turning at true ratios. Automation, workflows, engineering, 'how it works'." },
  { id: "liquid-fill", name: "Liquid Fill", kind: "shape", category: "Physics", draw: liquidFill, tags: ["liquid", "fill", "progress", "water"], description: "A round vessel filling with wavy liquid and bubbles, then draining. Progress, loading, drinks, growth." },
  { id: "domino-wave", name: "Domino Wave", kind: "background", category: "Physics", draw: dominoWave, tags: ["domino", "chain reaction", "wave"], description: "Rows of dominoes toppling in a wave and springing back up. Chain reactions, automation, 'one action, many results'." },
  { id: "vortex", name: "Vortex", kind: "background", category: "Generative", draw: vortex, tags: ["vortex", "galaxy", "particles", "spiral"], description: "Three arms of particles spiralling into a glowing core. AI, space, gravity, 'everything flows to one place'." },
  { id: "lissajous-trail", name: "Lissajous Trail", kind: "shape", category: "Generative", draw: lissajousTrail, tags: ["lissajous", "trail", "light", "curve"], description: "A comet of light drawing a Lissajous figure with a fading trail. Signals, elegance, music, tech intros." },
  { id: "bubble-pop", name: "Bubble Pop", kind: "background", category: "Generative", draw: bubblePop, tags: ["bubbles", "pop", "playful", "fizzy"], description: "Bubbles wobbling upward and popping into sparks. Playful, drinks, kids, social, notifications." },
];
