import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tempDir } from "./helpers/temp.mjs";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { createProject, readProjectState } from "../packages/agentcut/src/studio/projects.ts";
import { readMcpFile } from "../packages/agentcut/src/studio/mcp-files.ts";
import { readBatch } from "../packages/agentcut/src/studio/read-batch.ts";
import { reviewPlan } from "../packages/agentcut/src/studio/review-plan.ts";
import { registerStudioTools } from "../packages/agentcut/src/studio/tools.ts";
import { setBridgeExtension } from "../packages/agentcut/src/bridge.ts";

test("batched MCP reads preserve scopes, hashes, ranges and per-file errors, without writes or renders", async () => {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-batch-read-")));
  const { slug } = createProject(paths, { name: "Read batch" });
  mkdirSync(paths.library, { recursive: true });
  writeFileSync(join(paths.projects, slug, "notes.md"), "one\ntwo\nthree\n");
  writeFileSync(join(paths.library, "brand.md"), "official colors");
  const handlers = new Map(), methods = [];
  registerStudioTools({ registerTool(name, _config, handler) { handlers.set(name, handler); } });
  setBridgeExtension({ handleLocalCall(method, params) {
    methods.push(method);
    assert.equal(method, "studio.local.read_file");
    return Promise.resolve().then(() => readMcpFile(paths, params.scope, params.project, params.path));
  } });
  const oldProject = process.env.AGENTCUT_PROJECT;
  process.env.AGENTCUT_PROJECT = slug;
  try {
    const result = JSON.parse((await handlers.get("agentcut_read_files")({ files: [
      { path: "notes.md", startLine: 2, endLine: 3 },
      { path: "brand.md", scope: "library" },
      { path: "../outside.md" },
    ] })).content[0].text);
    assert.equal(result.files[0].content, "two\nthree");
    assert.equal(result.files[0].hash, readMcpFile(paths, "project", slug, "notes.md").hash);
    assert.equal(result.files[0].complete, false);
    assert.equal(result.files[1].content, "official colors");
    assert.equal(result.files[2].ok, false);
    assert.equal(methods.length, 3);
    await assert.rejects(handlers.get("agentcut_read_files")({ files: Array.from({ length: 13 }, () => ({ path: "notes.md" })) }));
    await assert.rejects(handlers.get("agentcut_read_files")({ files: [{ path: "notes.md", startLine: 4, endLine: 2 }] }));
  } finally { setBridgeExtension(null); if (oldProject === undefined) delete process.env.AGENTCUT_PROJECT; else process.env.AGENTCUT_PROJECT = oldProject; }
});

test("independent reads start together and oversized content is explicit, not silently truncated", async () => {
  const started = []; let finish;
  const gate = new Promise((resolve) => { finish = resolve; });
  const work = readBatch([{ path: "one", scope: "project" }, { path: "two", scope: "project" }], async (file) => {
    started.push(file.path); await gate; return { path: file.path, scope: file.scope, hash: "hash", content: "x".repeat(60_000) };
  });
  assert.deepEqual(started, ["one", "two"]); finish();
  const result = await work;
  assert.equal(result.files[0].content.length, 60_000);
  assert.equal(result.files[1].ok, false);
  assert.equal(result.files[1].content, undefined);
  assert.match(result.files[1].error, /No partial content/);
});

test("shot plans use actual timing, neighboring boundaries and mobile overrides; final review remains full", () => {
  const project = { durationInFrames: 300, fps: 30, variants: { wide: {}, mobile: {} } };
  const layers = { tracks: [{ clips: [{ id: "one", from: 0, duration: 60 }, { id: "changed", from: 60, duration: 60, variants: { mobile: { from: 90, duration: 30 } } }] }] };
  const plan = reviewPlan(project, layers, "target", "shot", ["changed"]);
  assert.deepEqual(plan.intermediate[0].ranges, [{ clipId: "changed", from: 59, to: 120 }]);
  assert.deepEqual(plan.intermediate[1].ranges, [{ clipId: "changed", from: 89, to: 120 }]);
  assert.ok(plan.intermediate[0].frames.includes(59));
  assert.ok(plan.intermediate[0].frames.includes(120));
  assert.ok(plan.intermediate[0].frames.every((frame) => frame >= 59 && frame <= 120));
  assert.equal(plan.finalReviewRequired, true);
  assert.ok(plan.finalCalls.some((call) => call.tool === "agentcut_listen_critique" && call.args.variant === "mobile"));
  assert.ok(plan.finalCalls.filter((call) => call.tool === "agentcut_contact_sheet").every((call) => call.args.from === 0 && call.args.to === 299));
  for (const scope of ["shared", "timing"]) {
    const broad = reviewPlan(project, layers, "target", scope, ["removed-id"]);
    assert.equal(broad.intermediate[0].frames[0], 0);
    assert.equal(broad.intermediate[0].frames.at(-1), 299);
  }
  assert.throws(() => reviewPlan(project, layers, "target", "shot", ["missing"]), /Unknown/);
  assert.throws(() => reviewPlan(project, layers, "target", "shot", []), /changed clipIds/);
});

test("MCP plan reads real manifests together and produces valid existing-tool calls without rendering", async () => {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-review-plan-")));
  const { slug } = createProject(paths, { name: "Review plan", durationInFrames: 300 });
  writeFileSync(join(paths.projects, slug, "layers.json"), JSON.stringify({ version: 1, tracks: [{ id: "text", name: "Text", kind: "text", clips: [{ id: "title", text: "Result", from: 60, duration: 60 }] }], markers: [] }));
  const handlers = new Map(), configs = new Map(), methods = [];
  registerStudioTools({ registerTool(name, config, handler) { handlers.set(name, handler); configs.set(name, config); } });
  setBridgeExtension({ handleLocalCall(method, params) { methods.push(method); return Promise.resolve(readMcpFile(paths, params.scope, params.project, params.path)); } });
  try {
    const plan = JSON.parse((await handlers.get("agentcut_review_plan")({ project: slug, scope: "shot", clipIds: ["title"] })).content[0].text);
    assert.deepEqual(methods, ["studio.local.read_file", "studio.local.read_file"]);
    for (const call of [...plan.finalCalls, ...plan.intermediate.flatMap((variant) => [...variant.calls, ...variant.previewRanges])]) {
      const shape = configs.get(call.tool).inputSchema;
      for (const [key, value] of Object.entries(call.args)) assert.doesNotThrow(() => shape[key].parse(value), `${call.tool}.${key}`);
    }
    assert.equal(readProjectState(paths, slug).layers.tracks[0].clips[0].text, "Result");
  } finally { setBridgeExtension(null); }
});
