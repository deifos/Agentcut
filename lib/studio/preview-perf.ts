// Preview smoothness. The Player is time-based: when a frame takes too long to draw it skips ahead,
// so gaps between `frameupdate` events are dropped frames, and `waiting` → `resume` is a stall
// (media still loading). Both are counted per visual clip, with the most elements seen in the
// player, so the agent can tell which scene is too heavy to play live. Preview only: exports render
// every frame at full quality whatever this says.
import { useSyncExternalStore } from "react";
import type { StudioLayers } from "@/lib/studio/types";

const ELEMENT_SAMPLE_EVERY = 15;
/** A clip needs this many frames played before it gets a verdict. */
const MIN_FRAMES = 10;

export type PreviewVerdict = "smooth" | "choppy" | "heavy";

export interface PreviewPerfClip {
  id: string;
  /** Scene or component name, else the clip's name or id. */
  label: string;
  track: string;
  from: number;
  to: number;
  framesPlayed: number;
  framesDropped: number;
  dropRate: number;
  stalls: number;
  stallMs: number;
  /** The longest time one frame stayed on screen while playing (a freeze). */
  longestFreezeMs: number;
  maxElements: number;
  verdict: PreviewVerdict | null;
}

export interface PreviewPerfReport {
  slug: string;
  variant: string;
  revision: number;
  fps: number;
  /** "playback": the user's own playback; "check": agentcut_preview_check. */
  source: "playback" | "check";
  framesPlayed: number;
  framesDropped: number;
  dropRate: number;
  stalls: number;
  stallMs: number;
  longestFreezeMs: number;
  /** Where the longest freeze ended. */
  longestFreezeFrame: number | null;
  maxElements: number;
  /** The tab was hidden for part of it (the browser throttles hidden tabs, so numbers are off). */
  tabHidden: boolean;
  clips: PreviewPerfClip[];
}

interface Range {
  id: string;
  label: string;
  track: string;
  from: number;
  to: number;
}

function visualRanges(layers: StudioLayers): Range[] {
  const ranges: Range[] = [];
  for (const track of layers.tracks) {
    if (track.kind === "audio" || track.hidden) continue;
    for (const clip of track.clips) {
      const c = clip as { id: string; name?: string; scene?: string; component?: string; from: number; duration: number };
      ranges.push({
        id: c.id,
        label: c.scene ?? c.component ?? c.name ?? c.id,
        track: track.name || track.kind,
        from: c.from,
        to: c.from + c.duration,
      });
    }
  }
  return ranges;
}

export function verdictFor(dropRate: number, framesPlayed: number): PreviewVerdict | null {
  if (framesPlayed < MIN_FRAMES) return null;
  // A light scene still drops the odd frame to timer jitter on a busy machine: only flag what shows.
  if (dropRate >= 0.3) return "heavy";
  if (dropRate >= 0.12) return "choppy";
  return "smooth";
}

interface Counts {
  played: number;
  dropped: number;
  stalls: number;
  stallMs: number;
  freezeMs: number;
  maxElements: number;
}

const empty = (): Counts => ({ played: 0, dropped: 0, stalls: 0, stallMs: 0, freezeMs: 0, maxElements: 0 });

export class PreviewPerfRecorder {
  private readonly ranges: Range[];
  private readonly perClip = new Map<string, Counts>();
  private readonly total = empty();
  private last: number | null = null;
  private lastAt = 0;
  private freezeFrame: number | null = null;
  private stallStart: number | null = null;
  private stallFrame = 0;
  private sinceSample = 0;
  private sampledFor = "";
  private tabHidden = false;

  constructor(
    private readonly meta: { slug: string; variant: string; revision: number; fps: number; layers: StudioLayers; source: PreviewPerfReport["source"] },
    private readonly root: () => Element | null,
  ) {
    this.ranges = visualRanges(meta.layers);
  }

  private at(frame: number) {
    return this.ranges.filter((r) => frame >= r.from && frame < r.to);
  }

  private counts(id: string) {
    let c = this.perClip.get(id);
    if (!c) this.perClip.set(id, (c = empty()));
    return c;
  }

  /** A frame the player showed while playing. Seeks and pauses call reset() first. */
  frame(frame: number) {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") this.tabHidden = true;
    const now = performance.now();
    const last = this.last;
    this.last = frame;
    // First frame of a run, or a loop back to the start: nothing to compare with.
    if (last === null || frame <= last) {
      this.lastAt = now;
      this.played(frame);
      return;
    }
    // However far it jumped: a long freeze is the worst kind of dropped frames.
    for (let f = last + 1; f < frame; f += 1) {
      this.total.dropped += 1;
      for (const r of this.at(f)) this.counts(r.id).dropped += 1;
    }
    const held = now - this.lastAt;
    this.lastAt = now;
    if (held > this.total.freezeMs) {
      this.total.freezeMs = held;
      this.freezeFrame = frame;
    }
    for (const r of this.at(last)) {
      const c = this.counts(r.id);
      c.freezeMs = Math.max(c.freezeMs, held);
    }
    this.played(frame);
  }

  private played(frame: number) {
    this.total.played += 1;
    const active = this.at(frame);
    for (const r of active) this.counts(r.id).played += 1;
    this.sinceSample += 1;
    // Sample the element count every few frames and on entering a new clip (short clips count too).
    const key = active.map((r) => r.id).join(",");
    if (this.sinceSample >= ELEMENT_SAMPLE_EVERY || key !== this.sampledFor) {
      this.sampledFor = key;
      this.sinceSample = 0;
      const elements = this.root()?.querySelectorAll("*").length ?? 0;
      this.total.maxElements = Math.max(this.total.maxElements, elements);
      for (const r of active) {
        const c = this.counts(r.id);
        c.maxElements = Math.max(c.maxElements, elements);
      }
    }
  }

  /** Playback stopped or the user seeked: the next frame starts a new run. */
  reset() {
    this.last = null;
    this.resume();
  }

  waiting(frame: number) {
    if (this.stallStart !== null) return;
    this.stallStart = performance.now();
    this.stallFrame = frame;
  }

  resume() {
    if (this.stallStart === null) return;
    const ms = performance.now() - this.stallStart;
    this.stallStart = null;
    this.total.stalls += 1;
    this.total.stallMs += ms;
    for (const r of this.at(this.stallFrame)) {
      const c = this.counts(r.id);
      c.stalls += 1;
      c.stallMs += ms;
    }
    // Time spent loading isn't dropped frames.
    this.last = null;
  }

  get framesPlayed() {
    return this.total.played;
  }

  report(): PreviewPerfReport {
    const rate = (c: Counts) => (c.played + c.dropped ? c.dropped / (c.played + c.dropped) : 0);
    const clips = this.ranges
      .filter((r) => {
        const c = this.perClip.get(r.id);
        return c !== undefined && c.played + c.dropped > 0;
      })
      .map((r): PreviewPerfClip => {
        const c = this.perClip.get(r.id)!;
        const dropRate = rate(c);
        return {
          ...r,
          framesPlayed: c.played,
          framesDropped: c.dropped,
          dropRate: Math.round(dropRate * 1000) / 1000,
          stalls: c.stalls,
          stallMs: Math.round(c.stallMs),
          longestFreezeMs: Math.round(c.freezeMs),
          maxElements: c.maxElements,
          verdict: verdictFor(dropRate, c.played),
        };
      });
    const dropRate = rate(this.total);
    return {
      slug: this.meta.slug,
      variant: this.meta.variant,
      revision: this.meta.revision,
      fps: this.meta.fps,
      source: this.meta.source,
      framesPlayed: this.total.played,
      framesDropped: this.total.dropped,
      dropRate: Math.round(dropRate * 1000) / 1000,
      stalls: this.total.stalls,
      stallMs: Math.round(this.total.stallMs),
      longestFreezeMs: Math.round(this.total.freezeMs),
      longestFreezeFrame: this.freezeFrame,
      maxElements: this.total.maxElements,
      tabHidden: this.tabHidden,
      clips,
    };
  }
}

/** The clips that don't play smoothly, worst first. */
export function slowClips(report: PreviewPerfReport | null) {
  if (!report) return [];
  return report.clips
    .filter((c) => c.verdict === "choppy" || c.verdict === "heavy" || c.stallMs > 500 || c.longestFreezeMs > 1000)
    .sort((a, b) => b.dropRate - a.dropRate || b.stallMs - a.stallMs);
}

/** The latest report for the open project and whether a check is playing, for the page and the agent. */
export interface PreviewPerfStore {
  get(): { report: PreviewPerfReport | null; checking: boolean };
  setReport(report: PreviewPerfReport | null): void;
  setChecking(checking: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createPreviewPerfStore(): PreviewPerfStore {
  let state: { report: PreviewPerfReport | null; checking: boolean } = { report: null, checking: false };
  const listeners = new Set<() => void>();
  const emit = (next: typeof state) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    setReport: (report) => emit({ ...state, report }),
    setChecking: (checking) => {
      if (checking !== state.checking) emit({ ...state, checking });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function usePreviewPerf(store: PreviewPerfStore) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
