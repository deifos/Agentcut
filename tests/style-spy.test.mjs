import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ensureFfmpeg, inspectReference, ReferenceImports } from "../packages/agentcut/src/studio/references.ts";
import { cloneSetup, compareReference, measureReference } from "../packages/agentcut/src/studio/reference-tools.ts";
import { analyzeSignatures, planMotionRows, signatureCollector, tileSize, SHEET_PIXELS, SHEET_SIDE } from "../packages/agentcut/src/studio/reference-measure.ts";
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
  // An import from before the measurements: its source link is kept, its motion strips are not.
  writeFileSync(join(folder, "reference.json"), JSON.stringify({ sourceUrl: "https://example.com/v", strips: [{ path: `${path}/../motion/hook.jpg` }] }));
  const imports = new ReferenceImports(paths, () => {}, () => {});
  const job = await imports.wait(imports.prepare("demo", path).id);
  assert.equal(job.stage, "ready", job.error?.message);
  const reference = JSON.parse(readFileSync(join(folder, "reference.json"), "utf8"));
  assert.equal(reference.sourceUrl, "https://example.com/v");
  assert.equal(reference.strips, undefined);
  assert.deepEqual(reference.timing, { frameRate: "30000/1001", frameCount: 20 });
  assert.deepEqual([reference.width, reference.height], [320, 90]);
  // Four white frames that return to black are a flash, not two cuts, and do not split the shot.
  assert.deepEqual(reference.cuts.map(({ frame, kind, endFrame }) => ({ frame, kind, endFrame })), [{ frame: 3, kind: "flash", endFrame: 7 }]);
  assert.ok(Math.abs(reference.cuts[0].time - 3 * 1001 / 30000) < 1e-6);
  assert.equal(reference.shots.length, 1);
  assert.deepEqual(reference.looks.map(look => look.shots), [["s1"]]);
  // The caption band that turns on at frame 12 is an event in the lower part of the frame.
  assert.equal(reference.events.length, 1);
  assert.deepEqual(reference.eventFields, ["id", "frame", "settledFrame", "box", "strength"]);
  assert.deepEqual(reference.events[0].slice(0, 3), ["e1", 12, 13]);
  assert.ok(reference.events[0][3][1] >= 0.6 && reference.events[0][3][2] === 1);
  assert.equal(reference.frames[0].path, "frames/01.jpg");
  assert.equal(reference.video, path);
  const changes = await measureReference(paths, "demo", { path, kind: "changes", startFrame: 8, count: 12,
    region: { x: 0, y: 0.7, width: 1, height: 0.3 } });
  assert.deepEqual(changes.changes.map(change => change.frame), [12]);
  const ink = await measureReference(paths, "demo", { path, kind: "ink", startFrame: 14 });
  assert.ok(Math.abs(ink.ink.box.y - 2 / 3) < 0.02 && ink.ink.box.width > 0.98);
  assert.match(ink.ink.color, /^#f[c-f]f[c-f]f[c-f]$/);
  const png = frame => `data:image/png;base64,${execFileSync(ffmpeg, ["-loglevel", "error", "-i", join(project, path),
    "-vf", `select='eq(n,${frame})'`, "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "-"]).toString("base64")}`;
  const compared = await compareReference(paths, "demo",
    { path, pairs: [{ referenceFrame: 14, projectFrame: 1 }, { referenceFrame: 4, projectFrame: 1 }] }, [{ frame: 1, dataUrl: png(14) }]);
  assert.ok(compared.pairs[0].difference < 1 && compared.pairs[1].difference > 50);
  assert.ok(compared.dataUrl.startsWith("data:image/jpeg;base64,"));
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
  // Any frames on one image, in order, and several measurements in one call.
  const picked = await inspectReference(paths, "demo", { path, frames: [14, 2, 4] });
  assert.deepEqual(picked.frames.map(f => f.frame), [2, 4, 14]);
  const strip = execFileSync(ffmpeg, ["-loglevel", "error", "-i", join(project, picked.sheet),
    "-vf", "crop=iw:8:0:ih/2-4,scale=3:1", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
  assert.ok(strip[0] < 40 && strip[1] > 200 && strip[2] < 40, "black, the white flash, black above the band");
  await assert.rejects(inspectReference(paths, "demo", { path, startFrame: 1, frames: [2] }), /either/);
  const several = await measureReference(paths, "demo", { path, batch: [
    { kind: "colors", startFrame: 4 }, { kind: "colors", startFrame: 2 }, { kind: "ink", startFrame: 14 }] });
  assert.deepEqual(several.results.map(result => result.kind), ["colors", "colors", "ink"]);
  assert.match(several.results[0].colors[0].color, /^#f[c-f]f[c-f]f[c-f]$/);
  await assert.rejects(measureReference(paths, "demo", { path, kind: "ink", startFrame: 1, batch: [{ kind: "ink", startFrame: 1 }] }), /either/);

  // Clone setup: the reference's size, a whole-number rate, its length and its sound, with a backup.
  writeFileSync(join(project, "project.json"), JSON.stringify({ version: 1, name: "Demo", fps: 60, durationInFrames: 600,
    background: "#ffffff", variants: { mobile: { width: 1080, height: 1920 } }, defaultVariant: "mobile", fonts: ["Inter:400"] }));
  writeFileSync(join(project, "layers.json"), JSON.stringify({ version: 1, tracks: [] }));
  const setup = cloneSetup(paths, "demo", { path });
  assert.deepEqual([setup.variant, setup.width, setup.height, setup.fps, setup.durationInFrames], ["wide", 320, 90, 30, 20]);
  assert.match(setup.frames, /equal/);
  assert.deepEqual(setup.shots, [{ id: "s1", from: 0, duration: 20 }]);
  const made = JSON.parse(readFileSync(join(project, "project.json"), "utf8"));
  assert.deepEqual([made.name, made.fps, made.fonts, made.variants], ["Demo", 30, ["Inter:400"], { wide: { width: 320, height: 90 } }]);
  const tracks = JSON.parse(readFileSync(join(project, "layers.json"), "utf8")).tracks;
  assert.deepEqual(tracks.map(track => [track.kind, track.clips[0].src, track.clips[0].duration]), [["audio", path, 20]]);
  assert.equal(JSON.parse(readFileSync(join(project, setup.backup, "project.json"), "utf8")).fps, 60);
  assert.ok(existsSync(join(project, setup.backup, "layers.json")));
});

// Frames of flat gray, with an optional box of another gray, as the detector sees them.
function signaturesOf(frames) {
  const collector = signatureCollector();
  for (const { base, box } of frames) {
    const pixels = new Uint8Array(64 * 64).fill(base);
    if (box) for (let y = box.y; y < box.y + box.h; y += 1) pixels.fill(box.value, y * 64 + box.x, y * 64 + box.x + box.w);
    collector.add(pixels);
  }
  return collector.done();
}

test("Style Spy tells cuts, flashes, stepped transitions and on-screen events apart", () => {
  const frames = [];
  for (let i = 0; i < 20; i += 1) frames.push({ base: 20 });
  for (let i = 0; i < 20; i += 1) frames.push({ base: 200 }); // hard cut at 20
  for (let i = 0; i < 10; i += 1) frames.push({ base: 200, box: { x: 8, y: 40, w: 32, h: 16, value: 0 } }); // a card at 40
  for (let i = 0; i < 10; i += 1) frames.push({ base: 200 });
  // Animation on twos to a new picture: one transition, not five cuts.
  for (let i = 0; i < 10; i += 1) frames.push({ base: 200 - 18 * (Math.floor(i / 2) + 1) });
  for (let i = 0; i < 20; i += 1) frames.push({ base: 110 });
  const measured = analyzeSignatures(signaturesOf(frames), 30);
  assert.deepEqual(measured.cuts, [{ frame: 20, kind: "cut" }, { frame: 60, kind: "transition", endFrame: 69 }]);
  assert.deepEqual(measured.shots.map(shot => [shot.startFrame, shot.endFrameExclusive]), [[0, 20], [20, 60], [60, 90]]);
  assert.deepEqual(measured.events.map(event => [event.frame, event.box]), [[40, [0.125, 0.625, 0.5, 0.25]], [50, [0.125, 0.625, 0.5, 0.25]]]);
  const rows = planMotionRows(measured, frames.length, 30);
  assert.ok(rows.length >= 1 && rows.every(row => row.frames.length === 8));
  const used = rows.flatMap(row => row.frames);
  assert.deepEqual(used, [...new Set(used)].sort((a, b) => a - b), "rows never share a frame and stay in order");
});

test("Style Spy sheets fit one image a model reads without shrinking it", () => {
  for (const aspect of [16 / 9, 9 / 16, 1, 4 / 5]) {
    for (const tiles of [1, 8, 13, 48]) {
      const columns = Math.min(8, tiles);
      const tile = tileSize(aspect, tiles, columns, 6);
      const width = columns * (tile.width + 6), height = tile.rows * (tile.height + 6);
      assert.ok(width <= SHEET_SIDE + 6 && height <= SHEET_SIDE + 6, `${aspect} ${tiles}: ${width}x${height}`);
      assert.ok(columns * tile.rows * tile.width * tile.height <= SHEET_PIXELS, `${aspect} ${tiles}`);
    }
  }
});
