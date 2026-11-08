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
        `http://127.0.0.1:${server.address().port}/`, { onConsole: (type, message) => { if (type === "exception" || type === "error") console.error(message); } },
      );
      await page.evaluate(
        `(async()=>{const deadline=Date.now()+5000;while(!window.setLayout||!document.querySelector('.react-flow')){if(Date.now()>deadline)throw new Error(document.body.innerText);await new Promise(r=>setTimeout(r,30))}})()`,
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
      await voice.evaluate(`[...document.querySelectorAll('button[aria-label="Provider"]')].at(-1).click()`);
      await voice.evaluate("new Promise(r=>setTimeout(r,50))");
      await voice.evaluate(`[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='Ming 0.5B (local GPU)').click()`);
      await voice.evaluate("new Promise(r=>setTimeout(r,100))");
      assert.equal(await voice.evaluate(`!!document.querySelector('input[aria-label="Voice style"]')`), false);
      await voice.evaluate(`document.querySelector('button[aria-label="Voice"]').click()`);
      await voice.evaluate("new Promise(r=>setTimeout(r,50))");
      await voice.evaluate(`[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='Describe voice and delivery').click()`);
      await voice.evaluate("new Promise(r=>setTimeout(r,100))");
      assert.equal(await voice.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Generate').disabled`), true);
      await voice.evaluate(`(()=>{const field=document.querySelector('input[aria-label="Voice style"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'A joyful narrator.');field.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await voice.evaluate("new Promise(r=>setTimeout(r,50))");
      await voice.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Generate').click()`);
      await voice.evaluate("new Promise(r=>setTimeout(r,100))");
      const mingCall = await voice.evaluate(`window.calls.filter(c=>c.method==='studio.voice.generate').at(-1)`);
      assert.equal(mingCall.provider, 'ming');
      assert.equal(mingCall.voice, 'freeform');
      assert.equal(mingCall.style, 'A joyful narrator.');
      for (const mode of ['uninstalled', 'disconnected']) {
        const cold = await chrome.open(`http://127.0.0.1:${server.address().port}/?local&${mode}`);
        await cold.evaluate(`(async()=>{const deadline=Date.now()+5000;while(![...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.trim()==='Voices')){if(Date.now()>deadline)throw new Error('Missing voices tab');await new Promise(r=>setTimeout(r,30));}[...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.trim()==='Voices').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));})()`);
        await cold.evaluate("new Promise(r=>setTimeout(r,150))");
        assert.equal(await cold.evaluate(`document.querySelector('[aria-label="Play Emma (American) (ming) sample"]').disabled`), false);
        assert.equal(await cold.evaluate(`document.querySelector('[aria-label="Use Emma (American) (ming) voice"]').disabled`), true);
        assert.equal(await cold.evaluate(`window.calls.some(c=>c.method==='studio.voice.preview'||c.method==='studio.voice.installMing')`), false);
        if (mode === 'uninstalled') {
          await cold.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Set up Ming').click()`);
          await cold.evaluate("new Promise(r=>setTimeout(r,80))");
          assert.equal(await cold.evaluate(`document.querySelector('[role="dialog"]').textContent.includes('20 GB')`), true);
          assert.equal(await cold.evaluate(`window.calls.some(c=>c.method==='studio.voice.installMing')`), false);
          await cold.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Download and install').click()`);
          await cold.evaluate("new Promise(r=>setTimeout(r,80))");
          const install = await cold.evaluate(`window.calls.find(c=>c.method==='studio.voice.installMing')`);
          assert.equal(install.confirm, true);
          assert.equal(install.device, 'cpu');
          assert.equal(install.directory, 'E:/voice-models/ming');
        }
      }
      const localPage = await chrome.open(`http://127.0.0.1:${server.address().port}/?local`, { onConsole: (type, message) => { if (type === "exception" || type === "error") console.error(message); } });
      await localPage.evaluate(`(async()=>{const deadline=Date.now()+5000;while(![...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.trim()==='Voices')){if(Date.now()>deadline)throw new Error(document.body.innerText);await new Promise(r=>setTimeout(r,30));}[...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.trim()==='Voices').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));})()`);
      await localPage.evaluate(`(async()=>{const deadline=Date.now()+5000;while(!document.querySelector('[aria-label="Use Emma (American) (ming) voice"]')){if(Date.now()>deadline)throw new Error(document.body.innerText);await new Promise(r=>setTimeout(r,30));}window.played=[];window.Audio=class {constructor(src){this.src=src;window.lastSampleAudio=this}play(){window.played.push(this.src);return Promise.resolve()}pause(){}};})()`);
      assert.equal(await localPage.evaluate(`document.body.textContent.includes('OpenAI')`), false);
      await localPage.evaluate(`document.querySelector('[aria-label="Play Emma (American) (ming) sample"]').click()`);
      await localPage.evaluate("new Promise(r=>setTimeout(r,100))");
      assert.equal(await localPage.evaluate(`window.calls.filter(c=>c.method==='studio.voice.generate').length`), 0);
      assert.equal(await localPage.evaluate(`window.calls.filter(c=>c.method==='studio.voice.preview').length`), 0);
      await localPage.evaluate(`window.lastSampleAudio.onerror()`);
      assert.equal(await localPage.evaluate(`window.played.at(-1)`), '/voice-samples/ming/US_Emma.wav');

      await localPage.evaluate(`document.querySelector('[aria-label="Stop Emma (American) (ming) sample"]').click()`);
      await localPage.evaluate("new Promise(r=>setTimeout(r,50))");
      await localPage.evaluate(`document.querySelector('[aria-label="Play Emma (American) (ming) sample"]').click()`);
      await localPage.evaluate("new Promise(r=>setTimeout(r,50))");
      assert.equal(await localPage.evaluate(`window.calls.filter(c=>c.method==='studio.voice.preview').length`), 0);
      assert.equal(await localPage.evaluate(`document.querySelector('[aria-label="Play Describe voice and delivery (ming) sample"]').disabled`), true);
      await localPage.evaluate(`document.querySelector('[aria-label="Use Emma (American) (ming) voice"]').click()`);
      await localPage.evaluate("new Promise(r=>setTimeout(r,80))");
      await localPage.evaluate(`(()=>{const f=document.querySelector('[aria-label="Voice-over script"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(f,'Welcome to this video.');f.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await localPage.evaluate("new Promise(r=>setTimeout(r,50))");
      await localPage.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Create voice-over').click()`);
      await localPage.evaluate("new Promise(r=>setTimeout(r,80))");
      const creation = await localPage.evaluate(`window.calls.find(c=>c.method==='studio.voice.generate')`);
      assert.equal(creation.provider, 'ming');
      assert.equal(creation.voice, 'US_Emma');
      assert.equal(creation.text, 'Welcome to this video.');
      assert.equal(await localPage.evaluate(`window.played.some(url=>url==='https://files.screenslick.com/studio/voice-samples/ming/US_Emma.wav')`), true);

      assert.equal(await localPage.evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
      await localPage.evaluate("new Promise(r=>setTimeout(r,300))");
      assert.equal(await localPage.evaluate(`(()=>{const t=[...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.trim()==='Voices');return t.getBoundingClientRect().bottom <= document.querySelector('[aria-label="Local voices"]').getBoundingClientRect().top})()`), true);
      if (process.env.EXPORT_ARTIFACT_DIR) {
        const screenshot = await localPage.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`${process.env.EXPORT_ARTIFACT_DIR}/local-voices.png`, Buffer.from(screenshot.data, 'base64'));
      }


    } finally {
      await chrome.close();
      await new Promise((r) => server.close(r));
    }
  },
);
