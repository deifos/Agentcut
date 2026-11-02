"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { buildInputProps } from "@/lib/studio/composition-props";
import type { FrameStore } from "@/lib/studio/frame-store";
import {
  ScrubRecorder,
  slowScrubClips,
  usePreviewPerf,
  type PreviewPerfStore,
} from "@/lib/studio/preview-perf";
import { Scrubber } from "@/lib/studio/scrub";
import { ScrubFrameCache } from "@/lib/studio/scrub-cache";
import type { LoadedModule, StudioDoc } from "@/lib/studio/types";

/** The preview sits still this long before pictures start being rendered. */
const IDLE_MS = 1200;

/** Drags on the timeline and the playback slider, their timings, and pictures for scenes too slow to draw. */
export function useScrubber({
  playerRef,
  frameStore,
  previewPerf,
  doc,
  loaded,
  variant,
  playing,
  busy,
}: {
  playerRef: RefObject<PlayerRef | null>;
  frameStore: FrameStore;
  previewPerf: PreviewPerfStore;
  doc: StudioDoc | null;
  loaded: LoadedModule | null;
  variant: string;
  playing: boolean;
  /** An export or an agent turn is using the page: no background rendering. */
  busy: boolean;
}) {
  const slug = doc?.slug ?? null;
  const layers = doc?.layers ?? null;
  const project = doc?.project ?? null;
  const revision = loaded?.slug === slug ? (loaded?.revision ?? 0) : 0;

  const recorder = useMemo(
    () => (slug && layers ? new ScrubRecorder({ slug, variant, revision, layers, source: "drag" }) : null),
    [slug, variant, revision, layers],
  );
  const [pictures] = useState(() => new ScrubFrameCache());
  // The drag callbacks outlive renders: they read the current recorder from here.
  const [scrubTarget] = useState(() => {
    let current: ScrubRecorder | null = null;
    return {
      get: () => current,
      set: (next: ScrubRecorder | null) => {
        current = next;
      },
    };
  });
  const [scrubber] = useState(() => new Scrubber({
    getPlayer: () => playerRef.current,
    frameStore,
    frames: pictures,
    onFrameDrawn: (frame, ms) => scrubTarget.get()?.seek(frame, ms),
    onFrameShown: () => scrubTarget.get()?.pictureShown(),
    onSettled: () => {
      const recorder = scrubTarget.get();
      if (recorder?.seeks) previewPerf.setScrub(recorder.stats());
    },
  }));
  useEffect(() => {
    scrubTarget.set(recorder);
  }, [recorder, scrubTarget]);
  useEffect(() => () => scrubber.cancel(), [scrubber, slug, loaded, variant]);

  const props = useMemo(
    () => (slug && project && layers ? buildInputProps(slug, project, layers, variant) : null),
    [slug, project, layers, variant],
  );
  // Pictures show one exact version of the video.
  useEffect(() => {
    pictures.clear();
  }, [pictures, props, loaded]);

  const measuredAt = usePreviewPerf(previewPerf, (state) => state.scrub?.at ?? 0);
  useEffect(() => {
    if (playing || busy || !props || !loaded || loaded.slug !== slug) return;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      controller?.abort();
      controller = null;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState !== "visible" || frameStore.scrubbing || previewPerf.get().checking) return;
        const frame = frameStore.get();
        const stats = previewPerf.get().scrub;
        if (!stats || stats.slug !== slug || stats.revision !== revision || stats.variant !== variant) return;
        const clip = slowScrubClips(stats, frame)[0];
        if (!clip) return;
        const running = new AbortController();
        controller = running;
        void pictures.warm(
          loaded,
          props,
          { around: frame, from: clip.from, to: clip.to },
          running.signal,
          () => frameStore.scrubbing || previewPerf.get().checking || document.visibilityState !== "visible",
        );
      }, IDLE_MS);
    };
    schedule();
    const unsubscribe = frameStore.subscribe(schedule);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      controller?.abort();
    };
  }, [playing, busy, props, loaded, slug, revision, variant, measuredAt, frameStore, pictures, previewPerf]);

  return { scrubber, pictures };
}
