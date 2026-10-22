"use client";

// Film strips inside timeline clips: what each clip actually looks like.
// - Scene clips (scenes/*.tsx and library components): a few stills of that clip alone, drawn by
//   the project's own composition (Remotion <Thumbnail>, no capture needed).
// - Video clips: frames grabbed from the file (lib/studio/video-frames.ts).
// - Image clips: the image, tiled.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Thumbnail } from "@remotion/player";
import { buildInputProps, variantSize } from "@/lib/studio/composition-props";
import { studioFileUrl } from "@/lib/studio/bundle";
import { cachedVideoFrame, videoFrame } from "@/lib/studio/video-frames";
import type {
  ImageClip,
  LoadedModule,
  StudioClip,
  StudioLayers,
  StudioProject,
  StudioTrack,
  VideoClip,
} from "@/lib/studio/types";

export interface TimelineThumbSource {
  loaded: LoadedModule | null;
  project: StudioProject;
  variant: string;
  slug: string;
  /** Where project files are served from; defaults to the local helper (the website's demo overrides it). */
  assetBase?: string;
}

/** URL of a project file for the film strips and waveforms. */
export function thumbFileUrl(source: TimelineThumbSource | null, slug: string, path: string) {
  return source?.assetBase ? `${source.assetBase}/${path}` : studioFileUrl(slug, path);
}

/** What the film strips need from the studio: provided around <StudioTimeline>. */
export const TimelineThumbs = createContext<TimelineThumbSource | null>(null);

// Stills per clip: scene stills are live renders, so keep them few; video frames are cheap images.
const MAX_SCENE_TILES = 4;
const MAX_VIDEO_TILES = 14;
const MAX_IMAGE_TILES = 10;
// Video frames are cached per quarter second, so zooming reuses them.
const FRAME_STEP = 0.25;

function tiles(width: number, tileWidth: number, max: number) {
  return Math.max(1, Math.min(max, Math.round(width / Math.max(1, tileWidth))));
}

function SceneStrip({
  source,
  track,
  clip,
  width,
  height,
}: {
  source: TimelineThumbSource & { loaded: LoadedModule };
  track: StudioTrack;
  clip: StudioClip;
  width: number;
  height: number;
}) {
  const { loaded, project, variant, slug } = source;
  const size = variantSize(project, variant);
  const aspect = size.width / size.height;
  const count = tiles(width, height * aspect, MAX_SCENE_TILES);
  // Cover each tile: as wide as the tile and at least as tall as the clip.
  const thumbWidth = Math.max(width / count, height * aspect);
  const thumbHeight = thumbWidth / aspect;
  // Only this clip, starting at 0 (a key so dragging the clip doesn't redraw the stills).
  const clipKey = JSON.stringify({ ...clip, from: 0 });
  const inputProps = useMemo(() => {
    const solo = JSON.parse(clipKey) as StudioClip;
    const layers = {
      version: 1,
      markers: [],
      tracks: [{ ...track, hidden: false, clips: [solo] }],
    } as StudioLayers;
    const props = buildInputProps(
      slug,
      { ...project, durationInFrames: Math.max(1, clip.duration) },
      layers,
      variant,
    );
    return source.assetBase ? { ...props, assetBase: source.assetBase } : props;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clipKey stands for the clip
  }, [clipKey, track.id, track.kind, project, variant, slug, source.assetBase]);
  return (
    <div
      className="pointer-events-none absolute inset-0 flex"
      style={{ background: project.background }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="relative h-full flex-1 overflow-hidden border-r border-black/20 last:border-r-0"
        >
          <Thumbnail
            component={loaded.module.StudioComposition}
            inputProps={inputProps}
            durationInFrames={Math.max(1, clip.duration)}
            fps={project.fps}
            compositionWidth={size.width}
            compositionHeight={size.height}
            frameToDisplay={Math.min(
              clip.duration - 1,
              Math.round(((i + 0.5) / count) * clip.duration),
            )}
            errorFallback={() => null}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: thumbWidth,
              height: thumbHeight,
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function VideoStrip({
  slug,
  clip,
  fps,
  width,
  height,
}: {
  slug: string;
  clip: VideoClip;
  fps: number;
  width: number;
  height: number;
}) {
  const url = thumbFileUrl(useContext(TimelineThumbs), slug, clip.src);
  const count = tiles(width, height * (16 / 9), MAX_VIDEO_TILES);
  const rate = clip.playbackRate ?? 1;
  const times = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seconds =
          ((clip.trimStart ?? 0) + ((i + 0.5) / count) * clip.duration * rate) /
          fps;
        return Math.round(seconds / FRAME_STEP) * FRAME_STEP;
      }),
    [count, clip.trimStart, clip.duration, rate, fps],
  );
  const [frames, setFrames] = useState<Record<number, string>>({});
  // Grab the frames this strip shows; each lands as soon as it's decoded.
  useEffect(() => {
    let cancelled = false;
    for (const time of times) {
      if (cachedVideoFrame(url, time)) continue;
      void videoFrame(url, time).then((src) => {
        if (!cancelled && src)
          setFrames((current) => ({ ...current, [time]: src }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [url, times]);
  return (
    <div className="pointer-events-none absolute inset-0 flex bg-black/80">
      {times.map((time, i) => {
        const src = frames[time] ?? cachedVideoFrame(url, time);
        return (
          <div
            key={i}
            className="h-full flex-1 border-r border-black/30 bg-cover bg-center last:border-r-0"
            style={src ? { backgroundImage: `url("${src}")` } : undefined}
          />
        );
      })}
    </div>
  );
}

function ImageStrip({
  slug,
  clip,
  width,
  height,
}: {
  slug: string;
  clip: ImageClip;
  width: number;
  height: number;
}) {
  const url = thumbFileUrl(useContext(TimelineThumbs), slug, clip.src);
  const count = tiles(width, height * (16 / 9), MAX_IMAGE_TILES);
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-full flex-1 border-r border-black/20 bg-cover bg-center last:border-r-0"
          style={{ backgroundImage: `url("${url}")` }}
        />
      ))}
    </div>
  );
}

/** True for clips drawn with a film strip (the label then sits on a chip over the pictures). */
export function hasFilmstrip(track: StudioTrack, clip: StudioClip) {
  return (
    track.kind === "scene" ||
    (track.kind === "video" && "src" in clip) ||
    (track.kind === "image" && "src" in clip)
  );
}

export function ClipFilmstrip({
  track,
  clip,
  fps,
  width,
  height,
}: {
  track: StudioTrack;
  clip: StudioClip;
  fps: number;
  width: number;
  height: number;
}) {
  const source = useContext(TimelineThumbs);
  if (!source || width < 12) return null;
  if (track.kind === "scene") {
    if (!source.loaded) return null;
    return (
      <SceneStrip
        source={{ ...source, loaded: source.loaded }}
        track={track}
        clip={clip}
        width={width}
        height={height}
      />
    );
  }
  if (track.kind === "video" && "src" in clip) {
    return (
      <VideoStrip
        slug={source.slug}
        clip={clip as VideoClip}
        fps={fps}
        width={width}
        height={height}
      />
    );
  }
  if (track.kind === "image" && "src" in clip) {
    return (
      <ImageStrip
        slug={source.slug}
        clip={clip as ImageClip}
        width={width}
        height={height}
      />
    );
  }
  return null;
}
