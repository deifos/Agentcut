// Local search page over the built index (out/): try queries before anything goes to the CDN.
//   BROLL_DATA=E:/agentcut-broll node serve.mjs   → http://127.0.0.1:4848
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize as normalizePath } from "node:path";
import { embedTexts } from "./embed.mjs";
import { normalize, OUT_DIR } from "./lib.mjs";

const PORT = Number(process.env.PORT ?? 4848);
const index = JSON.parse(readFileSync(join(OUT_DIR, "shots.json"), "utf8"));
const raw = readFileSync(join(OUT_DIR, "vectors.f32"));
const vectors = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
const { dim, shots } = index;

const words = (text) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const haystacks = shots.map((s) =>
  new Set(words([s.description, s.setting, ...s.subjects, ...s.mood, ...s.tags].join(" "))),
);

// SigLIP's image–text similarity is small (≈0.0–0.2); a keyword hit in the description or tags is a
// strong extra signal, so each one adds a fixed bonus on top.
const KEYWORD_BONUS = 0.02;

async function search(params) {
  const q = (params.get("q") ?? "").trim();
  const query = q ? normalize((await embedTexts([`a film still of ${q}`]))[0]) : null;
  const terms = words(q).filter((w) => w.length > 2);
  const results = [];
  for (const [i, s] of shots.entries()) {
    if (params.get("color") && s.color !== params.get("color")) continue;
    if (params.get("background") === "1" && !s.backgroundOk) continue;
    if (params.get("noPeople") === "1" && s.people !== "none") continue;
    if (params.get("calm") === "1" && s.motion > 6) continue;
    let similarity = 0;
    if (query) for (let k = 0; k < dim; k++) similarity += query[k] * vectors[i * dim + k];
    const hits = terms.filter((t) => haystacks[i].has(t)).length;
    results.push({ ...s, similarity: +similarity.toFixed(4), hits, score: +(similarity + hits * KEYWORD_BONUS).toFixed(4) });
  }
  results.sort((a, b) => b.score - a.score);
  return { query: q, total: shots.length, results: results.slice(0, 48) };
}

const TYPES = { ".webp": "image/webp", ".mp4": "video/mp4", ".json": "application/json", ".f32": "application/octet-stream", ".i8": "application/octet-stream" };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(PAGE);
    }
    if (url.pathname === "/api/search") {
      const body = JSON.stringify(await search(url.searchParams));
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(body);
    }
    // Static files from out/ (thumbs, previews), with range support so videos seek.
    const file = normalizePath(join(OUT_DIR, decodeURIComponent(url.pathname)));
    if (!file.startsWith(OUT_DIR) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      return res.end();
    }
    const size = statSync(file).size;
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    // Stands in for the CDN while developing the studio, which downloads shots cross-origin.
    res.setHeader("access-control-allow-origin", "*");
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
    createReadStream(file).pipe(res);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(error));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`b-roll search: http://127.0.0.1:${PORT} (${shots.length} shots)`));

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Agentcut b-roll search</title>
<style>
  body { margin: 0; font: 14px/1.4 system-ui, sans-serif; background: #0d0d0f; color: #e8e8ea; }
  header { position: sticky; top: 0; background: #0d0d0fee; padding: 14px 20px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid #222; }
  input[type=search] { flex: 1; min-width: 280px; font-size: 16px; padding: 10px 12px; border-radius: 8px; border: 1px solid #333; background: #17171a; color: inherit; }
  label { color: #aaa; font-size: 13px; } select { background: #17171a; color: inherit; border: 1px solid #333; border-radius: 6px; padding: 4px; }
  #meta { color: #888; padding: 8px 20px; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 4px 20px 40px; }
  .card { background: #161619; border-radius: 10px; overflow: hidden; border: 1px solid #222; }
  .media { aspect-ratio: 4 / 3; background: #000; position: relative; }
  .media img, .media video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .body { padding: 10px 12px; } .desc { margin: 0 0 6px; } .tags { color: #9a9aa2; font-size: 12px; }
  .row { display: flex; justify-content: space-between; color: #777; font-size: 12px; margin-top: 6px; } a { color: #8ab4ff; }
</style></head><body>
<header>
  <input id="q" type="search" placeholder="Describe a shot: lonely city at night, a clock ticking, people celebrating…" autofocus>
  <label>Color <select id="color"><option value="">any</option><option>black-and-white</option><option>color</option><option>tinted</option></select></label>
  <label><input type="checkbox" id="background"> background-safe</label>
  <label><input type="checkbox" id="noPeople"> no people</label>
  <label><input type="checkbox" id="calm"> calm</label>
</header>
<div id="meta"></div><main id="grid"></main>
<script>
const $ = (id) => document.getElementById(id);
let timer;
async function run() {
  const p = new URLSearchParams({ q: $("q").value, color: $("color").value });
  for (const k of ["background", "noPeople", "calm"]) if ($(k).checked) p.set(k, "1");
  const t = performance.now();
  const data = await (await fetch("/api/search?" + p)).json();
  $("meta").textContent = data.results.length + " of " + data.total + " shots · " + Math.round(performance.now() - t) + " ms";
  $("grid").innerHTML = data.results.map((s) => \`
    <div class="card">
      <div class="media" data-preview="\${s.preview}"><img src="\${s.thumb}" loading="lazy"></div>
      <div class="body">
        <p class="desc">\${s.description}</p>
        <div class="tags">\${s.tags.join(" · ")}</div>
        <div class="row"><span>\${s.seconds}s · \${s.shotSize} · \${s.camera} · motion \${s.motion}\${s.backgroundOk ? " · bg" : ""}</span><span>sim \${s.similarity} · kw \${s.hits}</span></div>
        <div class="row"><a href="\${s.film.url}" target="_blank">\${s.film.title}\${s.film.year ? " (" + s.film.year + ")" : ""}</a><span>\${s.start.toFixed(1)}–\${s.end.toFixed(1)}s</span></div>
      </div>
    </div>\`).join("");
}
$("grid").addEventListener("mouseover", (e) => {
  const media = e.target.closest(".media");
  if (!media || media.querySelector("video")) return;
  const v = Object.assign(document.createElement("video"), { src: media.dataset.preview, muted: true, loop: true, autoplay: true, playsInline: true });
  media.append(v);
  media.addEventListener("mouseleave", () => v.remove(), { once: true });
});
for (const id of ["q", "color", "background", "noPeople", "calm"]) $(id).addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
run();
</script></body></html>`;
