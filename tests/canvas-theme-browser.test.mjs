import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { findChrome, launchChrome } from "./helpers/chrome.mjs";

test("canvas controls, attribution and waiting question stay readable during live light/dark switching", { skip: !findChrome(), timeout: 120_000 }, async () => {
  const rootPath = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "");
  const bundle = await build({ entryPoints: [fileURLToPath(new URL("./fixtures/canvas-theme-page.tsx", import.meta.url))], outfile: "page.js",
    bundle: true, write: false, format: "esm", platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
    logLevel: "error", tsconfigRaw: "{}", alias: { "@": rootPath } });
  const cssPath = join(rootPath, "app/globals.css");
  const css = (await postcss([tailwind()]).process(readFileSync(cssPath, "utf8"), { from: cssPath })).css;
  const js = bundle.outputFiles.find((file) => file.path.endsWith(".js")).text;
  const flowCss = bundle.outputFiles.find((file) => file.path.endsWith(".css")).text;
  const server = createServer((req, res) => {
    res.setHeader("content-type", req.url === "/page.js" ? "text/javascript" : req.url === "/style.css" ? "text/css" : "text/html");
    res.end(req.url === "/page.js" ? js : req.url === "/style.css" ? flowCss + "\n" + css : '<!doctype html><link rel="stylesheet" href="/style.css"><div id="root"></div><script type="module" src="/page.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const chrome = await launchChrome(); const errors = [];
  try {
    const page = await chrome.open(`http://127.0.0.1:${server.address().port}/`, { onConsole(type, message) { if (type === "exception" || type === "error") { errors.push(message); console.error(message); } } });
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 850, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(`(async () => { const until=Date.now()+5000; while (!document.querySelector('.react-flow__controls-zoomin') || !document.querySelector('button[aria-label="Switch to dark mode"]')) { if(Date.now()>until) throw new Error('Canvas not mounted: '+document.body.textContent.slice(0,500)); await new Promise(r => setTimeout(r, 25)); } window.originalCanvas = document.querySelector('.react-flow'); })()`);
    const results = [];
    for (const theme of ["light", "dark", "light"]) {
      if (theme !== await page.evaluate('document.documentElement.classList.contains("dark") ? "dark" : "light"')) {
        await page.evaluate(`document.querySelector('button[aria-label^="Switch to"]').click()`);
        await page.evaluate('new Promise(r => setTimeout(r, 80))');
      }
      const colors = await page.evaluate(`(() => {
        const ctx = document.createElement('canvas').getContext('2d');
        function rgb(color) { ctx.clearRect(0,0,1,1); ctx.fillStyle=color; ctx.fillRect(0,0,1,1); return [...ctx.getImageData(0,0,1,1).data].slice(0,3); }
        function l(color) { const c=rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return c[0]*.2126+c[1]*.7152+c[2]*.0722; }
        function ratio(a,b) { const x=l(a),y=l(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
        const buttons=[...document.querySelectorAll('.react-flow__controls-button')];
        const a=document.querySelector('.react-flow__attribution a'); const s=getComputedStyle(a), panel=getComputedStyle(a.parentElement);
        const b=a.getBoundingClientRect(); const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
        const waiting=document.querySelector('section[aria-label="Waiting for your reply"]'); const w=getComputedStyle(waiting);
        const badge=getComputedStyle(waiting.querySelector('[data-waiting-badge]'));
        return { controls:buttons.map(b=>({label:b.getAttribute('aria-label'),ratio:ratio(getComputedStyle(b).color,getComputedStyle(b).backgroundColor),fill:getComputedStyle(b.querySelector('svg')).fill})),
          attributionRatio:ratio(s.color,panel.backgroundColor),href:a.href,clickable:hit===a||a.contains(hit),waitingRatio:ratio(w.color,w.backgroundColor),badgeContrast:ratio(badge.color,badge.backgroundColor),borderContrast:ratio(w.borderTopColor,w.backgroundColor),brandBorder:JSON.stringify(rgb(w.borderTopColor))===JSON.stringify(rgb(w.getPropertyValue('--brand'))),sameCanvas:window.originalCanvas===document.querySelector('.react-flow') };
      })()`);
      assert.ok(colors.controls.length >= 3);
      for (const control of colors.controls) assert.ok(control.ratio >= 4.5, `${theme} ${control.label}: ${control.ratio}`);
      assert.ok(colors.attributionRatio >= 4.5, `${theme} attribution: ${colors.attributionRatio}`);
      assert.ok(colors.waitingRatio >= 4.5);
      assert.ok(colors.badgeContrast >= 3, `${theme} badge: ${colors.badgeContrast}`);
      assert.ok(colors.borderContrast >= 3, `${theme} border: ${colors.borderContrast}`);
      assert.equal(colors.brandBorder, true);
      assert.match(colors.href, /^https:\/\/reactflow\.dev/); assert.equal(colors.clickable, true); assert.equal(colors.sameCanvas, true);
      results.push({ theme, ...colors });
      if (process.env.CANVAS_THEME_ARTIFACT_DIR) {
        const shot = await page.send("Page.captureScreenshot", { format: "png" });
        writeFileSync(join(process.env.CANVAS_THEME_ARTIFACT_DIR, `canvas-${theme}.png`), Buffer.from(shot.data, "base64"));
      }
    }
    const before = await page.evaluate('document.querySelector(".react-flow__viewport").style.transform');
    await page.evaluate('document.querySelector(".react-flow__controls-zoomin").click()');
    await page.evaluate('new Promise(r => setTimeout(r, 300))');
    assert.notEqual(await page.evaluate('document.querySelector(".react-flow__viewport").style.transform'), before);
    await page.evaluate('window.showBlocked()');
    await page.send("Emulation.setDeviceMetricsOverride", { width: 360, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.evaluate('new Promise(r => setTimeout(r, 100))');
    const narrow = await page.evaluate(`(() => { const p=document.querySelector('section[aria-label="Waiting for your reply"]'); const r=p.getBoundingClientRect(); return { text:p.textContent,x:r.x,right:r.right,width:innerWidth,overflow:p.scrollWidth>p.clientWidth }; })()`);
    assert.match(narrow.text, /A screen recording in the Library panel/);
    assert.match(narrow.text, /Code access/);
    assert.doesNotMatch(narrow.text, /Once I have either/);
    assert.ok(narrow.x >= 0 && narrow.right <= narrow.width);
    assert.equal(narrow.overflow, false);
    if (process.env.CANVAS_THEME_ARTIFACT_DIR) {
      await page.evaluate(`document.querySelector('section[aria-label="Waiting for your reply"]').scrollIntoView({block:'center'})`);
      const shot=await page.send("Page.captureScreenshot",{format:"png"});
      writeFileSync(join(process.env.CANVAS_THEME_ARTIFACT_DIR,"waiting-narrow.png"),Buffer.from(shot.data,"base64"));
    }
    await page.evaluate(`document.querySelector('button[aria-label="Switch to dark mode"]').click()`);
    await page.evaluate('new Promise(r => setTimeout(r, 80))');
    const narrowDark = await page.evaluate(`(() => { const p=document.querySelector('section[aria-label="Waiting for your reply"]'); const r=p.getBoundingClientRect(); return {right:r.right,width:innerWidth,overflow:p.scrollWidth>p.clientWidth,text:p.textContent}; })()`);
    assert.ok(narrowDark.right <= narrowDark.width);
    assert.equal(narrowDark.overflow, false);
    assert.match(narrowDark.text, /Code access/);
    if (process.env.CANVAS_THEME_ARTIFACT_DIR) {
      const shot=await page.send("Page.captureScreenshot",{format:"png"});
      writeFileSync(join(process.env.CANVAS_THEME_ARTIFACT_DIR,"waiting-narrow-dark.png"),Buffer.from(shot.data,"base64"));
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(results.map(({ theme, controls, attributionRatio, waitingRatio, badgeContrast, borderContrast }) => ({ theme, minControlContrast: Math.min(...controls.map(c=>c.ratio)), attributionRatio, waitingRatio, badgeContrast, borderContrast }))));
  } finally { await chrome.close(); await new Promise((resolve) => server.close(resolve)); }
});
