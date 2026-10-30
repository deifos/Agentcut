import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { codexAgent } from "../packages/agentcut/src/studio/agents/codex.ts";
import { claudeAgent } from "../packages/agentcut/src/studio/agents/claude.ts";
import { pickModel, pickEffort } from "../lib/studio/agents.ts";

test("Codex reads root TOML defaults and ignores inactive profiles", () => {
  const previous = process.env.CODEX_HOME;
  const dir = mkdtempSync(join(tmpdir(), "agentcut-models-"));
  try {
    process.env.CODEX_HOME = dir;
    const check = (config, model, effort) => {
      writeFileSync(join(dir, "config.toml"), config);
      const result = codexAgent.listModels();
      assert.equal(result.defaultModel, model);
      assert.equal(result.defaultEffort, effort);
    };
    check('[profiles.other]\nmodel = "other"\nmodel_reasoning_effort = "high"', null, null);
    check("model = 'root-model'\nmodel_reasoning_effort = 'low'\n[profiles.other]\nmodel = 'other'", "root-model", "low");
    check('model = [invalid', null, null);
  } finally {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("model changes reject an unsupported saved thinking level", () => {
  const agent = { id: "codex", models: [{ id: "a", efforts: ["low", "high"] }, { id: "b", efforts: ["low"] }] };
  assert.equal(pickModel(agent, { codex: "removed" }), null);
  assert.equal(pickModel(agent, { codex: "b" }), "b");
  assert.equal(pickEffort(agent, "b", { codex: "high" }), null);
  assert.equal(pickEffort(agent, "a", { codex: "high" }), "high");
});

test("both adapters pass model and effort on new and resumed turns", () => {
  for (const sessionId of [null, "saved-session"]) {
    const run = { workspace: ".", sessionId, images: [], mcp: { name: "agentcut", command: "node", args: [], env: {} }, mcpConfigPath: "mcp.json", settingsPath: "settings.json", allowShell: false, readDirs: [], shellDomains: [], model: "chosen-model", effort: "high" };
    const claude = claudeAgent.buildArgs(run);
    assert.equal(claude[claude.indexOf("--model") + 1], run.model);
    assert.equal(claude[claude.indexOf("--effort") + 1], run.effort);
    const codex = codexAgent.buildArgs(run);
    const config = parse(codex.filter((_, i) => codex[i - 1] === "-c").join("\n"));
    assert.equal(config.model, run.model);
    assert.equal(config.model_reasoning_effort, run.effort);
  }
});
