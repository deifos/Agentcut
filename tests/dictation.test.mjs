import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function bundle(entry, dependency, exports) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "subject",
    define: { "import.meta.url": '"http://localhost/dictation.js"' },
    plugins: [
      {
        name: "test-dependencies",
        setup(build) {
          build.onResolve({ filter: new RegExp(`^${dependency}$`) }, () => ({
            path: dependency,
            namespace: "mock",
          }));
          build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            contents: exports,
          }));
        },
      },
    ],
  });
  return result.outputFiles[0].text;
}
const hookCode = await bundle(
  "lib/studio/audio/dictation.ts",
  "react",
  "export const { useState, useRef, useEffect, useCallback } = globalThis.hooks;",
);
const workerCode = await bundle(
  "app/dictation-worker.ts",
  "@huggingface/transformers",
  "export const pipeline = globalThis.pipeline;",
);

function harness({
  permission = deferred(),
  worklet = Promise.resolve(),
  contextError = false,
} = {}) {
  const slots = [],
    cleanups = [],
    effects = [];
  let cursor = 0,
    stopped = 0,
    closed = 0,
    contexts = 0;
  const workers = [],
    nodes = [],
    texts = [],
    errors = [];
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (value) => {
          slots[i] = value;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useCallback(fn) {
      cursor++;
      return fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!deps || !slots[i] || deps.some((d, j) => d !== slots[i][j])) {
        effects.push(() => {
          cleanups[i]?.();
          cleanups[i] = fn();
        });
        slots[i] = deps;
      }
    },
  };
  // Preserve callbacks as React does, including dependency comparisons.
  hooks.useCallback = (fn, deps) => {
    const i = cursor++;
    if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j]))
      slots[i] = { fn, deps };
    return slots[i].fn;
  };
  class Worker extends EventTarget {
    constructor() {
      super();
      workers.push(this);
    }
    postMessage(data) {
      (this.messages ??= []).push(data);
    }
    terminate() {
      this.terminated = true;
    }
    reply(data) {
      this.dispatchEvent(new MessageEvent("message", { data }));
    }
  }
  class AudioContext {
    constructor() {
      contexts++;
      if (contextError) throw Error("no audio context");
    }
    sampleRate = 16000;
    state = "running";
    audioWorklet = { addModule: () => worklet };
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    close() {
      this.state = "closed";
      closed++;
      return Promise.resolve();
    }
  }
  class AudioWorkletNode {
    constructor() {
      nodes.push(this);
    }
    port = {};
    connect() {}
  }
  const scope = vm.createContext({
    hooks,
    Worker,
    AudioContext,
    AudioWorkletNode,
    navigator: { mediaDevices: { getUserMedia: () => permission.promise } },
    URL,
    Blob,
    Float32Array,
    setTimeout: () => 1,
    clearTimeout() {},
  });
  vm.runInContext(hookCode, scope);
  const render = (enabled = true) => {
    cursor = 0;
    const result = scope.subject.useDictation({
      enabled,
      onText: (...args) => texts.push(args),
      onError: (e) => errors.push(e),
    });
    effects.splice(0).forEach((fn) => fn());
    return result;
  };
  return {
    render,
    workers,
    nodes,
    texts,
    errors,
    permission,
    allow: () =>
      permission.resolve({ getTracks: () => [{ stop: () => stopped++ }] }),
    unmount: () => cleanups.forEach((fn) => fn?.()),
    counts: () => ({ stopped, closed, contexts }),
  };
}

test("stop before microphone permission prevents late capture", async () => {
  const h = harness(),
    input = h.render();
  const started = input.start();
  await input.stop();
  h.allow();
  await started;
  assert.equal(h.counts().stopped, 1);
  assert.equal(h.counts().contexts, 0);
  assert.equal(h.render().state, "idle");
});

test("unmount before permission prevents capture and text updates", async () => {
  const h = harness();
  const started = h.render().start();
  h.unmount();
  h.allow();
  await started;
  assert.equal(h.counts().stopped, 1);
  assert.equal(h.counts().contexts, 0);
  assert.equal(h.texts.length, 0);
});

test("audio setup failure releases the microphone", async () => {
  const h = harness({ contextError: true });
  const started = h.render().start();
  h.allow();
  await assert.rejects(started, /no audio context/);
  assert.equal(h.counts().stopped, 1);
  assert.equal(h.render().state, "idle");
});

test("disabling a mounted input stops its recording", async () => {
  const h = harness();
  const started = h.render().start();
  h.allow();
  await tick();
  h.workers[0].reply({ type: "ready" });
  await started;
  assert.equal(h.render().state, "listening");
  h.render(false);
  assert.ok(h.counts().stopped > 0);
  assert.ok(h.counts().closed > 0);
  assert.equal(h.render(false).state, "idle");
});

test("download progress stays visible after release, then clears", async () => {
  const h = harness();
  const started = h.render().start();
  h.allow();
  await tick();
  const w = h.workers[0];
  w.reply({ type: "progress", file: "onnx/encoder_model.onnx", progress: 6 });
  w.reply({ type: "progress", file: "onnx/decoder_model_merged.onnx", progress: 0 });
  assert.equal(h.render().progress, 0);
  w.reply({ type: "progress", file: "onnx/encoder_model.onnx", progress: 80 });
  w.reply({ type: "progress", file: "onnx/decoder_model_merged.onnx", progress: 41.6 });
  assert.equal(h.render().progress, 41);
  const stopped = h.render().stop();
  await tick();
  const released = h.render();
  assert.equal(released.state, "finishing");
  assert.equal(released.progress, 41);
  w.reply({ type: "ready" });
  await started;
  await stopped;
  const done = h.render();
  assert.equal(done.state, "idle");
  assert.equal(done.progress, null);
});

test("a completed encoder cannot finish the download before the decoder", async () => {
  const h = harness();
  const started = h.render().start();
  h.allow();
  await tick();
  const w = h.workers[0];
  w.reply({ type: "progress", file: "onnx/encoder_model.onnx", progress: 100 });
  assert.equal(h.render().progress, 0);
  w.reply({ type: "progress", file: "onnx/decoder_model_merged.onnx", progress: 50 });
  assert.equal(h.render().progress, 50);
  w.reply({ type: "progress", file: "onnx/decoder_model_merged.onnx", progress: 99.9 });
  assert.equal(h.render().progress, 99);
  w.reply({ type: "progress", file: "onnx/decoder_model_merged.onnx", progress: 100 });
  assert.equal(h.render().progress, 100);
  w.reply({ type: "ready" });
  await started;
  assert.equal(h.render().progress, null);
  h.unmount();
});

test("a box opened mid-download picks up the current progress", async () => {
  const h = harness();
  const first = h.render();
  const started = first.start();
  h.allow();
  await tick();
  const w = h.workers[0];
  w.reply({ type: "progress", file: "onnx/encoder_model.onnx", progress: 100 });
  w.reply({ type: "progress", file: "onnx/decoder_model_merged.onnx", progress: 30 });
  h.unmount();
  const retry = h.render().start();
  await tick();
  assert.equal(h.workers.length, 1);
  assert.equal(h.render().progress, 30);
  w.reply({ type: "ready" });
  await started;
  await retry;
  h.unmount();
});

test("worker load failure rejects and permits a fresh worker", async () => {
  const h = harness();
  const started = h.render().start();
  h.allow();
  await tick();
  h.workers[0].dispatchEvent(new Event("error"));
  await assert.rejects(started, /speech worker stopped/);
  assert.equal(h.render().state, "idle");
  const retry = h.render().start();
  await tick();
  assert.equal(h.workers.length, 2);
  h.workers[1].reply({ type: "ready" });
  await retry;
  h.unmount();
});

test("worker inference failure stops capture and reports the error", async () => {
  const h = harness();
  const started = h.render().start();
  h.allow();
  await tick();
  h.workers[0].reply({ type: "ready" });
  await started;
  h.nodes[0].port.onmessage({ data: new Float32Array(8000).fill(0.2) });
  h.workers[0].dispatchEvent(new Event("error"));
  await tick();
  assert.equal(h.render().state, "idle");
  assert.equal(h.errors.length, 1);
  assert.ok(h.counts().stopped > 0);
});

test("closing during final recognition prevents late text writes", async () => {
  const h = harness();
  const started = h.render().start();
  h.allow();
  await tick();
  const w = h.workers[0];
  w.reply({ type: "ready" });
  await started;
  h.nodes[0].port.onmessage({ data: new Float32Array(8000).fill(0.2) });
  w.reply({ type: "result", id: w.messages.at(-1).id, text: "partial" });
  await tick();
  const stopped = h.render().stop();
  await tick();
  h.unmount();
  const before = h.texts.length;
  w.reply({ type: "result", id: w.messages.at(-1).id, text: "final" });
  await stopped;
  assert.equal(h.texts.length, before);
});

test("worker serializes inference and falls back after GPU warmup failure", async () => {
  let handle,
    active = 0,
    maximum = 0,
    disposed = 0;
  const devices = [],
    messages = [];
  const scope = vm.createContext({
    Float32Array,
    self: {
      addEventListener: (_, fn) => {
        handle = fn;
      },
      postMessage: (data) => messages.push(data),
    },
    pipeline: async (_task, _model, options) => {
      devices.push(options.device);
      const run = async (_audio, opts) => {
        active++;
        maximum = Math.max(maximum, active);
        await tick();
        active--;
        if (options.device === "webgpu" && opts.max_new_tokens === 4)
          throw Error("shader failure");
        return { text: " recognized " };
      };
      run.dispose = async () => {
        disposed++;
      };
      return run;
    },
  });
  vm.runInContext(workerCode, scope);
  handle({ data: { type: "load", device: "webgpu" } });
  handle({ data: { type: "run", id: 1, audio: new Float32Array(16000) } });
  handle({ data: { type: "run", id: 2, audio: new Float32Array(16000) } });
  for (let i = 0; i < 20 && messages.length < 3; i++) await tick();
  assert.deepEqual(devices, ["webgpu", "wasm"]);
  assert.equal(disposed, 1);
  assert.equal(maximum, 1);
  assert.deepEqual(
    messages.map((m) => m.type),
    ["ready", "result", "result"],
  );
  assert.deepEqual(
    messages.slice(1).map((m) => m.id),
    [1, 2],
  );
});

async function runWorkerLoad(cached) {
  let handle;
  const messages = [];
  const scope = vm.createContext({
    Float32Array,
    caches: {
      open: async () => ({ match: async () => (cached ? {} : undefined) }),
    },
    self: {
      addEventListener: (_, fn) => {
        handle = fn;
      },
      postMessage: (data) => messages.push(data),
    },
    pipeline: async (_task, _model, options) => {
      assert.equal(options.dtype.decoder_model_merged, "fp32");
      for (const file of ["config.json", "onnx/encoder_model.onnx"])
        options.progress_callback({ status: "progress", file, progress: 50 });
      const run = async () => ({ text: "" });
      run.dispose = async () => {};
      return run;
    },
  });
  vm.runInContext(workerCode, scope);
  handle({ data: { type: "load", device: "wasm" } });
  for (let i = 0; i < 20 && !messages.some((m) => m.type === "ready"); i++)
    await tick();
  return messages.filter((m) => m.type === "progress").map((m) => m.file);
}

test("worker reports progress for model downloads, not cached reads", async () => {
  assert.deepEqual(await runWorkerLoad(false), ["onnx/encoder_model.onnx"]);
  assert.deepEqual(await runWorkerLoad(true), []);
});
