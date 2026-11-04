import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PHONE_EDITING, validatePhoneEditing, phoneEditPrompt } from "../packages/agentcut/src/studio/phone-editing.ts";
import { validatePhoneManifest, PHONE_DEFAULT_PROMPT } from "../packages/agentcut/src/studio/phone-protocol.ts";

const manifest = { name: "video.mp4", prompt: "", bytes: 10, width: 2160, height: 3840, duration: 60, extension: "mp4" };

test("legacy jobs retain their prompt and do not gain output settings", () => {
  assert.equal(validatePhoneManifest(manifest, 10).editing, undefined);
  assert.equal(phoneEditPrompt("  only trim the ending  "), "only trim the ending");
  assert.equal(phoneEditPrompt(""), PHONE_DEFAULT_PROMPT);
});

test("settings survive the encrypted-manifest JSON round trip without altering source size", () => {
  const job = JSON.parse(JSON.stringify({ ...manifest, editing: DEFAULT_PHONE_EDITING }));
  const validated = validatePhoneManifest(job, 10);
  assert.deepEqual(validated.editing, { mode: "social", style: "automatic", resolution: "1080p" });
  assert.equal(validated.width, 2160);
  assert.equal(validated.height, 3840);
  job.editing.resolution = "720p";
  assert.equal(validated.editing.resolution, "1080p");
});

test("invalid editing choices are rejected before editing or rendering", () => {
  for (const value of [null, {}, { ...DEFAULT_PHONE_EDITING, mode: "unknown" }, { ...DEFAULT_PHONE_EDITING, style: "unknown" }, { ...DEFAULT_PHONE_EDITING, resolution: "8k" }]) {
    assert.throws(() => validatePhoneEditing(value));
    assert.throws(() => validatePhoneManifest({ ...manifest, editing: value }, 10));
  }
});
