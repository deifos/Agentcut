// Small DSP toolkit for the listening tools (browser + Node, no dependencies).

/** In-place iterative radix-2 FFT. re/im length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

export const hann = (n: number) => {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i += 1) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); // periodic (scipy/librosa)
  return w;
};

/** Power spectrum |FFT|^2 of one windowed frame (length nfft). */
export function powerSpectrum(frame: ArrayLike<number>, window: Float64Array, nfft: number) {
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  const n = Math.min(frame.length, window.length);
  for (let i = 0; i < n; i += 1) re[i] = frame[i] * window[i];
  fft(re, im);
  const half = nfft / 2 + 1;
  const out = new Float64Array(half);
  for (let k = 0; k < half; k += 1) out[k] = re[k] * re[k] + im[k] * im[k];
  return out;
}

export const nextPow2 = (n: number) => 1 << Math.ceil(Math.log2(Math.max(2, n)));
export const prevPow2 = (n: number) => 1 << Math.floor(Math.log2(Math.max(2, n)));

/** Welch PSD (Hann, 50% overlap, density scaling like scipy.signal.welch). */
export function welch(x: Float32Array | Float64Array, sampleRate: number, nperseg: number) {
  const n = Math.min(nperseg, prevPow2(x.length));
  const window = hann(n);
  let windowPower = 0;
  for (const v of window) windowPower += v * v;
  const step = Math.max(1, n / 2);
  const half = n / 2 + 1;
  const acc = new Float64Array(half);
  let count = 0;
  for (let start = 0; start + n <= x.length; start += step) {
    // scipy detrends each segment by its mean ("constant")
    let mean = 0;
    for (let i = 0; i < n; i += 1) mean += x[start + i];
    mean /= n;
    const frame = new Float64Array(n);
    for (let i = 0; i < n; i += 1) frame[i] = x[start + i] - mean;
    const p = powerSpectrum(frame, window, n);
    for (let k = 0; k < half; k += 1) acc[k] += p[k];
    count += 1;
  }
  const scale = 1 / (sampleRate * windowPower * Math.max(1, count));
  const freqs = new Float64Array(half);
  for (let k = 0; k < half; k += 1) {
    acc[k] *= k === 0 || k === half - 1 ? scale : 2 * scale;
    freqs[k] = (k * sampleRate) / n;
  }
  return { freqs, psd: acc };
}

/** Frames of `size` samples every `hop` (no padding; at least one zero-padded frame). */
export function frames(x: Float32Array | Float64Array, size: number, hop = size): Float64Array[] {
  const out: Float64Array[] = [];
  if (x.length < size) {
    const f = new Float64Array(size);
    f.set(x);
    return [f];
  }
  for (let start = 0; start + size <= x.length; start += hop) out.push(Float64Array.from(x.subarray(start, start + size)));
  return out;
}

/** STFT power frames (frame `size` = nfft, Hann window). */
export function stftPower(x: Float32Array | Float64Array, size: number, hop: number) {
  const window = hann(size);
  return frames(x, size, hop).map((frame) => powerSpectrum(frame, window, size));
}

export function percentile(values: ArrayLike<number>, q: number) {
  const sorted = Array.from(values).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const pos = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(values: ArrayLike<number>) {
  return percentile(values, 50);
}

/** Linear-interpolation resample (good enough for analysis at 16–48 kHz). */
export function resampleLinear(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const n = Math.max(1, Math.round((x.length * to) / from));
  const out = new Float32Array(n);
  const ratio = from / to;
  // Simple box low-pass before downsampling to limit aliasing.
  let src = x;
  if (to < from) {
    const k = Math.max(1, Math.round(ratio));
    if (k > 1) {
      src = new Float32Array(x.length);
      let acc = 0;
      for (let i = 0; i < x.length; i += 1) {
        acc += x[i];
        if (i >= k) acc -= x[i - k];
        src[i] = acc / Math.min(k, i + 1);
      }
    }
  }
  for (let i = 0; i < n; i += 1) {
    const pos = i * ratio;
    const a = Math.floor(pos);
    const b = Math.min(src.length - 1, a + 1);
    const t = pos - a;
    out[i] = src[Math.min(a, src.length - 1)] * (1 - t) + src[b] * t;
  }
  return out;
}

// ---------------------------------------------------------------------------
// librosa-style onset detection (mel spectral flux + peak picking)

function hzToMel(hz: number) {
  // Slaney
  const fSp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = minLogHz / fSp;
  const logStep = Math.log(6.4) / 27;
  return hz >= minLogHz ? minLogMel + Math.log(hz / minLogHz) / logStep : hz / fSp;
}

function melToHz(mel: number) {
  const fSp = 200 / 3;
  const minLogHz = 1000;
  const minLogMel = minLogHz / fSp;
  const logStep = Math.log(6.4) / 27;
  return mel >= minLogMel ? minLogHz * Math.exp(logStep * (mel - minLogMel)) : mel * fSp;
}

/** Slaney-normalized mel filterbank (librosa.filters.mel defaults). */
export function melFilterbank(sampleRate: number, nfft: number, nMels: number, fmin = 0, fmax = sampleRate / 2) {
  const bins = nfft / 2 + 1;
  const fftFreqs = Array.from({ length: bins }, (_, k) => (k * sampleRate) / nfft);
  const melMin = hzToMel(fmin);
  const melMax = hzToMel(fmax);
  const melF = Array.from({ length: nMels + 2 }, (_, i) => melToHz(melMin + ((melMax - melMin) * i) / (nMels + 1)));
  const filters: Float64Array[] = [];
  for (let m = 0; m < nMels; m += 1) {
    const f = new Float64Array(bins);
    const lower = melF[m];
    const center = melF[m + 1];
    const upper = melF[m + 2];
    const enorm = 2 / (upper - lower);
    for (let k = 0; k < bins; k += 1) {
      const v = Math.max(0, Math.min((fftFreqs[k] - lower) / (center - lower), (upper - fftFreqs[k]) / (upper - center)));
      f[k] = v * enorm;
    }
    filters.push(f);
  }
  return filters;
}

/** Onset strength envelope (librosa.onset.onset_strength defaults, centered frames). */
export function onsetStrength(y: Float32Array, sampleRate: number, hop: number, nfft = 2048, nMels = 128) {
  const padded = new Float32Array(y.length + nfft);
  padded.set(y, nfft / 2); // center=True (zero pad; librosa pads with zeros for onset_strength's stft? it uses 'constant')
  const spectra = stftPower(padded, nfft, hop);
  const filters = melFilterbank(sampleRate, nfft, nMels);
  const melDb = spectra.map((p) =>
    filters.map((f) => {
      let s = 0;
      for (let k = 0; k < p.length; k += 1) s += f[k] * p[k];
      return s;
    }),
  );
  // power_to_db(ref=max over the whole spectrogram), top_db=80
  let ref = 1e-10;
  for (const row of melDb) for (const v of row) ref = Math.max(ref, v);
  const dbRows = melDb.map((row) => row.map((v) => 10 * Math.log10(Math.max(1e-10, v)) - 10 * Math.log10(ref)));
  let maxDb = -Infinity;
  for (const row of dbRows) for (const v of row) maxDb = Math.max(maxDb, v);
  const floor = maxDb - 80;
  for (const row of dbRows) for (let i = 0; i < row.length; i += 1) row[i] = Math.max(floor, row[i]);
  const env = new Float64Array(dbRows.length);
  for (let t = 1; t < dbRows.length; t += 1) {
    let sum = 0;
    for (let m = 0; m < nMels; m += 1) sum += Math.max(0, dbRows[t][m] - dbRows[t - 1][m]);
    env[t] = sum / nMels;
  }
  return env;
}

/** librosa.onset.onset_detect peak picking (normalized envelope), returns frame indices. */
export function onsetDetect(env: Float64Array, sampleRate: number, hop: number) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of env) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const range = max - min || 1;
  const e = Array.from(env, (v) => (v - min) / range);
  const toFrames = (s: number) => Math.round((s * sampleRate) / hop);
  const preMax = Math.max(1, toFrames(0.03));
  const postMax = 1;
  const preAvg = Math.max(1, toFrames(0.1));
  const postAvg = toFrames(0.1) + 1;
  const wait = toFrames(0.03);
  const delta = 0.07;
  const peaks: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < e.length; i += 1) {
    let localMax = -Infinity;
    for (let j = Math.max(0, i - preMax); j < Math.min(e.length, i + postMax); j += 1) localMax = Math.max(localMax, e[j]);
    if (e[i] !== localMax) continue;
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - preAvg); j < Math.min(e.length, i + postAvg); j += 1) {
      sum += e[j];
      n += 1;
    }
    if (e[i] < sum / n + delta) continue;
    if (i - last <= wait) continue;
    peaks.push(i);
    last = i;
  }
  return peaks;
}
