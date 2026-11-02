// Registers generated clips as one-shot "films" (license ai-generated) in a film list, so the normal steps
// (analyze, measure, describe, embed, cut, build) process them. Each source credits its tool: the title is the
// line under the clip on the b-roll page, linked to the source's site. Prints the ids.
//   BROLL_DATA=E:/agentcut-broll node add-generated.mjs films-v1.json
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, ensureDir, FILMS_DIR, loadFilm, probeDuration, readJson, run, saveFilm } from "./lib.mjs";

// state: written by the tool that made the clips ({ name: { status, model, prompt, ... } }); clips: <name>.mp4.
const SOURCES = [
  { state: "state.json", clips: "clips", provider: "revana", url: "https://revana.si", via: "Revana", title: (model) => `AI-generated b-roll (${model})` },
  { state: "sume-state.json", clips: "clips-sume", provider: "sume", url: "https://sume.com", via: "Sume", title: (model) => `AI-generated · ${model} via Sume` },
];

const listPath = fileURLToPath(new URL(`./${process.argv[2] ?? "films-v1.json"}`, import.meta.url));
const list = JSON.parse(readFileSync(listPath, "utf8"));
const known = new Set(list.map((f) => f.id));
const added = [];

async function size(path) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path]);
  const [width, height] = stdout.toString().trim().split(",").map(Number);
  return { width, height };
}

for (const source of SOURCES) {
  const state = readJson(join(DATA, "generated", source.state), {});
  for (const [name, entry] of Object.entries(state)) {
    const clip = join(DATA, "generated", source.clips, `${name}.mp4`);
    if (entry.status !== "downloaded" || !existsSync(clip)) continue;
    const id = `ai-${name}`;
    const title = source.title(entry.model);
    if (!loadFilm(id)) {
      copyFileSync(clip, join(ensureDir(join(FILMS_DIR, id)), "index.mp4"));
      const seconds = await probeDuration(clip);
      const file = { name: `${name}.mp4`, format: "h.264", ...(await size(clip)) };
      saveFilm({
        id,
        title,
        year: null,
        color: "color",
        collection: ["ai-generated"],
        license: "ai-generated",
        sourceUrl: source.url,
        description: `Generated with ${entry.model} through ${source.via}.`,
        generation: { provider: source.provider, model: entry.model, id: entry.generation ?? entry.artifact, cost_usd: entry.cost_usd ?? 0, prompt: entry.prompt },
        files: { index: file, full: file },
        timings: {},
        duration: seconds,
        cuts: 0,
        shots: [{ id: `${id}-000`, start: 0, end: Math.floor(seconds * 100) / 100, longTake: false }],
      });
    }
    if (!known.has(id)) {
      list.push({ id, theme: "ai-generated", title, collection: "ai-generated" });
      known.add(id);
    }
    added.push(id);
  }
}
writeFileSync(listPath, JSON.stringify(list, null, 2));
console.log(added.join(" "));
