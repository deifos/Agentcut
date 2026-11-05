import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { tempDir } from "./helpers/temp.mjs";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { createProject, readProjectState } from "../packages/agentcut/src/studio/projects.ts";
import { readCanvas } from "../packages/agentcut/src/studio/canvas.ts";
import { VideoCreation } from "../packages/agentcut/src/studio/video-creation.ts";
import { ChatEngine } from "../packages/agentcut/src/studio/chat.ts";
import { codexAgent } from "../packages/agentcut/src/studio/agents/codex.ts";

function fixture(populated = true) {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-video-create-")));
  mkdirSync(paths.library, { recursive: true });
  writeFileSync(join(paths.library, "shared.png"), "shared brand asset");
  const { slug } = createProject(paths, { name: "Keep launch" });
  const dir = join(paths.projects, slug);
  writeFileSync(join(dir, "assets", "proof.mp4"), "original footage bytes");
  writeFileSync(join(dir, "assets", "logo.svg"), "<svg />");
  if (populated) {
    writeFileSync(join(dir, "scenes", "Launch.tsx"), "export default function Launch() { return null; }");
    writeFileSync(join(dir, "layers.json"), JSON.stringify({ version: 1, tracks: [{ id: "launch", name: "Launch", kind: "scene", clips: [{ id: "launch-shot", scene: "Launch", from: 0, duration: 60 }] }], markers: [] }));
  }
  mkdirSync(join(dir, ".studio", "attachments"), { recursive: true });
  writeFileSync(join(dir, ".studio", "attachments", "frame.png"), "frame bytes");
  const sourceFiles = ["project.json", "layers.json", "notes.md", "assets/proof.mp4", "assets/logo.svg", ...(populated ? ["scenes/Launch.tsx"] : [])];
  const before = new Map(sourceFiles.map((path) => [path, readFileSync(join(dir, path), "utf8")]));
  const bound = [];
  const engine = new ChatEngine({ paths, emit() {}, addDirs: [], getPageContext: () => ({ activeProject: slug, selectedClipIds: ["launch-shot"], playheadFrame: 50 }) });
  engine.resolveAgent = async () => ({ adapter: codexAgent, model: null, effort: null });
  engine.startTurn = (target, _agent, context, text) => { bound.push({ target, context, text }); return "test-turn"; };
  const send = (target, text, context) => engine.send(target, text, context);
  const verifyOriginal = () => { for (const [path, content] of before) assert.equal(readFileSync(join(dir, path), "utf8"), content, path); };
  return { paths, slug, dir, bound, engine, send, verifyOriginal, creator: new VideoCreation(paths) };
}

for (const type of ["how-to", "product-launch"]) {
  test(`${type} on a populated edit gets a blank independent canvas video and copied material`, async () => {
    const f = fixture();
    await f.engine.send(f.slug, "Our product is Agentcut. Teach how to add a style.", {});
    f.bound.length = 0;
    const oldChat = readFileSync(join(f.dir, ".studio", "chat.json"), "utf8");
    const request = { type, requestId: randomUUID() };
    const context = { attachments: [".studio/attachments/frame.png"], references: [{ path: "assets/proof.mp4", kind: "video" }], selectedClipIds: ["launch-shot"], playheadFrame: 50 };
    const result = await f.creator.send(f.slug, "Create a separate video teaching styles.", context, request, f.send);
    assert.notEqual(result.slug, f.slug);
    const state = readProjectState(f.paths, result.slug);
    assert.deepEqual(state.layers.tracks, []);
    assert.deepEqual(state.scenes, []);
    assert.equal(readCanvas(f.paths, result.slug).group, readCanvas(f.paths, f.slug).group);
    assert.equal(readFileSync(join(state.dir, "assets", "proof.mp4"), "utf8"), "original footage bytes");
    assert.equal(readFileSync(join(state.dir, ".studio", "attachments", "frame.png"), "utf8"), "frame bytes");
    assert.equal(readFileSync(join(f.paths.library, "shared.png"), "utf8"), "shared brand asset");
    assert.equal(f.bound.length, 1);
    assert.equal(f.bound[0].target, result.slug);
    assert.deepEqual(f.bound[0].context.selectedClipIds, []);
    assert.equal(f.bound[0].context.playheadFrame, 0);
    assert.deepEqual(f.bound[0].context.references, context.references);
    assert.match(f.bound[0].context.sourceVideo.brief, /Teach how to add a style/);
    const prompt = f.engine.buildContext(result.slug, f.bound[0].context, codexAgent).text;
    assert.match(prompt, new RegExp(`Active project: ${result.slug}`));
    assert.match(prompt, /source video .* must stay unchanged/);
    // A simulated agent edit changes only the bound new file.
    writeFileSync(join(state.dir, "notes.md"), "new tutorial notes");
    f.verifyOriginal();
    assert.equal(readFileSync(join(f.dir, ".studio", "chat.json"), "utf8"), oldChat);
    await f.creator.send(f.slug, "Create a separate video teaching styles.", context, request, f.send);
    assert.equal(f.bound.length, 1);
    assert.equal(readCanvas(f.paths, f.slug).cuts.length, 2);
  });
}

test("retry and concurrent duplicate submission reuse one target and dispatch once", async () => {
  const f = fixture(); const request = { type: "how-to", requestId: randomUUID() };
  let calls = 0;
  await assert.rejects(f.creator.send(f.slug, "Teach styles", {}, request, async () => { throw new Error("agent unavailable"); }), /agent unavailable/);
  assert.equal(readCanvas(f.paths, f.slug).cuts.length, 2);
  const send = async (...args) => { calls++; return f.send(...args); };
  const [one, two] = await Promise.all([f.creator.send(f.slug, "Teach styles", {}, request, send), f.creator.send(f.slug, "Teach styles", {}, request, send)]);
  assert.equal(one.slug, two.slug); assert.equal(calls, 1);
  assert.equal(readCanvas(f.paths, f.slug).cuts.length, 2);
  f.verifyOriginal();
});

test("a lost send response does not dispatch again after the target already saved its user request", async () => {
  const f = fixture(); const request = { type: "how-to", requestId: randomUUID() };
  await assert.rejects(f.creator.send(f.slug, "Teach styles", {}, request, async (...args) => { await f.send(...args); throw new Error("lost response"); }), /lost response/);
  const retry = await new VideoCreation(f.paths).send(f.slug, "Teach styles", {}, request, f.send);
  assert.equal(retry.alreadySent, true);
  assert.equal(f.bound.length, 1);
  f.verifyOriginal();
});

test("a truly empty video with uploaded assets is reused and an old identical request is not a false duplicate", async () => {
  const f = fixture(false);
  await f.engine.send(f.slug, "Teach styles", {});
  f.bound.length = 0;
  const result = await f.creator.send(f.slug, "Teach styles", {}, { type: "how-to", requestId: randomUUID() }, f.send);
  assert.equal(result.slug, f.slug);
  assert.equal(f.bound.length, 1);
  assert.equal(readdirSync(f.paths.projects).filter((name) => !name.startsWith(".")).length, 1);
});

test("no usable request or invalid creation token cannot create or dispatch a video", async () => {
  const f = fixture();
  assert.throws(() => f.creator.send(f.slug, " ", {}, { type: "how-to", requestId: randomUUID() }, f.send), /brief/);
  assert.throws(() => f.creator.send(f.slug, "Teach styles", {}, { type: "how-to", requestId: "../wrong" }, f.send));
  assert.equal(f.bound.length, 0);
  await assert.rejects(f.creator.send("missing", "Teach styles", {}, { type: "how-to", requestId: randomUUID() }, f.send), /not found/);
  assert.equal(readdirSync(f.paths.projects).length, 1);
  f.verifyOriginal();
});
