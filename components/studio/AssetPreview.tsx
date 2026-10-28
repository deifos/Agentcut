"use client";

// One preview for every kind of project file: images, audio, video, fonts, text.
// Opens beside the assets list so the user never has to leave the studio.
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  AtSign,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Plus,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LabeledSlider } from "@/components/ui/labeled-slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { audioPeaks } from "@/lib/studio/audio/peaks";
import { fileName, formatBytes } from "@/lib/studio/format";
import type { AssetEntry } from "@/lib/studio/types";
import { useAgentName } from "@/components/studio/StudioAgent";
import { SpeakButton, useSpeechInput } from "@/components/studio/SpeakButton";

const FONT_RE = /\.(woff2?|ttf|otf)$/i;
const TEXT_RE = /\.(json|md|txt|srt|vtt|csv|svg)$/i;

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/** Waveform of an audio file with the played part highlighted; click or drag to seek. */
function WaveformScrubber({
  url,
  progress,
  onSeek,
  range,
}: {
  url: string;
  progress: number;
  onSeek(fraction: number): void;
  /** Part of the file in use (fractions): drawn brighter, the rest faded. */
  range?: [number, number];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    audioPeaks(url)
      .then((result) => alive && setPeaks(result.peaks))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    const played = "#10b981";
    const rest = getComputedStyle(canvas).color;
    const bars = Math.max(1, Math.floor(width / 3));
    let max = 0;
    if (peaks) for (const value of peaks) max = Math.max(max, value);
    for (let i = 0; i < bars; i += 1) {
      let value = 0.08;
      if (peaks && peaks.length) {
        const start = Math.floor((i / bars) * peaks.length);
        const end = Math.max(
          start + 1,
          Math.floor(((i + 1) / bars) * peaks.length),
        );
        for (let j = start; j < end && j < peaks.length; j += 1)
          value = Math.max(value, peaks[j] / (max || 1));
      }
      const h = Math.max(2, value * (height - 4));
      const at = i / bars;
      const isPlayed = at <= progress;
      const inRange = !range || (at >= range[0] && at <= range[1]);
      ctx.globalAlpha = !inRange ? 0.12 : isPlayed ? 1 : 0.4;
      ctx.fillStyle = isPlayed ? played : rest;
      ctx.fillRect(i * 3, (height - h) / 2, 2, h);
    }
  }, [peaks, progress, range]);

  const seekAt = (clientX: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  return (
    <div
      className="relative h-14 w-full cursor-pointer select-none text-muted-foreground"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekAt(event.clientX, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          seekAt(event.clientX, event.currentTarget);
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {!peaks && !failed ? (
        <Loader2 className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

/** The standard player for audio and video files. */
export function MediaPlayer({
  url,
  kind,
  onMeta,
  segment,
  volume,
}: {
  url: string;
  kind: "audio" | "video";
  onMeta?(meta: string): void;
  /** Play only this part of the file (seconds), e.g. the part a timeline clip uses. */
  segment?: { start: number; end: number };
  /** 0–1 (a clip's volume above 1 plays at 1 here). */
  volume?: number;
}) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const segmentRef = useRef(segment);
  useEffect(() => {
    segmentRef.current = segment;
  }, [segment]);
  useEffect(() => {
    if (mediaRef.current && volume !== undefined)
      mediaRef.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    const sync = () => setTime(media.currentTime);
    const meta = () => {
      setDuration(media.duration);
      if (kind === "video" && media.videoWidth)
        onMeta?.(
          `${media.videoWidth}×${media.videoHeight} · ${formatClock(media.duration)}`,
        );
      else onMeta?.(formatClock(media.duration));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    media.addEventListener("timeupdate", sync);
    media.addEventListener("loadedmetadata", meta);
    media.addEventListener("play", onPlay);
    media.addEventListener("pause", onPause);
    media.addEventListener("ended", onPause);
    // Smooth progress while playing (timeupdate fires only ~4×/s).
    let raf = 0;
    const tick = () => {
      if (!media.paused) {
        setTime(media.currentTime);
        const end = segmentRef.current?.end;
        if (end !== undefined && media.currentTime >= end) {
          media.pause();
          media.currentTime = segmentRef.current!.start;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      media.pause();
      media.removeEventListener("timeupdate", sync);
      media.removeEventListener("loadedmetadata", meta);
      media.removeEventListener("play", onPlay);
      media.removeEventListener("pause", onPause);
      media.removeEventListener("ended", onPause);
    };
  }, [kind, onMeta, url]);

  const toggle = () => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      const part = segmentRef.current;
      if (
        part &&
        (media.currentTime < part.start || media.currentTime >= part.end - 0.02)
      )
        media.currentTime = part.start;
      void media.play().catch(() => toast.error("Couldn't play this file."));
    } else media.pause();
  };
  const seek = (fraction: number) => {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(media.duration)) return;
    media.currentTime = fraction * media.duration;
    setTime(media.currentTime);
  };
  const progress = duration > 0 ? time / duration : 0;

  return (
    <div className="space-y-2">
      {kind === "video" ? (
        <div className="overflow-hidden rounded-lg bg-black">
          <video
            ref={mediaRef}
            src={url}
            preload="metadata"
            playsInline
            muted={muted}
            onClick={toggle}
            className="max-h-[50vh] w-full cursor-pointer object-contain"
          />
        </div>
      ) : (
        <audio ref={mediaRef} src={url} preload="metadata" muted={muted} />
      )}
      {kind === "audio" ? (
        <WaveformScrubber
          url={url}
          progress={progress}
          onSeek={seek}
          range={
            segment && duration > 0
              ? [segment.start / duration, Math.min(1, segment.end / duration)]
              : undefined
          }
        />
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon-sm"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="rounded-full"
        >
          {playing ? <Pause /> : <Play className="translate-x-px" />}
        </Button>
        {kind === "video" ? (
          <LabeledSlider
            label="Seek"
            showLabel={false}
            showValue={false}
            min={0}
            max={1000}
            step={1}
            value={Math.round(progress * 1000)}
            onChange={(value) => seek(value / 1000)}
            className="min-w-0 flex-1"
          />
        ) : (
          <span className="flex-1" />
        )}
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {formatClock(time)} / {formatClock(duration)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setMuted((value) => !value)}
          aria-label={muted ? "Unmute" : "Mute"}
          className="text-muted-foreground"
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>
    </div>
  );
}

function ImageView({
  url,
  onMeta,
}: {
  url: string;
  onMeta(meta: string): void;
}) {
  const [actual, setActual] = useState(false);
  return (
    <ScrollArea
      scrollbars="both"
      className="rounded-lg bg-[repeating-conic-gradient(#8881_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
      viewportClassName="max-h-[60vh]"
    >
      <div
        className={cn(
          "flex min-h-32 items-center justify-center",
          actual ? "cursor-zoom-out" : "cursor-zoom-in",
        )}
        onClick={() => setActual((value) => !value)}
        title={actual ? "Fit" : "Actual size"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local helper file, not an app asset */}
        <img
          src={url}
          alt=""
          onLoad={(event) =>
            onMeta(
              `${event.currentTarget.naturalWidth}×${event.currentTarget.naturalHeight}`,
            )
          }
          className={
            actual ? "max-w-none" : "max-h-[60vh] max-w-full object-contain"
          }
        />
      </div>
    </ScrollArea>
  );
}

function FontView({ url, name }: { url: string; name: string }) {
  const [family, setFamily] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const id = `studio-preview-${name.replace(/[^\w]/g, "-")}`;
    const face = new FontFace(id, `url("${url}")`);
    let alive = true;
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        if (alive) setFamily(id);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url, name]);
  if (failed)
    return (
      <p className="text-xs text-muted-foreground">
        This font couldn&apos;t be loaded.
      </p>
    );
  if (!family)
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  return (
    <div
      className="space-y-1 rounded-lg bg-muted/50 p-3"
      style={{ fontFamily: family }}
    >
      <p className="text-3xl leading-tight">Aa Bb Cc 123</p>
      <p className="text-base">The quick brown fox jumps over the lazy dog.</p>
      <p className="text-xs opacity-70">
        ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
      </p>
    </div>
  );
}

function TextView({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((response) => response.text())
      .then(
        (value) =>
          alive &&
          setText(value.length > 8000 ? `${value.slice(0, 8000)}\n…` : value),
      )
      .catch(() => alive && setText("Couldn't load this file."));
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <ScrollArea
      className="rounded-lg bg-muted/50"
      viewportClassName="max-h-[50vh]"
    >
      <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed">
        {text ?? "Loading…"}
      </pre>
    </ScrollArea>
  );
}

/** One-tap requests per kind of file; the user can also type their own. */
function suggestionsFor(kind: string, path: string): string[] {
  if (kind === "audio") {
    return /music|song|bed|theme|track|beat/i.test(path)
      ? [
          "Use this as the background music",
          "Cut the scenes to this song's beats",
          "Use only the best 20 seconds of this song",
          "Start this song at the playhead",
        ]
      : [
          "Use this as the transition sound between scenes",
          "Add this sound effect at the playhead",
          "Use this on every text pop-in",
          "Use this as the background music",
        ];
  }
  if (kind === "image")
    return [
      "Add this at the playhead",
      "Use this as the background",
      "Show this on a laptop mockup",
      "Animate this with a slow zoom",
    ];
  if (kind === "video")
    return [
      "Add this clip at the playhead",
      "Use this as background footage",
      "Show this inside a device screen",
      "Cut the best 5 seconds and add them here",
    ];
  if (/\.(woff2?|ttf|otf)$/i.test(path))
    return ["Use this font for all titles", "Use this font for captions"];
  return ["Use this file in the video"];
}

/** Tell the agent what to do with this file: the request goes to the chat with the file attached. */
function AskClaude({
  asset,
  busy,
  disabled,
  onAsk,
  onMention,
}: {
  asset: AssetEntry;
  busy: boolean;
  disabled: boolean;
  onAsk(text: string): Promise<void>;
  onMention(): void;
}) {
  const agentName = useAgentName();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const blocked = disabled || sending;
  const speech = useSpeechInput({ value: text, onChange: setText, disabled: blocked });
  const send = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || blocked || speech.dictating) return;
    setSending(true);
    try {
      await onAsk(trimmed);
      setText("");
    } catch {
      // the controller shows the error
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold">
        <Sparkles className="size-3.5 text-primary" /> Ask {agentName} to use it
        <span className="ml-auto font-normal text-muted-foreground">
          {busy
            ? `runs after ${agentName}'s current job`
            : "sent with the playhead"}
        </span>
      </p>
      <div className="flex flex-wrap gap-1">
        {suggestionsFor(asset.kind, asset.path).map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            size="xs"
            disabled={blocked}
            onClick={() => void send(suggestion)}
            className="rounded-full text-[11px] font-normal"
          >
            {suggestion}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-1.5">
        <Textarea
          data-speech={speech.id}
          value={text}
          readOnly={speech.dictating}
          rows={1}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!speech.handleEnter()) void send(text);
            }
          }}
          disabled={disabled}
          placeholder="Or say it your way… e.g. “start this at the drop, fade it out at the end card”"
          className="max-h-24 min-h-8 min-w-0 flex-1 resize-none bg-background px-2 py-1.5 text-[12px] md:text-[12px]"
        />
        <SpeakButton speech={speech} />
        <Button
          type="button"
          size="icon-sm"
          onClick={() => void send(text)}
          disabled={!text.trim() || blocked || speech.dictating}
          aria-label={`Send to ${agentName}`}
          className="rounded-full"
        >
          {sending ? <Spinner /> : <ArrowUp />}
        </Button>
      </div>
      <Button
        type="button"
        variant="link"
        size="xs"
        onClick={onMention}
        disabled={disabled}
        className="h-auto px-0 text-[11px] font-normal text-muted-foreground"
      >
        <AtSign /> Add to the chat box instead (for a longer message)
      </Button>
    </div>
  );
}

export interface AssetPreviewProps {
  asset: AssetEntry;
  url: string;
  addable: boolean;
  adding: boolean;
  /** The agent is working on another message. */
  chatBusy: boolean;
  chatDisabled: boolean;
  onAdd(): void;
  onAsk(text: string): Promise<void>;
  onMention(): void;
  onClose(): void;
}

/** Body of the preview popover. */
export function AssetPreview({
  asset,
  url,
  addable,
  adding,
  chatBusy,
  chatDisabled,
  onAdd,
  onAsk,
  onMention,
  onClose,
}: AssetPreviewProps) {
  const agentName = useAgentName();
  const [meta, setMeta] = useState<string | null>(null);
  const name = fileName(asset.path);
  // SVGs are images first; show their source only for other text files.
  const isSvg = /\.svg$/i.test(asset.path);
  let body: ReactNode;
  if (asset.kind === "image" || isSvg)
    body = <ImageView url={url} onMeta={setMeta} />;
  else if (asset.kind === "audio" || asset.kind === "video")
    body = <MediaPlayer url={url} kind={asset.kind} onMeta={setMeta} />;
  else if (FONT_RE.test(asset.path)) body = <FontView url={url} name={name} />;
  else if (TEXT_RE.test(asset.path)) body = <TextView url={url} />;
  else
    body = (
      <p className="text-xs text-muted-foreground">
        No preview for this kind of file.
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={asset.path}>
            {name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {[formatBytes(asset.size), meta].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close preview"
          className="text-muted-foreground"
        >
          <X />
        </Button>
      </div>
      {body}
      <AskClaude
        asset={asset}
        busy={chatBusy}
        disabled={chatDisabled}
        onAsk={onAsk}
        onMention={onMention}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {addable ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onAdd}
            disabled={adding}
            title="Drop it on the timeline yourself, at the playhead"
          >
            {adding ? <Spinner /> : <Plus />} Place at playhead
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => {
            void navigator.clipboard
              .writeText(asset.path)
              .then(() =>
                toast.success(
                  `Path copied. Paste it in the chat to point ${agentName} at this file.`,
                ),
              )
              .catch(() => toast.error("Couldn't copy."));
          }}
        >
          <Copy /> Copy path
        </Button>
        <Button
          asChild
          variant="ghost"
          size="xs"
          className="ml-auto text-muted-foreground"
        >
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink /> Open
          </a>
        </Button>
      </div>
    </div>
  );
}
