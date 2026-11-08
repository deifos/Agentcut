import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tempDir } from "./helpers/temp.mjs";
import {
  previewVoice,
  PREVIEW_TEXT,
} from "../packages/agentcut/src/studio/voice/previews.ts";
import { getVoiceAdapter } from "../packages/agentcut/src/studio/voice/registry.ts";
import { voiceOptions } from "../packages/agentcut/src/studio/voice.ts";

test("local previews reuse files, separate descriptions, coalesce requests and reject paid or removed providers", async () => {
  const dir = tempDir(join(tmpdir(), "voice-previews-"));
  const previous = process.env.AGENTCUT_MING_DIR;
  process.env.AGENTCUT_MING_DIR = dir;
  const adapter = getVoiceAdapter("ming");
  const original = adapter.synthesize;
  const calls = [];
  adapter.synthesize = async (key, input, model, voice) => {
    calls.push({ key, input, model, voice });
    return {
      data: readFileSync(
        new URL("../public/voice-samples/kokoro/af_heart.wav", import.meta.url),
      ),
      ext: "wav",
    };
  };
  try {
    const [a, b] = await Promise.all([
      previewVoice("ming", "freeform", "Warm"),
      previewVoice("ming", "freeform", "Warm"),
    ]);
    assert.equal(a.url, b.url);
    await previewVoice("ming", "freeform", "Warm");
    assert.equal(calls.length, 1);
    await previewVoice("ming", "freeform", "Calm");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].input.text, PREVIEW_TEXT);
    assert.equal(calls[0].input.style, "Warm");
    assert.equal(calls[0].key, "");
    assert.deepEqual(readdirSync(dir), ["previews"]);
    assert.equal(readdirSync(join(dir, "previews")).length, 2);
    for (const provider of ["openai", "elevenlabs", "woof"])
      await assert.rejects(previewVoice(provider, "anything"), /local voice/);
    await assert.rejects(previewVoice("ming", "../../outside"), /listed voice/);
    assert.ok(!voiceOptions().providers.some((p) => p.id === "woof"));
  } finally {
    adapter.synthesize = original;
    if (previous === undefined) delete process.env.AGENTCUT_MING_DIR;
    else process.env.AGENTCUT_MING_DIR = previous;
  }
});


test("included local voice samples ship as valid WAV files", async () => {
  const { KOKORO_VOICES } = await import("../packages/agentcut/src/studio/voice/kokoro-catalog.ts");
  const { MING_VOICES } = await import("../packages/agentcut/src/studio/voice/ming-catalog.ts");
  for (const voice of [...KOKORO_VOICES, ...MING_VOICES.filter(v => v.previewUrl)]) {
    const audio = readFileSync(new URL(`../public${voice.fallbackPreviewUrl}`, import.meta.url));
    assert.equal(audio.toString("ascii",0,4), "RIFF");
    assert.ok(audio.length > 1000);
  }
});
