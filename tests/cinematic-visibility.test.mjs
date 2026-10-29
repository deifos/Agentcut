import assert from "node:assert/strict";
import test from "node:test";
import { outsideViewport } from "../motion/components/cinematic/visibility.ts";
import { identity, mul, perspective, rotateY, translate } from "../motion/components/cinematic/math.ts";

test("keeps visible planes, including a plane surrounding the viewport", () => {
  assert.equal(outsideViewport(identity(), 100, 100, 1920, 1080), false);
  assert.equal(outsideViewport(translate(-100, -100), 2200, 1300, 1920, 1080), false);
});

test("culls planes beyond each edge but keeps blur spill and touching edges", () => {
  for (const [x, y] of [[-101, 0], [1921, 0], [0, -101], [0, 1081]]) {
    assert.equal(outsideViewport(translate(x, y), 100, 100, 1920, 1080), true);
    assert.equal(outsideViewport(translate(x, y), 100, 100, 1920, 1080, 32), false);
  }
  assert.equal(outsideViewport(translate(-100, 0), 100, 100, 1920, 1080), false);
});

test("handles perspective and conservatively retains camera-plane crossings", () => {
  assert.equal(outsideViewport(mul(perspective(1000), translate(3000, 0, -100)), 100, 100, 1920, 1080), true);
  assert.equal(outsideViewport(mul(perspective(1000), translate(3000, 0, 1050), rotateY(45)), 200, 100, 1920, 1080), false);
  const invalid = identity();
  invalid[0] = NaN;
  assert.equal(outsideViewport(invalid, 100, 100, 1920, 1080), false);
});
