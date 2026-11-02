// Dragging the playhead. Only the frame under the pointer gets drawn: a new position replaces the one
// still waiting, and the last finished picture stays on screen until the next one is ready, so a slow
// frame costs a late update instead of a growing queue. The playhead itself follows the pointer at once.
// Preview only: exports never come through here.
import type { PlayerRef } from "@remotion/player";
import type { FrameStore } from "@/lib/studio/frame-store";

/** How long a drag waits for a slow frame before moving on to where the pointer is now. */
const DRAG_WAIT_MS = 1000;

type SeekPlayer = Pick<PlayerRef, "seekTo" | "addEventListener" | "removeEventListener">;
const bufferingPlayers = new WeakMap<SeekPlayer, { buffering: boolean }>();

/** Observe from mount, so a seek also knows about buffering that started before it subscribed. */
export function trackPlayerBuffering(player: SeekPlayer) {
  let state = bufferingPlayers.get(player);
  if (!state) {
    const observed = { buffering: false };
    bufferingPlayers.set(player, observed);
    // These listeners live with the player. The WeakMap does not retain unmounted players.
    player.addEventListener("waiting", () => { observed.buffering = true; });
    player.addEventListener("resume", () => { observed.buffering = false; });
    player.addEventListener("error", () => { observed.buffering = false; });
    state = observed;
  }
  return state;
}

/**
 * Seek and resolve once the frame is on screen, with how long that took: two animation frames for
 * React to commit and paint, and longer if media under it had to load or decode (`waiting` → `resume`).
 */
export function seekAndWait(player: SeekPlayer, frame: number, maxMs = DRAG_WAIT_MS) {
  return waitForSeek(player, frame, maxMs).then((result) => result.ms);
}

function waitForSeek(player: SeekPlayer, frame: number, maxMs: number | null, signal?: AbortSignal) {
  const start = performance.now();
  return new Promise<{ ms: number; drawn: boolean }>((resolve) => {
    const state = trackPlayerBuffering(player);
    let buffering = state.buffering;
    let painted = false;
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (drawn: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      player.removeEventListener("waiting", onWaiting);
      player.removeEventListener("resume", onResume);
      player.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
      resolve({ ms: performance.now() - start, drawn });
    };
    const onAbort = () => finish(false);
    const onError = () => finish(false);
    const finishPaint = () => {
      if (!buffering && !state.buffering) finish(true);
    };
    const onWaiting = () => {
      buffering = true;
    };
    const onResume = () => {
      buffering = false;
      if (painted) requestAnimationFrame(finishPaint);
    };
    // Animation frames stop in a hidden tab: the timer ends the wait there too.
    if (maxMs !== null) timer = setTimeout(() => finish(false), maxMs);
    player.addEventListener("waiting", onWaiting);
    player.addEventListener("resume", onResume);
    player.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) { finish(false); return; }
    player.seekTo(frame);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        painted = true;
        finishPaint();
      }),
    );
  });
}

/** Ready-made pictures to show during a drag instead of drawing the frame (lib/studio/scrub-cache.ts). */
export interface ScrubFrames {
  show(frame: number): boolean;
  hide(): void;
}

/** About 160 MB of pictures at 16:9. */
export const MAX_PICTURES = 96;

/** Frames in `from..to` (exclusive) at this step, nearest to `around` first. */
export function warmOrder(around: number, from: number, to: number, step: number) {
  const frames: number[] = [];
  const start = from + Math.ceil(Math.max(0, around - from) / step) * step;
  for (let distance = 0; frames.length < MAX_PICTURES; distance += 1) {
    const later = start + distance * step;
    const earlier = start - (distance + 1) * step;
    if (later >= to && earlier < from) break;
    if (later < to) frames.push(later);
    if (earlier >= from) frames.push(earlier);
  }
  return frames.slice(0, MAX_PICTURES);
}

type ScrubPlayer = SeekPlayer & Pick<PlayerRef, "isPlaying" | "pause" | "play">;

export class Scrubber {
  private dragging = false;
  private settling = false;
  private seeking = false;
  private resume = false;
  private target: number | null = null;
  private wait: AbortController | null = null;

  constructor(
    private readonly options: {
      getPlayer(): ScrubPlayer | null;
      frameStore: FrameStore;
      frames?: ScrubFrames;
      /** A frame the drag drew itself, and how long it took. */
      onFrameDrawn?(frame: number, ms: number): void;
      /** A frame shown from `frames`. */
      onFrameShown?(frame: number): void;
      /** The drag is over and the exact frame is on screen. */
      onSettled?(): void;
    },
  ) {}

  get active() {
    return this.dragging;
  }

  begin() {
    if (this.dragging) return;
    this.dragging = true;
    this.options.frameStore.scrubbing = true;
    const player = this.options.getPlayer();
    // A drag that starts while the last one settles keeps that one's play state.
    if (!this.settling) this.resume = player?.isPlaying() ?? false;
    this.settling = false;
    this.wait?.abort();
    player?.pause();
  }

  to(frame: number) {
    this.options.frameStore.set(frame);
    this.target = frame;
    void this.pump();
  }

  /** The exact frame is drawn before anything else happens, then playback carries on if it was playing. */
  end() {
    if (!this.dragging) return;
    this.dragging = false;
    this.settling = true;
    this.target = this.options.frameStore.get();
    void this.pump();
  }

  /** A new project, bundle, or unmounted preview must not finish an old seek. */
  cancel() {
    this.dragging = false;
    this.settling = false;
    this.resume = false;
    this.target = null;
    this.wait?.abort();
    this.options.frameStore.scrubbing = false;
    this.options.frames?.hide();
  }

  private async pump() {
    if (this.seeking) return;
    this.seeking = true;
    const { getPlayer, frames, onFrameDrawn, onFrameShown } = this.options;
    try {
      while (this.target !== null) {
        const frame = this.target;
        this.target = null;
        const player = getPlayer();
        if (!player) { this.cancel(); break; }
        if (this.dragging && frames?.show(frame)) {
          onFrameShown?.(frame);
          continue;
        }
        const waiting = new AbortController();
        this.wait = waiting;
        // Drag seeks may be skipped. The final seek must actually finish before playback resumes.
        const result = await waitForSeek(player, frame, this.dragging ? DRAG_WAIT_MS : null, waiting.signal);
        this.wait = null;
        if (waiting.signal.aborted) continue;
        if (!result.drawn) {
          if (this.settling && this.target === null) this.cancel();
          continue;
        }
        onFrameDrawn?.(frame, result.ms);
        // The player has caught up: a ready-made picture is no longer in front of it.
        if (this.target === null) frames?.hide();
      }
    } finally {
      this.seeking = false;
    }
    if (this.settling) {
      this.settling = false;
      this.options.frameStore.scrubbing = false;
      if (this.resume) getPlayer()?.play();
      this.options.onSettled?.();
    }
  }
}
