import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createCut,
  readCanvas,
} from "../packages/agentcut/src/studio/canvas.ts";
import {
  createProject,
  readProjectState,
  deleteProject,
  writeLayers,
} from "../packages/agentcut/src/studio/projects.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";

test("Canvas keeps cuts independent and reuses media across clips and versions", async (t) => {
  const paths = workspacePaths(mkdtempSync(join(tmpdir(), "agentcut-canvas-")));
  t.after(() => rmSync(paths.root, { recursive: true, force: true }));
  mkdirSync(paths.library, { recursive: true });
  const { slug } = createProject(paths, { name: "Episode" });
  for (const name of ["a.mp4", "b.mp4"])
    writeFileSync(join(paths.projects, slug, "assets", name), name);
  const original = readCanvas(paths, slug);
  assert.ok(original.sources.every(source => !source.recording));
  const [a, b] = original.sources;
  const create = (name, segments) =>
    createCut(paths, { project: slug, name, kind: "clip", segments });
  const [first, second] = await Promise.all([
    create("Story", [
      { source: b.id, start: 32, end: 35 },
      { source: a.id, start: 4, end: 11 },
    ]),
    create("Advice", [{ source: a.id, start: 9, end: 10 }]),
  ]);
  const story = readProjectState(paths, first.slug);
  assert.deepEqual(story.issues, []);
  assert.equal(story.project.durationInFrames, 300);
  const [hook, context] = story.layers.tracks[0].clips;
  assert.deepEqual(
    [hook.from, hook.trimStart, context.from, context.trimStart],
    [0, 960, 90, 120],
  );
  assert.equal(
    readFileSync(join(paths.library, hook.src.slice(8)), "utf8"),
    "b.mp4",
  );
  assert.equal(
    context.src,
    readProjectState(paths, second.slug).layers.tracks[0].clips[0].src,
  );
  const alt = await createCut(paths, {
    project: first.slug,
    name: "Short opening",
    kind: "version",
  });
  const board = readCanvas(paths, alt.slug);
  assert.equal(board.sources.length, 2);
  assert.ok(board.sources.every(source => source.recording));
  assert.equal(board.cuts.length, 4);
  assert.equal(board.cuts.find((c) => c.slug === alt.slug).clip, first.slug);
  assert.deepEqual(
    board.cuts.find((c) => c.slug === first.slug).sources.sort(),
    [a.id, b.id].sort(),
  );
  writeLayers(paths, alt.slug, { version: 1, tracks: [], markers: [] }, null);
  assert.deepEqual(readProjectState(paths, first.slug).layers, story.layers);
  await assert.rejects(
    create("Invalid", [{ source: "missing", start: 0, end: 1 }]),
  );
  assert.equal(readCanvas(paths, slug).cuts.length, 4);
  rmSync(join(paths.library, hook.src.slice(8)));
  await assert.rejects(create("Missing recording", [{ source: b.id, start: 0, end: 1 }]), /missing from the library/);
  assert.equal(readCanvas(paths, slug).cuts.length, 4);
  deleteProject(paths, slug);
  createProject(paths, { name: "Episode" });
  assert.equal(readCanvas(paths, slug).cuts.length, 1);
  assert.equal(readCanvas(paths, first.slug).cuts.length, 3);
});
