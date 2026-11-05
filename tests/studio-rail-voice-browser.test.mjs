import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { findChrome, launchChrome } from "./helpers/chrome.mjs";
test(
  "bounded style rail clears canvas header and timeline; local voice previews and manual provider choice",
  { skip: !findChrome(), timeout: 120000 },
  async () => {
    const root = fileURLToPath(new URL("..", import.meta.url)).replace(
      /[\\/]$/,
      "",
    );
    const bundle = await build({
      entryPoints: [`${root}/tests/fixtures/studio-rail-page.tsx`],
      outfile: "page.js",
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
      alias: { "@": root },
    });
    const css = (
      await postcss([tailwind()]).process(
        readFileSync(`${root}/app/globals.css`, "utf8"),
        { from: `${root}/app/globals.css` },
      )
    ).css;
    const js = bundle.outputFiles.find((f) => f.path.endsWith(".js")).text;
    const extra =
      bundle.outputFiles.find((f) => f.path.endsWith(".css"))?.text || "";
    const server = createServer((req, res) => {
      res.setHeader(
        "content-type",
        req.url === "/page.js"
          ? "text/javascript"
          : req.url === "/style.css"
            ? "text/css"
            : "text/html",
      );
      res.end(
        req.url === "/page.js"
          ? js
          : req.url === "/style.css"
            ? css + extra
            : '<!doctype html><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/page.js"></script>',
      );
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const chrome = await launchChrome();
    try {
      const page = await chrome.open(
        `http://127.0.0.1:${server.address().port}/`,
      );
      await page.evaluate(
        `(async()=>{while(!window.setLayout||!document.querySelector('.react-flow'))await new Promise(r=>setTimeout(r,30))})()`,
      );
      for (const [width, height, panels] of [
        [1400, 350, true],
        [1400, 100, true],
        [600, 100, false],
        [900, 180, true],
        [390, 90, false],
      ]) {
        await page.send("Emulation.setDeviceMetricsOverride", {
          width,
          height: 800,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await page.evaluate(`window.setLayout(${height},${panels})`);
        await page.evaluate("new Promise(r=>setTimeout(r,80))");
        const bounds = await page.evaluate(
          `(()=>{const r=document.querySelector('[aria-label="Style actions"]').getBoundingClientRect(),u=document.querySelector('#upper').getBoundingClientRect(),t=document.querySelector('#timeline').getBoundingClientRect(),c=[...document.querySelectorAll('span')].find(e=>/^2 clips$/.test(e.textContent.trim())).getBoundingClientRect();return {rail:r.toJSON(),upper:u.toJSON(),timeline:t.toJSON(),count:c.toJSON()}})()`,
        );
        assert.ok(bounds.rail.right <= bounds.count.left);
        assert.ok(bounds.rail.bottom <= bounds.timeline.top + 1);
        assert.ok(bounds.rail.height <= height);
        await page.evaluate(
          `document.activeElement?.blur();document.querySelector('[aria-label="Open Cinematic Mode"]').focus()`,
        );
        const visible = await page.evaluate(
          `(()=>{const b=document.querySelector('[aria-label="Open Cinematic Mode"]'),r=b.getBoundingClientRect(),v=document.querySelector('[aria-label="Style actions"]').getBoundingClientRect();return r.top>=v.top&&r.bottom<=v.bottom+1})()`,
        );
        assert.equal(visible, true);
      }
      if (process.env.EXPORT_ARTIFACT_DIR) {
        const s = await page.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(
          `${process.env.EXPORT_ARTIFACT_DIR}/style-rail-short.png`,
          Buffer.from(s.data, "base64"),
        );
      }
      const voice = await chrome.open(
        `http://127.0.0.1:${server.address().port}/?voice`,
      );
      await voice.evaluate(
        `(async()=>{while(!document.querySelector('button[aria-label="Play Heart sample"]'))await new Promise(r=>setTimeout(r,30));window.played=[];window.paused=0;window.Audio=class {constructor(src){this.src=new URL(src,location).href}play(){window.played.push(this.src);return Promise.resolve()}pause(){window.paused++}};})()`,
      );
      await voice.evaluate(
        `document.querySelector('button[aria-label="Play Heart sample"]').click()`,
      );
      await voice.evaluate("new Promise(r=>setTimeout(r,80))");
      assert.match(
        (await voice.evaluate("window.played"))[0],
        /voice-samples\/kokoro\/af_heart.wav$/,
      );
      await voice.evaluate(
        `document.querySelector('button[aria-label="Stop Heart sample"]').click()`,
      );
      assert.ok(await voice.evaluate("window.paused>0"));
      await voice.evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Generate').click()`,
      );
      await voice.evaluate("new Promise(r=>setTimeout(r,100))");
      assert.equal(
        (
          await voice.evaluate(
            `window.calls.filter(c=>c.method==='studio.voice.generate')`,
          )
        )[0].provider,
        "kokoro",
      );
      await voice.evaluate(
        `[...document.querySelectorAll('button[aria-label="Provider"]')].at(-1).click()`,
      );
      await voice.evaluate("new Promise(r=>setTimeout(r,50))");
      await voice.evaluate(
        `[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='OpenAI').click()`,
      );
      await voice.evaluate("new Promise(r=>setTimeout(r,100))");
      await voice.evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Generate').click()`,
      );
      await voice.evaluate("new Promise(r=>setTimeout(r,100))");
      assert.deepEqual(
        await voice.evaluate(
          `window.calls.filter(c=>c.method==='studio.voice.generate').map(c=>c.provider)`,
        ),
        ["kokoro", "openai"],
      );
    } finally {
      await chrome.close();
      await new Promise((r) => server.close(r));
    }
  },
);
