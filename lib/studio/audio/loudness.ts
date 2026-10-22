// ITU-R BS.1770-4 / EBU R128 measurements: integrated loudness, momentary and
// short-term maxima, loudness range (EBU Tech 3342), sample and true peak.

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

// K-weighting coefficients for any sample rate (same design as pyloudnorm).
function highShelf(rate: number): Biquad {
  const G = 4.0;
  const Q = 1 / Math.sqrt(2);
  const fc = 1500;
  const A = Math.pow(10, G / 40);
  const w0 = (2 * Math.PI * fc) / rate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cos = Math.cos(w0);
  const sqrtA = Math.sqrt(A);
  const a0 = A + 1 - (A - 1) * cos + 2 * sqrtA * alpha;
  return {
    b0: (A * (A + 1 + (A - 1) * cos + 2 * sqrtA * alpha)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos - 2 * sqrtA * alpha)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos)) / a0,
    a2: (A + 1 - (A - 1) * cos - 2 * sqrtA * alpha) / a0,
  };
}

function highPass(rate: number): Biquad {
  const Q = 0.5;
  const fc = 38;
  const w0 = (2 * Math.PI * fc) / rate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function applyBiquad(input: Float32Array, f: Biquad): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i];
    const y = f.b0 * x + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

const toLufs = (meanSquare: number) => (meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity);
const toDb = (amplitude: number) => (amplitude > 0 ? 20 * Math.log10(amplitude) : -Infinity);

/** Per-block channel-summed mean squares for windows of `windowS` every `stepS`. */
function blockPowers(weighted: Float32Array[], rate: number, windowS: number, stepS: number) {
  const window = Math.round(windowS * rate);
  const step = Math.round(stepS * rate);
  const length = weighted[0]?.length ?? 0;
  const powers: number[] = [];
  if (length < window) {
    if (length === 0) return powers;
    let sum = 0;
    for (const channel of weighted) {
      let s = 0;
      for (let i = 0; i < length; i += 1) s += channel[i] * channel[i];
      sum += s / length;
    }
    powers.push(sum);
    return powers;
  }
  // Prefix sums of squares per channel for O(n) block energies.
  const prefixes = weighted.map((channel) => {
    const prefix = new Float64Array(channel.length + 1);
    for (let i = 0; i < channel.length; i += 1) prefix[i + 1] = prefix[i] + channel[i] * channel[i];
    return prefix;
  });
  for (let start = 0; start + window <= length; start += step) {
    let sum = 0;
    for (const prefix of prefixes) sum += (prefix[start + window] - prefix[start]) / window;
    powers.push(sum);
  }
  return powers;
}

function gatedIntegrated(powers: number[]) {
  const absolute = powers.filter((p) => toLufs(p) > -70);
  if (absolute.length === 0) return -Infinity;
  const mean = absolute.reduce((a, b) => a + b, 0) / absolute.length;
  const relativeGate = toLufs(mean) - 10;
  const gated = absolute.filter((p) => toLufs(p) > relativeGate);
  if (gated.length === 0) return -Infinity;
  return toLufs(gated.reduce((a, b) => a + b, 0) / gated.length);
}

function loudnessRange(shortTermPowers: number[]) {
  const absolute = shortTermPowers.filter((p) => toLufs(p) > -70);
  if (absolute.length < 2) return 0;
  const mean = absolute.reduce((a, b) => a + b, 0) / absolute.length;
  const gate = toLufs(mean) - 20;
  const values = absolute
    .map(toLufs)
    .filter((l) => l > gate)
    .sort((a, b) => a - b);
  if (values.length < 2) return 0;
  const at = (q: number) => values[Math.min(values.length - 1, Math.max(0, Math.round(q * (values.length - 1))))];
  return at(0.95) - at(0.1);
}

// 4× oversampling with windowed-sinc interpolation for true peak (BS.1770-4 Annex 2 style).
const OVERSAMPLE = 4;
const HALF_TAPS = 8;
// kernels[p][n + HALF_TAPS - 1] = weight of x[i + n] for the point i + p/4, n in [-(HALF_TAPS-1), HALF_TAPS]
const truePeakKernels = (() => {
  const kernels: Float32Array[] = [];
  for (let p = 1; p < OVERSAMPLE; p += 1) {
    const frac = p / OVERSAMPLE;
    const kernel = new Float32Array(HALF_TAPS * 2);
    for (let j = 0; j < HALF_TAPS * 2; j += 1) {
      const n = j - (HALF_TAPS - 1);
      const x = frac - n;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / HALF_TAPS); // Hann over ±HALF_TAPS
      kernel[j] = sinc * Math.max(0, w);
    }
    kernels.push(kernel);
  }
  return kernels;
})();

function truePeak(channel: Float32Array) {
  let peak = 0;
  for (let i = 0; i < channel.length; i += 1) peak = Math.max(peak, Math.abs(channel[i]));
  // Inter-sample peaks only matter near loud samples.
  const threshold = peak * 0.5;
  for (let i = HALF_TAPS - 1; i < channel.length - HALF_TAPS; i += 1) {
    if (Math.abs(channel[i]) < threshold && Math.abs(channel[i + 1]) < threshold) continue;
    for (const kernel of truePeakKernels) {
      let acc = 0;
      for (let j = 0; j < kernel.length; j += 1) acc += channel[i + j - (HALF_TAPS - 1)] * kernel[j];
      peak = Math.max(peak, Math.abs(acc));
    }
  }
  return peak;
}

/**
 * Per-sample true-peak envelope across channels: max of |x[i]| and the 4x oversampled
 * values between i and i+1. Interpolation is skipped where both samples are below
 * `skipBelow` (inter-sample overs can't reach far above their neighbours).
 */
export function truePeakEnvelope(channels: Float32Array[], skipBelow = 0.25) {
  const n = channels[0]?.length ?? 0;
  const env = new Float32Array(n);
  for (const channel of channels) {
    for (let i = 0; i < n; i += 1) {
      let peak = Math.abs(channel[i]);
      if (i >= HALF_TAPS - 1 && i < n - HALF_TAPS && (peak >= skipBelow || Math.abs(channel[i + 1]) >= skipBelow)) {
        for (const kernel of truePeakKernels) {
          let acc = 0;
          for (let j = 0; j < kernel.length; j += 1) acc += channel[i + j - (HALF_TAPS - 1)] * kernel[j];
          peak = Math.max(peak, Math.abs(acc));
        }
      }
      if (peak > env[i]) env[i] = peak;
    }
  }
  return env;
}

export interface LoudnessMeasurement {
  integratedLufs: number;
  momentaryMaxLufs: number;
  shortTermMaxLufs: number;
  loudnessRangeLu: number;
  samplePeakDb: number;
  truePeakDb: number;
  durationS: number;
  /** Seconds from the start to the first sample above −40 dBFS (−1 if silent). */
  onsetS: number;
}

export function measureChannels(channels: Float32Array[], sampleRate: number): LoudnessMeasurement {
  const shelf = highShelf(sampleRate);
  const pass = highPass(sampleRate);
  const weighted = channels.map((channel) => applyBiquad(applyBiquad(channel, shelf), pass));
  const momentary = blockPowers(weighted, sampleRate, 0.4, 0.1);
  const shortTerm = blockPowers(weighted, sampleRate, 3, 0.1);
  let samplePeak = 0;
  let tp = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) samplePeak = Math.max(samplePeak, Math.abs(channel[i]));
    tp = Math.max(tp, truePeak(channel));
  }
  const onsetThreshold = Math.pow(10, -40 / 20);
  let onset = -1;
  const length = channels[0]?.length ?? 0;
  outer: for (let i = 0; i < length; i += 1) {
    for (const channel of channels) {
      if (Math.abs(channel[i]) >= onsetThreshold) {
        onset = i / sampleRate;
        break outer;
      }
    }
  }
  return {
    integratedLufs: gatedIntegrated(momentary),
    momentaryMaxLufs: momentary.length ? Math.max(...momentary.map(toLufs)) : -Infinity,
    shortTermMaxLufs: shortTerm.length ? Math.max(...shortTerm.map(toLufs)) : -Infinity,
    loudnessRangeLu: loudnessRange(shortTerm),
    samplePeakDb: toDb(samplePeak),
    truePeakDb: toDb(tp),
    durationS: length / sampleRate,
    onsetS: onset,
  };
}

export function measureLoudness(buffer: AudioBuffer): LoudnessMeasurement {
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c += 1) channels.push(buffer.getChannelData(c));
  return measureChannels(channels, buffer.sampleRate);
}

/** Short-term loudness (3 s windows) every `stepS`, for timelines and critique. */
export function shortTermCurve(buffer: AudioBuffer, stepS = 0.5) {
  const shelf = highShelf(buffer.sampleRate);
  const pass = highPass(buffer.sampleRate);
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c += 1) {
    channels.push(applyBiquad(applyBiquad(buffer.getChannelData(c), shelf), pass));
  }
  return blockPowers(channels, buffer.sampleRate, 3, stepS).map(toLufs);
}

/** Momentary loudness (400 ms) every `stepS`. */
export function momentaryCurve(buffer: AudioBuffer, stepS = 0.1) {
  const shelf = highShelf(buffer.sampleRate);
  const pass = highPass(buffer.sampleRate);
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c += 1) {
    channels.push(applyBiquad(applyBiquad(buffer.getChannelData(c), shelf), pass));
  }
  return blockPowers(channels, buffer.sampleRate, 0.4, stepS).map(toLufs);
}

export function roundDb(value: number, digits = 1) {
  if (!Number.isFinite(value)) return value > 0 ? 999 : -999;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

/** (block mid times, LUFS) of sliding K-weighted blocks — earshot.features.loudness_curve. */
export function loudnessCurve(channels: Float32Array[], sampleRate: number, winS: number, hopS: number) {
  const shelf = highShelf(sampleRate);
  const pass = highPass(sampleRate);
  const weighted = channels.slice(0, 2).map((channel) => applyBiquad(applyBiquad(channel, shelf), pass));
  const length = weighted[0]?.length ?? 0;
  const w = Math.round(winS * sampleRate);
  const h = Math.max(1, Math.round(hopS * sampleRate));
  const prefixes = weighted.map((channel) => {
    const prefix = new Float64Array(channel.length + 1);
    for (let i = 0; i < channel.length; i += 1) prefix[i + 1] = prefix[i] + channel[i] * channel[i];
    return prefix;
  });
  if (length < w) {
    let sum = 0;
    for (const prefix of prefixes) sum += prefix[length] / Math.max(1, length);
    return { t: Float64Array.of(length / sampleRate / 2), L: Float64Array.of(-0.691 + 10 * Math.log10(sum + 1e-20)) };
  }
  const count = Math.floor((length - w) / h) + 1;
  const t = new Float64Array(count);
  const L = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    const start = i * h;
    let sum = 0;
    for (const prefix of prefixes) sum += (prefix[start + w] - prefix[start]) / w;
    t[i] = (start + w / 2) / sampleRate;
    L[i] = -0.691 + 10 * Math.log10(sum + 1e-20);
  }
  return { t, L };
}
