import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tempDir } from "./helpers/temp.mjs";
import { createProject } from "../packages/agentcut/src/studio/projects.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import {
  generateVoice,
  voiceSettings,
} from "../packages/agentcut/src/studio/voice.ts";
import {
  adapter,
  MING_MODEL,
  validateMing,
  mingDir,
  mingReady,
  mingDevice,
  prepareMingCpu,
} from "../packages/agentcut/src/studio/voice/ming.ts";

test("CPU setup preserves GPU source and stores a separate float32 implementation", async () => {
  const dir = tempDir(join(tmpdir(), "ming-cpu-source-"));
  mkdirSync(join(dir, "source"));
  const source = "dtype=torch.bfloat16\nwith torch.autocast(device_type='cuda', dtype=torch.bfloat16): pass\n";
  for (const name of ["ming_tts.py", "modeling_bailingmm.py"]) writeFileSync(join(dir, "source", name), source);
  await prepareMingCpu(dir);
  for (const name of ["ming_tts.py", "modeling_bailingmm.py"]) {
    assert.equal(readFileSync(join(dir, "source", name), "utf8"), source);
    const cpu = readFileSync(join(dir, "source-cpu", name), "utf8");
    assert.match(cpu, /torch.float32/);
    assert.match(cpu, /nullcontext/);
    assert.doesNotMatch(cpu, /bfloat16|device_type='cuda'/);
  }
  writeFileSync(join(dir, "ready.json"), JSON.stringify({device: "cpu"}));
  assert.equal(mingDevice(dir), "cpu");
  writeFileSync(join(dir, "ready.json"), JSON.stringify({device: "cuda"}));
  assert.equal(mingDevice(dir), "cuda");
});

test("Ming validates mode combinations before loading a model", () => {
  for (const voice of ["US_Emma", "UK_George", "UK_Charlotte"])
    validateMing({ text: "Hello." }, voice, MING_MODEL);
  for (const voice of ["freeform", "voice_design"]) {
    validateMing(
      { text: "Hello.", style: "A cheerful narrator." },
      voice,
      MING_MODEL,
    );
    assert.throws(
      () => validateMing({ text: "Hello." }, voice, MING_MODEL),
      /style/,
    );
  }
  for (const input of [
    { style: "happy" },
    { speed: 2 },
    { speed: NaN },
    { language: "fr" },
    { language: "en-GB" },
    { gender: "male" },
    { accent: "British" },
    { text: "[Laughter] Hello" },
    { text: "你好" },
  ]) {
    assert.throws(() =>
      validateMing({ text: "Hello.", ...input }, "US_Emma", MING_MODEL),
    );
  }
  assert.throws(() => validateMing({ text: "Hi" }, "juno", MING_MODEL));
  assert.throws(() => validateMing({ text: "Hi" }, "US_Emma", "tiny"));
});

test("Ming path override determines readiness; missing setup never starts another provider", async () => {
  const old = process.env.AGENTCUT_MING_DIR;
  const dir = tempDir(join(tmpdir(), "ming-missing-"));
  process.env.AGENTCUT_MING_DIR = dir;
  try {
    assert.equal(mingDir(), dir);
    assert.equal(mingReady(), false);
    assert.equal(
      voiceSettings().providers.find((p) => p.id === "ming").configured,
      false,
    );
    await assert.rejects(
      adapter.synthesize("", { text: "Hello." }, MING_MODEL, "US_Emma"),
      /not installed/,
    );
  } finally {
    if (old === undefined) delete process.env.AGENTCUT_MING_DIR;
    else process.env.AGENTCUT_MING_DIR = old;
  }
});

test("Ming routing preserves style and voice, saves distinct takes and retains Kokoro default", async () => {
  const paths = workspacePaths(tempDir(join(tmpdir(), "ming-routing-")));
  const { slug } = createProject(paths, { name: "Ming routing" });
  const original = adapter.synthesize;
  const calls = [];
  const wav = readFileSync(
    new URL("../public/voice-samples/kokoro/af_heart.wav", import.meta.url),
  );
  adapter.synthesize = async (_key, input, model, voice) => {
    calls.push({ input, model, voice });
    return { data: wav, ext: "wav" };
  };
  try {
    const result = await generateVoice(paths, slug, {
      provider: "ming",
      voice: "freeform",
      style: "A joyful narrator.",
      text: "Hello.",
      takes: 2,
    });
    assert.equal(result.provider, "ming");
    assert.equal(result.model, MING_MODEL);
    assert.equal(result.voice, "freeform");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].input.style, "A joyful narrator.");
    assert.notEqual(result.takes[0].path, result.takes[1].path);
    assert.ok(result.takes.every((t) => t.seconds > 0));
    assert.equal(voiceSettings().defaultProvider, "kokoro");
    adapter.synthesize = async () => {
      throw new Error("Ming GPU unavailable");
    };
    await assert.rejects(
      generateVoice(paths, slug, { provider: "ming", text: "Hi" }),
      /Ming GPU unavailable/,
    );
  } finally {
    adapter.synthesize = original;
  }
});
