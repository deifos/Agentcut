import assert from "node:assert/strict";
import test from "node:test";
import { addCutoutClip, cutoutClip, cutoutPlacement, cutoutRange, cutoutSize, hasPerson, matteSize, rangeNeedsFullClip, retimedVariant, smoothMatte } from "../lib/studio/cutout.ts";
import { runPersonCutout } from "../lib/studio/cutout-tool.ts";
import { parseLayers } from "../packages/agentcut/src/studio/schema.ts";

const footage = { id: "take", src: "assets/take.mp4", from: 30, duration: 300, trimStart: 60, playbackRate: 1.5, box: { x: 0, y: 0, width: 1, height: 1 }, grade: { contrast: 1.2 }, volume: 0.5, framing: { crop: { x: 0.1, y: 0, width: 0.5, height: 1 }, path: [{ seconds: 3, crop: { x: 0.1, y: 0, width: 0.5, height: 1 } }], before: null } };
const layers = { version: 1, tracks: [{ id: "captions", name: "Captions", kind: "captions", clips: [] }, { id: "titles", name: "Titles", kind: "text", clips: [{ id: "title", from: 60, duration: 90, text: "Hi" }] }, { id: "footage", name: "Footage", kind: "video", clips: [footage] }, { id: "under", name: "Under", kind: "image", clips: [{ id: "bg", from: 0, duration: 30, src: "assets/bg.png" }] }], markers: [] };
const project = { version: 1, name: "Fixture", fps: 30, durationInFrames: 400, variants: { wide: { width: 1920, height: 1080 } }, defaultVariant: "wide", background: "#000000", fonts: [] };

function harness(doc = { slug: "fixture", project, layers }) {
  const applied = [];
  const context = { getDoc: () => doc, getSelection: () => [], applyToolLayers: async (next, base) => { applied.push([next, base]); } };
  return { doc, context, applied };
}
const made = { type: "done", blob: new Blob(["x"]), frames: 90, device: "webgpu", coverage: 0.2, width: 1920, height: 1080 };

test("matte sides suit the model and the cutout never upscales", () => {
  assert.deepEqual(matteSize(1920, 1080), { width: 512, height: 288 });
  assert.deepEqual(matteSize(1080, 1920), { width: 288, height: 512 });
  assert.deepEqual(cutoutSize(3840, 2160), { width: 1920, height: 1080 });
  assert.deepEqual(cutoutSize(1279, 719), { width: 1280, height: 720 });
});

test("ranges map timeline frames to source seconds through trim and speed", () => {
  const range = cutoutRange(footage, 30, 60, 60);
  assert.equal(range.sourceStart, 2 + 1.5);
  assert.equal(range.sourceEnd, 3.5 + 3);
  assert.equal(range.partial, true);
  const whole = cutoutRange(footage, 30);
  assert.equal(whole.partial, false);
  assert.equal(whole.sourceStart, 2);
  for (const args of [[29, 10], [300, 31], [60, 0], [60.5, 10]]) assert.equal(cutoutRange(footage, 30, ...args), null);
});

test("smoothing damps small changes and follows large ones without touching the input", () => {
  const first = new Float32Array([0, 1]);
  const smoothed = smoothMatte(null, first);
  assert.notEqual(smoothed, first);
  const next = new Float32Array([0.1, 0]);
  smoothMatte(smoothed, next);
  assert.ok(smoothed[0] < 0.05);
  assert.equal(smoothed[1], 0);
  assert.equal(next[0], Float32Array.of(0.1)[0]);
});

test("no person needs most frames to be empty", () => {
  assert.equal(hasPerson([0, 0, 0.2]), false);
  assert.equal(hasPerson([0.2, 0.2, 0]), true);
  assert.equal(hasPerson([]), false);
});

test("whole-clip dependencies and per-variant retiming are detected", () => {
  const animated = { ...footage, enter: { preset: "fade", frames: 20 }, exit: { preset: "fade", frames: 20 } };
  assert.equal(rangeNeedsFullClip(animated, cutoutRange(animated, 30, 40, 30), false), true);
  assert.equal(rangeNeedsFullClip(animated, cutoutRange(animated, 30, 100, 30), false), false);
  assert.equal(rangeNeedsFullClip(animated, cutoutRange(animated, 30, 300, 30), false), true);
  assert.equal(rangeNeedsFullClip(animated, cutoutRange(animated, 30), false), false);
  assert.equal(rangeNeedsFullClip(footage, cutoutRange(footage, 30, 100, 30), true), true);
  assert.equal(rangeNeedsFullClip({ ...footage, camera: "none" }, cutoutRange(footage, 30, 100, 30), true), false);
  assert.equal(retimedVariant({ ...footage, variants: { mobile: { box: footage.box } } }), undefined);
  assert.equal(retimedVariant({ ...footage, variants: { mobile: { trimStart: 1 } } }), "mobile");
});

test("the clip keeps the source's look, drops its audio, and shifts framing to the file's start", () => {
  const range = cutoutRange(footage, 30, 60, 60);
  const clip = cutoutClip({ ...footage, variants: { mobile: { framing: footage.framing, volume: 1 } } }, range, "assets/cutouts/a.webm", "c");
  assert.equal(clip.trimStart, undefined);
  assert.equal(clip.volume, undefined);
  assert.equal(clip.muted, true);
  assert.equal(clip.playbackRate, 1.5);
  assert.deepEqual(clip.grade, footage.grade);
  assert.equal(clip.framing.path[0].seconds, 0);
  assert.equal("before" in clip.framing, false);
  assert.equal(clip.variants.mobile.volume, undefined);
  assert.equal(clip.variants.mobile.framing.path[0].seconds, 0);
  const crop = (x) => ({ x, y: 0, width: 0.5, height: 1 });
  const moving = { ...footage, framing: { crop: crop(0), path: [{ seconds: 3, crop: crop(0) }, { seconds: 4, crop: crop(0.4) }, { seconds: 5, crop: crop(0.2) }] } };
  const path = cutoutClip(moving, range, "assets/cutouts/a.webm", "c").framing.path;
  assert.deepEqual(path.map((key) => key.seconds), [0, 0.5, 1.5]);
  assert.ok(Math.abs(path[0].crop.x - 0.2) < 1e-9);
});

test("placement goes above the footage and the graphics, and a rerun replaces only what overlaps", () => {
  assert.deepEqual(cutoutPlacement(layers, "take"), { ok: true, index: 2 });
  assert.deepEqual(cutoutPlacement(layers, "take", ["title"]), { ok: true, index: 1 });
  assert.equal(cutoutPlacement(layers, "take", ["bg"]).status, "graphic_below_footage");
  assert.equal(cutoutPlacement(layers, "take", ["nope"]).status, "unknown_clip");
  const a = { id: "a", src: "assets/a.webm", from: 60, duration: 30 };
  const once = addCutoutClip(layers, "take", a, 1);
  assert.equal(once.tracks[1].id, "cutout-take");
  assert.equal(once.tracks[2].id, "titles");
  const twice = addCutoutClip(once, "take", { ...a, id: "b", from: 200 }, 2);
  assert.deepEqual(twice.tracks[1].clips.map((c) => c.id), ["a", "b"]);
  assert.equal(twice.tracks.filter((t) => t.id === "cutout-take").length, 1);
  const replaced = addCutoutClip(twice, "take", { ...a, id: "c", from: 70 }, 1);
  assert.deepEqual(replaced.tracks[1].clips.map((c) => c.id), ["c", "b"]);
  const parsed = parseLayers(replaced, project, [], null);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.issues.filter((i) => i.severity === "error"), []);
});

test("tool makes, uploads and applies the cutout with the source's timing", async () => {
  const { doc, context, applied } = harness();
  const requests = [];
  const result = await runPersonCutout({ fromFrame: 60, durationInFrames: 60, behind: ["title"] }, doc, context, { hasWebGpu: true, sourceVersion: async () => "1", exists: async () => false, render: async (request) => { requests.push(request); return made; }, upload: async (_slug, path) => path });
  assert.equal(result.status, "applied");
  assert.equal(result.reused, false);
  assert.equal(requests[0].start, 3.5);
  assert.equal(requests[0].end, 6.5);
  assert.equal(requests[0].frameStep, 1.5 / 30);
  assert.match(result.file, /^assets\/cutouts\/take-[a-f0-9]{64}\.webm$/);
  const [next] = applied[0];
  assert.equal(next.tracks[1].id, "cutout-take");
  assert.equal(next.tracks[1].clips[0].from, 60);
});

test("tool reuses a finished file and reports problems without editing", async () => {
  const { doc, context, applied } = harness();
  const render = async () => { throw new Error("should not render"); };
  const reused = await runPersonCutout({}, doc, context, { hasWebGpu: true, sourceVersion: async () => "1", exists: async () => true, render });
  assert.equal(reused.status, "applied");
  assert.equal(reused.reused, true);
  assert.equal(applied.length, 1);

  const fresh = harness();
  const exists = async () => false;
  const empty = await runPersonCutout({}, fresh.doc, fresh.context, { hasWebGpu: true, sourceVersion: async () => "1", exists, upload: async (_s, p) => p, render: async () => ({ ...made, blob: null, coverage: 0 }) });
  assert.equal(empty.status, "no_person");
  assert.equal((await runPersonCutout({ fromFrame: 0 }, fresh.doc, fresh.context, { hasWebGpu: true, sourceVersion: async () => "1", exists, render })).status, "invalid_range");
  assert.equal((await runPersonCutout({ behind: ["bg"] }, fresh.doc, fresh.context, { hasWebGpu: true, sourceVersion: async () => "1", exists, render })).status, "graphic_below_footage");
  const failed = await runPersonCutout({}, fresh.doc, fresh.context, { hasWebGpu: true, sourceVersion: async () => "1", exists, render });
  assert.equal(failed.status, "error");
  assert.equal(failed.applied, false);
  assert.equal(fresh.applied.length, 0);

  const long = { ...layers, tracks: layers.tracks.map((t) => t.id === "footage" ? { ...t, clips: [{ ...footage, duration: 2000 }] } : t) };
  const longDoc = harness({ slug: "fixture", project, layers: long });
  assert.equal((await runPersonCutout({}, longDoc.doc, longDoc.context, { hasWebGpu: false, sourceVersion: async () => "1", exists, render })).status, "range_too_long");

  const two = { ...layers, tracks: [...layers.tracks, { id: "other", name: "Other", kind: "video", clips: [{ ...footage, id: "second" }] }] };
  const ambiguous = harness({ slug: "fixture", project, layers: two });
  assert.equal((await runPersonCutout({}, ambiguous.doc, ambiguous.context, { hasWebGpu: true, sourceVersion: async () => "1", exists, render })).status, "selection_required");
});

test("footage changed during the job is not applied, but later edits elsewhere are kept", async () => {
  const start = harness();
  let current = start.doc;
  start.context.getDoc = () => current;
  const edited = { ...layers, tracks: [{ id: "new", name: "New", kind: "text", clips: [] }, ...layers.tracks] };
  const kept = await runPersonCutout({}, start.doc, start.context, { hasWebGpu: true, sourceVersion: async () => "1", exists: async () => false, upload: async (_s, p) => p, render: async () => { current = { ...start.doc, layers: edited }; return made; } });
  assert.equal(kept.status, "applied");
  assert.equal(start.applied[0][0].tracks[0].id, "new");
  assert.equal(start.applied[0][1], current);

  const moved = { ...layers, tracks: layers.tracks.map((t) => t.id === "footage" ? { ...t, clips: [{ ...footage, from: 31 }] } : t) };
  const other = harness();
  let latest = other.doc;
  other.context.getDoc = () => latest;
  const stale = await runPersonCutout({}, other.doc, other.context, { hasWebGpu: true, sourceVersion: async () => "1", exists: async () => false, upload: async (_s, p) => p, render: async () => { latest = { ...other.doc, layers: moved }; return made; } });
  assert.equal(stale.status, "stale_project");
  assert.equal(other.applied.length, 0);
});


test("cache keys distinguish source folders, frame rates and source revisions", async () => {
  const files = [];
  for (const [src, fps, version] of [["assets/a/take.mp4", 30, "1"], ["assets/b/take.mp4", 30, "1"], ["assets/a/take.mp4", 60, "1"], ["assets/a/take.mp4", 30, "2"]]) {
    const changed = { ...layers, tracks: [{ id: "video", kind: "video", clips: [{ ...footage, src, from: 0, trimStart: 0, duration: fps * 2 }] }] };
    const h = harness({ slug: "fixture", project: { ...project, fps }, layers: changed });
    const result = await runPersonCutout({}, h.doc, h.context, { hasWebGpu: true, sourceVersion: async () => version, exists: async () => true });
    assert.equal(result.status, "applied");
    files.push(result.file);
  }
  assert.equal(new Set(files).size, 4);
});

test("FPS changes, source replacement and newly locked tracks abort a pending cutout", async () => {
  for (const change of ["fps", "source", "lock"]) {
    const h = harness();
    let current = h.doc;
    let version = "1";
    h.context.getDoc = () => current;
    const result = await runPersonCutout({}, h.doc, h.context, {
      hasWebGpu: true, sourceVersion: async () => version, exists: async () => false,
      upload: async (_s, p) => p,
      render: async () => {
        if (change === "fps") current = { ...h.doc, project: { ...project, fps: 60 } };
        if (change === "source") version = "2";
        if (change === "lock") current = { ...h.doc, layers: { ...layers, tracks: layers.tracks.map(t => ({ ...t, locked: true })) } };
        return made;
      },
    });
    assert.equal(result.status, "stale_project");
    assert.equal(h.applied.length, 0);
  }
});

test("partial cutouts respect variant animations", () => {
  const clip = { ...footage, variants: { wide: { enter: { preset: "fade", frames: 30 } } } };
  assert.equal(rangeNeedsFullClip(clip, cutoutRange(clip, 30, 35, 10), false), true);
});
