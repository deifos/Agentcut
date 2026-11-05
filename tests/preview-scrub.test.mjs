import assert from "node:assert/strict";
import test from "node:test";
import { parseProbe, proxyArgs, proxySkipReason } from "../packages/agentcut/src/studio/proxies.ts";
import { Scrubber, seekAndWait, trackPlayerBuffering, warmOrder } from "../lib/studio/scrub.ts";
import { ScrubRecorder, slowScrubClips } from "../lib/studio/preview-perf.ts";

globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 1);

function fakePlayer({ decodeMs = 0 } = {}) {
  const listeners = { waiting: new Set(), resume: new Set() };
  const player = {
    seeks: [],
    playing: false,
    played: 0,
    isPlaying: () => player.playing,
    pause: () => {
      player.playing = false;
    },
    play: () => {
      player.played += 1;
      player.playing = true;
    },
    addEventListener: (name, fn) => listeners[name]?.add(fn),
    removeEventListener: (name, fn) => listeners[name]?.delete(fn),
    seekTo(frame) {
      player.seeks.push(frame);
      if (!decodeMs) return;
      for (const fn of listeners.waiting) fn({});
      setTimeout(() => {
        for (const fn of listeners.resume) fn({});
      }, decodeMs);
    },
  };
  return player;
}

function fakeStore() {
  let frame = 0;
  return {
    scrubbing: false,
    get: () => frame,
    set: (next) => {
      frame = next;
    },
    subscribe: () => () => undefined,
  };
}

const idle = () => new Promise((resolve) => setTimeout(resolve, 150));

test("the final seek keeps its picture and stays paused beyond the drag timeout", async () => {
  const player = fakePlayer({ decodeMs: 1300 });
  player.playing = true;
  let hidden = 0;
  let settled = 0;
  const frameStore = fakeStore();
  const scrubber = new Scrubber({
    getPlayer: () => player, frameStore,
    frames: { show: () => true, hide: () => hidden++ },
    onSettled: () => settled++,
  });
  scrubber.begin();
  scrubber.to(42);
  scrubber.end();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(hidden, 0);
  assert.equal(settled, 0);
  assert.equal(player.played, 0);
  assert.equal(frameStore.scrubbing, true);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(hidden, 1);
  assert.equal(settled, 1);
  assert.equal(player.played, 1);
});

test("a new drag cancels an unfinished final seek and can settle elsewhere", async () => {
  const player = fakePlayer({ decodeMs: 100 });
  player.playing = true;
  const frameStore = fakeStore();
  let settled = 0;
  const scrubber = new Scrubber({ getPlayer: () => player, frameStore,
    frames: { show: () => true, hide() {} }, onSettled: () => settled++ });
  scrubber.begin();
  scrubber.to(10);
  scrubber.end();
  scrubber.begin();
  scrubber.to(20);
  scrubber.end();
  await idle();
  assert.equal(player.seeks.at(-1), 20);
  assert.equal(settled, 1);
  assert.equal(player.played, 1);
});

test("cancelling a preview prevents its pending seek from resuming playback", async () => {
  const player = fakePlayer({ decodeMs: 80 });
  player.playing = true;
  const frameStore = fakeStore();
  let settled = 0;
  const scrubber = new Scrubber({ getPlayer: () => player, frameStore, onSettled: () => settled++ });
  scrubber.begin();
  scrubber.to(10);
  scrubber.end();
  scrubber.cancel();
  await idle();
  assert.equal(player.played, 0);
  assert.equal(settled, 0);
  assert.equal(frameStore.scrubbing, false);
});

test("a seek already buffering waits for resume instead of assuming it painted", async () => {
  const player = fakePlayer({ decodeMs: 80 });
  trackPlayerBuffering(player);
  player.seekTo(5);
  // Seeking the same frame produces no new buffering transition.
  player.seekTo = () => {};
  let done = false;
  const waiting = seekAndWait(player, 5).then(() => { done = true; });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(done, false);
  await waiting;
  assert.equal(done, true);
});

test("a seek waits for media to decode before it counts as on screen", async () => {
  const fast = await seekAndWait(fakePlayer(), 1);
  const slow = await seekAndWait(fakePlayer({ decodeMs: 80 }), 1);
  assert.ok(slow >= 75 && slow > fast, `fast ${fast}, slow ${slow}`);
});

test("a seek that never finishes gives up", async () => {
  const player = fakePlayer({ decodeMs: 10_000 });
  const ms = await seekAndWait(player, 1, 40);
  assert.ok(ms < 1000, `waited ${ms}`);
});

test("a drag skips frames it can't get to, and lands on the exact last one", async () => {
  const player = fakePlayer({ decodeMs: 20 });
  const frameStore = fakeStore();
  let onSettled;
  const settled = new Promise(resolve => { onSettled = resolve; });
  const scrubber = new Scrubber({ getPlayer: () => player, frameStore, onSettled });
  scrubber.begin();
  assert.equal(frameStore.scrubbing, true);
  for (let frame = 1; frame <= 50; frame += 1) {
    scrubber.to(frame);
    // The playhead follows the pointer even while a frame is drawing.
    assert.equal(frameStore.get(), frame);
  }
  scrubber.end();
  await settled;
  assert.equal(player.seeks.at(-1), 50);
  assert.ok(player.seeks.length <= 3, `drew ${player.seeks.length} of 50`);
  assert.equal(frameStore.scrubbing, false);
});

test("playback carries on after a drag only if it was playing", async () => {
  const player = fakePlayer();
  player.playing = true;
  let onSettled;
  const settled = new Promise(resolve => { onSettled = resolve; });
  const scrubber = new Scrubber({ getPlayer: () => player, frameStore: fakeStore(), onSettled });
  scrubber.begin();
  assert.equal(player.isPlaying(), false);
  scrubber.to(5);
  scrubber.end();
  await settled;
  assert.equal(player.played, 1);

  const paused = fakePlayer();
  const again = new Scrubber({ getPlayer: () => paused, frameStore: fakeStore() });
  again.begin();
  again.to(5);
  again.end();
  await idle();
  assert.equal(paused.played, 0);
});

test("a drag uses ready pictures, but letting go always draws the real frame", async () => {
  const player = fakePlayer();
  const shown = [];
  let hidden = 0;
  const frames = {
    show(frame) {
      shown.push(frame);
      return true;
    },
    hide() {
      hidden += 1;
    },
  };
  const scrubber = new Scrubber({ getPlayer: () => player, frameStore: fakeStore(), frames });
  scrubber.begin();
  scrubber.to(10);
  await idle();
  assert.deepEqual(player.seeks, []);
  assert.deepEqual(shown, [10]);
  scrubber.end();
  await idle();
  assert.deepEqual(player.seeks, [10]);
  assert.equal(hidden, 1);
});

test("seek timings are blamed on the clips under them", () => {
  const layers = {
    tracks: [
      {
        id: "t",
        name: "Scenes",
        kind: "scene",
        clips: [
          { id: "light", scene: "light", from: 0, duration: 30 },
          { id: "heavy", scene: "heavy", from: 30, duration: 30 },
        ],
      },
    ],
  };
  const recorder = new ScrubRecorder({ slug: "s", variant: "v", revision: 1, layers, source: "drag" });
  for (let i = 0; i < 10; i += 1) {
    recorder.seek(i, 20);
    recorder.seek(30 + i, 400);
  }
  const stats = recorder.stats();
  assert.equal(stats.seeks, 20);
  assert.equal(stats.clips.find((c) => c.id === "light").p95Ms, 20);
  assert.equal(stats.clips.find((c) => c.id === "heavy").medianMs, 400);
  assert.deepEqual(slowScrubClips(stats, 35).map((c) => c.id), ["heavy"]);
  assert.deepEqual(slowScrubClips(stats, 5), []);
});

test("pictures fill in outward from the playhead, inside the clip", () => {
  assert.deepEqual(warmOrder(30, 0, 60, 10), [30, 20, 40, 10, 50, 0]);
  assert.deepEqual(warmOrder(0, 0, 25, 10), [0, 10, 20]);
  // A clip that starts off the step grid stays on its own grid.
  assert.deepEqual(warmOrder(100, 103, 125, 10), [103, 113, 123]);
  assert.ok(warmOrder(5000, 0, 100_000, 1).length <= 96);
});

const CAMERA = `Input #0, mov,mp4,m4a, from 'a.mp4':
  Duration: 00:01:02.50, start: 0.000000, bitrate: 40000 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 3840x2160 [SAR 1:1 DAR 16:9], 39000 kb/s, 30 fps
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706d), 48000 Hz, stereo, fltp, 192 kb/s`;

test("ffmpeg's description of a file is read correctly", () => {
  assert.deepEqual(parseProbe(CAMERA), {
    durationSeconds: 62.5,
    width: 3840,
    height: 2160,
    pixelFormat: "yuv420p",
    unsafe: false,
  });
  assert.equal(parseProbe("Stream #0:0: Audio: aac"), null);
  assert.equal(parseProbe("Duration: 00:00:05.00\n  Stream #0:0: Video: prores (4444), yuva444p10le(bt709), 1920x1080, 25 fps").unsafe, true);
  assert.equal(parseProbe("Duration: 00:00:05.00\n  Stream #0:0: Video: hevc (Main 10), yuv420p10le(tv, bt2020nc/bt2020/smpte2084), 3840x2160, 25 fps").unsafe, true);
  assert.equal(parseProbe("Metadata:\n alpha_mode : 1\nDuration: 00:00:05.00\n  Stream #0:0: Video: vp9, yuv420p(tv), 1920x1080, 25 fps").unsafe, true);
});

test("only footage that's slow to seek gets a copy", () => {
  const base = { durationSeconds: 60, width: 1920, height: 1080, pixelFormat: "yuv420p", unsafe: false };
  // A keyframe every 2 seconds.
  assert.equal(proxySkipReason(base, 30), null);
  // A keyframe every 0.25 seconds.
  assert.match(proxySkipReason(base, 240), /already seeks/);
  // Bigger than the preview needs, whatever its keyframes.
  assert.equal(proxySkipReason({ ...base, width: 3840, height: 2160 }, 240), null);
  assert.match(proxySkipReason({ ...base, durationSeconds: 1 }, 1), /too short/);
  assert.match(proxySkipReason({ ...base, unsafe: true }, 30), /HDR/);
});

test("copies have frequent keyframes and no reordered frames, and can't read other files", () => {
  const args = proxyArgs("in.mp4", "out.mp4", 4);
  const value = (flag) => args[args.indexOf(flag) + 1];
  assert.equal(value("-g"), "8");
  assert.equal(value("-bf"), "0");
  assert.equal(value("-fps_mode"), "passthrough");
  assert.ok(args.indexOf("-format_whitelist") < args.indexOf("-i"));
  assert.equal(args.at(-1), "out.mp4");
});
