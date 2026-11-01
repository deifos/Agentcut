import assert from "node:assert/strict";
import test from "node:test";
import { PageWorkGate, HEAVY_PAGE_TOOLS } from "../lib/studio/page-work.ts";

test("a caller timeout cannot create a backlog behind unfinished page work", async () => {
  const gate = new PageWorkGate();
  let finish;
  let executed = false;
  const original = gate.run(
    "studio_contact_sheet",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  // The caller stops waiting, but the underlying renderer has not finished.
  assert.equal(gate.status().method, "studio_contact_sheet");
  await assert.rejects(
    gate.run("studio_capture_frames", async () => {
      executed = true;
    }),
    /not queued/,
  );
  await assert.rejects(
    gate.run("studio_listen_critique", async () => {
      executed = true;
    }),
    /still running studio_contact_sheet/,
  );
  assert.equal(executed, false);
  finish("complete");
  assert.equal(await original, "complete");
  assert.equal(gate.status(), null);
  assert.equal(
    await gate.run("studio_capture_frames", async () => "one probe"),
    "one probe",
  );
});
test("page work releases after an error and status remains callable", async () => {
  const gate = new PageWorkGate();
  await assert.rejects(
    gate.run("studio_export", async () => {
      throw new Error("render failed");
    }),
    /render failed/,
  );
  assert.equal(gate.status(), null);
  assert.equal(HEAVY_PAGE_TOOLS.has("studio_page_status"), false);
});
