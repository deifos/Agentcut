import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Thumbnail } from "@remotion/player";
import { Internals } from "remotion";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The motion source uses browser ESM packages; bundle its TSX as ESM for this Node test.
const dir = await mkdtemp(join(tmpdir(), "agentcut-cinematic-test-"));
const outfile = join(dir, "cinematic.mjs");
let components;
try {
  await build({
    entryPoints: [fileURLToPath(new URL("../motion/components/cinematic/Cinematic.tsx", import.meta.url))],
    outfile, bundle: true, platform: "node", format: "esm", jsx: "automatic",
    plugins: [{ name: "shared-react", setup(b) {
      b.onResolve({ filter: /^(react(?:\/.*)?|remotion|@remotion\/media)$/ }, (args) => ({
        path: import.meta.resolve(args.path), external: true,
      }));
    } }],
  });
  components = await import(pathToFileURL(outfile).href);
} finally {
  await rm(dir, { recursive: true, force: true });
}
const { Stage, Floor, Plane } = components;

function shot(isRendering, floor = true, motionBlur = 0, moving = false) {
  const Scene = () => createElement(Internals.RemotionEnvironmentContext.Provider, {
    value: { isPlayer: true, isRendering, isStudio: false, isClientSideRendering: isRendering },
  }, createElement(Stage, { motionBlur, camera: moving
    ? [{ at: 0, x: 0 }, { at: 120, x: 10000, ease: "linear" }]
    : { tilt: 14, turn: 24, zoom: 0.78, aperture: 0.5 } },
    floor ? createElement(Floor) : createElement(Plane, { x: 10000, width: 100, height: 100 }, "keep-mounted")));
  return renderToStaticMarkup(createElement(Thumbnail, {
    component: Scene, compositionWidth: 1920, compositionHeight: 1080,
    durationInFrames: 120, fps: 30, frameToDisplay: 60, style: { width: 960, height: 540 },
  }));
}

test("player floor uses bounded screen paths instead of transformed filter surfaces", () => {
  const preview = shot(false);
  const render = shot(true);
  const count = (s) => (s.match(/filter:blur/g) ?? []).length;
  assert.equal(count(preview), 0);
  assert.ok(preview.includes("<path"));
  assert.ok(!preview.includes("matrix3d"));
  assert.ok(!preview.includes("<mask"));
  assert.ok(count(render) > 16);
});

test("off-screen content stays mounted but does not draw in preview or export", () => {
  const preview = shot(false, false);
  assert.ok(preview.includes("keep-mounted"));
  assert.ok(preview.includes("display:none"));
  const render = shot(true, false);
  assert.ok(render.includes("keep-mounted"));
  assert.ok(render.includes("display:none"));
});

test("exports keep the same clipping tree when motion blur starts or stops", () => {
  const render = shot(true, false, 1, true);
  assert.match(render, /filter:blur\([\d.]+px\)[^>]*><div[^>]*inset:-\d+px;overflow:hidden;contain:paint/);
  assert.ok(render.includes("keep-mounted"));
  const still = shot(true, false, 1);
  assert.match(still, /inset:0;overflow:hidden;contain:paint/);
  assert.equal((render.match(/<div/g) ?? []).length, (still.match(/<div/g) ?? []).length);
  assert.ok(!shot(true, false, 0).includes("contain:paint"));
});

test("preview clips projected content before applying motion blur", () => {
  const preview = shot(false, true, 1);
  assert.match(preview, /filter:blur\(0px\)[^>]*><div[^>]*overflow:hidden;contain:paint/);
  assert.ok(shot(true, true, 1).includes("contain:paint"));
});
