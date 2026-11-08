import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { adapter, mingDevice, MING_MODEL } from "../packages/agentcut/src/studio/voice/ming.ts";
import { wavSeconds } from "../packages/agentcut/src/studio/voice.ts";

// Opt-in: uses an already installed model, with all outputs under the chosen E:/... (or other) folder.
test("real Ming runtime: long script, expression, and voice design", {
  skip: !process.env.AGENTCUT_MING_RUNTIME_TEST,
  timeout: 90 * 60_000,
}, async () => {
  assert.ok(process.env.AGENTCUT_MING_DIR, "Set an explicit model folder.");
  const out = join(process.env.AGENTCUT_MING_DIR, "release-test-results");
  await mkdir(out, { recursive: true });
  const results = [];
  for (const [name, voice, text, style] of [
    ["long", "US_Emma", "Welcome to Agentcut. Today we are testing a longer voice-over on a computer without a graphics card. The voice should continue across sentence breaks, keep the same speaker, and finish every word clearly."],
    ["expressive", "freeform", "That is wonderful news!", "A cheerful female narrator with an American accent."],
    ["design", "voice_design", "Every story begins with an idea.", "A calm male documentary narrator with a deep voice and a British accent."],
  ]) {
    const start = Date.now();
    const audio = await adapter.synthesize("", { text, style }, MING_MODEL, voice);
    const seconds = wavSeconds(audio.data);
    assert.ok(seconds > 0.5 && seconds < 90, "Expected a bounded, nonempty clip.");
    await writeFile(join(out, `${name}.wav`), audio.data);
    results.push({ name, device: mingDevice(), elapsedSeconds: (Date.now() - start) / 1000, audioSeconds: seconds });
    await writeFile(join(out, "results.json"), JSON.stringify(results, null, 2));
    console.log(results.at(-1));
  }
});
