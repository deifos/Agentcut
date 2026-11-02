import assert from "node:assert/strict";
import { tempDir } from "./helpers/temp.mjs";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  ReleaseVideos,
  releasePlan,
} from "../packages/agentcut/src/studio/release-video.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { readProjectState } from "../packages/agentcut/src/studio/projects.ts";
import { createProject } from "../packages/agentcut/src/studio/projects.ts";
import { buildReleaseEdit } from "../packages/agentcut/src/studio/release-edit.ts";
import { ReleaseBrowser } from "../packages/agentcut/src/studio/release-browser.ts";

test("browser setup can retry after a failed attempt", async () => {
  const browser = new ReleaseBrowser("retry-test", "unused", false);
  await assert.rejects(browser.setup(() => { throw new Error("first attempt"); }), /first attempt/);
  await assert.rejects(browser.setup(() => { throw new Error("second attempt"); }), /second attempt/);
});

test("shutdown closes retained browsers without changing finished job states", async () => {
  const service = new ReleaseVideos(deps(tempDir(join(tmpdir(), "agentcut-close-"))));
  const closed = [];
  for (const stage of ["ready", "failed", "cancelled", "planning"]) {
    service.jobs.set(stage, { id: stage, slug: stage, stage });
    service.browsers.set(stage, { close: async () => { closed.push(stage); } });
  }
  await service.close();
  assert.deepEqual(closed.sort(), ["cancelled", "failed", "planning", "ready"]);
  assert.equal(service.get("ready").stage, "ready");
  assert.equal(service.get("failed").stage, "failed");
  assert.equal(service.get("planning").stage, "cancelled");
  await service.close();
  assert.equal(closed.length, 4);
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
test("story edit keeps the action between adjacent source cuts and text editable", () => {
  const root = tempDir(join(tmpdir(), "agentcut-edit-cues-"));
  const config = deps(root);
  const { slug } = createProject(config.paths, {
    name: "Cue timing",
    fonts: [],
  });
  const storyData = {
    audience: "Owners",
    message: "A visible action has a result.",
    before: "Before",
    after: "After",
    disclosure: "Fictional demo",
  };
  buildReleaseEdit(
    config.paths,
    {
      slug,
      input: { name: "Cue timing" },
      recordings: [
        {
          path: "assets/test.mp4",
          title: "Action",
          seconds: 8,
          cues: [
            { actionIndex: 0, start: 0.8, end: 1.3 },
            { actionIndex: 1, start: 4.6, end: 5.1 },
          ],
        },
      ],
    },
    {
      opening: "An action",
      closing: "A result",
      story: storyData,
      scenes: [
        {
          title: "Action",
          purpose: "Demonstrate",
          evidence: "Observed control",
          expectedChange: "Result",
          beats: [
            {
              actionIndex: 0,
              headline: "Do this",
              explanation: "See the action.",
            },
            {
              actionIndex: 1,
              headline: "Then this",
              explanation: "Read the result.",
            },
          ],
        },
      ],
    },
  );
  const state = readProjectState(config.paths, slug);
  assert.deepEqual(
    state.issues.filter((i) => i.severity === "error"),
    [],
  );
  const footage = state.layers.tracks.find((t) => t.id === "footage").clips;
  assert.equal(footage.length, 2);
  assert.equal(footage[0].trimStart, 0);
  assert.equal(
    footage[0].trimStart + footage[0].duration,
    footage[1].trimStart,
  );
  assert.ok(footage[1].trimStart < 4.6 * 30);
  assert.equal(footage[1].from, footage[0].from + footage[0].duration);
  assert.equal(
    state.layers.tracks.find((t) => t.id === "explanations").clips.length,
    2,
  );
  assert.equal(
    state.layers.tracks.find((t) => t.id === "disclosure").clips[0].text,
    "Fictional demo",
  );
});
const story = {
  audience: "Website owners",
  message: "The same bot can answer Instagram DMs, and an owner can reply.",
  before: "Questions arrive through different channels.",
  after: "AI and staff can answer from the shared inbox.",
  captureBasis: "approved_demo",
  disclosure: "Local test fixture — sample data",
};
const shot = {
  purpose: "Show the feature in the inspected interface.",
  evidence: "The local fixture exposes the named view and control.",
  expectedChange: "The hover state makes the selected control visible.",
};
function deps(root) {
  const paths = workspacePaths(root);
  mkdirSync(paths.projects, { recursive: true });
  return {
    paths,
    editorOrigin: "http://localhost:3000",
    changed() {},
    runAgent: async () => {},
    cancelAgent() {},
    build: async () => {},
    open: async () => {},
  };
}

test("unsupported video types and credential URLs do not create projects", () => {
  const root = tempDir(join(tmpdir(), "agentcut-release-state-"));
  const service = new ReleaseVideos(deps(root));
  for (const videoType of ["how-to", "promotional"]) {
    assert.throws(
      () =>
        service.create({
          name: "Release",
          appUrl: "https://example.test",
          description: "New feature",
          videoType,
        }),
      /Only announcement/,
    );
  }
  assert.throws(
    () =>
      service.create({
        name: "Release",
        appUrl: "https://user:secret@example.test",
        description: "New feature",
      }),
    /without credentials/,
  );
  assert.equal(service.list().length, 0);
});

test("capture needs a story, observed shot evidence, action and demo disclosure", async () => {
  const scene = {
    ...shot,
    title: "Inspected view",
    url: "https://example.test",
    privacyReviewed: true,
    actions: [{ action: "hover", selector: "button" }],
  };
  const plan = { story, opening: "Before", closing: "After", scenes: [scene] };
  assert.equal(releasePlan.parse(plan).story.captureBasis, "approved_demo");
  assert.throws(() => releasePlan.parse({ ...plan, story: undefined }));
  assert.throws(() =>
    releasePlan.parse({ ...plan, story: { ...story, disclosure: undefined } }),
  );
  assert.throws(() =>
    releasePlan.parse({ ...plan, scenes: [{ ...scene, evidence: "" }] }),
  );
  const root = tempDir(join(tmpdir(), "agentcut-release-story-"));
  const service = new ReleaseVideos(deps(root));
  await assert.rejects(
    service.capture("unused", { ...plan, scenes: [{ ...scene, actions: [] }] }),
    /Static settings crops/,
  );
});

test("restart preserves ready jobs and marks unfinished jobs as failed", () => {
  const root = tempDir(join(tmpdir(), "agentcut-release-restart-"));
  const config = deps(root);
  const folder = join(config.paths.internal, "release-jobs");
  mkdirSync(folder, { recursive: true });
  for (const [id, stage] of [
    ["aaa", "recording"],
    ["bbb", "ready"],
    ["ccc", "login_needed"],
  ]) {
    writeFileSync(
      join(folder, `${id}.json`),
      JSON.stringify({ id, slug: "test", stage, createdAt: 1, updatedAt: 1 }),
    );
  }
  const service = new ReleaseVideos(config);
  assert.equal(service.get("aaa").stage, "failed");
  assert.match(service.get("aaa").error, /helper stopped/);
  assert.equal(service.get("bbb").stage, "ready");
  assert.equal(service.get("ccc").stage, "failed");
  assert.throws(() =>
    releasePlan.parse({
      story,
      opening: "New",
      closing: "Try it",
      scenes: [
        {
          ...shot,
          title: "Unsafe",
          url: "https://example.test",
          privacyReviewed: false,
        },
      ],
    }),
  );
});

test(
  "real MCP → managed browser capture → editable announcement and exact editor URL",
  { skip: process.env.AGENTCUT_RELEASE_E2E !== "1", timeout: 600_000 },
  async (t) => {
    const fixture = readFileSync(
      new URL("./fixtures/release-demo.html", import.meta.url),
    );
    const site = createServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      response.end(fixture);
    });
    await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve));
    t.after(() => {
      site.closeAllConnections();
      site.close();
    });
    const appUrl = `http://127.0.0.1:${site.address().port}`;
    const port = process.env.AGENTCUT_RELEASE_TEST_PORT || "32118";
    const root = resolve(
      process.env.AGENTCUT_RELEASE_TEST_DIR ||
        `packages/agentcut/.tmp/release-test-${port}`,
    );
    const helper = spawn(
      process.execPath,
      ["packages/agentcut/dist/studio/cli.js", "--dir", root, "--port", port],
      {
        env: {
          ...process.env,
          AGENTCUT_EDITOR_ORIGIN: "http://localhost:3000",
          AGENTCUT_DEMO_HEADLESS: "1",
          AGENTCUT_DEMO_NO_OPEN: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let log = "";
    helper.stderr.on("data", (data) => {
      log += data;
    });
    helper.stdout.on("data", (data) => {
      log += data;
    });
    t.after(() => helper.kill());
    for (let i = 0; i < 120 && !log.includes("Keep this window open"); i++) {
      if (helper.exitCode !== null) throw new Error(log);
      await wait(500);
    }
    assert.match(log, /Keep this window open/, log);
    const client = new Client({ name: "release-e2e", version: "1.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve("packages/agentcut/dist/index.js")],
      env: { ...process.env, AGENTCUT_PORT: port },
      stderr: "pipe",
    });
    await client.connect(transport);
    t.after(() => client.close());
    async function tool(name, args) {
      const result = await client.callTool(
        { name, arguments: args },
        undefined,
        { timeout: 600_000 },
      );
      const text = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      if (result.isError) throw new Error(text);
      return JSON.parse(text);
    }
    async function settled(id) {
      for (let i = 0; i < 400; i++) {
        const job = await tool("agentcut_release_status", { job: id });
        if (job.stage !== "setup") {
          assert.notEqual(job.stage, "failed", job.error);
          return job;
        }
        await wait(500);
      }
      throw new Error("Browser setup timed out");
    }
    const created = await tool("agentcut_create_release_video", {
      name: "Chat with Website — Instagram announcement (local sample)",
      appUrl: `${appUrl}/login`,
      description:
        "Your website bot now answers Instagram DMs. You can also reply yourself. Use only the prepared sample conversations. Do not send any messages.",
      videoType: "announcement",
      orchestration: "caller",
      showCursor: true,
    });
    assert.equal((await settled(created.id)).stage, "login_needed");
    // Simulates the user's direct interaction with the separate profile, never a password in MCP.
    const { ReleaseBrowser } =
      await import("../packages/agentcut/src/studio/release-browser.ts");
    const userBrowser = new ReleaseBrowser(
      `release-${created.id}`,
      join(root, ".agentcut", "release-jobs", created.id, "profile"),
      false,
    );
    t.after(() => userBrowser.close());
    await userBrowser.command(["open", `${appUrl}/settings`]);
    assert.equal(
      (await tool("agentcut_release_resume", { job: created.id })).stage,
      "planning",
    );
    await assert.rejects(
      tool("agentcut_release_capture", {
        job: created.id,
        plan: {
          story,
          opening: "New",
          closing: "Try it",
          scenes: [
            {
              ...shot,
              title: "Wrong origin",
              url: "https://example.test",
              privacyReviewed: true,
              actions: [{ action: "hover", selector: "body" }],
            },
          ],
        },
      }),
      /origin/,
    );
    const scenes = [];
    for (const [path, title, expected] of [
      ["settings", "Connect Instagram once", "Connected"],
      ["bot", "Your website bot answers Instagram DMs", "Sample visitor"],
      ["manual", "You can also reply yourself", "Prepared reply"],
    ]) {
      await tool("agentcut_release_browser", {
        job: created.id,
        command: { action: "open", url: `${appUrl}/${path}` },
      });
      const snapshot = await tool("agentcut_release_browser", {
        job: created.id,
        command: { action: "snapshot" },
      });
      assert.match(JSON.stringify(snapshot.result), new RegExp(expected));
      scenes.push({
        ...shot,
        title,
        url: `${appUrl}/${path}`,
        seconds: 3,
        actions: [
          {
            action: "hover",
            selector: `#${path === "settings" ? "settings" : path}`,
          },
          {
            action: "click",
            selector: `#${path === "settings" ? "settings" : path}`,
          },
        ],
        privacyReviewed: true,
        focus: { x: 0.1, y: 0.15, width: 0.8, height: 0.8 },
      });
    }
    const completed = await tool("agentcut_release_capture", {
      job: created.id,
      plan: {
        story,
        opening: "Your website bot. Now in Instagram DMs.",
        closing: "Automatic answers. A human touch.",
        scenes,
      },
    });
    assert.equal(completed.stage, "ready", completed.error);
    assert.equal(completed.recordings.length, 3);
    assert.equal(
      new URL(completed.editorUrl).searchParams.get("project"),
      completed.slug,
    );
    const state = readProjectState(workspacePaths(root), completed.slug);
    assert.deepEqual(
      state.issues.filter((issue) => issue.severity === "error"),
      [],
    );
    assert.equal(
      state.layers.tracks.find((track) => track.kind === "video").clips.length,
      3,
    );
    for (const take of completed.recordings) {
      assert.ok(take.seconds >= 3);
      assert.ok(existsSync(join(state.dir, take.path)));
    }
    assert.equal(
      (await tool("agentcut_release_cancel", { job: created.id })).stage,
      "ready",
    );
    writeFileSync(
      join(root, "release-demo-result.json"),
      JSON.stringify(completed, null, 2),
    );
    const review = new ReleaseBrowser(
      `review-${created.id}`,
      join(root, ".agentcut", "release-review-profile"),
      false,
    );
    t.after(() => review.close());
    await review.command(["open", completed.editorUrl]);
    let editor;
    for (let i = 0; i < 100; i++) {
      try {
        editor = await tool("agentcut_status", { project: completed.slug });
        if (editor.page.activeProject === completed.slug) break;
      } catch {}
      await wait(500);
    }
    assert.equal(
      editor?.page.activeProject,
      completed.slug,
      "The exact editor project must be open",
    );
    const frames = await tool("agentcut_capture_frames", {
      project: completed.slug,
      frames: [30, 120],
      scale: 0.5,
    });
    assert.doesNotMatch(
      JSON.stringify(frames),
      /MediaPlaybackError|MEDIA_ELEMENT_ERROR/,
    );
    const playback = await tool("agentcut_preview_check", {
      project: completed.slug,
      from: 90,
      to: 180,
    });
    assert.doesNotMatch(
      JSON.stringify(playback),
      /MediaPlaybackError|MEDIA_ELEMENT_ERROR/,
    );
    console.log(`Verified draft: ${completed.editorUrl}\nWorkspace: ${root}`);

    const cancelled = await tool("agentcut_create_release_video", {
      name: "Cancelled demo",
      appUrl,
      description: "Cancel before capture",
      orchestration: "caller",
    });
    assert.equal(
      (await tool("agentcut_release_cancel", { job: cancelled.id })).stage,
      "cancelled",
    );
    await wait(500);
    assert.equal(
      (await tool("agentcut_release_status", { job: cancelled.id })).stage,
      "cancelled",
    );
    const denied = await tool("agentcut_create_release_video", {
      name: "Blocked send test",
      appUrl: `${appUrl}/manual`,
      description: "Inspect only; never send",
      orchestration: "caller",
    });
    assert.equal((await settled(denied.id)).stage, "planning");
    await assert.rejects(
      tool("agentcut_release_browser", {
        job: denied.id,
        command: { action: "click", selector: "button" },
      }),
      /not permitted/,
    );
    const failure = await tool("agentcut_release_status", { job: denied.id });
    assert.equal(failure.stage, "failed");
    assert.deepEqual(failure.recordings, []);
    const recovered = await tool("agentcut_release_resume", { job: denied.id });
    assert.equal(recovered.id, denied.id);
    assert.equal(recovered.slug, denied.slug);
    assert.equal(recovered.stage, "planning");
    assert.equal(
      (await tool("agentcut_release_cancel", { job: denied.id })).stage,
      "cancelled",
    );
  },
);
