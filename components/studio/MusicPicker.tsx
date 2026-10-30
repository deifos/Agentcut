"use client";

import { TooltipHint } from "@/components/ui/tooltip";
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref, type RefObject } from "react";
import { Check, Loader2, Music2, Pause, Play, Volume2, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LabeledSlider } from "@/components/ui/labeled-slider";
import { MUSIC_TRACKS, getMusicTrackUrl, formatDuration, type MusicTrack } from "@/lib/music-tracks";

export interface MusicChoice { id: string; name: string }

const SONG_PAGE_SIZE = 24;

export interface MusicSidebarHandle { open(): void }

/** Opening the library only updates this subtree, not the chat and video editor. */
export function MusicSidebar({ ref, projectKey, selected, onSelect }: {
  ref: Ref<MusicSidebarHandle>;
  projectKey: string | undefined;
  selected: MusicChoice | null;
  onSelect(choice: MusicChoice): void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useImperativeHandle(ref, () => ({ open() { setMounted(true); setOpen(true); } }), []);
  return mounted && projectKey ? <MusicPicker key={projectKey} open={open} selected={selected} onSelect={onSelect} onClose={() => setOpen(false)} /> : null;
}

function MusicSeek({ audioRef, track, playing, loading, onToggle }: {
  audioRef: RefObject<HTMLAudioElement | null>;
  track: MusicTrack;
  playing: boolean;
  loading: boolean;
  onToggle(): void;
}) {
  const [position, setPosition] = useState({ time: 0, duration: 0 });
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setPosition({ time: audio.currentTime, duration: Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : 0 });
    update();
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("durationchange", update);
    audio.addEventListener("loadedmetadata", update);
    return () => { audio.removeEventListener("timeupdate", update); audio.removeEventListener("durationchange", update); audio.removeEventListener("loadedmetadata", update); };
  }, [audioRef]);
  const timeLabel = (seconds: number) => formatDuration(Math.floor(Math.max(0, seconds)));
  return <section className="music-now-playing flex flex-col gap-3 rounded-2xl border border-border p-4" aria-label="Now playing">
    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold tracking-[.12em] text-muted-foreground uppercase">Now playing</span><Music2 className="size-3 text-muted-foreground" /></div>
    <TooltipHint content={track.name}><p tabIndex={0} className="truncate text-sm font-semibold">{track.name}</p></TooltipHint>
    <Button variant="secondary" size="sm" aria-busy={loading} aria-label={`${playing ? "Pause" : "Play"} current song`} onClick={onToggle}>{loading ? <Loader2 className="animate-spin" /> : playing ? <Pause /> : <Play />}{loading ? "Loading audio…" : playing ? "Pause" : "Play"}</Button>
    <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
      <span className="shrink-0">{timeLabel(position.time)}</span>
      <LabeledSlider className="min-w-0 flex-1" label={`Seek ${track.name}`} showLabel={false} showValue={false} sliderProps={{ getThumbAriaValueText: (time) => `${timeLabel(time)} of ${position.duration ? timeLabel(position.duration) : "duration loading"}` }} min={0} max={position.duration || 1} step={0.1} value={Math.min(position.time, position.duration || 1)} disabled={!position.duration} onChange={(value) => {
        const audio = audioRef.current;
        if (!audio || !position.duration || !Number.isFinite(value)) return;
        const time = Math.max(0, Math.min(position.duration, value));
        audio.currentTime = time;
        setPosition((current) => ({ ...current, time }));
      }} />
      <span className="shrink-0">{position.duration ? timeLabel(position.duration) : "–:––"}</span>
    </div>
  </section>;
}

/** Non-modal catalog panel. Playing a song never changes the video request. */
export function MusicPicker({ onClose, onSelect, selected, open = true }: {
  onClose(): void;
  onSelect(choice: MusicChoice): void;
  selected: MusicChoice | null;
  open?: boolean;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playRequest = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(SONG_PAGE_SIZE);
  const tracks = MUSIC_TRACKS.filter((track) => `${track.name} ${track.category}`.toLowerCase().includes(query.toLowerCase()));
  const activeTrack = MUSIC_TRACKS.find((track) => track.id === preview);
  const hasMore = visibleCount < tracks.length;
  useEffect(() => {
    if (!open || !hasMore || !moreRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount((count) => count + SONG_PAGE_SIZE);
    }, { root: listRef.current, rootMargin: "200px" });
    observer.observe(moreRef.current);
    return () => observer.disconnect();
  }, [open, hasMore, visibleCount, query]);
  useEffect(() => {
    const audio = audioRef.current;
    return () => { audio?.pause(); audio?.removeAttribute("src"); audio?.load(); };
  }, []);
  const toggle = async (track: MusicTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    const request = ++playRequest.current;
    if (preview === track.id && !audio.paused) { audio.pause(); return; }
    setError(false);
    setLoading(true);
    if (preview !== track.id) {
      audio.pause();
      audio.src = getMusicTrackUrl(track.filename, track.sourceUrl);
      setPreview(track.id);
    }
    try { await audio.play(); }
    catch { if (playRequest.current === request) { setError(true); setLoading(false); setPlaying(false); } }
  };
  return (
    <aside className="music-library-panel" hidden={!open} aria-labelledby={titleId} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
    }}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1"><h2 id={titleId} className="text-lg font-semibold">Music library</h2><p className="text-xs leading-relaxed text-muted-foreground">Play a song, then choose it for your request. Send applies the change.</p></div>
        <Button variant="ghost" size="icon-sm" aria-label="Close music library" onClick={onClose}><X /></Button>
      </header>
      <Button variant={selected?.id === "auto" ? "secondary" : "outline"} onClick={() => onSelect({ id: "auto", name: "Choose for me" })}>{selected?.id === "auto" ? <Check /> : <WandSparkles />} Choose for me</Button>
      <label className="flex flex-col gap-2 text-xs font-medium">Search songs or categories
        <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(SONG_PAGE_SIZE); if (listRef.current) listRef.current.scrollTop = 0; }} className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="Search by name, chill, cinematic…" />
      </label>
      <audio ref={audioRef} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadStart={() => setLoading(true)} onCanPlay={() => setLoading(false)} onPlaying={() => setLoading(false)} onWaiting={() => setLoading(true)} onError={() => { setError(true); setLoading(false); setPlaying(false); }} />
      {activeTrack ? <MusicSeek key={activeTrack.id} audioRef={audioRef} track={activeTrack} playing={playing} loading={loading} onToggle={() => void toggle(activeTrack)} /> : null}
      {error ? <p role="alert" className="text-xs text-destructive">The song could not play. Try again or check your connection.</p> : null}
      <div ref={listRef} className="music-library-tracks min-h-0 flex-1 overflow-y-auto" aria-label="Song library">
        {tracks.length ? tracks.slice(0, visibleCount).map((track) => {
          const active = preview === track.id;
          const isPlaying = active && playing;
          const chosen = selected?.id === track.id;
          return <div key={track.id} className="music-library-track border-b border-border" data-active={active} data-playing={isPlaying} data-selected={chosen}>
            <Button variant={isPlaying ? "secondary" : "ghost"} size="sm" aria-busy={active && loading} aria-label={`${isPlaying ? "Pause" : "Play"} ${track.name}`} aria-pressed={isPlaying} onClick={() => void toggle(track)}>
              {active && loading ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause /> : <Play />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <div className="min-w-0 flex-1"><TooltipHint content={track.name}><p tabIndex={0} className="truncate text-sm font-medium">{track.name}</p></TooltipHint><div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-muted-foreground">{track.category} · {formatDuration(track.durationSeconds)}</span>{active && loading ? <span role="status" className="text-[10px] text-muted-foreground">Loading audio…</span> : isPlaying ? <Badge variant="secondary" className="music-playing-label gap-1"><Volume2 className="size-3" /> Playing</Badge> : active ? <span className="text-[10px] text-muted-foreground">{error ? "Could not play" : "Paused"}</span> : null}</div></div>
            <Button variant={chosen ? "secondary" : "outline"} size="sm" aria-label={`${chosen ? "Selected" : "Use"} ${track.name}`} aria-pressed={chosen} onClick={() => onSelect({ id: track.id, name: track.name })}>{chosen ? <Check /> : <Music2 />}{chosen ? "Selected" : "Use"}</Button>
          </div>;
        }) : <p className="py-6 text-center text-sm text-muted-foreground">No songs found. Try another search.</p>}
        {hasMore ? <div ref={moreRef} className="py-3 text-center"><Button variant="ghost" size="sm" onClick={() => setVisibleCount((count) => count + SONG_PAGE_SIZE)}>Show more songs ({tracks.length - visibleCount} left)</Button></div> : null}
      </div>
      <p className="text-xs text-muted-foreground">Keep editing while you browse. Your choice stays in the composer.</p>
    </aside>
  );
}
