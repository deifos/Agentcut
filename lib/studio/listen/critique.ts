// Port of earshot/critique.py + earshot/profile.py metrics for a Studio project.
// Measures the project's audio mix (as the export will normalize it) against the profile of
// 7 professional launch films (earshot data/launch_profile.json) and web-delivery practice,
// plus Studio-specific checks the timeline makes possible: SFX cue sync and voice/music balance.
import profile from "@/lib/studio/listen/data/launch-profile.json";
import realnessModel from "@/lib/studio/listen/data/realness-model.json";
import { studioFileUrl } from "@/lib/studio/bundle";
import { decodeAudioUrl } from "@/lib/studio/audio/decode";
import { mixProjectAudio } from "@/lib/studio/audio/mix";
import { loudnessCurve, measureChannels, measureLoudness, shortTermCurve } from "@/lib/studio/audio/loudness";
import { onsetDetect, onsetStrength, resampleLinear, welch, nextPow2 } from "@/lib/studio/listen/dsp";
import type { AudioClip, SceneClip, StudioClip, StudioDoc } from "@/lib/studio/types";

const HR = 22_050;
const HOP = 256;
const E2 = 0.002;
const SHORT_S = 10;
const MONO_DB = -40;
const SHIFTS = [0.23, 0.31, 0.43, 0.57, 0.71, 0.87, 1.13, 1.37, -0.29, -0.41, -0.53, -0.67, -0.79, -0.97, -1.19, -1.43];
const BANDS: Record<string, [number, number]> = {
  sub: [20, 60],
  low: [60, 250],
  lowmid: [250, 1000],
  mid: [1000, 4000],
  presence: [4000, 8000],
  air: [8000, 16000],
};

type Sides = "both" | "upper" | "lower";
// key: [weight, tolerance, sides, practice window, why]
const SPEC: Record<string, [number, number, Sides, [number | null, number | null] | null, string, string]> = {
  lufs_i: [3, 1.0, "both", [-16, -9], "integrated loudness", "how loud it plays next to other launch videos (X, LinkedIn and site autoplay don't normalize; YouTube turns masters above −14 LUFS down)"],
  true_peak: [2, 0.5, "upper", [null, -1], "true peak", "above −1 dBTP the AAC encode clips: crackle on the biggest hits"],
  p_real: [3, 0, "lower", null, "realness of the mix", "next to pro launch films, code-synthesized sound reads as cheap and generic"],
  music_frac: [3, 0.05, "lower", null, "music presence", "the references are music-led: one continuous track carries the energy and hides edit seams"],
  cuts_with_sound: [2, 0.05, "lower", null, "sound on cuts", "a cut or big visual change with no sound under it feels dead"],
  lra: [2, 1.0, "both", null, "loudness range", "launch films keep the body consistently strong"],
  crest_lu: [2, 0.5, "both", null, "loudest 3 s above integrated", "how far the loudest moment sticks out"],
  first_sound_s: [2, 0.1, "upper", null, "time to first sound", "silence at the start loses autoplay viewers"],
  end_silence_s: [2, 0.25, "upper", null, "dead air at the end", "dead air after the sound stops makes the ending feel unfinished"],
  max_gap_s: [2, 0.25, "upper", null, "longest silent gap", "a silent hole mid-film reads as a mistake unless it's a deliberate stop-down"],
  final_lu: [2, 1.5, "both", null, "final moment vs integrated", "the logo / end card should land at body level or above"],
  onset_rate: [2, 0.3, "both", null, "onset density", "too sparse feels empty, too dense feels cluttered"],
  hit_rate: [2, 0.2, "both", null, "salient hit density", "salient hits mark the key moments"],
  intro_lu: [1, 1.5, "both", null, "opening level (first 10%)", "the references open close to body level"],
  end_lu: [1, 1.5, "both", null, "closing level (last 10%)", "how the last 10% sit against the body"],
  fade_s: [1, 0.5, "both", null, "final fade length", "launch films end on a sting or a hard out; long fades lose the button"],
  band_sub: [1, 1.5, "both", null, "sub 20–60 Hz share", "sub weight under hits and music"],
  band_low: [1, 1.5, "both", null, "low 60–250 Hz share", "low-end body"],
  band_lowmid: [1, 1.5, "both", null, "low-mid 250 Hz–1 kHz share", "too much = muddy, too little = hollow"],
  band_mid: [1, 1.5, "both", null, "mid 1–4 kHz share", "where clicks and voice cut through phone speakers"],
  band_presence: [1, 1.5, "both", null, "presence 4–8 kHz share", "bite of transients, clicks and typing"],
  band_air: [1, 1.5, "both", null, "air 8–16 kHz share", "openness; missing air sounds muffled"],
  side_to_mid_db: [1, 1.0, "both", null, "stereo width (side vs mid)", "near-mono sounds small, too wide collapses on phones"],
};
const SHAPE = new Set(["lra", "crest_lu", "intro_lu", "end_lu", "final_lu"]);

const FIX: Record<string, [string, string]> = {
  lufs_i: ["raise the whole mix (the export normalizes to −14 LUFS)", "lower the whole mix"],
  true_peak: ["", "lower the loudest hit or the music under it; peaks above −1 dBTP clip after encoding"],
  music_frac: ["add a music bed under the whole video (fade it under the voice, not out)", ""],
  cuts_with_sound: ["put a short SFX (whoosh, pop, click) or a music accent on the silent cuts listed below", ""],
  lra: ["the level hardly moves: let the music breathe (quieter intro, a drop)", "the level swings too much: bring quiet stretches up or loud ones down"],
  crest_lu: ["no moment stands out: make the drop / reveal hit harder", "the loudest moment sticks out too much: tame it"],
  first_sound_s: ["", "start sound on frame 0 (music, a hit, the first word)"],
  end_silence_s: ["", "end the video when the sound ends, or extend the final ring-out"],
  max_gap_s: ["", "fill the silent gap (music bed, room tone) unless it's a deliberate stop-down before a hit"],
  final_lu: ["the end card is too quiet: land a final hit / chord on it", "the end is louder than the body by a lot"],
  onset_rate: ["too sparse: add rhythmic detail (SFX on motion, a busier music bed)", "too dense: remove some SFX"],
  hit_rate: ["add a few salient hits on the key moments (reveal, logo, URL)", "too many hits: keep only the key moments"],
  intro_lu: ["the opening is quiet: start nearer body level or build fast", "the opening is louder than the body"],
  end_lu: ["the last 10% are quiet", "the last 10% are loud"],
  fade_s: ["", "replace the long fade-out with a hard out or a final sting"],
  side_to_mid_db: ["near-mono: use stereo music / pan some SFX", "very wide: check it on a phone speaker"],
  band_sub: ["thin bottom: add a sub layer under reveals, or music with real low end", "too much 20–60 Hz rumble: high-pass SFX at 30–40 Hz and cut the music's sub by 2–4 dB"],
  band_low: ["weak low end: fuller music or a low layer", "boomy: cut 100–200 Hz on the music and heavy SFX by 2–3 dB"],
  band_lowmid: ["hollow: lift 250 Hz–1 kHz or use fuller recordings", "muddy: cut 300–500 Hz on the music and roomy SFX by 2–3 dB"],
  band_mid: ["recessed mids: clicks and voice won't cut through phones", "harsh mids: cut 1–3 kHz on the loudest layer by 2 dB"],
  band_presence: ["dull transients: brighter SFX", "harsh / sibilant: cut 5–7 kHz"],
  band_air: ["no air: use full-band recordings (no low-pass)", "hissy: low-pass or de-noise the noisiest layer"],
  p_real: ["replace code-synthesized sounds with real recordings (listen_rank + listen_realness)", ""],
};

const energyMean = (values: number[]) =>
  values.length ? 10 * Math.log10(values.reduce((a, v) => a + Math.pow(10, v / 10), 0) / values.length) : NaN;

function frameRmsDb(mono: Float32Array, sampleRate: number, winS: number) {
  const win = Math.max(1, Math.round(winS * sampleRate));
  const n = Math.floor(mono.length / win);
  const out = new Float64Array(Math.max(1, n));
  for (let i = 0; i < n; i += 1) {
    let s = 0;
    for (let j = i * win; j < (i + 1) * win; j += 1) s += mono[j] * mono[j];
    out[i] = 20 * Math.log10(Math.sqrt(s / win + 1e-20) + 1e-9);
  }
  return out;
}

function attackTimes(times: number[], e2: Float64Array) {
  return times.map((t) => {
    const a = Math.max(1, Math.floor((t - 0.06) / E2));
    const b = Math.min(e2.length - 1, Math.floor((t + 0.02) / E2) + 1);
    if (b - a < 2) return t;
    let best = a;
    let bestD = -Infinity;
    for (let i = a; i <= b; i += 1) {
      const d = e2[i] - e2[i - 1];
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    return Math.round(best * E2 * 10000) / 10000;
  });
}

function edge(e2: Float64Array, t: number, first: boolean) {
  const a = Math.max(0, Math.floor((t - 0.05) / E2));
  const b = Math.min(e2.length, Math.floor((t + 0.05) / E2) + 1);
  if (b <= a) return Math.max(0, t);
  const span = Math.floor(0.15 / E2);
  let ref = -Infinity;
  if (first) for (let i = a; i < Math.min(e2.length, a + span); i += 1) ref = Math.max(ref, e2[i]);
  else for (let i = Math.max(0, b - span); i < b; i += 1) ref = Math.max(ref, e2[i]);
  const ok: number[] = [];
  for (let i = a; i < b; i += 1) if (e2[i] >= ref - 20) ok.push(i - a);
  if (!ok.length) return Math.max(0, t);
  return Math.round((a + (first ? ok[0] : ok[ok.length - 1] + 1)) * E2 * 1000) / 1000;
}

function salientHits(tf: Float64Array, Lf: Float64Array, lufs: number, env: Float64Array, e2: Float64Array) {
  if (Lf.length < 20) return [];
  const h = tf[1] - tf[0];
  const a = Math.round(0.2 / h);
  const b = Math.round(0.08 / h);
  const idx: number[] = [];
  for (let i = 0; i < Lf.length; i += 1) {
    let pre = Infinity;
    for (let j = Math.max(0, i - a); j < i; j += 1) pre = Math.min(pre, Lf[j]);
    if (i - a < 0) pre = Math.min(pre, Lf[0]);
    if (!Number.isFinite(pre)) pre = Lf[0];
    let post = -Infinity;
    for (let j = i; j < Math.min(Lf.length, i + b); j += 1) post = Math.max(post, Lf[j]);
    if (post - pre >= 6 && post >= lufs - 8) idx.push(i);
  }
  if (!idx.length) return [];
  const runs: number[][] = [];
  for (const i of idx) {
    const last = runs[runs.length - 1];
    if (last && i - last[last.length - 1] <= 2) last.push(i);
    else runs.push([i]);
  }
  const out: number[] = [];
  for (const run of runs) {
    const t0 = tf[run[0]] - 0.05;
    const t1 = tf[run[run.length - 1]] + 0.1;
    let best = -1;
    let bestV = -Infinity;
    for (let k = Math.max(0, Math.floor((t0 * HR) / HOP)); k < Math.min(env.length, Math.ceil((t1 * HR) / HOP)); k += 1) {
      if (env[k] > bestV) {
        bestV = env[k];
        best = k;
      }
    }
    const t = best >= 0 ? (best * HOP) / HR : tf[run[0]] + 0.03;
    if (!out.length || t - out[out.length - 1] > 0.1) out.push(t);
  }
  return attackTimes(out, e2);
}

function nearFrac(events: number[], targets: number[], tol: number) {
  if (!events.length) return null;
  if (!targets.length) return 0;
  const sorted = [...targets].sort((a, b) => a - b);
  let hit = 0;
  for (const e of events) if (sorted.some((t) => Math.abs(t - e) <= tol)) hit += 1;
  return hit / events.length;
}

function chanceFrac(events: number[], targets: number[], tol: number, dur: number) {
  if (!events.length || dur <= 0) return null;
  const values = SHIFTS.map((s) => nearFrac(events.map((e) => (((e + s) % dur) + dur) % dur), targets, tol) ?? 0);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function longestRun(mask: boolean[]) {
  let best = 0;
  let cur = 0;
  for (const b of mask) {
    cur = b ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

function isRole(track: { id: string; name: string }, clip: AudioClip, role: "music" | "voice" | "sfx") {
  if (clip.role) return clip.role === role;
  const name = `${track.id} ${track.name}`.toLowerCase();
  if (role === "music") return /music|song|bed/.test(name);
  if (role === "voice") return /voice|vo\b|narrat/.test(name);
  return /sfx|fx|sound|hit/.test(name);
}

export interface CritiqueOptions {
  fast?: boolean;
}

export async function critiqueProject(doc: StudioDoc, variant: string, options: CritiqueOptions = {}) {
  const project = doc.project!;
  const layers = doc.layers!;
  const fps = project.fps;
  const mix = await mixProjectAudio(doc, variant);
  if (!mix) {
    return { verdict: "silent", summary: "The project has no audio clips: nothing to critique.", metrics: [] };
  }
  const dur = mix.duration;
  // What the export will do: normalize to −14 LUFS with ≥ 2 dB peak headroom.
  const before = measureLoudness(mix);
  const gainDb = Number.isFinite(before.integratedLufs) ? Math.min(-14 - before.integratedLufs, -2 - before.truePeakDb) : 0;
  const g = Math.pow(10, gainDb / 20);
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, mix.numberOfChannels); c += 1) channels.push(mix.getChannelData(c).map((v) => v * g));
  if (channels.length === 1) channels.push(channels[0]);
  const sr = mix.sampleRate;
  const meas = measureChannels(channels, sr);
  const I = Number.isFinite(meas.integratedLufs) ? meas.integratedLufs : -70;
  const mono = new Float32Array(channels[0].length);
  for (let i = 0; i < mono.length; i += 1) mono[i] = (channels[0][i] + channels[1][i]) / 2;

  const { t: tf, L: Lf } = loudnessCurve(channels, sr, 0.1, 0.02);
  const { t: tm, L: Lm } = loudnessCurve(channels, sr, 0.4, 0.1);
  const e2 = frameRmsDb(mono, sr, E2);
  const y22 = resampleLinear(mono, sr, HR);
  const env = onsetStrength(y22, HR, HOP);
  const onsets = attackTimes(onsetDetect(env, HR, HOP).map((f) => (f * HOP) / HR), e2);
  const hits = salientHits(tf, Lf, I, env, e2);

  const v: Record<string, number | null> = {};
  v.lufs_i = I;
  v.true_peak = meas.truePeakDb;
  v.lra = dur >= 6 ? meas.loudnessRangeLu : null;
  v.crest_lu = Number.isFinite(meas.shortTermMaxLufs) ? meas.shortTermMaxLufs - I : null;
  const tmArr = Array.from(tm);
  const LmArr = Array.from(Lm);
  v.intro_lu = energyMean(LmArr.filter((_, i) => tmArr[i] <= Math.max(0.1 * dur, 0.5))) - I;
  v.end_lu = energyMean(LmArr.filter((_, i) => tmArr[i] >= dur - Math.max(0.1 * dur, 0.5))) - I;
  const loudIdx = Array.from(Lf).map((L, i) => (L > I - 20 ? i : -1)).filter((i) => i >= 0);
  const audibleIdx = Array.from(Lf).map((L, i) => (L > I - 30 ? i : -1)).filter((i) => i >= 0);
  let tEnd = dur;
  if (loudIdx.length) v.first_sound_s = edge(e2, tf[loudIdx[0]], true);
  if (audibleIdx.length) {
    tEnd = Math.min(dur, edge(e2, tf[audibleIdx[audibleIdx.length - 1]], false));
    v.end_silence_s = Math.max(0, dur - tEnd);
    const full = tmArr.map((t, i) => (LmArr[i] >= I - 6 && t <= tEnd ? i : -1)).filter((i) => i >= 0);
    if (full.length) v.fade_s = Math.max(0, tEnd - tm[full[full.length - 1]] - 0.2);
    const inside = Array.from(tf).map((t, i) => (t >= (v.first_sound_s ?? 0) && t <= tEnd ? i : -1)).filter((i) => i >= 0);
    v.max_gap_s = inside.length > 1 ? longestRun(inside.map((i) => Lf[i] < I - 30)) * (tf[1] - tf[0]) : 0;
    const last = LmArr.filter((_, i) => tmArr[i] >= tEnd - 3 && tmArr[i] <= tEnd);
    if (last.length) v.final_lu = Math.max(...last) - I;
  }
  v.onset_rate = onsets.length / dur;
  v.hit_rate = hits.length / dur;
  if (dur < SHORT_S) for (const key of SHAPE) v[key] = null;

  // Spectrum bands (whole file) and stereo.
  const nper = Math.min(65536, Math.max(1024, nextPow2(Math.min(mono.length, 65536))));
  const { freqs, psd } = welch(mono, sr, nper);
  let total = 0;
  for (const p of psd) total += p + 1e-30;
  for (const [name, [a, b]] of Object.entries(BANDS)) {
    let s = 0;
    for (let k = 0; k < freqs.length; k += 1) if (freqs[k] >= a && freqs[k] < b) s += psd[k];
    v[`band_${name}`] = 10 * Math.log10(s / total + 1e-12);
  }
  let sideE = 0;
  let midE = 0;
  for (let i = 0; i < mono.length; i += 1) {
    const mid = (channels[0][i] + channels[1][i]) / 2;
    const side = (channels[0][i] - channels[1][i]) / 2;
    midE += mid * mid;
    sideE += side * side;
  }
  const sideRms = Math.sqrt(sideE / mono.length);
  v.side_to_mid_db = sideRms > 1e-7 ? 20 * Math.log10(sideRms) - 20 * Math.log10(Math.sqrt(midE / mono.length) + 1e-12) : MONO_DB;

  // Music / voice presence from the layers (5 s windows, like earshot's AudioSet pass).
  const windows = Math.max(1, Math.ceil(dur / 5));
  const covered = (role: "music" | "voice") => {
    let count = 0;
    for (let w = 0; w < windows; w += 1) {
      const a = w * 5;
      const b = Math.min(dur, a + 5);
      let inside = 0;
      for (const track of layers.tracks) {
        if (track.kind !== "audio" || track.muted) continue;
        for (const clip of track.clips as AudioClip[]) {
          if (!isRole(track, clip, role)) continue;
          inside += Math.max(0, Math.min(b, (clip.from + clip.duration) / fps) - Math.max(a, clip.from / fps));
        }
      }
      if (inside >= Math.min(2.5, (b - a) / 2)) count += 1;
    }
    return count / windows;
  };
  v.music_frac = covered("music");
  const speechFrac = covered("voice");

  // Visual events = scene / image / video clip starts and section markers (the Studio knows its cuts).
  const cutSet: number[] = [];
  for (const track of layers.tracks) {
    if (track.kind === "audio" || track.kind === "captions" || track.hidden) continue;
    if (track.kind === "text") continue;
    for (const clip of track.clips as StudioClip[]) if (clip.from > 0) cutSet.push(clip.from / fps);
  }
  for (const marker of layers.markers) if (marker.kind === "section" && marker.frame > 0) cutSet.push(marker.frame / fps);
  const cuts = [...new Set(cutSet.map((t) => Math.round(t * 1000) / 1000))].sort((a, b) => a - b).filter((t, i, arr) => i === 0 || t - arr[i - 1] > 0.1);
  let chanceCuts: number | null = null;
  if (cuts.length >= 3) {
    v.cuts_with_sound = nearFrac(cuts, onsets, 0.1);
    chanceCuts = chanceFrac(cuts, onsets, 0.1, dur);
  } else v.cuts_with_sound = null;
  const silentCuts = cuts.filter(
    (t) => !onsets.some((o) => Math.abs(o - t) <= 0.1) && !hits.some((h) => Math.abs(h - t) <= 0.15),
  );

  // Realness of the mix (mean of 4 s windows), unless fast.
  let realness: { p_real: number; verdict: string; synthesizedStretches: string[] } | null = null;
  if (!options.fast) {
    try {
      const { realnessOfSamples } = await import("@/lib/studio/listen/realness");
      const result = await realnessOfSamples(mono, sr);
      if (result.p_real !== null) {
        realness = { p_real: result.p_real, verdict: result.verdict, synthesizedStretches: result.synthesizedStretches };
        v.p_real = result.p_real;
      }
    } catch {
      v.p_real = null;
    }
  } else v.p_real = null;

  // SFX cue sync: when does each SFX actually sound vs the nearest cue?
  const cueTimes = [
    ...cuts,
    ...layers.markers.filter((m) => m.kind !== "beat").map((m) => m.frame / fps),
    ...layers.tracks
      .filter((t) => t.kind === "text" || t.kind === "captions")
      .flatMap((t) => (t.clips as StudioClip[]).map((c) => c.from / fps)),
  ];
  const sfxSync: { clipId: string; soundsAt: number; nearestCue: number | null; offsetFrames: number | null; note?: string }[] = [];
  const onsetCache = new Map<string, number>();
  for (const track of layers.tracks) {
    if (track.kind !== "audio" || track.muted) continue;
    for (const clip of track.clips as AudioClip[]) {
      if (!isRole(track, clip, "sfx")) continue;
      let onset = onsetCache.get(clip.src);
      if (onset === undefined) {
        try {
          onset = Math.max(0, measureLoudness(await decodeAudioUrl(studioFileUrl(doc.slug, clip.src))).onsetS);
        } catch {
          onset = 0;
        }
        onsetCache.set(clip.src, onset);
      }
      const soundsAt = clip.from / fps + Math.max(0, onset - (clip.trimStart ?? 0) / fps);
      let nearest: number | null = null;
      for (const cue of cueTimes) if (nearest === null || Math.abs(cue - soundsAt) < Math.abs(nearest - soundsAt)) nearest = cue;
      const offset = nearest === null ? null : Math.round((soundsAt - nearest) * fps);
      sfxSync.push({
        clipId: clip.id,
        soundsAt: Math.round(soundsAt * 1000) / 1000,
        nearestCue: nearest === null ? null : Math.round(nearest * 1000) / 1000,
        offsetFrames: offset,
        note:
          offset === null || Math.abs(offset) > 15
            ? "not near any cut, marker or title: is it cued to motion inside a scene? add a cue marker"
            : Math.abs(offset) > 1
              ? `sounds ${Math.abs(offset)} frame${Math.abs(offset) > 1 ? "s" : ""} ${offset > 0 ? "late" : "early"}: move it ${offset > 0 ? "earlier" : "later"} by ${Math.abs(offset)}f`
              : undefined,
      });
    }
  }

  // Voice vs music balance where both play.
  let balance: { medianLu: number; quietWindows: string[] } | null = null;
  const ids = (role: "music" | "voice") =>
    new Set(
      layers.tracks.flatMap((t) => (t.kind === "audio" && !t.muted ? (t.clips as AudioClip[]).filter((c) => isRole(t, c, role)).map((c) => c.id) : [])),
    );
  const musicIds = ids("music");
  const voiceIds = ids("voice");
  if (musicIds.size && voiceIds.size) {
    const [voiceMix, musicMix] = await Promise.all([
      mixProjectAudio(doc, variant, { clipIds: voiceIds }),
      mixProjectAudio(doc, variant, { clipIds: musicIds }),
    ]);
    if (voiceMix && musicMix) {
      const vc = shortTermCurve(voiceMix, 0.5);
      const mc = shortTermCurve(musicMix, 0.5);
      const diffs: number[] = [];
      const quiet: string[] = [];
      for (let i = 0; i < Math.min(vc.length, mc.length); i += 1) {
        if (vc[i] > -45 && mc[i] > -60) {
          const d = vc[i] - mc[i];
          diffs.push(d);
          if (d < 6) quiet.push(`${(i * 0.5).toFixed(1)}–${(i * 0.5 + 3).toFixed(1)} s (${d.toFixed(1)} LU)`);
        }
      }
      if (diffs.length) {
        diffs.sort((a, b) => a - b);
        balance = { medianLu: Math.round(diffs[Math.floor(diffs.length / 2)] * 10) / 10, quietWindows: quiet.slice(0, 8) };
      }
    }
  }

  // Score against the reference profile.
  const stats = profile.metrics as Record<string, { min: number; max: number; median: number; p10: number; p90: number }>;
  const rows: {
    key: string;
    label: string;
    value: number | null;
    range: [number | null, number | null];
    typical?: [number, number];
    status: "ok" | "low" | "high" | "n.a.";
    weight: string;
    why: string;
    fix?: string;
  }[] = [];
  let earned = 0;
  let possible = 0;
  let critical = false;
  const weightName = ["info", "minor", "major", "critical"];
  for (const [key, [weight, tol, sides, practice, label, why]] of Object.entries(SPEC)) {
    const value = v[key] ?? null;
    let lo: number | null = null;
    let hi: number | null = null;
    if (key === "p_real") {
      lo = realnessModel.file_thresholds.hi;
    } else if (practice) {
      [lo, hi] = practice;
    } else if (stats[key]) {
      lo = stats[key].min - tol;
      hi = stats[key].max + tol;
      if (key.endsWith("_rate") && lo < 0) lo = stats[key].min / 2;
    }
    if (sides === "upper") lo = null;
    if (sides === "lower") hi = null;
    let status: "ok" | "low" | "high" | "n.a." = "n.a.";
    if (value !== null && Number.isFinite(value)) {
      status = lo !== null && value < lo ? "low" : hi !== null && value > hi ? "high" : "ok";
      let w = weight;
      if (status !== "ok" && weight === 3 && key !== "p_real") {
        const miss = status === "low" ? (lo as number) - value : value - (hi as number);
        if (miss <= 2 * Math.max(tol, 0.5)) w = 2;
      }
      if (key === "p_real" && status !== "ok" && value >= 0.5) w = 1;
      possible += weight;
      if (status === "ok") earned += weight;
      else if (w === 3) critical = true;
      rows.push({
        key,
        label,
        value: Math.round(value * 100) / 100,
        range: [lo === null ? null : Math.round(lo * 100) / 100, hi === null ? null : Math.round(hi * 100) / 100],
        typical: stats[key] ? [stats[key].p10, stats[key].p90] : undefined,
        status,
        weight: weightName[w],
        why,
        fix: status === "low" ? FIX[key]?.[0] || undefined : status === "high" ? FIX[key]?.[1] || undefined : undefined,
      });
    } else {
      rows.push({ key, label, value: null, range: [lo, hi], status, weight: weightName[weight], why });
    }
  }
  const score = possible ? earned / possible : 0;
  const verdict =
    score >= 0.9 && !critical ? "launch-grade" : score >= 0.75 && !critical ? "close" : score >= 0.5 ? "needs work" : "not launch-grade";
  const problems = rows.filter((r) => r.status === "low" || r.status === "high");
  const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
  const fixes = [
    ...problems
      .sort((a, b) => ["critical", "major", "minor"].indexOf(a.weight) - ["critical", "major", "minor"].indexOf(b.weight))
      .map((row) => `[${row.weight}] ${row.label} ${row.value} (${row.status}; range ${row.range[0] ?? "…"} .. ${row.range[1] ?? "…"}): ${row.fix ?? row.why}`),
    ...(silentCuts.length ? [`no sound at these cuts: ${silentCuts.slice(0, 10).map(fmt).join(", ")}${silentCuts.length > 10 ? ` (+${silentCuts.length - 10})` : ""}`] : []),
    ...sfxSync.filter((s) => s.note).map((s) => `SFX ${s.clipId} at ${fmt(s.soundsAt)}: ${s.note}`),
    ...(balance && balance.medianLu < 6
      ? [`voice sits only ${balance.medianLu} LU above the music (want ≥ 6): lower the music under the voice`]
      : []),
    ...(balance && balance.quietWindows.length && balance.medianLu >= 6 ? [`voice close to the music in: ${balance.quietWindows.join(", ")}`] : []),
    ...(realness?.synthesizedStretches.length ? [`code-synthesized-sounding stretches: ${realness.synthesizedStretches.join(", ")}`] : []),
  ];
  return {
    verdict,
    score: Math.round(score * 100),
    summary: `${verdict} (${Math.round(score * 100)}% of weighted checks pass${critical ? ", with a critical issue" : ""}). Mix ${before.integratedLufs.toFixed(1)} LUFS → export ${I.toFixed(1)} LUFS (gain ${gainDb >= 0 ? "+" : ""}${gainDb.toFixed(1)} dB), true peak ${meas.truePeakDb.toFixed(1)} dBTP, ${onsets.length} onsets, ${hits.length} salient hits, ${cuts.length} cuts${v.cuts_with_sound !== null ? ` (${Math.round((v.cuts_with_sound ?? 0) * 100)}% with sound, chance ${Math.round((chanceCuts ?? 0) * 100)}%)` : ""}.`,
    fixes,
    metrics: rows,
    normalization: { mixLufs: Math.round(before.integratedLufs * 10) / 10, gainDb: Math.round(gainDb * 10) / 10 },
    voiceMusicBalance: balance,
    speechFrac: Math.round(speechFrac * 100) / 100,
    sfxSync,
    events: {
      cuts: cuts.map((t) => Math.round(t * 1000) / 1000),
      silentCuts,
      hits: hits.map((t) => Math.round(t * 1000) / 1000),
      onsets: onsets.length,
    },
    realness,
    reference: `${profile.summary} Ranges: min–max of the 7 reference films widened by a tolerance; loudness and true peak follow web practice (−16..−9 LUFS, ≤ −1 dBTP). Ported from earshot (MIT).`,
    scenes: layers.tracks.filter((t) => t.kind === "scene").flatMap((t) => (t.clips as SceneClip[]).map((c) => ({ id: c.id, at: c.from / fps }))),
  };
}
