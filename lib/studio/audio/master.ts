// Export mastering: the page renders the video with lossless PCM audio, then this file
// - measures the real rendered audio (scene-embedded audio included),
// - brings it to the loudness target with a look-ahead true-peak limiter (like ffmpeg
//   loudnorm=I=-14:TP=-1.5, which the old video-studio pipeline used),
// - encodes AAC once, compensating the encoder's priming delay with an MP4 edit list,
// - and copies the video packets untouched.
import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeAudio,
} from "mediabunny";
import { measureChannels, truePeakEnvelope } from "@/lib/studio/audio/loudness";

export interface MasteringOptions {
  targetLufs: number;
  /** Ceiling for the limiter, in dBTP, before encoding. */
  ceilingDb: number;
  /** false: keep the level, only re-encode (still limits overs above the ceiling). */
  normalize: boolean;
  /** Gain to apply when not normalizing (undoes the headroom pre-gain used for the render). */
  baseGainDb?: number;
  fps: number;
  signal?: AbortSignal;
}

export interface MasteringReport {
  renderedLufs: number | null;
  renderedTruePeakDb: number | null;
  gainDb: number;
  /** Largest gain reduction the limiter applied, in dB (0 = never touched). */
  limiterMaxReductionDb: number;
  resultLufs: number | null;
  resultTruePeakDb: number | null;
  /** Encoder priming delay removed with an edit list. */
  encoderDelaySamples: number;
  /** How the delay was found: decoding a probe, or libavcodec's known priming when this browser can't decode AAC. */
  encoderDelaySource: "probe" | "known" | "unverified";
  encoder: "native" | "libav";
}

const LOOKAHEAD_S = 0.005;
const RELEASE_S = 0.08;

/** libavcodec's AAC encoder (the fallback used when the browser has none) primes 1024 samples. */
const LIBAV_AAC_PRIMING = 1024;

let aacReady: Promise<"native" | "libav"> | null = null;
export function ensureAac() {
  aacReady ??= (async () => {
    if (await canEncodeAudio("aac")) return "native" as const;
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
    return "libav" as const;
  })();
  return aacReady;
}

function toAudioBuffer(channels: Float32Array[], sampleRate: number) {
  const buffer = new AudioBuffer({ numberOfChannels: channels.length, length: channels[0].length, sampleRate });
  channels.forEach((data, c) => buffer.copyToChannel(data as Float32Array<ArrayBuffer>, c));
  return buffer;
}

/** Decode the whole audio track of a file into planar float channels. */
async function readAudio(input: Input) {
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  const sink = new AudioBufferSink(track);
  const parts: { buffer: AudioBuffer; timestamp: number }[] = [];
  for await (const part of sink.buffers()) parts.push(part);
  if (!parts.length) return null;
  const sampleRate = parts[0].buffer.sampleRate;
  const channelCount = Math.min(2, parts[0].buffer.numberOfChannels);
  const end = parts.reduce((max, p) => Math.max(max, Math.round(p.timestamp * sampleRate) + p.buffer.length), 0);
  const channels = Array.from({ length: channelCount }, () => new Float32Array(end));
  for (const part of parts) {
    const offset = Math.max(0, Math.round(part.timestamp * sampleRate));
    for (let c = 0; c < channelCount; c += 1) {
      const data = part.buffer.getChannelData(Math.min(c, part.buffer.numberOfChannels - 1));
      channels[c].set(data.subarray(0, Math.max(0, Math.min(data.length, end - offset))), offset);
    }
  }
  return { channels, sampleRate };
}

/**
 * Look-ahead brickwall limiter on the true-peak envelope. The gain curve is a sliding
 * minimum over the look-ahead window, box-smoothed over the same window (so it is never
 * above the required gain at any sample), then released exponentially.
 */
export function limitChannels(
  channels: Float32Array[],
  sampleRate: number,
  gain: number,
  ceiling: number,
  /** truePeakEnvelope(channels), reused across passes (the envelope scales with gain). */
  envelope = truePeakEnvelope(channels, 0),
) {
  const n = channels[0].length;
  const scaled = channels.map((ch) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 1) out[i] = ch[i] * gain;
    return out;
  });
  const need = new Float32Array(n);
  let touched = false;
  for (let i = 0; i < n; i += 1) {
    const peak = envelope[i] * gain;
    need[i] = peak > ceiling ? ceiling / peak : 1;
    if (need[i] < 1) touched = true;
  }
  if (!touched) return { channels: scaled, maxReductionDb: 0 };

  const L = Math.max(1, Math.round(LOOKAHEAD_S * sampleRate));
  // hold[k] = min(need[k .. k+L]) with a monotonic deque.
  const hold = new Float32Array(n);
  const deque = new Int32Array(n + L + 1);
  let head = 0;
  let tail = 0;
  let next = 0;
  for (let k = 0; k < n; k += 1) {
    const last = Math.min(n - 1, k + L);
    while (next <= last) {
      while (tail > head && need[deque[tail - 1]] >= need[next]) tail -= 1;
      deque[tail++] = next;
      next += 1;
    }
    while (deque[head] < k) head += 1;
    hold[k] = need[deque[head]];
  }
  // smooth[i] = mean(hold[i-L .. i]); every window in that range contains i.
  // Samples before the start repeat hold[0] (so a peak at the very start is still covered).
  const smooth = new Float32Array(n);
  let sum = L * hold[0];
  for (let i = 0; i < n; i += 1) {
    const drop = i - L - 1;
    if (drop >= 0) sum -= hold[drop];
    else if (drop >= -L) sum -= hold[0];
    sum += hold[i];
    smooth[i] = sum / (L + 1);
  }
  const alpha = 1 - Math.exp(-1 / (RELEASE_S * sampleRate));
  let g = 1;
  let minGain = 1;
  for (let i = 0; i < n; i += 1) {
    g = Math.min(smooth[i], g + alpha * (1 - g));
    minGain = Math.min(minGain, g);
    for (const ch of scaled) ch[i] *= g;
  }
  return { channels: scaled, maxReductionDb: -20 * Math.log10(minGain) };
}

function master(channels: Float32Array[], sampleRate: number, options: MasteringOptions) {
  const before = measureChannels(channels, sampleRate);
  const ceiling = Math.pow(10, options.ceilingDb / 20);
  // Interpolate wherever a sample could reach the ceiling at up to +24 dB of gain.
  const envelope = truePeakEnvelope(channels, ceiling / 16 / 2);
  let gainDb = options.normalize && Number.isFinite(before.integratedLufs) ? options.targetLufs - before.integratedLufs : (options.baseGainDb ?? 0);
  let result = limitChannels(channels, sampleRate, Math.pow(10, gainDb / 20), ceiling, envelope);
  let after = measureChannels(result.channels, sampleRate);
  // Limiting lowers the integrated loudness a little; make it up (like loudnorm does).
  for (let pass = 0; options.normalize && pass < 3; pass += 1) {
    const miss = options.targetLufs - after.integratedLufs;
    if (!Number.isFinite(miss) || Math.abs(miss) < 0.05) break;
    gainDb += miss;
    result = limitChannels(channels, sampleRate, Math.pow(10, gainDb / 20), ceiling, envelope);
    after = measureChannels(result.channels, sampleRate);
  }
  return { channels: result.channels, before, after, gainDb, maxReductionDb: result.maxReductionDb };
}

/**
 * Encode a short burst with the AAC encoder this browser will use and find how many
 * samples late it comes back (priming). Chromium's built-in fallback (libavcodec) adds
 * 1024 samples and reports them at t=0, so without this the audio is ~21 ms late.
 */
async function probeEncoderDelay(sampleRate: number, channelCount: number, bitrate: number | typeof QUALITY_HIGH) {
  const length = Math.round(sampleRate * 0.5);
  const at = Math.round(sampleRate * 0.2);
  const burst = Math.round(sampleRate * 0.01);
  const signal = new Float32Array(length);
  for (let i = 0; i < burst; i += 1) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / burst);
    signal[at + i] = 0.5 * w * Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
  }
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new AudioBufferSource({ codec: "aac", bitrate });
  output.addAudioTrack(source);
  await output.start();
  await source.add(toAudioBuffer(Array.from({ length: channelCount }, () => signal), sampleRate));
  await output.finalize();
  const context = new OfflineAudioContext(channelCount, 1, sampleRate);
  const y = (await context.decodeAudioData(output.target.buffer!)).getChannelData(0);
  let best = 0;
  let bestLag = 0;
  const maxLag = Math.min(8192, y.length - at - burst);
  for (let lag = -Math.min(at, 2048); lag < maxLag; lag += 1) {
    let acc = 0;
    for (let i = 0; i < burst; i += 1) acc += signal[at + i] * y[at + lag + i];
    if (acc > best) {
      best = acc;
      bestLag = lag;
    }
  }
  return bestLag;
}

/**
 * Replace the PCM audio of a rendered MP4 with mastered AAC. Returns the new file and a
 * report, or null when the file has no audio track.
 */
export async function masterExport(rendered: Blob, options: MasteringOptions): Promise<{ blob: Blob; report: MasteringReport } | null> {
  const encoder = await ensureAac();
  const input = new Input({ source: new BlobSource(rendered), formats: ALL_FORMATS });
  const audio = await readAudio(input);
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!audio || !videoTrack) return null;
  options.signal?.throwIfAborted();

  const mastered = master(audio.channels, audio.sampleRate, options);
  options.signal?.throwIfAborted();

  const bitrate = QUALITY_HIGH;
  let delay = 0;
  let delaySource: MasteringReport["encoderDelaySource"] = "probe";
  try {
    delay = await probeEncoderDelay(audio.sampleRate, mastered.channels.length, bitrate);
  } catch (error) {
    // Browsers without proprietary codecs (e.g. test Chromium) can't decode AAC back.
    delay = encoder === "libav" ? LIBAV_AAC_PRIMING : 0;
    delaySource = encoder === "libav" ? "known" : "unverified";
    console.warn("[studio] couldn't probe the AAC encoder delay", error);
  }

  const videoCodec = videoTrack.codec;
  const videoConfig = await videoTrack.getDecoderConfig();
  if (!videoCodec || !videoConfig) throw new Error("Couldn't read the rendered video track.");

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const videoSource = new EncodedVideoPacketSource(videoCodec);
  output.addVideoTrack(videoSource, { frameRate: options.fps });
  // A negative start makes the muxer write an edit list that hides the priming samples.
  const audioSource = new AudioBufferSource({ codec: "aac", bitrate }, { startTimestamp: -delay / audio.sampleRate });
  output.addAudioTrack(audioSource);
  await output.start();

  // Feed audio in slices so the muxer can interleave it with the video packets.
  const sliceSamples = audio.sampleRate; // 1 s
  const total = mastered.channels[0].length;
  let audioPos = 0;
  const pushAudioUntil = async (seconds: number) => {
    const until = Math.min(total, Math.ceil(seconds * audio.sampleRate));
    while (audioPos < until) {
      const end = Math.min(total, audioPos + sliceSamples);
      await audioSource.add(toAudioBuffer(mastered.channels.map((ch) => ch.slice(audioPos, end)), audio.sampleRate));
      audioPos = end;
    }
  };

  const sink = new EncodedPacketSink(videoTrack);
  let first = true;
  for await (const packet of sink.packets()) {
    options.signal?.throwIfAborted();
    await videoSource.add(packet, first ? { decoderConfig: videoConfig } : undefined);
    first = false;
    await pushAudioUntil(packet.timestamp + 1);
  }
  await pushAudioUntil(Infinity);
  await output.finalize();

  const blob = new Blob([output.target.buffer!], { type: "video/mp4" });
  return {
    blob,
    report: {
      renderedLufs: Number.isFinite(mastered.before.integratedLufs) ? mastered.before.integratedLufs : null,
      renderedTruePeakDb: Number.isFinite(mastered.before.truePeakDb) ? mastered.before.truePeakDb : null,
      gainDb: mastered.gainDb,
      limiterMaxReductionDb: mastered.maxReductionDb,
      resultLufs: Number.isFinite(mastered.after.integratedLufs) ? mastered.after.integratedLufs : null,
      resultTruePeakDb: Number.isFinite(mastered.after.truePeakDb) ? mastered.after.truePeakDb : null,
      encoderDelaySamples: delay,
      encoderDelaySource: delaySource,
      encoder,
    },
  };
}
