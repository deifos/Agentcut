// Small motion graphics for the sound effects page: one per category, driven by the sound itself.
// t: 0…1 through the sound; level: its loudness at that moment (0…1, from the decoded envelope).
import type { SfxCategory } from "@/lib/sfx-library";

export interface SfxFrame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** 0…1 through the sound. */
  t: number;
  /** Loudness now, 0…1. */
  level: number;
  /** Seconds since play started (for steady motion). */
  time: number;
  brand: string;
  ink: string;
  /** Stable per-sound variety. */
  seed: number;
}

const TAU = Math.PI * 2;
const rand = (i: number, s: number) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

function alpha(color: string, a: number) {
  // Works for any CSS color the canvas understands.
  return `color-mix(in srgb, ${color} ${Math.round(Math.min(1, Math.max(0, a)) * 100)}%, transparent)`;
}

const draw: Record<SfxCategory, (f: SfxFrame) => void> = {
  click({ ctx, w, h, t, level, brand, ink }) {
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h);
    for (let i = 0; i < 3; i++) {
      const k = Math.min(1, t * 2.2 - i * 0.18);
      if (k <= 0) continue;
      ctx.strokeStyle = alpha(brand, (1 - k) * 0.9);
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.arc(cx, cy, s * (0.08 + 0.32 * ease(k)), 0, TAU);
      ctx.stroke();
    }
    // A cursor that presses in on the loud moment.
    const press = 1 - 0.18 * level;
    ctx.save();
    ctx.translate(cx + s * 0.03, cy + s * 0.03);
    ctx.scale(press, press);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 0.22);
    ctx.lineTo(s * 0.06, s * 0.16);
    ctx.lineTo(s * 0.1, s * 0.25);
    ctx.lineTo(s * 0.14, s * 0.23);
    ctx.lineTo(s * 0.1, s * 0.14);
    ctx.lineTo(s * 0.17, s * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  pop({ ctx, w, h, t, level, brand, seed }) {
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h);
    const k = ease(t * 3);
    const r = s * (0.06 + 0.16 * k + 0.08 * level);
    ctx.fillStyle = brand;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + seed;
      const d = s * (0.22 + 0.2 * ease(t * 2));
      ctx.fillStyle = alpha(brand, 1 - t);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s * 0.02 * (1 - t), 0, TAU);
      ctx.fill();
    }
  },
  swoosh({ ctx, w, h, t, level, brand, ink }) {
    const y = h / 2;
    const x = -w * 0.3 + w * 1.6 * ease(t);
    for (let i = 0; i < 4; i++) {
      const len = w * (0.35 - i * 0.06);
      const yy = y + (i - 1.5) * h * 0.08;
      const g = ctx.createLinearGradient(x - len, 0, x, 0);
      g.addColorStop(0, alpha(i % 2 ? ink : brand, 0));
      g.addColorStop(1, alpha(i % 2 ? ink : brand, 0.25 + 0.75 * level));
      ctx.strokeStyle = g;
      ctx.lineWidth = h * (0.02 + 0.03 * level) * (1 - i * 0.15);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - len, yy);
      ctx.lineTo(x, yy);
      ctx.stroke();
    }
  },
  whoosh({ ctx, w, h, t, level, brand }) {
    const cx = w / 2;
    const cy = h * 0.95;
    const R = Math.min(w, h * 1.4) * 0.6;
    const a = Math.PI * (1.05 + 0.9 * ease(t));
    for (let i = 0; i < 26; i++) {
      const ai = a - i * 0.05;
      const k = 1 - i / 26;
      ctx.fillStyle = alpha(brand, k * (0.3 + 0.7 * level));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ai) * R, cy + Math.sin(ai) * R, Math.min(w, h) * 0.05 * k, 0, TAU);
      ctx.fill();
    }
  },
  impact({ ctx, w, h, t, level, brand, ink }) {
    const shake = level * Math.min(w, h) * 0.03;
    const cx = w / 2 + (Math.random() - 0.5) * shake;
    const cy = h / 2 + (Math.random() - 0.5) * shake;
    const s = Math.min(w, h);
    for (let i = 0; i < 2; i++) {
      const k = Math.min(1, t * 1.6 - i * 0.15);
      if (k <= 0) continue;
      ctx.strokeStyle = alpha(brand, 1 - k);
      ctx.lineWidth = s * 0.04 * (1 - k);
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.48 * ease(k), 0, TAU);
      ctx.stroke();
    }
    const squash = 1 + 0.25 * level;
    ctx.fillStyle = ink;
    ctx.fillRect(cx - (s * 0.12 * squash) / 2, cy - s * 0.12 / squash / 2, s * 0.12 * squash, (s * 0.12) / squash);
  },
  riser({ ctx, w, h, t, level, brand }) {
    const n = 14;
    const bw = w / (n * 1.6);
    for (let i = 0; i < n; i++) {
      const k = Math.min(1, t * 1.15 + Math.sin(i * 1.7) * 0.05);
      const bh = h * (0.1 + 0.7 * ease(k) * (0.5 + 0.5 * level)) * (0.6 + 0.4 * Math.sin(i * 0.9 + t * 9));
      ctx.fillStyle = alpha(brand, 0.35 + 0.65 * (i / n));
      ctx.fillRect(w / 2 - (n * bw * 1.6) / 2 + i * bw * 1.6, h * 0.88 - bh, bw, bh);
    }
  },
  sting({ ctx, w, h, t, level, brand, ink }) {
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const r0 = s * 0.14;
      const r1 = r0 + s * 0.28 * ease(t * 1.6) * (0.4 + 0.6 * level);
      ctx.strokeStyle = alpha(brand, 1 - t * 0.6);
      ctx.lineWidth = s * 0.018;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ease(t * 1.4) * Math.PI * 0.5);
    ctx.fillStyle = ink;
    const q = s * (0.1 + 0.03 * level);
    ctx.beginPath();
    ctx.roundRect(-q, -q, q * 2, q * 2, q * 0.3);
    ctx.fill();
    ctx.restore();
  },
  notify({ ctx, w, h, t, level, brand, ink }) {
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h);
    for (let i = 0; i < 2; i++) {
      const k = Math.min(1, t * 1.8 - i * 0.25);
      if (k <= 0) continue;
      ctx.strokeStyle = alpha(brand, 1 - k);
      ctx.lineWidth = s * 0.015;
      ctx.beginPath();
      ctx.arc(cx, cy, s * (0.16 + 0.24 * ease(k)), 0, TAU);
      ctx.stroke();
    }
    const tilt = Math.sin(t * 28) * 0.35 * (1 - t) * (0.3 + level);
    ctx.save();
    ctx.translate(cx, cy - s * 0.1);
    ctx.rotate(tilt);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.16);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.02, 0, -s * 0.04);
    ctx.quadraticCurveTo(s * 0.1, -s * 0.02, s * 0.1, s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = brand;
    ctx.beginPath();
    ctx.arc(cx + s * 0.1, cy - s * 0.12, s * (0.03 + 0.02 * level), 0, TAU);
    ctx.fill();
  },
  shimmer({ ctx, w, h, t, level, brand, seed }) {
    for (let i = 0; i < 18; i++) {
      const x = rand(i, seed) * w;
      const y = rand(i, seed + 1) * h;
      const tw = Math.max(0, Math.sin((t * 3 + rand(i, seed + 2)) * Math.PI));
      const r = Math.min(w, h) * (0.01 + 0.035 * tw * (0.4 + level));
      ctx.fillStyle = alpha(brand, tw);
      ctx.beginPath();
      ctx.moveTo(x, y - r * 2);
      ctx.lineTo(x + r * 0.5, y - r * 0.5);
      ctx.lineTo(x + r * 2, y);
      ctx.lineTo(x + r * 0.5, y + r * 0.5);
      ctx.lineTo(x, y + r * 2);
      ctx.lineTo(x - r * 0.5, y + r * 0.5);
      ctx.lineTo(x - r * 2, y);
      ctx.lineTo(x - r * 0.5, y - r * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  },
  glitch({ ctx, w, h, level, brand, ink, time }) {
    const rows = 9;
    for (let i = 0; i < rows; i++) {
      const jitter = (rand(i, Math.floor(time * 24)) - 0.5) * w * 0.25 * level;
      const y = (i / rows) * h;
      ctx.fillStyle = i % 3 === 0 ? brand : alpha(ink, 0.6 + 0.4 * level);
      ctx.fillRect(w * 0.2 + jitter, y + h * 0.02, w * 0.6 * (0.6 + 0.4 * rand(i, 3)), h / rows - h * 0.03);
    }
  },
  typing({ ctx, w, h, t, level, brand, ink }) {
    const cols = 8;
    const rows = 3;
    const kw = (w * 0.7) / cols;
    const lit = Math.floor(t * cols * rows * 1.2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const on = i === lit % (cols * rows);
        const x = w * 0.15 + c * kw;
        const y = h * 0.28 + r * kw;
        const press = on ? kw * 0.08 * (0.5 + level) : 0;
        ctx.fillStyle = on ? brand : alpha(ink, 0.18);
        ctx.beginPath();
        ctx.roundRect(x + kw * 0.06, y + kw * 0.06 + press, kw * 0.88, kw * 0.88, kw * 0.18);
        ctx.fill();
      }
    }
  },
  foley({ ctx, w, h, t, level, brand, ink }) {
    // A camera iris closing and opening.
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h);
    const close = Math.sin(Math.min(1, t * 1.4) * Math.PI) * (0.5 + 0.5 * level);
    ctx.fillStyle = alpha(ink, 0.12);
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.36, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + close * 0.9;
      ctx.fillStyle = i % 2 ? brand : alpha(brand, 0.75);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s * 0.36, cy + Math.sin(a) * s * 0.36);
      ctx.lineTo(cx + Math.cos(a + 1.1) * s * 0.36, cy + Math.sin(a + 1.1) * s * 0.36);
      ctx.lineTo(cx + Math.cos(a + 0.6) * s * 0.36 * (1 - close * 0.95), cy + Math.sin(a + 0.6) * s * 0.36 * (1 - close * 0.95));
      ctx.closePath();
      ctx.fill();
    }
  },
  divider({ ctx, w, h, t, level, brand, ink }) {
    const k = ease(t * 1.3);
    ctx.fillStyle = alpha(ink, 0.15);
    ctx.fillRect(w * 0.1, h / 2 - 2, w * 0.8, 4);
    ctx.fillStyle = brand;
    ctx.fillRect(w * 0.1, h / 2 - h * (0.01 + 0.03 * level), w * 0.8 * k, h * (0.02 + 0.06 * level));
    for (let i = 0; i < 6; i++) {
      const x = w * 0.1 + w * 0.8 * k - i * w * 0.05;
      ctx.fillStyle = alpha(brand, (1 - i / 6) * level);
      ctx.fillRect(x, h / 2 - h * 0.15, w * 0.01, h * 0.3);
    }
  },
};

export function drawSfx(category: SfxCategory, f: SfxFrame) {
  const { ctx, w, h } = f;
  ctx.clearRect(0, 0, w, h);
  draw[category](f);
}

/** A loudness envelope (0…1 per 10 ms) of a decoded sound, normalized to its peak. */
export function envelopeOf(buffer: AudioBuffer): Float32Array {
  const hop = Math.max(1, Math.floor(buffer.sampleRate / 100));
  const n = Math.ceil(buffer.length / hop);
  const env = new Float32Array(n);
  const ch = buffer.getChannelData(0);
  let max = 1e-6;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    const end = Math.min(buffer.length, (i + 1) * hop);
    for (let j = i * hop; j < end; j++) sum += ch[j] * ch[j];
    env[i] = Math.sqrt(sum / Math.max(1, end - i * hop));
    max = Math.max(max, env[i]);
  }
  for (let i = 0; i < n; i++) env[i] = Math.min(1, Math.pow(env[i] / max, 0.6));
  return env;
}
