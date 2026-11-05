import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { resizeRender, resizeSource, resizeSlug } from "../packages/agentcut/src/studio/resize-render.ts";
import { StudioHost } from "../packages/agentcut/src/studio/host.ts";
import { ensureFfmpeg } from "../packages/agentcut/src/studio/references.ts";

test("resize only accepts a project render, never another path", () => {
  const paths = workspacePaths(mkdtempSync(join(tmpdir(), "resize-path-test-")));
  const renders = join(paths.projects, "demo", "renders");
  mkdirSync(renders, { recursive: true });
  writeFileSync(join(renders, "original.mp4"), "test");
  assert.equal(resizeSource(paths, "demo", "renders/original.mp4"), join(renders, "original.mp4"));
  writeFileSync(join(renders, "café.MP4"), "test");
  assert.equal(resizeSource(paths, "demo", "renders/café.MP4"), join(renders, "café.MP4"));
  for (const path of ["renders/../original.mp4", "assets/original.mp4", "renders/video.txt", "renders/sub/video.mp4", "C:/secret.mp4"]) {
    assert.throws(() => resizeSource(paths, "demo", path));
  }
  const outside = mkdtempSync(join(tmpdir(), "resize-outside-"));
  writeFileSync(join(outside, "outside.mp4"), "private");
  try { symlinkSync(join(outside, "outside.mp4"), join(renders, "linked.mp4")); }
  catch (error) { if (error.code === "EPERM") return; throw error; }
  assert.throws(() => resizeSource(paths, "demo", "renders/linked.mp4"), /inside/);
});

test("resizing a real render preserves its bytes, makes a smaller video, and never overwrites a copy", async () => {
  const paths = workspacePaths(mkdtempSync(join(tmpdir(), "resize-video-test-")));
  const renders = join(paths.projects, "demo", "renders");
  mkdirSync(renders, { recursive: true });
  const source = join(renders, "original.mp4");
  const ffmpeg = await ensureFfmpeg();
  const made = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "0.2", "-c:v", "libx264", "-crf", "0", "-threads", "2", "-c:a", "aac", source], { windowsHide: true });
  assert.equal(made.status, 0, made.stderr.toString());
  const hash = () => createHash("sha256").update(readFileSync(source)).digest("hex");
  const original = hash();
  // A stale sidecar must not turn a successfully saved video into a failure.
  writeFileSync(join(renders, "original-720p-smaller.mp4.render.json"), "stale");
  const pending = resizeRender(paths, "demo", "renders/original.mp4", "720p", "high");
  assert.equal(resizeSlug(), "demo");
  assert.throws(() => StudioHost.prototype.deleteProject.call({}, "demo"), /smaller copy/);
  const copy = await pending;
  assert.equal(resizeSlug(), null);
  assert.ok(copy.bytes < copy.originalBytes);
  assert.equal(hash(), original);
  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", join(paths.projects, "demo", copy.path), "-f", "null", "-"], { windowsHide: true });
  assert.equal(probe.status, 0, probe.stderr.toString());
  assert.match(probe.stderr.toString(), /1280x720/);
  assert.match(probe.stderr.toString(), /30 fps/);
  const audio = (path) => {
    const extracted = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", path, "-map", "0:a:0", "-c:a", "copy", "-f", "adts", "pipe:1"], { windowsHide: true });
    assert.equal(extracted.status, 0, extracted.stderr.toString());
    return extracted.stdout;
  };
  assert.deepEqual(audio(join(paths.projects, "demo", copy.path)), audio(source));
  const again = await resizeRender(paths, "demo", "renders/original.mp4", "720p", "high");
  assert.notEqual(again.path, copy.path);
  assert.equal(readdirSync(join(paths.internal, "resize")).length, 0);
  await assert.rejects(resizeRender(paths, "demo", "renders/original.mp4", "project", "high"), /1080p or 720p/);
  await assert.rejects(resizeRender(paths, "demo", "renders/original.mp4", "2160p", "high"), /1080p or 720p/);
});
