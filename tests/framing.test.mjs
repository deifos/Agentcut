import assert from "node:assert/strict";
import test from "node:test";
import { stableFaceCrop, framingSampleTimes, followSampleTimes, followFaceCrop, updateFraming } from "../lib/studio/framing.ts";
import { framingCropAt } from "../packages/agentcut/template/runtime/framing.ts";
import { runFaceFraming } from "../lib/studio/framing-tool.ts";
import { parseLayers } from "../packages/agentcut/src/studio/schema.ts";

const face = { x: 0.65, y: 0.18, width: 0.12, height: 0.22, score: 0.95 };
const samples = Array.from({ length: 9 }, (_, i) => ({ seconds: i, faces: [{ ...face, x: face.x + i * 0.001 }] }));
const project = { version: 1, name: "Fixture", fps: 30, durationInFrames: 300, variants: { wide: { width: 1920, height: 1080 }, mobile: { width: 1080, height: 1920 } }, defaultVariant: "wide", background: "#000000", fonts: [] };
const layers = { version: 1, tracks: [{ id: "footage", name: "Footage", kind: "video", clips: [{ id: "speaker", src: "assets/source.mp4", from: 0, duration: 300, trimStart: 60, playbackRate: 1.5, box: { x: 0, y: 0, width: 1, height: 1 }, variants: { mobile: { muted: true } } }] }], markers: [] };

test("stable source crop keeps aspect, face, headroom and edge bounds; source time respects trim/speed", () => {
  const result = stableFaceCrop(samples, { width: 1920, height: 1080 }, 9 / 16);
  assert.equal(result.status, "ready");
  assert.ok(result.crop.x > 0.5);
  assert.ok(Math.abs(result.crop.width * 1920 / (result.crop.height * 1080) - 9 / 16) < 1e-8);
  for (const sample of samples) { const f = sample.faces[0]; assert.ok(f.x >= result.crop.x && f.x + f.width <= result.crop.x + result.crop.width); }
  const edge = stableFaceCrop(samples.map(s => ({ ...s, faces: [{ ...face, x: 0, y: 0 }] })), { width: 1080, height: 1920 }, 16 / 9);
  assert.equal(edge.status, "ready"); assert.ok(edge.crop.x >= 0 && edge.crop.y >= 0 && edge.crop.x + edge.crop.width <= 1 && edge.crop.y + edge.crop.height <= 1);
  const times = framingSampleTimes(layers.tracks[0].clips[0], 30);
  assert.equal(times[0], 2.3); assert.equal(times.at(-1), 16.7);
});

test("missing, weak, multiple and moving faces produce actionable non-mutating results", () => {
  for (const [faces, status] of [[[], "no_face"], [[{ ...face, score: 0.6 }], "low_confidence"], [[face, { ...face, x: 0.1 }], "multiple_faces"]]) {
    assert.equal(stableFaceCrop(samples.map(s => ({ ...s, faces })), { width: 1920, height: 1080 }, 9 / 16).status, status);
  }
  const moving = samples.map((s, i) => ({ ...s, faces: [{ ...face, x: i / 12 }] }));
  assert.notEqual(stableFaceCrop(moving, { width: 1920, height: 1080 }, 9 / 16).status, "ready");
});

test("tool applies one variant, schema accepts it, reset preserves later edits and prior crop", async () => {
  let doc = { slug: "fixture", project, layers: structuredClone(layers), projectHash: "project", layersHash: "layers" };
  const undo = [];
  const context = { getVariant: () => "mobile", getSelection: () => ["speaker"], getDoc: () => doc, applyToolLayers: async (next, base) => { assert.equal(base, doc); undo.push(base.layers); doc = { ...doc, layers: next }; } };
  const detection = async (_url, times) => ({ width: 1920, height: 1080, samples: times.map((seconds, i) => ({ seconds, faces: [{ ...face, x: face.x + i * 0.0002 }] })) });
  const result = await runFaceFraming({}, doc, context, detection);
  assert.equal(result.status, "applied"); assert.equal(undo.length, 1);
  assert.equal(result.tracking, true); assert.ok(doc.layers.tracks[0].clips[0].variants.mobile.framing.path.length > 9);
  assert.equal(parseLayers(doc.layers, project, [], null).ok, true);
  const clip = doc.layers.tracks[0].clips[0];
  assert.equal(clip.trimStart, 60); assert.equal(clip.variants.mobile.muted, true); assert.equal(clip.framing, undefined);
  clip.variants.mobile.volume = 0.4;
  assert.equal((await runFaceFraming({ action: "reset" }, doc, context, detection)).status, "reset");
  assert.deepEqual(doc.layers.tracks[0].clips[0].variants.mobile, { muted: true, volume: 0.4 });
  const prior = structuredClone(layers); prior.tracks[0].clips[0].variants.mobile.framing = { crop: { x: 0.1, y: 0, width: 0.4, height: 1 } };
  const next = updateFraming(prior, "mobile", new Map([["speaker", result.clips[0].crop]]), ["speaker"]);
  assert.deepEqual(updateFraming(next, "mobile", null, ["speaker"]), prior);
  doc.layers = undo[0]; assert.deepEqual(doc.layers, layers);
});

test("full-range follow pans smoothly with a dead zone, bounded crops and source-time interpolation", () => {
  const moving = Array.from({ length: 21 }, (_, i) => ({ seconds: 2 + i * 0.5, faces: [{ ...face, x: 0.12 + i * 0.014, width: 0.1 }] }));
  const result = followFaceCrop(moving, { width: 1920, height: 1080 }, 9 / 16);
  assert.equal(result.status, "ready"); assert.equal(result.path.length, moving.length);
  assert.ok(result.path.at(-1).crop.x > result.path[0].crop.x + 0.2);
  for (const [i, key] of result.path.entries()) {
    assert.ok(key.crop.x >= 0 && key.crop.y >= 0 && key.crop.x + key.crop.width <= 1 && key.crop.y + key.crop.height <= 1);
    const f = moving[i].faces[0]; assert.ok(f.x >= key.crop.x - 1e-8 && f.x + f.width <= key.crop.x + key.crop.width + 1e-8);
    if (i) assert.ok(Math.abs(key.crop.x - result.path[i - 1].crop.x) / 0.5 <= 0.55);
  }
  const noisy = moving.map((s, i) => ({ ...s, faces: [{ ...face, x: 0.5 + Math.sin(i) * 0.001 }] }));
  const still = followFaceCrop(noisy, { width: 1920, height: 1080 }, 9 / 16); assert.equal(still.status, "ready");
  assert.ok(Math.max(...still.path.map(k => k.crop.x)) - Math.min(...still.path.map(k => k.crop.x)) < 1e-8);
  const path = [{ seconds: 2, crop: { x: 0.1, y: 0, width: 0.3, height: 1 } }, { seconds: 4, crop: { x: 0.3, y: 0, width: 0.3, height: 1 } }];
  const sourceTime = 60 / 30 + 15 / 30 * 2;
  assert.ok(Math.abs(framingCropAt({ crop: path[0].crop, path }, sourceTime).x - 0.2) < 1e-8);
  assert.deepEqual(framingCropAt({ crop: path[0].crop, path }, sourceTime), framingCropAt({ crop: path[0].crop, path }, sourceTime));
  const times = followSampleTimes(layers.tracks[0].clips[0], 30);
  assert.equal(times[0], 2); assert.equal(times.at(-1), 2 + 299 / 30 * 1.5);
  assert.ok(times.every((t, i) => !i || t - times[i - 1] <= 0.5 + 1e-8));
  assert.equal(followSampleTimes({ duration: 30 * 601 }, 30), null);
});

test("follow holds brief loss and refuses long loss, ambiguity, picture cuts and subject jumps", () => {
  const base = Array.from({ length: 21 }, (_, i) => ({ seconds: i * 0.5, faces: [{ ...face, x: 0.35 + i * 0.003 }] }));
  const short = base.map((s, i) => i === 8 || i === 9 ? { ...s, faces: [] } : s);
  const held = followFaceCrop(short, { width: 1920, height: 1080 }, 9 / 16); assert.equal(held.status, "ready"); assert.equal(held.heldSamples, 2); assert.deepEqual(held.path[9].crop, held.path[7].crop);
  const check = (samples, expected) => assert.equal(followFaceCrop(samples, { width: 1920, height: 1080 }, 9 / 16).status, expected);
  check(base.map((s, i) => i >= 6 && i <= 11 ? { ...s, faces: [] } : s), "long_loss");
  check(base.map((s, i) => i === 10 ? { ...s, faces: [...s.faces, face] } : s), "multiple_faces");
  check(base.map((s, i) => i === 10 ? { ...s, sceneChange: true } : s), "scene_change");
  check(base.map((s, i) => i === 10 ? { ...s, faces: [{ ...face, x: 0.8 }] } : s), "subject_change");
});

test("follow reset restores a prior path and schema rejects unordered motion times", () => {
  const prior = structuredClone(layers);
  const crop = { x: 0.1, y: 0, width: 0.3, height: 1 };
  const path = [{ seconds: 2, crop }, { seconds: 3, crop: { ...crop, x: 0.2 } }];
  prior.tracks[0].clips[0].variants.mobile.framing = { crop, path };
  const followed = updateFraming(prior, "mobile", new Map([["speaker", crop]]), ["speaker"], new Map([["speaker", path.map(p => ({ ...p, crop: { ...p.crop, x: 0.3 } }))]]));
  assert.deepEqual(updateFraming(followed, "mobile", null, ["speaker"]), prior);
  followed.tracks[0].clips[0].variants.mobile.framing.path.reverse();
  assert.equal(parseLayers(followed, project, [], null).ok, false);
});

test("tool refuses ambiguous clips, multiple faces and stale saves", async () => {
  const doc = { slug: "fixture", project, layers, projectHash: "project" };
  let writes = 0;
  const context = { getVariant: () => "mobile", getSelection: () => [], getDoc: () => doc, applyToolLayers: async () => { writes++; throw new Error("changed on disk"); } };
  const multiple = async () => ({ width: 1920, height: 1080, samples: samples.map(s => ({ ...s, faces: [face, { ...face, x: 0.1 }] })) });
  assert.equal((await runFaceFraming({}, doc, context, multiple)).status, "multiple_faces"); assert.equal(writes, 0);
  assert.equal((await runFaceFraming({}, doc, context, async () => ({ width: 1920, height: 1080, samples }))).status, "error"); assert.equal(writes, 1);
  assert.deepEqual(doc.layers, layers);
});
