import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { build } from "esbuild";

async function callback(file, endMarker, names) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = source.indexOf("  const sendChat = useCallback(");
  const fragment = source.slice(start, source.indexOf(endMarker, start));
  const { outputFiles } = await build({ stdin: { contents: `export function create(deps) { const { ${names.join(", ")} } = deps; ${fragment}; return sendChat; }`, loader: "tsx" },
    bundle: true, write: false, format: "iife", globalName: "subject", logLevel: "error" });
  const context = vm.createContext({}); vm.runInContext(outputFiles[0].text, context);
  return context.subject.create;
}
const app = await callback("../components/studio/StudioApp.tsx", "  /** A camera take", ["useCallback", "info", "toast", "doc", "loaded", "frameStore", "captureFrame", "variant", "uploadToProject", "studio", "agentPickable", "agent", "model", "effort"]);
const controller = await callback("../components/studio/useStudioController.ts", "  const queueAction", ["useCallback", "bridgeRef", "latest", "frameStore", "flushWrite", "toast", "openProject"]);

test("an old helper blocks new-video creation before a frame capture or ordinary send", async () => {
  let captures = 0, sends = 0; const errors = [];
  const send = app({ useCallback: (fn) => fn, info: { features: [] }, toast: { error: (message) => errors.push(message) },
    doc: { slug: "keep-launch" }, loaded: {}, frameStore: { get: () => 10 }, captureFrame: () => { captures++; }, variant: "wide", uploadToProject() {},
    studio: { sendChat() { sends++; } }, agentPickable: false, agent: null, model: null, effort: null });
  await assert.rejects(send("How to add a style to Agentcut", { attachFrame: true, newVideo: { type: "how-to", requestId: "stable" } }), /current edit is safe/);
  assert.equal(captures, 0); assert.equal(sends, 0); assert.equal(errors.length, 1);
  await send("Edit the existing title", { attachFrame: false });
  assert.equal(sends, 1);
});

test("new-video controller routing binds source, uses dedicated creation, and opens only the returned target", async () => {
  const calls = [], opened = [];
  const latest = { current: { doc: { slug: "keep-launch", project: { fps: 30 } }, variant: "wide", selection: ["old-shot"] } };
  const send = controller({ useCallback: (fn) => fn, bridgeRef: { current: { async request(method, params) { calls.push({ method, params }); return { slug: "new-tutorial" }; } } },
    latest, frameStore: { get: () => 50 }, flushWrite: async () => {}, toast: { error() {} }, openProject: async (slug) => opened.push(slug) });
  await send("How to add a style", { sourceSlug: "keep-launch", newVideo: { type: "how-to", requestId: "stable" }, references: [{ path: "assets/proof.mp4", kind: "video" }] });
  assert.equal(calls[0].method, "studio.chat.send_video");
  assert.equal(calls[0].params.slug, "keep-launch");
  assert.equal(calls[0].params.newVideo.requestId, "stable");
  assert.deepEqual(opened, ["new-tutorial"]);
  await send("Edit the title", {});
  assert.equal(calls[1].method, "studio.chat.send");
  assert.equal(opened.length, 1);
  latest.current.doc.slug = "other-video";
  await assert.rejects(send("Create tutorial", { sourceSlug: "keep-launch", newVideo: { type: "how-to", requestId: "stable" } }), /video changed/);
  assert.equal(calls.length, 2);
});
