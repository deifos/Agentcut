import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { tempDir } from "./helpers/temp.mjs";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { createProject } from "../packages/agentcut/src/studio/projects.ts";
import {
  generateVoice,
  voiceOptions,
  voiceSettings,
  wavSeconds,
} from "../packages/agentcut/src/studio/voice.ts";
import { VOICE_ADAPTERS } from "../packages/agentcut/src/studio/voice/registry.ts";
import {
  validateKokoro,
  splitKokoroText,
  selectKokoroVoice,
  adapter,
} from "../packages/agentcut/src/studio/voice/kokoro.ts";
import { KOKORO_VOICES } from "../packages/agentcut/src/studio/voice/kokoro-catalog.ts";
test("28 catalog identifiers, labels and previews match the installed upstream runtime", async () => {
  const { KokoroTTS } = await import("kokoro-js");
  const upstream = new KokoroTTS(null, null).voices;
  assert.deepEqual(
    KOKORO_VOICES.map((v) => v.id).sort(),
    Object.keys(upstream).sort(),
  );
  for (const voice of KOKORO_VOICES) {
    assert.equal(upstream[voice.id].name, voice.name);
    assert.equal(upstream[voice.id].gender.toLowerCase(), voice.gender);
    assert.ok(voice.language.startsWith("en"));
    assert.equal(voice.tone, undefined);
    const audio = readFileSync(
      new URL(`../public${voice.previewUrl}`, import.meta.url),
    );
    assert.ok(wavSeconds(audio) > 0);
  }
  assert.equal(voiceOptions().localVoices.length, 28);
});
test("generic voice uses Kokoro with and without paid keys; explicit paid selection stays paid, failures never fallback", async () => {
  const dir = tempDir(join(tmpdir(), "agentcut-voice-"));
  const paths = workspacePaths(dir);
  const { slug } = createProject(paths, { name: "Voice fixture" });
  const oldKeys = process.env.AGENTCUT_KEYS;
  process.env.AGENTCUT_KEYS = join(dir, "keys.json");
  const local = VOICE_ADAPTERS.kokoro.synthesize,
    paid = VOICE_ADAPTERS.openai.synthesize;
  const calls = [];
  const wav = readFileSync(
    new URL("../public/voice-samples/kokoro/af_heart.wav", import.meta.url),
  );
  VOICE_ADAPTERS.kokoro.synthesize = async (...args) => {
    calls.push(["kokoro", args[3]]);
    return { data: wav, ext: "wav" };
  };
  VOICE_ADAPTERS.openai.synthesize = async (...args) => {
    calls.push(["openai", args[3]]);
    return { data: wav, ext: "wav" };
  };
  try {
    for (const paidKey of [false, true]) {
      writeFileSync(
        process.env.AGENTCUT_KEYS,
        JSON.stringify({
          version: 1,
          defaultProvider: "openai",
          keys: paidKey ? { openai: { key: "fake-test-key" } } : {},
        }),
      );
      assert.equal(voiceSettings().defaultProvider, "kokoro");
      const r = await generateVoice(paths, slug, { text: "Read the script." });
      assert.equal(r.provider, "kokoro");
      assert.ok(existsSync(join(paths.projects, slug, r.takes[0].path)));
      assert.ok(r.takes[0].seconds > 0);
    }
    const r = await generateVoice(paths, slug, {
      text: "Read the script.",
      provider: "openai",
      voice: "cedar",
    });
    assert.equal(r.provider, "openai");
    assert.equal(r.voice, "cedar");
    VOICE_ADAPTERS.kokoro.synthesize = async () => {
      throw Error("offline local setup");
    };
    await assert.rejects(
      generateVoice(paths, slug, { text: "Read the script." }),
      /offline/,
    );
    assert.deepEqual(calls, [
      ["kokoro", "af_heart"],
      ["kokoro", "af_heart"],
      ["openai", "cedar"],
    ]);
  } finally {
    VOICE_ADAPTERS.kokoro.synthesize = local;
    VOICE_ADAPTERS.openai.synthesize = paid;
    if (oldKeys === undefined) delete process.env.AGENTCUT_KEYS;
    else process.env.AGENTCUT_KEYS = oldKeys;
  }
});
test("unsupported language, invalid voice/model/style/speed stop before setup; bounded chunks retain all words", () => {
  for (const input of [
    { language: "es" },
    { text: "你好" },
    { style: "excited" },
    { speed: 0 },
    { speed: NaN },
  ])
    assert.throws(() =>
      validateKokoro(
        { text: "Hello there", ...input },
        "af_heart",
        adapter.spec.defaultModel,
      ),
    );
  assert.throws(() =>
    validateKokoro({ text: "Hello" }, "Puck", adapter.spec.defaultModel),
  );
  assert.throws(() => validateKokoro({ text: "Hello" }, "af_heart", "other"));
  const text =
    "This is an English tutorial sentence with a clear next step. ".repeat(100);
  assert.deepEqual(splitKokoroText("x".repeat(180)), ["x".repeat(180)]);
  const chunks = splitKokoroText(text);
  assert.ok(chunks.every((c) => c.length <= 180));
  assert.equal(chunks.join(" "), text.trim());
  validateKokoro(
    { text: "A British tutorial.", language: "en-GB", speed: 1 },
    "bm_daniel",
    adapter.spec.defaultModel,
  );
});

test("automatic choice honors purpose, language, gender and accent before editorial defaults", () => {
  assert.equal(
    selectKokoroVoice({ text: "Launch", purpose: "launch" }),
    "am_puck",
  );
  assert.equal(
    selectKokoroVoice({ text: "Tutorial", purpose: "tutorial" }),
    "af_heart",
  );
  assert.equal(
    selectKokoroVoice({
      text: "Tutorial",
      language: "en-GB",
      purpose: "walkthrough",
    }),
    "bf_emma",
  );
  const id = selectKokoroVoice({
    text: "Tutorial",
    purpose: "tutorial",
    gender: "male",
    accent: "British",
  });
  assert.ok(id.startsWith("bm_"));
  assert.equal(
    selectKokoroVoice({ text: "Read", voice: "bm_daniel", purpose: "launch" }),
    "bm_daniel",
  );
  assert.throws(
    () =>
      selectKokoroVoice({ text: "Read", voice: "af_heart", gender: "male" }),
    /does not match/,
  );
  assert.throws(
    () =>
      selectKokoroVoice({ text: "Read", voice: "af_heart", language: "en-GB" }),
    /does not match/,
  );
});
