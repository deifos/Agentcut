"use client";

import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Captions,
  Clapperboard,
  Copy,
  Eye,
  EyeOff,
  Film,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Magnet,
  MoreHorizontal,
  Plus,
  Scissors,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayheadAsk } from "@/components/studio/PlayheadAsk";
import { MOTION_COMPONENTS } from "@/motion/components";
import { LabeledSlider } from "@/components/ui/labeled-slider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { audioPeaks, PEAKS_RATE } from "@/lib/studio/audio/peaks";
import {
  addTrack,
  clipEnd,
  deleteTrack,
  moveClip,
  moveTrack,
  snapFrame,
  snapPoints,
  trimClip,
  isRippleTrack,
  rippleTrimEnd,
  updateTrack,
} from "@/lib/studio/edit";
import type { FrameStore } from "@/lib/studio/frame-store";
import { useFrame } from "@/lib/studio/frame-store";
import { formatFrameTime } from "@/lib/studio/format";
import { useAgentName } from "@/components/studio/StudioAgent";
import {
  ClipFilmstrip,
  hasFilmstrip,
  thumbFileUrl,
  TimelineThumbs,
} from "@/components/studio/timeline-thumbs";
import type {
  AudioClip,
  StudioClip,
  StudioLayers,
  StudioTrack,
  TrackKind,
  VideoClip,
} from "@/lib/studio/types";

const HEADER_WIDTH = 176;
const RULER_HEIGHT = 28;
const ROW_HEIGHT: Record<TrackKind, number> = {
  scene: 52,
  video: 52,
  image: 46,
  text: 40,
  captions: 40,
  audio: 46,
};
const EDGE_PX = 7;
const SNAP_PX = 8;

export const TRACK_KIND_STYLE: Record<
  TrackKind,
  { icon: typeof Film; clip: string; label: string }
> = {
  scene: {
    icon: Clapperboard,
    clip: "bg-violet-100 border-violet-200 text-violet-950 dark:bg-violet-400/20 dark:border-violet-300/20 dark:text-violet-100",
    label: "Scene",
  },
  video: {
    icon: Film,
    clip: "bg-sky-100 border-sky-200 text-sky-950 dark:bg-sky-400/20 dark:border-sky-300/20 dark:text-sky-100",
    label: "Video",
  },
  image: {
    icon: ImageIcon,
    clip: "bg-teal-100 border-teal-200 text-teal-950 dark:bg-teal-400/20 dark:border-teal-300/20 dark:text-teal-100",
    label: "Image",
  },
  text: {
    icon: Type,
    clip: "bg-amber-100 border-amber-200 text-amber-950 dark:bg-amber-400/20 dark:border-amber-300/20 dark:text-amber-100",
    label: "Text",
  },
  captions: {
    icon: Captions,
    clip: "bg-yellow-100 border-yellow-200 text-yellow-950 dark:bg-yellow-300/20 dark:border-yellow-200/20 dark:text-yellow-100",
    label: "Captions",
  },
  audio: {
    icon: AudioLines,
    clip: "bg-emerald-100 border-emerald-200 text-emerald-950 dark:bg-emerald-400/20 dark:border-emerald-300/20 dark:text-emerald-100",
    label: "Audio",
  },
};

function clipLabel(track: StudioTrack, clip: StudioClip) {
  if (clip.name) return clip.name;
  if (track.kind === "scene" && "component" in clip && clip.component)
    return MOTION_COMPONENTS[clip.component]?.meta.name ?? clip.component;
  if (track.kind === "scene" && "scene" in clip && clip.scene)
    return clip.scene;
  if (track.kind === "text" && "text" in clip) return clip.text;
  if ("src" in clip) return clip.src.slice(clip.src.lastIndexOf("/") + 1);
  return clip.id;
}

type DragState =
  | {
      type: "move";
      pointerId: number;
      clipId: string;
      trackId: string;
      kind: TrackKind;
      startX: number;
      originFrom: number;
      base: StudioLayers;
      points: number[];
      duration: number;
      moved: boolean;
      latest: StudioLayers | null;
    }
  | {
      type: "trim";
      pointerId: number;
      clipId: string;
      edge: "start" | "end";
      kind: TrackKind;
      startX: number;
      originFrame: number;
      base: StudioLayers;
      points: number[];
      moved: boolean;
      latest: StudioLayers | null;
      /** Length change of the video from a ripple trim (0 otherwise). */
      delta: number;
    }
  | { type: "scrub"; pointerId: number };

export interface StudioTimelineProps {
  layers: StudioLayers;
  slug: string;
  fps: number;
  durationInFrames: number;
  frameStore: FrameStore;
  selection: string[];
  onSelect(ids: string[]): void;
  onSeek(frame: number): void;
  onPreview(layers: StudioLayers): void;
  /** `durationInFrames` when the edit also changes the video's length (a ripple trim). */
  onCommit(
    layers: StudioLayers,
    base?: StudioLayers,
    durationInFrames?: number,
  ): void;
  onSplit(): void;
  onDelete(): void;
  onDuplicate(): void;
  flashClipIds?: ReadonlySet<string>;
  readOnly?: boolean;
  /** "Ask here" bubble on the playhead: sends a chat message pinned to that frame. */
  onAskAt?(frame: number, text: string): Promise<void>;
  askBusy?: boolean;
  askDisabled?: boolean;
  /** Requests the agent is still working on, pinned on the ruler. */
  pendingAsks?: { frame: number; text: string }[];
}

function Waveform({
  slug,
  clip,
  fps,
  width,
  height,
}: {
  slug: string;
  clip: AudioClip | VideoClip;
  fps: number;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<{
    peaks: Float32Array;
    seconds: number;
  } | null>(null);
  const url = thumbFileUrl(useContext(TimelineThumbs), slug, clip.src);
  useEffect(() => {
    let cancelled = false;
    audioPeaks(url)
      .then((value) => {
        if (!cancelled) setPeaks(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(8000, Math.max(1, Math.round(width)));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, height);
    // Same color as the clip label, faded.
    ctx.fillStyle = getComputedStyle(canvas).color;
    ctx.globalAlpha = 0.55;
    const trim = (clip.trimStart ?? 0) / fps;
    const rate = clip.playbackRate ?? 1;
    const durationS = clip.duration / fps;
    const loop = "loop" in clip && clip.loop;
    const mid = height / 2;
    let fileMax = 0;
    for (const value of peaks.peaks) fileMax = Math.max(fileMax, value);
    const norm = fileMax > 0 ? 1 / fileMax : 1;
    // Rounded bars with gaps, mirrored around the middle: each bar is the loudest peak in its
    // slice of time, so it reads like the audio's shape instead of a solid block.
    const BAR = 2;
    const STEP = 4;
    const peakAt = (seconds: number) => {
      let t = seconds;
      if (loop && peaks.seconds > 0) t %= peaks.seconds;
      const index = Math.floor(t * PEAKS_RATE);
      return index >= 0 && index < peaks.peaks.length ? peaks.peaks[index] : 0;
    };
    const maxBar = height - 10;
    for (let x = 0; x + BAR <= w; x += STEP) {
      const start = trim + (x / w) * durationS * rate;
      const end = trim + ((x + STEP) / w) * durationS * rate;
      let value = 0;
      for (let s = start; s < end; s += 1 / PEAKS_RATE) value = Math.max(value, peakAt(s));
      const h = Math.max(2, Math.min(1, value * norm) * maxBar);
      ctx.beginPath();
      ctx.roundRect(x, mid - h / 2, BAR, h, BAR / 2);
      ctx.fill();
    }
  }, [peaks, width, height, clip, fps]);
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ width, height }}
    />
  );
}

interface ClipViewProps {
  slug: string;
  track: StudioTrack;
  clip: StudioClip;
  fps: number;
  ppf: number;
  height: number;
  selected: boolean;
  flash: boolean;
  locked: boolean;
  onPointerDown(
    event: ReactPointerEvent,
    clip: StudioClip,
    track: StudioTrack,
    zone: "start" | "end" | "body",
  ): void;
}

const ClipView = memo(function ClipView({
  slug,
  track,
  clip,
  fps,
  ppf,
  height,
  selected,
  flash,
  locked,
  onPointerDown,
}: ClipViewProps) {
  const left = clip.from * ppf;
  const width = Math.max(2, clip.duration * ppf);
  const style = TRACK_KIND_STYLE[track.kind];
  const filmstrip = hasFilmstrip(track, clip);
  const isAudio = track.kind === "audio";
  const Icon = style.icon;
  return (
    <div
      data-clip-id={clip.id}
      className={cn(
        "group absolute top-1 overflow-hidden rounded-lg border text-[11px] font-semibold",
        style.clip,
        selected &&
          "ring-2 ring-foreground ring-offset-1 ring-offset-background",
        flash && "animate-pulse",
        track.hidden && "opacity-40",
        locked ? "cursor-default" : "cursor-grab active:cursor-grabbing",
      )}
      style={{ left, width, height: height - 8 }}
      title={`${clipLabel(track, clip)} · ${formatFrameTime(clip.from, fps)} → ${formatFrameTime(clipEnd(clip), fps)} (${clip.duration}f)${clip.note ? `\n${clip.note}` : ""}`}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const zone =
          width > EDGE_PX * 3 && x < EDGE_PX
            ? "start"
            : width > EDGE_PX * 3 && x > rect.width - EDGE_PX
              ? "end"
              : "body";
        onPointerDown(event, clip, track, zone);
      }}
    >
      {filmstrip ? (
        <ClipFilmstrip
          track={track}
          clip={clip}
          fps={fps}
          width={width}
          height={height - 8}
        />
      ) : null}
      {isAudio && "src" in clip && width > 6 ? (
        <Waveform
          slug={slug}
          clip={clip as AudioClip}
          fps={fps}
          width={width}
          height={height - 8}
        />
      ) : null}
      {width > 24 ? (
        filmstrip ? (
          // Over pictures, the name sits on a dark chip so it stays readable.
          <span className="pointer-events-none absolute left-1 top-1 flex max-w-[calc(100%-8px)] items-center gap-1 truncate rounded bg-black/60 px-1.5 text-[10px] leading-4 text-white backdrop-blur-sm">
            {clipLabel(track, clip)}
          </span>
        ) : (
          <span
            className={cn(
              "pointer-events-none relative flex items-center gap-1 truncate leading-4",
              isAudio
                ? "ml-1 mt-1 w-fit max-w-[calc(100%-8px)] rounded bg-background/80 px-1.5 text-[10px]"
                : "px-2 pt-0.5",
            )}
          >
            <Icon className="size-3 shrink-0 opacity-70" />
            <span className="truncate">{clipLabel(track, clip)}</span>
          </span>
        )
      ) : null}
      {!locked ? (
        <>
          <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-current/0 group-hover:bg-current/20" />
          <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-current/0 group-hover:bg-current/20" />
        </>
      ) : null}
    </div>
  );
});

type PlayheadAskProps = {
  onAsk(frame: number, text: string): Promise<void>;
  busy: boolean;
  disabled: boolean;
};

/** The line through the tracks. Sits under the sticky ruler, so the head (in the ruler) stays on top. */
function PlayheadLine({
  frameStore,
  ppf,
  height,
}: {
  frameStore: FrameStore;
  ppf: number;
  height: number;
}) {
  const frame = useFrame(frameStore);
  return (
    <div
      className="pointer-events-none absolute top-0 z-[15]"
      style={{ left: frame * ppf, height }}
    >
      <div className="absolute -left-px top-[20px] bottom-0 w-[2px] bg-brand" />
    </div>
  );
}

/**
 * The drop-shaped head and the "ask here" bubble. Rendered inside the sticky ruler so they stay
 * visible when the tracks scroll vertically.
 */
function PlayheadHead({
  frameStore,
  ppf,
  fps,
  onGrab,
  ask,
}: {
  frameStore: FrameStore;
  ppf: number;
  fps: number;
  onGrab(event: ReactPointerEvent): void;
  ask?: PlayheadAskProps;
}) {
  const frame = useFrame(frameStore);
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-30"
      style={{ left: frame * ppf }}
    >
      <div className="absolute -left-px top-[20px] bottom-0 w-[2px] bg-brand" />
      {/* Drag the head to scrub. */}
      <div
        className="pointer-events-auto absolute -left-[9px] -top-px h-[22px] w-[18px] cursor-grab active:cursor-grabbing"
        onPointerDown={(event) => {
          event.stopPropagation();
          onGrab(event);
        }}
        title="Drag to scrub"
      >
        <svg
          viewBox="0 0 18 22"
          className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
          aria-hidden
        >
          <path
            d="M9 21.5 C 9 21.5 1 13.2 1 8.4 A 8 7.6 0 0 1 17 8.4 C 17 13.2 9 21.5 9 21.5 Z"
            className="fill-brand stroke-background"
            strokeWidth="1.25"
          />
          <circle cx="9" cy="8.2" r="2.4" className="fill-background" />
        </svg>
      </div>
      {ask ? (
        <div className="pointer-events-auto absolute -top-px left-[11px]">
          <PlayheadAsk
            frameStore={frameStore}
            fps={fps}
            busy={ask.busy}
            disabled={ask.disabled}
            onAsk={ask.onAsk}
          />
        </div>
      ) : null}
    </div>
  );
}

function TimeReadout({
  frameStore,
  fps,
  durationInFrames,
}: {
  frameStore: FrameStore;
  fps: number;
  durationInFrames: number;
}) {
  const frame = useFrame(frameStore);
  return (
    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
      <span className="text-foreground">{formatFrameTime(frame, fps)}</span> /{" "}
      {formatFrameTime(durationInFrames, fps)}
      <span className="ml-2 opacity-70">f{frame}</span>
    </span>
  );
}

function rulerStep(ppf: number, fps: number) {
  // Choose a tick spacing (in frames) that leaves ~80px between labels.
  const candidates = [1, 2, 5, 10, 15, 30, 60, 150, 300, 600, 1800, 3600].map(
    (n) => (n >= fps ? Math.round(n / 30) * fps : n),
  );
  for (const step of candidates) if (step * ppf >= 80) return step;
  return candidates[candidates.length - 1];
}

export function StudioTimeline(props: StudioTimelineProps) {
  const agentName = useAgentName();
  const {
    layers,
    slug,
    fps,
    durationInFrames,
    frameStore,
    selection,
    onSelect,
    onSeek,
    onPreview,
    onCommit,
    readOnly,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [snapping, setSnapping] = useState(true);
  const dragRef = useRef<DragState | null>(null);
  const layersRef = useRef(layers);
  useLayoutEffect(() => {
    layersRef.current = layers;
  });

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setViewportWidth(element.clientWidth),
    );
    observer.observe(element);
    setViewportWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const contentFrames = Math.max(
    durationInFrames,
    ...layers.tracks.flatMap((t) => (t.clips as StudioClip[]).map(clipEnd)),
    1,
  );
  const fitPpf = Math.max(
    0.05,
    (viewportWidth - HEADER_WIDTH - 24) / contentFrames,
  );
  const ppf = fitPpf * zoom;
  // At "Fit" the content fills the view exactly (no horizontal scrollbar); zooming in scrolls.
  const width = contentFrames * ppf + 24;
  const selected = useMemo(() => new Set(selection), [selection]);
  const step = rulerStep(ppf, fps);

  const rows = useMemo(
    () =>
      layers.tracks.reduce<
        { track: StudioTrack; top: number; height: number }[]
      >((list, track) => {
        const previous = list[list.length - 1];
        const top = previous ? previous.top + previous.height : RULER_HEIGHT;
        return [...list, { track, top, height: ROW_HEIGHT[track.kind] }];
      }, []),
    [layers.tracks],
  );
  const totalHeight =
    (rows.at(-1)?.top ?? RULER_HEIGHT) + (rows.at(-1)?.height ?? 0) + 8;

  // Keep the playhead in view while playing. Reads cached sizes only: touching
  // scrollLeft/clientWidth on every frame forces a layout and stalls playback.
  const scrollLeftRef = useRef(0);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      scrollLeftRef.current = element.scrollLeft;
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (zoom <= 1) return; // everything fits: nothing to follow
    return frameStore.subscribe(() => {
      const element = scrollRef.current;
      if (!element || dragRef.current) return;
      const x = HEADER_WIDTH + frameStore.get() * ppf;
      const visibleLeft = scrollLeftRef.current + HEADER_WIDTH;
      const visibleRight = scrollLeftRef.current + viewportWidth - 40;
      if (x > visibleRight || x < visibleLeft) {
        const next = Math.max(0, x - HEADER_WIDTH - 80);
        scrollLeftRef.current = next;
        element.scrollLeft = next;
      }
    });
  }, [frameStore, ppf, viewportWidth, zoom]);

  const frameAtClientX = useCallback(
    (clientX: number) => {
      const element = scrollRef.current;
      if (!element) return 0;
      const rect = element.getBoundingClientRect();
      const x = clientX - rect.left + element.scrollLeft - HEADER_WIDTH;
      return Math.max(0, Math.min(durationInFrames - 1, Math.round(x / ppf)));
    },
    [ppf, durationInFrames],
  );

  const trackAtClientY = useCallback(
    (clientY: number) => {
      const element = scrollRef.current;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const y = clientY - rect.top + element.scrollTop;
      return (
        rows.find((row) => y >= row.top && y < row.top + row.height)?.track ??
        null
      );
    },
    [rows],
  );

  const onClipPointerDown = useCallback(
    (
      event: ReactPointerEvent,
      clip: StudioClip,
      track: StudioTrack,
      zone: "start" | "end" | "body",
    ) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      if (additive) {
        onSelect(
          selected.has(clip.id)
            ? selection.filter((id) => id !== clip.id)
            : [...selection, clip.id],
        );
        return;
      }
      if (!selected.has(clip.id) || selection.length > 1) onSelect([clip.id]);
      if (readOnly || track.locked) return;
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      const base = layersRef.current;
      const points = snapPoints(base, new Set([clip.id]), frameStore.get());
      if (zone === "body") {
        dragRef.current = {
          type: "move",
          pointerId: event.pointerId,
          clipId: clip.id,
          trackId: track.id,
          kind: track.kind,
          startX: event.clientX,
          originFrom: clip.from,
          base,
          points,
          duration: clip.duration,
          moved: false,
          latest: null,
        };
      } else {
        dragRef.current = {
          type: "trim",
          pointerId: event.pointerId,
          clipId: clip.id,
          edge: zone,
          kind: track.kind,
          delta: 0,
          startX: event.clientX,
          originFrame: zone === "start" ? clip.from : clipEnd(clip),
          base,
          points,
          moved: false,
          latest: null,
        };
      }
    },
    [frameStore, onSelect, readOnly, selected, selection],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.type === "scrub") {
        onSeek(frameAtClientX(event.clientX));
        return;
      }
      const dx = event.clientX - drag.startX;
      if (
        !drag.moved &&
        Math.abs(dx) < 3 &&
        drag.type === "move" &&
        trackAtClientY(event.clientY)?.id === drag.trackId
      )
        return;
      drag.moved = true;
      const threshold = snapping && !event.altKey ? SNAP_PX / ppf : 0;
      if (drag.type === "move") {
        let from = Math.max(0, Math.round(drag.originFrom + dx / ppf));
        if (threshold > 0) {
          const snappedStart = snapFrame(from, drag.points, threshold);
          const snappedEnd =
            snapFrame(from + drag.duration, drag.points, threshold) -
            drag.duration;
          from =
            Math.abs(snappedStart - from) <= Math.abs(snappedEnd - from)
              ? snappedStart
              : snappedEnd;
        }
        const target = trackAtClientY(event.clientY);
        const targetId =
          target && target.kind === drag.kind && !target.locked
            ? target.id
            : drag.trackId;
        drag.latest = moveClip(drag.base, drag.clipId, from, targetId);
        onPreview(drag.latest);
      } else {
        let frame = Math.round(drag.originFrame + dx / ppf);
        if (threshold > 0) frame = snapFrame(frame, drag.points, threshold);
        // Scenes are magnetic: lengthening one pushes everything after it (Alt: free trim).
        if (drag.edge === "end" && isRippleTrack(drag.kind) && !event.altKey) {
          const result = rippleTrimEnd(
            drag.base,
            drag.clipId,
            frame,
            durationInFrames,
          );
          drag.latest = result.layers;
          drag.delta = result.delta;
        } else {
          drag.latest = trimClip(drag.base, drag.clipId, drag.edge, frame);
          drag.delta = 0;
        }
        onPreview(drag.latest);
      }
    },
    [
      durationInFrames,
      frameAtClientX,
      onPreview,
      onSeek,
      ppf,
      snapping,
      trackAtClientY,
    ],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (drag.type === "scrub") return;
      if (drag.moved && drag.latest && drag.latest !== drag.base)
        onCommit(
          drag.latest,
          drag.base,
          drag.type === "trim" && drag.delta !== 0
            ? Math.max(1, durationInFrames + drag.delta)
            : undefined,
        );
      else if (drag.moved) onPreview(drag.base);
    },
    [durationInFrames, onCommit, onPreview],
  );

  const startScrub = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    dragRef.current = { type: "scrub", pointerId: event.pointerId };
    onSeek(frameAtClientX(event.clientX));
  };

  const onWheel = (event: ReactWheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((value) =>
      Math.max(1, Math.min(80, value * (event.deltaY < 0 ? 1.15 : 1 / 1.15))),
    );
  };

  const editTrack = (
    trackId: string,
    patch: Partial<Omit<StudioTrack, "clips" | "kind">>,
  ) => {
    onCommit(updateTrack(layersRef.current, trackId, patch));
  };

  const ticks = [];
  for (let f = 0; f <= contentFrames; f += step) ticks.push(f);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <TimelineButton
          label="Split at playhead (S)"
          onClick={props.onSplit}
          disabled={readOnly || selection.length === 0}
        >
          <Scissors className="size-3.5" />
        </TimelineButton>
        <TimelineButton
          label="Duplicate (Ctrl+D)"
          onClick={props.onDuplicate}
          disabled={readOnly || selection.length !== 1}
        >
          <Copy className="size-3.5" />
        </TimelineButton>
        <TimelineButton
          label="Delete (Del)"
          onClick={props.onDelete}
          disabled={readOnly || selection.length === 0}
        >
          <Trash2 className="size-3.5" />
        </TimelineButton>
        <span className="mx-1 h-4 w-px bg-border/60" />
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={readOnly}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Plus className="size-3.5" /> Track
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(Object.keys(TRACK_KIND_STYLE) as TrackKind[]).map((kind) => {
              const Icon = TRACK_KIND_STYLE[kind].icon;
              return (
                <DropdownMenuItem
                  key={kind}
                  onSelect={() =>
                    onCommit(addTrack(layersRef.current, kind).layers)
                  }
                >
                  <Icon className="size-4" /> {TRACK_KIND_STYLE[kind].label}{" "}
                  track
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <TimelineButton
          label={snapping ? "Snapping on (hold Alt to bypass)" : "Snapping off"}
          onClick={() => setSnapping((v) => !v)}
          active={snapping}
        >
          <Magnet className="size-3.5" />
        </TimelineButton>
        <div className="ml-auto flex items-center gap-2">
          <TimeReadout
            frameStore={frameStore}
            fps={fps}
            durationInFrames={durationInFrames}
          />
          <TimelineButton
            label="Zoom out"
            onClick={() => setZoom((v) => Math.max(1, v / 1.5))}
          >
            <ZoomOut className="size-3.5" />
          </TimelineButton>
          <LabeledSlider
            label="Timeline zoom"
            showLabel={false}
            showValue={false}
            className="w-24"
            min={0}
            max={100}
            step={1}
            value={Math.round((Math.log(zoom) / Math.log(80)) * 100)}
            onChange={(value) => setZoom(Math.pow(80, value / 100))}
          />
          <TimelineButton
            label="Zoom in"
            onClick={() => setZoom((v) => Math.min(80, v * 1.5))}
          >
            <ZoomIn className="size-3.5" />
          </TimelineButton>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded px-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          >
            Fit
          </button>
        </div>
      </div>

      <ScrollArea
        viewportRef={scrollRef}
        scrollbars={zoom <= 1 ? "vertical" : "both"}
        className="studio-scroll min-h-0 flex-1 select-none"
        viewportClassName="overscroll-contain [&>div]:!block"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onPointerDown={(event) => {
          // Click on empty space (not a clip or a header) clears the selection.
          if (
            (event.target as HTMLElement).dataset.slot ===
              "scroll-area-viewport" ||
            event.target === event.currentTarget
          )
            onSelect([]);
        }}
      >
        <div
          className="relative"
          style={{ width: HEADER_WIDTH + width, height: totalHeight }}
        >
          {/* Ruler */}
          <div
            className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur"
            style={{ height: RULER_HEIGHT, width: HEADER_WIDTH + width }}
          >
            <div
              className="sticky left-0 z-10 h-full border-r border-border/60 bg-background"
              style={{ width: HEADER_WIDTH }}
            />
            <div
              className="absolute top-0 h-full cursor-pointer"
              style={{ left: HEADER_WIDTH, width }}
              onPointerDown={startScrub}
            >
              {ticks.map((f) => (
                <div
                  key={f}
                  className="absolute top-0 h-full border-l border-border/40"
                  style={{ left: f * ppf }}
                >
                  <span className="absolute left-1 top-1 font-mono text-[10px] text-muted-foreground">
                    {formatFrameTime(f, fps, step < fps ? 2 : 0)}
                  </span>
                </div>
              ))}
              <div
                className="absolute top-0 h-full bg-black/30"
                style={{
                  left: durationInFrames * ppf,
                  width: Math.max(0, width - durationInFrames * ppf),
                }}
              />
              {layers.markers.map((marker) => (
                <div
                  key={marker.id}
                  className={cn(
                    "absolute bottom-0 flex flex-col",
                    marker.frame * ppf < 40
                      ? "items-start"
                      : "-translate-x-1/2 items-center",
                  )}
                  style={{ left: marker.frame * ppf }}
                  title={`${marker.label} · f${marker.frame}`}
                >
                  <span
                    className={cn(
                      "max-w-28 truncate rounded px-1 text-[9px] font-bold leading-3",
                      marker.kind === "section"
                        ? "bg-primary text-primary-foreground"
                        : marker.kind === "beat"
                          ? "bg-sky-500/80 text-white"
                          : "bg-amber-400 text-black",
                    )}
                  >
                    {marker.kind === "beat" ? "♪" : marker.label}
                  </span>
                  <span className="h-1.5 w-px bg-foreground/60" />
                </div>
              ))}
              {(props.pendingAsks ?? []).map((pending, index) => (
                <div
                  key={`ask-${index}-${pending.frame}`}
                  className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                  style={{ left: pending.frame * ppf }}
                  title={`${agentName} is working on: ${pending.text}`}
                >
                  <span className="flex size-3.5 animate-pulse items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow">
                    ✦
                  </span>
                  <span className="h-2 w-px bg-rose-500" />
                </div>
              ))}
              <PlayheadHead
                frameStore={frameStore}
                ppf={ppf}
                fps={fps}
                onGrab={startScrub}
                ask={
                  props.onAskAt
                    ? {
                        onAsk: props.onAskAt,
                        busy: Boolean(props.askBusy),
                        disabled: Boolean(props.askDisabled),
                      }
                    : undefined
                }
              />
            </div>
          </div>

          {/* Section lines */}
          {layers.markers
            .filter((marker) => marker.kind === "section")
            .map((marker) => (
              <div
                key={`line-${marker.id}`}
                className="pointer-events-none absolute z-0 w-px bg-primary/25"
                style={{
                  left: HEADER_WIDTH + marker.frame * ppf,
                  top: RULER_HEIGHT,
                  height: totalHeight - RULER_HEIGHT,
                }}
              />
            ))}

          {/* Rows */}
          {rows.map(({ track, top, height }, index) => {
            const style = TRACK_KIND_STYLE[track.kind];
            const Icon = style.icon;
            const audible = track.kind === "audio" || track.kind === "video";
            const visual = track.kind !== "audio";
            return (
              <div
                key={`${track.id}:${index}`}
                className="absolute left-0 border-b border-border/40"
                style={{ top, height, width: HEADER_WIDTH + width }}
              >
                <div
                  className="sticky left-0 z-10 flex h-full items-center gap-1.5 border-r border-border/60 bg-background px-2"
                  style={{ width: HEADER_WIDTH }}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span
                    className="min-w-0 flex-1 truncate text-[11px] font-bold"
                    title={`${track.name} (${track.id})`}
                  >
                    {track.name}
                  </span>
                  {visual ? (
                    <TrackToggle
                      label={track.hidden ? "Show track" : "Hide track"}
                      onClick={() =>
                        editTrack(track.id, {
                          hidden: !track.hidden || undefined,
                        })
                      }
                      disabled={readOnly}
                    >
                      {track.hidden ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </TrackToggle>
                  ) : null}
                  {audible ? (
                    <TrackToggle
                      label={track.muted ? "Unmute track" : "Mute track"}
                      onClick={() =>
                        editTrack(track.id, {
                          muted: !track.muted || undefined,
                        })
                      }
                      disabled={readOnly}
                    >
                      {track.muted ? (
                        <VolumeX className="size-3.5" />
                      ) : (
                        <Volume2 className="size-3.5" />
                      )}
                    </TrackToggle>
                  ) : null}
                  <TrackToggle
                    label={track.locked ? "Unlock track" : "Lock track"}
                    onClick={() =>
                      editTrack(track.id, {
                        locked: !track.locked || undefined,
                      })
                    }
                    disabled={readOnly}
                  >
                    {track.locked ? (
                      <Lock className="size-3.5" />
                    ) : (
                      <LockOpen className="size-3.5 opacity-50" />
                    )}
                  </TrackToggle>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={readOnly}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      aria-label="Track menu"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        disabled={index === 0}
                        onSelect={() =>
                          onCommit(moveTrack(layersRef.current, track.id, -1))
                        }
                      >
                        <ArrowUp className="size-4" /> Move up (draw later)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={index === layers.tracks.length - 1}
                        onSelect={() =>
                          onCommit(moveTrack(layersRef.current, track.id, 1))
                        }
                      >
                        <ArrowDown className="size-4" /> Move down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          const name = window.prompt("Track name", track.name);
                          if (name && name.trim())
                            editTrack(track.id, { name: name.trim() });
                        }}
                      >
                        <Type className="size-4" /> Rename…
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          onCommit(deleteTrack(layersRef.current, track.id))
                        }
                      >
                        <Trash2 className="size-4" /> Delete track (
                        {track.clips.length} clips)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div
                  className={cn(
                    "absolute top-0 h-full",
                    index % 2 ? "bg-muted/20" : "bg-transparent",
                  )}
                  style={{ left: HEADER_WIDTH, width }}
                >
                  {(track.clips as StudioClip[]).map((clip, clipIndex) => (
                    <ClipView
                      key={`${clip.id}:${clipIndex}`}
                      slug={slug}
                      track={track}
                      clip={clip}
                      fps={fps}
                      ppf={ppf}
                      height={height}
                      selected={selected.has(clip.id)}
                      flash={props.flashClipIds?.has(clip.id) ?? false}
                      locked={Boolean(readOnly || track.locked)}
                      onPointerDown={onClipPointerDown}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {rows.length === 0 ? (
            <div
              className="absolute inset-x-0 flex items-center justify-center text-xs text-muted-foreground"
              style={{ top: RULER_HEIGHT + 16 }}
            >
              No layers yet. Ask {agentName} in the chat, or add a track.
            </div>
          ) : null}

          <div
            className="pointer-events-none absolute top-0"
            style={{ left: HEADER_WIDTH, height: totalHeight }}
          >
            <PlayheadLine
              frameStore={frameStore}
              ppf={ppf}
              height={totalHeight}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function TimelineButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick(): void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className="size-7 text-muted-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function TrackToggle({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick(): void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}
