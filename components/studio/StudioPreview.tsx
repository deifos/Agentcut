"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  AlertTriangle,
  Loader2,
  Pause,
  Pencil,
  Play,
  Repeat,
  SkipBack,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { buildInputProps, variantSize } from "@/lib/studio/composition-props";
import { findClip } from "@/lib/studio/edit";
import { formatFrameTime } from "@/lib/studio/format";
import { useFrame, type FrameStore } from "@/lib/studio/frame-store";
import {
  createPreviewPerfStore,
  currentReport,
  PreviewPerfRecorder,
  slowClips,
  usePreviewPerf,
  type PreviewPerfState,
  type PreviewPerfStore,
} from "@/lib/studio/preview-perf";
import { DrawAsk } from "@/components/studio/DrawAsk";
import { useAgentName } from "@/components/studio/StudioAgent";
import type { DrawStroke } from "@/lib/studio/drawing";
import type {
  Box,
  BundleSummary,
  LoadedModule,
  StudioDoc,
} from "@/lib/studio/types";

export interface StudioPreviewProps {
  doc: StudioDoc;
  loaded: LoadedModule | null;
  bundle: BundleSummary | null;
  moduleError: string | null;
  variant: string;
  frameStore: FrameStore;
  /** Where playback smoothness is recorded for the agent (left out on the website's demo). */
  previewPerf?: PreviewPerfStore;
  playerRef: RefObject<PlayerRef | null>;
  selection: string[];
  playing: boolean;
  onPlayingChange(playing: boolean): void;
  /** The agent is changing the project: playback is held so you don't watch half-written files. */
  editing?: boolean;
  /** Where project files are served from; defaults to the local helper (the website's demo overrides it). */
  assetBase?: string;
  /** The pencil: draw on the video and send the drawing with a prompt (left out where there's no agent). */
  draw?: {
    busy: boolean;
    disabled: boolean;
    onSend(strokes: DrawStroke[], text: string): Promise<void>;
  };
}

const NO_PREVIEW_PERF = createPreviewPerfStore();

/**
 * The scenes to name in "Preview drops frames in …": likely causes in the latest report for what's on
 * screen, and only clips the timeline still has where they were (an edit since makes them stale).
 */
function slowLabel(
  state: PreviewPerfState,
  slug: string,
  revision: number,
  variant: string,
  layers: StudioDoc["layers"],
) {
  if (!layers) return "";
  const report = currentReport(state, slug, revision, variant);
  if (!report) return "";
  const labels = slowClips(report)
    .filter((clip) => {
      if (!clip.cause) return false;
      const location = findClip(layers, clip.id);
      return (
        !!location &&
        !location.track.hidden &&
        location.clip.from === clip.from &&
        location.clip.from + location.clip.duration === clip.to
      );
    })
    .map((clip) => clip.label);
  return [...new Set(labels)].slice(0, 2).join(", ");
}

function useContainerRect(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function SelectionOutline({
  box,
  rect,
}: {
  box: Box;
  rect: { left: number; top: number; width: number; height: number };
}) {
  return (
    <div
      className="pointer-events-none absolute border-2 border-dashed border-primary/90 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
      style={{
        left: rect.left + box.x * rect.width,
        top: rect.top + box.y * rect.height,
        width: box.width * rect.width,
        height: box.height * rect.height,
      }}
    />
  );
}

function Transport({
  frameStore,
  fps,
  durationInFrames,
  playerRef,
  playing,
  loop,
  setLoop,
  muted,
  setMuted,
  editing,
  drawing,
  onDraw,
  slow,
}: {
  editing?: boolean;
  /** Clips the preview can't play at full speed (playback only: exports are unaffected). */
  slow?: string;
  /** Shown only when the pencil is available. */
  drawing?: boolean;
  onDraw?(): void;
  frameStore: FrameStore;
  fps: number;
  durationInFrames: number;
  playerRef: RefObject<PlayerRef | null>;
  playing: boolean;
  loop: boolean;
  setLoop(value: boolean): void;
  muted: boolean;
  setMuted(value: boolean): void;
}) {
  const agentName = useAgentName();
  const frame = useFrame(frameStore);
  const seek = (next: number) => {
    const clamped = Math.max(0, Math.min(durationInFrames - 1, next));
    playerRef.current?.seekTo(clamped);
    frameStore.set(clamped);
  };
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-t border-border/60 px-2">
      <IconButton label="Go to start (Home)" onClick={() => seek(0)}>
        <SkipBack className="size-4" />
      </IconButton>
      <IconButton label="Previous frame (←)" onClick={() => seek(frame - 1)}>
        <StepBack className="size-4" />
      </IconButton>
      <button
        type="button"
        aria-label={playing ? "Pause (Space)" : "Play (Space)"}
        title={
          editing
            ? `${agentName} is editing: play when it's done`
            : playing
              ? "Pause (Space)"
              : "Play (Space)"
        }
        disabled={editing}
        onClick={() => playerRef.current?.toggle()}
        className="mx-1 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {playing ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4 translate-x-px" />
        )}
      </button>
      <IconButton label="Next frame (→)" onClick={() => seek(frame + 1)}>
        <StepForward className="size-4" />
      </IconButton>
      <span className="ml-2 font-mono text-xs tabular-nums">
        <span className={cn(playing && "text-primary")}>
          {formatFrameTime(frame, fps)}
        </span>
        <span className="text-muted-foreground">
          {" "}
          / {formatFrameTime(durationInFrames, fps)}
        </span>
      </span>
      <div className="ml-auto flex items-center gap-1">
        {slow ? (
          <span
            title={`The preview can't draw ${slow} fast enough in this browser, so playback skips frames there. Exports render every frame at full quality. Ask ${agentName} to make the scene lighter to play (agentcut_preview_check).`}
            className="mr-1 flex max-w-56 items-center gap-1 truncate rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"
          >
            <AlertTriangle className="size-3 shrink-0" />
            <span className="truncate">Preview drops frames in {slow}</span>
          </span>
        ) : null}
        {onDraw ? (
          <IconButton
            label={
              drawing
                ? "Close the pencil (Esc)"
                : `Draw on the video and tell ${agentName} what to do`
            }
            onClick={onDraw}
            active={drawing}
          >
            <Pencil className="size-4" />
          </IconButton>
        ) : null}
        <IconButton
          label={loop ? "Loop on" : "Loop off"}
          onClick={() => setLoop(!loop)}
          active={loop}
        >
          <Repeat className="size-4" />
        </IconButton>
        <IconButton
          label={muted ? "Unmute preview" : "Mute preview"}
          onClick={() => setMuted(!muted)}
        >
          {muted ? (
            <VolumeX className="size-4" />
          ) : (
            <Volume2 className="size-4" />
          )}
        </IconButton>
      </div>
    </div>
  );
}

export function StudioPreview(props: StudioPreviewProps) {
  const {
    doc,
    loaded,
    bundle,
    moduleError,
    variant,
    frameStore,
    previewPerf,
    playerRef,
    selection,
    playing,
    onPlayingChange,
    editing,
    assetBase,
    draw,
  } = props;
  const agentName = useAgentName();
  const perfStore = previewPerf ?? NO_PREVIEW_PERF;
  const checking = usePreviewPerf(perfStore, (state) => state.checking);
  const containerRef = useRef<HTMLDivElement>(null);
  const container = useContainerRect(containerRef);
  const [loop, setLoop] = useState(true);
  const [muted, setMuted] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const toggleDrawing = () => {
    // The drawing is about one frame: hold the picture still under the pen.
    if (!drawing) playerRef.current?.pause();
    setDrawing(!drawing);
  };
  // Pause the moment the agent starts changing files; a reload mid-playback shows half-written scenes.
  useEffect(() => {
    if (editing) playerRef.current?.pause();
  }, [editing, playerRef]);
  const project = doc.project;
  const layers = doc.layers;

  const size = project
    ? variantSize(project, variant)
    : { width: 1920, height: 1080 };
  const inputProps = useMemo(() => {
    if (!project || !layers) return null;
    const props = buildInputProps(doc.slug, project, layers, variant);
    return assetBase ? { ...props, assetBase } : props;
  }, [doc.slug, project, layers, variant, assetBase]);
  const ready = Boolean(
    loaded && loaded.slug === doc.slug && project && layers && inputProps,
  );
  const revision = loaded?.revision ?? 0;
  // The latest play state, read when a new player mounts (not a reason to re-wire it).
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Wire player events; re-run when the player remounts (new bundle or variant).
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    const start = frameStore.get();
    if (start > 0)
      player.seekTo(Math.min(start, (project?.durationInFrames ?? 1) - 1));
    // A new player (variant switch, rebuild) starts paused: carry on if we were playing, so the
    // play button and the picture never disagree.
    if (playingRef.current) {
      player.play();
      if (!player.isPlaying()) onPlayingChange(false);
    }
    // agentcut_preview_check plays the player itself: the play button and playhead stay on the
    // user's side, so a player that remounts mid-check comes back where the user left it.
    const isChecking = () => previewPerf?.get().checking ?? false;
    const onFrame = (event: { detail: { frame: number } }) => {
      if (!isChecking()) frameStore.set(event.detail.frame);
    };
    const onSeeked = (event: { detail: { frame: number } }) => {
      if (!isChecking()) frameStore.set(event.detail.frame);
    };
    const onPlay = () => {
      if (!isChecking()) onPlayingChange(true);
    };
    const onPause = () => {
      if (!isChecking()) onPlayingChange(false);
    };
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onSeeked);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onSeeked);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, revision, variant, playerRef, frameStore, previewPerf, onPlayingChange]);

  // How smoothly the user's own playback runs, per clip (agentcut_preview_check records its own).
  // A new recorder for every bundle, variant and timeline: the numbers describe what's on screen.
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !ready || !previewPerf || !project || !layers) return;
    const recorder = new PreviewPerfRecorder(
      {
        slug: doc.slug,
        variant,
        revision,
        fps: project.fps,
        layers,
        source: "playback",
        lastFrame: project.durationInFrames - 1,
      },
      () => player.getContainerNode(),
    );
    // Only with new frames: a pause or seek alone (e.g. from agentcut_preview_check) mustn't put
    // older numbers back over the check's.
    let published = 0;
    const publish = () => {
      if (recorder.framesPlayed === published) return;
      published = recorder.framesPlayed;
      previewPerf.setReport(recorder.report());
    };
    const recording = () => player.isPlaying() && !previewPerf.get().checking;
    const onFrame = (event: { detail: { frame: number } }) => {
      if (!recording()) return;
      recorder.frame(event.detail.frame);
      if (recorder.framesPlayed % 30 === 0) publish();
    };
    const onStop = () => {
      recorder.reset();
      publish();
    };
    const onWaiting = () => {
      if (recording()) recorder.waiting(player.getCurrentFrame());
    };
    const onResume = () => recorder.resume();
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("seeked", onStop);
    player.addEventListener("pause", onStop);
    player.addEventListener("ended", onStop);
    player.addEventListener("waiting", onWaiting);
    player.addEventListener("resume", onResume);
    return () => {
      publish();
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("seeked", onStop);
      player.removeEventListener("pause", onStop);
      player.removeEventListener("ended", onStop);
      player.removeEventListener("waiting", onWaiting);
      player.removeEventListener("resume", onResume);
    };
  }, [ready, revision, variant, layers, project, doc.slug, playerRef, previewPerf]);

  // A check plays muted; the user's choice comes back when it ends.
  useEffect(() => {
    if (!playerRef.current) return;
    if (muted || checking) playerRef.current.mute();
    else playerRef.current.unmute();
  }, [muted, checking, playerRef, ready, revision]);

  // Where the composition sits inside the container (Player letterboxes it).
  const scale =
    Math.min(container.width / size.width, container.height / size.height) || 0;
  const rect = {
    width: size.width * scale,
    height: size.height * scale,
    left: (container.width - size.width * scale) / 2,
    top: (container.height - size.height * scale) / 2,
  };

  const selectedBox = useMemo(() => {
    if (!layers || selection.length !== 1) return null;
    const location = findClip(layers, selection[0]);
    if (!location) return null;
    const clip = {
      ...location.clip,
      ...((location.clip as { variants?: Record<string, object> }).variants?.[
        variant
      ] ?? {}),
    };
    if ("box" in clip && clip.box) return clip.box as Box;
    if (location.track.kind === "text")
      return { x: 0.05, y: 0.4, width: 0.9, height: 0.2 };
    return null;
  }, [layers, selection, variant]);

  const errors = doc.issues.filter((issue) => issue.severity === "error");
  const slow = usePreviewPerf(perfStore, (state) =>
    slowLabel(state, doc.slug, revision, variant, layers),
  );
  const buildErrors = bundle && !bundle.ok ? bundle.errors : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/70 p-5 dark:bg-black/30">
        {/* The stage: the video sits in a rounded window with breathing room around it. */}
        <div ref={containerRef} className="relative size-full">
          {ready && loaded && inputProps && project ? (
            <div
              className="absolute overflow-hidden rounded-xl bg-[repeating-conic-gradient(#151518_0%_25%,#101013_0%_50%)] bg-[length:24px_24px] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/5 dark:ring-white/10"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                // Its own compositing layer and layout/paint boundary: heavy 3D scenes repaint inside
                // the preview only, instead of taking the rest of the studio with them.
                contain: "strict",
                isolation: "isolate",
                transform: "translateZ(0)",
              }}
            >
              <Player
                key={`${loaded.revision}-${variant}`}
                ref={playerRef}
                component={loaded.module.StudioComposition}
                inputProps={inputProps}
                durationInFrames={Math.max(1, project.durationInFrames)}
                fps={project.fps}
                compositionWidth={size.width}
                compositionHeight={size.height}
                style={{ width: "100%", height: "100%" }}
                loop={loop}
                clickToPlay={false}
                doubleClickToFullscreen
                spaceKeyToPlayOrPause={false}
                acknowledgeRemotionLicense
                errorFallback={({ error }) => (
                  <div className="flex h-full items-center justify-center bg-red-950/80 p-6 text-center text-sm text-red-100">
                    <div>
                      <AlertTriangle className="mx-auto mb-2 size-6" />
                      <p className="font-semibold">
                        A scene crashed while drawing this frame
                      </p>
                      <p className="mt-1 font-mono text-xs opacity-80">
                        {error.message}
                      </p>
                    </div>
                  </div>
                )}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {moduleError ? (
                <div className="max-w-md rounded-lg border border-red-500/40 bg-red-950/50 p-4 text-red-100">
                  <p className="mb-1 font-semibold">
                    The preview couldn&apos;t load the project code
                  </p>
                  <p className="font-mono text-xs">{moduleError}</p>
                </div>
              ) : !project || !layers ? (
                <div className="max-w-md rounded-lg border border-red-500/40 bg-red-950/50 p-4 text-red-100">
                  <p className="mb-1 font-semibold">
                    project.json or layers.json is invalid
                  </p>
                  <p className="text-xs">
                    Ask {agentName} to fix it, or fix the files by hand.
                  </p>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Building the
                  preview…
                </span>
              )}
            </div>
          )}
          {(editing || checking) && ready ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
              <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg backdrop-blur">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                {checking
                  ? `${agentName} is checking how smoothly this plays`
                  : `${agentName} is editing · play when it's done`}
              </span>
            </div>
          ) : null}
          {selectedBox && ready ? (
            <SelectionOutline box={selectedBox} rect={rect} />
          ) : null}
          {draw && drawing && ready ? (
            <DrawAsk
              key={doc.slug}
              rect={rect}
              size={size}
              busy={draw.busy}
              disabled={draw.disabled}
              onSend={draw.onSend}
              onClose={() => setDrawing(false)}
            />
          ) : null}
        </div>
        {/* Mid-edit errors are expected (files are half-written); the agent checks the build itself. */}
        {!editing && (buildErrors.length > 0 || errors.length > 0) ? (
          <ScrollArea
            className="absolute inset-x-3 bottom-3 rounded-lg border border-red-500/50 bg-black/85 text-xs text-red-100 shadow-xl"
            viewportClassName="max-h-40"
          >
            <div className="p-3">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-3.5" />
                {buildErrors.length > 0
                  ? "Build error: the preview shows the last working version"
                  : "Project file problems"}
              </p>
              <ul className="space-y-1 font-mono">
                {buildErrors.slice(0, 5).map((error, i) => (
                  <li key={`b${i}`}>
                    {error.file
                      ? `${error.file.split(/[\\/]/).slice(-2).join("/")}:${error.line ?? 0} `
                      : ""}
                    {error.text}
                  </li>
                ))}
                {errors.slice(0, 6).map((issue, i) => (
                  <li key={`i${i}`}>
                    {issue.file} {issue.path}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollArea>
        ) : null}
      </div>
      {project ? (
        <Transport
          frameStore={frameStore}
          fps={project.fps}
          durationInFrames={project.durationInFrames}
          playerRef={playerRef}
          playing={playing}
          loop={loop}
          setLoop={setLoop}
          muted={muted}
          setMuted={setMuted}
          editing={editing}
          drawing={drawing}
          onDraw={draw ? toggleDrawing : undefined}
          slow={slow || undefined}
        />
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick(): void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {children}
    </button>
  );
}
