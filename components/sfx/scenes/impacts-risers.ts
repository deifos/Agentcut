// Impact and riser scenes: one small motion graphic per sound, showing what it is.
import {
  type Frame,
  type Scene,
  TAU,
  alpha,
  burst,
  circle,
  clamp,
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
  speedLines,
  spring,
  stroke,
  wave,
  withT,
} from "./kit";

type Paint = { fill?: string; stroke?: string; width?: number };
type Path = (c: CanvasRenderingContext2D) => void;

const frac = (x: number) => x - Math.floor(x);
/** How hard it hits now: the live loudness while playing, a gentle half-hit at rest. */
const hit = (f: Frame) => (f.playing ? f.level : 0.35);
/** Progress: t while playing, a chosen pose at rest. */
const prog = (f: Frame, rest = 0.4) => (f.playing ? f.t : rest);
/** Progress of a falling sweep: fast at first, slowing as it fades (like the measured pitch curves). */
const fall = (f: Frame, rest: number, rate: number) => (f.playing ? (1 - Math.exp(-rate * f.t)) / (1 - Math.exp(-rate)) : rest);
/** How much is left of a fading sound: full at rest. */
const fadeOf = (f: Frame) => (f.playing ? clamp(0.2 + f.level * 1.2) : 1);

function ell(f: Frame, x: number, y: number, rx: number, ry: number, rot = 0, o: Paint = {}, a0 = 0, a1 = TAU) {
  const { ctx } = f;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, a0, a1);
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  if (o.stroke ?? !o.fill) {
    ctx.strokeStyle = o.stroke ?? f.ink;
    ctx.lineWidth = o.width ?? f.lw;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

function ground(f: Frame, y: number, x0 = f.w * 0.1, x1 = f.w * 0.9) {
  line(f, x0, y, x1, y, alpha(f.ink, 0.45));
}

function clipRect(f: Frame, x: number, y: number, w: number, h: number, draw: () => void) {
  const { ctx } = f;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  draw();
  ctx.restore();
}

function shape(f: Frame, path: Path, fillColor?: string, strokeColor: string | null = f.ink, width = f.lw) {
  if (fillColor) fill(f, path, fillColor);
  if (strokeColor) stroke(f, path, strokeColor, width);
}

/** Small dust puffs either side of x at ground y; d 0…1 spreads and fades them. */
function dust(f: Frame, x: number, y: number, half: number, d: number, n = 3) {
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      circle(f, x + side * (half + d * f.s * (0.05 + i * 0.06)), y - f.s * (0.02 + 0.025 * i) * (0.5 + d), f.s * 0.022 * (1 + i * 0.35), {
        stroke: alpha(f.ink, 0.5 * (1 - d * 0.7)),
      });
    }
  }
}

/** Sound arcs ")))" opening in direction dir (1 right, -1 left). */
function arcs(f: Frame, x: number, y: number, dir: number, k: number, n = 3, color = f.brand) {
  for (let i = 0; i < n; i++) {
    const r = f.s * (0.05 + i * 0.045);
    const a = dir > 0 ? 0 : Math.PI;
    stroke(f, (c) => c.arc(x, y, r, a - 0.6, a + 0.6), alpha(color, clamp(k * 1.4 - i * 0.25)));
  }
}

/** A kick-drum beater on its pedal, pivoting at (px, py); k 0 (back) … 1 (hit). */
function beater(f: Frame, px: number, py: number, L: number, k: number) {
  line(f, px - L * 0.25, py + L * 0.12, px + L * 0.25, py + L * 0.12);
  const a = lerp(-Math.PI / 2 - 0.55, -Math.PI / 2 + 0.42, k);
  const bx = px + Math.cos(a) * L;
  const by = py + Math.sin(a) * L;
  line(f, px, py, bx, by);
  circle(f, bx, by, L * 0.12, { fill: f.brand });
}

function stripes(f: Frame, x0: number, y0: number, W: number, bh: number) {
  clipRect(f, x0, y0, W, bh, () => {
    for (let i = -1; i < 8; i += 2) {
      fill(f, (c) => {
        const a = x0 + (i * W) / 7;
        c.moveTo(a, y0 + bh);
        c.lineTo(a + W / 7, y0 + bh);
        c.lineTo(a + W / 7 + bh * 0.8, y0);
        c.lineTo(a + bh * 0.8, y0);
        c.closePath();
      }, f.ink);
    }
  });
  rrect(f, x0, y0, W, bh, f.s * 0.008);
}

function cloud(x: number, y: number, k: number): Path {
  return (c) => {
    c.moveTo(x - 0.8 * k, y + 0.3 * k);
    c.bezierCurveTo(x - 1.1 * k, y + 0.3 * k, x - 1.0 * k, y - 0.2 * k, x - 0.6 * k, y - 0.15 * k);
    c.bezierCurveTo(x - 0.55 * k, y - 0.6 * k, x + 0.05 * k, y - 0.65 * k, x + 0.15 * k, y - 0.3 * k);
    c.bezierCurveTo(x + 0.35 * k, y - 0.55 * k, x + 0.85 * k, y - 0.4 * k, x + 0.75 * k, y - 0.05 * k);
    c.bezierCurveTo(x + 1.05 * k, y, x + 1.05 * k, y + 0.3 * k, x + 0.8 * k, y + 0.3 * k);
    c.closePath();
  };
}

export const impactRiserScenes: Record<string, Scene> = {
  // ---------- Impacts (recordings) ----------

  /** A kick drum, its beater swinging in on the hit. */
  "impact-crash-01"(f) {
    const { s, cx, cy } = f;
    const k = hit(f);
    const [dx, dy] = shake(f, 0.025);
    const R = s * 0.27;
    const x = cx + s * 0.14 + dx;
    const y = cy - s * 0.02 + dy;
    line(f, x - R * 0.6, y + R * 0.8, x - R * 0.85, y + R * 1.2);
    line(f, x + R * 0.6, y + R * 0.8, x + R * 0.85, y + R * 1.2);
    circle(f, x, y, R);
    circle(f, x, y, R * 0.84, { stroke: alpha(f.ink, 0.35) });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      circle(f, x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92, f.lw * 0.9, { fill: f.ink });
    }
    circle(f, x, y, R * (0.16 + 0.22 * k), { fill: alpha(f.brand, 0.25 + 0.6 * k) });
    if (f.playing) ripples(f, x, y, k, R * 0.8, 2);
    beater(f, x - R * 1.35, y + R * 0.95, R * 1.05, f.playing ? k : 0.2);
  },

  /** A one-ton weight dropping onto the floor and cracking it. */
  "impact-doom-01"(f) {
    const { s, cx, t, h } = f;
    const gy = h * 0.82;
    const land = f.playing ? easeIn(clamp(t / 0.08)) : 1;
    const [dx, dy] = shake(f, 0.035);
    const W = s * 0.36;
    const H = s * 0.3;
    const x = cx + dx;
    const y = lerp(-H * 1.2, gy - H, land) + dy;
    ground(f, gy + dy);
    if (land >= 1) {
      for (const side of [-1, 1]) {
        stroke(f, (c) => {
          c.moveTo(x + side * W * 0.52, gy + dy);
          c.lineTo(x + side * W * 0.68, gy + dy + s * 0.04);
          c.lineTo(x + side * W * 0.84, gy + dy + s * 0.025);
          c.lineTo(x + side * W * 1.0, gy + dy + s * 0.07);
        }, alpha(f.ink, 0.6));
      }
      dust(f, x, gy + dy, W * 0.55, f.playing ? ease((t - 0.08) * 3) : 0.6);
    } else speedLines(f, x, y, Math.PI / 2, s * 0.3, W * 0.8, 4, 1);
    const body: Path = (c) => {
      c.moveTo(x - W / 2, y + H);
      c.lineTo(x + W / 2, y + H);
      c.lineTo(x + W * 0.36, y + H * 0.28);
      c.lineTo(x - W * 0.36, y + H * 0.28);
      c.closePath();
    };
    shape(f, body, alpha(f.ink, 0.06));
    stroke(f, (c) => c.arc(x, y + H * 0.28, W * 0.2, Math.PI, 0));
    label(f, "1T", x, y + H * 0.66, s * 0.11, f.brand, 800);
  },

  /** A wooden crate landing softly, a puff of dust either side. */
  "impact-thud-01"(f) {
    const { s, cx, t, h } = f;
    const gy = h * 0.8;
    const B = s * 0.34;
    const land = f.playing ? ease(clamp(t / 0.06)) : 1;
    const sq = f.playing ? f.level * 0.1 : 0;
    const bw = B * (1 + sq);
    const bh = B * (1 - sq);
    const x = cx - bw / 2;
    const y = gy - bh - (1 - land) * s * 0.35;
    ground(f, gy);
    rrect(f, x, y, bw, bh, s * 0.012, { fill: alpha(f.brand, 0.12), stroke: f.ink });
    const p = bw * 0.13;
    rrect(f, x + p, y + p, bw - 2 * p, bh - 2 * p, 0, { stroke: alpha(f.ink, 0.6) });
    line(f, x + p, y + bh - p, x + bw - p, y + p, alpha(f.ink, 0.6));
    for (let i = 1; i < 3; i++) line(f, x, y + (bh * i) / 3, x + p, y + (bh * i) / 3, alpha(f.ink, 0.4));
    dust(f, cx, gy, bw / 2, f.playing ? clamp((t - 0.05) * 3) : 0.4, 2);
  },

  /** A mallet knocking a hollow wooden temple block. */
  "impact-thunk-01"(f) {
    const { s, cx, cy } = f;
    const k = f.playing ? f.level : 0.25;
    const bx = cx - s * 0.06;
    const by = cy + s * 0.1;
    const BW = s * 0.52;
    const BH = s * 0.24;
    line(f, bx - BW * 0.3, by + BH / 2, bx - BW * 0.38, by + BH / 2 + s * 0.12);
    line(f, bx + BW * 0.3, by + BH / 2, bx + BW * 0.38, by + BH / 2 + s * 0.12);
    rrect(f, bx - BW / 2, by - BH / 2, BW, BH, BH * 0.48, { fill: alpha(f.brand, 0.12), stroke: f.ink });
    rrect(f, bx - BW * 0.32, by - BH * 0.06, BW * 0.64, BH * 0.14, BH * 0.07, { fill: alpha(f.ink, 0.85) });
    const hx = lerp(bx + BW * 0.34, bx + BW * 0.12, k);
    const hy = lerp(by - BH * 2.1, by - BH / 2 - s * 0.045, k);
    line(f, hx, hy, hx + s * 0.32, hy - s * 0.1);
    circle(f, hx, hy, s * 0.045, { fill: f.brand });
    arcs(f, bx - BW / 2 - s * 0.02, by, -1, f.playing ? f.level : 0.5);
  },

  // ---------- Cut hits ----------

  /** Two film frames slamming together on the cut, a bright air band streaking above. */
  "es-cut-hit-air"(f) {
    const { s, cx, cy, t, w, time } = f;
    const k = f.playing ? ease(t * 6) : 1;
    const FW = s * 0.4;
    const FH = s * 0.28;
    const gap = (1 - k) * w * 0.22;
    const y = cy - FH / 2 + s * 0.08;
    for (const side of [-1, 1]) {
      const x = side < 0 ? cx - FW - gap : cx + gap;
      rrect(f, x, y, FW, FH, s * 0.015, side > 0 ? { fill: alpha(f.brand, 0.14), stroke: f.ink } : {});
      for (let i = 0; i < 5; i++) {
        const hx = x + FW * (0.1 + i * 0.2) - s * 0.012;
        rrect(f, hx, y + FH * 0.07, s * 0.024, s * 0.03, s * 0.006, { fill: alpha(f.ink, 0.55) });
        rrect(f, hx, y + FH * 0.93 - s * 0.03, s * 0.024, s * 0.03, s * 0.006, { fill: alpha(f.ink, 0.55) });
      }
    }
    line(f, cx, y - s * 0.05, cx, y + FH + s * 0.05, alpha(f.brand, 0.4 + 0.6 * hit(f)), f.lw * (1 + 2 * hit(f)));
    for (let i = 0; i < 6; i++) {
      const yy = cy - s * 0.3 + (i % 3) * s * 0.04;
      const len = w * (0.12 + 0.1 * rand(i, 2));
      const x0 = w * 0.1 + frac(rand(i, 5) + time * (1.2 + rand(i, 8))) * w * 0.8 - len / 2;
      line(f, Math.max(w * 0.08, x0), yy, Math.min(w * 0.92, x0 + len), yy, alpha(i % 2 ? f.ink : f.brand, 0.35 + 0.4 * hit(f)));
    }
  },

  /** A film clapperboard snapping shut: "cut!" */
  "es-cut-hit-kick"(f) {
    const { s, cx, cy, t } = f;
    const k = f.playing ? ease(t * 7) : 1;
    const W = s * 0.54;
    const H = s * 0.32;
    const x = cx - W / 2;
    const y = cy - H / 2 + s * 0.1;
    const bh = s * 0.075;
    rrect(f, x, y, W, H, s * 0.015);
    for (let i = 1; i < 4; i++) line(f, x + W * 0.08, y + (H * i) / 4, x + W * (i === 2 ? 0.6 : 0.85), y + (H * i) / 4, alpha(f.ink, 0.25));
    stripes(f, x, y - bh, W, bh);
    withT(f, x, y - bh, -0.6 * (1 - k), 1, () => stripes(f, 0, -bh, W, bh));
    if (k >= 1) burst(f, x + W + s * 0.01, y - bh, s * 0.04, s * 0.13, 6, f.playing ? clamp(t * 4) : 0.5, f.brand, -Math.PI / 2);
  },

  /** A comic-book POW starburst punching in. */
  "es-cut-hit-punch"(f) {
    const { s, cx, cy, t } = f;
    const k = f.playing ? spring(t * 2.5) : 1;
    withT(f, cx, cy, -0.1, 0.35 + 0.65 * k + 0.08 * hit(f), () => {
      const path: Path = (c) => {
        const n = 24;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const r = (i % 2 ? s * 0.2 : s * 0.33) * (0.9 + 0.2 * rand(i, 4));
          const px = Math.cos(a) * r * 1.25;
          const py = Math.sin(a) * r;
          if (i) c.lineTo(px, py);
          else c.moveTo(px, py);
        }
        c.closePath();
      };
      shape(f, path, alpha(f.brand, 0.9));
      label(f, "POW", 0, 0, s * 0.13, f.ink, 900);
    });
  },

  /** A kick, then the ground rumbling: granules jumping on a shaking floor. */
  "es-cut-hit-rumble"(f) {
    const { s, w, h, t, time } = f;
    const gy = h * 0.66;
    const k = hit(f);
    stroke(f, (c) => {
      for (let i = 0; i <= 60; i++) {
        const x = w * 0.1 + (w * 0.8 * i) / 60;
        const y = gy + Math.sin(i * 1.3 + time * 50) * k * s * 0.015 * (f.playing ? 1 : 0.4);
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
    });
    for (let r = 1; r <= 3; r++) {
      const off = (f.playing ? Math.sin(time * 40 + r) : 0.3) * k * s * 0.02;
      line(f, w * 0.18 + off, gy + r * s * 0.06, w * 0.82 + off, gy + r * s * 0.06, alpha(f.ink, 0.35 - r * 0.08));
    }
    for (let i = 0; i < 26; i++) {
      const x = w * 0.14 + (i * w * 0.72) / 25;
      const jump = f.playing ? Math.abs(Math.sin(time * 18 + i * 1.7)) * k * s * 0.16 * (0.4 + rand(i, 2)) : rand(i, 3) * s * 0.06;
      circle(f, x, gy - s * 0.02 - jump, s * (0.01 + 0.008 * rand(i, 5)), { fill: i % 4 ? f.ink : f.brand });
    }
    if (f.playing && t < 0.2) ripples(f, w / 2, gy, t * 5, s * 0.3, 2);
  },

  /** A speaker cabinet: the woofer pumping on the sub hit. */
  "es-cut-hit-sub"(f) {
    const { s, cx, cy } = f;
    const k = hit(f);
    const BW = s * 0.38;
    const BH = s * 0.64;
    const x = cx - BW / 2;
    const y = cy - BH / 2;
    rrect(f, x, y, BW, BH, s * 0.03);
    circle(f, cx, y + BH * 0.2, BW * 0.12);
    circle(f, cx, y + BH * 0.2, BW * 0.05, { fill: f.ink });
    const wy = y + BH * 0.64;
    const R = BW * 0.36;
    circle(f, cx, wy, R);
    circle(f, cx, wy, R * (0.62 + 0.18 * k), { stroke: alpha(f.ink, 0.5) });
    circle(f, cx, wy, R * (0.24 + 0.12 * k), { fill: alpha(f.brand, 0.4 + 0.6 * k) });
    arcs(f, x - s * 0.04, wy, -1, k);
    arcs(f, x + BW + s * 0.04, wy, 1, k);
  },

  // ---------- Cinematic impacts ----------

  /** An explosion: a billowing fireball, debris flying out, the screen shaking. */
  "es-impact-blast"(f) {
    const { s, cx, cy, t } = f;
    const k = f.playing ? ease(t * 2.5) : 0.8;
    const [dx, dy] = shake(f, 0.04);
    const x = cx + dx;
    const y = cy + dy;
    const R = s * (0.12 + 0.2 * k);
    const ball = (r: number): Path => (c) => {
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * TAU;
        const rr = r * (0.82 + 0.18 * Math.abs(Math.sin(a * 4.5 + 0.4)));
        if (i) c.lineTo(x + Math.cos(a) * rr * 1.15, y + Math.sin(a) * rr);
        else c.moveTo(x + Math.cos(a) * rr * 1.15, y + Math.sin(a) * rr);
      }
      c.closePath();
    };
    shape(f, ball(R), alpha(f.brand, 0.15 + 0.35 * hit(f)));
    shape(f, ball(R * 0.55), alpha(f.brand, 0.75), null);
    for (let i = 0; i < 10; i++) {
      const a = rand(i, 1) * TAU;
      const d = R * 1.15 + s * 0.16 * k * (0.5 + rand(i, 2));
      const l = s * 0.04;
      line(f, x + Math.cos(a) * d, y + Math.sin(a) * d, x + Math.cos(a) * (d + l), y + Math.sin(a) * (d + l), alpha(f.ink, 1 - k * 0.5));
    }
    if (f.playing && t < 0.06) circle(f, x, y, s * 0.4, { fill: alpha(f.brand, 0.25) });
  },

  /** A title slab slamming down onto the screen. */
  "es-impact-classic"(f) {
    const { s, cx, cy, t } = f;
    const k = f.playing ? ease(t * 6) : 1;
    const [dx, dy] = shake(f, 0.02);
    const sc = 1 + 1.4 * (1 - k);
    withT(f, cx + dx, cy + dy, 0, sc, () => {
      rrect(f, -s * 0.38, -s * 0.12, s * 0.76, s * 0.24, s * 0.03, { fill: alpha(f.brand, 0.1), stroke: alpha(f.ink, k) });
      label(f, "TITLE", 0, s * 0.005, s * 0.15, alpha(f.ink, k), 900);
      line(f, -s * 0.2, s * 0.085, s * 0.2, s * 0.085, alpha(f.brand, k), f.lw * 1.5);
    });
    if (k >= 1) {
      const d = f.playing ? clamp((t - 0.17) * 3) : 0.4;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const yy = cy + s * (0.06 + i * 0.03);
          const x0 = cx + side * (s * 0.42 + d * s * 0.05);
          line(f, x0, yy, x0 + side * s * (0.08 + 0.04 * i) * (1 - d * 0.5), yy, alpha(f.ink, 0.5 * (1 - d * 0.6)));
        }
      }
    }
  },

  /** A big taiko drum, two sticks coming down on its skin. */
  "es-impact-deep"(f) {
    const { s, cx, cy } = f;
    const k = hit(f);
    const [dx, dy] = shake(f, 0.02);
    const R = s * 0.27;
    const H = s * 0.32;
    const top = cy - s * 0.08 + dy;
    const x = cx + dx;
    stroke(f, (c) => {
      c.moveTo(x - R, top);
      c.quadraticCurveTo(x - R * 1.22, top + H / 2, x - R, top + H);
      c.ellipse(x, top + H, R, R * 0.28, 0, Math.PI, 0, true);
      c.quadraticCurveTo(x + R * 1.22, top + H / 2, x + R, top);
    });
    ell(f, x, top, R, R * 0.28, 0, { fill: alpha(f.brand, 0.12 + 0.5 * k), stroke: f.ink });
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (i / 10);
      circle(f, x + Math.cos(a) * R, top + Math.sin(a) * R * 0.28 + s * 0.03, f.lw * 0.7, { fill: f.ink });
    }
    for (let i = 1; i <= 2; i++) ell(f, x, top, R * 0.32 * i * (0.6 + 0.6 * k), R * 0.09 * i * (0.6 + 0.6 * k), 0, { stroke: alpha(f.ink, 0.5 * k) });
    for (const side of [-1, 1]) {
      const lift = 1 - k;
      const tx = x + side * R * 0.22;
      const ty = top - s * 0.01 - lift * s * 0.12;
      line(f, tx, ty, tx + side * s * 0.28, ty - s * 0.15 - lift * s * 0.04, f.ink, f.lw * 1.7);
      circle(f, tx, ty, f.lw * 1.2, { fill: f.brand });
    }
  },

  /** A gong hanging in its frame, struck and shimmering. */
  "es-impact-metal"(f) {
    const { s, cx, cy, h, time } = f;
    const k = hit(f);
    const px = s * 0.46;
    line(f, cx - px, h * 0.9, cx - px, h * 0.12);
    line(f, cx + px, h * 0.9, cx + px, h * 0.12);
    line(f, cx - px - s * 0.04, h * 0.12, cx + px + s * 0.04, h * 0.12, f.ink, f.lw * 1.4);
    const gy = cy + s * 0.05;
    const R = s * 0.25;
    const wob = f.playing ? Math.sin(time * 40) * k * s * 0.01 : 0;
    line(f, cx - R * 0.5, h * 0.12, cx - R * 0.45 + wob, gy - R * 0.9, alpha(f.ink, 0.5));
    line(f, cx + R * 0.5, h * 0.12, cx + R * 0.45 + wob, gy - R * 0.9, alpha(f.ink, 0.5));
    circle(f, cx + wob, gy, R, { fill: alpha(f.brand, 0.08 + 0.2 * k), stroke: f.ink });
    circle(f, cx + wob * 0.6, gy, R * 0.82, { stroke: alpha(f.ink, 0.3) });
    circle(f, cx + wob * 0.3, gy, R * 0.25, { fill: alpha(f.brand, 0.5 + 0.5 * k) });
    if (f.playing) ripples(f, cx, gy, frac(time * 1.5), R * 1.25, 2);
    const mx = cx + R + s * 0.03 + (1 - k) * s * 0.08;
    line(f, mx, gy + s * 0.02, mx + s * 0.05, gy + s * 0.3);
    circle(f, mx, gy, s * 0.035, { fill: f.ink });
  },

  /** A boxing glove smacking a hanging punching bag. */
  "es-impact-punch"(f) {
    const { s, cx, cy, t, h, time } = f;
    const k = hit(f);
    const hx = cx + s * 0.18;
    const hy = h * 0.08;
    const swing = f.playing ? Math.sin(time * 7) * 0.22 * clamp(t * 5) * (1 - t) + 0.12 * k : 0.1;
    withT(f, hx, hy, -swing, 1, () => {
      line(f, 0, 0, 0, s * 0.12);
      rrect(f, -s * 0.11, s * 0.12, s * 0.22, s * 0.52, s * 0.09, { fill: alpha(f.brand, 0.15), stroke: f.ink });
      line(f, -s * 0.11, s * 0.24, s * 0.11, s * 0.24, alpha(f.ink, 0.5));
      line(f, -s * 0.11, s * 0.52, s * 0.11, s * 0.52, alpha(f.ink, 0.5));
    });
    const gx = cx - s * 0.42 + k * s * 0.16;
    const gy = cy + s * 0.04;
    rrect(f, gx - s * 0.2, gy - s * 0.05, s * 0.08, s * 0.1, s * 0.015);
    rrect(f, gx - s * 0.12, gy - s * 0.09, s * 0.22, s * 0.18, s * 0.08, { fill: f.brand, stroke: f.ink });
    rrect(f, gx - s * 0.06, gy - s * 0.13, s * 0.12, s * 0.07, s * 0.035, { fill: f.brand, stroke: f.ink });
    if (k > 0.5) burst(f, gx + s * 0.13, gy, s * 0.03, s * 0.09, 5, k, f.ink, -Math.PI * 0.4);
  },

  /** A swell blooming into a lens-flare flash with a long tail. */
  "es-impact-swell"(f) {
    const { s, cx, cy, t, w } = f;
    const k = hit(f);
    ripples(f, cx, cy, prog(f, 0.5), s * 0.42, 4);
    const half = w * 0.36 * (0.3 + 0.7 * k);
    line(f, cx - half, cy, cx + half, cy, alpha(f.brand, 0.35 + 0.5 * k), f.lw * 1.4);
    line(f, cx - half * 0.5, cy, cx + half * 0.5, cy, f.brand, f.lw * 2.4);
    circle(f, cx, cy, s * (0.04 + 0.08 * k), { fill: f.brand });
    circle(f, cx, cy, s * (0.08 + 0.1 * k), { stroke: alpha(f.brand, 0.5) });
    for (let i = 1; i <= 3; i++) {
      const d = s * 0.12 * i * (0.6 + 0.4 * (f.playing ? t : 0.5));
      circle(f, cx + d * 1.4, cy + d * 0.6, s * (0.035 - i * 0.007), { stroke: alpha(f.ink, 0.4) });
    }
  },

  // ---------- Designed gated sub impacts ----------

  /** A shockwave rolling out across the floor, air kicked up, then gated off. */
  "es-pro-impact-air"(f) {
    const { s, cx, t, h } = f;
    const gy = h * 0.72;
    const k = prog(f, 0.45);
    const gate = f.playing && t > 0.7 ? 0 : 1;
    ell(f, cx, gy, s * 0.04, s * 0.012, 0, { fill: f.ink });
    for (let i = 0; i < 4; i++) {
      const p = clamp(k * 1.6 - i * 0.18);
      if (p <= 0 || p >= 1) continue;
      ell(f, cx, gy, s * 0.55 * ease(p), s * 0.12 * ease(p), 0, { stroke: alpha(i % 2 ? f.ink : f.brand, (1 - p) * gate) });
    }
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.28;
      const r0 = s * (0.06 + 0.12 * k);
      const r1 = r0 + s * 0.12 * hit(f);
      line(f, cx + Math.cos(a) * r0, gy + Math.sin(a) * r0, cx + Math.cos(a) * r1, gy + Math.sin(a) * r1, alpha(f.ink, 0.6 * gate));
    }
  },

  /** A big woofer seen front-on, its cone thrown out by the deep impact. */
  "es-pro-impact-deep"(f) {
    const { s, cx, cy } = f;
    const k = hit(f);
    const R = s * 0.34;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      circle(f, cx + Math.cos(a) * R * 1.08, cy + Math.sin(a) * R * 1.08, f.lw, { fill: f.ink });
    }
    circle(f, cx, cy, R);
    circle(f, cx, cy, R * 0.88, { stroke: alpha(f.ink, 0.5) });
    for (let i = 0; i < 3; i++) circle(f, cx, cy, R * (0.72 - i * 0.14) * (0.92 + 0.14 * k), { stroke: alpha(f.ink, 0.25 + 0.1 * i) });
    circle(f, cx, cy, R * (0.24 + 0.08 * k), { fill: alpha(f.brand, 0.35 + 0.65 * k), stroke: f.ink });
    arcs(f, cx - R - s * 0.06, cy, -1, k, 3, f.ink);
    arcs(f, cx + R + s * 0.06, cy, 1, k, 3, f.ink);
  },

  /** A seismograph: the paper scrolling, the pen tracing the rumble. */
  "es-pro-impact-rumble"(f) {
    const { s, cy, w } = f;
    const x0 = w * 0.14;
    const x1 = w * 0.86;
    const top = cy - s * 0.27;
    const H = s * 0.54;
    rrect(f, x0, top, x1 - x0, H, s * 0.02, { stroke: alpha(f.ink, 0.5) });
    for (let i = 1; i < 4; i++) line(f, x0, top + (H * i) / 4, x1, top + (H * i) / 4, alpha(f.ink, 0.12));
    const px = x0 + (x1 - x0) * 0.78;
    const now = prog(f, 0.4);
    const n = 130;
    const shift = Math.floor(now * 160);
    let lastY = cy;
    stroke(f, (c) => {
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = x0 + s * 0.02 + (px - x0 - s * 0.02) * u;
        const tau = now - (1 - u) * 0.8;
        const env = tau < 0.03 ? 0.03 : Math.exp(-(tau - 0.03) * 2.2);
        const a = (0.02 + 0.42 * env) * H * (u > 0.97 && f.playing ? 0.4 + f.level : 1);
        const j = i + shift;
        const y = cy + Math.sin(j * 1.9) * a * (0.45 + 0.55 * rand(j, 3));
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
        lastY = y;
      }
    }, f.brand);
    line(f, px, lastY, px + s * 0.2, top - s * 0.04);
    circle(f, px, lastY, f.lw * 1.6, { fill: f.ink });
  },

  /** A hammer driving a nail into a plank in one short blow. */
  "es-pro-impact-short"(f) {
    const { s, cx, t, h } = f;
    const k = f.playing ? f.level : 0.15;
    const gy = h * 0.72;
    rrect(f, cx - s * 0.4, gy, s * 0.8, s * 0.1, s * 0.01, { fill: alpha(f.brand, 0.12), stroke: f.ink });
    line(f, cx - s * 0.32, gy + s * 0.05, cx - s * 0.08, gy + s * 0.05, alpha(f.ink, 0.3));
    line(f, cx + s * 0.06, gy + s * 0.035, cx + s * 0.3, gy + s * 0.035, alpha(f.ink, 0.3));
    const depth = f.playing ? ease(t * 5) : 0.4;
    const nailTop = gy - s * 0.16 * (1 - depth * 0.7);
    line(f, cx, nailTop, cx, gy, f.ink, f.lw * 1.2);
    line(f, cx - s * 0.03, nailTop, cx + s * 0.03, nailTop, f.ink, f.lw * 1.5);
    const L = s * 0.4;
    const th = lerp(0.95, 0, k);
    const ppx = cx + L;
    const ppy = nailTop - s * 0.05;
    const hx = ppx - Math.cos(th) * L;
    const hy = ppy - Math.sin(th) * L;
    line(f, ppx, ppy, hx, hy, f.ink, f.lw * 1.6);
    withT(f, hx, hy, th, 1, () => {
      rrect(f, -s * 0.035, -s * 0.07, s * 0.07, s * 0.12, s * 0.01, { fill: f.ink });
    });
    if (k > 0.6) burst(f, cx, nailTop, s * 0.03, s * 0.09, 6, k, f.brand, Math.PI);
  },

  /** A soft blob squashing flat on impact and wobbling back: the squelchy swell. */
  "es-pro-impact-swell"(f) {
    const { s, cx, h, time } = f;
    const gy = h * 0.78;
    const k = hit(f);
    const wob = f.playing ? Math.sin(time * 22) * 0.06 * (1 - k) : 0;
    const rx = s * 0.17 * (1 + 0.55 * k + wob);
    const ry = s * 0.17 * (1 - 0.45 * k - wob);
    ground(f, gy);
    ell(f, cx, gy - ry, rx, ry, 0, { fill: alpha(f.brand, 0.3), stroke: f.ink });
    stroke(f, (c) => c.ellipse(cx - rx * 0.35, gy - ry * 1.35, rx * 0.25, ry * 0.18, -0.4, Math.PI * 1.1, Math.PI * 1.7), alpha(f.ink, 0.6));
    if (k > 0.45) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) circle(f, cx + side * (rx + s * (0.04 + i * 0.05)), gy - s * (0.04 + 0.05 * rand(i, side + 2)) * k, s * 0.014, { fill: f.brand });
      }
    }
  },

  // ---------- Sub drops ----------

  /** A pitch line diving down a frequency chart, a bright dot riding it. */
  "es-pro-sub-drop-bright"(f) {
    const { s, w, h } = f;
    const k = prog(f, 0.55);
    const x0 = w * 0.18;
    const x1 = w * 0.84;
    const y0 = h * 0.16;
    const y1 = h * 0.82;
    line(f, x0, y0, x0, y1, alpha(f.ink, 0.6));
    line(f, x0, y1, x1, y1, alpha(f.ink, 0.6));
    for (let i = 1; i < 4; i++) line(f, x0, y0 + ((y1 - y0) * i) / 4, x1, y0 + ((y1 - y0) * i) / 4, alpha(f.ink, 0.1));
    label(f, "Hz", x0 - s * 0.06, y0 + s * 0.02, s * 0.05, alpha(f.ink, 0.6), 600);
    const pt = (u: number) => [x0 + (x1 - x0) * u, y0 + s * 0.04 + (y1 - y0 - s * 0.1) * ease(u * 1.3)] as const;
    const curve = (to: number): Path => (c) => {
      for (let i = 0; i <= 60; i++) {
        const [x, y] = pt((i / 60) * to);
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
    };
    stroke(f, curve(1), alpha(f.ink, 0.2));
    stroke(f, curve(k), f.brand, f.lw * 1.6);
    const [dx, dy] = pt(k);
    circle(f, dx, dy, s * (0.03 + 0.03 * hit(f)), { fill: alpha(f.brand, 0.25) });
    circle(f, dx, dy, s * 0.02, { fill: f.brand });
  },

  /** A heavy ball sinking down through the floor line. */
  "es-pro-sub-drop-low"(f) {
    const { s, cx, w, h } = f;
    const gy = h * 0.55;
    const R = s * 0.16;
    const k = f.playing ? ease(f.t * 1.2) : 0.5;
    const by = gy - R + k * R * 1.7;
    circle(f, cx, by, R, { stroke: alpha(f.ink, 0.22) });
    clipRect(f, 0, 0, w, gy, () => circle(f, cx, by, R, { fill: alpha(f.brand, 0.85), stroke: f.ink }));
    ground(f, gy);
    for (let i = 1; i <= 3; i++) ell(f, cx, gy, R * (1 + i * 0.45 * (0.5 + hit(f))), s * 0.012 * i, 0, { stroke: alpha(f.ink, 0.45 - i * 0.1) });
    for (let i = 0; i < 3; i++) line(f, cx - s * 0.03 + i * s * 0.03, by - R - s * 0.04, cx - s * 0.03 + i * s * 0.03, by - R - s * 0.1, alpha(f.ink, 0.4 * k));
  },

  /** An elevator car dropping down its shaft, the floor counter falling. */
  "es-pro-sub-drop-quick"(f) {
    const { s, cx, h } = f;
    const k = f.playing ? ease(f.t * 1.4) : 0.55;
    const sx = cx - s * 0.2;
    const top = h * 0.08;
    const bot = h * 0.92;
    line(f, sx - s * 0.14, top, sx - s * 0.14, bot, alpha(f.ink, 0.5));
    line(f, sx + s * 0.14, top, sx + s * 0.14, bot, alpha(f.ink, 0.5));
    const cy = lerp(h * 0.14, h * 0.62, k);
    line(f, sx, top, sx, cy, alpha(f.ink, 0.6));
    rrect(f, sx - s * 0.11, cy, s * 0.22, s * 0.26, s * 0.015, { fill: alpha(f.brand, 0.12), stroke: f.ink });
    line(f, sx, cy + s * 0.04, sx, cy + s * 0.26, alpha(f.ink, 0.5));
    if (f.playing && f.level > 0.3) speedLines(f, sx, cy - s * 0.02, Math.PI / 2, s * 0.18, s * 0.16, 3, f.level, f.ink);
    const ix = cx + s * 0.22;
    const iy = h * 0.4;
    rrect(f, ix - s * 0.12, iy - s * 0.09, s * 0.24, s * 0.18, s * 0.03);
    fill(f, (c) => {
      c.moveTo(ix - s * 0.08, iy - s * 0.03);
      c.lineTo(ix - s * 0.02, iy - s * 0.03);
      c.lineTo(ix - s * 0.05, iy + s * 0.03);
      c.closePath();
    }, f.brand);
    label(f, String(Math.max(0, 9 - Math.floor(k * 9.9))), ix + s * 0.04, iy + s * 0.005, s * 0.1, f.ink, 800, "ui-monospace, monospace");
  },

  /** A spectrum analyser whose energy slides down into the lowest bars. */
  "es-pro-sub-drop-ref"(f) {
    const { s, w, h } = f;
    const k = prog(f, 0.5);
    const n = 16;
    const x0 = w * 0.16;
    const x1 = w * 0.84;
    const gy = h * 0.82;
    const bw = (x1 - x0) / n;
    const p = lerp(0.85, 0.05, ease(k));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const v = 0.08 + 0.92 * Math.exp(-((u - p) ** 2) / 0.012);
      const bh = s * 0.6 * v * (0.6 + 0.45 * hit(f));
      rrect(f, x0 + i * bw + bw * 0.15, gy - bh, bw * 0.7, bh, s * 0.006, { fill: alpha(f.brand, 0.15 + 0.75 * v), stroke: alpha(f.ink, 0.5) });
    }
    line(f, x0, gy + s * 0.02, x1, gy + s * 0.02, alpha(f.ink, 0.5));
    label(f, "20", x0 + bw * 0.5, gy + s * 0.07, s * 0.04, alpha(f.ink, 0.5), 600);
    label(f, "20k", x1 - bw * 0.5, gy + s * 0.07, s * 0.04, alpha(f.ink, 0.5), 600);
  },

  /** A ball dropping into water and sinking softly, bubbles rising. */
  "es-pro-sub-drop-soft"(f) {
    const { s, cx, w, h, time } = f;
    const k = prog(f, 0.45);
    const wy = h * 0.42;
    wave(f, w * 0.1, w * 0.9, wy, s * 0.01, 5, time * 3, alpha(f.ink, 0.7));
    for (let i = 1; i < 4; i++) line(f, w * (0.18 + i * 0.05), wy + i * s * 0.12, w * (0.82 - i * 0.05), wy + i * s * 0.12, alpha(f.ink, 0.08));
    const by = k < 0.2 ? lerp(h * 0.1, wy, easeIn(k / 0.2)) : lerp(wy, h * 0.78, ease((k - 0.2) / 0.8));
    const R = s * 0.07;
    circle(f, cx, by, R, { fill: alpha(f.brand, k < 0.2 ? 0.9 : 0.55), stroke: f.ink });
    if (k > 0.2) {
      const d = clamp((k - 0.2) * 2);
      for (let i = 1; i <= 2; i++) ell(f, cx, wy, R * (1 + i * 1.4 * d), s * 0.012 * i, 0, { stroke: alpha(f.ink, 0.5 * (1 - d)) });
      for (let i = 0; i < 4; i++) {
        const q = frac(rand(i, 4) + time * 0.8);
        const yy = lerp(by - R, wy, f.playing ? q : rand(i, 5));
        circle(f, cx + (rand(i, 6) - 0.5) * s * 0.1, yy, s * 0.012, { stroke: alpha(f.ink, 0.5) });
      }
    }
  },

  /** An 808 drum machine, the step lights running and the pad flashing on the drop. */
  "es-sub-drop-808"(f) {
    const { s, cx, cy, t } = f;
    const W = s * 0.92;
    const H = s * 0.5;
    const x = cx - W / 2;
    const y = cy - H / 2;
    rrect(f, x, y, W, H, s * 0.03);
    label(f, "808", x + W * 0.13, y + H * 0.2, s * 0.09, f.brand, 900);
    for (let i = 0; i < 5; i++) {
      const kx = x + W * (0.36 + i * 0.13);
      const ky = y + H * 0.22;
      circle(f, kx, ky, s * 0.035);
      const a = -2.2 + rand(i, 2) * 2.8;
      line(f, kx, ky, kx + Math.cos(a) * s * 0.03, ky + Math.sin(a) * s * 0.03);
    }
    const on = f.playing ? Math.floor(t * 16) % 8 : 0;
    for (let i = 0; i < 8; i++) {
      const bw = (W * 0.84) / 8;
      const lit = i === on;
      rrect(f, x + W * 0.08 + i * bw + bw * 0.12, y + H * 0.56, bw * 0.76, H * 0.3, s * 0.012, {
        fill: lit ? alpha(f.brand, 0.35 + 0.65 * hit(f)) : i % 4 === 0 ? alpha(f.ink, 0.12) : undefined,
        stroke: f.ink,
      });
    }
  },

  /** A distorted, clipped bass wave whose pitch drops across the screen. */
  "es-sub-drop-gritty"(f) {
    const { s, cy, w, time } = f;
    const x0 = w * 0.1;
    const x1 = w * 0.9;
    const A = s * 0.2 * (0.5 + 0.5 * hit(f) + 0.2);
    line(f, x0, cy - A * 0.7, x1, cy - A * 0.7, alpha(f.brand, 0.4), f.lw * 0.7);
    line(f, x0, cy + A * 0.7, x1, cy + A * 0.7, alpha(f.brand, 0.4), f.lw * 0.7);
    let ph = f.playing ? -time * 14 : 0;
    stroke(f, (c) => {
      for (let i = 0; i <= 160; i++) {
        const u = i / 160;
        ph += ((9 * (1 - u) ** 1.6 + 1.2) * TAU) / 160;
        const y = cy + clamp(Math.sin(ph) * 1.7, -1, 1) * A * 0.7;
        if (i) c.lineTo(x0 + (x1 - x0) * u, y);
        else c.moveTo(x0, y);
      }
    });
    for (let i = 0; i < 18; i++) {
      const gx = x0 + rand(i, 1) * (x1 - x0);
      const gy = cy + (rand(i, 2) > 0.5 ? -1 : 1) * A * (0.75 + rand(i + Math.floor(time * 20), 3) * 0.2);
      circle(f, gx, gy, f.lw * 0.6, { fill: alpha(f.ink, 0.5) });
    }
  },

  /** A long sine wave stretching out as its pitch slides all the way down. */
  "es-sub-drop-long"(f) {
    const { s, cy, w, time } = f;
    const x0 = w * 0.1;
    const x1 = w * 0.9;
    const k = hit(f);
    line(f, x0, cy - s * 0.3, x1, cy + s * 0.3, alpha(f.ink, 0.15), f.lw * 0.8);
    wave(f, x0, x1, cy, (u) => s * (0.06 + 0.16 * u) * (0.5 + 0.7 * k), (u) => 16 * (1 - u) ** 2 + 1.2, f.playing ? -time * 8 : 0, f.brand, f.lw * 1.3);
    const ax = x1 - s * 0.02;
    const ay = cy + s * 0.34;
    stroke(f, (c) => {
      c.moveTo(ax - s * 0.03, ay - s * 0.03);
      c.lineTo(ax, ay);
      c.lineTo(ax + s * 0.03, ay - s * 0.03);
      c.moveTo(ax, ay);
      c.lineTo(ax, ay - s * 0.1);
    }, alpha(f.ink, 0.6));
  },

  /** A ship's anchor dropping on its chain and landing on the seabed. */
  "es-sub-drop-pro"(f) {
    const { s, cx, t, h } = f;
    const sea = h * 0.88;
    const k = f.playing ? easeIn(clamp(t * 2.4)) : 1;
    const y = lerp(-s * 0.2, sea - s * 0.4, k);
    for (let yy = y - s * 0.04; yy > -s * 0.05; yy -= s * 0.05) ell(f, cx, yy, s * 0.012, s * 0.022, 0, { stroke: alpha(f.ink, 0.6) });
    circle(f, cx, y, s * 0.03);
    line(f, cx, y + s * 0.03, cx, y + s * 0.37, f.ink, f.lw * 1.5);
    line(f, cx - s * 0.08, y + s * 0.1, cx + s * 0.08, y + s * 0.1, f.ink, f.lw * 1.5);
    stroke(f, (c) => c.arc(cx, y + s * 0.22, s * 0.16, Math.PI * 0.15, Math.PI * 0.85), f.ink, f.lw * 1.5);
    for (const side of [-1, 1]) {
      const ex = cx + side * Math.cos(Math.PI * 0.15) * s * 0.16;
      const ey = y + s * 0.22 + Math.sin(Math.PI * 0.15) * s * 0.16;
      fill(f, (c) => {
        c.moveTo(ex, ey - s * 0.06);
        c.lineTo(ex + side * s * 0.03, ey + s * 0.01);
        c.lineTo(ex - side * s * 0.03, ey + s * 0.01);
        c.closePath();
      }, f.brand);
    }
    ground(f, sea);
    if (k >= 1) dust(f, cx, sea, s * 0.12, f.playing ? clamp((t - 0.42) * 2) : 0.5, 2);
  },

  /** A wrecking ball swinging into a brick wall. */
  "es-sub-drop-punch"(f) {
    const { s, cx, t, h } = f;
    const px = cx - s * 0.15;
    const py = h * 0.06;
    const L = s * 0.55;
    const R = s * 0.1;
    const th = f.playing ? lerp(-0.95, 0, ease(t * 6)) + Math.sin(t * 30) * 0.05 * (1 - t) : -0.12;
    const bx = px + Math.sin(th) * L;
    const by = py + Math.cos(th) * L;
    line(f, px - s * 0.06, py, px + s * 0.06, py, f.ink, f.lw * 1.5);
    line(f, px, py, bx, by, alpha(f.ink, 0.7));
    circle(f, bx, by, R, { fill: f.ink });
    const wx = px + R + s * 0.01;
    const k = f.playing ? clamp((t - 0.15) * 3) : 0.2;
    const bw = s * 0.11;
    const bh = s * 0.065;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 3; c++) {
        const off = r % 2 ? bw / 2 : 0;
        let x = wx + c * bw + off;
        let y = h * 0.88 - (r + 1) * bh;
        const knocked = c === 0 && r >= 2 && r <= 4;
        if (knocked) {
          x += k * s * (0.1 + 0.05 * r);
          y -= k * s * 0.05 * (r - 1) - k * k * s * 0.1;
        }
        rrect(f, x, y, bw - s * 0.008, bh - s * 0.008, s * 0.006, knocked ? { fill: alpha(f.brand, 0.6), stroke: f.ink } : { stroke: alpha(f.ink, 0.7) });
      }
    }
    ground(f, h * 0.88);
  },

  // ---------- Downlifters: a hit at the top, then the energy falls away (pitch and loudness both drop) ----------

  /** Air fall: a comet of air streaking down from high in the sky to the horizon; its noisy dust tail
   *  thins into one fading line (the sound starts as air noise and turns into a falling tone). */
  "es-downlifter-air-fall"(f) {
    const { s, w, h } = f;
    const k = fall(f, 0.45, 3.5);
    const ground = h * 0.84;
    const path = (u: number) => [lerp(w * 0.16, w * 0.8, u), lerp(h * 0.12, ground, Math.pow(u, 1.5))] as const;
    for (let i = 0; i < 9; i++) circle(f, w * (0.1 + 0.8 * rand(i, 4)), h * (0.08 + 0.3 * rand(i, 5)), s * 0.006, { fill: alpha(f.ink, 0.35) });
    line(f, w * 0.08, ground, w * 0.92, ground, alpha(f.ink, 0.5));
    const fade = fadeOf(f);
    // The early, noisy part of the trail: scattered air specks high up.
    for (let i = 0; i < 26; i++) {
      const u = (i / 26) * Math.min(k, 0.35);
      const [px, py] = path(u);
      const j = (rand(i, 8) - 0.5) * s * 0.07 * (1 - u);
      circle(f, px + j, py - j * 0.6, s * 0.006 + s * 0.008 * rand(i, 9), { fill: alpha(f.ink, 0.25 + 0.4 * rand(i, 3)) });
    }
    // The tonal part: one thin falling line.
    if (k > 0.3) {
      stroke(f, (c) => {
        for (let i = 0; i <= 40; i++) {
          const [px, py] = path(lerp(0.3, k, i / 40));
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
      }, alpha(f.brand, 0.35 + 0.5 * fade));
    }
    const [hx, hy] = path(k);
    const r = s * lerp(0.045, 0.016, k);
    circle(f, hx, hy, r * 2, { fill: alpha(f.brand, 0.15 * fade) });
    circle(f, hx, hy, r, { fill: alpha(f.brand, 0.4 + 0.6 * fade) });
  },

  /** Flanged air: a sweep diving into the distance with two phased echo copies that drift in and out
   *  of it, like the comb of a flanger. */
  "es-downlifter-flange-air"(f) {
    const { s, w, h, time } = f;
    const k = fall(f, 0.62, 3);
    const fade = fadeOf(f);
    const path = (u: number, off: number) =>
      [lerp(w * 0.12, w * 0.86, u), lerp(h * 0.14, h * 0.8, Math.pow(u, 1.4)) + off * (1 - u * 0.4)] as const;
    const phase = f.playing ? time * 3.2 : 0.9;
    // Where it is heading: the rest of the dive, dotted.
    stroke(f, (c) => {
      for (let i = 0; i <= 30; i++) {
        const [px, py] = path(lerp(k, 1, i / 30), 0);
        if (i % 2 === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
    }, alpha(f.ink, 0.2));
    const offs = [0, s * 0.07 * Math.sin(phase), -s * 0.07 * Math.sin(phase + 1.3)];
    offs.forEach((off, n) => {
      stroke(f, (c) => {
        for (let i = 0; i <= 50; i++) {
          const [px, py] = path(lerp(Math.max(0, k - 0.7), k, i / 50), off);
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
      }, n === 0 ? alpha(f.brand, 0.4 + 0.6 * fade) : alpha(f.ink, 0.25 + 0.3 * fade), n === 0 ? f.lw * 1.4 : f.lw);
    });
    // Comb teeth where the copies cross: the notches a flanger sweeps through.
    for (let i = 0; i < 7; i++) {
      const u = Math.max(0, k - 0.7) + (i / 7) * Math.min(0.7, k);
      const [px, py] = path(u, 0);
      const len = s * 0.025 * (0.5 + 0.5 * Math.sin(phase * 2 + i));
      line(f, px, py - len, px, py + len, alpha(f.ink, 0.3));
    }
    const [hx, hy] = path(k, 0);
    withT(f, hx, hy, Math.atan2(h * 0.66 * 1.4 * Math.pow(Math.max(k, 0.05), 0.4), w * 0.74), 1 - k * 0.5, () => {
      fill(f, (c) => {
        c.moveTo(s * 0.04, 0);
        c.lineTo(-s * 0.025, -s * 0.025);
        c.lineTo(-s * 0.01, 0);
        c.lineTo(-s * 0.025, s * 0.025);
        c.closePath();
      }, alpha(f.brand, 0.5 + 0.5 * fade));
    });
  },

  /** Shepard fall: a bolt corkscrewing down an endless spiral that shrinks away into the distance,
   *  the tone that seems to keep falling. */
  "es-downlifter-shepard-fall"(f) {
    const { s, cx, h, time } = f;
    const k = fall(f, 0.55, 2);
    const fade = fadeOf(f);
    const turns = 3.2;
    const spin = f.playing ? time * 2.2 : 0;
    const at = (u: number) => {
      const a = u * turns * TAU + spin;
      const r = s * lerp(0.42, 0.05, u);
      return [cx + Math.cos(a) * r, lerp(h * 0.2, h * 0.84, u) + Math.sin(a) * r * 0.22, Math.sin(a)] as const;
    };
    // The whole spiral, faint; the part already travelled, in brand colour (front half brighter).
    for (let i = 0; i < 160; i++) {
      const u0 = i / 160;
      const u1 = (i + 1) / 160;
      const [x0, y0, z] = at(u0);
      const [x1, y1] = at(u1);
      const done = u1 <= k;
      const front = z > 0;
      line(f, x0, y0, x1, y1, done ? alpha(f.brand, (front ? 0.9 : 0.35) * (0.4 + 0.6 * fade)) : alpha(f.ink, front ? 0.22 : 0.1), f.lw * lerp(1.3, 0.6, u0));
    }
    const [hx, hy] = at(k);
    const r = s * lerp(0.04, 0.012, k);
    circle(f, hx, hy, r * 2.2, { fill: alpha(f.brand, 0.18 * fade) });
    circle(f, hx, hy, r, { fill: f.brand });
    sparkle(f, hx, hy, r * 0.8, alpha("#ffffff", 0.9));
    // Pitch arrow down the side.
    const ax = cx + s * 0.62;
    line(f, ax, h * 0.2, ax, h * 0.8, alpha(f.ink, 0.35));
    fill(f, (c) => {
      c.moveTo(ax, h * 0.84);
      c.lineTo(ax - s * 0.02, h * 0.79);
      c.lineTo(ax + s * 0.02, h * 0.79);
      c.closePath();
    }, alpha(f.ink, 0.5));
  },

  /** Sub sink: a heavy weight plunging through the surface into dark deep water; slow, wide pressure
   *  rings roll out under it and the deep swallows it (a pure sub tone falling and fading). */
  "es-downlifter-sub-sink"(f) {
    const { s, cx, w, h, time } = f;
    const k = fall(f, 0.45, 4);
    const fade = fadeOf(f);
    const surf = h * 0.26;
    wave(f, w * 0.1, w * 0.9, surf, s * 0.008, 5, f.playing ? time * 2 : 0, alpha(f.ink, 0.7));
    // Depth: lines getting fainter further down.
    for (let i = 1; i < 6; i++) line(f, w * 0.14, surf + i * h * 0.11, w * 0.86, surf + i * h * 0.11, alpha(f.ink, 0.14 - i * 0.02), f.lw * 0.8);
    // Splash rings at the entry point.
    for (let i = 0; i < 2; i++) {
      const q = clamp(k * 1.6 - i * 0.25);
      if (q > 0 && q < 1) ell(f, cx, surf, s * 0.36 * ease(q), s * 0.035 * ease(q), 0, { stroke: alpha(f.ink, 1 - q) });
    }
    // Low pressure rings rolling out around the sinking weight.
    const y = lerp(surf - s * 0.05, h * 0.78, k);
    for (let i = 0; i < 3; i++) {
      const q = (k * 2.2 + i / 3) % 1;
      ell(f, cx, y, s * (0.08 + 0.4 * q), s * (0.03 + 0.1 * q), 0, { stroke: alpha(f.brand, (1 - q) * 0.6 * fade), width: f.lw * 1.6 });
    }
    circle(f, cx, y, s * 0.06, { fill: alpha(f.ink, lerp(0.95, 0.45, k)) });
    circle(f, cx, y, s * 0.06, { stroke: alpha(f.brand, 0.4 + 0.6 * fade), width: f.lw * 1.4 });
  },

  /** Synth fall: an oscilloscope whose wave stretches out as the pitch drops (about 600 Hz down to
   *  160 Hz), its readout counting down and the pitch knob turning down. */
  "es-downlifter-synth-fall"(f) {
    const { s, cx, cy } = f;
    const k = fall(f, 0.5, 2.5);
    const fade = fadeOf(f);
    const W = s * 1.0;
    const H = s * 0.56;
    const x = cx - W / 2 - s * 0.1;
    const y = cy - H / 2;
    rrect(f, x, y, W, H, s * 0.03);
    line(f, x + W * 0.05, cy, x + W * 0.95, cy, alpha(f.ink, 0.15));
    const cycles = lerp(9, 2.4, k);
    wave(f, x + W * 0.05, x + W * 0.95, cy, H * 0.36 * (0.35 + 0.65 * fade), cycles, f.playing ? -f.time * 9 : 0, f.brand, f.lw * 1.3);
    label(f, `${Math.round(lerp(600, 160, k))} Hz`, x + W * 0.82, y + H * 0.13, s * 0.05, alpha(f.ink, 0.7), 600, "ui-monospace, monospace");
    // The pitch knob.
    const kx = x + W + s * 0.16;
    const ky = cy;
    const R = s * 0.085;
    circle(f, kx, ky, R);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
      line(f, kx + Math.cos(a) * R * 1.25, ky + Math.sin(a) * R * 1.25, kx + Math.cos(a) * R * 1.45, ky + Math.sin(a) * R * 1.45, alpha(f.ink, 0.45));
    }
    const a = Math.PI * 0.75 + (1 - k) * Math.PI * 1.5;
    line(f, kx, ky, kx + Math.cos(a) * R * 0.8, ky + Math.sin(a) * R * 0.8, f.brand, f.lw * 1.5);
    label(f, "PITCH", kx, ky + R * 1.9, s * 0.04, alpha(f.ink, 0.6), 600);
  },

  /** Tape stop: a cassette whose reels spin fast and grind to a halt; the speed meter drops to zero and
   *  the tape's waveform drags out longer as it slows. */
  "es-downlifter-tape"(f) {
    const { s, cx, cy } = f;
    const k = fall(f, 0.55, 4);
    const W = s * 0.82;
    const H = s * 0.52;
    const x = cx - W / 2;
    const y = cy - H / 2 - s * 0.05;
    rrect(f, x, y, W, H, s * 0.035);
    rrect(f, x + W * 0.07, y + H * 0.08, W * 0.86, H * 0.2, s * 0.012, { fill: alpha(f.brand, 0.12), stroke: alpha(f.ink, 0.6) });
    wave(f, x + W * 0.12, x + W * 0.88, y + H * 0.18, s * 0.018, lerp(9, 1.5, k), f.playing ? -f.time * 10 * (1 - k) : 0, f.brand, f.lw * 0.9);
    rrect(f, x + W * 0.2, y + H * 0.38, W * 0.6, H * 0.32, s * 0.025, { stroke: alpha(f.ink, 0.6) });
    stroke(f, (c) => {
      c.moveTo(x + W * 0.22, y + H);
      c.lineTo(x + W * 0.3, y + H * 0.82);
      c.lineTo(x + W * 0.7, y + H * 0.82);
      c.lineTo(x + W * 0.78, y + H);
    }, alpha(f.ink, 0.6));
    // Reels: angle = integral of a speed that falls from full to zero.
    const spin = f.playing ? 26 * (k - (k * k) / 2) : 0.5;
    const speed = 1 - k;
    for (const side of [-1, 1]) {
      const rx = cx + side * W * 0.2;
      const ry = y + H * 0.54;
      const r = s * 0.07;
      circle(f, rx, ry, r * (side < 0 ? 1.3 : 0.95), { stroke: alpha(f.ink, 0.25) });
      circle(f, rx, ry, r * 0.55);
      for (let i = 0; i < 6; i++) {
        const a = spin + (i * TAU) / 6;
        // Motion blur: a ghost spoke behind each one while it is still fast.
        if (f.playing && speed > 0.3) {
          const b = a - 0.35 * speed;
          line(f, rx + Math.cos(b) * r * 0.2, ry + Math.sin(b) * r * 0.2, rx + Math.cos(b) * r * 0.5, ry + Math.sin(b) * r * 0.5, alpha(f.ink, 0.25), f.lw * 0.8);
        }
        line(f, rx + Math.cos(a) * r * 0.2, ry + Math.sin(a) * r * 0.2, rx + Math.cos(a) * r * 0.5, ry + Math.sin(a) * r * 0.5, f.ink, f.lw * 0.8);
      }
    }
    // Speed meter under the cassette: 1x draining to 0.
    const my = y + H + s * 0.1;
    rrect(f, x + W * 0.15, my, W * 0.7, s * 0.03, s * 0.015, { stroke: alpha(f.ink, 0.5) });
    rrect(f, x + W * 0.15, my, W * 0.7 * speed, s * 0.03, s * 0.015, { fill: f.brand });
    label(f, `${speed.toFixed(1)}×`, x + W * 0.93, my + s * 0.015, s * 0.04, alpha(f.ink, 0.7), 600, "ui-monospace, monospace");
  },

  // ---------- Stutter risers ----------

  /** A rising row of bars chopped by a stuttering gate. */
  "es-pro-riser-air-gate"(f) {
    const { s, w, h, time } = f;
    const k = prog(f, 0.6);
    const n = 14;
    const x0 = w * 0.16;
    const bw = (w * 0.68) / n;
    const gy = h * 0.82;
    for (let i = 0; i < n; i++) {
      const v = (i + 1) / n;
      if (v > k + 0.08) continue;
      const open = f.playing ? Math.floor(time * 18 + i * 0.5) % 3 !== 0 : i % 4 !== 3;
      const bh = s * 0.6 * v * (0.55 + 0.45 * hit(f));
      rrect(f, x0 + i * bw + bw * 0.18, gy - bh, bw * 0.64, bh, s * 0.006, open ? { fill: alpha(f.brand, 0.2 + 0.7 * v), stroke: f.ink } : { stroke: alpha(f.ink, 0.25) });
    }
    line(f, x0, gy + s * 0.02, x0 + bw * n, gy + s * 0.02, alpha(f.ink, 0.5));
  },

  /** A knife chopping a bar into faster and faster slices. */
  "es-pro-riser-chop"(f) {
    const { s, cx, cy, time } = f;
    const k = prog(f, 0.4);
    const x0 = cx - s * 0.52;
    const x1 = cx + s * 0.42;
    const bh = s * 0.12;
    const y = cy + s * 0.06;
    const gap = s * 0.014;
    const cuts = 1 + Math.floor(k * 9);
    const cut = (j: number) => x1 - (j / 10) * (x1 - x0);
    line(f, x0 - s * 0.05, y + bh + s * 0.02, x1 + s * 0.08, y + bh + s * 0.02, alpha(f.ink, 0.5));
    for (let j = 1; j <= cuts; j++) rrect(f, cut(j) + gap / 2, y, cut(j - 1) - cut(j) - gap, bh, s * 0.01, { fill: alpha(f.brand, 0.3), stroke: f.ink });
    rrect(f, x0, y, cut(cuts) - x0 - gap / 2, bh, s * 0.01, { fill: alpha(f.brand, 0.12), stroke: f.ink });
    const kx = cut(cuts);
    const bounce = f.playing ? Math.abs(Math.sin(time * (8 + 30 * k))) : 0.6;
    const yb = y + bh - bounce * s * 0.2;
    shape(f, (c) => {
      c.moveTo(kx, yb);
      c.lineTo(kx, yb - s * 0.17);
      c.lineTo(kx + s * 0.13, yb - s * 0.17);
      c.quadraticCurveTo(kx + s * 0.13, yb, kx, yb);
      c.closePath();
    }, alpha(f.ink, 0.06));
    rrect(f, kx + s * 0.03, yb - s * 0.26, s * 0.07, s * 0.09, s * 0.015, { fill: f.ink });
  },

  /** Blips appearing one after another, each a step higher. */
  "es-pro-riser-nblips"(f) {
    const { s, w, h } = f;
    const k = prog(f, 0.55);
    const n = 9;
    const shown = Math.ceil(k * n);
    const pt = (i: number) => [w * 0.18 + (i / (n - 1)) * w * 0.64, h * 0.8 - (i / (n - 1)) * h * 0.6] as const;
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i);
      line(f, x, y + s * 0.04, x, h * 0.86, alpha(f.ink, i < shown ? 0.25 : 0.08), f.lw * 0.7);
      if (i >= shown) {
        circle(f, x, y, s * 0.012, { fill: alpha(f.ink, 0.15) });
        continue;
      }
      const latest = i === shown - 1;
      const pop = latest && f.playing ? spring(frac(k * n)) : 1;
      circle(f, x, y, s * 0.035 * pop * (latest ? 1 + 0.4 * hit(f) : 1), latest ? { fill: f.brand, stroke: f.ink } : { stroke: f.ink });
    }
  },

  /** Notes climbing up a music staff, higher and higher. */
  "es-pro-riser-nblips-hi"(f) {
    const { s, cy, w } = f;
    const k = prog(f, 0.6);
    const sp = s * 0.06;
    const x0 = w * 0.14;
    const x1 = w * 0.86;
    for (let i = -2; i <= 2; i++) line(f, x0, cy + i * sp, x1, cy + i * sp, alpha(f.ink, 0.35), f.lw * 0.8);
    const n = 8;
    const shown = Math.ceil(k * n);
    for (let i = 0; i < shown; i++) {
      const x = x0 + s * 0.1 + (i / (n - 1)) * (x1 - x0 - s * 0.2);
      const y = cy + 2.5 * sp - i * sp * 0.75;
      const latest = i === shown - 1;
      ell(f, x, y, sp * 0.62, sp * 0.45, -0.35, { fill: latest ? f.brand : f.ink });
      line(f, x + sp * 0.55, y, x + sp * 0.55, y - sp * 3, f.ink, f.lw * 0.9);
      if (latest && f.playing) sparkle(f, x + sp, y - sp * 3.4, sp * 0.6 * hit(f));
    }
  },

  /** A snare drum with two sticks rolling faster and faster. */
  "es-pro-riser-roll"(f) {
    const { s, cx, cy, t, time } = f;
    const R = s * 0.26;
    const top = cy - s * 0.02;
    const H = s * 0.2;
    stroke(f, (c) => {
      c.moveTo(cx - R, top);
      c.lineTo(cx - R, top + H);
      c.ellipse(cx, top + H, R, R * 0.28, 0, Math.PI, 0, true);
      c.lineTo(cx + R, top);
    });
    ell(f, cx, top, R, R * 0.28, 0, { fill: alpha(f.brand, 0.1 + 0.3 * hit(f)), stroke: f.ink });
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.1 + (i / 6) * 0.8);
      const x = cx + Math.cos(a) * R;
      line(f, x, top + Math.sin(a) * R * 0.28 + s * 0.02, x, top + H + Math.sin(a) * R * 0.28 - s * 0.02, alpha(f.ink, 0.45));
    }
    const ph = f.playing ? time * (12 + 40 * t) : 1.2;
    for (const side of [-1, 1]) {
      const lift = Math.max(0, Math.sin(ph + (side > 0 ? Math.PI : 0)));
      const tx = cx + side * R * 0.25;
      const ty = top - s * 0.01 - lift * s * 0.1;
      line(f, tx, ty, tx + side * s * 0.3, ty - s * 0.14 - lift * s * 0.04, f.ink, f.lw * 1.4);
      if (lift < 0.15) burst(f, tx, top, s * 0.02, s * 0.06, 5, 0.7, f.brand, Math.PI);
    }
  },

  // ---------- Reverse swells ----------

  /** A breath: little puffs drawn in, gathering into one cloud. */
  "es-reverse-swell-breath"(f) {
    const { s, cx, cy } = f;
    const k = prog(f, 0.5);
    shape(f, cloud(cx, cy, s * (0.12 + 0.14 * ease(k))), alpha(f.brand, 0.12 + 0.3 * k));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3;
      const d = lerp(s * 0.5, s * 0.15, ease(k)) * (0.9 + 0.2 * rand(i, 3));
      const r = s * 0.035 * (1 - k * 0.6);
      shape(f, cloud(cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d, r), undefined, alpha(f.ink, 0.6 * (1 - k * 0.7)));
    }
    for (let i = 0; i < 3; i++) {
      const y = cy + (i - 1) * s * 0.06;
      wave(f, cx + s * 0.38, cx + s * 0.62, y, s * 0.012, 2, i, alpha(f.ink, 0.35 * (1 - k)), f.lw * 0.8);
    }
  },

  /** A cymbal on its stand, the shimmer drawn in backwards. */
  "es-reverse-swell-cymbal"(f) {
    const { s, cx, cy, h, time } = f;
    const k = prog(f, 0.5);
    const y = cy - s * 0.08;
    const tilt = -0.12 + (f.playing ? Math.sin(time * 30) * f.level * 0.05 : 0);
    line(f, cx, y, cx, h * 0.86);
    line(f, cx, h * 0.86, cx - s * 0.14, h * 0.92);
    line(f, cx, h * 0.86, cx + s * 0.14, h * 0.92);
    ell(f, cx, y, s * 0.32, s * 0.06, tilt, { fill: alpha(f.brand, 0.15 + 0.4 * k), stroke: f.ink });
    ell(f, cx, y - s * 0.012, s * 0.07, s * 0.022, tilt, { fill: f.ink });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const r0 = lerp(s * 0.62, s * 0.38, ease(k));
      const r1 = r0 + s * 0.06;
      line(f, cx + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.55, cx + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.55, alpha(f.brand, k));
    }
  },

  /** A dark void swelling, swallowing the particles spiralling into it. */
  "es-reverse-swell-dark"(f) {
    const { s, cx, cy, time } = f;
    const k = prog(f, 0.5);
    const R = s * (0.05 + 0.15 * ease(k));
    for (let i = 0; i < 24; i++) {
      const q = frac(rand(i, 1) + (f.playing ? time * 0.7 : 0));
      const r = lerp(s * 0.46, R, q);
      const a = rand(i, 2) * TAU + q * 3;
      circle(f, cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r, s * 0.012 * (1 - q * 0.6), { fill: alpha(i % 3 ? f.ink : f.brand, 0.3 + 0.6 * q) });
    }
    circle(f, cx, cy, R * 1.25, { stroke: alpha(f.brand, 0.5 * k) });
    circle(f, cx, cy, R, { fill: f.ink });
  },

  /** A ring swelling up, then ringing out with a wobble. */
  "es-reverse-swell-ring"(f) {
    const { s, cx, cy, time } = f;
    const k = prog(f, 0.55);
    const R = s * (0.06 + 0.26 * ease(k / 0.75));
    const ring = f.playing && k > 0.7 ? f.level : k > 0.7 ? 0.4 : 0;
    stroke(f, (c) => {
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * TAU;
        const r = R + Math.sin(a * 9 + time * 40) * ring * s * 0.02;
        if (i) c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      c.closePath();
    }, f.brand, f.lw * 1.8);
    circle(f, cx, cy, R * 0.72, { stroke: alpha(f.ink, 0.3) });
    circle(f, cx, cy, R * 0.46, { stroke: alpha(f.ink, 0.18) });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const d = lerp(s * 0.46, R, ease(k));
      circle(f, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * 0.01, { fill: alpha(f.ink, 0.6 * (1 - ease(k))) });
    }
  },

  /** Zoom lines rushing inward, then a slash: the quick reverse into a cut. */
  "es-reverse-swell-short"(f) {
    const { s, cx, cy } = f;
    const k = prog(f, 0.45);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.1;
      const r0 = s * 0.46;
      const r1 = lerp(s * 0.4, s * 0.1, ease(k * 1.5));
      line(f, cx + Math.cos(a) * r0 * 1.3, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1 * 1.3, cy + Math.sin(a) * r1, alpha(i % 2 ? f.ink : f.brand, 0.3 + 0.6 * k));
    }
    const sl = clamp((k - 0.3) * 3);
    if (sl > 0) line(f, cx - s * 0.16, cy + s * 0.22, lerp(cx - s * 0.16, cx + s * 0.16, sl), lerp(cy + s * 0.22, cy - s * 0.22, sl), f.brand, f.lw * 2.4);
  },

  // ---------- Builds ----------

  /** Air rising: wavy updraft lines speeding upward. */
  "es-riser-air"(f) {
    const { s, w, h, t, time, ctx } = f;
    const k = prog(f, 0.5);
    ctx.save();
    ctx.setLineDash([s * 0.08, s * 0.05]);
    for (let i = 0; i < 7; i++) {
      const x = w * (0.2 + i * 0.1);
      ctx.lineDashOffset = f.playing ? time * s * (0.4 + 1.8 * t) + i * s * 0.03 : i * s * 0.04;
      stroke(f, (c) => {
        for (let j = 0; j <= 30; j++) {
          const y = h * 0.86 - (j / 30) * h * 0.72;
          const xx = x + Math.sin(j * 0.45 + i + time * 4) * s * (0.01 + 0.04 * k);
          if (j) c.lineTo(xx, y);
          else c.moveTo(xx, y);
        }
      }, alpha(i % 3 === 1 ? f.brand : f.ink, 0.3 + 0.6 * (i % 3 === 1 ? 1 : k)));
    }
    ctx.restore();
    stroke(f, (c) => {
      c.moveTo(w / 2 - s * 0.05, h * 0.16);
      c.lineTo(w / 2, h * 0.1);
      c.lineTo(w / 2 + s * 0.05, h * 0.16);
    }, f.brand, f.lw * 1.4);
  },

  /** A tower of blocks stacking up faster, crackling as it builds. */
  "es-riser-build"(f) {
    const { s, cx, h, time } = f;
    const k = prog(f, 0.45);
    const gy = h * 0.88;
    const bh = s * 0.085;
    const total = 1 + k * 7.5;
    const n = Math.floor(total);
    ground(f, gy);
    for (let i = 0; i < Math.min(8, n + 1); i++) {
      const drop = i === n ? 1 - ease(frac(total)) : 0;
      if (i === n && !f.playing) continue;
      const x = cx - s * 0.14 + (rand(i, 3) - 0.5) * s * 0.04;
      const y = gy - (i + 1) * bh - drop * s * 0.3;
      rrect(f, x, y, s * 0.28, bh - s * 0.008, s * 0.008, i === n - 1 ? { fill: alpha(f.brand, 0.5), stroke: f.ink } : { stroke: f.ink });
    }
    for (let i = 0; i < 4; i++) {
      const j = Math.floor(time * 12) + i * 7;
      const sx = cx + (rand(j, 1) - 0.5) * s * 0.6;
      const sy = gy - rand(j, 2) * n * bh;
      sparkle(f, sx, sy, s * 0.025 * (f.playing ? f.level : 0.5 * rand(i, 4)));
    }
  },

  /** A field of dark noise filling up from the floor, stuttering as it rises. */
  "es-riser-dark"(f) {
    const { s, w, h, t, time } = f;
    const k = prog(f, 0.55);
    const cols = 20;
    const rows = 10;
    const x0 = w * 0.14;
    const y0 = h * 0.12;
    const cw = (w * 0.72) / cols;
    const ch = (h * 0.76) / rows;
    const flick = f.playing && Math.floor(time * (8 + 24 * t)) % 2 ? 0.92 : 1;
    const levelRows = k * rows * flick;
    for (let r = 0; r < rows; r++) {
      const fromBottom = rows - 1 - r;
      if (fromBottom > levelRows) continue;
      const edge = fromBottom > levelRows - 1;
      for (let c = 0; c < cols; c++) {
        const v = rand(c + r * cols, 3 + Math.floor(time * 10));
        circle(f, x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch, s * 0.008 + v * s * 0.008, { fill: edge ? alpha(f.brand, 0.5 + 0.5 * v) : alpha(f.ink, 0.3 + 0.6 * v) });
      }
    }
  },

  /** A rocket lifting off on a growing flame. */
  "es-riser-rush"(f) {
    const { s, cx, h, time } = f;
    const k = prog(f, 0.45);
    const pad = h * 0.88;
    const [dx] = shake(f, 0.01);
    const x = cx + dx;
    const y = lerp(pad - s * 0.42, h * 0.08, k * k);
    const bw = s * 0.065;
    const d = clamp(k * 2);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      circle(f, cx + side * s * (0.05 + 0.08 * Math.floor(i / 2)) * (0.5 + d), pad - s * 0.03, s * (0.03 + 0.012 * i) * (0.4 + d * 0.6), { stroke: alpha(f.ink, 0.45) });
    }
    line(f, cx - s * 0.3, pad, cx + s * 0.3, pad, alpha(f.ink, 0.5));
    const flick = f.playing ? Math.sin(time * 50) * 0.02 : 0;
    fill(f, (c) => {
      c.moveTo(x - bw * 0.7, y + s * 0.28);
      c.quadraticCurveTo(x, y + s * (0.42 + 0.12 * hit(f) + flick), x + bw * 0.7, y + s * 0.28);
      c.closePath();
    }, f.brand);
    shape(f, (c) => {
      c.moveTo(x, y);
      c.quadraticCurveTo(x + bw, y + s * 0.08, x + bw, y + s * 0.2);
      c.lineTo(x + bw, y + s * 0.28);
      c.lineTo(x - bw, y + s * 0.28);
      c.lineTo(x - bw, y + s * 0.2);
      c.quadraticCurveTo(x - bw, y + s * 0.08, x, y);
      c.closePath();
    }, alpha(f.ink, 0.04));
    circle(f, x, y + s * 0.13, s * 0.024, { fill: alpha(f.brand, 0.7), stroke: f.ink });
    for (const side of [-1, 1]) {
      stroke(f, (c) => {
        c.moveTo(x + side * bw, y + s * 0.17);
        c.lineTo(x + side * (bw + s * 0.05), y + s * 0.3);
        c.lineTo(x + side * bw, y + s * 0.28);
      });
    }
  },

  /** A barber pole: stripes rising forever, the Shepard-tone illusion. */
  "es-riser-shepard"(f) {
    const { s, cx, cy, time } = f;
    const pw = s * 0.17;
    const ph = s * 0.58;
    const x = cx - pw / 2;
    const y = cy - ph / 2;
    const bh = s * 0.07;
    const off = frac(f.playing ? time * 0.9 : 0.2);
    clipRect(f, x, y, pw, ph, () => {
      for (let i = -2; i < 9; i++) {
        const yi = y + ph + pw * 0.6 - (i + off) * bh * 2;
        fill(f, (c) => {
          c.moveTo(x, yi);
          c.lineTo(x + pw, yi - pw * 0.6);
          c.lineTo(x + pw, yi - pw * 0.6 - bh);
          c.lineTo(x, yi - bh);
          c.closePath();
        }, f.brand);
      }
    });
    rrect(f, x, y, pw, ph, s * 0.01);
    rrect(f, x - s * 0.03, y - s * 0.05, pw + s * 0.06, s * 0.05, s * 0.02, { fill: alpha(f.ink, 0.08), stroke: f.ink });
    rrect(f, x - s * 0.03, y + ph, pw + s * 0.06, s * 0.05, s * 0.02, { fill: alpha(f.ink, 0.08), stroke: f.ink });
    circle(f, cx, y - s * 0.075, s * 0.025);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const q = frac(j / 3 + off);
        const ax = cx + side * s * 0.24;
        const ay = lerp(cy + s * 0.22, cy - s * 0.22, q);
        stroke(f, (c) => {
          c.moveTo(ax - s * 0.03, ay + s * 0.025);
          c.lineTo(ax, ay);
          c.lineTo(ax + s * 0.03, ay + s * 0.025);
        }, alpha(f.ink, Math.sin(q * Math.PI) * 0.7));
      }
    }
  },

  /** An arcade claw dropping, closing and snatching the prize up. */
  "es-riser-snatch"(f) {
    const { s, cx, w, h } = f;
    const k = prog(f, 0.4);
    const down = k < 0.6 ? ease(k / 0.6) : 1 - ease((k - 0.72) / 0.28);
    const close = clamp((k - 0.6) / 0.12);
    const top = h * 0.1;
    const cyc = lerp(h * 0.24, h * 0.6, down);
    const L = s * 0.14;
    line(f, w * 0.18, top, w * 0.82, top, alpha(f.ink, 0.4));
    rrect(f, cx - s * 0.05, top - s * 0.025, s * 0.1, s * 0.05, s * 0.01, { fill: alpha(f.ink, 0.1), stroke: f.ink });
    line(f, cx, top + s * 0.025, cx, cyc);
    const prizeY = close >= 1 ? Math.min(h * 0.8, cyc + L * 0.95) : h * 0.8;
    circle(f, cx, prizeY, s * 0.05, { fill: f.brand, stroke: f.ink });
    sparkle(f, cx + s * 0.015, prizeY - s * 0.015, s * 0.018, f.ink);
    line(f, w * 0.25, h * 0.86, w * 0.75, h * 0.86, alpha(f.ink, 0.4));
    circle(f, cx, cyc, s * 0.03, { fill: f.ink });
    const open = lerp(0.85, 0.2, close);
    for (const side of [-1, 1]) {
      const ex = cx + side * Math.sin(open) * L;
      const ey = cyc + Math.cos(open) * L;
      stroke(f, (c) => {
        c.moveTo(cx, cyc);
        c.lineTo(ex, ey);
        c.lineTo(ex - side * s * 0.035, ey + s * 0.04);
      }, f.ink, f.lw * 1.3);
    }
  },

  /** An ocean wave building up and curling over at its crest. */
  "es-riser-swell"(f) {
    const { s, cx, w, h, time } = f;
    const k = prog(f, 0.6);
    const base = h * 0.82;
    const H = s * (0.14 + 0.42 * ease(k));
    const px = cx + s * 0.08;
    const x0 = w * 0.1;
    const x1 = w * 0.9;
    wave(f, x0, x1, base + s * 0.05, s * 0.008, 7, time * 2, alpha(f.ink, 0.3));
    const face: Path = (c) => {
      c.moveTo(x0, base);
      c.bezierCurveTo(cx - s * 0.3, base, px - H * 0.6, base - H * 0.9, px, base - H);
      c.quadraticCurveTo(px + H * 0.5, base - H * 1.0, px + H * 0.45, base - H * 0.6);
      c.quadraticCurveTo(px + H * 0.4, base - H * 0.35, px + H * 0.15, base - H * 0.45);
    };
    stroke(f, face, f.ink, f.lw * 1.3);
    stroke(f, (c) => {
      c.moveTo(px + H * 0.45, base - H * 0.6);
      c.bezierCurveTo(px + H * 0.6, base - H * 0.2, x1 - s * 0.2, base, x1, base);
    });
    wave(f, cx - s * 0.5, px - H * 0.2, base - H * 0.3, s * 0.006, 3, 0, alpha(f.brand, 0.6), f.lw * 0.8);
    for (let i = 0; i < 5; i++) circle(f, px + H * (0.1 + 0.1 * i), base - H * (1.04 + 0.06 * Math.sin(i * 2 + time * 8)), s * 0.012 * (0.6 + hit(f)), { fill: f.brand });
  },

  /** A bow being drawn back tighter and tighter, the string quivering. */
  "es-riser-tension"(f) {
    const { s, cx, cy, time } = f;
    const k = prog(f, 0.45);
    const pull = s * (0.04 + 0.28 * ease(k));
    const bx = cx - s * 0.1;
    const tip = s * 0.36;
    const bend = s * 0.1 + pull * 0.25;
    stroke(f, (c) => {
      c.moveTo(bx, cy - tip);
      c.quadraticCurveTo(bx - bend * 2, cy, bx, cy + tip);
    }, f.ink, f.lw * 1.8);
    rrect(f, bx - bend - s * 0.02, cy - s * 0.05, s * 0.04, s * 0.1, s * 0.01, { fill: f.ink });
    const jit = f.playing ? Math.sin(time * 70) * f.level * s * 0.008 : 0;
    const px = bx + pull;
    const py = cy + jit;
    stroke(f, (c) => {
      c.moveTo(bx, cy - tip);
      c.lineTo(px, py);
      c.lineTo(bx, cy + tip);
    }, alpha(f.ink, 0.8), f.lw * 0.8);
    const ax = px - s * 0.55;
    line(f, px, py, ax, py, f.brand, f.lw * 1.3);
    fill(f, (c) => {
      c.moveTo(ax - s * 0.04, py);
      c.lineTo(ax + s * 0.01, py - s * 0.025);
      c.lineTo(ax + s * 0.01, py + s * 0.025);
      c.closePath();
    }, f.brand);
    for (const side of [-1, 1]) line(f, px - s * 0.01, py, px - s * 0.05, py + side * s * 0.03, f.brand);
    if (k > 0.5) {
      for (const side of [-1, 1]) line(f, bx + s * 0.03, cy + side * (tip - s * 0.02), bx + s * 0.07, cy + side * (tip - s * 0.06), alpha(f.ink, (k - 0.5) * 1.6), f.lw * 0.7);
    }
  },
};

