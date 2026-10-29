import assert from "node:assert/strict";
import test from "node:test";
import { projectLine } from "../motion/components/cinematic/project-line.ts";
import { identity, mul, perspective, rotateX, translate } from "../motion/components/cinematic/math.ts";

test("clips all viewport edges before returning drawing coordinates", () => {
  assert.deepEqual(projectLine(identity(), [-100, 50, 0], [200, 50, 0], 100, 100), [0, 50, 100, 50]);
  assert.deepEqual(projectLine(identity(), [50, -100, 0], [50, 200, 0], 100, 100), [50, 0, 50, 100]);
  assert.equal(projectLine(identity(), [-20, 0, 0], [-10, 100, 0], 100, 100), null);
});

test("camera crossings never produce unbounded screen coordinates", () => {
  const m = mul(translate(960, 540), perspective(1000), rotateX(75));
  let visible = 0;
  for (let x = -5000; x <= 5000; x += 50) {
    const line = projectLine(m, [x, -5000, 0], [x, 5000, 0], 1920, 1080);
    if (!line) continue;
    visible++;
    line.forEach((v, i) => assert.ok(Number.isFinite(v) && v >= -1e-7 && v <= (i % 2 ? 1080 : 1920) + 1e-7));
  }
  assert.ok(visible > 0);
  const bad = identity(); bad[0] = NaN;
  assert.equal(projectLine(bad, [0, 0, 0], [1, 1, 0], 100, 100), null);
});
