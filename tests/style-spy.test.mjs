import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureFfmpeg, inspectReference, ReferenceImports } from "../packages/agentcut/src/studio/references.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";

test("Style Spy measures short shots and inspects the source pixels at a caption change", async t => {
  const ffmpeg = await ensureFfmpeg();
  const root = mkdtempSync(join(tmpdir(), "style-spy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = workspacePaths(root);
  const project = join(paths.projects, "demo");
  const folder = join(project, "assets/references/sample");
  mkdirSync(folder, { recursive: true });
  const path = "assets/references/sample/video.mp4";
  execFileSync(ffmpeg, ["-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=160x90:r=30000/1001",
    "-vf", "drawbox=color=white:t=fill:enable='between(n,3,6)',drawbox=x=0:y=60:w=160:h=30:color=white:t=fill:enable='gte(n,12)',setsar=2",
    "-frames:v", "20", "-c:v", "libx264", join(project, path)]);
  const imports = new ReferenceImports(paths, () => {}, () => {});
  const job = await imports.wait(imports.prepare("demo", path).id);
  assert.equal(job.stage, "ready", job.error?.message);
  const { timing } = JSON.parse(readFileSync(join(folder, "reference.json"), "utf8"));
  assert.equal(timing.frameRate, "30000/1001");
  assert.equal(timing.frameCount, 20);
  assert.deepEqual(timing.cutFrames.slice(0, 2).map(c => c.frame), [3, 7]);
  assert.ok(Math.abs(timing.cutFrames[0].time - 3 * 1001 / 30000) < 1e-7);

  const result = await inspectReference(paths, "demo", { path, startFrame: 11, count: 2,
    region: { x: 0, y: 0.7, width: 1, height: 0.3 } });
  assert.deepEqual(result.frames.map(f => f.frame), [11, 12]);
  const pixels = execFileSync(ffmpeg, ["-loglevel", "error", "-i", join(project, result.sheet),
    "-vf", "scale=2:1", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  assert.ok(pixels[1] > pixels[0] + 10, "the caption band turns bright on frame 12");
  const full = await inspectReference(paths, "demo", { path, startFrame: 3, count: 16 });
  assert.deepEqual(full.frames.map(f => f.frame), Array.from({ length: 16 }, (_, i) => i + 3));
  const column = execFileSync(ffmpeg, ["-loglevel", "error", "-i", join(project, full.sheet),
    "-vf", "crop=2:320:240:0,scale=1:320", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  // The white 160x90 frame displays at 32:9, so it fills 135 rows of a 480px-wide cell.
  assert.ok(Math.abs(column.filter(pixel => pixel > 200).length - 135) <= 2);
  const tail = await inspectReference(paths, "demo", { path, startFrame: 18, count: 8 });
  assert.deepEqual(tail.frames.map(f => f.frame), [18, 19]);
  await assert.rejects(inspectReference(paths, "demo", { path, startFrame: 20 }), /frame range/);
});
