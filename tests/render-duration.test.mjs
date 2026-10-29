import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readRenderDuration, saveRenderDuration } from "../packages/agentcut/src/studio/render-metadata.ts";
import { formatRenderDuration } from "../lib/studio/format.ts";
import { listAssets } from "../packages/agentcut/src/studio/projects.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";

test("saved timing survives reload; legacy and invalid records have no timing", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentcut-timing-"));
  const video = join(dir, "video.mp4");
  try {
    assert.equal(readRenderDuration(video), undefined);
    saveRenderDuration(video, 830854);
    assert.equal(readRenderDuration(video), 830854);
    assert.equal(formatRenderDuration(readRenderDuration(video)), "13m 50s");
    for (const record of ["broken", "null", '{"version":1,"durationMs":-1}', '{"version":1,"durationMs":"100"}', '{"version":2,"durationMs":100}']) {
      writeFileSync(`${video}.render.json`, record);
      assert.equal(readRenderDuration(video), undefined);
    }
  } finally {
    unlinkSync(`${video}.render.json`);
    rmdirSync(dir);
  }
});

test("duration is clear for short and long renders", () => {
  assert.equal(formatRenderDuration(0), "0s");
  assert.equal(formatRenderDuration(59000), "59s");
  assert.equal(formatRenderDuration(60000), "1m 0s");
  assert.equal(formatRenderDuration(3661000), "1h 1m 1s");
});

test("asset listings attach timing and hide sidecars with uppercase video extensions", () => {
  const root = mkdtempSync(join(tmpdir(), "agentcut-assets-"));
  const paths = workspacePaths(root);
  const project = join(paths.projects, "example");
  const renders = join(project, "renders");
  const video = join(renders, "video.MP4");
  mkdirSync(renders, { recursive: true });
  try {
    writeFileSync(video, "video");
    saveRenderDuration(video, 1200);
    const assets = listAssets(paths, "example");
    assert.equal(assets.length, 1);
    assert.equal(assets[0].path, "renders/video.MP4");
    assert.equal(assets[0].renderDurationMs, 1200);
  } finally {
    unlinkSync(`${video}.render.json`);
    unlinkSync(video);
    rmdirSync(renders);
    rmdirSync(project);
    rmdirSync(paths.projects);
    rmdirSync(root);
  }
});
