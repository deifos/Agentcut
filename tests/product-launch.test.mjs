import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { findChrome, launchChrome } from "./helpers/chrome.mjs";
import { readGuide, registerAgentGuides } from "../packages/agentcut/src/studio/mcp-guides.ts";
import { workspacePaths } from "../packages/agentcut/src/studio/workspace.ts";
import { createProject, listAssets } from "../packages/agentcut/src/studio/projects.ts";
import { listMcpFiles } from "../packages/agentcut/src/studio/mcp-files.ts";
import { handleStudioHttp } from "../packages/agentcut/src/studio/http.ts";
import { registerStudioTools } from "../packages/agentcut/src/studio/tools.ts";
import { setBridgeExtension } from "../packages/agentcut/src/bridge.ts";
import { tempDir } from "./helpers/temp.mjs";
import { hasEstablishedLaunchContext, hasProjectLaunchMedia, isBareProductLaunchRequest } from "../lib/studio/product-launch.ts";
import { bareVideoType, creationVideoType, hasEstablishedVideoContext, isBareHowToRequest } from "../lib/studio/video-requests.ts";

let chrome, page, server;
const errors = [];
const skip = findChrome() ? false : "Chrome not found";
before(async () => {
  if (skip) return;
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL("./fixtures/product-launch-page.tsx", import.meta.url))],
    bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error", tsconfigRaw: "{}",
    alias: { "@": fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "") },
    // This fixture tests chat intake, not the gallery's bundled demo video.
    plugins: [{ name: "style-poster", setup(build) {
      build.onResolve({ filter: /styles\/StylesGallery$/ }, () => ({ path: "poster", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const StylePoster = () => null;" }));
    } }],
  });
  server = createServer((req, res) => {
    res.setHeader("content-type", req.url === "/page.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/page.js" ? bundle.outputFiles[0].text : '<div id="root"></div><script type="module" src="/page.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  chrome = await launchChrome();
  page = await chrome.open(`http://127.0.0.1:${server.address().port}/`, {
    onConsole(type, message) { if (type === "error" || type === "exception") errors.push(message); },
  });
  await page.evaluate('(async () => { while (!window.api) await new Promise(r => setTimeout(r, 20)); })()');
}, { timeout: 120_000 });
after(async () => { await chrome?.close(); server?.close(); });

const options = { skip, timeout: 20_000 };
const tick = () => page.evaluate('new Promise(r => setTimeout(r, 50))');
const clickLaunch = () => page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Product Launch").click()');
const clickHowTo = () => page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "How-to").click()');
async function type(text) {
  await page.evaluate(`(() => {
    const field = document.querySelector("textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(field, ${JSON.stringify(text)});
    field.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await tick();
}

for (const simple of [true, false]) {
  test(`empty click asks locally without dispatch, then sends the answer once (simple=${simple})`, options, async () => {
    await page.evaluate(`api.mount({ simple: ${simple} })`);
    await tick(); await clickLaunch(); await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
    assert.match(await page.evaluate('document.body.textContent'), /What are you launching\? Add a product URL or a short description\./);
    await type("Acme helps small teams ship videos. https://example.test");
    await page.evaluate('(() => { const field = document.querySelector("textarea"); for (let i = 0; i < 2; i++) field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); })()');
    await tick();
    const sent = await page.evaluate('api.sent()');
    assert.equal(sent.length, 1);
    const [request] = sent;
    assert.match(request.text, /^Create a product launch video\.\n\nAcme helps small teams ship videos\./);
    assert.equal(request.options.attachFrame, false);
    assert.deepEqual(request.options.references, []);
    assert.equal(request.options.newVideo.type, "product-launch");
    assert.match(request.options.newVideo.requestId, /^[\da-f-]{36}$/);
  });
}

test("a previous generic launch exchange and selected style or music do not establish a product", options, async () => {
  await page.evaluate('api.mount({ selectedStyle: { id: "lumen", name: "Lumen" }, selectedMusic: { id: "auto", name: "Auto" }, chat: { sessionId: "prior", running: null, messages: [{ id: "u", role: "user", at: 1, text: "Create a product launch video." }, { id: "a", role: "assistant", at: 2, status: "done", text: "What product are you launching? I found unrelated shared assets." }] } })');
  await tick(); await clickLaunch(); await tick();
  assert.deepEqual(await page.evaluate('api.sent()'), []);
  assert.match(await page.evaluate('document.body.textContent'), /What are you launching\?/);
});

for (const config of [
  { hasVideo: true },
  { hasLaunchMedia: true },
  { references: [{ path: "assets/logo.png", kind: "image" }] },
  { chat: { sessionId: "prior", running: null, messages: [{ id: "brief", role: "user", at: 1, text: "Our product is Acme, a video editor for teams." }] } },
]) {
  test(`existing project material or established product context sends normally: ${JSON.stringify(config)}`, options, async () => {
    await page.evaluate(`api.mount(${JSON.stringify(config)})`);
    await tick(); await clickLaunch(); await tick();
    assert.equal((await page.evaluate('api.sent()')).length, 1);
    assert.equal((await page.evaluate('api.sent()'))[0].text, "Create a product launch video.");
  });
}

test("a substantive brief on the launch action sends once without an intake", options, async () => {
  await page.evaluate('api.mount()'); await tick();
  await type("Acme is our editor for small teams. Show fast exports.");
  await clickLaunch(); await tick();
  const sent = await page.evaluate('api.sent()');
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /^Acme is our editor/);
  assert.match(sent[0].text, /Create a product launch video using this context\./);
});

for (const text of ["Product Launch", "Create a product launch video.", "Can you make a launch video?", "I want to create a product launch video.", "Create a 30-second product launch video."]) {
  test(`bare written request asks locally and preserves launch intent: ${text}`, options, async () => {
    await page.evaluate('api.mount()'); await tick(); await type(text);
    await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
    await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
    assert.match(await page.evaluate('document.body.textContent'), /What are you launching\?/);
    await type("Our app is Acme. It edits screen recordings.");
    await clickLaunch(); await tick();
    const sent = await page.evaluate('api.sent()');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, `${text}\n\nOur app is Acme. It edits screen recordings.`);
  });
}

test("local intake survives a project switch and a failed send keeps the answer and intent", options, async () => {
  await page.evaluate('api.mount({ slug: "intake-keep" }, true)');
  await tick(); await clickLaunch(); await tick();
  await page.evaluate('api.mount({ slug: "different-project" })'); await tick();
  assert.doesNotMatch(await page.evaluate('document.body.textContent'), /What are you launching\?/);
  await page.evaluate('api.mount({ slug: "intake-keep", references: [{ path: "assets/logo.png", kind: "image" }] }, true)');
  await tick();
  assert.match(await page.evaluate('document.body.textContent'), /What are you launching\?/);
  await type("Acme is a screen recorder."); await clickLaunch(); await tick();
  assert.match((await page.evaluate('api.sent()'))[0].text, /^Create a product launch video\./);
  assert.equal(await page.evaluate('document.querySelector("textarea").value'), "Acme is a screen recorder.");
  assert.match(await page.evaluate('document.body.textContent'), /logo\.png/);
});

test("history distinguishes generic launch requests from product information", () => {
  const user = (text) => [{ id: "u", role: "user", at: 1, text }];
  for (const text of ["Product Launch", "Create a product launch video.\n\nCreate a product launch video using this context.", "Create a launch video for my product."]) {
    assert.equal(hasEstablishedLaunchContext(user(text)), false, text);
  }
  assert.equal(hasEstablishedLaunchContext(user("Launch Acme for small teams.")), true);
  assert.equal(hasEstablishedLaunchContext(user("https://example.test is our product.")), true);
  assert.equal(isBareProductLaunchRequest("Launch Acme for small teams."), false);
  assert.equal(isBareProductLaunchRequest("Remove filler words."), false);
});

for (const simple of [true, false]) {
  test(`empty How-to asks locally and the answer dispatches exactly once (simple=${simple})`, options, async () => {
    await page.evaluate(`api.mount({ simple: ${simple} })`); await tick();
    await clickHowTo(); await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
    assert.match(await page.evaluate('document.body.textContent'), /What should viewers learn to do\? Add a URL, recording, or a short description of the task\./);
    await type("Show how to create an Agentcut project from a preset. https://example.test");
    await page.evaluate('(() => { const field = document.querySelector("textarea"); for (let i = 0; i < 2; i++) field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); })()');
    await tick();
    const sent = await page.evaluate('api.sent()');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, "Create a how-to video.\n\nShow how to create an Agentcut project from a preset. https://example.test");
    assert.doesNotMatch(await page.evaluate('document.body.textContent'), /What should viewers learn/);
  });
}

for (const text of ["How-to", "Make a tutorial video.", "Can you create a walkthrough?", "Create a 30-second how-to video."]) {
  test(`bare tutorial text uses local intake: ${text}`, options, async () => {
    await page.evaluate('api.mount()'); await tick(); await type(text);
    await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
    await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
    await type("Teach viewers how to export a video."); await clickHowTo(); await tick();
    assert.equal((await page.evaluate('api.sent()'))[0].text, `${text}\n\nTeach viewers how to export a video.`);
  });
}

for (const config of [{ hasVideo: true }, { hasLaunchMedia: true }]) {
  test(`existing project material alone still needs a local tutorial task: ${JSON.stringify(config)}`, options, async () => {
    await page.evaluate(`api.mount(${JSON.stringify(config)})`); await tick();
    await clickHowTo(); await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
    assert.match(await page.evaluate('document.body.textContent'), /What should viewers learn to do/);
    await type("How to add a style to Agentcut");
    await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
    await tick();
    const sent = await page.evaluate('api.sent()');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, "Create a how-to video.\n\nHow to add a style to Agentcut");
    assert.equal(sent[0].options.newVideo.type, "how-to");
  });
}

test("deliberately attached tutorial material can still start directly", options, async () => {
  await page.evaluate('api.mount({ references: [{ path: "assets/recording.webm", kind: "video" }] })'); await tick();
  await clickHowTo(); await tick();
  const sent = await page.evaluate('api.sent()');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, "Create a how-to video.");
  assert.deepEqual(sent[0].options.references, [{ path: "assets/recording.webm", kind: "video" }]);
});

test("an empty How-to on a completed launch asks locally before any creation or send", options, async () => {
  await page.evaluate('api.mount({ hasVideo: true, hasLaunchMedia: true, chat: { sessionId: "launch-complete", running: null, messages: [{ id: "launch-request", role: "user", at: 1, text: "Create a product launch video. Demonstrate Agentcut v2, projects by date, and how to start a launch.", references: [{ path: "assets/launch-ui.png", kind: "image" }] }, { id: "launch-result", role: "assistant", at: 2, status: "done", text: "Finished the launch. What should viewers learn next?" }] } })');
  await tick(); await clickHowTo(); await tick(); await clickHowTo(); await tick();
  assert.deepEqual(await page.evaluate('api.sent()'), []);
  assert.match(await page.evaluate('document.body.textContent'), /What should viewers learn to do/);
  await type("How to add a style to Agentcut");
  await page.evaluate('(() => { const field = document.querySelector("textarea"); for (let i = 0; i < 2; i++) field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); })()');
  await tick();
  const sent = await page.evaluate('api.sent()');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.newVideo.type, "how-to");
  assert.equal(sent[0].text, "Create a how-to video.\n\nHow to add a style to Agentcut");
});

test("tutorial brief sends directly; failed send preserves brief and attachments", options, async () => {
  await page.evaluate('api.mount({ references: [{ path: "assets/start.png", kind: "image" }] }, true)'); await tick();
  await type("Show exporting a wide video, then opening the saved MP4."); await clickHowTo(); await tick();
  assert.equal((await page.evaluate('api.sent()'))[0].text, "Show exporting a wide video, then opening the saved MP4.\n\nCreate a how-to video using this context.");
  assert.match(await page.evaluate('document.querySelector("textarea").value'), /Show exporting/);
  assert.match(await page.evaluate('document.body.textContent'), /start\.png/);
});

test("a generic prior tutorial or a product identity alone does not establish the task", options, async () => {
  await page.evaluate('api.mount({ selectedStyle: { id: "lumen", name: "Lumen" }, selectedMusic: { id: "auto", name: "Auto" }, chat: { sessionId: "prior", running: null, messages: [{ id: "u", role: "user", at: 1, text: "Create a how-to video." }, { id: "u2", role: "user", at: 2, text: "Our product is Acme." }, { id: "a", role: "assistant", at: 3, text: "What task should viewers learn?" }] } })');
  await tick(); await clickHowTo(); await tick();
  assert.deepEqual(await page.evaluate('api.sent()'), []);
  assert.match(await page.evaluate('document.body.textContent'), /What should viewers learn/);
  assert.match(await page.evaluate('document.body.textContent'), /Lumen/);
});

for (const config of [{ disabled: true }, { externalUploading: 1 }]) {
  test(`How-to waits when ${JSON.stringify(config)}`, options, async () => {
    await page.evaluate(`api.mount(${JSON.stringify(config)})`); await tick();
    await clickHowTo(); await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
  });
}

test("changing video type changes the local question and retains the chosen intent", options, async () => {
  await page.evaluate('api.mount()'); await tick(); await clickLaunch(); await tick();
  await clickHowTo(); await tick();
  assert.deepEqual(await page.evaluate('api.sent()'), []);
  assert.match(await page.evaluate('document.body.textContent'), /What should viewers learn/);
  await type("How to add captions to a recording."); await clickHowTo(); await tick();
  assert.equal((await page.evaluate('api.sent()'))[0].text, "Create a how-to video.\n\nHow to add captions to a recording.");
});

test("a written tutorial brief keeps the normal send path and an established task is reused", options, async () => {
  await page.evaluate('api.mount()'); await tick();
  const text = "Make a tutorial showing how to create a project from a preset.";
  await type(text);
  await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
  await tick();
  assert.equal((await page.evaluate('api.sent()'))[0].text, text);
  await page.evaluate(`api.mount({ chat: { sessionId: "prior", running: null, messages: [{ id: "task", role: "user", at: 1, text: ${JSON.stringify(text)} }] } })`);
  await tick(); await clickHowTo(); await tick();
  assert.equal((await page.evaluate('api.sent()'))[0].text, "Create a how-to video.");
});

for (const choice of ["Edit this video", "Create new video", "Cancel"]) {
  test(`ambiguous tutorial asks before dispatch and respects ${choice}`, options, async () => {
    await page.evaluate('api.mount({ hasVideo: true, references: [{ path: "assets/proof.mp4", kind: "video" }] })'); await tick();
    await type("turn this into a tutorial");
    await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
    await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
    assert.match(await page.evaluate('document.body.textContent'), /Should I edit this video or create a separate new video/);
    await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(choice)}).click()`);
    await tick();
    const sent = await page.evaluate('api.sent()');
    if (choice === "Cancel") {
      assert.deepEqual(sent, []);
      assert.equal(await page.evaluate('document.querySelector("textarea").value'), "turn this into a tutorial");
      assert.match(await page.evaluate('document.body.textContent'), /proof\.mp4/);
    } else {
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].options.references, [{ path: "assets/proof.mp4", kind: "video" }]);
      if (choice === "Edit this video") assert.equal(sent[0].options.newVideo, undefined);
      else assert.equal(sent[0].options.newVideo.type, "how-to");
    }
  });
}

test("clear edit instructions do not create a video or ask a destination question", options, async () => {
  await page.evaluate('api.mount({ hasVideo: true })'); await tick();
  await type("Edit this tutorial to make the title readable.");
  await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
  await tick();
  assert.equal((await page.evaluate('api.sent()'))[0].options.newVideo, undefined);
  assert.doesNotMatch(await page.evaluate('document.body.textContent'), /Should I edit/);
});

test("a failed creation keeps its request ID on retry", options, async () => {
  await page.evaluate('api.mount({ hasVideo: true }, true)'); await tick();
  await type("How to add a style to Agentcut");
  await clickHowTo(); await tick(); await clickHowTo(); await tick();
  const sent = await page.evaluate('api.sent()');
  assert.equal(sent.length, 2);
  assert.equal(sent[0].options.newVideo.requestId, sent[1].options.newVideo.requestId);
  assert.equal(sent[0].options.newVideo.type, "how-to");
});

const voiceQuestion = "Should it also have a voiceover, or just music with text steps?";
const waitingChat = (text = `The outline and seven steps are ready.\n\n${voiceQuestion}`) => ({ sessionId: "tutorial", running: null,
  messages: [{ id: "awaiting-voice", role: "assistant", at: 1, status: "done", parts: [{ type: "text", text }] }] });

test("a completed tutorial shows its actual question near the composer and a reply clears it", options, async () => {
  await page.evaluate(`api.mount({ chat: ${JSON.stringify(waitingChat())} })`); await tick();
  const prompt = `document.querySelector('section[aria-label="Waiting for your reply"]')`;
  assert.match(await page.evaluate(`${prompt}?.textContent ?? ""`), /Should it also have a voiceover/);
  await type("Make a tutorial with a voiceover.");
  await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
  await tick();
  assert.equal((await page.evaluate('api.sent()')).length, 1);
  assert.equal((await page.evaluate('api.sent()'))[0].options.newVideo, undefined);
  assert.equal(await page.evaluate(`${prompt} === null`), true);
});

test("failed reply keeps the question and draft; queued replies and generation hide stale waiting", options, async () => {
  await page.evaluate(`api.mount({ chat: ${JSON.stringify(waitingChat())} }, true)`); await tick();
  await type("Use a voiceover.");
  await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
  await tick();
  assert.match(await page.evaluate('document.body.textContent'), /Waiting for your reply/);
  assert.equal(await page.evaluate('document.querySelector("textarea").value'), "Use a voiceover.");
  const queued = waitingChat(); queued.messages.push({ id: "reply", role: "user", at: 2, text: "Use voice", status: "queued" });
  await page.evaluate(`api.mount({ chat: ${JSON.stringify(queued)} })`); await tick();
  assert.doesNotMatch(await page.evaluate('document.body.textContent'), /Waiting for your reply/);
  const active = waitingChat(); active.running = "active-generation";
  await page.evaluate(`api.mount({ chat: ${JSON.stringify(active)} })`); await tick();
  assert.doesNotMatch(await page.evaluate('document.body.textContent'), /Waiting for your reply/);
});

test("Still blocked choices show a concise request even with a final declarative sentence", options, async () => {
  const text = "The voice and markers are ready.\n\n**Still blocked:** I need the real canvas screen. Either option works:\n1. **A screen recording in the Library panel.** Record the real actions.\n2. **Code access.** Provide the source location.\n\nOnce I have either, I will build scenes and check both formats.";
  await page.evaluate(`api.mount({ chat: ${JSON.stringify(waitingChat(text))} })`); await tick();
  const section = await page.evaluate(`document.querySelector('section[aria-label="Waiting for your reply"]')?.textContent ?? ''`);
  assert.match(section, /I need the real canvas screen/);
  assert.match(section, /A screen recording in the Library panel/);
  assert.match(section, /Code access/);
  assert.doesNotMatch(section, /Once I have either/);
});

test("waiting state follows the selected video and ordinary completion stays clear", options, async () => {
  await page.evaluate(`api.mount({ slug: "waiting-tutorial", chat: ${JSON.stringify(waitingChat())} })`); await tick();
  assert.match(await page.evaluate('document.body.textContent'), /Waiting for your reply/);
  await page.evaluate(`api.mount({ slug: "completed-launch", chat: ${JSON.stringify(waitingChat("The launch is ready. Both variants passed review."))} })`); await tick();
  assert.doesNotMatch(await page.evaluate('document.body.textContent'), /Waiting for your reply/);
  await page.evaluate(`api.mount({ slug: "waiting-tutorial", chat: ${JSON.stringify(waitingChat())} })`); await tick();
  assert.match(await page.evaluate('document.body.textContent'), /Waiting for your reply/);
});

test("How-to routing distinguishes task details and packaged guides resolve through MCP", async () => {
  assert.equal(isBareHowToRequest("Make a tutorial showing how to export a video."), false);
  assert.equal(bareVideoType("Create a how-to video."), "how-to");
  assert.equal(bareVideoType("Create a product launch video."), "product-launch");
  assert.equal(creationVideoType("how to add a style to Agentcut"), "how-to");
  assert.equal(creationVideoType("I want a launch video for Agentcut"), "product-launch");
  assert.equal(creationVideoType("A tutorial on exporting a video"), "how-to");
  assert.equal(creationVideoType("Edit my launch video title"), null);
  const messages = [{ role: "user", id: "task", at: 1, text: "Show how to export a video." }];
  assert.equal(hasEstablishedVideoContext("how-to", messages), true);
  assert.equal(hasEstablishedVideoContext("how-to", [{ role: "user", id: "old-launch", at: 1, text: "Create a product launch video. Show how to start from a preset." }]), false);
  const handlers = new Map(), resources = new Map();
  registerAgentGuides({ registerTool(name, _config, fn) { handlers.set(name, fn); }, registerResource(name, _uri, _config, fn) { resources.set(name, fn); } });
  const path = "references/how-to.md";
  const guide = readFileSync(new URL(`../skills/agentcut/${path}`, import.meta.url), "utf8");
  assert.equal(readGuide(path), guide);
  assert.match(readGuide("SKILL.md"), /How-to[\s\S]*references\/how-to\.md/);
  const index = JSON.parse((await handlers.get("agentcut_guide")({})).content[0].text);
  assert.ok(index.guides.includes(path));
  assert.equal((await handlers.get("agentcut_guide")({ path })).content[0].text, guide);
  assert.equal((await resources.get(`guide:${path}`)()).contents[0].text, guide);
  const batch = JSON.parse((await handlers.get("agentcut_guide")({ paths: [path, "references/website-howto.md", "references/efficient-review.md"] })).content[0].text);
  assert.equal(batch.guides[0].content, guide);
  assert.equal(batch.guides.length, 3);
  assert.match(guide, /how to add a style to Agentcut/);
  assert.match(guide, /source-code read locates controls; it is not a visual/i);
  await assert.rejects(handlers.get("agentcut_guide")({ path, paths: [path] }), /not both/);
});

test("shared stock, renders, music and an empty asset list are not product footage", () => {
  assert.equal(hasProjectLaunchMedia([]), false);
  assert.equal(hasProjectLaunchMedia([
    { path: "library:stock/product.png", kind: "image" },
    { path: "renders/previous.mp4", kind: "video" },
    { path: "assets/music.mp3", kind: "audio" },
  ]), false);
  assert.equal(hasProjectLaunchMedia([{ path: "assets/upload.mp4", kind: "video" }]), true);
});

test("launch keeps typed context and uploaded files, and only clears sent attachments", options, async () => {
  await page.evaluate('api.mount({ hasVideo: true, references: [{ path: "assets/proof.mp4", kind: "video" }] }, false, true)');
  await tick(); await type("For small teams. Show the real export. Visit example.test.");
  await clickLaunch(); await tick();
  await page.evaluate('api.addReference({ path: "assets/later.png", kind: "image" }); api.finish()');
  await tick();
  const [request] = await page.evaluate('api.sent()');
  assert.match(request.text, /^For small teams\. Show the real export\. Visit example\.test\./);
  assert.match(request.text, /Create a product launch video using this context\./);
  assert.deepEqual(request.options.references, [{ path: "assets/proof.mp4", kind: "video" }]);
  assert.equal(await page.evaluate('document.querySelector("textarea").value'), "");
  assert.match(await page.evaluate('document.body.textContent'), /later\.png/);
  assert.doesNotMatch(await page.evaluate('document.body.textContent'), /proof\.mp4/);
});

test("a failed launch keeps the draft and attachments for retry", options, async () => {
  await page.evaluate('api.mount({ references: [{ path: "assets/logo.png", kind: "image" }] }, true)');
  await tick(); await type("Keep our logo."); await clickLaunch(); await tick();
  assert.equal(await page.evaluate('document.querySelector("textarea").value'), "Keep our logo.");
  assert.match(await page.evaluate('document.body.textContent'), /logo\.png/);
});

for (const config of [{ disabled: true }, { externalUploading: 1 }]) {
  test(`launch waits when ${JSON.stringify(config)}`, options, async () => {
    await page.evaluate(`api.mount(${JSON.stringify(config)})`);
    await tick(); await clickLaunch(); await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
  });
}

test("written launch requests use normal Send without changing the request", options, async () => {
  await page.evaluate('api.mount()'); await tick();
  const request = "Make a launch film for our new export feature.";
  await type(request);
  await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
  await tick();
  assert.equal((await page.evaluate('api.sent()'))[0].text, request);
  assert.deepEqual(errors, []);
});

test("the main skill routes launch intent and MCP resolves the synced guide and resource", async () => {
  const path = "references/product-launch.md";
  const source = readFileSync(new URL(`../skills/agentcut/${path}`, import.meta.url), "utf8");
  assert.equal(readGuide(path), source);
  const main = readGuide("SKILL.md");
  assert.match(main, /Product Launch[\s\S]*written request[\s\S]*product reveal[\s\S]*references\/product-launch\.md/);
  assert.equal(main, readFileSync(new URL("../skills/agentcut/SKILL.md", import.meta.url), "utf8"));
  const tools = new Map(), resources = new Map();
  registerAgentGuides({
    registerTool(name, _config, handler) { tools.set(name, handler); },
    registerResource(name, _uri, _config, handler) { resources.set(name, handler); },
  });
  const index = JSON.parse((await tools.get("agentcut_guide")({})).content[0].text);
  assert.ok(index.guides.includes(path));
  assert.equal((await tools.get("agentcut_guide")({ path })).content[0].text, source);
  assert.equal((await resources.get(`guide:${path}`)()).contents[0].text, source);
  assert.throws(() => readGuide("../product-launch.md"), /Unknown guide/);
});

test("Library uploads and shared media are discoverable through the guide's MCP path without chat references", async () => {
  const paths = workspacePaths(tempDir(join(tmpdir(), "agentcut-launch-assets-")));
  const { slug } = createProject(paths, { name: "Launch assets", fonts: [] });
  mkdirSync(join(paths.library, "sfx"), { recursive: true });
  writeFileSync(join(paths.library, "sfx", "reveal.wav"), "test sound bytes");
  const uploads = [];
  const uploadServer = createServer((req, res) => {
    void handleStudioHttp(req, res, { paths, onUploaded: (...args) => uploads.push(args) });
  });
  await new Promise((resolve) => uploadServer.listen(0, "127.0.0.1", resolve));
  const handlers = new Map();
  registerStudioTools({ registerTool(name, _config, handler) { handlers.set(name, handler); } });
  setBridgeExtension({ handleLocalCall(method, params) {
    assert.equal(method, "studio.local.list_files");
    return Promise.resolve(listMcpFiles(paths, params.scope, params.project, params.path, params.offset, params.limit));
  } });
  const list = async (args) => JSON.parse((await handlers.get("agentcut_list_files")(args)).content[0].text);
  try {
    // The Library panel puts dropped files in assets/ through this upload endpoint.
    // No chat references or timeline clips are created in this test.
    for (const name of ["logo.png", "broll.mp4", "recording.webm", "music.mp3", "click.wav"]) {
      const response = await fetch(`http://127.0.0.1:${uploadServer.address().port}/studio/upload/${slug}/assets/${name}`, {
        method: "PUT", body: `test bytes for ${name}`,
      });
      assert.equal(response.status, 200);
    }
    assert.equal(uploads.length, 5);
    assert.equal(hasProjectLaunchMedia(listAssets(paths, slug)), true);
    const first = await list({ scope: "project", project: slug, path: "assets", limit: 2 });
    assert.equal(first.total, 5);
    assert.equal(first.nextOffset, 2);
    const found = [...first.entries];
    let offset = first.nextOffset;
    while (offset !== null) {
      const next = await list({ scope: "project", project: slug, path: "assets", offset, limit: 2 });
      found.push(...next.entries); offset = next.nextOffset;
    }
    assert.deepEqual(found.map((entry) => entry.path).sort(), ["broll.mp4", "click.wav", "logo.png", "music.mp3", "recording.webm"].map((name) => `assets/${name}`));
    assert.ok((await list({ scope: "library", path: "" })).entries.some((entry) => entry.path === "sfx" && entry.kind === "directory"));
    assert.equal((await list({ scope: "library", path: "sfx" })).entries[0].path, "sfx/reveal.wav");
    assert.deepEqual(JSON.parse(readFileSync(join(paths.projects, slug, "layers.json"), "utf8")).tracks, []);
  } finally {
    setBridgeExtension(null);
    await new Promise((resolve) => uploadServer.close(resolve));
  }
});

const clickFeatureLaunch = () => page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Feature Launch").click()');
for (const simple of [true, false]) {
  test(`Feature Launch asks locally on a populated source and sends one separate request (simple=${simple})`, options, async () => {
    await page.evaluate(`api.mount({ simple: ${simple}, hasVideo: true, hasLaunchMedia: true, chat: {sessionId:"old",running:null,messages:[{role:"user",id:"old-product",at:1,text:"Our product is Agentcut, a video editor."}]} })`);
    await tick(); await clickFeatureLaunch(); await tick();
    assert.deepEqual(await page.evaluate('api.sent()'), []);
    assert.match(await page.evaluate('document.body.textContent'), /Which feature are you announcing/);
    await type("Canvas versions let people explore another edit while keeping the original.");
    await page.evaluate('(() => { const field=document.querySelector("textarea"); for(let i=0;i<2;i++) field.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})); })()');
    await tick();const sent=await page.evaluate('api.sent()');assert.equal(sent.length,1);assert.equal(sent[0].options.newVideo.type,"feature-launch");assert.match(sent[0].text,/^Create a feature launch video\.\n\nCanvas versions/);
  });
}
for(const text of ["Announce our new feature.", "Make an announcement video for our new feature.", "Feature Launch", "Create a feature launch video.", "Create a 30-second feature announcement video."]) {
  test(`bare feature request asks before dispatch: ${text}`,options,async()=>{await page.evaluate('api.mount({hasVideo:true})');await tick();await type(text);await page.evaluate('document.querySelector("textarea").dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))');await tick();assert.deepEqual(await page.evaluate('api.sent()'),[]);assert.match(await page.evaluate('document.body.textContent'),/Which feature are you announcing/);});
}
test("specific Feature Launch brief bypasses intake and keeps the feature request",options,async()=>{
 await page.evaluate('api.mount({})');await tick();await type("Announce canvas versions: compare independent edits while keeping the original.");await clickFeatureLaunch();await tick();const sent=await page.evaluate('api.sent()');assert.equal(sent.length,1);assert.equal(sent[0].options.newVideo.type,"feature-launch");assert.match(sent[0].text,/Create a feature launch video using this context/);
});
test("Feature Launch routes separately, preserves edits and exposes its packaged guide",async()=>{
 assert.equal(creationVideoType("How should we announce the new feature?"), null);
 assert.equal(bareVideoType("Feature Launch"),"feature-launch");assert.equal(bareVideoType("Create a 30-second feature announcement video."),"feature-launch");
 assert.equal(creationVideoType("Make a feature launch video for canvas versions"),"feature-launch");assert.equal(creationVideoType("Announce the new canvas versions feature"),"feature-launch");assert.equal(creationVideoType("Edit this feature launch title"),null);
 assert.equal(hasEstablishedVideoContext("feature-launch",[{role:"user",id:"p",at:1,text:"Our product is Agentcut."}]),false);
 assert.equal(hasEstablishedVideoContext("feature-launch",[{role:"user",id:"f",at:1,text:"Our new feature lets users compare canvas versions."}]),true);
 assert.equal(hasEstablishedVideoContext("feature-launch",[{role:"user",id:"f",at:1,text:"Create a feature launch video."}]),false);
 const path="references/feature-launch.md";assert.equal(readGuide(path),readFileSync(new URL(`../skills/agentcut/${path}`,import.meta.url),'utf8'));assert.match(readGuide('SKILL.md'),/Feature Launch[\s\S]*references\/feature-launch\.md/);assert.match(readGuide(path),/problem statement is optional/);assert.match(readGuide(path),/final full-picture and audio review/);
});
