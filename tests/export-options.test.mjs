import assert from "node:assert/strict";
import test from "node:test";
import { exportFormats } from "../lib/studio/video-formats.ts";
import { exportQuality, localEncodingArgs } from "../packages/agentcut/src/studio/export-quality.ts";
import { exportResolution, exportSize } from "../packages/agentcut/src/studio/export-resolution.ts";

test("resolution scales 4K portrait and landscape, square and 4:5 without changing inputs", () => {
  for (const [source, expected] of [
    [{ width: 2160, height: 3840 }, { width: 1080, height: 1920 }],
    [{ width: 3840, height: 2160 }, { width: 1920, height: 1080 }],
    [{ width: 2160, height: 2160 }, { width: 1080, height: 1080 }],
    [{ width: 2160, height: 2700 }, { width: 1080, height: 1350 }],
  ]) {
    const before = { ...source };
    assert.deepEqual(exportSize(source, "1080p"), { ...expected, scale: 0.5 });
    assert.deepEqual(source, before);
    assert.equal(exportSize(source, "project").scale, 1);
  }
  assert.deepEqual(exportSize({ width: 2160, height: 3840 }, "720p"), { width: 720, height: 1280, scale: 1 / 3 });
});

test("resolution never upscales small projects and rounds custom output dimensions to even pixels", () => {
  assert.deepEqual(exportSize({ width: 640, height: 360 }, "1080p"), { width: 640, height: 360, scale: 1 });
  const output = exportSize({ width: 2001, height: 3000 }, "1080p");
  assert.equal(output.width, 1080);
  assert.equal(output.height % 2, 0);
  assert.ok(Math.abs(output.width / output.height - 2001 / 3000) < 0.001);
  assert.equal(exportResolution(undefined), "project");
  for (const bad of ["4k", 1080, null]) assert.throws(() => exportResolution(bad));
  for (const bad of [0, NaN, Infinity, -1, 1.5]) assert.throws(() => exportSize({ width: bad, height: 1080 }, "1080p"));
});

test("explicit 4K redraws 1080p layouts at double size and bounds custom formats", () => {
  const landscape = { width: 1920, height: 1080 };
  assert.equal(exportResolution("2160p"), "2160p");
  assert.deepEqual(exportSize(landscape, "2160p"), { width: 3840, height: 2160, scale: 2 });
  assert.deepEqual(exportSize({ width: 1080, height: 1920 }, "2160p"), { width: 2160, height: 3840, scale: 2 });
  assert.deepEqual(exportSize({ width: 7680, height: 4320 }, "2160p"), { width: 3840, height: 2160, scale: 0.5 });
  assert.deepEqual(exportSize({ width: 1080, height: 1080 }, "2160p"), { width: 2160, height: 2160, scale: 2 });
  assert.deepEqual(exportSize({ width: 2000, height: 1000 }, "2160p"), { width: 3840, height: 1920, scale: 1.92 });
  assert.deepEqual(exportSize({ width: 1001, height: 700 }, "2160p"), { width: 3086, height: 2160, scale: 2160 / 700 });
  assert.ok(exportSize({ width: 64, height: 36 }, "2160p").scale <= 16);
  assert.deepEqual(exportSize(landscape), { ...landscape, scale: 1 });
  assert.deepEqual(landscape, { width: 1920, height: 1080 });
});

test("export offers missing formats without replacing a 4K mobile variant", () => {
  const project = { variants: { mobile: { width: 2160, height: 3840 }, wide: { width: 1920, height: 1080 } } };
  const formats = exportFormats(project);
  assert.equal(formats.length, 4);
  assert.deepEqual(formats.find((f) => f.id === "mobile"), {
    id: "mobile", width: 2160, height: 3840, label: "9:16 Portrait", existing: true,
  });
  assert.equal(formats.filter((f) => !f.existing).length, 2);
  assert.equal(Object.keys(project.variants).length, 2);
});

test("custom formats and duplicate ratios survive; new format ids do not overwrite them", () => {
  const project = { variants: { square: { width: 2000, height: 1000 }, mobile: { width: 1080, height: 1920 }, mobile4k: { width: 2160, height: 3840 } } };
  const formats = exportFormats(project);
  assert.equal(formats.find((f) => f.label === "1:1 Square").id, "square-2");
  assert.equal(formats.filter((f) => f.label === "9:16 Portrait").length, 2);
  assert.equal(formats.find((f) => f.id === "square").width, 2000);
  const added = formats.find((f) => f.id === "square-2");
  const next = exportFormats({ variants: { ...project.variants, [added.id]: { width: added.width, height: added.height } } });
  assert.equal(next.filter((f) => f.label === "1:1 Square").length, 1);
  assert.equal(next.find((f) => f.id === added.id).existing, true);
});

test("automatic renders default to high quality, maximum retains more detail, invalid choices fail", () => {
  assert.equal(exportQuality(undefined), "high");
  const high = localEncodingArgs(exportQuality(undefined));
  const maximum = localEncodingArgs(exportQuality("maximum"));
  assert.ok(Number(high[0].split("=")[1]) > Number(maximum[0].split("=")[1]));
  for (const args of [high, maximum]) {
    assert.ok(args.includes("--x264-preset=slow"));
    assert.ok(args.includes("--image-format=png"), "capture text and flat colors without a lossy JPEG intermediate");
    assert.ok(args.every((arg) => !/scale|fps|width|height|bitrate/.test(arg)));
  }
  for (const bad of [null, "low", "--crf=51", 20]) assert.throws(() => exportQuality(bad), /Unknown export quality/);
});
