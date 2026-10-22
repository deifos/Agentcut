/**
 * Beat tracking tuned for editor sync markers.
 * Runs fully client-side with the Web Audio API.
 */

export interface BeatInfo {
  time: number; // absolute time in seconds
  strength: number; // 0-1 normalized
  isDownbeat: boolean;
}

export interface BeatAnalysis {
  beats: BeatInfo[];
  reactiveBeats: BeatInfo[];
  tempo: number; // BPM
}

interface PeakInfo {
  frame: number;
  time: number;
  strength: number;
  bass: number;
}

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const LOWPASS_CUTOFF_HZ = 180;
const LOCAL_THRESHOLD_WINDOW = 16;
const PEAK_NEIGHBORHOOD = 2;
const MIN_TEMPO_BPM = 70;
const MAX_TEMPO_BPM = 180;
const MIN_BEAT_GAP_SEC = 0.18;
const TRACKING_WINDOW_RATIO = 0.22;
const MAX_TRACKING_MISSES = 2;

function lowPassCoeff(sampleRate: number, cutoffHz: number): number {
  const fc = cutoffHz / sampleRate;
  return 1 - Math.exp(-2 * Math.PI * fc);
}

function createLowPassedSignal(
  source: Float32Array,
  sampleRate: number,
  cutoffHz: number,
): Float32Array {
  const alpha = lowPassCoeff(sampleRate, cutoffHz);
  const filtered = new Float32Array(source.length);
  let prev = 0;

  for (let i = 0; i < source.length; i++) {
    prev += alpha * (source[i] - prev);
    filtered[i] = prev;
  }

  return filtered;
}

function buildTransientSignal(source: Float32Array): Float32Array {
  const transient = new Float32Array(source.length);
  let prev = source[0] ?? 0;

  for (let i = 0; i < source.length; i++) {
    const current = source[i] ?? 0;
    transient[i] = current - prev;
    prev = current;
  }

  return transient;
}

function computeFrameRms(signal: Float32Array): Float32Array {
  if (signal.length === 0) return new Float32Array(0);

  const frameCount = Math.max(
    1,
    Math.ceil(Math.max(0, signal.length - FRAME_SIZE) / HOP_SIZE) + 1,
  );
  const energies = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame++) {
    const start = frame * HOP_SIZE;
    const end = Math.min(start + FRAME_SIZE, signal.length);
    const length = end - start;
    if (length <= 0) continue;

    let sum = 0;
    for (let i = start; i < end; i++) {
      const value = signal[i] ?? 0;
      sum += value * value;
    }
    energies[frame] = Math.sqrt(sum / length);
  }

  return energies;
}

function smoothArray(values: Float32Array, radius: number): Float32Array {
  if (values.length === 0 || radius <= 0) return values.slice();

  const prefix = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i++) {
    prefix[i + 1] = prefix[i] + values[i];
  }

  const smoothed = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - radius);
    const end = Math.min(values.length - 1, i + radius);
    const count = end - start + 1;
    smoothed[i] = (prefix[end + 1] - prefix[start]) / count;
  }

  return smoothed;
}

function normalizeOnsetEnvelope(values: Float32Array): Float32Array {
  if (values.length === 0) return values;

  const smoothed = smoothArray(values, 2);
  const prefix = new Float64Array(smoothed.length + 1);
  const prefixSquares = new Float64Array(smoothed.length + 1);

  for (let i = 0; i < smoothed.length; i++) {
    prefix[i + 1] = prefix[i] + smoothed[i];
    prefixSquares[i + 1] = prefixSquares[i] + smoothed[i] * smoothed[i];
  }

  const normalized = new Float32Array(smoothed.length);
  let maxValue = 0;

  for (let i = 0; i < smoothed.length; i++) {
    const start = Math.max(0, i - LOCAL_THRESHOLD_WINDOW);
    const end = Math.min(smoothed.length - 1, i + LOCAL_THRESHOLD_WINDOW);
    const count = end - start + 1;
    const mean = (prefix[end + 1] - prefix[start]) / count;
    const meanSquares = (prefixSquares[end + 1] - prefixSquares[start]) / count;
    const variance = Math.max(0, meanSquares - mean * mean);
    const threshold = mean + Math.sqrt(variance) * 0.12;
    const novelty = Math.max(0, smoothed[i] - threshold);

    normalized[i] = novelty;
    if (novelty > maxValue) maxValue = novelty;
  }

  if (maxValue <= 0) return normalized;

  for (let i = 0; i < normalized.length; i++) {
    normalized[i] /= maxValue;
  }

  return normalized;
}

function pickPeaks(
  novelty: Float32Array,
  bassEnergy: Float32Array,
  sampleRate: number,
): PeakInfo[] {
  if (novelty.length === 0) return [];

  const minGapFrames = Math.max(
    1,
    Math.round((MIN_BEAT_GAP_SEC * sampleRate) / HOP_SIZE),
  );
  const rawPeaks: PeakInfo[] = [];

  for (
    let frame = PEAK_NEIGHBORHOOD;
    frame < novelty.length - PEAK_NEIGHBORHOOD;
    frame++
  ) {
    const strength = novelty[frame] ?? 0;
    if (strength < 0.08) continue;

    let isLocalMax = true;
    for (
      let offset = -PEAK_NEIGHBORHOOD;
      offset <= PEAK_NEIGHBORHOOD;
      offset++
    ) {
      if (offset === 0) continue;
      if ((novelty[frame + offset] ?? 0) >= strength) {
        isLocalMax = false;
        break;
      }
    }

    if (!isLocalMax) continue;

    rawPeaks.push({
      frame,
      time: (frame * HOP_SIZE) / sampleRate,
      strength,
      bass: bassEnergy[frame] ?? 0,
    });
  }

  const peaks: PeakInfo[] = [];
  for (const peak of rawPeaks) {
    const last = peaks[peaks.length - 1];
    if (!last || peak.frame - last.frame >= minGapFrames) {
      peaks.push(peak);
      continue;
    }

    if (peak.strength > last.strength) {
      peaks[peaks.length - 1] = peak;
    }
  }

  return peaks;
}

function estimateTempo(novelty: Float32Array, sampleRate: number): number {
  if (novelty.length < 2) return 120;

  const minLag = Math.max(
    1,
    Math.round((60 * sampleRate) / (MAX_TEMPO_BPM * HOP_SIZE)),
  );
  const maxLag = Math.max(
    minLag + 1,
    Math.round((60 * sampleRate) / (MIN_TEMPO_BPM * HOP_SIZE)),
  );
  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let frame = lag; frame < novelty.length; frame++) {
      sum += novelty[frame] * novelty[frame - lag];
    }
    correlations[lag] = sum / Math.max(1, novelty.length - lag);
  }

  let bestLag = Math.round((60 * sampleRate) / (120 * HOP_SIZE));
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * sampleRate) / (lag * HOP_SIZE);
    let score = correlations[lag];

    const doubleLag = lag * 2;
    if (doubleLag <= maxLag) score += correlations[doubleLag] * 0.5;

    const halfLag = Math.round(lag / 2);
    if (halfLag >= minLag) score += correlations[halfLag] * 0.25;

    const preference = 1 - (Math.abs(bpm - 120) / 120) * 0.1;
    score *= Math.max(0.85, preference);

    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  return Math.round((60 * sampleRate) / (bestLag * HOP_SIZE));
}

function findSupportScore(
  targetFrame: number,
  peaks: PeakInfo[],
  searchWindow: number,
): number {
  let bestScore = 0;

  for (const peak of peaks) {
    const distance = Math.abs(peak.frame - targetFrame);
    if (distance > searchWindow) continue;

    const score = peak.strength - (distance / Math.max(searchWindow, 1)) * 0.5;
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

function chooseAnchorPeak(peaks: PeakInfo[], intervalFrames: number): PeakInfo {
  const searchWindow = Math.max(
    3,
    Math.round(intervalFrames * TRACKING_WINDOW_RATIO),
  );
  let bestPeak = peaks[0];
  let bestScore = -Infinity;

  for (const peak of peaks) {
    const score =
      peak.strength +
      findSupportScore(peak.frame + intervalFrames, peaks, searchWindow) *
        0.75 +
      findSupportScore(peak.frame - intervalFrames, peaks, searchWindow) * 0.6;

    if (score > bestScore) {
      bestScore = score;
      bestPeak = peak;
    }
  }

  return bestPeak;
}

function findBestTrackedPeak(
  predictedFrame: number,
  peaks: PeakInfo[],
  usedFrames: Set<number>,
  searchWindow: number,
): PeakInfo | null {
  let best: PeakInfo | null = null;
  let bestScore = -Infinity;

  for (const peak of peaks) {
    if (usedFrames.has(peak.frame)) continue;

    const distance = Math.abs(peak.frame - predictedFrame);
    if (distance > searchWindow) continue;

    const score =
      peak.strength -
      (distance / Math.max(searchWindow, 1)) * 0.7 +
      peak.bass * 0.1;

    if (score > bestScore) {
      bestScore = score;
      best = peak;
    }
  }

  return best;
}

function refineTempoFromTrackedBeats(
  beats: PeakInfo[],
  sampleRate: number,
  fallbackTempo: number,
): number {
  if (beats.length < 2) return fallbackTempo;

  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i].frame - beats[i - 1].frame);
  }

  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  if (!medianInterval || medianInterval <= 0) return fallbackTempo;

  const refinedTempo = (60 * sampleRate) / (medianInterval * HOP_SIZE);
  if (!Number.isFinite(refinedTempo)) return fallbackTempo;

  return Math.round(
    Math.max(MIN_TEMPO_BPM, Math.min(MAX_TEMPO_BPM, refinedTempo)),
  );
}

function trackBeatSequence(
  peaks: PeakInfo[],
  tempo: number,
  sampleRate: number,
  frameCount: number,
): { beats: PeakInfo[]; tempo: number } {
  if (peaks.length === 0 || tempo <= 0) {
    return { beats: [], tempo };
  }

  const baseIntervalFrames = (60 / tempo) * (sampleRate / HOP_SIZE);
  if (!Number.isFinite(baseIntervalFrames) || baseIntervalFrames <= 1) {
    return { beats: peaks, tempo };
  }

  const anchor = chooseAnchorPeak(peaks, baseIntervalFrames);
  const tracked: PeakInfo[] = [anchor];
  const usedFrames = new Set<number>([anchor.frame]);

  const extend = (direction: 1 | -1) => {
    let lastFrame = anchor.frame;
    let intervalFrames = baseIntervalFrames;
    let predictedFrame = anchor.frame + direction * intervalFrames;
    let misses = 0;

    while (
      predictedFrame >= 0 &&
      predictedFrame <= frameCount - 1 &&
      misses <= MAX_TRACKING_MISSES
    ) {
      const searchWindow = Math.max(
        3,
        Math.round(intervalFrames * TRACKING_WINDOW_RATIO),
      );
      const candidate = findBestTrackedPeak(
        predictedFrame,
        peaks,
        usedFrames,
        searchWindow,
      );

      if (!candidate) {
        predictedFrame += direction * intervalFrames;
        misses += 1;
        continue;
      }

      const observedInterval = Math.abs(candidate.frame - lastFrame);
      tracked.push(candidate);
      usedFrames.add(candidate.frame);
      intervalFrames = intervalFrames * 0.8 + observedInterval * 0.2;
      lastFrame = candidate.frame;
      predictedFrame = candidate.frame + direction * intervalFrames;
      misses = 0;
    }
  };

  extend(1);
  extend(-1);

  const beats = tracked.sort((a, b) => a.frame - b.frame);
  const refinedTempo = refineTempoFromTrackedBeats(beats, sampleRate, tempo);

  return {
    beats: beats.length >= 4 ? beats : peaks,
    tempo: refinedTempo,
  };
}

function classifyDownbeats(beats: BeatInfo[]): BeatInfo[] {
  if (beats.length === 0) return beats;
  if (beats.length < 4) {
    return beats.map((beat, index) => ({
      ...beat,
      isDownbeat: index === 0,
    }));
  }

  let bestOffset = 0;
  let bestScore = -Infinity;

  for (let offset = 0; offset < 4; offset++) {
    let total = 0;
    let count = 0;

    for (let i = offset; i < beats.length; i += 4) {
      total += beats[i].strength;
      count += 1;
    }

    const score = count > 0 ? total / count : -Infinity;
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  return beats.map((beat, index) => ({
    ...beat,
    isDownbeat: index % 4 === bestOffset,
  }));
}

export async function analyzeBeatDetection(
  buffer: AudioBuffer,
): Promise<BeatAnalysis> {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;

  if (length === 0 || numChannels === 0) {
    return { beats: [], reactiveBeats: [], tempo: 120 };
  }

  const mono = new Float32Array(length);
  let sum = 0;
  let peakAbs = 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / numChannels;
    }
  }

  for (let i = 0; i < mono.length; i++) {
    sum += mono[i];
    peakAbs = Math.max(peakAbs, Math.abs(mono[i]));
  }

  const mean = sum / mono.length;
  const scale = peakAbs > 0 ? 1 / peakAbs : 1;
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (mono[i] - mean) * scale;
  }

  const bassSignal = createLowPassedSignal(mono, sampleRate, LOWPASS_CUTOFF_HZ);
  const transientSignal = buildTransientSignal(mono);

  const fullEnergy = computeFrameRms(mono);
  const bassEnergy = computeFrameRms(bassSignal);
  const transientEnergy = computeFrameRms(transientSignal);

  const onset = new Float32Array(fullEnergy.length);
  for (let frame = 1; frame < fullEnergy.length; frame++) {
    const bassFlux = Math.max(0, bassEnergy[frame] - bassEnergy[frame - 1]);
    const fullFlux = Math.max(0, fullEnergy[frame] - fullEnergy[frame - 1]);
    const transientFlux = Math.max(
      0,
      transientEnergy[frame] - transientEnergy[frame - 1],
    );

    onset[frame] = bassFlux * 0.5 + fullFlux * 0.3 + transientFlux * 0.2;
  }

  const novelty = normalizeOnsetEnvelope(onset);
  const peaks = pickPeaks(novelty, bassEnergy, sampleRate);
  const estimatedTempo = estimateTempo(novelty, sampleRate);
  const tracked = trackBeatSequence(
    peaks,
    estimatedTempo,
    sampleRate,
    novelty.length,
  );

  const maxPeakStrength = Math.max(
    1e-6,
    ...tracked.beats.map((beat) => beat.strength + beat.bass * 0.25),
  );

  const beatInfos = classifyDownbeats(
    tracked.beats.map((beat) => ({
      time: beat.time,
      strength: Math.min(
        1,
        (beat.strength + beat.bass * 0.25) / maxPeakStrength,
      ),
      isDownbeat: false,
    })),
  );
  const reactiveBeats = buildReactiveBeats(peaks, beatInfos);

  return {
    beats: beatInfos,
    reactiveBeats,
    tempo: tracked.tempo,
  };
}

function buildReactiveBeats(
  peaks: PeakInfo[],
  trackedBeats: BeatInfo[],
): BeatInfo[] {
  if (peaks.length === 0) return trackedBeats;

  const maxReactiveStrength = Math.max(
    1e-6,
    ...peaks.map((peak) => peak.strength + peak.bass * 0.35),
  );
  const trackedDownbeats = trackedBeats.filter((beat) => beat.isDownbeat);

  const accentPeaks = peaks
    .map((peak) => ({
      time: peak.time,
      strength: Math.min(
        1,
        (peak.strength + peak.bass * 0.35) / maxReactiveStrength,
      ),
      isDownbeat: false,
    }))
    .filter((peak) => peak.strength >= 0.16);

  const merged = [...trackedBeats, ...accentPeaks].sort(
    (a, b) => a.time - b.time,
  );
  const deduped: BeatInfo[] = [];

  for (const beat of merged) {
    const previous = deduped[deduped.length - 1];
    if (!previous) {
      deduped.push(beat);
      continue;
    }

    if (Math.abs(previous.time - beat.time) > 0.14) {
      deduped.push(beat);
      continue;
    }

    const shouldReplace =
      (!previous.isDownbeat && beat.isDownbeat) ||
      (previous.isDownbeat === beat.isDownbeat &&
        beat.strength > previous.strength);
    if (shouldReplace) {
      deduped[deduped.length - 1] = beat;
    }
  }

  return deduped.map((beat) => ({
    ...beat,
    isDownbeat:
      beat.isDownbeat ||
      trackedDownbeats.some(
        (trackedBeat) => Math.abs(trackedBeat.time - beat.time) <= 0.16,
      ),
  }));
}

/**
 * Filter beats to highlight the strongest markers while keeping the pulse visible.
 */
export function filterMajorBeats(beats: BeatInfo[]): BeatInfo[] {
  if (beats.length <= 8) return beats;

  const strengths = [...beats]
    .map((beat) => beat.strength)
    .sort((a, b) => a - b);
  const percentileIndex = Math.floor(strengths.length * 0.65);
  const cutoff = Math.max(strengths[percentileIndex] ?? 0, 0.2);

  return beats.filter((beat) => beat.isDownbeat || beat.strength >= cutoff);
}
