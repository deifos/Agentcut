import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { findChrome, launchChrome } from "./helpers/chrome.mjs";

const skip = findChrome() ? false : "Chrome not found";
let chrome, page, server;
before(async () => {
  if (skip) return;
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("./fixtures/studio-review-page.tsx", import.meta.url))],
    bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error", tsconfigRaw: "{}",
    alias: { "@": fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "") } });
  server = createServer((req, res) => {
    res.setHeader("content-type", req.url === "/page.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/page.js" ? bundle.outputFiles[0].text : '<div id="root"></div><script type="module" src="/page.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  chrome = await launchChrome();
  page = await chrome.open(`http://127.0.0.1:${server.address().port}/`, { onConsole: (type, text) => {
    if (type === "error" || type === "exception") console.error(text);
  } });
  await page.evaluate('(async () => { while (!window.api) await new Promise(r => setTimeout(r, 20)); })()');
}, { timeout: 120_000 });
after(async () => { await chrome?.close(); server?.close(); });
const options = { skip, timeout: 20_000 };
const tick = () => page.evaluate('new Promise(r => setTimeout(r, 50))');

for (const ids of [["a"], ["a", "b"]]) {
  test(`confirmation preserves concurrent edits when deleting ${ids.length} clips`, options, async () => {
    await page.evaluate(`api.inspector(${JSON.stringify(ids)})`);
    await tick();
    // The inspector's button has a longer label than the confirmation's action.
    await page.evaluate('(() => { const b = [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Delete")); if (!b) throw new Error("No delete button"); b.click(); })()');
    await tick();
    await page.evaluate('api.editWhileConfirming("edit")');
    await page.evaluate('document.querySelector("[data-testid=confirm-dialog] button:last-child").click()');
    await tick();
    const result = await page.evaluate('api.committed()');
    assert.deepEqual(result, ids.length === 1 ? ["b", "new-agent-clip"] : ["new-agent-clip"]);
  });
}
for (const mode of ["switch", "lock"]) {
  test(`confirmation does not delete after project ${mode}`, options, async () => {
    await page.evaluate('api.inspector(["a"])'); await tick();
    await page.evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Delete")).click()'); await tick();
    await page.evaluate(`api.editWhileConfirming(${JSON.stringify(mode)})`);
    await page.evaluate('document.querySelector("[data-testid=confirm-dialog] button:last-child").click()'); await tick();
    assert.equal(await page.evaluate('api.committed()'), null);
  });
}
test("replacing a source clears its old copy and requests the replacement", options, async () => {
  await page.evaluate('api.proxies()'); await tick();
  assert.match((await page.evaluate('api.proxyResult()')).ready["assets/a.mp4"], /copy-1/);
  const pending = await page.evaluate('api.replace(2)');
  assert.deepEqual(pending.ready, {});
  await tick();
  const result = await page.evaluate('api.proxyResult()');
  assert.match(result.ready["assets/a.mp4"], /copy-2/);
  assert.equal(result.requests, 2);
  await page.evaluate('api.replace(3, "none")'); await tick();
  const noCopy = await page.evaluate('api.proxyResult()');
  assert.deepEqual(noCopy.ready, {});
  assert.equal(noCopy.player, undefined);
});
test("a replacement found during playback is applied on pause", options, async () => {
  await page.evaluate('api.replace(4)'); await tick();
  await page.evaluate('api.playing(true); api.replace(5)'); await tick();
  let result = await page.evaluate('api.proxyResult()');
  assert.match(result.player["assets/a.mp4"], /copy-4/);
  assert.match(result.ready["assets/a.mp4"], /copy-5/);
  await page.evaluate('api.playing(false)');
  result = await page.evaluate('api.proxyResult()');
  assert.match(result.player["assets/a.mp4"], /copy-5/);
});
