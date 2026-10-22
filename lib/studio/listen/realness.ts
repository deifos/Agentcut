// Port of earshot/realness.py: is this a real recording / professionally produced audio,
// or a cheap code-synthesized sound? p_real = sigmoid(fusion of the CLAP head); the fused
// model gives the signal head weight 0, so signal measurements are evidence in words plus
// the pure-tone rule (a dead-steady test tone → p_real ≤ 0.03).
import model from "@/lib/studio/listen/data/realness-model.json";
import { median, percentile, powerSpectrum, hann, frames, resampleLinear, welch } from "@/lib/studio/listen/dsp";
import { DIM, dot, embedRawTexts, embedWindows, loadAudio } from "@/lib/studio/listen/models";

const SR = 48_000;
const SR32 = 32_000;
const LONG_S = model.long_s;
const WIN_S = model.win_s;
const SILENT_DB = model.silent_db;
const LIFT_BELOW_DB = -30;
const QUIET_MIN_PEAK_DB = -80;

const db = (v: number) => 20 * Math.log10(Math.max(v, 1e-12));

function rmsDb(x: Float32Array) {
  let s = 0;
  for (const v of x) s += v * v;
  return db(Math.sqrt(s / Math.max(1, x.length)));
}

function liftQuiet(x: Float32Array) {
  if (!x.length) return { x, gainDb: 0 };
  const rdb = rmsDb(x);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const pdb = db(peak);
  const gain = Math.min(LIFT_BELOW_DB - rdb, -1 - pdb);
  if (pdb < QUIET_MIN_PEAK_DB || gain <= 0) return { x, gainDb: 0 };
  const g = Math.pow(10, gain / 20);
  return { x: x.map((v) => v * g), gainDb: gain };
}

export type SignalFeatures = Record<string, number>;

/** Subset of earshot.realness.signal_features (pitch_wobble, env_resid_db, texture_kurt are NaN). */
export function signalFeatures(x48: Float32Array): SignalFeatures | null {
  if (x48.length < 0.02 * SR) return null;
  let maxAbs = 0;
  let silent = 0;
  for (const v of x48) {
    const a = Math.abs(v);
    maxAbs = Math.max(maxAbs, a);
    if (a < 1e-6) silent += 1;
  }
  if (maxAbs < 1e-7) return null;
  const f: SignalFeatures = { silence_frac: silent / x48.length };
  const y32 = resampleLinear(x48, SR, SR32);
  let peak = 0;
  for (const v of y32) peak = Math.max(peak, Math.abs(v));
  const y = new Float64Array(y32.length);
  for (let i = 0; i < y.length; i += 1) y[i] = y32[i] / (peak + 1e-12);

  const r = frames(y, 640).map((frame) => {
    let s = 0;
    for (const v of frame) s += v * v;
    return 20 * Math.log10(Math.sqrt(s / frame.length + 1e-30));
  });
  f.floor_db = Math.max(-140, percentile(r, 10) - Math.max(...r));

  const { freqs, psd } = welch(y, SR32, 2048);
  const band: number[] = [];
  const bandFreqs: number[] = [];
  for (let k = 0; k < freqs.length; k += 1) {
    if (freqs[k] >= 40 && freqs[k] <= 15000) {
      band.push(psd[k] + 1e-30);
      bandFreqs.push(freqs[k]);
    }
  }
  if (band.length > 4) {
    const meanP = band.reduce((a, b) => a + b, 0) / band.length;
    const geo = Math.exp(band.reduce((a, b) => a + Math.log(b), 0) / band.length);
    f.log_flatness = Math.log10(geo / meanP);
    f.peakiness_db = 10 * Math.log10(Math.max(...band) / median(band));
    const k = Math.max(1, Math.floor(0.01 * band.length));
    const sorted = [...band].sort((a, b) => b - a);
    f.line_share = sorted.slice(0, k).reduce((a, b) => a + b, 0) / band.reduce((a, b) => a + b, 0);
    const levels = band.map((p) => 10 * Math.log10(p));
    const maxLevel = Math.max(...levels);
    let lastIdx = 0;
    levels.forEach((level, i) => {
      if (level >= maxLevel - 60) lastIdx = i;
    });
    f.bandwidth_khz = bandFreqs[lastIdx] / 1000;
  }

  // Short-time spectra (1024 / hop 256) of the active frames.
  const window = hann(1024);
  const spectra = frames(y, 1024, 256).map((frame) => powerSpectrum(frame, window, 1024));
  const binHz = SR32 / 1024;
  const lo = Math.ceil(40 / binHz);
  const hi = Math.floor(15000 / binHz);
  const S = spectra.map((p) => p.subarray(lo, hi + 1).map((v) => v + 1e-30));
  const e = S.map((p) => 10 * Math.log10(p.reduce((a, b) => a + b, 0)));
  const eMax = Math.max(...e);
  const loud = S.filter((_, i) => e[i] > eMax - 30);
  if (loud.length) {
    f.spec_floor_db = median(
      loud.map((p) => {
        const L = Array.from(p, (v) => 10 * Math.log10(v));
        return percentile(L, 10) - Math.max(...L);
      }),
    );
  }
  const activeIdx = e.map((v, i) => (v > eMax - 50 ? i : -1)).filter((i) => i >= 0);
  if (activeIdx.length) {
    const activeE = activeIdx.map((i) => e[i]);
    const q25 = percentile(activeE, 25);
    const quiet = activeIdx.length >= 8 ? activeIdx.filter((i) => e[i] <= q25) : activeIdx;
    const qs = new Float64Array(S[0].length);
    for (const i of quiet) for (let k = 0; k < qs.length; k += 1) qs[k] += S[i][k] / quiet.length;
    const qMean = qs.reduce((a, b) => a + b, 0) / qs.length;
    const qGeo = Math.exp(qs.reduce((a, b) => a + Math.log(b + 1e-30), 0) / qs.length);
    f.quiet_flat = Math.log10(qGeo / qMean);
    let tonal = 0;
    for (const i of activeIdx) {
      const p = S[i];
      let arg = 2;
      for (let k = 2; k < p.length - 2; k += 1) if (p[k] > p[arg]) arg = k;
      const total = p.reduce((a, b) => a + b, 0);
      const share = (p[arg - 2] + p[arg - 1] + p[arg] + p[arg + 1] + p[arg + 2]) / total;
      if (share > 0.5) tonal += 1;
    }
    f.tonal_frames = tonal / activeIdx.length;
  }
  f.pitch_wobble = NaN;
  f.env_resid_db = NaN;
  f.texture_kurt = NaN;
  let sum = 0;
  let count = 0;
  for (const v of y) {
    if (v !== 0) {
      sum += v * v;
      count += 1;
    }
  }
  f.crest_db = count ? 20 * Math.log10(1 / (Math.sqrt(sum / count) + 1e-12)) : 0;
  return f;
}

function pureTone(f: SignalFeatures) {
  const w = f.pitch_wobble;
  return (
    (f.tonal_frames ?? 0) >= 0.95 &&
    (f.line_share ?? 0) >= 0.9 &&
    (f.crest_db ?? 99) <= 4.5 &&
    (!Number.isFinite(w) || w <= -1.0)
  );
}

function phrase(name: string, v: number, towardReal: boolean) {
  const pct = (x: number) => (x > 0 && x < 0.095 ? `${(100 * x).toFixed(1)}%` : `${Math.round(100 * x)}%`);
  switch (name) {
    case "floor_db":
      return v < -95 ? `quietest parts ${v.toFixed(0)} dB under the peak: cleaner than a microphone usually records` : `noise floor ${v.toFixed(0)} dB under the peak, like a microphone or room`;
    case "spec_floor_db":
      return towardReal ? `a broadband noise floor ${(-v).toFixed(0)} dB under the spectral peak, as microphones leave` : `between its partials the spectrum falls ${(-v).toFixed(0)} dB under the peak (no measurable mic or room noise)`;
    case "line_share":
      return towardReal ? `energy spread over the spectrum (top 1% of bins hold ${pct(v)})` : `${pct(v)} of the energy sits in a few pure spectral lines (oscillator-like)`;
    case "quiet_flat":
      return towardReal ? "the quiet parts are broadband room / mic noise" : "the quiet parts are tonal tails, not broadband room noise";
    case "tonal_frames":
      return towardReal ? `few pure-tone frames (${pct(v)})` : `${pct(v)} of frames are dominated by one pure tone`;
    case "log_flatness":
      return towardReal ? "spectrum is dense and noise-rich" : "spectrum is a few pure lines over near-silence";
    case "peakiness_db":
      return towardReal ? `no dominant spectral line (${v.toFixed(0)} dB peak/median)` : `one spectral line stands ${v.toFixed(0)} dB above the median bin`;
    case "bandwidth_khz":
      return `content reaches ${v.toFixed(1)} kHz`;
    case "crest_db":
      return towardReal ? `crest factor ${v.toFixed(0)} dB: sharp natural transients` : `crest factor only ${v.toFixed(0)} dB: a steady, oscillator-like level`;
    default:
      return `${name} = ${v.toPrecision(3)}`;
  }
}

function facts(f: SignalFeatures) {
  const out: { side: string; precision: number; text: string }[] = [];
  for (const q of model.facts as { feature: string; side: string; op: string; value: number; precision: number }[]) {
    const v = f[q.feature];
    if (!Number.isFinite(v)) continue;
    if (q.op === "<=" ? v <= q.value : v >= q.value) {
      out.push({
        side: q.side,
        precision: q.precision,
        text: `${phrase(q.feature, v, q.side === "real")} (${Math.round(100 * q.precision)}% of earshot's training clips past this were ${q.side === "real" ? "real/pro" : "synthesized"})`,
      });
    }
  }
  return out.sort((a, b) => b.precision - a.precision);
}

interface Head {
  mean: number[];
  scale: number[];
  clip: [number[], number[]];
  coef: number[];
  intercept: number;
}

function headLogit(head: Head, values: ArrayLike<number>) {
  let s = head.intercept;
  for (let i = 0; i < head.coef.length; i += 1) {
    let v = Number.isFinite(values[i]) ? values[i] : head.mean[i];
    v = Math.min(head.clip[1][i], Math.max(head.clip[0][i], v));
    s += ((v - head.mean[i]) / head.scale[i]) * head.coef[i];
  }
  return s;
}

function fuse(logits: Record<string, number>) {
  const fusion = model.fusion as { heads: string[]; coef: number[]; intercept: number };
  let s = fusion.intercept;
  fusion.heads.forEach((name, i) => (s += fusion.coef[i] * (logits[name] ?? 0)));
  return 1 / (1 + Math.exp(-s));
}

let promptEmbeddings: Promise<Float32Array> | null = null;
function prompts() {
  promptEmbeddings ??= embedRawTexts([...model.prompts.real, ...model.prompts.synth]);
  return promptEmbeddings;
}

function verdictOf(p: number, file: boolean) {
  const t = file ? model.file_thresholds : model.thresholds;
  return p >= t.hi ? "real or pro-produced" : p <= t.lo ? "likely code-synthesized" : "uncertain";
}

export async function realnessOfUrl(url: string, path: string) {
  const audio = await loadAudio(url);
  return { path, ...(await realnessOfSamples(audio.mono48, SR)) };
}

/** p_real for mono samples (any rate; resampled to 48 kHz). */
export async function realnessOfSamples(samples: Float32Array, sampleRate: number) {
  const { x, gainDb } = liftQuiet(sampleRate === SR ? samples : resampleLinear(samples, sampleRate, SR));
  const seconds = x.length / SR;
  const spans: [number, number][] = [];
  if (seconds <= LONG_S) spans.push([0, seconds]);
  else {
    for (let t = 0; t + WIN_S <= seconds + 1e-6; t += WIN_S) spans.push([t, t + WIN_S]);
    const lastEnd = spans.length ? spans[spans.length - 1][1] : 0;
    if (seconds - lastEnd >= 0.25) spans.push([seconds - WIN_S, seconds]);
  }
  const clips = spans.map(([a, b]) => x.slice(Math.round(a * SR), Math.round(b * SR)));
  const live = clips.map((clip, i) => ({ clip, i })).filter(({ clip }) => rmsDb(clip) > SILENT_DB);
  if (!live.length) {
    return {
      p_real: null,
      verdict: "silent",
      why: `silent (no part above ${SILENT_DB} dBFS RMS), not judged`,
      evidence: [] as string[],
      synthesizedStretches: [] as string[],
    };
  }
  const embeddings = await embedWindows(live.map(({ clip }) => clip));
  const P = await prompts();
  const nReal = model.prompts.real.length;
  const names = [...model.prompts.real, ...model.prompts.synth];
  const heads = model.heads as unknown as { clap: Head; signal: Head & { inputs: string[] } };
  const segments = live.map(({ clip, i }, j) => {
    const emb = embeddings.subarray(j * DIM, (j + 1) * DIM);
    const lc = headLogit(heads.clap, emb);
    const f = signalFeatures(clip) ?? {};
    const ls = headLogit(heads.signal, heads.signal.inputs.map((k) => f[k] ?? NaN));
    let p = fuse({ clap: lc, signal: ls });
    const tone = pureTone(f);
    const evidence = facts(f);
    if (tone) {
      p = Math.min(p, 0.03);
      evidence.unshift({ side: "synth", precision: 0.99, text: "a pure, dead-steady tone: one spectral line, flat level, no pitch drift (a test tone or bare oscillator)" });
    }
    const cos = names.map((_, k) => dot(P, k * DIM, emb, 0));
    const order = cos.map((c, k) => [c, k] as const).sort((a, b) => b[0] - a[0]);
    const nearest = order[0][1];
    return {
      start: Math.round(spans[i][0] * 1000) / 1000,
      end: Math.round(spans[i][1] * 1000) / 1000,
      p_real: Math.round(p * 1000) / 1000,
      clapScore: Math.round(lc * 100) / 100,
      closestPrompt: `${names[nearest]} (${nearest < nReal ? "real" : "synth"} side)`,
      evidence: evidence.slice(0, 4).map((e) => e.text),
      tone,
    };
  });
  const isFile = segments.length > 1;
  const pReal = segments.reduce((a, s) => a + s.p_real, 0) / segments.length;
  const verdict = verdictOf(pReal, isFile);
  const t = isFile ? model.file_thresholds : model.thresholds;
  const synthWindows = segments.filter((s) => s.p_real <= model.thresholds.lo);
  return {
    seconds: Math.round(seconds * 1000) / 1000,
    p_real: Math.round(pReal * 1000) / 1000,
    verdict,
    thresholds: { hi: t.hi, lo: t.lo, level: isFile ? "file (mean of 4 s windows)" : "clip" },
    why: segments[0].tone
      ? "decided by the pure-tone rule"
      : `CLAP head score ${segments[0].clapScore >= 0 ? "toward real" : "toward synthesized"}; closest reference prompt: ${segments[0].closestPrompt}`,
    evidence: segments[0].evidence,
    liftedDb: gainDb ? Math.round(gainDb * 10) / 10 : 0,
    segments: isFile ? segments.map(({ start, end, p_real }) => ({ start, end, p_real })) : undefined,
    synthesizedStretches: synthWindows.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)} s`),
  };
}
