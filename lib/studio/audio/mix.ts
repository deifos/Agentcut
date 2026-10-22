import { studioFileUrl } from "@/lib/studio/bundle";
import { decodeAudioUrl } from "@/lib/studio/audio/decode";
import type { AudioClip, StudioClip, StudioDoc, VideoClip } from "@/lib/studio/types";

const SAMPLE_RATE = 48_000;

function resolveForVariant<T extends StudioClip>(clip: T, variant: string): T {
  const override = (clip as { variants?: Record<string, Partial<T>> }).variants?.[variant];
  return override ? ({ ...clip, ...override } as T) : clip;
}

export interface MixOptions {
  /** Only these clip ids (default: all audible clips). */
  clipIds?: Set<string>;
  masterGain?: number;
}

/**
 * Offline mix of every audio clip and video soundtrack in the project, the way
 * the composition plays them (trim, volume, fades, loop, track gain/mute).
 * Returns null when the project is silent.
 */
export async function mixProjectAudio(doc: StudioDoc, variant: string, options: MixOptions = {}): Promise<AudioBuffer | null> {
  const { project, layers } = doc;
  if (!project || !layers) return null;
  const fps = project.fps;
  const duration = project.durationInFrames / fps;
  type Item = { clip: AudioClip | VideoClip; gain: number };
  const items: Item[] = [];
  for (const track of layers.tracks) {
    if (track.kind !== "audio" && track.kind !== "video") continue;
    if (track.muted) continue;
    for (const raw of track.clips as (AudioClip | VideoClip)[]) {
      const clip = resolveForVariant(raw, variant);
      if (options.clipIds && !options.clipIds.has(clip.id)) continue;
      if (track.kind === "video" && (clip as VideoClip).muted) continue;
      items.push({ clip, gain: (track.volume ?? 1) * (options.masterGain ?? 1) });
    }
  }
  if (items.length === 0) return null;
  const context = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * SAMPLE_RATE)), SAMPLE_RATE);
  await Promise.all(
    items.map(async ({ clip, gain }) => {
      const buffer = await decodeAudioUrl(studioFileUrl(doc.slug, clip.src));
      const start = clip.from / fps;
      const end = Math.min(duration, (clip.from + clip.duration) / fps);
      if (end <= start) return;
      const volume = (clip.volume ?? 1) * gain;
      const audio = clip as AudioClip;
      const fadeIn = Math.min((audio.fadeIn ?? 0) / fps, (end - start) / 2);
      const fadeOut = Math.min((audio.fadeOut ?? 0) / fps, (end - start) / 2);
      const node = context.createGain();
      node.gain.setValueAtTime(fadeIn > 0 ? 0 : volume, start);
      if (fadeIn > 0) node.gain.linearRampToValueAtTime(volume, start + fadeIn);
      if (fadeOut > 0) {
        node.gain.setValueAtTime(volume, end - fadeOut);
        node.gain.linearRampToValueAtTime(0, end);
      }
      node.connect(context.destination);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = clip.playbackRate ?? 1;
      if (audio.loop) {
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
      }
      source.connect(node);
      const offset = (clip.trimStart ?? 0) / fps;
      if (!audio.loop && offset >= buffer.duration) return;
      source.start(start, audio.loop ? offset % buffer.duration : offset);
      source.stop(end);
    }),
  );
  return context.startRendering();
}
