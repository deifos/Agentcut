import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { createProject } from "../packages/agentcut/src/studio/projects.ts";
import {
  readMcpFile,
  writeMcpFile,
  copyMcpFile,
  listMcpFiles,
} from "../packages/agentcut/src/studio/mcp-files.ts";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const root = resolve("packages/agentcut/.tmp");
mkdirSync(root, { recursive: true });
async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}
async function connect(port) {
  const client = new Client({ name: "external-access-test", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [resolve("packages/agentcut/dist/index.js")],
      env: { ...process.env, AGENTCUT_PORT: String(port) },
      stderr: "pipe",
    }),
  );
  return client;
}
async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError)
    throw new Error(result.content.map((item) => item.text ?? "").join("\n"));
  return JSON.parse(result.content[0].text);
}

test("external stdio client discovers the full toolkit, reads the shipped skill and receives native images", async () => {
  const calls = [];
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=";
  // This fixture checks protocol transport, not browser rendering quality.
  const bridge = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/status") {
      res.end(JSON.stringify({ ok: true, studio: true }));
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    calls.push(request);
    res.end(
      JSON.stringify({
        result: {
          frames: [{ frame: 0, dataUrl: `data:image/png;base64,${png}` }],
        },
      }),
    );
  });
  const port = await listen(bridge);
  const client = await connect(port);
  try {
    assert.match(client.getInstructions(), /same skills/);
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    const capabilities = await call(client, "agentcut_capabilities");
    assert.deepEqual(
      capabilities.tools.map((tool) => tool.name).sort(),
      [...tools].sort(),
    );
    for (const name of [
      "agentcut_components",
      "agentcut_music_catalog",
      "agentcut_add_catalog_music",
      "agentcut_sfx_catalog",
      "agentcut_add_sfx",
      "agentcut_generate_voice",
      "agentcut_generate_music",
      "agentcut_transcribe",
      "agentcut_listen_critique",
      "agentcut_export",
      "agentcut_write_file",
      "agentcut_copy_file",
    ]) {
      assert.ok(tools.includes(name), name);
      assert.ok(
        capabilities.tools.some((tool) => tool.name === name),
        name,
      );
    }
    const guide = await client.callTool({
      name: "agentcut_guide",
      arguments: { path: "SKILL.md" },
    });
    assert.equal(
      guide.content[0].text,
      readFileSync("skills/agentcut/SKILL.md", "utf8"),
    );
    const resources = await client.listResources();
    assert.ok(
      resources.resources.some(
        (item) => item.uri === "agentcut://guide/references/sound.md",
      ),
    );
    const sound = await client.readResource({
      uri: "agentcut://guide/references/sound.md",
    });
    assert.equal(
      sound.contents[0].text,
      readFileSync("skills/agentcut/references/sound.md", "utf8"),
    );
    const denied = await client.callTool({
      name: "agentcut_guide",
      arguments: { path: "../../package.json" },
    });
    assert.equal(denied.isError, true);
    const capture = await client.callTool({
      name: "agentcut_capture_frames",
      arguments: { frames: [0] },
    });
    assert.equal(capture.content[1].type, "image");
    assert.equal(capture.content[1].data, png);
    const metadata = JSON.parse(capture.content[0].text);
    assert.ok(metadata.frames[0].filePath);
    assert.equal(metadata.frames[0].dataUrl, undefined);
    assert.equal(calls[0].includeImages, true);
  } finally {
    await client.close();
    await new Promise((resolve) => bridge.close(resolve));
  }
});

test("helper file handlers support project authoring and preset reuse over MCP without a shared client disk", async () => {
  const placeholder = createServer();
  const port = await listen(placeholder);
  await new Promise((resolve) => placeholder.close(resolve));
  const workspace = mkdtempSync(join(root, "mcp-access-"));
  const sourceDir = join(workspace, "allowed-app");
  mkdirSync(sourceDir);
  writeFileSync(
    join(sourceDir, "Screen.tsx"),
    "export const Screen = () => null;\n",
  );
  writeFileSync(join(sourceDir, ".env"), "PRIVATE_TEST_FIXTURE=hidden\n");
  const helper = spawn(
    process.execPath,
    [resolve("tests/fixtures/mcp-file-helper.mjs"), workspace, sourceDir],
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
        const response = await fetch(`http://127.0.0.1:${port}/status`);
        ready = response.ok;
      } catch {}
      if (ready) break;
      await pause(100);
    }
    assert.equal(ready, true, "helper starts");
    client = await connect(port);
    const allowedSources = await call(client, "agentcut_sources");
    assert.equal(allowedSources.sources.length, 1);
    const source = allowedSources.sources[0].id;
    const sourceCode = await call(client, "agentcut_read_file", {
      scope: "source",
      source,
      path: "Screen.tsx",
    });
    assert.match(sourceCode.content, /export const Screen/);
    const sourceFiles = await call(client, "agentcut_list_files", {
      scope: "source",
      source,
    });
    assert.deepEqual(
      sourceFiles.entries.map((file) => file.path),
      ["Screen.tsx"],
    );
    const arbitrary = await client.callTool({
      name: "agentcut_read_file",
      arguments: { scope: "source", source: sourceDir, path: "Screen.tsx" },
    });
    assert.equal(arbitrary.isError, true);
    const created = await call(client, "agentcut_create_project", {
      name: "MCP access test",
      fonts: [],
    });
    const project = created.slug;
    const manifest = await call(client, "agentcut_read_file", {
      project,
      path: "project.json",
    });
    assert.equal(JSON.parse(manifest.content).name, "MCP access test");
    const note = await call(client, "agentcut_read_file", {
      project,
      path: "notes.md",
    });
    await call(client, "agentcut_write_file", {
      project,
      path: "notes.md",
      content: "# MCP draft\n",
      baseHash: note.hash,
    });
    const stale = await client.callTool({
      name: "agentcut_write_file",
      arguments: {
        project,
        path: "notes.md",
        content: "overwrite",
        baseHash: note.hash,
      },
    });
    assert.equal(stale.isError, true);
    assert.equal(
      readFileSync(join(workspace, "projects", project, "notes.md"), "utf8"),
      "# MCP draft\n",
    );
    await call(client, "agentcut_write_file", {
      project,
      path: "scenes/Opening.tsx",
      content:
        "export default function Opening() { return <div>Ready</div>; }\n",
      baseHash: null,
    });
    const files = await call(client, "agentcut_list_files", {
      project,
      path: "scenes",
    });
    assert.ok(files.entries.some((file) => file.path === "scenes/Opening.tsx"));
    const styles = await call(client, "agentcut_read_file", {
      scope: "toolkit",
      path: "components/STYLES.md",
    });
    assert.ok(styles.content.length > 100);
    const presets = await call(client, "agentcut_list_files", {
      scope: "library",
      path: "presets",
    });
    assert.ok(presets.entries.length > 0);
    const recipePath = `${presets.entries[0].path}/PROMPT.md`;
    const recipe = await call(client, "agentcut_read_file", {
      scope: "library",
      path: recipePath,
    });
    assert.ok(recipe.content.length > 100);
    await call(client, "agentcut_copy_file", {
      scope: "library",
      source: recipePath,
      project,
      destination: "assets/preset-recipe.md",
    });
    assert.equal(
      readFileSync(
        join(workspace, "projects", project, "assets", "preset-recipe.md"),
        "utf8",
      ),
      recipe.content,
    );
    const invalid = await client.callTool({
      name: "agentcut_write_file",
      arguments: {
        project,
        path: "project.json",
        content: "{}",
        baseHash: manifest.hash,
      },
    });
    assert.equal(invalid.isError, true);
    assert.equal(
      (
        await call(client, "agentcut_read_file", {
          project,
          path: "project.json",
        })
      ).hash,
      manifest.hash,
    );
  } finally {
    await client?.close();
    helper.kill();
  }
});

test("file access blocks traversal, private state, linked escapes, stale writes and asset overwrite", () => {
  const paths = workspacePaths(
    mkdtempSync(join(tmpdir(), "agentcut-mcp-files-")),
  );
  mkdirSync(paths.projects, { recursive: true });
  mkdirSync(paths.library);
  const { slug } = createProject(paths, { name: "Bounds", fonts: [] });
  for (const path of [
    "../notes.md",
    ".studio/chat.json",
    "assets/.env",
    "C:/secret.txt",
    "/notes.md",
  ]) {
    assert.throws(
      () => readMcpFile(paths, "project", slug, path),
      /relative visible/,
    );
  }
  assert.throws(
    () => writeMcpFile(paths, slug, "package.json", "{}", null),
    /Write project.json/,
  );
  const outside = mkdtempSync(join(tmpdir(), "agentcut-mcp-outside-"));
  writeFileSync(join(outside, "secret.txt"), "outside");
  symlinkSync(
    outside,
    join(paths.projects, slug, "assets", "linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(
    () => readMcpFile(paths, "project", slug, "assets/linked/secret.txt"),
    /through a link/,
  );
  assert.throws(
    () => writeMcpFile(paths, slug, "assets/linked/new.txt", "bad", null),
    /through a link/,
  );
  assert.ok(
    !listMcpFiles(paths, "project", slug, "assets").entries.some((file) =>
      file.path.endsWith("linked"),
    ),
  );
  writeFileSync(join(paths.library, "image.png"), Buffer.from([1, 2, 3]));
  const privateDir = join(paths.projects, slug, ".studio");
  mkdirSync(privateDir, { recursive: true });
  writeFileSync(join(privateDir, "private.json"), "{}");
  symlinkSync(privateDir, join(paths.projects, slug, "assets", "private-link"),
    process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => readMcpFile(paths, "project", slug, "assets/private-link/private.json"), /Linked paths/);
  assert.throws(() => writeMcpFile(paths, slug, "assets/private-link/new.json", "{}", null), /Linked paths/);
  assert.throws(() => copyMcpFile(paths, "project", slug, "assets/private-link/private.json", slug, "assets/leak.json"), /Linked paths/);
  assert.ok(!listMcpFiles(paths, "project", slug, "assets").entries.some(file => file.path.endsWith("private-link")));
  copyMcpFile(
    paths,
    "library",
    undefined,
    "image.png",
    slug,
    "assets/image.png",
  );
  assert.throws(
    () =>
      copyMcpFile(
        paths,
        "library",
        undefined,
        "image.png",
        slug,
        "assets/image.png",
      ),
    /exist/i,
  );
  assert.deepEqual(
    readFileSync(join(paths.projects, slug, "assets", "image.png")),
    Buffer.from([1, 2, 3]),
  );
});
