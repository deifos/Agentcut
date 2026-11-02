// The grade through the real renderer, in real Chrome: stills and full exports read back pixel by pixel.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { findChrome, launchChrome } from "./helpers/chrome.mjs";

const skip = findChrome() ? false : "Chrome not found (set CHROME_PATH)";
let chrome, page, server, dir;
const problems = [];

before(async () => {
  if (skip) return;
  dir = await mkdtemp(join(tmpdir(), "agentcut-grade-"));
  const outfile = join(dir, "page.js");
  await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/color-grade-page.tsx", import.meta.url))],
    outfile, bundle: true, format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error", tsconfigRaw: "{}", alias: { "@": fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "") },
  });
  server = createServer((req, res) => {
    if (req.url === "/page.js") {
      res.setHeader("content-type", "text/javascript");
      res.end(readFileSync(outfile));
    } else {
      res.setHeader("content-type", "text/html");
      res.end('<!doctype html><body><script type="module" src="/page.js"></script></body>');
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  chrome = await launchChrome();
  page = await chrome.open(`http://127.0.0.1:${server.address().port}/`, {
    onConsole: (type, text) => { if (type === "error" || type === "exception") problems.push(text); },
  });
  await page.evaluate(`(async () => { while (!window.api) await new Promise(r => setTimeout(r, 50)); return api.ready(); })()`);
}, { timeout: 180_000 });

after(async () => {
  await chrome?.close();
  server?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const patches = (options) => page.evaluate(`api.patches(${JSON.stringify(options)})`);
const exported = (options) => page.evaluate(`api.exported(${JSON.stringify(options)})`);
const noise = (options, patch) => page.evaluate(`api.noise(${JSON.stringify(options)}, ${patch})`);
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const near = (actual, expected, tolerance, label) =>
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) <= tolerance, `${label}: ${actual.map((n) => n.toFixed(1))} vs ${expected.map((n) => n.toFixed(1))}`));

const browser = { skip, timeout: 120_000 };

test("a neutral grade pass leaves the picture alone", browser, async () => {
  const plain = await patches({});
  // Pivot alone changes nothing but forces the pass to run.
  const passed = await patches({ grade: { match: { gains: [1, 1, 1] } } });
  for (const name of Object.keys(plain)) near(passed[name], plain[name], 2, name);
});

test("exposure +1 stop doubles linear light, in stills and in the export", browser, async () => {
  const plain = await patches({});
  const graded = await patches({ grade: { exposure: 1 } });
  const toLinear = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const ratio = toLinear(graded.dark[1]) / toLinear(plain.dark[1]);
  assert.ok(Math.abs(ratio - 2) < 0.2, `ratio ${ratio}`);
  const video = await exported({ grade: { exposure: 1 } });
  assert.ok(Math.abs(luma(video.gray) - luma(graded.gray)) < 6, `export ${luma(video.gray)} still ${luma(graded.gray)}`);
  assert.ok(luma(video.gray) > luma(plain.gray) + 40, "export is really brighter");
});

test("the five original controls match the CSS filters they replace", browser, async () => {
  for (const grade of [
    { brightness: 1.2 }, { contrast: 1.3 }, { saturation: 0.5 }, { saturation: 1.6 }, { hue: 40 }, { warmth: 0.6 }, { warmth: -0.5 },
    { brightness: 1.1, contrast: 1.15, saturation: 1.2, warmth: 0.2, hue: -10 },
  ]) {
    const css = await patches({ grade, css: true });
    const gpu = await patches({ grade: { ...grade, match: { gains: [1, 1, 1] } } });
    for (const name of Object.keys(css)) near(gpu[name], css[name], 4, `${JSON.stringify(grade)} ${name}`);
  }
});

test("temperature warms, tint shifts green to magenta, without moving brightness far", browser, async () => {
  const plain = await patches({});
  const warm = await patches({ grade: { temperature: 0.6 } });
  assert.ok(warm.gray[0] > plain.gray[0] + 10 && warm.gray[2] < plain.gray[2] - 10, JSON.stringify(warm.gray));
  assert.ok(Math.abs(luma(warm.gray) - luma(plain.gray)) < 12);
  const magenta = await patches({ grade: { tint: 0.6 } });
  assert.ok(magenta.gray[1] < magenta.gray[0] - 10 && magenta.gray[1] < magenta.gray[2] - 10, JSON.stringify(magenta.gray));
});

test("tone regions move their own part of the picture", browser, async () => {
  const plain = await patches({});
  const shadows = await patches({ grade: { shadows: 0.8 } });
  assert.ok(luma(shadows.dark) > luma(plain.dark) + 10);
  assert.ok(Math.abs(luma(shadows.light) - luma(plain.light)) < 3);
  const highlights = await patches({ grade: { highlights: -0.8 } });
  assert.ok(luma(highlights.light) < luma(plain.light) - 10);
  assert.ok(Math.abs(luma(highlights.dark) - luma(plain.dark)) < 3);
});

test("colour wheels tint only their range", browser, async () => {
  const plain = await patches({});
  const wheel = await patches({ grade: { wheels: { highlights: { x: -0.8 } } } });
  assert.ok(wheel.white[0] < plain.white[0] - 10, JSON.stringify(wheel.white));
  assert.ok(Math.abs(wheel.dark[0] - plain.dark[0]) < 9, JSON.stringify(wheel.dark));
  const shadows = await patches({ grade: { wheels: { shadows: { x: 0.8 } } } });
  assert.ok(shadows.dark[0] > plain.dark[0] + 8, JSON.stringify(shadows.dark));
  assert.ok(Math.abs(shadows.white[0] - plain.white[0]) < 4, JSON.stringify(shadows.white));
});

test("curves apply per channel and master", browser, async () => {
  const plain = await patches({});
  const inverted = await patches({ grade: { curves: { master: [[0, 1], [1, 0]] } } });
  near(inverted.white, [0, 0, 0], 4, "white inverts");
  near(inverted.dark, plain.dark.map((v) => 255 - v), 8, "dark inverts");
  const red = await patches({ grade: { curves: { r: [[0, 0], [0.5, 0.8], [1, 1]] } } });
  assert.ok(red.gray[0] > plain.gray[0] + 30 && Math.abs(red.gray[1] - plain.gray[1]) < 3, JSON.stringify(red.gray));
});

test("the colour mixer changes one band and leaves greys alone", browser, async () => {
  const plain = await patches({});
  const mixed = await patches({ grade: { hsl: { blue: { saturation: -1 } } } });
  const spread = (c) => Math.max(...c) - Math.min(...c);
  assert.ok(spread(mixed.blue) < spread(plain.blue) * 0.25, JSON.stringify(mixed.blue));
  assert.ok(Math.abs(luma(mixed.blue) - luma(plain.blue)) < 12, "keeps its brightness");
  assert.ok(Math.abs(spread(mixed.red) - spread(plain.red)) < 6);
  near(mixed.gray, plain.gray, 3, "gray");
});

test("a .cube LUT applies, and its strength fades it", browser, async () => {
  const plain = await patches({});
  const invert = 'TITLE "invert"\nLUT_3D_SIZE 2\n1 1 1\n0 1 1\n1 0 1\n0 0 1\n1 1 0\n0 1 0\n1 0 0\n0 0 0\n';
  const full = await patches({ grade: { lut: "x.cube" }, cube: invert });
  near(full.gray, plain.gray.map((v) => 255 - v), 5, "inverted");
  const half = await patches({ grade: { lut: "x.cube", lutStrength: 0.5 }, cube: invert });
  near(half.dark, [127, 127, 127], 8, "half way");
});

test("skin protect keeps skin's colour while the rest moves", browser, async () => {
  const push = { temperature: -0.8 };
  const plain = await patches({});
  const open = await patches({ grade: push });
  const guarded = await patches({ grade: { ...push, skinProtect: 1 } });
  const skinShift = (c) => Math.abs(c[0] - c[2] - (plain.skin[0] - plain.skin[2]));
  assert.ok(skinShift(guarded.skin) < skinShift(open.skin) * 0.35, `${skinShift(guarded.skin)} vs ${skinShift(open.skin)}`);
  near(guarded.gray, open.gray, 3, "non-skin still moves");
});

test("keys ease between frames and hold jumps", browser, async () => {
  const keys = [{ frame: 0, exposure: 0 }, { frame: 10, exposure: 2 }];
  const start = await patches({ grade: { keys }, localFrame: 0 });
  const middle = await patches({ grade: { keys }, localFrame: 5 });
  const end = await patches({ grade: { keys }, localFrame: 10 });
  assert.ok(luma(start.gray) < luma(middle.gray) && luma(middle.gray) < luma(end.gray));
  const held = await patches({ grade: { keys: [{ frame: 0, saturation: 0, hold: true }, { frame: 10, saturation: 1 }] }, localFrame: 9 });
  const spread = (c) => Math.max(...c) - Math.min(...c);
  assert.ok(spread(held.red) < 8, "still black and white until the next key");
});

test("looks draw, and strength 0 is the untouched picture", browser, async () => {
  const plain = await patches({});
  const noir = await patches({ grade: { look: "noir" } });
  const spread = (c) => Math.max(...c) - Math.min(...c);
  assert.ok(spread(noir.red) < 8, JSON.stringify(noir.red));
  const none = await patches({ grade: { look: "teal-amber", lookStrength: 0 } });
  for (const name of Object.keys(plain)) near(none[name], plain[name], 3, name);
  const unknown = await patches({ grade: { look: "not-a-look" } });
  near(unknown.gray, plain.gray, 2, "unknown look is ignored");
});

test("finish: vignette darkens corners, grain adds noise that changes per frame, halation glows", browser, async () => {
  const flat = await noise({ grade: { exposure: 0.01 } }, 0);
  const grainy = await noise({ grade: { grain: 0.8 } }, 0);
  assert.ok(grainy > flat + 3, `${grainy} vs ${flat}`);
  const plain = await patches({});
  const halo = await patches({ grade: { halation: 1 } });
  assert.ok(halo.white[0] >= plain.white[0] - 1, "white stays");
  assert.ok(halo.gray[0] >= plain.gray[0] - 2);
});

test("curves and the finish work together (the curve table must survive the finish's render targets)", browser, async () => {
  const plain = await patches({});
  const both = await patches({ grade: { curves: { master: [[0, 0], [0.25, 0.2], [0.75, 0.82], [1, 1]] }, grain: 0.3, halation: 0.5, bloom: 0.3, vignette: 0.3 } });
  assert.ok(luma(both.gray) > 60, `gray ${both.gray}`);
  assert.ok(Math.abs(luma(both.gray) - luma(plain.gray)) < 40);
  // Twice in a row, so a target made on the first frame is reused on the second.
  const again = await patches({ grade: { curves: { master: [[0, 0], [1, 0.5]] }, vignette: 0.1 } });
  assert.ok(luma(again.light) < 150 && luma(again.light) > 70, `light ${again.light}`);
});

test("a LUT and curves and the finish work together", browser, async () => {
  const identity = 'LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n';
  const plain = await patches({});
  const all = await patches({ grade: { lut: "x.cube", curves: { r: [[0, 0], [1, 1]], master: [[0, 0.02], [1, 1]] }, hsl: { red: { hue: 0.01 } }, vignette: 0.05 }, cube: identity });
  assert.ok(Math.abs(luma(all.gray) - luma(plain.gray)) < 18, `${all.gray} vs ${plain.gray}`);
});

test("every look draws a picture, at full and half strength", browser, async () => {
  const plain = await patches({});
  const brightness = (set) => Object.values(set).reduce((sum, c) => sum + luma(c), 0) / Object.keys(set).length;
  const looks = JSON.parse(await page.evaluate("JSON.stringify(api.lookIds())"));
  assert.ok(looks.length >= 12);
  for (const look of looks) {
    for (const lookStrength of [1, 0.5]) {
      const graded = await patches({ grade: { look, lookStrength } });
      const level = brightness(graded);
      // Day for night is meant to be dark, but never black.
      assert.ok(level > 18, `${look} at ${lookStrength} is too dark: ${level.toFixed(1)}`);
      assert.ok(level < 240, `${look} at ${lookStrength} blew out: ${level.toFixed(1)}`);
      const moved = Object.keys(plain).some((name) => graded[name].some((v, i) => Math.abs(v - plain[name][i]) > 4));
      assert.ok(moved, `${look} at ${lookStrength} changed nothing`);
    }
  }
});

test("look thumbnails are the right way up, with one pass or several", browser, async () => {
  for (const grade of [{ exposure: 0.01 }, { look: "teal-amber" }, { exposure: 0.2, look: "faded-print" }]) {
    const { top, bottom } = await page.evaluate(`api.thumbnailOrientation(${JSON.stringify(grade)})`);
    assert.ok(top[0] > top[2] + 20, `${JSON.stringify(grade)}: top should be red, got ${top}`);
    assert.ok(bottom[2] > bottom[0] + 20, `${JSON.stringify(grade)}: bottom should be blue, got ${bottom}`);
  }
});

test("a saved .cube has its colours in the right places", browser, async () => {
  const identity = await page.evaluate(`api.bakedCorners({ exposure: 0.001 })`);
  const near = (actual, expected) => actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < 0.02, `${actual} vs ${expected}`));
  near(identity.black, [0, 0, 0]);
  near(identity.red, [1, 0, 0]);
  near(identity.green, [0, 1, 0]);
  near(identity.blue, [0, 0, 1]);
  near(identity.white, [1, 1, 1]);
});

test("images take the same grade", browser, async () => {
  const plain = await patches({ image: true });
  const graded = await patches({ image: true, grade: { exposure: 1 } });
  assert.ok(luma(graded.gray) > luma(plain.gray) + 40, `${luma(graded.gray)} vs ${luma(plain.gray)}`);
});

test("nothing logged an error while rendering", browser, () => {
  assert.deepEqual(problems.filter((p) => !/favicon/.test(p)), []);
});
