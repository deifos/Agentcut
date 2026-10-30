import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { audioPeaks } from "../lib/studio/audio/peaks.ts";
import {
  decodeAudioUrl,
  forgetDecodedAudio,
} from "../lib/studio/audio/decode.ts";
import { cachedVideoFrame, videoFrame } from "../lib/studio/video-frames.ts";

test("visible video tiles retain cache hits and discard images from a replaced source", async () => {
  const result = await build({
    entryPoints: ["components/studio/timeline-thumbs.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "subject",
    plugins: [
      {
        name: "preview-dependencies",
        setup(b) {
          const mocks = {
            react:
              "export const { createContext, useContext, useMemo, useState, useEffect } = globalThis.hooks;",
            "react/jsx-runtime":
              "export const jsx = (type, props) => ({ type, props }); export const jsxs = jsx;",
            "@/lib/studio/video-frames":
              "export const { cachedVideoFrame, videoFrame } = globalThis.frames;",
            "@/lib/studio/scene-stills": "export const sceneStill = () => {};",
            "@/lib/studio/composition-props":
              "export const buildInputProps = () => {}; export const variantSize = () => {};",
            "@/lib/studio/bundle":
              "export const studioFileUrl = (slug, path) => slug + '/' + path;",
          };
          b.onResolve({ filter: /.*/ }, ({ path }) =>
            path in mocks ? { path, namespace: "mock" } : null,
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({
            contents: mocks[path],
          }));
        },
      },
    ],
  });
  let state, effect, cleanup;
  const cache = new Map([["project/first.mp4", "data:first"]]);
  let finishSecond;
  const context = vm.createContext({
    hooks: {
      createContext: () => ({}),
      useContext: () => ({ slug: "project" }),
      useMemo: (fn) => fn(),
      useState: (initial) => {
        state ??= initial;
        return [
          state,
          (update) => {
            state = update(state);
          },
        ];
      },
      useEffect: (fn) => {
        effect = fn;
      },
    },
    frames: {
      cachedVideoFrame: (url) => cache.get(url) ?? null,
      videoFrame: (url) =>
        cache.has(url)
          ? Promise.resolve(cache.get(url))
          : new Promise((resolve) => {
              finishSecond = resolve;
            }),
    },
  });
  vm.runInContext(result.outputFiles[0].text, context);
  function render(src) {
    const element = context.subject.ClipFilmstrip({
      track: { kind: "video" },
      clip: { src, duration: 30 },
      fps: 30,
      width: 70,
      height: 42,
    });
    return element.type(element.props).props.children[0].props.style
      ?.backgroundImage;
  }
  assert.equal(render("first.mp4"), 'url("data:first")');
  cleanup = effect();
  await new Promise(setImmediate);
  cache.clear();
  assert.equal(
    render("first.mp4"),
    'url("data:first")',
    "cache eviction must not blank a mounted tile",
  );
  cleanup();
  assert.equal(
    render("second.mp4"),
    undefined,
    "the previous source must not appear while loading",
  );
  cleanup = effect();
  finishSecond("data:second");
  await new Promise(setImmediate);
  assert.equal(render("second.mp4"), 'url("data:second")');
  cleanup();
});

test("waveforms keep peaks but release decoded audio; other audio users can still cache", async (t) => {
  let fetches = 0;
  const samples = new Float32Array(100).fill(0.5);
  t.mock.method(globalThis, "fetch", async () => {
    fetches++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
  });
  const previous = globalThis.AudioContext;
  globalThis.AudioContext = class {
    async decodeAudioData() {
      return {
        duration: 1,
        length: 100,
        numberOfChannels: 1,
        getChannelData: () => samples,
      };
    }
  };
  t.after(() => {
    globalThis.AudioContext = previous;
    forgetDecodedAudio();
  });
  const waveform = await audioPeaks("test-audio");
  assert.equal(waveform.peaks.length, 100);
  assert.equal(waveform.peaks[0], 0.5);
  assert.equal(await audioPeaks("test-audio"), waveform);
  assert.equal(fetches, 1);
  const audio = await decodeAudioUrl("test-audio");
  assert.equal(fetches, 2, "waveform generation must release full PCM");
  assert.equal(await decodeAudioUrl("test-audio"), audio);
  assert.equal(fetches, 2, "normal audio consumers still share their cache");
});

test("video previews deduplicate requests and evict old cached frames without invalidating visible images", async (t) => {
  const previous = globalThis.document;
  let captures = 0;
  class Video extends EventTarget {
    duration = 1000;
    videoWidth = 160;
    videoHeight = 90;
    time = 0;
    set src(value) {
      queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
    }
    get currentTime() {
      return this.time;
    }
    set currentTime(value) {
      this.time = value;
      queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
    }
    removeAttribute() {}
    load() {}
  }
  globalThis.document = {
    createElement: (tag) =>
      tag === "video"
        ? new Video()
        : {
            getContext: () => ({ drawImage() {} }),
            toDataURL: () => `data:image/jpeg;base64,${++captures}`,
          },
  };
  t.after(() => {
    globalThis.document = previous;
  });
  const first = videoFrame("test-video", 1);
  assert.equal(videoFrame("test-video", 1), first);
  const visibleImage = await first;
  assert.equal(captures, 1);
  for (let frame = 2; frame <= 513; frame++)
    await videoFrame("test-video", frame);
  assert.equal(cachedVideoFrame("test-video", 1), null);
  assert.ok(cachedVideoFrame("test-video", 513));
  assert.ok(visibleImage.startsWith("data:image/jpeg;"));
  await videoFrame("test-video", 1);
  assert.equal(captures, 514, "evicted images can be decoded again");
});
