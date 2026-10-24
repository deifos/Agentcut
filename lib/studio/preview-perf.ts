// Preview smoothness. The Player is time-based: when a frame takes too long to draw it skips ahead,
// so gaps between `frameupdate` events are dropped frames, and `waiting` → `resume` is a stall
// (media still loading). Both are counted per visual clip, with the elements each clip draws, so the
// agent can tell which scene is too heavy to play live. Preview only: exports render every frame at
// full quality whatever this says.
import { useSyncExternalStore } from "react";
import type { StudioLayers } from "@/lib/studio/types";

const ELEMENT_SAMPLE_EVERY = 15;
/** A clip needs this many frames played before it gets a verdict. */
const MIN_FRAMES = 10;
/** Fewer dropped frames than this never makes a clip slow, whatever the rate (short clips). */
const MIN_DROPPED = 6;
/**
 * Light scenes drop up to ~12 % to timer jitter on a busy machine or an embedded browser; only flag
 * what a viewer sees.
 */
const CHOPPY = 0.2;
const HEAVY = 0.4;
/** Clips mount this long before they start in the preview (runtime `PREMOUNT_SECONDS`). */
const PREMOUNT_SECONDS = 1;
/** The runtime tags each visual clip's wrapper with this class + the clip id (runtime `clipClass`). */
const CLIP_CLASS = "ac-clip--";

export type PreviewVerdict = "smooth" | "choppy" | "heavy";

export interface PreviewPerfClip {
  id: string;
  /** Scene or component name, else the clip's name or id. */
  label: string;
  track: string;
  kind: string;
  from: number;
  to: number;
  framesPlayed: number;
  framesDropped: number;
  dropRate: number;
  stalls: number;
  stallMs: number;
  /** The longest time one frame stayed on screen while playing (a freeze). */
  longestFreezeMs: number;
  /** The most elements this clip drew at once (the whole player's on an older runtime). */
  maxElements: number;
  /** Other clips on screen at the same time: they share these drops. */
  overlaps: string[];
  /** Drops while a later clip was mounting early: that clip's setup cost, left out of the verdict. */
  droppedWhileOthersMount: number;
  /** Drops in the second before this clip starts, while it mounts early: its own setup cost. */
  mountDropped: number;
  mountFrames: number;
  verdict: PreviewVerdict | null;
}

export interface PreviewPerfReport {
  slug: string;
  variant: string;
  revision: number;
  fps: number;
  /** "playback": the user's own playback; "check": agentcut_preview_check. */
  source: "playback" | "check";
  /** Date.now() when the numbers were taken. */
  at: number;
  framesPlayed: number;
  framesDropped: number;
  dropRate: number;
  stalls: number;
  stallMs: number;
  longestFreezeMs: number;
  /** Where the longest freeze ended. */
  longestFreezeFrame: number | null;
  maxElements: number;
  /** The tab was hidden for part of it; those frames aren't counted (the browser throttles hidden tabs). */
  tabHidden: boolean;
  clips: PreviewPerfClip[];
}

interface Range {
  id: string;
  label: string;
  track: string;
  kind: string;
  from: number;
  to: number;
}

function visualRanges(layers: StudioLayers): Range[] {
  const ranges: Range[] = [];
  for (const track of layers.tracks) {
    if (track.kind === "audio" || track.hidden) continue;
    for (const clip of track.clips) {
      const c = clip as { id: string; name?: string; scene?: string; component?: string; from: number; duration: number };
      if (c.duration <= 0) continue;
      ranges.push({
        id: c.id,
        label: c.scene ?? c.component ?? c.name ?? c.id,
        track: track.name || track.kind,
        kind: track.kind,
        from: c.from,
        to: c.from + c.duration,
      });
    }
  }
  return ranges;
}

export function verdictFor(dropRate: number, framesPlayed: number, framesDropped: number): PreviewVerdict | null {
  if (framesPlayed < MIN_FRAMES) return null;
  if (framesDropped < MIN_DROPPED) return "smooth";
  if (dropRate >= HEAVY) return "heavy";
  if (dropRate >= CHOPPY) return "choppy";
  return "smooth";
}

interface Counts {
  stalls: number;
  stallMs: number;
  freezeMs: number;
  /** The most elements the clip drew, mounted early or on screen. */
  maxElements: number;
}

const empty = (): Counts => ({ stalls: 0, stallMs: 0, freezeMs: 0, maxElements: 0 });

const rate = (dropped: number, played: number) => (played + dropped ? dropped / (played + dropped) : 0);
const round = (n: number) => Math.round(n * 1000) / 1000;

export class PreviewPerfRecorder {
  private readonly ranges: Range[];
  private readonly premount: number;
  private readonly perClip = new Map<string, Counts>();
  /** Frames shown and skipped, per frame: blame is worked out in report(), once element counts are known. */
  private readonly playedAt: Uint32Array;
  private readonly droppedAt: Uint32Array;
  private readonly total = { played: 0, dropped: 0, stalls: 0, stallMs: 0, freezeMs: 0, maxElements: 0 };
  private last: number | null = null;
  private lastAt = 0;
  private freezeFrame: number | null = null;
  private stallStart: number | null = null;
  private stallFrame = 0;
  private sinceSample = 0;
  private sampledFor = "";
  private tabHidden = false;

  constructor(
    private readonly meta: {
      slug: string;
      variant: string;
      revision: number;
      fps: number;
      layers: StudioLayers;
      source: PreviewPerfReport["source"];
      /** The last frame playback reaches before it loops (frames skipped before it count as dropped). */
      lastFrame: number;
    },
    private readonly root: () => Element | null,
  ) {
    this.ranges = visualRanges(meta.layers);
    this.premount = Math.round(meta.fps * PREMOUNT_SECONDS);
    this.playedAt = new Uint32Array(meta.lastFrame + 1);
    this.droppedAt = new Uint32Array(meta.lastFrame + 1);
  }

  private at(frame: number) {
    return this.ranges.filter((r) => frame >= r.from && frame < r.to);
  }

  /** Clips mounted early (hidden) at this frame. */
  private mounting(frame: number) {
    return this.ranges.filter((r) => r.from > 0 && frame >= r.from - this.premount && frame < r.from);
  }

  private counts(id: string) {
    let c = this.perClip.get(id);
    if (!c) this.perClip.set(id, (c = empty()));
    return c;
  }

  /** One frame shown (`dropped` false) or skipped. */
  private tally(frame: number, dropped: boolean) {
    if (frame < 0 || frame > this.meta.lastFrame) return;
    if (dropped) {
      this.total.dropped += 1;
      this.droppedAt[frame] += 1;
    } else {
      this.total.played += 1;
      this.playedAt[frame] += 1;
    }
  }

  private skipped(from: number, to: number) {
    for (let f = from; f <= to; f += 1) this.tally(f, true);
  }

  /** A frame the player showed while playing. Seeks and pauses call reset() first. */
  frame(frame: number) {
    // A hidden tab plays on a slow timer: those jumps aren't the scene's fault, so don't count them.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      this.tabHidden = true;
      this.last = null;
      return;
    }
    const now = performance.now();
    const last = this.last;
    if (last !== null && frame === last) return;
    this.last = frame;
    // First frame of a run: nothing to compare with.
    if (last === null) {
      this.lastAt = now;
      this.played(frame);
      return;
    }
    // Looped back to the start (seeks reset first): the frames it skipped before the end were dropped.
    if (frame < last) {
      this.skipped(last + 1, this.meta.lastFrame);
      this.lastAt = now;
      this.played(frame);
      return;
    }
    // However far it jumped: a long freeze is the worst kind of dropped frames.
    this.skipped(last + 1, frame - 1);
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

  /** Playback stopped past `upTo` (the end of a checked range): count what it skipped up to there. */
  finish(upTo: number) {
    if (this.last !== null && this.last < upTo) this.skipped(this.last + 1, upTo);
    this.last = null;
  }

  private played(frame: number) {
    this.tally(frame, false);
    this.sinceSample += 1;
    // Sample element counts every few frames and whenever the clips change (short clips count too).
    const present = [...this.at(frame), ...this.mounting(frame)];
    const key = present.map((r) => r.id).join(",");
    if (this.sinceSample >= ELEMENT_SAMPLE_EVERY || key !== this.sampledFor) {
      this.sampledFor = key;
      this.sinceSample = 0;
      this.sampleElements(present);
    }
  }

  private sampleElements(present: Range[]) {
    const root = this.root();
    if (!root) return;
    const total = root.getElementsByTagName("*").length;
    this.total.maxElements = Math.max(this.total.maxElements, total);
    let tagged = false;
    const own = new Map<string, number>();
    for (const r of present) {
      const wrappers = root.getElementsByClassName(clipClass(r.id));
      if (!wrappers.length) continue;
      tagged = true;
      let n = 0;
      for (const wrapper of Array.from(wrappers)) n += 1 + wrapper.getElementsByTagName("*").length;
      own.set(r.id, n);
    }
    for (const r of present) {
      const c = this.counts(r.id);
      // An older runtime doesn't tag clip wrappers: fall back to the whole player.
      c.maxElements = Math.max(c.maxElements, tagged ? (own.get(r.id) ?? 0) : total);
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
    const elements = (r: Range) => this.perClip.get(r.id)?.maxElements ?? 0;
    const end = this.meta.lastFrame + 1;
    // Who mounts early on each frame (a clip mounts in the second before it starts).
    const mountersAt = new Map<number, Range[]>();
    for (const r of this.ranges) {
      if (r.from <= 0) continue;
      for (let f = Math.max(0, r.from - this.premount); f < Math.min(r.from, end); f += 1) {
        mountersAt.set(f, [...(mountersAt.get(f) ?? []), r]);
      }
    }
    const clips: PreviewPerfClip[] = [];
    for (const r of this.ranges) {
      let played = 0;
      let dropped = 0;
      let sharedPlayed = 0;
      let sharedDropped = 0;
      for (let f = r.from; f < Math.min(r.to, end); f += 1) {
        // A heavier clip mounting early costs these frames, not this clip: kept out of its verdict.
        if ((mountersAt.get(f) ?? []).some((m) => m.id !== r.id && elements(m) > elements(r))) {
          sharedPlayed += this.playedAt[f];
          sharedDropped += this.droppedAt[f];
        } else {
          played += this.playedAt[f];
          dropped += this.droppedAt[f];
        }
      }
      // Its own early mount: the second before it starts, where it draws more than what's on screen.
      let mountPlayed = 0;
      let mountDropped = 0;
      if (r.from > 0) {
        for (let f = Math.max(0, r.from - this.premount); f < Math.min(r.from, end); f += 1) {
          if (this.at(f).every((a) => elements(a) < elements(r))) {
            mountPlayed += this.playedAt[f];
            mountDropped += this.droppedAt[f];
          }
        }
      }
      if (played + dropped + sharedPlayed + sharedDropped + mountPlayed + mountDropped === 0) continue;
      const c = this.counts(r.id);
      const dropRate = rate(dropped, played);
      clips.push({
        ...r,
        framesPlayed: played + sharedPlayed,
        framesDropped: dropped + sharedDropped,
        dropRate: round(dropRate),
        stalls: c.stalls,
        stallMs: Math.round(c.stallMs),
        longestFreezeMs: Math.round(c.freezeMs),
        maxElements: c.maxElements,
        overlaps: [],
        droppedWhileOthersMount: sharedDropped,
        mountDropped,
        mountFrames: mountPlayed + mountDropped,
        verdict: verdictFor(dropRate, played, dropped),
      });
    }
    for (const clip of clips) {
      clip.overlaps = clips
        .filter((o) => o.id !== clip.id && o.from < clip.to && clip.from < o.to)
        .map((o) => o.label);
    }
    return {
      slug: this.meta.slug,
      variant: this.meta.variant,
      revision: this.meta.revision,
      fps: this.meta.fps,
      source: this.meta.source,
      at: Date.now(),
      framesPlayed: this.total.played,
      framesDropped: this.total.dropped,
      dropRate: round(rate(this.total.dropped, this.total.played)),
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

/** The class the runtime puts on a visual clip's wrapper (keep in sync with the runtime's `clipClass`). */
export function clipClass(id: string) {
  return `${CLIP_CLASS}${id.replace(/\s+/g, "_")}`;
}

/** Its own mount (the second before it starts) drops frames. */
function slowToMount(c: PreviewPerfClip) {
  const played = c.mountFrames - c.mountDropped;
  const verdict = verdictFor(rate(c.mountDropped, played), played, c.mountDropped);
  return verdict === "choppy" || verdict === "heavy";
}

function isSlow(c: PreviewPerfClip) {
  return c.verdict === "choppy" || c.verdict === "heavy" || c.stallMs > 500 || c.longestFreezeMs > 1000 || slowToMount(c);
}

const SEVERITY: Record<string, number> = { heavy: 0, choppy: 1 };
// Scenes and footage do the drawing; text and captions on top of them only share their drops.
const KIND_RANK: Record<string, number> = { scene: 0, video: 1, image: 2, captions: 3, text: 4 };

/**
 * The clips that don't play smoothly, likeliest cause first: the worst verdict, then of clips on
 * screen together the one drawing the most elements. `cause: false` marks a clip that only shares another slow clip's drops.
 */
export function slowClips(report: PreviewPerfReport | null) {
  if (!report) return [];
  const slow = report.clips
    .filter(isSlow)
    .sort(
      (a, b) =>
        (SEVERITY[a.verdict ?? ""] ?? 2) - (SEVERITY[b.verdict ?? ""] ?? 2) ||
        b.maxElements - a.maxElements ||
        (KIND_RANK[a.kind] ?? 5) - (KIND_RANK[b.kind] ?? 5) ||
        b.dropRate - a.dropRate ||
        b.stallMs - a.stallMs,
    );
  const causes: PreviewPerfClip[] = [];
  return slow.map((clip) => {
    const covered = causes.some((c) => c.from <= clip.from && clip.to <= c.to);
    if (!covered) causes.push(clip);
    return { ...clip, cause: !covered, slowToMount: slowToMount(clip) };
  });
}

/** The newer of the latest check and the user's playback for what's on screen now. */
export function currentReport(
  state: PreviewPerfState,
  slug: string,
  revision: number,
  variant: string,
): PreviewPerfReport | null {
  const matches = [state.check, state.playback].filter(
    (r): r is PreviewPerfReport => !!r && r.slug === slug && r.revision === revision && r.variant === variant,
  );
  return matches.sort((a, b) => b.at - a.at)[0] ?? null;
}

export interface PreviewPerfState {
  /** The latest agentcut_preview_check. */
  check: PreviewPerfReport | null;
  /** The user's own playback. Kept apart so a few seconds of playing elsewhere don't hide a check. */
  playback: PreviewPerfReport | null;
  checking: boolean;
}

/** The latest reports for the open project and whether a check is playing, for the page and the agent. */
export interface PreviewPerfStore {
  get(): PreviewPerfState;
  setReport(report: PreviewPerfReport): void;
  setChecking(checking: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createPreviewPerfStore(): PreviewPerfStore {
  let state: PreviewPerfState = { check: null, playback: null, checking: false };
  const listeners = new Set<() => void>();
  const emit = (next: PreviewPerfState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    setReport: (report) => emit({ ...state, [report.source]: report }),
    setChecking: (checking) => {
      if (checking !== state.checking) emit({ ...state, checking });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A value derived from the store; re-renders only when it changes (keep it a string, number or boolean). */
export function usePreviewPerf<T extends string | number | boolean | null>(
  store: PreviewPerfStore,
  select: (state: PreviewPerfState) => T,
) {
  const snapshot = () => select(store.get());
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}
