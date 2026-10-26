// Scenes for logo stings, chimes and notifications, shimmers, glitches and dividers: each one draws what
// the sound is (a hand bell, a kalimba, a tuning fork, a CRT switching off, a cracked screen…).
import {
  type Frame,
  type Scene,
  TAU,
  alpha,
  burst,
  circle,
  clamp,
  ease,
  easeInOut,
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

// ---------- private helpers ----------

/** Decay after a strike at `at`: 0 before, 1 at the strike, fading with time constant d. */
const dec = (t: number, at: number, d = 0.15) => (t < at ? 0 : Math.exp(-(t - at) / d));
const frac = (v: number) => v - Math.floor(v);

function starPath(c: CanvasRenderingContext2D, x: number, y: number, r: number, n = 5, inner = 0.45) {
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (i / (n * 2)) * TAU;
    if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
}

/** An eighth note with its head at (x, y), `size` tall. */
function note(f: Frame, x: number, y: number, size: number, color = f.ink) {
  fill(f, (c) => c.ellipse(x, y, size * 0.3, size * 0.22, -0.4, 0, TAU), color);
  line(f, x + size * 0.27, y - size * 0.05, x + size * 0.27, y - size, color);
  stroke(f, (c) => {
    c.moveTo(x + size * 0.27, y - size);
    c.quadraticCurveTo(x + size * 0.62, y - size * 0.72, x + size * 0.55, y - size * 0.42);
  }, color);
}

/** The logo mark used by the stings: a brand tile with a play cut. */
function logo(f: Frame, x: number, y: number, r: number, filled = true) {
  if (r <= 0) return;
  rrect(f, x - r, y - r, r * 2, r * 2, r * 0.35, filled ? { fill: f.brand } : { stroke: f.ink });
  fill(f, (c) => {
    c.moveTo(x - r * 0.28, y - r * 0.4);
    c.lineTo(x + r * 0.45, y);
    c.lineTo(x - r * 0.28, y + r * 0.4);
    c.closePath();
  }, filled ? f.ink : f.brand);
}

/** Sound arcs leaving (x, y) toward `dir`; they travel while playing and follow the loudness. */
function waves(f: Frame, x: number, y: number, r0: number, step: number, dir: number, spread = 0.6, n = 3, color = f.brand) {
  const ph = f.playing ? frac(f.time * 1.6) : 0.35;
  for (let i = 0; i < n; i++) {
    const p = (i + ph) / n;
    const a = clamp(f.level * 1.4) * (1 - p);
    if (a <= 0.02) continue;
    stroke(f, (c) => c.arc(x, y, r0 + step * (i + ph), dir - spread, dir + spread), alpha(color, a));
  }
}

function bellPath(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.moveTo(x - r, y + r * 0.7);
  c.quadraticCurveTo(x - r * 0.85, y - r * 0.1, x - r * 0.55, y - r * 0.6);
  c.quadraticCurveTo(x, y - r * 1.05, x + r * 0.55, y - r * 0.6);
  c.quadraticCurveTo(x + r * 0.85, y - r * 0.1, x + r, y + r * 0.7);
  c.closePath();
}

/** Five stacked steps on the right: which of the five semitone dings this is. */
function pitchLadder(f: Frame, idx: number) {
  const { s, cx, cy } = f;
  for (let i = 0; i < 5; i++) {
    const y = cy + s * 0.2 - i * s * 0.1;
    rrect(f, cx + s * 0.46, y - s * 0.016, s * 0.1, s * 0.032, s * 0.016, i === idx ? { fill: f.brand } : { stroke: alpha(f.ink, 0.3) });
  }
}

function kalimba(f: Frame, pluck: number[], opts: { tilt?: number; ring?: boolean; thumb?: boolean } = {}) {
  const { s, cx, cy, t, level, brand, ink, time, lw } = f;
  const bw = s * 0.6;
  const bh = s * 0.74;
  withT(f, cx, cy, opts.tilt ?? 0, 1, () => {
    rrect(f, -bw / 2, -bh / 2, bw, bh, s * 0.12, { fill: alpha(ink, 0.04), stroke: ink });
    circle(f, 0, bh * 0.28, s * 0.06);
    line(f, -bw * 0.38, -bh * 0.3, bw * 0.38, -bh * 0.3, ink, lw * 1.8);
    for (let i = 0; i < 7; i++) {
      const tx = (i - 3) * bw * 0.1;
      const len = s * (0.42 - Math.abs(i - 3) * 0.045);
      const top = -bh * 0.42;
      const on = pluck.includes(i);
      let vib = 0;
      if (on) vib = f.playing ? Math.sin(time * (55 + i * 9)) * s * 0.014 * level : s * 0.008;
      if (opts.thumb && on && f.playing && t < 0.12) vib = s * 0.03 * (t / 0.12);
      if (on) {
        stroke(f, (c) => {
          c.moveTo(tx, top);
          c.quadraticCurveTo(tx - vib, top + len * 0.6, tx - vib * 1.6, top + len);
        }, alpha(brand, 0.35), lw * 1.4);
      }
      stroke(f, (c) => {
        c.moveTo(tx, top);
        c.quadraticCurveTo(tx + vib, top + len * 0.6, tx + vib * 1.6, top + len);
      }, on ? brand : ink, lw * 1.4);
      if (opts.thumb && on) {
        const away = f.playing ? ease((t - 0.12) * 4) : 0.5;
        withT(f, tx + vib * 1.6 + s * 0.05 + away * s * 0.08, top + len + s * 0.02 + away * s * 0.06, -0.6, 1, () => {
          rrect(f, -s * 0.055, -s * 0.03, s * 0.11, s * 0.22, s * 0.055, { fill: alpha(brand, 0.22), stroke: ink });
          stroke(f, (c) => c.arc(0, s * 0.01, s * 0.03, Math.PI * 1.1, Math.PI * 1.9), alpha(ink, 0.6));
        });
      }
    }
  });
  if (opts.ring) {
    waves(f, cx, cy - bh / 2, s * 0.04, s * 0.05, -Math.PI / 2, 0.8, 3);
    waves(f, cx - bw / 2, cy, s * 0.04, s * 0.05, Math.PI, 0.5, 2);
    waves(f, cx + bw / 2, cy, s * 0.04, s * 0.05, 0, 0.5, 2);
  } else {
    waves(f, cx + bw / 2 + s * 0.02, cy - s * 0.05, s * 0.03, s * 0.05, 0, 0.55, 3);
  }
}

/** A notification ding: an icon that springs in, the pitch ladder and a ring. */
function ding(f: Frame, idx: number, draw: (k: number) => void) {
  const { s, cx, cy, t } = f;
  const k = f.playing ? Math.min(1.15, spring(t * 3.2)) : 1;
  withT(f, cx - s * 0.12, cy, 0, k, () => draw(k));
  pitchLadder(f, idx);
  ripples(f, cx - s * 0.12, cy, f.playing ? clamp(t * 1.6) : 0.35, s * 0.42, 2);
}

/** Card-ish picture used inside glitch frames: a sun, hills and a horizon. */
function scenery(f: Frame, x: number, y: number, w: number, h: number, color = f.ink) {
  circle(f, x + w * 0.7, y + h * 0.32, h * 0.13, { stroke: color === f.ink ? f.brand : color });
  stroke(f, (c) => {
    c.moveTo(x + w * 0.05, y + h * 0.82);
    c.lineTo(x + w * 0.3, y + h * 0.45);
    c.lineTo(x + w * 0.48, y + h * 0.68);
    c.lineTo(x + w * 0.6, y + h * 0.55);
    c.lineTo(x + w * 0.95, y + h * 0.82);
  }, color);
}

// ---------- scenes ----------

export const tonalGlitchScenes: Record<string, Scene> = {
  // ===== logo stings =====
  "es-logo-sting-soft-bloom": (f) => {
    // A flower opening its petals into the logo, then a soft chime ring.
    const { s, cx, cy, t, brand } = f;
    const open = ease(t * 1.8);
    for (let i = 0; i < 6; i++) {
      withT(f, cx, cy, (i / 6) * TAU - Math.PI / 2 + open * 0.3, 1, () => {
        stroke(f, (c) => c.ellipse(s * (0.07 + 0.13 * open), 0, s * (0.05 + 0.09 * open), s * (0.02 + 0.045 * open), 0, 0, TAU), alpha(brand, 0.35 + 0.65 * open));
      });
    }
    logo(f, cx, cy, s * 0.075 * spring(t * 2.4 - 0.35));
    ripples(f, cx, cy, clamp((t - 0.55) * 2), s * 0.42, 2);
  },
  "es-logo-sting-spark": (f) => {
    // A spark flies in on a curve and ignites a star.
    const { s, cx, cy, t, level, brand } = f;
    const x0 = cx - s * 0.6;
    const y0 = cy + s * 0.32;
    const pt = (u: number) => {
      const a = 1 - u;
      return [a * a * x0 + 2 * a * u * (cx - s * 0.45) + u * u * cx, a * a * y0 + 2 * a * u * (cy - s * 0.35) + u * u * cy] as const;
    };
    const p = ease(t / 0.35);
    for (let i = 0; i < 14; i++) {
      const u = p - i * 0.035;
      if (u < 0) break;
      const [x, y] = pt(u);
      circle(f, x, y, s * 0.012 * (1 - i / 14), { fill: alpha(brand, (1 - i / 14) * (t < 0.45 ? 1 : 0.4)) });
    }
    if (p < 1) {
      const [x, y] = pt(p);
      sparkle(f, x, y, s * 0.05);
    }
    const k = clamp((t - 0.33) * 2.5);
    if (k > 0) {
      const r = s * 0.17 * Math.min(1.15, spring(k));
      fill(f, (c) => starPath(c, cx, cy, r), alpha(brand, 0.85));
      stroke(f, (c) => starPath(c, cx, cy, r));
      burst(f, cx, cy, s * 0.22, s * 0.36, 10, clamp(k * 1.5), brand);
      sparkle(f, cx + s * 0.28, cy - s * 0.22, s * 0.05 * clamp(level * 2) * k);
    }
  },
  "es-logo-sting-whoosh-glass": (f) => {
    // Air rushes into a glass tile; a glint sweeps across it and leaves a sparkle.
    const { ctx, s, cx, cy, t, level, brand, ink } = f;
    const R = s * 0.27;
    speedLines(f, cx - R - s * 0.04, cy, 0, s * 0.35, s * 0.3, 5, clamp(1 - t * 1.6), ink);
    rrect(f, cx - R, cy - R, R * 2, R * 2, R * 0.3, { stroke: ink });
    rrect(f, cx - R * 0.8, cy - R * 0.8, R * 1.6, R * 1.6, R * 0.22, { stroke: alpha(ink, 0.25) });
    stroke(f, (c) => {
      c.moveTo(cx, cy - R * 0.45);
      c.lineTo(cx + R * 0.45, cy);
      c.lineTo(cx, cy + R * 0.45);
      c.lineTo(cx - R * 0.45, cy);
      c.closePath();
    }, brand, f.lw * 1.6);
    const gx = cx - R * 1.6 + R * 3.2 * easeInOut(clamp((t - 0.15) * 1.6));
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx - R, cy - R, R * 2, R * 2, R * 0.3);
    ctx.clip();
    fill(f, (c) => {
      c.moveTo(gx - R * 0.25, cy + R);
      c.lineTo(gx + R * 0.05, cy + R);
      c.lineTo(gx + R * 0.45, cy - R);
      c.lineTo(gx + R * 0.15, cy - R);
      c.closePath();
    }, alpha(brand, 0.25 + 0.3 * level));
    ctx.restore();
    const k = clamp((t - 0.7) * 3);
    if (k > 0) sparkle(f, cx + R * 0.85, cy - R * 0.85, s * 0.07 * Math.sin(k * Math.PI));
  },
  "es-pro-logo-sting-chirp-hum": (f) => {
    // A quick rising chirp, then the logo hums inside a vibrating ring.
    const { s, cx, cy, t, level, brand, ink, time } = f;
    const chirpA = f.playing ? clamp(1 - Math.max(0, t - 0.3) * 3) : 0.7;
    wave(f, cx - s * 0.62, cx - s * 0.2, cy, (u) => s * 0.08 * Math.sin(u * Math.PI), (u) => 0.5 + u * 3, 0, alpha(ink, chirpA));
    const hum = f.playing ? clamp((t - 0.25) * 4) : 0.8;
    const R = s * 0.2;
    const x = cx + s * 0.25;
    stroke(f, (c) => {
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * TAU;
        const r = R + Math.sin(a * 9 + time * 18) * s * 0.018 * hum * (0.3 + level);
        if (i === 0) c.moveTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
        else c.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      c.closePath();
    }, brand);
    circle(f, x, cy, R * 1.3, { stroke: alpha(ink, 0.15 + 0.15 * hum) });
    logo(f, x, cy, s * 0.08 * (0.85 + 0.15 * hum));
  },
  "es-pro-logo-sting-swell-sting": (f) => {
    // A crescendo hairpin opens and stings into the logo.
    const { s, cx, cy, t, level, brand, ink } = f;
    const g = ease(t * 1.7);
    const x0 = cx - s * 0.62;
    const x1 = x0 + s * 0.62 * g;
    const open = s * 0.2 * g;
    fill(f, (c) => {
      c.moveTo(x1, cy - open);
      c.lineTo(x0, cy);
      c.lineTo(x1, cy + open);
      c.closePath();
    }, alpha(brand, 0.12 + 0.25 * level));
    stroke(f, (c) => {
      c.moveTo(x1, cy - open);
      c.lineTo(x0, cy);
      c.lineTo(x1, cy + open);
    }, ink, f.lw * 1.4);
    const k = clamp((t - 0.58) * 2.5);
    const lx = cx + s * 0.27;
    if (k > 0) {
      logo(f, lx, cy, s * 0.11 * Math.min(1.2, spring(k)));
      burst(f, lx, cy, s * 0.16, s * 0.3, 12, k, brand);
    } else {
      rrect(f, lx - s * 0.11, cy - s * 0.11, s * 0.22, s * 0.22, s * 0.04, { stroke: alpha(ink, 0.3) });
    }
  },
  "es-pro-logo-sting-taps-tone": (f) => {
    // Three taps, then a held tone runs into the logo.
    const { s, cx, cy, t, brand, ink, time } = f;
    [0.06, 0.14, 0.22].forEach((at, i) => {
      const x = cx - s * 0.56 + i * s * 0.14;
      const on = t >= at;
      circle(f, x, cy, s * 0.028, on ? { fill: i === 2 ? brand : ink } : { stroke: alpha(ink, 0.3) });
      if (on) ripples(f, x, cy, clamp((t - at) * 5), s * 0.09, 2);
    });
    const k = ease((t - 0.26) * 2.5);
    const xa = cx - s * 0.16;
    if (k > 0) wave(f, xa, xa + s * 0.38 * k, cy, s * 0.03, 4 * k, time * 12, brand);
    logo(f, cx + s * 0.38, cy, s * 0.1, k > 0.95);
  },
  "es-pro-logo-sting-zap-bloom": (f) => {
    // A lightning bolt zaps, then the logo blooms in soft rings.
    const { s, cx, cy, t, level, brand, ink } = f;
    const z = t < 0.3 ? 1 : clamp(1 - (t - 0.3) * 2.5) * 0.7 + 0.3;
    const bx = cx - s * 0.28;
    const P: [number, number][] = [[0.04, -0.42], [-0.1, -0.04], [0, -0.04], [-0.06, 0.24], [0.12, -0.12], [0.02, -0.12], [0.12, -0.42]];
    const path = (c: CanvasRenderingContext2D) => {
      P.forEach(([x, y], i) => (i ? c.lineTo(bx + x * s, cy + y * s) : c.moveTo(bx + x * s, cy + y * s)));
      c.closePath();
    };
    fill(f, path, alpha(brand, 0.25 + 0.75 * z * (f.playing ? Math.max(level, 0.3) : 1)));
    stroke(f, path, ink);
    const k = clamp((t - 0.25) * 1.8);
    const lx = cx + s * 0.22;
    for (let i = 0; i < 3; i++) {
      circle(f, lx, cy, s * (0.12 + 0.09 * i) * ease(k), { fill: alpha(brand, 0.14 * (1 - i * 0.25)) });
    }
    logo(f, lx, cy, s * 0.09 * (k > 0 ? Math.min(1.15, spring(k * 1.5)) : 0));
    if (k <= 0) rrect(f, lx - s * 0.09, cy - s * 0.09, s * 0.18, s * 0.18, s * 0.03, { stroke: alpha(ink, 0.3) });
  },

  // ===== mallets, bells and notifications =====
  "es-mallet-celesta": (f) => {
    // A little celesta: a key goes down, a bell plate inside rings, a note floats up.
    const { s, cx, cy, t, level, brand, ink } = f;
    const n = 8;
    const kw = s * 0.11;
    const x0 = cx - (kw * n) / 2;
    const y0 = cy - s * 0.02;
    const kh = s * 0.34;
    const hit = 4;
    const press = f.playing ? level : 0.6;
    rrect(f, x0 - s * 0.03, y0 - s * 0.2, kw * n + s * 0.06, s * 0.16, s * 0.03, { stroke: ink });
    for (let i = 0; i < n; i++) {
      const px = x0 + i * kw + kw * 0.5;
      line(f, px, y0 - s * 0.16, px, y0 - s * 0.08, i === hit ? alpha(brand, 0.4 + 0.6 * press) : alpha(ink, 0.3), f.lw * 1.4);
    }
    for (let i = 0; i < n; i++) {
      const down = i === hit ? s * 0.018 * press : 0;
      rrect(f, x0 + i * kw, y0 + down, kw, kh, kw * 0.12, i === hit ? { fill: alpha(brand, 0.25 + 0.6 * press), stroke: ink } : { stroke: ink });
    }
    for (const i of [0, 1, 3, 4, 5]) rrect(f, x0 + (i + 1) * kw - kw * 0.3, y0, kw * 0.6, kh * 0.58, kw * 0.08, { fill: ink });
    const u = f.playing ? t : 0.4;
    note(f, x0 + hit * kw + kw * 0.5 + s * 0.08, y0 - s * 0.25 - u * s * 0.08, s * 0.1, alpha(brand, 1 - u * 0.7));
    sparkle(f, x0 + hit * kw - s * 0.06, y0 - s * 0.28, s * 0.03 * press);
  },
  "es-mallet-flourish": (f) => {
    // Three notes pop along an arc, one after the other.
    const { ctx, s, cx, cy, t, brand, ink, lw } = f;
    const pt = (u: number) => [cx + (u - 0.5) * s * 1.0, cy + s * 0.24 - Math.sin(u * Math.PI) * s * 0.42] as [number, number];
    ctx.setLineDash([lw * 1.5, lw * 3]);
    stroke(f, (c) => {
      for (let i = 0; i <= 40; i++) {
        const [x, y] = pt(i / 40);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
    }, alpha(ink, 0.35));
    ctx.setLineDash([]);
    [0.12, 0.5, 0.88].forEach((u, i) => {
      const at = 0.05 + i * 0.12;
      const [x, y] = pt(u);
      if (t >= at) {
        note(f, x, y, s * 0.14 * Math.min(1.2, spring((t - at) * 4)), i === 1 ? brand : ink);
        ripples(f, x, y, clamp((t - at) * 3), s * 0.1, 2);
      } else circle(f, x, y, s * 0.02, { stroke: alpha(ink, 0.3) });
    });
  },
  "es-mallet-glock": (f) => {
    // Glockenspiel bars; two mallets strike an octave apart.
    const { s, cx, cy, t, level, brand, ink, time } = f;
    const n = 8;
    const gap = s * 0.115;
    const bw = s * 0.075;
    const x0 = cx - (gap * (n - 1)) / 2;
    line(f, x0 - gap * 0.6, cy - s * 0.2, x0 + gap * (n - 1) + gap * 0.6, cy - s * 0.13, alpha(ink, 0.3));
    line(f, x0 - gap * 0.6, cy + s * 0.2, x0 + gap * (n - 1) + gap * 0.6, cy + s * 0.13, alpha(ink, 0.3));
    const heads: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap;
      const h = s * (0.56 - i * 0.035);
      const hit = i === 1 || i === 5;
      const v = hit && f.playing ? Math.sin(time * 70) * s * 0.004 * level : 0;
      rrect(f, x - bw / 2 + v, cy - h / 2, bw, h, bw * 0.25, hit ? { fill: alpha(brand, 0.3 + 0.6 * (f.playing ? level : 0.5)), stroke: ink } : { stroke: ink });
      circle(f, x + v, cy - h / 2 + bw * 0.4, s * 0.008, { fill: ink });
      circle(f, x + v, cy + h / 2 - bw * 0.4, s * 0.008, { fill: ink });
      if (hit) heads.push([x, cy + s * 0.04]);
    }
    const lift = f.playing ? s * 0.12 * (1 - dec(t, 0, 0.08)) : s * 0.05;
    for (const [x, y] of heads) {
      const hx = x + lift * 0.6;
      const hy = y + lift;
      line(f, hx, hy, hx + s * 0.08, hy + s * 0.22, ink, f.lw * 1.4);
      circle(f, hx, hy, s * 0.03, { fill: brand, stroke: ink });
    }
  },
  "es-mallet-marimba": (f) => {
    // Wooden marimba bars over resonator tubes; the G bar is struck from above.
    const { s, cx, cy, t, level, brand, ink, time } = f;
    const n = 7;
    const gap = s * 0.15;
    const bw = s * 0.12;
    const yb = cy - s * 0.24;
    line(f, cx - gap * 3.6, yb + s * 0.085, cx + gap * 3.6, yb + s * 0.085, alpha(ink, 0.4));
    const hit = 3;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - 3) * gap;
      const on = i === hit;
      const by = on && f.playing ? yb + Math.sin(time * 60) * s * 0.004 * level : yb;
      const tube = s * (0.52 - i * 0.05);
      rrect(f, x - bw * 0.22, yb + s * 0.1, bw * 0.44, tube, bw * 0.2, { stroke: alpha(ink, 0.5), fill: on ? alpha(brand, 0.35 * (f.playing ? level : 0.5)) : undefined });
      rrect(f, x - bw / 2, by, bw, s * 0.07, s * 0.015, { fill: on ? alpha(brand, 0.5) : alpha(ink, 0.07), stroke: ink });
      line(f, x - bw * 0.35, by + s * 0.035, x + bw * 0.3, by + s * 0.03, alpha(ink, 0.25), f.lw * 0.7);
    }
    const lift = f.playing ? s * 0.08 * (1 - dec(t, 0, 0.1)) : s * 0.04;
    const hx = cx + (hit - 3) * gap;
    const hy = yb - s * 0.035 - lift;
    line(f, hx, hy, hx + s * 0.3, hy - s * 0.08, ink, f.lw * 1.4);
    circle(f, hx, hy, s * 0.035, { fill: alpha(ink, 0.85) });
  },
  "es-mallet-pluck": (f) => {
    // A felt pick pulls a thick low string between two pegs and lets go; it swings slowly.
    const { s, cx, cy, t, level, brand, ink, time, lw } = f;
    const x0 = cx - s * 0.56;
    const x1 = cx + s * 0.56;
    const px = cx - s * 0.12;
    const sw = lw * 3;
    // Pegs with tuning keys and saddles.
    for (const [x, dir] of [[x0, -1], [x1, 1]] as const) {
      rrect(f, x - s * 0.025, cy - s * 0.015, s * 0.05, s * 0.07, s * 0.012, { fill: alpha(ink, 0.15), stroke: ink });
      line(f, x, cy, x + dir * s * 0.05, cy, ink, lw * 1.6);
      rrect(f, x + dir * s * 0.05 - s * 0.02, cy - s * 0.035, s * 0.04, s * 0.07, s * 0.015, { fill: ink });
      circle(f, x, cy, s * 0.022, { fill: ink });
    }
    const pulling = f.playing ? t < 0.08 : true;
    const depth = f.playing ? (t / 0.08) * s * 0.14 : s * 0.13;
    const amp = s * 0.12 * (f.playing ? Math.max(0.35, level) : 0.9);
    const bow = (k: number, color: string, width: number) =>
      stroke(f, (c) => {
        for (let i = 0; i <= 48; i++) {
          const u = i / 48;
          const y = cy + Math.sin(u * Math.PI) * amp * k;
          if (i === 0) c.moveTo(lerp(x0, x1, u), y);
          else c.lineTo(lerp(x0, x1, u), y);
        }
      }, color, width);
    // Ghost outlines of the swing.
    bow(1, alpha(ink, 0.18), sw);
    bow(-1, alpha(ink, 0.18), sw);
    bow(0.5, alpha(ink, 0.1), sw);
    bow(-0.5, alpha(ink, 0.1), sw);
    if (pulling) {
      stroke(f, (c) => {
        c.moveTo(x0, cy);
        c.lineTo(px, cy + depth);
        c.lineTo(x1, cy);
      }, ink, sw);
    } else {
      bow(Math.cos(time * 22), ink, sw);
    }
    // The felt pick: tip on the string while pulling, falling away after the release.
    const away = pulling ? 0 : ease((t - 0.08) * 3);
    const r = s * 0.075;
    const kx = px - away * s * 0.14;
    const ky = (pulling ? cy + depth : cy + s * 0.04) + r * 0.9 + away * s * 0.1;
    withT(f, kx, ky, pulling ? 0 : -away * 0.8, 1, () => {
      const pick = (c: CanvasRenderingContext2D) => {
        c.moveTo(0, -r * 0.9);
        c.bezierCurveTo(r * 0.5, -r * 0.6, r * 1.1, r * 0.2, r * 0.6, r * 0.7);
        c.quadraticCurveTo(0, r * 1.0, -r * 0.6, r * 0.7);
        c.bezierCurveTo(-r * 1.1, r * 0.2, -r * 0.5, -r * 0.6, 0, -r * 0.9);
      };
      fill(f, pick, brand);
      stroke(f, pick, ink);
      stroke(f, (c) => c.arc(0, r * 0.25, r * 0.35, Math.PI * 1.15, Math.PI * 1.85), alpha(ink, 0.35));
    });
  },
  "es-mallet-up4": (f) => {
    // Four notes climb a staircase.
    const { s, cx, cy, t, brand, ink } = f;
    const sw = s * 0.26;
    const sh = s * 0.13;
    const x0 = cx - 2 * sw;
    const base = cy + s * 0.32;
    stroke(f, (c) => {
      c.moveTo(x0, base);
      for (let i = 0; i < 4; i++) {
        c.lineTo(x0 + i * sw, base - sh * (i + 1));
        c.lineTo(x0 + (i + 1) * sw, base - sh * (i + 1));
      }
      c.lineTo(x0 + 4 * sw, base);
    }, alpha(ink, 0.5));
    for (let i = 0; i < 4; i++) {
      const at = 0.04 + i * 0.13;
      const x = x0 + sw * (i + 0.45);
      const y = base - sh * (i + 1) - s * 0.05;
      if (t >= at) {
        note(f, x, y, s * 0.13 * Math.min(1.2, spring((t - at) * 4)), i === 3 ? brand : ink);
        ripples(f, x, y, clamp((t - at) * 4), s * 0.08, 1);
      }
    }
  },
  "es-notify-m0": (f) => {
    // A hand bell swinging, its clapper hitting the side.
    const { s, cx, cy, level, brand, ink, time } = f;
    const sw = f.playing ? Math.sin(time * 9) * 0.45 * clamp(level * 1.5) : 0.3;
    withT(f, cx, cy - s * 0.08, sw, 1, () => {
      rrect(f, -s * 0.025, -s * 0.27, s * 0.05, s * 0.16, s * 0.02, { fill: ink });
      circle(f, 0, -s * 0.29, s * 0.035, { fill: ink });
      fill(f, (c) => bellPath(c, 0, s * 0.12, s * 0.2), alpha(brand, 0.18));
      stroke(f, (c) => bellPath(c, 0, s * 0.12, s * 0.2));
      const cl = -sw * s * 0.15;
      line(f, 0, 0, cl, s * 0.24, ink);
      circle(f, cl, s * 0.26, s * 0.035, { fill: brand });
    });
    waves(f, cx - s * 0.26, cy + s * 0.08, s * 0.04, s * 0.05, Math.PI, 0.5);
    waves(f, cx + s * 0.26, cy + s * 0.08, s * 0.04, s * 0.05, 0, 0.5);
  },
  "es-notify-m1": (f) => {
    // A phone: a notification banner with a bell slides down.
    const { ctx, s, cx, cy, t, level, brand, ink, time } = f;
    const pw = s * 0.42;
    const ph = s * 0.8;
    const px = cx - pw / 2;
    const py = cy - ph / 2;
    rrect(f, px, py, pw, ph, s * 0.06, { stroke: ink });
    line(f, cx - s * 0.04, py + s * 0.03, cx + s * 0.04, py + s * 0.03, ink);
    for (let i = 0; i < 4; i++) rrect(f, px + s * 0.05, py + s * 0.3 + i * s * 0.1, pw - s * 0.1, s * 0.05, s * 0.015, { stroke: alpha(ink, 0.15) });
    const k = f.playing ? Math.min(1.1, spring(t * 3)) : 1;
    const by = lerp(py - s * 0.14, py + s * 0.07, k);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, s * 0.06);
    ctx.clip();
    rrect(f, px + s * 0.03, by, pw - s * 0.06, s * 0.13, s * 0.03, { fill: alpha(brand, 0.12), stroke: ink });
    const wig = f.playing ? Math.sin(time * 30) * 0.4 * level : 0.2;
    withT(f, px + s * 0.09, by + s * 0.068, wig, 1, () => fill(f, (c) => bellPath(c, 0, 0, s * 0.032), brand));
    line(f, px + s * 0.15, by + s * 0.045, px + pw - s * 0.07, by + s * 0.045, ink);
    line(f, px + s * 0.15, by + s * 0.085, px + pw - s * 0.13, by + s * 0.085, alpha(ink, 0.4));
    ctx.restore();
    waves(f, px + pw + s * 0.02, by + s * 0.065, s * 0.03, s * 0.05, 0, 0.5);
  },
  "es-notify-m2": (f) => {
    // A service desk bell: a palm presses the plunger.
    const { s, cx, cy, t, brand, ink } = f;
    const p = f.playing ? clamp(1 - Math.abs(t - 0.03) * 10) : 0;
    rrect(f, cx - s * 0.32, cy + s * 0.22, s * 0.64, s * 0.08, s * 0.03, { fill: alpha(ink, 0.1), stroke: ink });
    fill(f, (c) => c.arc(cx, cy + s * 0.22, s * 0.26, Math.PI, 0), alpha(brand, 0.18));
    stroke(f, (c) => c.arc(cx, cy + s * 0.22, s * 0.26, Math.PI, 0));
    line(f, cx, cy - s * 0.04, cx, cy - s * 0.1 + p * s * 0.04, ink, f.lw * 1.4);
    circle(f, cx, cy - s * 0.12 + p * s * 0.04, s * 0.03, { fill: ink });
    const hy = cy - s * 0.4 + s * 0.22 * p + (f.playing ? 0 : s * 0.03);
    rrect(f, cx - s * 0.12, hy, s * 0.24, s * 0.1, s * 0.05, { fill: alpha(brand, 0.15), stroke: ink });
    for (let i = 1; i < 4; i++) line(f, cx - s * 0.12 + i * s * 0.06, hy, cx - s * 0.12 + i * s * 0.06, hy + s * 0.04, alpha(ink, 0.4));
    waves(f, cx - s * 0.3, cy + s * 0.08, s * 0.04, s * 0.05, Math.PI, 0.5);
    waves(f, cx + s * 0.3, cy + s * 0.08, s * 0.04, s * 0.05, 0, 0.5);
  },
  "es-notify-m3": (f) => {
    // A singing bowl: a stick circles the rim, the water inside ripples.
    const { s, cx, cy, brand, ink, time } = f;
    const ry = cy - s * 0.05;
    stroke(f, (c) => c.ellipse(cx, cy + s * 0.29, s * 0.24, s * 0.04, 0, 0, TAU), alpha(ink, 0.3));
    fill(f, (c) => c.ellipse(cx, ry, s * 0.32, s * 0.3, 0, 0, Math.PI), alpha(brand, 0.1));
    stroke(f, (c) => c.ellipse(cx, ry, s * 0.32, s * 0.3, 0, 0, Math.PI));
    stroke(f, (c) => c.ellipse(cx, ry, s * 0.32, s * 0.08, 0, 0, TAU));
    for (let i = 0; i < 3; i++) {
      const p = frac((f.playing ? time * 0.8 : 0.1) + i / 3);
      stroke(f, (c) => c.ellipse(cx, ry, s * 0.29 * p, s * 0.07 * p, 0, 0, TAU), alpha(brand, (1 - p) * 0.8));
    }
    const a = f.playing ? time * 3 : 0.4;
    const tx = cx + Math.cos(a) * s * 0.32;
    const ty = ry + Math.sin(a) * s * 0.08;
    line(f, tx, ty, tx + Math.cos(a) * s * 0.1, ty - s * 0.2, ink, f.lw * 2.4);
    waves(f, cx, ry - s * 0.1, s * 0.05, s * 0.05, -Math.PI / 2, 0.7);
  },
  "es-notify-m4": (f) => {
    // Wind chimes: five tubes sway and ring around a striker.
    const { s, cx, cy, level, brand, ink, time } = f;
    const topY = cy - s * 0.34;
    line(f, cx, topY - s * 0.06, cx, topY, ink);
    stroke(f, (c) => c.ellipse(cx, topY, s * 0.32, s * 0.04, 0, 0, TAU));
    const lit = f.playing ? Math.floor(time * 4) % 5 : 3;
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * s * 0.14;
      const len = s * (0.4 - Math.abs(i - 2) * 0.06 - i * 0.01);
      const sw = f.playing ? Math.sin(time * 4 + i * 1.7) * 0.12 * (0.4 + level) : (rand(i, 4) - 0.5) * 0.14;
      line(f, x, topY, x, topY + s * 0.05, alpha(ink, 0.5));
      withT(f, x, topY + s * 0.05, sw, 1, () =>
        rrect(f, -s * 0.022, 0, s * 0.044, len, s * 0.022, i === lit ? { fill: alpha(brand, 0.3 + 0.5 * level), stroke: ink } : { stroke: ink }),
      );
    }
    const ss = f.playing ? Math.sin(time * 3) * 0.15 : 0.08;
    withT(f, cx, topY, ss, 1, () => {
      line(f, 0, 0, 0, s * 0.48, alpha(ink, 0.5));
      circle(f, 0, s * 0.36, s * 0.035, { fill: ink });
      rrect(f, -s * 0.04, s * 0.5, s * 0.08, s * 0.12, s * 0.02, { fill: brand });
    });
  },
  "es-notify-m5": (f) => {
    // A doorbell button pressed: "ding… dong" notes float out.
    const { s, cx, cy, t, brand, ink } = f;
    rrect(f, cx - s * 0.44, cy - s * 0.25, s * 0.22, s * 0.5, s * 0.06, { stroke: ink });
    for (let i = 0; i < 3; i++) line(f, cx - s * 0.37, cy - s * 0.17 + i * s * 0.035, cx - s * 0.29, cy - s * 0.17 + i * s * 0.035, alpha(ink, 0.4));
    const p = f.playing ? dec(t, 0, 0.12) : 0.4;
    circle(f, cx - s * 0.33, cy + s * 0.07, s * 0.085, { stroke: ink });
    circle(f, cx - s * 0.33, cy + s * 0.07, s * 0.06 * (1 - 0.18 * p), { fill: alpha(brand, 0.3 + 0.7 * p) });
    waves(f, cx - s * 0.18, cy, s * 0.04, s * 0.05, 0, 0.6);
    const tt = f.playing ? t : 0.45;
    [0.04, 0.32].forEach((at, i) => {
      if (tt < at) return;
      const u = clamp((tt - at) * 1.5);
      note(f, cx + s * (0.06 + i * 0.26), cy + s * (0.12 - i * 0.08) - u * s * 0.12, s * (0.18 - i * 0.03), alpha(i ? ink : brand, 1 - u * 0.6));
    });
  },
  "es-notify-mid-tine": (f) => {
    // A tuning fork humming: its tines blur and send waves out.
    const { s, cx, cy, level, brand, ink, time, lw } = f;
    const g = s * 0.07;
    const top = cy - s * 0.36;
    const vib = f.playing ? Math.sin(time * 80) * s * 0.01 * level : 0;
    const fork = (v: number, color: string, width: number) =>
      stroke(f, (c) => {
        c.moveTo(cx - g - v, top);
        c.lineTo(cx - g, cy + s * 0.02);
        c.arc(cx, cy + s * 0.02, g, Math.PI, 0, true);
        c.lineTo(cx + g + v, top);
      }, color, width);
    const ghost = s * 0.012 * (f.playing ? level : 0.6);
    fork(ghost, alpha(brand, 0.35), lw * 1.8);
    fork(-ghost, alpha(brand, 0.35), lw * 1.8);
    fork(vib, ink, lw * 2);
    line(f, cx, cy + s * 0.02 + g, cx, cy + s * 0.4, ink, lw * 2.6);
    waves(f, cx - g - s * 0.04, cy - s * 0.2, s * 0.04, s * 0.06, Math.PI, 0.6);
    waves(f, cx + g + s * 0.04, cy - s * 0.2, s * 0.04, s * 0.06, 0, 0.6);
  },
  "es-notify-mid-wood": (f) => {
    // One wooden bar on felt rests, tapped by a soft mallet.
    const { s, cx, cy, t, level, brand, ink, time } = f;
    const bounce = f.playing ? Math.sin(time * 50) * s * 0.004 * level : 0;
    fill(f, (c) => c.ellipse(cx - s * 0.24, cy + s * 0.17, s * 0.05, s * 0.025, 0, 0, TAU), alpha(brand, 0.4));
    fill(f, (c) => c.ellipse(cx + s * 0.24, cy + s * 0.17, s * 0.05, s * 0.025, 0, 0, TAU), alpha(brand, 0.4));
    rrect(f, cx - s * 0.36, cy + s * 0.02 + bounce, s * 0.72, s * 0.13, s * 0.03, { fill: alpha(ink, 0.06), stroke: ink });
    wave(f, cx - s * 0.3, cx + s * 0.3, cy + s * 0.06 + bounce, s * 0.008, 2.5, 0, alpha(ink, 0.25), f.lw * 0.7);
    wave(f, cx - s * 0.28, cx + s * 0.26, cy + s * 0.105 + bounce, s * 0.006, 3, 1, alpha(ink, 0.2), f.lw * 0.7);
    const lift = f.playing ? s * 0.14 * (1 - dec(t, 0, 0.1)) : s * 0.07;
    const hx = cx + s * 0.05;
    const hy = cy - s * 0.04 - lift;
    line(f, hx, hy, hx + s * 0.28, hy - s * 0.26, ink, f.lw * 1.4);
    circle(f, hx, hy, s * 0.055, { fill: alpha(brand, 0.85), stroke: ink });
    waves(f, cx - s * 0.4, cy + s * 0.08, s * 0.03, s * 0.05, Math.PI, 0.5);
    waves(f, cx + s * 0.4, cy + s * 0.08, s * 0.03, s * 0.05, 0, 0.5);
  },
  "es-pluck-kalimba": (f) => kalimba(f, [3]),
  "es-pluck-kalimba-ring": (f) => kalimba(f, [1, 3, 5], { tilt: -0.12, ring: true }),
  "es-pluck-kalimba-soft": (f) => kalimba(f, [4], { tilt: 0.14, thumb: true }),
  "es-pro-notify-ding-1822": (f) =>
    // A chat bubble with typing dots.
    ding(f, 0, () => {
      const { s, time, brand, ink } = f;
      rrect(f, -s * 0.28, -s * 0.17, s * 0.56, s * 0.3, s * 0.12, { stroke: ink });
      stroke(f, (c) => {
        c.moveTo(-s * 0.16, s * 0.125);
        c.lineTo(-s * 0.24, s * 0.24);
        c.lineTo(-s * 0.03, s * 0.125);
      });
      for (let i = 0; i < 3; i++) {
        const by = f.playing ? Math.max(0, Math.sin(time * 10 - i)) * s * 0.035 : i === 1 ? s * 0.02 : 0;
        circle(f, (i - 1) * s * 0.1, -s * 0.02 - by, s * 0.025, { fill: i === 1 ? brand : ink });
      }
    }),
  "es-pro-notify-ding-1930": (f) =>
    // An envelope: the flap opens and a letter rises.
    ding(f, 1, () => {
      const { ctx, s, t, brand, ink } = f;
      const open = f.playing ? ease(t * 2) : 0.6;
      ctx.save();
      ctx.beginPath();
      ctx.rect(-s * 0.3, -s * 0.6, s * 0.6, s * 0.43);
      ctx.clip();
      rrect(f, -s * 0.19, -s * 0.12 - open * s * 0.16, s * 0.38, s * 0.24, s * 0.02, { stroke: brand });
      line(f, -s * 0.12, -s * 0.07 - open * s * 0.16, s * 0.12, -s * 0.07 - open * s * 0.16, alpha(brand, 0.6));
      ctx.restore();
      rrect(f, -s * 0.26, -s * 0.17, s * 0.52, s * 0.34, s * 0.03, { stroke: ink });
      stroke(f, (c) => {
        c.moveTo(-s * 0.26, s * 0.17);
        c.lineTo(0, -s * 0.01);
        c.lineTo(s * 0.26, s * 0.17);
      }, alpha(ink, 0.4));
      stroke(f, (c) => {
        c.moveTo(-s * 0.26, -s * 0.17);
        c.lineTo(0, lerp(s * 0.03, -s * 0.36, open));
        c.lineTo(s * 0.26, -s * 0.17);
      }, ink);
    }),
  "es-pro-notify-ding-2045": (f) =>
    // A progress bar filling to 100%, dinging when it's full.
    ding(f, 2, () => {
      const { s, t, level, brand, ink } = f;
      const k = f.playing ? ease(t * 2.2) : 1;
      const W = s * 0.56;
      const H = s * 0.1;
      rrect(f, -W / 2, -H / 2, W, H, H / 2, { stroke: ink });
      if (k > 0.02) rrect(f, -W / 2 + s * 0.012, -H / 2 + s * 0.012, (W - s * 0.024) * k, H - s * 0.024, (H - s * 0.024) / 2, { fill: brand });
      label(f, `${Math.round(k * 100)}%`, 0, -H - s * 0.06, s * 0.1, ink, 800);
      if (k > 0.99) {
        const e = W / 2 + s * 0.04;
        const g = f.playing ? clamp(level * 1.5) : 0.8;
        burst(f, e, 0, s * 0.04, s * 0.1, 6, g, brand);
        withT(f, e + s * 0.02, -H - s * 0.06, f.playing ? Math.sin(f.time * 30) * 0.3 * level : 0.25, 1, () => {
          fill(f, (c) => bellPath(c, 0, 0, s * 0.04), brand);
          stroke(f, (c) => bellPath(c, 0, 0, s * 0.04));
        });
      }
    }),
  "es-pro-notify-ding-2167": (f) =>
    // A calendar page with a reminder dot.
    ding(f, 3, () => {
      const { s, brand, ink, level } = f;
      rrect(f, -s * 0.2, -s * 0.2, s * 0.4, s * 0.42, s * 0.04, { stroke: ink });
      rrect(f, -s * 0.2, -s * 0.2, s * 0.4, s * 0.1, s * 0.04, { fill: brand });
      line(f, -s * 0.1, -s * 0.25, -s * 0.1, -s * 0.15, ink, f.lw * 1.6);
      line(f, s * 0.1, -s * 0.25, s * 0.1, -s * 0.15, ink, f.lw * 1.6);
      label(f, "12", 0, s * 0.07, s * 0.17, ink, 800);
      circle(f, s * 0.13, s * 0.15, s * 0.02 * (1 + level), { fill: brand });
    }),
  "es-pro-notify-ding-2296": (f) =>
    // A kitchen timer winding down to zero and ringing.
    ding(f, 4, () => {
      const { s, t, level, brand, ink, time } = f;
      const left = f.playing ? 1 - clamp(t * 3) : 0;
      const ringing = left <= 0;
      const rot = ringing ? (f.playing ? Math.sin(time * 40) * 0.08 * level : 0.05) : 0;
      withT(f, 0, 0, rot, 1, () => {
        const R = s * 0.19;
        rrect(f, -s * 0.035, -R - s * 0.06, s * 0.07, s * 0.05, s * 0.012, { fill: ink });
        line(f, R * 0.75, -R * 0.75, R * 0.95, -R * 0.95, ink, f.lw * 2.2);
        circle(f, 0, 0, R, { stroke: ink });
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const r0 = i % 3 ? R * 0.82 : R * 0.74;
          line(f, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, alpha(ink, 0.5), f.lw * 0.8);
        }
        if (left > 0) {
          fill(f, (c) => {
            c.moveTo(0, 0);
            c.arc(0, 0, R * 0.7, -Math.PI / 2, -Math.PI / 2 + TAU * left * 0.4);
            c.closePath();
          }, alpha(brand, 0.35));
        }
        const ha = -Math.PI / 2 + TAU * left * 0.4;
        line(f, 0, 0, Math.cos(ha) * R * 0.68, Math.sin(ha) * R * 0.68, ringing ? brand : ink, f.lw * 1.6);
        circle(f, 0, 0, s * 0.015, { fill: ink });
      });
      if (ringing) {
        const g = f.playing ? clamp(level * 1.5) : 0.7;
        burst(f, 0, -s * 0.19, s * 0.1, s * 0.17, 5, g, brand, -Math.PI / 2 - 1.2);
      }
    }),

  // ===== shimmers =====
  "es-pro-shimmer-m0": (f) => {
    // A magic wand sweeps and leaves a trail of sparkles.
    const { s, cx, cy, t, brand, ink, time } = f;
    const px = cx - s * 0.05;
    const py = cy + s * 0.38;
    const L = s * 0.5;
    const ang = (u: number) => lerp(-2.3, -0.6, u);
    const tip = (u: number) => [px + Math.cos(ang(u)) * L, py + Math.sin(ang(u)) * L] as const;
    const u = f.playing ? easeInOut(t * 1.2) : 0.55;
    for (let i = 1; i < 16; i++) {
      const uu = u - i * 0.04;
      if (uu < 0) break;
      const [x, y] = tip(uu);
      const tw = 0.5 + 0.5 * Math.sin(i * 2.1 + (f.playing ? time * 12 : 0));
      sparkle(f, x + (rand(i, 2) - 0.5) * s * 0.06, y + (rand(i, 3) - 0.5) * s * 0.06, s * 0.035 * (1 - i / 16) * (0.4 + 0.6 * tw), alpha(brand, 1 - i / 16));
    }
    const [tx, ty] = tip(u);
    line(f, px, py, tx, ty, ink, f.lw * 2.2);
    line(f, lerp(px, tx, 0.82), lerp(py, ty, 0.82), lerp(px, tx, 0.9), lerp(py, ty, 0.9), brand, f.lw * 2.6);
    fill(f, (c) => starPath(c, tx, ty, s * 0.065), brand);
    stroke(f, (c) => starPath(c, tx, ty, s * 0.065));
  },
  "es-pro-shimmer-m1": (f) => {
    // A jug pours glinting water into a glass that fills up.
    const { ctx, s, cx, cy, t, level, brand, ink, time } = f;
    const jx = cx - s * 0.32;
    const jy = cy - s * 0.18;
    const a = 0.7;
    withT(f, jx, jy, a, 1, () => {
      rrect(f, -s * 0.12, -s * 0.13, s * 0.24, s * 0.26, s * 0.04, { stroke: ink });
      stroke(f, (c) => c.arc(-s * 0.12, 0, s * 0.07, Math.PI * 0.5, Math.PI * 1.5));
      stroke(f, (c) => {
        c.moveTo(s * 0.12, -s * 0.13);
        c.lineTo(s * 0.18, -s * 0.16);
        c.lineTo(s * 0.12, -s * 0.08);
      });
    });
    const lx = s * 0.18;
    const ly = -s * 0.16;
    const sx = jx + Math.cos(a) * lx - Math.sin(a) * ly;
    const sy = jy + Math.sin(a) * lx + Math.cos(a) * ly;
    const gx = cx + s * 0.18;
    const top = cy - s * 0.02;
    const bot = cy + s * 0.36;
    const glass = (c: CanvasRenderingContext2D) => {
      c.moveTo(gx - s * 0.15, top);
      c.lineTo(gx - s * 0.12, bot);
      c.lineTo(gx + s * 0.12, bot);
      c.lineTo(gx + s * 0.15, top);
    };
    const wl = lerp(bot - s * 0.03, top + s * 0.08, f.playing ? t : 0.4);
    ctx.save();
    ctx.beginPath();
    glass(ctx);
    ctx.closePath();
    ctx.clip();
    fill(f, (c) => c.rect(gx - s * 0.2, wl, s * 0.4, bot - wl), alpha(brand, 0.18));
    wave(f, gx - s * 0.16, gx + s * 0.16, wl, s * 0.006, 3, time * 8, brand);
    ctx.restore();
    stroke(f, glass);
    const wob = f.playing ? Math.sin(time * 20) * s * 0.006 : 0;
    stroke(f, (c) => {
      c.moveTo(sx, sy);
      c.quadraticCurveTo(gx - s * 0.02 + wob, sy, gx + wob, wl);
    }, brand, f.lw * 1.5);
    for (let i = 0; i < 4; i++) {
      const u = frac((f.playing ? time * 1.5 : 0.2) + i / 4);
      const x = lerp(sx, gx, u * u) + wob;
      const y = lerp(sy, wl, u);
      sparkle(f, x + s * 0.03, y, s * 0.025 * (0.4 + level) * Math.sin(u * Math.PI));
    }
  },
  "es-pro-shimmer-m2": (f) => {
    // A trophy with sparkles twinkling around it.
    const { s, cx, cy, t, level, brand, ink, time } = f;
    const cup = (c: CanvasRenderingContext2D) => {
      c.moveTo(cx - s * 0.17, cy - s * 0.3);
      c.lineTo(cx + s * 0.17, cy - s * 0.3);
      c.quadraticCurveTo(cx + s * 0.17, cy + s * 0.02, cx, cy + s * 0.04);
      c.quadraticCurveTo(cx - s * 0.17, cy + s * 0.02, cx - s * 0.17, cy - s * 0.3);
    };
    fill(f, cup, alpha(brand, 0.2 + 0.3 * level));
    stroke(f, cup);
    stroke(f, (c) => c.arc(cx - s * 0.17, cy - s * 0.2, s * 0.07, Math.PI * 0.5, Math.PI * 1.5));
    stroke(f, (c) => c.arc(cx + s * 0.17, cy - s * 0.2, s * 0.07, -Math.PI * 0.5, Math.PI * 0.5));
    line(f, cx, cy + s * 0.04, cx, cy + s * 0.2, ink, f.lw * 1.6);
    rrect(f, cx - s * 0.12, cy + s * 0.2, s * 0.24, s * 0.07, s * 0.02, { stroke: ink });
    fill(f, (c) => starPath(c, cx, cy - s * 0.15, s * 0.06), brand);
    const P = [[-0.36, -0.28], [0.34, -0.32], [0.42, 0.02], [-0.42, 0.06], [-0.26, 0.28], [0.3, 0.26]];
    P.forEach(([x, y], i) => {
      const tw = Math.max(0, Math.sin((f.playing ? time * 9 : t * 8) + i * 1.3));
      sparkle(f, cx + x * s, cy + y * s, s * 0.05 * tw, i % 2 ? brand : ink);
    });
  },
  "es-pro-shimmer-m4": (f) => {
    // Bubbles rising underwater, catching the light.
    const { s, cx, cy, level, brand, ink, time } = f;
    wave(f, cx - s * 0.62, cx + s * 0.62, cy - s * 0.34, s * 0.012, 4, f.playing ? time * 3 : 0, alpha(ink, 0.5));
    for (let i = 0; i < 10; i++) {
      const sp = 0.6 + rand(i, 8);
      const p = frac(rand(i, 6) + (f.playing ? time * 0.35 * sp : 0));
      const r = s * (0.02 + rand(i, 7) * 0.04);
      const x = cx + (rand(i, 5) - 0.5) * s * 1.1 + Math.sin((f.playing ? time * 4 : 0) + i) * s * 0.012;
      const y = cy + s * 0.38 - p * s * 0.66;
      circle(f, x, y, r, { stroke: alpha(ink, 0.85) });
      stroke(f, (c) => c.arc(x - r * 0.25, y - r * 0.25, r * 0.5, Math.PI, Math.PI * 1.5), brand);
      if (i % 3 === 0) sparkle(f, x + r * 0.9, y - r * 0.9, s * 0.03 * level);
    }
  },
  "es-shimmer-m0": (f) => {
    // A field of stars twinkling.
    const { s, cx, cy, level, brand, ink, time } = f;
    for (let i = 0; i < 24; i++) {
      const x = cx + (rand(i, 11) - 0.5) * s * 1.25;
      const y = cy + (rand(i, 12) - 0.5) * s * 0.75;
      const tw = 0.5 + 0.5 * Math.sin((f.playing ? time * 6 : 2.4) * (0.6 + rand(i, 14)) + rand(i, 13) * TAU);
      if (i % 4 === 0) sparkle(f, x, y, s * (0.02 + 0.05 * tw) * (0.6 + level * 0.6), brand);
      else circle(f, x, y, s * (0.005 + 0.01 * tw), { fill: alpha(ink, 0.3 + 0.7 * tw) });
    }
  },
  "es-shimmer-m1": (f) => {
    // Glitter flakes fluttering down.
    const { s, cx, cy, brand, ink, time } = f;
    const tt = f.playing ? time : 0.4;
    for (let i = 0; i < 30; i++) {
      const p = frac(rand(i, 22) + tt * 0.25 * (0.7 + rand(i, 23)));
      const y = cy - s * 0.4 + p * s * 0.8;
      const x = cx + (rand(i, 21) - 0.5) * s * 1.2 + Math.sin(p * 6 + i) * s * 0.03;
      const rot = tt * (3 + rand(i, 24) * 4) + i;
      const flip = Math.abs(Math.cos(rot * 1.3));
      withT(f, x, y, rot, 1, () => fill(f, (c) => c.rect(-s * 0.015, -s * 0.007 * flip, s * 0.03, s * 0.014 * flip + 0.5), i % 3 ? alpha(ink, 0.7) : brand));
      if (flip > 0.97) sparkle(f, x, y, s * 0.03, brand);
    }
  },
  "es-shimmer-m2": (f) => {
    // A fairy-dust trail looping through the air.
    const { s, cx, cy, t, brand, ink } = f;
    const P = (u: number) => [cx + Math.sin(u * TAU * 1.5) * s * 0.5, cy + Math.sin(u * TAU * 2 + 0.5) * s * 0.26] as const;
    const head = f.playing ? t : 0.4;
    for (let j = 0; j < 40; j++) {
      const uu = head - j * 0.012;
      if (uu < 0) break;
      const [x, y] = P(uu);
      if (j % 5 === 0) sparkle(f, x, y, s * 0.03 * (1 - j / 40), alpha(brand, 1 - j / 40));
      else circle(f, x + (rand(j, 4) - 0.5) * s * 0.03, y + (rand(j, 5) - 0.5) * s * 0.03, s * 0.008 * (1 - j / 40), { fill: alpha(ink, 1 - j / 40) });
    }
    const [hx, hy] = P(head);
    circle(f, hx, hy, s * 0.04, { fill: alpha(brand, 0.25) });
    sparkle(f, hx, hy, s * 0.06);
  },
  "es-shimmer-m3": (f) => {
    // A constellation: stars light up and lines join them.
    const { s, cx, cy, t, brand, ink, time } = f;
    const P: [number, number][] = [[-0.5, 0.15], [-0.3, -0.15], [-0.08, -0.04], [0.1, -0.28], [0.3, -0.1], [0.48, -0.24], [0.22, 0.22]].map(
      ([x, y]) => [cx + x * s, cy + y * s] as [number, number],
    );
    const E = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6]];
    const k = (f.playing ? t * 1.3 : 0.6) * E.length;
    E.forEach(([a, b], i) => {
      const u = clamp(k - i);
      if (u <= 0) return;
      line(f, P[a][0], P[a][1], lerp(P[a][0], P[b][0], u), lerp(P[a][1], P[b][1], u), alpha(ink, 0.5));
    });
    P.forEach(([x, y], i) => {
      const reached = i === 0 || E.findIndex((e) => e[1] === i) < k - 1;
      const tw = 0.7 + 0.3 * Math.sin((f.playing ? time * 7 : 1) + i * 2);
      sparkle(f, x, y, s * (reached ? 0.045 : 0.025) * tw, reached ? brand : alpha(ink, 0.5));
    });
  },
  "es-shimmer-m4": (f) => {
    // A stick glides across hanging bar chimes: a glissando.
    const { s, cx, cy, t, brand, ink, time } = f;
    const topY = cy - s * 0.34;
    line(f, cx - s * 0.56, topY, cx + s * 0.56, topY, ink, f.lw * 1.6);
    const n = 14;
    const sx = lerp(cx - s * 0.6, cx + s * 0.6, f.playing ? clamp(t * 1.1) : 0.45);
    for (let i = 0; i < n; i++) {
      const x = cx - s * 0.5 + (i * s * 1.0) / (n - 1);
      const len = s * (0.62 - i * 0.03);
      const age = (sx - x) / s;
      const hit = age > 0 ? Math.exp(-age * 3) : 0;
      const sw = Math.sin((f.playing ? time : 0.3) * 20 + i) * 0.1 * hit;
      withT(f, x, topY + s * 0.02, sw, 1, () => rrect(f, -s * 0.012, 0, s * 0.024, len, s * 0.012, { stroke: ink, fill: hit > 0.05 ? alpha(brand, hit) : undefined }));
    }
    line(f, sx, cy - s * 0.12, sx + s * 0.06, cy + s * 0.26, ink, f.lw * 1.6);
    circle(f, sx, cy - s * 0.12, s * 0.025, { fill: brand });
  },
  "es-shimmer-m5": (f) => {
    // A sparkler throwing sparks.
    const { s, cx, cy, level, brand, ink, time } = f;
    const tx = cx + s * 0.05;
    const ty = cy - s * 0.06;
    line(f, cx - s * 0.3, cy + s * 0.38, tx, ty, ink, f.lw * 1.6);
    line(f, lerp(cx - s * 0.3, tx, 0.72), lerp(cy + s * 0.38, ty, 0.72), tx, ty, alpha(brand, 0.5), f.lw * 3);
    circle(f, tx, ty, s * 0.045, { fill: alpha(brand, 0.3) });
    const fr = f.playing ? Math.floor(time * 20) : 1;
    for (let i = 0; i < 26; i++) {
      const a = rand(i, fr) * TAU;
      const len = s * (0.08 + rand(i, fr + 50) * 0.22) * (0.5 + level * 0.5);
      const ex = tx + Math.cos(a) * len;
      const ey = ty + Math.sin(a) * len;
      const col = i % 3 ? brand : ink;
      line(f, tx + Math.cos(a) * len * 0.3, ty + Math.sin(a) * len * 0.3, ex, ey, alpha(col, 0.85), f.lw * 0.8);
      if (i % 4 === 0) {
        for (const d of [-0.6, 0.6]) line(f, ex, ey, ex + Math.cos(a + d) * s * 0.03, ey + Math.sin(a + d) * s * 0.03, alpha(col, 0.7), f.lw * 0.7);
      }
    }
  },

  // ===== glitches =====
  "es-glitch-burst": (f) => {
    // Crackle, then a flash with pixel shards flying out, faster and faster.
    const { s, cx, cy, level, brand, ink, time } = f;
    const tt = f.playing ? f.t : 0.48;
    const fr = f.playing ? Math.floor(time * 30) : 2;
    // Crackling arcs around the centre.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rand(i, fr) * 0.8;
      stroke(f, (c) => {
        let r = s * 0.07;
        c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        for (let j = 1; j <= 4; j++) {
          r += s * 0.035;
          const aj = a + (rand(i * 7 + j, fr) - 0.5) * 0.5;
          c.lineTo(cx + Math.cos(aj) * r, cy + Math.sin(aj) * r * 0.8);
        }
      }, alpha(i % 2 ? ink : brand, 0.7), f.lw * 0.8);
    }
    // Central flash.
    const flash = f.playing ? clamp(level * 1.3) : 0.85;
    circle(f, cx, cy, s * (0.06 + 0.06 * flash), { fill: alpha(brand, 0.25 * flash) });
    rrect(f, cx - s * 0.05, cy - s * 0.05, s * 0.1, s * 0.1, s * 0.01, { fill: alpha(brand, 0.6 + 0.4 * flash), stroke: ink });
    sparkle(f, cx, cy, s * 0.1 * flash, ink);
    // Shards from each burst, with streaks back toward the centre.
    for (const b of [0.06, 0.2, 0.42, 0.58, 0.7, 0.79, 0.86, 0.92]) {
      if (tt < b) continue;
      const age = (tt - b) * 2.4;
      if (age > 1) continue;
      for (let j = 0; j < 12; j++) {
        const a = rand(j, b * 100) * TAU;
        const r = s * (0.12 + 0.34 * ease(age) * (0.7 + 0.3 * rand(j, b * 50)));
        const z = s * (0.025 + 0.03 * rand(j, b * 70)) * (1 - age * 0.6);
        const x = cx + Math.cos(a) * r * 1.25;
        const y = cy + Math.sin(a) * r * 0.75;
        line(f, x, y, cx + Math.cos(a) * (r - s * 0.08) * 1.25, cy + Math.sin(a) * (r - s * 0.08) * 0.75, alpha(ink, 0.3 * (1 - age)), f.lw * 0.7);
        fill(f, (c) => c.rect(x - z / 2, y - z / 2, z, z), alpha(j % 3 ? ink : brand, 1 - age * 0.7));
      }
    }
  },
  "es-glitch-chirp": (f) => {
    // A data chirp repeated in stuttering frames.
    const { s, cx, cy, t, brand, ink, time } = f;
    const shown = f.playing ? Math.min(4, 1 + Math.floor(t * 10)) : 4;
    for (let i = 0; i < shown; i++) {
      const jx = f.playing ? (rand(i, Math.floor(time * 24)) - 0.5) * s * 0.02 : 0;
      const x = cx - s * 0.62 + i * s * 0.32 + jx;
      rrect(f, x, cy - s * 0.16, s * 0.28, s * 0.32, s * 0.02, { stroke: alpha(ink, 0.3) });
      wave(f, x + s * 0.02, x + s * 0.26, cy, s * 0.1 * Math.pow(0.8, i), (u) => 1 + u * 5, 0, i === 0 ? brand : alpha(ink, 1 - i * 0.2));
    }
  },
  "es-glitch-crush": (f) => {
    // A smooth wave crushed into bit steps.
    const { s, cx, cy, level, brand, ink } = f;
    const x0 = cx - s * 0.6;
    const x1 = cx + s * 0.6;
    wave(f, x0, x1, cy, s * 0.22, 2.5, 0, alpha(ink, 0.2));
    const lv = f.playing ? Math.round(lerp(10, 2, level)) : 4;
    const n = f.playing ? Math.round(lerp(40, 10, level)) : 16;
    stroke(f, (c) => {
      for (let k = 0; k < n; k++) {
        const u = k / n;
        const y = cy - (Math.round(Math.sin(u * 2.5 * TAU) * lv) / lv) * s * 0.22;
        const xa = lerp(x0, x1, u);
        const xb = lerp(x0, x1, (k + 1) / n);
        if (k === 0) c.moveTo(xa, y);
        else c.lineTo(xa, y);
        c.lineTo(xb, y);
      }
    }, brand, f.lw * 1.4);
  },
  "es-glitch-data": (f) => {
    // Packets of data streaming past in lanes.
    const { ctx, s, cx, cy, brand, ink, time } = f;
    const x0 = cx - s * 0.6;
    const span = s * 1.2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, cy - s * 0.4, span, s * 0.8);
    ctx.clip();
    for (let r = 0; r < 6; r++) {
      const off = f.playing ? time * (0.3 + rand(r, 1) * 0.8) : r * 0.2;
      const y = cy - s * 0.33 + r * s * 0.12;
      for (let j = 0; j < 8; j++) {
        const px = x0 + frac(rand(j, r) + off) * (span + s * 0.2) - s * 0.2;
        const pw = s * (0.04 + rand(j, r + 9) * 0.14);
        rrect(f, px, y, pw, s * 0.06, s * 0.01, { fill: rand(j, r + 20) > 0.8 ? brand : alpha(ink, 0.7) });
      }
    }
    ctx.restore();
  },
  "es-glitch-hit": (f) => {
    // An error dialog that jolts and splits into colour.
    const { s, cx, cy, level, brand, ink } = f;
    const [dx, dy] = shake(f, 0.06);
    const split = f.playing ? level * s * 0.035 : s * 0.014;
    const win = (ox: number, color: string) => {
      const x = cx - s * 0.36 + ox + dx;
      const y = cy - s * 0.24 + dy;
      rrect(f, x, y, s * 0.72, s * 0.48, s * 0.04, { stroke: color });
      line(f, x, y + s * 0.09, x + s * 0.72, y + s * 0.09, color);
      for (let i = 0; i < 3; i++) circle(f, x + s * (0.05 + i * 0.045), y + s * 0.045, s * 0.012, { fill: color });
      stroke(f, (c) => {
        c.moveTo(x + s * 0.15, y + s * 0.17);
        c.lineTo(x + s * 0.22, y + s * 0.3);
        c.lineTo(x + s * 0.08, y + s * 0.3);
        c.closePath();
      }, color);
      line(f, x + s * 0.15, y + s * 0.21, x + s * 0.15, y + s * 0.255, color);
      line(f, x + s * 0.3, y + s * 0.2, x + s * 0.62, y + s * 0.2, color);
      line(f, x + s * 0.3, y + s * 0.27, x + s * 0.52, y + s * 0.27, color);
      rrect(f, x + s * 0.48, y + s * 0.35, s * 0.18, s * 0.07, s * 0.02, { stroke: color });
    };
    win(-split, alpha(brand, 0.85));
    win(split, ink);
  },
  "es-glitch-mid": (f) => {
    // VHS tracking: a noisy band rolls through the picture.
    const { ctx, s, cx, cy, level, brand, ink, time } = f;
    const X = cx - s * 0.5;
    const Y = cy - s * 0.32;
    const W = s;
    const H = s * 0.64;
    rrect(f, X, Y, W, H, s * 0.03, { stroke: ink });
    scenery(f, X, Y, W, H);
    const by = Y + frac(f.playing ? time * 1.5 : 0.55) * (H - s * 0.1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, by, W, s * 0.1);
    ctx.clip();
    ctx.clearRect(X, by, W, s * 0.1);
    scenery(f, X + s * 0.05 * (0.3 + level), Y, W, H, brand);
    const fr = f.playing ? Math.floor(time * 24) : 1;
    for (let k = 0; k < 6; k++) {
      const y = by + s * 0.01 + k * s * 0.016;
      const sh = rand(k, fr) * s * 0.3;
      line(f, X + sh, y, X + sh + s * (0.1 + rand(k, fr + 3) * 0.4), y, alpha(ink, 0.5), f.lw * 0.7);
    }
    ctx.restore();
  },
  "es-glitch-scramble": (f) => {
    // Characters scramble, then settle into a word.
    const { s, cx, cy, brand, ink, time } = f;
    const word = "SIGNAL";
    const chars = "#%&@$*/<>01ABXZ";
    const tt = f.playing ? f.t : 0.5;
    rrect(f, cx - s * 0.52, cy - s * 0.18, s * 1.04, s * 0.36, s * 0.05, { stroke: alpha(ink, 0.35) });
    let settled = 0;
    for (let i = 0; i < 6; i++) {
      const done = tt >= 0.25 + i * 0.1;
      if (done) settled = i + 1;
      const ch = done ? word[i] : chars[Math.floor(rand(i, f.playing ? Math.floor(time * 30) : 3) * chars.length)];
      label(f, ch, cx - s * 0.375 + i * s * 0.15, cy, s * 0.2, done ? ink : brand, 700, "ui-monospace, SFMono-Regular, Menlo, monospace");
    }
    if (settled < 6 || Math.floor((f.playing ? time : 0) * 3) % 2 === 0) {
      fill(f, (c) => c.rect(cx - s * 0.45 + settled * s * 0.15, cy + s * 0.1, s * 0.1, s * 0.02), alpha(ink, 0.6));
    }
  },
  "es-glitch-stutter": (f) => {
    // One frame stuttering: copies of the same card repeat.
    const { s, cx, cy, brand, ink, time } = f;
    const copies = f.playing ? 1 + (Math.floor(time * 16) % 5) : 4;
    const step = s * 0.08;
    for (let i = copies - 1; i >= 0; i--) {
      const ox = (i - (copies - 1) / 2) * step;
      const a = i === 0 ? 1 : 0.6 - i * 0.12;
      const x = cx - s * 0.2 + ox;
      rrect(f, x, cy - s * 0.26, s * 0.4, s * 0.52, s * 0.04, { stroke: alpha(ink, a), fill: i === 0 ? alpha(brand, 0.12) : undefined });
      circle(f, x + s * 0.2, cy - s * 0.1, s * 0.07, { stroke: alpha(i === 0 ? brand : ink, a) });
      line(f, x + s * 0.08, cy + s * 0.06, x + s * 0.32, cy + s * 0.06, alpha(ink, a));
      line(f, x + s * 0.08, cy + s * 0.14, x + s * 0.25, cy + s * 0.14, alpha(ink, a));
    }
  },
  "es-pro-glitch-crunchy": (f) => {
    // A monitor screen cracking from the point of impact.
    const { ctx, s, cx, cy, t, level, brand, ink } = f;
    const X = cx - s * 0.52;
    const Y = cy - s * 0.34;
    const W = s * 1.04;
    const H = s * 0.62;
    rrect(f, X, Y, W, H, s * 0.04, { stroke: ink });
    line(f, cx, Y + H, cx, Y + H + s * 0.07, ink);
    line(f, cx - s * 0.14, Y + H + s * 0.07, cx + s * 0.14, Y + H + s * 0.07, ink);
    const px = cx + s * 0.12;
    const py = cy - s * 0.06;
    const k = f.playing ? ease(t * 3) : 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, W, H);
    ctx.clip();
    circle(f, px, py, s * 0.05 * (0.5 + level), { fill: alpha(brand, 0.3 * level) });
    for (let i = 0; i < 9; i++) {
      let a = (i / 9) * TAU + rand(i, 2) * 0.5;
      const L = s * (0.18 + rand(i, 3) * 0.3) * k;
      stroke(f, (c) => {
        let x = px;
        let y = py;
        c.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          a += (rand(i, j + 10) - 0.5) * 0.7;
          x += Math.cos(a) * L * 0.25;
          y += Math.sin(a) * L * 0.25;
          c.lineTo(x, y);
        }
      }, i % 3 ? ink : brand, f.lw * 0.9);
    }
    stroke(f, (c) => {
      for (let i = 0; i <= 9; i++) {
        const a = (i / 9) * TAU;
        const r = s * (0.06 + rand(i, 5) * 0.03) * k;
        if (i === 0) c.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
        else c.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      }
    }, alpha(ink, 0.7), f.lw * 0.8);
    ctx.restore();
  },
  "es-pro-glitch-data": (f) => {
    // Datamosh: a circle smears into horizontal pixel drags.
    const { s, cx, cy, level, brand, ink, time } = f;
    const R = s * 0.18;
    const ox = cx - s * 0.3;
    circle(f, ox, cy, R, { stroke: ink, fill: alpha(brand, 0.15) });
    const fr = f.playing ? Math.floor(time * 12) : 0;
    for (let r = 0; r < 12; r++) {
      const dy = -R + (r + 0.5) * ((R * 2) / 12);
      const hc = Math.sqrt(Math.max(0, R * R - dy * dy));
      const len = s * (0.1 + rand(r, fr) * 0.6) * (f.playing ? 0.3 + level : 0.7);
      const x = ox + hc;
      fill(f, (c) => c.rect(x, cy + dy - s * 0.012, len, s * 0.024), r % 3 ? alpha(ink, 0.55) : alpha(brand, 0.8));
      if (r % 4 === 1) fill(f, (c) => c.rect(x + len, cy + dy - s * 0.025, s * 0.05, s * 0.05), alpha(brand, 0.6));
    }
  },
  "es-pro-glitch-fastroll": (f) => {
    // The picture rolls vertically, frame over frame.
    const { ctx, s, cx, cy, ink, time } = f;
    const X = cx - s * 0.45;
    const Y = cy - s * 0.3;
    const W = s * 0.9;
    const H = s * 0.6;
    rrect(f, X, Y, W, H, s * 0.03, { stroke: ink });
    const off = frac(f.playing ? time * 2.5 : 0.35) * H;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, Y, W, H);
    ctx.clip();
    scenery(f, X, Y + off, W, H);
    scenery(f, X, Y + off - H, W, H);
    fill(f, (c) => c.rect(X, Y + off - s * 0.03, W, s * 0.06), alpha(ink, 0.85));
    ctx.restore();
  },
  "es-pro-glitch-framelock": (f) => {
    // A filmstrip stutters along and locks onto one frame.
    const { ctx, s, cx, cy, t, brand, ink } = f;
    const X = cx - s * 0.62;
    const W = s * 1.24;
    const locked = !f.playing || t > 0.77;
    const step = s * 0.04;
    const raw = locked ? 0 : (1 - ease(t * 1.3)) * s * 1.0;
    const off = Math.round(raw / step) * step;
    line(f, X, cy - s * 0.2, X + W, cy - s * 0.2, ink);
    line(f, X, cy + s * 0.2, X + W, cy + s * 0.2, ink);
    ctx.save();
    ctx.beginPath();
    ctx.rect(X, cy - s * 0.3, W, s * 0.6);
    ctx.clip();
    for (let i = -6; i < 10; i++) {
      const hx = X + ((i * s * 0.085 + off) % (s * 1.4));
      rrect(f, hx, cy - s * 0.18, s * 0.04, s * 0.025, s * 0.006, { stroke: alpha(ink, 0.5) });
      rrect(f, hx, cy + s * 0.155, s * 0.04, s * 0.025, s * 0.006, { stroke: alpha(ink, 0.5) });
    }
    for (let i = -3; i <= 3; i++) {
      const fx = cx - s * 0.15 + i * s * 0.34 + off;
      const center = locked && i === 0;
      rrect(f, fx, cy - s * 0.13, s * 0.3, s * 0.26, s * 0.015, { stroke: ink, fill: center ? alpha(brand, 0.2) : undefined });
      circle(f, fx + s * 0.15, cy, s * 0.05, { stroke: alpha(center ? brand : ink, 0.7) });
    }
    ctx.restore();
    if (locked) {
      const x0 = cx - s * 0.19;
      const x1 = cx + s * 0.19;
      const y0 = cy - s * 0.27;
      const y1 = cy + s * 0.27;
      const c = s * 0.06;
      for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        stroke(f, (p) => {
          p.moveTo(x + sx * c, y);
          p.lineTo(x, y);
          p.lineTo(x, y + sy * c);
        }, brand, f.lw * 1.5);
      }
    }
  },
  "es-pro-glitch-sparse": (f) => {
    // A quiet frame where a few broken blocks flicker on and off.
    const { s, cx, cy, brand, ink, time } = f;
    rrect(f, cx - s * 0.5, cy - s * 0.3, s, s * 0.6, s * 0.03, { stroke: alpha(ink, 0.5) });
    const fr = f.playing ? Math.floor(time * 10) : 0;
    for (let i = 0; i < 10; i++) {
      const on = f.playing ? rand(i, fr) > 0.72 : [1, 4, 7].includes(i);
      if (!on) continue;
      const x = cx - s * 0.46 + rand(i, 31) * s * 0.75;
      const y = cy - s * 0.26 + rand(i, 32) * s * 0.45;
      fill(f, (c) => c.rect(x, y, s * (0.06 + rand(i, 33) * 0.14), s * 0.05), i % 3 ? alpha(ink, 0.75) : brand);
    }
  },
  "es-pro-glitch-standard": (f) => {
    // A word split into colour channels, one slice torn sideways.
    const { ctx, s, cx, cy, level, brand, ink, time } = f;
    const fr = f.playing ? Math.floor(time * 24) : 0;
    const dx = f.playing ? level * s * 0.04 * (rand(1, fr) > 0.3 ? 1 : -1) : s * 0.016;
    const size = s * 0.26;
    label(f, "GLITCH", cx - dx, cy, size, alpha(brand, 0.9), 900);
    label(f, "GLITCH", cx + dx, cy, size, ink, 900);
    const b = f.playing ? rand(2, fr) : 0.55;
    const by = cy - s * 0.13 + b * s * 0.2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - s * 0.7, by, s * 1.4, s * 0.05);
    ctx.clip();
    ctx.clearRect(cx - s * 0.7, by, s * 1.4, s * 0.05);
    label(f, "GLITCH", cx + s * 0.06 * (f.playing ? 0.3 + level : 1), cy, size, brand, 900);
    ctx.restore();
  },

  // ===== dividers =====
  "divider-crt-01": (f) => {
    // An old CRT TV switching off: the picture collapses to a line, then a dot.
    const { s, cx, cy, brand, ink } = f;
    rrect(f, cx - s * 0.42, cy - s * 0.28, s * 0.74, s * 0.62, s * 0.06, { stroke: ink });
    rrect(f, cx - s * 0.37, cy - s * 0.23, s * 0.5, s * 0.52, s * 0.08, { stroke: ink });
    line(f, cx - s * 0.07, cy - s * 0.28, cx - s * 0.2, cy - s * 0.42, ink);
    line(f, cx - s * 0.07, cy - s * 0.28, cx + s * 0.06, cy - s * 0.42, ink);
    circle(f, cx + s * 0.22, cy - s * 0.1, s * 0.035);
    circle(f, cx + s * 0.22, cy + s * 0.04, s * 0.035);
    for (let i = 0; i < 3; i++) line(f, cx + s * 0.17, cy + s * (0.16 + i * 0.04), cx + s * 0.27, cy + s * (0.16 + i * 0.04), alpha(ink, 0.4));
    const sx = cx - s * 0.12;
    const sy = cy + s * 0.03;
    const k = f.playing ? f.t : 0.18;
    if (k < 0.4) {
      const h = s * 0.42 * (1 - ease(k / 0.4));
      rrect(f, sx - s * 0.21, sy - h / 2, s * 0.42, h, s * 0.01, { fill: alpha(brand, 0.25 + 0.5 * (k / 0.4)) });
      for (let y = sy - h / 2 + s * 0.02; y < sy + h / 2; y += s * 0.035) line(f, sx - s * 0.2, y, sx + s * 0.2, y, alpha(ink, 0.15), f.lw * 0.6);
    } else if (k < 0.7) {
      const w = s * 0.42 * (1 - ease((k - 0.4) / 0.3));
      rrect(f, sx - w / 2, sy - s * 0.006, w, s * 0.012, s * 0.006, { fill: brand });
      circle(f, sx, sy, s * 0.03, { fill: alpha(brand, 0.25) });
    } else {
      circle(f, sx, sy, s * 0.02 * (1 - (k - 0.7) / 0.3), { fill: brand });
    }
  },
  "divider-deep-01": (f) => {
    // A sub-bass wave that slows down as it drops, thumping the floor.
    const { s, cx, cy, level, brand, ink, time } = f;
    wave(f, cx - s * 0.6, cx + s * 0.6, cy - s * 0.05, (u) => s * 0.2 * (0.4 + 0.6 * u) * (f.playing ? 0.4 + level : 0.8), (u) => 3.5 - u * 3, f.playing ? -time * 8 : 0, brand, f.lw * 1.5);
    line(f, cx - s * 0.6, cy + s * 0.32, cx + s * 0.6, cy + s * 0.32, alpha(ink, 0.4));
    for (let i = 0; i < 3; i++) {
      const p = frac((f.playing ? time * 1.3 : 0.2) + i / 3);
      stroke(f, (c) => c.ellipse(cx, cy + s * 0.32, s * (0.06 + 0.4 * p), s * (0.012 + 0.05 * p), 0, 0, TAU), alpha(ink, (1 - p) * 0.6));
    }
  },
  "divider-scramble-01": (f) => {
    // An LED grid running a fast sequence of beeping notes.
    const { s, cx, cy, t, brand, ink } = f;
    const cols = 14;
    const rows = 5;
    const cell = s * 0.075;
    const x0 = cx - (cols * cell) / 2 + cell / 2;
    const y0 = cy - (rows * cell) / 2 + cell / 2;
    const head = f.playing ? Math.floor(t * cols * 1.2) : 9;
    for (let c = 0; c < cols; c++) {
      const rc = Math.floor(rand(c, 41) * rows);
      for (let r = 0; r < rows; r++) {
        const on = r === rc && c <= head;
        circle(f, x0 + c * cell, y0 + r * cell, cell * 0.28, { fill: on ? (c === head ? brand : ink) : alpha(ink, 0.1) });
      }
    }
    if (head < cols) rrect(f, x0 + head * cell - cell * 0.45, y0 - cell * 0.6, cell * 0.9, rows * cell + cell * 0.2, cell * 0.2, { stroke: alpha(brand, 0.5) });
  },
  "divider-scramble-02": (f) => {
    // A grid of glassy digital bubbles rattling.
    const { s, cx, cy, level, brand, ink, time } = f;
    const cell = s * 0.16;
    for (let i = 0; i < 21; i++) {
      const x = cx + ((i % 7) - 3) * cell;
      const y = cy + (Math.floor(i / 7) - 1) * cell;
      const b = f.playing ? (0.5 + 0.5 * Math.sin(time * 30 * (0.5 + rand(i, 51)) + i)) * (0.4 + level) : rand(i, 52);
      const r = cell * 0.36 * (0.45 + 0.55 * clamp(b));
      rrect(f, x - r, y - r, r * 2, r * 2, r * 0.6, { stroke: ink, fill: alpha(brand, 0.15 * clamp(b)) });
      if (b > 0.7) stroke(f, (c) => c.arc(x - r * 0.2, y - r * 0.2, r * 0.45, Math.PI, Math.PI * 1.5), brand);
    }
  },
  "divider-scramble-03": (f) => {
    // Two wine glasses clinking fast.
    const { s, cx, cy, level, brand, ink, time } = f;
    const cl = f.playing ? Math.abs(Math.sin(time * 35)) * level : 0.5;
    const glass = (x: number, rot: number) =>
      withT(f, x, cy + s * 0.3, rot, 1, () => {
        fill(f, (c) => {
          c.moveTo(-s * 0.095, -s * 0.42);
          c.lineTo(s * 0.095, -s * 0.42);
          c.quadraticCurveTo(s * 0.1, -s * 0.31, 0, -s * 0.3);
          c.quadraticCurveTo(-s * 0.1, -s * 0.31, -s * 0.095, -s * 0.42);
        }, alpha(brand, 0.3));
        stroke(f, (c) => {
          c.moveTo(-s * 0.1, -s * 0.55);
          c.quadraticCurveTo(-s * 0.11, -s * 0.31, 0, -s * 0.3);
          c.quadraticCurveTo(s * 0.11, -s * 0.31, s * 0.1, -s * 0.55);
        });
        line(f, 0, -s * 0.3, 0, -s * 0.01, ink);
        stroke(f, (c) => c.ellipse(0, 0, s * 0.08, s * 0.015, 0, 0, TAU));
      });
    const rot = 0.28 - cl * 0.04;
    glass(cx - s * 0.24, rot);
    glass(cx + s * 0.24, -rot);
    const k = f.playing ? cl : 0.6;
    sparkle(f, cx, cy - s * 0.24, s * 0.06 * k);
    burst(f, cx, cy - s * 0.24, s * 0.07, s * 0.15, 6, k, brand, -Math.PI / 2);
  },
  "divider-scramble-04": (f) => {
    // Ice cubes rattling in a rocks glass.
    const { ctx, s, cx, cy, level, brand, ink, time } = f;
    const top = cy - s * 0.25;
    const bot = cy + s * 0.33;
    const glass = (c: CanvasRenderingContext2D) => {
      c.moveTo(cx - s * 0.26, top);
      c.lineTo(cx - s * 0.21, bot);
      c.lineTo(cx + s * 0.21, bot);
      c.lineTo(cx + s * 0.26, top);
    };
    ctx.save();
    ctx.beginPath();
    glass(ctx);
    ctx.closePath();
    ctx.clip();
    fill(f, (c) => c.rect(cx - s * 0.3, cy - s * 0.05, s * 0.6, s * 0.4), alpha(brand, 0.15));
    const fr = f.playing ? Math.floor(time * 25) : 0;
    const cubes: [number, number][] = [[-0.1, 0.07], [0.09, 0.14], [0.0, -0.06]];
    cubes.forEach(([x, y], i) => {
      const j = f.playing ? (0.3 + level) * s * 0.03 : 0;
      const px = cx + x * s + (rand(i, fr) - 0.5) * j;
      const py = cy + y * s + (rand(i, fr + 9) - 0.5) * j;
      const rot = 0.3 * i + 0.2 + (f.playing ? Math.sin(time * 20 + i) * 0.2 * level : 0);
      withT(f, px, py, rot, 1, () => {
        rrect(f, -s * 0.075, -s * 0.075, s * 0.15, s * 0.15, s * 0.025, { stroke: ink, fill: alpha(ink, 0.04) });
        line(f, -s * 0.045, -s * 0.045, s * 0.0, -s * 0.045, brand);
      });
    });
    ctx.restore();
    stroke(f, glass);
    line(f, cx - s * 0.21, bot - s * 0.03, cx + s * 0.21, bot - s * 0.03, alpha(ink, 0.4));
    sparkle(f, cx + s * 0.2, top + s * 0.05, s * 0.05 * (f.playing ? level : 0.5));
    sparkle(f, cx - s * 0.16, top + s * 0.12, s * 0.03 * (f.playing ? level : 0.5));
  },
};
