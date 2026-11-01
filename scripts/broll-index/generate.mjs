// Generates modern b-roll clips through Revana from a prompt list, resumably: each clip's Idempotency-Key is
// saved before it's submitted, so a resend never pays twice, and max_cost_usd keeps dearer backup routes out.
//   BROLL_DATA=E:/agentcut-broll REVANA_ENV_FILE=path/to/.env node generate.mjs prompts.json [--max-cost 0.25] [id ...]
// Clips land in generated/clips/<id>.mp4, state in generated/state.json. The key is read, never printed.
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, ensureDir, readJson, writeJson } from "./lib.mjs";

const API = "https://api.revana.si/v1";
const MODEL = process.env.BROLL_GEN_MODEL ?? "seedance-2.0-fast";
const RESOLUTION = process.env.BROLL_GEN_RESOLUTION ?? "480p";
const SECONDS = Number(process.env.BROLL_GEN_SECONDS ?? 5);
const CONCURRENCY = 4;
const POLL_MS = 15_000;
const STYLE = "Modern realistic documentary b-roll, natural film look, no text on screen, no logos.";

const args = process.argv.slice(2);
const capAt = args.indexOf("--max-cost");
const MAX_COST = capAt >= 0 ? Number(args.splice(capAt, 2)[1]) : 0.25;
const [listPath, ...only] = args;
const envFile = process.env.REVANA_ENV_FILE;
const key = envFile && /^REVANA_API_KEY=(.*)$/m.exec(readFileSync(envFile, "utf8"))?.[1].trim().replace(/^["']|["']$/g, "");
if (!listPath || !key) throw new Error("Usage: REVANA_ENV_FILE=path node generate.mjs prompts.json [--max-cost usd] [id ...]");

const dir = join(DATA, "generated");
const clips = ensureDir(join(dir, "clips"));
const statePath = join(dir, "state.json");
const state = readJson(statePath, {});
const save = () => writeJson(statePath, state);

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function generate(item) {
  const entry = (state[item.id] ??= {});
  const target = join(clips, `${item.id}.mp4`);
  if (entry.status === "downloaded" && existsSync(target)) return console.log(`${item.id}: already done`);
  if (!entry.key) {
    entry.key = randomUUID();
    entry.prompt = `${item.prompt}. ${STYLE}`;
    entry.model = MODEL;
    save();
  }
  if (!entry.generation) {
    const { status, body } = await api("/generations", {
      method: "POST",
      headers: { "idempotency-key": entry.key },
      body: JSON.stringify({
        model: MODEL,
        input: { prompt: entry.prompt, resolution: RESOLUTION, aspect_ratio: "16:9", duration: SECONDS, audio: false },
        max_cost_usd: MAX_COST,
      }),
    });
    if (!body?.id) {
      console.error(`${item.id}: not submitted (${status}): ${body?.error?.message ?? "no answer"}`);
      return;
    }
    entry.generation = body.id;
    save();
    console.log(`${item.id}: submitted, quoted $${body.quoted_usd}`);
  }
  const started = Date.now();
  for (;;) {
    const { body } = await api(`/generations/${entry.generation}`);
    if (body?.status === "succeeded") {
      entry.cost_usd = body.cost_usd;
      entry.output = body.output;
      break;
    }
    if (body?.status === "failed" || body?.status === "canceled") {
      console.error(`${item.id}: ${body.status} (free): ${body.error?.message ?? body.error ?? ""}`);
      // A failed key keeps answering with the failure: the next run makes a new one.
      state[item.id] = { status: "failed", error: body.error ?? null };
      save();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  const file = await fetch(`${API}/generations/${entry.generation}/content`, { headers: { authorization: `Bearer ${key}` } });
  if (!file.ok) throw new Error(`${item.id}: download HTTP ${file.status}`);
  writeFileSync(target, Buffer.from(await file.arrayBuffer()));
  entry.status = "downloaded";
  save();
  console.log(`${item.id}: done in ${Math.round((Date.now() - started) / 1000)} s, $${entry.cost_usd}`);
}

const list = JSON.parse(readFileSync(listPath, "utf8")).filter((item) => !only.length || only.includes(item.id));
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < list.length) {
      const item = list[next++];
      await generate(item).catch((error) => console.error(`${item.id}: ${error.message}`));
    }
  }),
);
const spent = Object.values(state).reduce((sum, e) => sum + (e.cost_usd ?? 0), 0);
console.log(`finished ${list.length} requested, $${spent.toFixed(2)} spent on generated clips so far`);
