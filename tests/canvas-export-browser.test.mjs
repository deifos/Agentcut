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
  "export selection, wide and narrow layout, keyboard overflow, target binding and double click",
  { skip: !findChrome(), timeout: 120000 },
  async () => {
    const root = fileURLToPath(new URL("..", import.meta.url)).replace(
      /[\\/]$/,
      "",
    );
    const bundle = await build({
      entryPoints: [`${root}/tests/fixtures/canvas-export-page.tsx`],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      jsx: "automatic",
      define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
      alias: { "@": root },
      plugins: [
        {
          name: "fake-render",
          setup(b) {
            b.onResolve(
              { filter: /^@\/lib\/studio\/(export|bundle)$/ },
              (a) => ({ path: a.path, namespace: "fake" }),
            );
            b.onLoad({ filter: /.*/, namespace: "fake" }, (a) => ({
              loader: "js",
              contents: a.path.endsWith("/export")
                ? `export async function exportInBrowser(o){window.calls.push({method:'browser',slug:o.doc.slug,module:o.loaded.slug,variant:o.variant});await new Promise(r=>setTimeout(r,80));if(window.failBrowserFor===o.doc.slug){window.failBrowserFor=null;throw Error('Fixture render failed')}return {path:'renders/test.mp4'}};export async function planLoudness(){return {gain:1}};`
                : `export async function fetchStudioBundle(){return {code:'',revision:1}};export function evaluateStudioBundle(){return {}};export function studioFileUrl(){return ''};`,
            }));
          },
        },
      ],
    });
    const css = (
      await postcss([tailwind()]).process(
        readFileSync(`${root}/app/globals.css`, "utf8"),
        { from: `${root}/app/globals.css` },
      )
    ).css;
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
          ? bundle.outputFiles[0].text
          : req.url === "/style.css"
            ? css
            : '<!doctype html><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/page.js"></script>',
      );
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const chrome = await launchChrome();
    try {
      const page = await chrome.open(
        `http://127.0.0.1:${server.address().port}/`,
      );
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: 1400,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await page.evaluate(
        `(async()=>{while(!document.querySelector('[aria-label="Export Agentcut launch"]'))await new Promise(r=>setTimeout(r,30));})()`,
      );
      assert.equal(
        await page.evaluate(
          `document.querySelector('[aria-label="Export Agentcut launch"]').getAttribute('aria-checked')`,
        ),
        "true",
      );
      assert.equal(
        await page.evaluate(
          `document.querySelector('[aria-label="Export How to use Agentcut"]').getAttribute('aria-checked')`,
        ),
        "false",
      );
      await page.evaluate(
        `document.querySelector('[aria-label="Export How to use Agentcut"]').click()`,
      );
      await page.evaluate("new Promise(r=>setTimeout(r,300))");
      const wide = await page.evaluate(
        `(()=>{const d=document.querySelector('[role="dialog"]').getBoundingClientRect();return {width:d.width,areas:[...document.querySelectorAll('[data-slot="scroll-area-viewport"]')].map(e=>({x:e.getBoundingClientRect().x,scroll:e.scrollHeight>e.clientHeight+2,height:e.clientHeight,content:e.scrollHeight}))}})()`,
      );

      assert.ok(wide.width >= 1000);
      assert.ok(wide.areas[1].x > wide.areas[0].x);
      assert.deepEqual(
        wide.areas.map((a) => a.scroll),
        [false, false],
      );
      await page.evaluate(
        `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('in browser'));b.click();b.click()})()`,
      );
      await page.evaluate("new Promise(r=>setTimeout(r,500))");
      assert.deepEqual(
        await page.evaluate(
          `window.calls.filter(c=>c.method==='browser').map(c=>[c.slug,c.module])`,
        ),
        [
          ["video-0", "video-0"],
          ["video-1", "video-1"],
        ],
      );
      await page.evaluate(
        `window.calls=[];window.failBrowserFor='video-1';[...document.querySelectorAll('button')].find(b=>b.textContent.includes('in browser')).click()`,
      );
      await page.evaluate(
        `(async()=>{const end=Date.now()+5000;while(!document.querySelector('[role="alert"]')){if(Date.now()>end)throw Error('No failure status');await new Promise(r=>setTimeout(r,30))}})()`,
      );
      assert.match(
        await page.evaluate(
          `document.querySelector('[role="alert"]').textContent`,
        ),
        /1 file\(s\) saved/,
      );
      await page.evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('in browser')).click()`,
      );
      await page.evaluate(
        `(async()=>{const end=Date.now()+5000;while(document.querySelector('[role="alert"]')||!document.querySelector('[role="status"]')?.textContent.includes('saved')){if(Date.now()>end)throw Error('Retry did not finish');await new Promise(r=>setTimeout(r,30))}})()`,
      );
      assert.deepEqual(
        await page.evaluate(
          `window.calls.filter(c=>c.method==='browser').map(c=>c.slug)`,
        ),
        ["video-0", "video-1", "video-1"],
      );
      await page.evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Render on this computer')).click()`,
      );
      await page.evaluate(
        `(async()=>{const end=Date.now()+5000;while(window.calls.filter(c=>c.method==='studio.render.local').length<2||document.querySelector('button')?.textContent==='Cancel export'){if(Date.now()>end)throw Error('Local fixture did not finish');await new Promise(r=>setTimeout(r,30))}})()`,
      );
      await page.evaluate("new Promise(r=>setTimeout(r,80))");
      assert.deepEqual(
        await page.evaluate(
          `window.calls.filter(c=>c.method==='studio.render.local').map(c=>[c.slug,c.variant,c.expectedProjectHash,c.expectedLayersHash,c.expectedBundleRevision])`,
        ),
        [
          ["video-0", "wide", "p", "l", 1],
          ["video-1", "wide", "p", "l", 1],
        ],
      );
      assert.equal(
        await page.evaluate(
          `window.calls.some(c=>['studio.session','studio.project.open','studio.project.write'].includes(c.method))`,
        ),
        false,
      );
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await page.evaluate("new Promise(r=>setTimeout(r,150))");
      const narrow = await page.evaluate(
        `(()=>{const d=document.querySelector('[role="dialog"]').getBoundingClientRect();const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('in browser')).getBoundingClientRect();return {left:d.left,right:d.right,top:d.top,bottom:d.bottom,button:b.bottom,areas:[...document.querySelectorAll('[data-slot="scroll-area-viewport"]')].map(e=>e.getBoundingClientRect().top)}})()`,
      );
      assert.ok(
        narrow.left >= 0 &&
          narrow.right <= 390 &&
          narrow.top >= 0 &&
          narrow.bottom <= 844,
      );
      assert.ok(narrow.button <= narrow.bottom);
      assert.ok(narrow.areas[1] > narrow.areas[0]);
      if (process.env.EXPORT_ARTIFACT_DIR) {
        const s = await page.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(
          `${process.env.EXPORT_ARTIFACT_DIR}/export-narrow.png`,
          Buffer.from(s.data, "base64"),
        );
      }
      const long = await chrome.open(
        `http://127.0.0.1:${server.address().port}/?count=30`,
      );
      await long.evaluate(
        `(async()=>{while(document.querySelectorAll('[aria-label^="Export "]').length<30)await new Promise(r=>setTimeout(r,30));document.querySelector('[aria-label="Canvas videos"]').focus()})()`,
      );
      await long.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        key: "PageDown",
        code: "PageDown",
        windowsVirtualKeyCode: 34,
      });
      await long.send("Input.dispatchKeyEvent", {
        type: "keyUp",
        key: "PageDown",
        code: "PageDown",
        windowsVirtualKeyCode: 34,
      });
      await long.evaluate("new Promise(r=>setTimeout(r,300))");
      assert.ok(
        await long.evaluate(
          `document.querySelector('[aria-label="Canvas videos"]').scrollTop>0`,
        ),
      );
    } finally {
      await chrome.close();
      await new Promise((r) => server.close(r));
    }
  },
);
