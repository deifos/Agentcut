import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import {
  listLibrary,
  createProject,
} from "../packages/agentcut/src/studio/projects.ts";
import { saveEditingStyle } from "../packages/agentcut/src/studio/editing-styles.ts";
import {
  editingStyleIds,
  parseEditingStyle,
  applyEditingStyleRequest,
  saveEditingStyleRequest,
} from "../lib/studio/editing-styles.ts";

const input = {
  name: "Interview edits",
  description: "Captions and measured sound levels.",
  prompt:
    "Use bottom captions with the recorded font and colors. Choose fresh B-roll relevant to the new speaker's words. Review captions and audio after edits.",
};
function workspace() {
  const paths = workspacePaths(
    mkdtempSync(join(tmpdir(), "agentcut-editing-styles-")),
  );
  mkdirSync(paths.library, { recursive: true });
  return paths;
}

test("save, discover and reuse instructions across projects without changing source media or preset kits", () => {
  const paths = workspace();
  const source = createProject(paths, { name: "Source", fonts: [] }).slug;
  const target = createProject(paths, {
    name: "Other footage",
    fonts: [],
  }).slug;
  const sourceFile = join(paths.projects, source, "layers.json");
  const original = readFileSync(sourceFile, "utf8");
  const kit = join(paths.library, "presets", "existing");
  mkdirSync(kit, { recursive: true });
  writeFileSync(join(kit, "PROMPT.md"), "Keep the old kit.");
  const first = saveEditingStyle(paths, input);
  const second = saveEditingStyle(paths, {
    ...input,
    prompt: "A different set of rules.",
  });
  assert.notEqual(first.id, second.id);
  const entries = listLibrary(paths);
  assert.deepEqual(editingStyleIds(entries), [first.id, second.id].sort());
  const meta = JSON.parse(
    readFileSync(
      join(paths.library, "editing-styles", first.id, "style.json"),
      "utf8",
    ),
  );
  const style = parseEditingStyle(
    first.id,
    meta,
    readFileSync(join(paths.library, first.promptPath), "utf8"),
  );
  assert.equal(style.prompt, input.prompt);
  const request = applyEditingStyleRequest(style, target);
  assert.ok(request.includes(JSON.stringify(target)));
  assert.ok(!request.includes(JSON.stringify(source)));
  assert.match(request, /fresh, relevant B-roll/);
  assert.equal(readFileSync(sourceFile, "utf8"), original);
  assert.equal(
    readFileSync(join(kit, "PROMPT.md"), "utf8"),
    "Keep the old kit.",
  );
});

test("reject invalid metadata and empty rules; tolerate a maximum-length prompt and non-Latin names", () => {
  const paths = workspace();
  for (const invalid of [
    { ...input, name: " " },
    { ...input, prompt: " " },
    { ...input, description: "" },
    { ...input, name: "x".repeat(81) },
    { ...input, prompt: "x".repeat(64001) },
  ]) {
    assert.throws(() => saveEditingStyle(paths, invalid));
  }
  const saved = saveEditingStyle(paths, {
    ...input,
    name: "剪辑",
    prompt: "x".repeat(64000),
  });
  assert.match(saved.id, /^[a-z0-9][a-z0-9-]{0,63}$/);
  assert.equal(
    saveEditingStyle(paths, { ...input, name: "CON" }).id,
    "style-con",
  );
  assert.equal(
    parseEditingStyle(
      saved.id,
      { version: 1, name: "剪辑", description: "Rules" },
      readFileSync(join(paths.library, saved.promptPath), "utf8"),
    ).prompt.length,
    64000,
  );
  for (const meta of [
    null,
    {},
    { version: 2, name: "Test", description: "Rules" },
  ])
    assert.throws(() => parseEditingStyle("test", meta, "Rules"));
  assert.throws(() =>
    parseEditingStyle("../escape", { version: 1, ...input }, input.prompt),
  );
  assert.deepEqual(
    editingStyleIds([
      { path: "library:editing-styles/incomplete/style.json" },
      { path: "library:presets/kit/PROMPT.md" },
    ]),
    [],
  );
  assert.match(
    saveEditingStyleRequest("My style", "source"),
    /Do not invent past actions/,
  );
});

test(
  "MCP save tool writes a discoverable style that a separate project can read through HTTP and MCP",
  { timeout: 30000 },
  async () => {
    const server = createServer();
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const port = server.address().port;
    await new Promise((done) => server.close(done));
    const paths = workspace();
    const helper = spawn(
      process.execPath,
      [resolve("tests/fixtures/mcp-file-helper.mjs"), paths.root],
      {
        windowsHide: true,
        stdio: "ignore",
        env: { ...process.env, AGENTCUT_PORT: String(port) },
      },
    );
    let client;
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          ready = (await fetch(`http://127.0.0.1:${port}/status`)).ok;
        } catch {}
        if (ready) break;
        await new Promise((done) => setTimeout(done, 100));
      }
      assert.ok(ready, "isolated helper starts");
      client = new Client({ name: "editing-style-test", version: "1" });
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [resolve("packages/agentcut/dist/index.js")],
          env: { ...process.env, AGENTCUT_PORT: String(port) },
          stderr: "pipe",
        }),
      );
      const call = async (name, args) => {
        const result = await client.callTool({ name, arguments: args });
        assert.ok(!result.isError, JSON.stringify(result));
        return JSON.parse(
          result.content.find((entry) => entry.type === "text").text,
        );
      };
      const saved = await call("agentcut_save_editing_style", input);
      const duplicate = await call("agentcut_save_editing_style", input);
      assert.notEqual(saved.id, duplicate.id);
      const read = await call("agentcut_read_file", {
        scope: "library",
        path: saved.promptPath,
      });
      assert.equal(read.content.trim(), input.prompt);
      const response = await fetch(
        `http://127.0.0.1:${port}/studio/library/editing-styles/${saved.id}/style.json`,
      );
      assert.ok(response.ok);
      const meta = await response.json();
      assert.equal(
        parseEditingStyle(saved.id, meta, read.content).name,
        input.name,
      );
      const invalid = await client.callTool({
        name: "agentcut_save_editing_style",
        arguments: { ...input, name: " " },
      });
      assert.equal(invalid.isError, true);
      const other = await call("agentcut_create_project", {
        name: "New footage",
        fonts: [],
      });
      const reread = await call("agentcut_read_file", {
        scope: "library",
        project: other.slug,
        path: saved.promptPath,
      });
      assert.equal(reread.content, read.content);
    } finally {
      await client?.close();
      helper.kill();
    }
  },
);
