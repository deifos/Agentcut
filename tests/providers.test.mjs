import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { providerStore } from "../packages/agentcut/src/studio/providers/settings.ts";
import { assemblyai } from "../packages/agentcut/src/studio/transcription/assemblyai.ts";
import { localWhisper } from "../packages/agentcut/src/studio/transcription/local.ts";
import { VOICE_ADAPTERS } from "../packages/agentcut/src/studio/voice/registry.ts";
import { readError } from "../packages/agentcut/src/studio/providers/http.ts";
import { TranscriptionService, transcriptionSettings, saveTranscriptionKey, preferTranscription } from "../packages/agentcut/src/studio/transcription/service.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";

test("provider storage keeps preference explicit and never exposes key material in discovery", () => {
  const dir = mkdtempSync(join(tmpdir(), "agentcut-provider-test-"));
  try {
    const store = providerStore(() => join(dir, "keys.json"), () => [{ id: "local", name: "Local" }, { id: "cloud", name: "Cloud" }], "local");
    store.save("cloud", "test-secret-123456"); assert.equal(store.preferred(), "local");
    assert.equal(JSON.stringify(store.status("cloud")).includes("test-secret"), false);
    store.select("cloud"); assert.equal(store.preferred(), "cloud"); store.remove("cloud"); assert.equal(store.preferred(), "local");
    assert.equal(store.key("cloud"), null);
  } finally { assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep)); rmSync(dir, { recursive: true, force: true }); }
});

test("AssemblyAI upload/auth/editing options and normalized filler/speaker timings; no live request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agentcut-audio-test-")); const path = join(dir, "audio.wav"); writeFileSync(path, "mock audio");
  const original = globalThis.fetch; const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, ...init });
    return Response.json(url.endsWith("upload") ? { upload_url: "https://cdn.assemblyai.com/upload/mock" } : { id: "mock-id", status: "completed", text: "Um, hello.", language_code: "en", audio_duration: 1, words: [{ text: "Um,", start: 120, end: 340, confidence: 0.9, speaker: "A" }, { text: "hello.", start: 400, end: 900, speaker: "A" }], utterances: [{ text: "Um, hello.", start: 120, end: 900, speaker: "A" }] });
  };
  try {
    const result = await assemblyai.run({ path: "assets/test.mp4", speakerLabels: true }, { fps: 30, key: "test-key", signal: new AbortController().signal, progress() {}, audio: async () => path });
    assert.equal(requests.length, 2); assert.equal(requests[0].headers.authorization, "test-key");
    assert.equal(JSON.parse(requests[1].body).disfluencies, true); assert.equal(JSON.parse(requests[1].body).speaker_labels, true);
    assert.equal(result.words[0].text, "Um,"); assert.equal(result.words[0].start, 0.12); assert.equal(result.words[0].fromFrame, 4); assert.equal(result.words[0].speaker, "A"); assert.equal(result.segments[0].end, 0.9);
    assert.ok(!JSON.stringify(result).includes("test-key"));
    await assert.rejects(assemblyai.run({ path: "x" }, { key: null }), /key/);
    const safe = await readError(new Response("secret echoed: test-key", { status: 401 })); assert.ok(!safe.includes("test-key"));
  } finally { globalThis.fetch = original; assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep)); rmSync(dir, { recursive: true, force: true }); }
});

test("Local Whisper preserves the existing word result and rejects unsupported capabilities", async () => {
  const context = { fps: 30, signal: new AbortController().signal, progress() {}, local: async options => ({ text: "Hello", model: "whisper-" + options.model, seconds: 1, words: [{ text: "Hello", start: 0, end: 1, fromFrame: 0, toFrame: 30 }] }) };
  const result = await localWhisper.run({ path: "assets/test.wav", model: "tiny" }, context);
  assert.equal(result.model, "whisper-tiny"); assert.equal(result.words[0].toFrame, 30);
  await assert.rejects(localWhisper.run({ path: "x", speakerLabels: true }, context), /speaker labels/);
});

test("voice-over adapters retain all four providers and their request formats", async () => {
  assert.deepEqual(Object.keys(VOICE_ADAPTERS), ["elevenlabs", "gemini", "openai", "xai"]);
  const original = globalThis.fetch; const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, ...init }); if (url.includes("generativelanguage")) return Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from("RIFFaudio").toString("base64") } }] } }] }); return new Response("RIFFaudio"); };
  try {
    for (const adapter of Object.values(VOICE_ADAPTERS)) { const audio = await adapter.synthesize("test-key", { text: "Hello", style: "calm", speed: 1.1 }, adapter.spec.defaultModel, adapter.spec.defaultVoice || "test-voice"); assert.ok(audio.data.length); }
    assert.equal(JSON.parse(requests[0].body).text, "Hello");
    assert.equal(JSON.parse(requests[1].body).generationConfig.responseModalities[0], "AUDIO");
    assert.equal(JSON.parse(requests[2].body).input, "Hello"); assert.equal(JSON.parse(requests[3].body).voice_id, "eve");
  } finally { globalThis.fetch = original; }
});

test("local cancellation completes even when the editor does not reply", async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = localWhisper.run({ path: "assets/test.wav" }, {
    fps: 30, signal: controller.signal, progress() {},
    local() { started(); return new Promise(() => {}); },
  });
  await ready;
  controller.abort();
  await assert.rejects(pending, /cancelled/);
});

test("service routes preference and local override, caches provenance, cancels, and never falls back", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agentcut-routing-test-"));
  const previous = process.env.AGENTCUT_TRANSCRIPTION_KEYS;
  process.env.AGENTCUT_TRANSCRIPTION_KEYS = join(dir, "private-keys.json");
  const paths = workspacePaths(dir); const project = join(paths.projects, "fixture");
  mkdirSync(join(project, "assets"), { recursive: true });
  writeFileSync(join(project, "project.json"), JSON.stringify({ version: 1, name: "Fixture", fps: 30, durationInFrames: 30, variants: { wide: { width: 1920, height: 1080 } }, defaultVariant: "wide", background: "#000000" }));
  writeFileSync(join(project, "layers.json"), JSON.stringify({ version: 1, tracks: [], markers: [] }));
  writeFileSync(join(project, "assets/test.wav"), "mock source");
  let calls = 0; let release; let markStarted; const started = new Promise(resolve => { markStarted = resolve; });
  const service = new TranscriptionService(paths, async (method, params) => {
    if (method === "studio_cancel_local_transcription") { release?.(); return { cancelled: true }; }
    calls++;
    if (params.job === "cancel-me") { markStarted(); await new Promise(resolve => { release = resolve; }); }
    return { text: "Hello", model: "whisper-base", seconds: 1, words: [{ text: "Hello", start: 0, end: 1, fromFrame: 0, toFrame: 30 }] };
  }, event => {
    if (["completed", "cancelled", "error"].includes(event.stage)) {
      assert.equal(service.status().find(job => job.id === event.job).active, false);
    }
  });
  try {
    saveTranscriptionKey("assemblyai", "test-secret-no-real-service");
    assert.equal(transcriptionSettings().defaultProvider, "local");
    assert.ok(!JSON.stringify(transcriptionSettings()).includes("test-secret"));
    const first = await service.run("fixture", { path: "assets/test.wav" }); assert.equal(first.provider, "local"); assert.equal(calls, 1);
    preferTranscription("assemblyai");
    const override = await service.run("fixture", { path: "assets/test.wav", provider: "local" }); assert.equal(override.cached, true); assert.equal(override.provenance.cacheKey, first.provenance.cacheKey); assert.equal(calls, 1);
    await assert.rejects(service.run("fixture", { path: "assets/test.wav", model: "unsupported" }), /supports universal-2/); assert.equal(calls, 1);
    writeFileSync(join(project, "assets/test.wav"), "changed mock source");
    const pending = service.run("fixture", { path: "assets/test.wav", provider: "local", job: "cancel-me" });
    await started; assert.equal(service.cancel("cancel-me").cancelled, true); await assert.rejects(pending, /cancelled/);
    assert.equal(service.status().find(j => j.id === "cancel-me").stage, "cancelled");
  } finally { service.close(); if (previous === undefined) delete process.env.AGENTCUT_TRANSCRIPTION_KEYS; else process.env.AGENTCUT_TRANSCRIPTION_KEYS = previous; assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep)); rmSync(dir, { recursive: true, force: true }); }
});
