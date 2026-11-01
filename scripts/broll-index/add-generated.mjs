// Registers clips from generate.mjs as one-shot "films" (license ai-generated) in a film list, so the normal
// steps (analyze, measure, describe, embed, cut, build) process them. Prints their ids.
//   BROLL_DATA=E:/agentcut-broll node add-generated.mjs films-v1.json
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, ensureDir, FILMS_DIR, loadFilm, probeDuration, readJson, saveFilm } from "./lib.mjs";

const listPath = fileURLToPath(new URL(`./${process.argv[2] ?? "films-v1.json"}`, import.meta.url));
const list = JSON.parse(readFileSync(listPath, "utf8"));
const known = new Set(list.map((f) => f.id));
const state = readJson(join(DATA, "generated", "state.json"), {});
const added = [];
for (const [name, entry] of Object.entries(state)) {
  const clip = join(DATA, "generated", "clips", `${name}.mp4`);
  if (entry.status !== "downloaded" || !existsSync(clip)) continue;
  const id = `ai-${name}`;
  if (!loadFilm(id)) {
    copyFileSync(clip, join(ensureDir(join(FILMS_DIR, id)), "index.mp4"));
    const seconds = await probeDuration(clip);
    const { width, height } = entry.output;
    const file = { name: `${name}.mp4`, format: "h.264", width, height };
    saveFilm({
      id,
      title: `AI-generated b-roll (${entry.model})`,
      year: null,
      color: "color",
      collection: ["ai-generated"],
      license: "ai-generated",
      sourceUrl: "https://revana.si",
      description: `Generated with ${entry.model} through Revana.`,
      generation: { provider: "revana", model: entry.model, id: entry.generation, cost_usd: entry.cost_usd, prompt: entry.prompt },
      files: { index: file, full: file },
      timings: {},
      duration: seconds,
      cuts: 0,
      shots: [{ id: `${id}-000`, start: 0, end: Math.floor(seconds * 100) / 100, longTake: false }],
    });
  }
  if (!known.has(id)) list.push({ id, theme: "ai-generated", title: `AI-generated b-roll (${entry.model})`, collection: "ai-generated" });
  added.push(id);
}
writeFileSync(listPath, JSON.stringify(list, null, 2));
console.log(added.join(" "));
