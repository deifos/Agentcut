import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tempDir } from "./helpers/temp.mjs";
import { ChatEngine } from "../packages/agentcut/src/studio/chat.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { codexAgent } from "../packages/agentcut/src/studio/agents/codex.ts";
import { claudeAgent } from "../packages/agentcut/src/studio/agents/claude.ts";
import { setBridgeExtension } from "../packages/agentcut/src/bridge.ts";
import { registerStudioTools } from "../packages/agentcut/src/studio/tools.ts";

test("agent token totals include cache tokens once and reject missing usage", () => {
  const codex = codexAgent.createParser();
  const claude = claudeAgent.createParser();
  const a = codex.line(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 20 } }))[0];
  const b = claude.line(JSON.stringify({ type: "result", usage: { input_tokens: 10, cache_read_input_tokens: 80, cache_creation_input_tokens: 10, output_tokens: 20 } }))[0];
  assert.equal(a.usage.totalTokens, 120);
  assert.equal(b.usage.totalTokens, 120);
  assert.equal(a.usage.cachedInputTokens, 80);
  assert.equal(codex.line('{"type":"turn.completed"}')[0].usage, undefined);
  assert.equal(claude.line('{"type":"result","usage":{"input_tokens":-1,"output_tokens":20}}')[0].usage, undefined);
});

test("project totals survive reload, history trimming and conversation reset without double counting", () => {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-chat-")));
  const deps = { paths, emit() {}, getPageContext: () => ({ activeProject: "other", playheadFrame: 999, selectedClipIds: ["wrong"] }), addDirs: [] };
  const engine = new ChatEngine(deps);
  const usage = { inputTokens: 100, outputTokens: 20, cachedInputTokens: 80, cacheWriteTokens: 0, totalTokens: 120 };
  const message = { id: "one", role: "assistant", status: "done", at: 1, usage };
  engine.upsertMessage("first", message);
  engine.upsertMessage("first", message);
  const file = engine.load("first");
  file.messages.push(...Array.from({ length: 401 }, (_, i) => ({ id: `m${i}`, role: "user", at: i })));
  engine.save("first", file);
  assert.equal(engine.history("first").messages.some(item => item.id === "one"), false);
  assert.equal(new ChatEngine(deps).history("first").projectTokens, 120);
  engine.reset("first");
  assert.equal(engine.history("first").projectTokens, 120);
  assert.equal(engine.history("other").projectTokens, undefined);
  const context = engine.buildContext("first", { playheadFrame: 12 }, codexAgent).text;
  assert.match(context, /frame 12/);
  assert.doesNotMatch(context, /999|wrong/);
});

for (const reportedBeforeReset of [true, false]) {
  test(`reset during a request preserves tokens once and keeps history empty (reported=${reportedBeforeReset})`, () => {
    const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-reset-")));
    const engine = new ChatEngine({ paths, emit() {} });
    const usage = { inputTokens: 100, outputTokens: 20, cachedInputTokens: 80, cacheWriteTokens: 0, totalTokens: 120 };
    const message = { id: "running", role: "assistant", at: 1, parts: [], status: "running" };
    const turn = { slug: "first", message, child: {}, agent: codexAgent, startedAt: Date.now() };
    engine.upsertMessage("first", message);
    engine.turns.set("first", turn);
    if (reportedBeforeReset) engine.handleEvent(turn, { type: "result", ok: true, usage });
    engine.reset("first");
    engine.reset("first");
    engine.handleEvent(turn, { type: "result", ok: true, usage, sessionId: "old-session", text: "Old answer" });
    engine.finishResetTurn(turn);
    const history = engine.history("first");
    assert.equal(history.projectTokens, 120);
    assert.equal(history.sessionId, null);
    assert.deepEqual(history.messages, []);
  });
}

test("queued context is copied before agent lookup and cannot follow later editor changes", async () => {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-context-")));
  const page = { activeProject: "first", playheadFrame: 12, selectedClipIds: ["original"] };
  const context = { references: [{ path: "notes.md", kind: "file" }] };
  const engine = new ChatEngine({ paths, emit() {}, getPageContext: () => page, addDirs: [] });
  engine.resolveAgent = async () => {
    page.selectedClipIds.push("later");
    context.references[0].path = "changed.md";
    return { adapter: codexAgent, model: null, effort: null };
  };
  engine.turns.set("busy", {});
  await engine.send("first", "Make a video", context);
  assert.deepEqual(engine.queue[0].context.selectedClipIds, ["original"]);
  assert.equal(engine.queue[0].context.references[0].path, "notes.md");
});

test("MCP defaults stay on the assigned project when the editor changes; explicit targets and agent-created projects work", async () => {
  const previous = process.env.AGENTCUT_PROJECT;
  const handlers = new Map();
  const calls = [];
  let open = "first";
  setBridgeExtension({
    handleLocalCall(method, params) {
      calls.push({ method, params });
      if (method === "studio_page_status") return Promise.resolve({ activeProject: open });
      if (method === "studio.local.create_project") return Promise.resolve({ slug: "created" });
      return Promise.resolve({});
    },
  });
  registerStudioTools({ registerTool(name, _config, handler) { handlers.set(name, handler); } });
  try {
    process.env.AGENTCUT_PROJECT = "first";
    open = "second";
    await handlers.get("agentcut_status")({});
    assert.equal(calls.find(c => c.method === "studio.local.project_state").params.slug, "first");
    await handlers.get("agentcut_read_file")({ path: "notes.md" });
    assert.equal(calls.at(-1).params.project, "first");
    await handlers.get("agentcut_read_file")({ path: "notes.md", project: "explicit" });
    assert.equal(calls.at(-1).params.project, "explicit");
    await handlers.get("agentcut_capture_frames")({ frames: [0] });
    assert.equal(calls.at(-1).params.project, "first");
    await handlers.get("agentcut_create_project")({ name: "Created" });
    assert.equal(calls.at(-1).params.fromProject, "first");
    assert.equal(calls.at(-1).params.slug, undefined);
    await handlers.get("agentcut_read_file")({ path: "notes.md" });
    assert.equal(calls.at(-1).params.project, "created");
    delete process.env.AGENTCUT_PROJECT;
    await handlers.get("agentcut_status")({});
    assert.equal(calls.at(-1).params.slug, "second");
  } finally {
    setBridgeExtension(null);
    if (previous === undefined) delete process.env.AGENTCUT_PROJECT;
    else process.env.AGENTCUT_PROJECT = previous;
  }
});
