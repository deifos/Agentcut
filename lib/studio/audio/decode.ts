/** Decoded PCM is ~23 MB per stereo minute; keep at most this much cached. */
const CACHE_BUDGET_BYTES = 512 * 1024 * 1024;

// Insertion order doubles as LRU order: a hit is re-inserted at the end.
const cache = new Map<string, Promise<AudioBuffer>>();
const sizes = new Map<string, number>();
let sharedContext: AudioContext | null = null;

function decodeContext() {
  if (!sharedContext) sharedContext = new AudioContext({ sampleRate: 48_000 });
  return sharedContext;
}

function evict(keep: string) {
  let total = 0;
  for (const size of sizes.values()) total += size;
  for (const url of [...sizes.keys()]) {
    if (total <= CACHE_BUDGET_BYTES) break;
    if (url === keep) continue;
    total -= sizes.get(url) ?? 0;
    sizes.delete(url);
    cache.delete(url);
  }
}

/** Fetch + decode an audio (or video) file once per URL (least recently used dropped past the budget). */
export function decodeAudioUrl(url: string): Promise<AudioBuffer> {
  const existing = cache.get(url);
  if (existing) {
    cache.delete(url);
    cache.set(url, existing);
    const size = sizes.get(url);
    if (size !== undefined) {
      sizes.delete(url);
      sizes.set(url, size);
    }
    return existing;
  }
  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Couldn't load ${url} (${response.status}).`);
    const data = await response.arrayBuffer();
    return decodeContext().decodeAudioData(data);
  })();
  cache.set(url, promise);
  promise.then(
    (buffer) => {
      if (cache.get(url) !== promise) return;
      sizes.set(url, buffer.length * buffer.numberOfChannels * 4);
      evict(url);
    },
    () => {
      if (cache.get(url) === promise) cache.delete(url);
    },
  );
  return promise;
}

export function forgetDecodedAudio(url?: string) {
  if (url) {
    cache.delete(url);
    sizes.delete(url);
  } else {
    cache.clear();
    sizes.clear();
  }
}

/** Downmix to mono Float32Array. */
export function toMono(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}

/** Resample mono audio with an OfflineAudioContext. */
export async function resampleMono(buffer: AudioBuffer, sampleRate: number): Promise<Float32Array> {
  if (buffer.sampleRate === sampleRate && buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();
  const length = Math.ceil(buffer.duration * sampleRate);
  const context = new OfflineAudioContext(1, Math.max(1, length), sampleRate);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  const rendered = await context.startRendering();
  return rendered.getChannelData(0);
}
