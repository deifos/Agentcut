import assert from "node:assert/strict";
import test from "node:test";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
import { tmpdir } from "node:os";
import { revealFile } from "../packages/agentcut/src/studio/reveal.ts";

test("folder launch is visible and reports a failed launcher", async (t) => {
  let failure = false;
  let detached = 0;
  const calls = [];
  t.mock.method(childProcess, "spawn", (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.unref = () => detached++;
    queueMicrotask(() => child.emit(failure ? "error" : "spawn", failure ? new Error("launcher unavailable") : undefined));
    return child;
  });
  syncBuiltinESMExports();
  try {
    await revealFile(tmpdir());
    assert.equal(calls[0].options.windowsHide, false);
    assert.equal(detached, 1);
    failure = true;
    await assert.rejects(revealFile(tmpdir()), /launcher unavailable/);
    assert.equal(detached, 1);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
