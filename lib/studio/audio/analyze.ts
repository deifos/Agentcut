import { analyzeBeatDetection } from "@/lib/beat-detection";
import { decodeAudioUrl, toMono } from "@/lib/studio/audio/decode";
import { measureLoudness, roundDb } from "@/lib/studio/audio/loudness";

function onePole(input: Float32Array, cutoff: number, rate: number, highpass: boolean) {
  const out = new Float32Array(input.length);
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / rate;
  if (highpass) {
    const alpha = rc / (rc + dt);
    let prevIn = 0;
    let prevOut = 0;
    for (let i = 0; i < input.length; i += 1) {
      prevOut = alpha * (prevOut + input[i] - prevIn);
      prevIn = input[i];
      out[i] = prevOut;
    }
  } else {
    const alpha = dt / (rc + dt);
    let prev = 0;
    for (let i = 0; i < input.length; i += 1) {
      prev += alpha * (input[i] - prev);
      out[i] = prev;
    }
  }
  return out;
}

function frameRms(signal: Float32Array, rate: number, fps: number) {
  const perFrame = rate / fps;
  const frames = Math.ceil(signal.length / perFrame);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f += 1) {
    const start = Math.floor(f * perFrame);
    const end = Math.min(signal.length, Math.floor((f + 1) * perFrame));
    let sum = 0;
    for (let i = start; i < end; i += 1) sum += signal[i] * signal[i];
    out[f] = end > start ? Math.sqrt(sum / (end - start)) : 0;
  }
  return out;
}

function normalize(values: Float32Array) {
  let max = 0;
  for (const v of values) max = Math.max(max, v);
  return Array.from(values, (v) => (max > 0 ? Math.round((v / max) * 1000) / 1000 : 0));
}

/** Beats, onsets and per-frame energy (like video-studio's analyze.py → audio.json). */
export async function analyzeAudioUrl(url: string, fps: number) {
  const buffer = await decodeAudioUrl(url);
  const mono = toMono(buffer);
  const rate = buffer.sampleRate;
  const beats = await analyzeBeatDetection(buffer);
  const energy = frameRms(mono, rate, fps);
  const low = frameRms(onePole(mono, 200, rate, false), rate, fps);
  const high = frameRms(onePole(mono, 4000, rate, true), rate, fps);
  // Onset strength: positive change in log energy, peaks above a local mean.
  const logEnergy = Array.from(energy, (v) => Math.log10(v + 1e-6));
  const flux = logEnergy.map((v, i) => (i === 0 ? 0 : Math.max(0, v - logEnergy[i - 1])));
  const onsets: number[] = [];
  for (let i = 2; i < flux.length - 2; i += 1) {
    const window = flux.slice(Math.max(0, i - 8), i + 8);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    if (flux[i] > 0.15 && flux[i] > mean * 2.5 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1]) {
      if (onsets.length === 0 || i - onsets[onsets.length - 1] > 3) onsets.push(i);
    }
  }
  const loudness = measureLoudness(buffer);
  return {
    seconds: Number(buffer.duration.toFixed(3)),
    frames: energy.length,
    fps,
    tempoBpm: Math.round(beats.tempo * 10) / 10,
    beatFrames: beats.beats.map((beat) => Math.round(beat.time * fps)),
    downbeatFrames: beats.beats.filter((beat) => beat.isDownbeat).map((beat) => Math.round(beat.time * fps)),
    strongBeatFrames: beats.reactiveBeats.map((beat) => Math.round(beat.time * fps)),
    onsetFrames: onsets,
    energy: normalize(energy),
    low: normalize(low),
    high: normalize(high),
    loudness: {
      integratedLufs: roundDb(loudness.integratedLufs),
      truePeakDb: roundDb(loudness.truePeakDb),
      loudnessRangeLu: roundDb(loudness.loudnessRangeLu),
    },
  };
}
