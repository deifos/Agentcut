"use client";

// A live preview of one library component (studio Components panel and the public gallery).
import { useMemo } from "react";
import { Player, Thumbnail } from "@remotion/player";
import { AbsoluteFill } from "remotion";
import { MOTION_COMPONENTS, resolveComponentProps } from "@/motion/components";
import { cn } from "@/lib/utils";

interface PreviewInput {
  id: string;
  props: Record<string, unknown>;
  width: number;
  height: number;
  durationInFrames: number;
  [key: string]: unknown;
}

function Preview({ id, props, width, height, durationInFrames }: PreviewInput) {
  const entry = MOTION_COMPONENTS[id];
  if (!entry) return null;
  const Component = entry.Component;
  return (
    <AbsoluteFill
      style={{
        // Overlays sit on a soft stage so they read like they would over footage.
        background:
          entry.meta.layer === "overlay"
            ? "radial-gradient(120% 90% at 30% 20%, #2a3140 0%, #12151b 55%, #0b0d10 100%)"
            : "#0b0d10",
      }}
    >
      <Component
        {...resolveComponentProps(id, props)}
        width={width}
        height={height}
        fps={30}
        durationInFrames={durationInFrames}
        variant={height > width ? "mobile" : "wide"}
      />
    </AbsoluteFill>
  );
}

/** A still of one component (its stillAt frame): cheaper than a Player, for grids of many. */
export function ComponentThumb({
  id,
  props = {},
  className,
}: {
  id: string;
  props?: Record<string, unknown>;
  className?: string;
}) {
  const entry = MOTION_COMPONENTS[id];
  const durationInFrames = entry?.meta.durationInFrames ?? 90;
  const inputProps = useMemo<PreviewInput>(
    () => ({ id, props, width: 1920, height: 1080, durationInFrames }),
    [id, props, durationInFrames],
  );
  if (!entry) return null;
  return (
    <Thumbnail
      component={Preview}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      fps={30}
      compositionWidth={1920}
      compositionHeight={1080}
      frameToDisplay={Math.round(
        durationInFrames * (entry.meta.stillAt ?? 0.55),
      )}
      className={cn("overflow-hidden", className)}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}

export function ComponentPlayer({
  id,
  props = {},
  aspect = "wide",
  playing = true,
  controls = false,
  className,
}: {
  id: string;
  props?: Record<string, unknown>;
  aspect?: "wide" | "mobile";
  playing?: boolean;
  controls?: boolean;
  className?: string;
}) {
  const entry = MOTION_COMPONENTS[id];
  const width = aspect === "mobile" ? 1080 : 1920;
  const height = aspect === "mobile" ? 1920 : 1080;
  const durationInFrames = entry?.meta.durationInFrames ?? 90;
  // A little hold at the end before the loop restarts.
  const total = durationInFrames + 20;
  const inputProps = useMemo<PreviewInput>(
    () => ({ id, props, width, height, durationInFrames }),
    [id, props, width, height, durationInFrames],
  );
  if (!entry) return null;
  return (
    <Player
      // Remount on play/pause changes so a paused tile shows a good still frame.
      key={playing ? "play" : "still"}
      component={Preview}
      inputProps={inputProps}
      durationInFrames={total}
      fps={30}
      compositionWidth={width}
      compositionHeight={height}
      autoPlay={playing}
      loop
      controls={controls}
      // A still (or the first paint before playback) shows the component fully in.
      initialFrame={
        playing && !controls
          ? 0
          : Math.round(durationInFrames * (entry.meta.stillAt ?? 0.55))
      }
      clickToPlay={false}
      acknowledgeRemotionLicense
      className={cn("overflow-hidden", className)}
      style={{ width: "100%", aspectRatio: `${width} / ${height}` }}
    />
  );
}
