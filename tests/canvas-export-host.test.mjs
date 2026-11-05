import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tempDir } from "./helpers/temp.mjs";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import {
  createProject,
  readProjectState,
} from "../packages/agentcut/src/studio/projects.ts";
import { StudioHost } from "../packages/agentcut/src/studio/host.ts";
test("snapshot reuses the bundle and awaits a pending build without changing the page session", async () => {
  const paths = workspacePaths(
      tempDir(join(tmpdir(), "agentcut-export-snapshot-")),
    ),
    { slug } = createProject(paths, { name: "Snapshot" });
  let builds = 0;
  const original = {
    activeProject: "keep-selected",
    selectedClipIds: ["keep-selection"],
    playheadFrame: 77,
  };
  const host = {
    paths,
    pageSession: original,
    bundles: new Map([[slug, { slug, revision: 1 }]]),
    building: new Map(),
    watchProject() {},
    rebuild() {
      builds++;
      throw Error("unexpected rebuild");
    },
    bundleSummary: (b) => b,
    chat: { history: () => ({ running: null, messages: [] }) },
  };
  assert.equal(
    (await StudioHost.prototype.openProject.call(host, slug, true)).bundle
      .revision,
    1,
  );
  assert.equal(builds, 0);
  assert.deepEqual(host.pageSession, original);
  host.building.set(slug, Promise.resolve({ slug, revision: 2 }));
  assert.equal(
    (await StudioHost.prototype.openProject.call(host, slug, true)).bundle
      .revision,
    2,
  );
  assert.equal(builds, 0);
});
test("manual local render rejects edits and changed project/code before launching a renderer", async () => {
  const paths = workspacePaths(
      tempDir(join(tmpdir(), "agentcut-export-guard-")),
    ),
    { slug } = createProject(paths, { name: "Guard" }),
    state = readProjectState(paths, slug);
  for (const status of ["running", "queued"]) {
    const host = {
      chat: {
        history: () => ({
          running: status === "running" ? "turn" : null,
          messages: status === "queued" ? [{ status: "queued" }] : [],
        }),
      },
    };
    await assert.rejects(
      StudioHost.prototype.renderLocal.call(host, slug, "wide", {
        expectedProjectHash: state.projectHash,
      }),
      /edit to finish/,
    );
  }
  const host = {
    paths,
    chat: { history: () => ({ running: null, messages: [] }) },
    building: new Map(),
    bundles: new Map([[slug, { revision: 2 }]]),
  };
  await assert.rejects(
    StudioHost.prototype.renderLocal.call(host, slug, "wide", {
      expectedProjectHash: "old",
    }),
    /changed/,
  );
  await assert.rejects(
    StudioHost.prototype.renderLocal.call(host, slug, "wide", {
      expectedBundleRevision: 1,
    }),
    /code changed/,
  );
  const response = await StudioHost.prototype.handlePageRequest.call(
    {},
    "studio.render.cancel",
    { slug: "not-rendering" },
  );
  assert.deepEqual(response, { cancelled: false });
});
