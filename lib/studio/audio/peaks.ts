import { decodeAudioUrl, forgetDecodedAudio } from "@/lib/studio/audio/decode";

const cache = new Map<string, Promise<{ peaks: Float32Array; seconds: number }>>();
const PEAKS_PER_SECOND = 100;

/** Max-abs peaks at 100/s for drawing waveforms (cached per URL). */
export function audioPeaks(url: string) {
  const existing = cache.get(url);
  if (existing) return existing;
  const promise = decodeAudioUrl(url).then((buffer) => {
    const count = Math.max(1, Math.ceil(buffer.duration * PEAKS_PER_SECOND));
    const peaks = new Float32Array(count);
    const per = buffer.length / count;
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < count; i += 1) {
        const start = Math.floor(i * per);
        const end = Math.min(data.length, Math.floor((i + 1) * per));
        let max = peaks[i];
        for (let j = start; j < end; j += 1) {
          const v = Math.abs(data[j]);
          if (v > max) max = v;
        }
        peaks[i] = max;
      }
    }
    // Waveforms only need peaks. Do not retain the full decoded recording as well.
    // Other consumers already holding this buffer can still finish their work.
    forgetDecodedAudio(url);
    return { peaks, seconds: buffer.duration };
  });
  cache.set(url, promise);
  promise.catch(() => cache.delete(url));
  return promise;
}

export const PEAKS_RATE = PEAKS_PER_SECOND;
