import assert from "node:assert/strict";
import test from "node:test";
import { renderLines, renderPolicy, renderProgress } from "../packages/agentcut/src/studio/render-policy.ts";
import { memoryBudget } from "../packages/agentcut/src/studio/render-memory.ts";

const GiB = 1024 ** 3;

test("Windows memory budget respects virtual memory exhaustion even with free RAM", () => {
  assert.equal(memoryBudget(20 * GiB, 1024 * 1024), GiB);
  assert.equal(memoryBudget(2 * GiB, 20 * 1024 * 1024), 2 * GiB);
  assert.equal(memoryBudget(20 * GiB, 0), 0);
  for (const value of [undefined, null, "bad", NaN, Infinity, -1]) {
    assert.equal(memoryBudget(2 * GiB, value), 2 * GiB);
  }
  assert.equal(renderPolicy(memoryBudget(20 * GiB, 1024 * 1024), 12).workers, 1);
});

test("worker selection leaves memory headroom and bounds media caches", () => {
  assert.equal(renderPolicy(16 * GiB, 12).workers, 2);
  assert.equal(renderPolicy(3 * GiB, 12).workers, 1);
  assert.equal(renderPolicy(16 * GiB, 1).workers, 1);
  assert.equal(renderPolicy(16 * GiB, 12, "6").workers, 6);
  assert.equal(renderPolicy(3 * GiB, 12, "6").workers, 1);
  assert.ok(renderPolicy(64 * GiB, 12).cacheBytes <= 512 * 1024 ** 2);
  for (const invalid of ["0", "-1", "2.5", "Infinity", "13", ""]) {
    assert.throws(() => renderPolicy(16 * GiB, 12, invalid), /CONCURRENCY/);
  }
});

test("progress survives arbitrary UTF-8 and ANSI chunk boundaries and a final unterminated line", () => {
  const lines = [];
  const stream = renderLines(line => lines.push(line));
  const data = Buffer.from("\u001b[32mRendered 2635/3076\u001b[0m\r\nEncoding · audio\rEncoded 3076/3076");
  for (const byte of data) stream.write(Buffer.from([byte]));
  stream.end();
  assert.deepEqual(lines, ["Rendered 2635/3076", "Encoding · audio", "Encoded 3076/3076"]);
  assert.equal(renderProgress(lines[0]).stage, "rendering");
  assert.equal(renderProgress(lines[2]).progress, 0.99);
});

test("render completion reserves progress for encoding and rejects invalid counts", () => {
  assert.equal(renderProgress("Rendered 100/100").progress, 0.9);
  assert.equal(renderProgress("Encoded 50/100").progress, 0.9450000000000001);
  assert.equal(renderProgress("Rendered 1/0"), null);
  assert.equal(renderProgress("Rendered 101/100"), null);
  assert.equal(renderProgress("Bundled 50/100"), null);
  assert.equal(renderProgress("50/100 frames").progress, 0.45);
  assert.equal(renderProgress("50/100 frames").stage, "rendering");
  assert.equal(renderProgress(`Rendered ${"9".repeat(400)}/${"9".repeat(400)}`), null);
});
