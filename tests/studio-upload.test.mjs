import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import vm from "node:vm";

// Run the actual upload completion handler with delayed media metadata.
const source = readFileSync(new URL("../components/studio/StudioApp.tsx", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  const addTake = async ("), source.indexOf("  // What the timeline's film strips draw"));
const { outputFiles } = await build({
  stdin: { contents: `export function create(deps) { const { doc, studio, studioFileUrl, addClip, clipEnd, uniqueClipId, setSelection, setChatOpen, setChatReferences, toast } = deps; ${handler}; return addTake; }`, loader: "ts", resolveDir: process.cwd() },
  bundle: true, write: false, format: "iife", globalName: "subject",
  plugins: [{ name: "metadata", setup(build) {
    build.onResolve({ filter: /media-info$/ }, () => ({ path: "metadata", namespace: "mock" }));
    build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: "export const mediaInfo = (...args) => globalThis.metadata(...args);" }));
  } }],
});

function harness() {
  let resolveMetadata;
  const metadata = new Promise((resolve) => { resolveMetadata = resolve; });
  const context = vm.createContext({ metadata: () => metadata });
  vm.runInContext(outputFiles[0].text, context);
  const doc = { slug: "first", project: { fps: 30, durationInFrames: 30 }, layers: { tracks: [] } };
  let current = doc;
  const writes = [];
  const add = context.subject.create({
    doc, studio: { getDoc: () => current, commitLayers: (...args) => writes.push(args) },
    studioFileUrl: () => "video.mp4", uniqueClipId: () => "take-1", clipEnd: (clip) => clip.from + clip.duration,
    addClip: (layers, kind, clip) => ({ layers: { tracks: [{ kind, clips: [clip] }] } }),
    setSelection() {}, setChatOpen() {}, setChatReferences() {}, toast: { success() {} },
  });
  return { doc, writes, add, resolveMetadata, change: (value) => { current = value; } };
}

test("upload completion cannot replace another project's timeline", async () => {
  const h = harness();
  const pending = h.add("assets/video.mp4", { seconds: 2, startSeconds: 0 });
  h.change({ ...h.doc, slug: "second" });
  h.resolveMetadata({ frames: 60 });
  await assert.rejects(pending, /project changed/);
  assert.equal(h.writes.length, 0);
});

test("upload completion preserves edits made while metadata loads", async () => {
  const h = harness();
  const pending = h.add("assets/video.mp4", { seconds: 2, startSeconds: 0 });
  h.change({ ...h.doc, layers: { tracks: [{ clips: [{ id: "new-edit" }] }] } });
  h.resolveMetadata({ frames: 60 });
  await assert.rejects(pending, /project changed/);
  assert.equal(h.writes.length, 0);
});

test("an unreadable duration cannot write an infinite timeline", async () => {
  const h = harness();
  const pending = h.add("assets/video.mp4", { seconds: Infinity, startSeconds: 0 });
  h.resolveMetadata({ frames: Infinity });
  await assert.rejects(pending, /duration could not be read/);
  assert.equal(h.writes.length, 0);
});

test("valid footage extends the current project after metadata loads", async () => {
  const h = harness();
  const pending = h.add("assets/video.mp4", { seconds: 2, startSeconds: 0 });
  h.resolveMetadata({ frames: 90 });
  await pending;
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0][0].tracks[0].clips[0].duration, 90);
  assert.equal(h.writes[0][2], 90);
});
