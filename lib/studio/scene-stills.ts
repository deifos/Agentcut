import { blobToDataUrl, variantSize } from "@/lib/studio/composition-props";
import type { LoadedModule, StudioCompositionProps } from "@/lib/studio/types";

// Serialize captures: a timeline must not mount dozens of filtered scenes at once.
let tail: Promise<unknown> = Promise.resolve();
const caches = new WeakMap<LoadedModule, Map<string, string>>();
const MAX_STILLS = 128;

export function sceneStill(
  loaded: LoadedModule,
  props: StudioCompositionProps,
  frame: number,
  signal: AbortSignal,
): Promise<string | null> {
  let cache = caches.get(loaded);
  if (!cache) {
    cache = new Map();
    caches.set(loaded, cache);
  }
  const key = JSON.stringify([props, frame]);
  const stills = cache;
  if (signal.aborted) return Promise.resolve(null);
  const cached = stills.get(key);
  if (cached) return Promise.resolve(cached);
  const task = tail
    .then(async () => {
      if (signal.aborted) return null;
      const hit = stills.get(key);
      if (hit) return hit;
      const { renderStillOnWeb } = await import("@remotion/web-renderer");
      if (signal.aborted) return null;
      const size = variantSize(props.project, props.variant);
      const result = await renderStillOnWeb({
        composition: {
          component: loaded.module.StudioComposition,
          id: "timeline-still",
          ...size,
          fps: props.project.fps,
          durationInFrames: props.project.durationInFrames,
          defaultProps: props,
        },
        inputProps: props,
        frame,
        signal,
        scale: Math.min(1, 90 / size.height),
        licenseKey: "free-license",
        delayRenderTimeoutInMilliseconds: 10_000,
      });
      const src = await blobToDataUrl(
        await result.blob({ format: "jpeg", quality: 0.75 }),
      );
      // Data URLs need no explicit revocation and remain valid in mounted tiles after eviction.
      if (stills.size >= MAX_STILLS) stills.delete(stills.keys().next().value!);
      stills.set(key, src);
      return signal.aborted ? null : src;
    })
    .catch(() => null);
  tail = task;
  return task;
}
