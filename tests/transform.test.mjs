import assert from "node:assert/strict";
import test from "node:test";
import {
  dragBox,
  matchTextLeaf,
  patchClipForVariant,
  setAtPath,
  snapMove,
  textLeaves,
  transformForRect,
} from "../lib/studio/transform.ts";

const layers = {
  version: 1,
  markers: [],
  tracks: [
    { id: "t", name: "Text", kind: "text", clips: [{ id: "title", from: 0, duration: 30, text: "Hi" }] },
    { id: "i", name: "Logo", kind: "image", locked: true, clips: [{ id: "logo", from: 0, duration: 60, src: "a.png", box: { x: 0, y: 0, width: 0.2, height: 0.2 } }] },
    { id: "v", name: "Video", kind: "video", clips: [{ id: "bg", from: 0, duration: 60, src: "a.mp4" }] },
    { id: "s", name: "Scenes", kind: "scene", clips: [{ id: "scene", from: 0, duration: 60, scene: "Hook" }] },
  ],
};

test("dragBox moves, resizes from the opposite edge and keeps the ratio on corners", () => {
  const start = { x: 0.2, y: 0.2, width: 0.4, height: 0.2 };
  assert.deepEqual(dragBox(start, "move", 0.1, -0.1).box, { x: 0.3, y: 0.1, width: 0.4, height: 0.2 });
  assert.deepEqual(dragBox(start, "w", 0.1, 0.3).box, { x: 0.3, y: 0.2, width: 0.3, height: 0.2 });
  const grown = dragBox(start, "se", 0.4, 0, true);
  assert.equal(grown.scale, 2);
  assert.deepEqual(grown.box, { x: 0.2, y: 0.2, width: 0.8, height: 0.4 });
  const fromTopLeft = dragBox(start, "nw", 0.2, 0.1, true);
  assert.deepEqual(fromTopLeft.box, { x: 0.4, y: 0.3, width: 0.2, height: 0.1 });
  // Never collapses or flips.
  assert.deepEqual(dragBox(start, "e", -2, 0).box, { x: 0.2, y: 0.2, width: 0.02, height: 0.2 });
});

test("snapMove pulls a box onto the centre lines and edges", () => {
  const { box, guides } = snapMove({ x: 0.305, y: 0.6, width: 0.4, height: 0.2 }, 0.01, 0.01);
  assert.equal(box.x, 0.3);
  assert.equal(box.y, 0.6);
  assert.deepEqual(guides, { x: 0.5, y: undefined });
  assert.equal(snapMove({ x: 0.004, y: 0.795, width: 0.4, height: 0.2 }, 0.01, 0.01).box.y, 0.8);
});

test("patchClipForVariant keeps another layout's changes to itself", () => {
  const box = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
  const wide = patchClipForVariant(layers, "title", { box }, "wide", "wide");
  assert.deepEqual(wide.tracks[0].clips[0].box, box);
  assert.equal(wide.tracks[0].clips[0].variants, undefined);
  const mobile = patchClipForVariant(layers, "title", { box }, "mobile", "wide");
  assert.equal(mobile.tracks[0].clips[0].box, undefined);
  assert.deepEqual(mobile.tracks[0].clips[0].variants, { mobile: { box } });
  // Words go to every layout…
  const text = patchClipForVariant(mobile, "title", { text: "Yo" }, "mobile", "wide", false);
  assert.equal(text.tracks[0].clips[0].text, "Yo");
  // …unless this layout already has its own.
  const own = patchClipForVariant(mobile, "title", { box: { ...box, x: 0 } }, "mobile", "wide", false);
  assert.equal(own.tracks[0].clips[0].variants.mobile.box.x, 0);
});

test("transformForRect moves and scales a scene so its content lands on the new rectangle", () => {
  const from = { x: 0.3, y: 0.4, width: 0.4, height: 0.2 };
  assert.deepEqual(transformForRect(undefined, from, { ...from, x: 0.4, y: 0.3 }), { x: 0.1, y: -0.1, scale: 1 });
  // Twice as big from the top-left corner: the corner stays put.
  const grown = transformForRect(undefined, from, { x: 0.3, y: 0.4, width: 0.8, height: 0.4 });
  assert.deepEqual(grown, { x: 0.2, y: 0.1, scale: 2 });
  const corner = 0.5 + grown.scale * (from.x - 0.5) + grown.x;
  assert.ok(Math.abs(corner - 0.3) < 1e-9);
  // From a clip that was already moved, back to where it started: no transform left.
  const moved = { x: 0.1, y: 0, scale: 1 };
  assert.equal(transformForRect(moved, { ...from, x: 0.4 }, from), undefined);
});

test("matchTextLeaf finds the prop behind the text on screen", () => {
  const props = { phrases: [{ line: "Make it *yours*", at: 0 }, { line: "just by *chatting*", at: 41 }], size: 84, exit: "fade" };
  const leaves = textLeaves(props);
  // A span per word: the line is two elements up.
  const hit = matchTextLeaf(leaves, ["chatting", "just by chatting", "Make it yoursjust by chatting"]);
  assert.deepEqual(hit.path, ["phrases", 1, "line"]);
  assert.equal(hit.level, 1);
  assert.deepEqual(matchTextLeaf(leaves, ["yours"]).path, ["phrases", 0, "line"]);
  assert.equal(matchTextLeaf(leaves, ["Written in code"]), null);
  const next = setAtPath(props, hit.path, "just by *typing*");
  assert.equal(next.phrases[1].line, "just by *typing*");
  assert.equal(next.phrases[0], props.phrases[0]);
  assert.equal(props.phrases[1].line, "just by *chatting*");
});
