/// <reference lib="webworker" />
// Archival b-roll search in the browser: the catalog (shots.json + int8 SigLIP image vectors) comes from
// the CDN, the SigLIP text model from Hugging Face (cached by the browser). Keyword matching over the
// shot descriptions works at once; ranking by meaning joins when the model has loaded.
import { AutoTokenizer, SiglipTextModel, type PreTrainedModel, type PreTrainedTokenizer } from "@huggingface/transformers";
import type { BrollIndex, BrollQuery, BrollResult, BrollShot } from "@/lib/broll";

const TEXT_MODEL = "Xenova/siglip-base-patch16-224";
// Image–text similarity sits around 0.0–0.2; a keyword hit is a strong extra signal.
const KEYWORD_BONUS = 0.02;
const CALM_MOTION = 6;

const scope = self as unknown as DedicatedWorkerGlobalScope;

interface Catalog {
  base: string;
  index: BrollIndex;
  vectors: Int8Array;
  words: Set<string>[];
}

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

let catalog: Promise<Catalog> | null = null;

function getCatalog(base: string) {
  if (!catalog) {
    catalog = (async () => {
      const index = await fetch(`${base}/shots.json`).then((r) => {
        if (!r.ok) throw new Error(`b-roll catalog: HTTP ${r.status}`);
        return r.json() as Promise<BrollIndex>;
      });
      // The published index names its own vectors file, so the pair always matches.
      const vectors = await fetch(`${base}/${index.vectorsFile ?? "vectors.i8"}`).then((r) => {
        if (!r.ok) throw new Error(`b-roll vectors: HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      return {
        base,
        index,
        vectors: new Int8Array(vectors),
        words: index.shots.map((s) => new Set(words([s.description, s.setting, ...s.subjects, ...s.mood, ...s.tags].join(" ")))),
      };
    })();
    catalog.catch(() => {
      catalog = null;
    });
  }
  return catalog;
}

let model: Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> | null = null;
let modelReady = false;

function getModel() {
  model ??= (async () => {
    const progress = (info: { status?: string; file?: string; progress?: number }) => {
      if (info.status === "progress") scope.postMessage({ type: "progress", file: info.file, progress: info.progress });
    };
    // q8 on the CPU (WASM): one short text per search, so WebGPU wouldn't pay for its bigger download.
    const [tokenizer, text] = await Promise.all([
      AutoTokenizer.from_pretrained(TEXT_MODEL, { progress_callback: progress }),
      SiglipTextModel.from_pretrained(TEXT_MODEL, { device: "wasm", dtype: "q8", progress_callback: progress } as never),
    ]);
    modelReady = true;
    scope.postMessage({ type: "ready" });
    return { tokenizer, model: text };
  })();
  model.catch(() => {
    model = null;
  });
  return model;
}

async function embed(text: string) {
  const { tokenizer, model: text_model } = await getModel();
  // SigLIP was trained with max_length padding.
  const inputs = tokenizer([`a film still of ${text}`], { padding: "max_length", truncation: true });
  const { pooler_output } = (await text_model(inputs)) as { pooler_output: { data: ArrayLike<number> } };
  const v = Float32Array.from(pooler_output.data);
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

async function search(base: string, q: BrollQuery & { wait?: boolean }) {
  const { index, vectors, words: shotWords } = await getCatalog(base);
  const text = (q.query ?? "").trim().slice(0, 300);
  // Without `wait`, answer with keywords now and load the model for the next search.
  let query: Float32Array | null = null;
  if (text) {
    if (q.wait || modelReady) query = await embed(text);
    else void getModel().catch(() => undefined);
  }
  const terms = words(text).filter((w) => w.length > 2);
  const { dim, vectorScale } = index;
  const results: BrollResult[] = [];
  for (const [i, shot] of index.shots.entries()) {
    if (q.color && shot.color !== q.color) continue;
    if (q.backgroundOk && !shot.backgroundOk) continue;
    if (q.noPeople && shot.people !== "none") continue;
    if (q.calm && shot.motion > CALM_MOTION) continue;
    if (q.minSeconds && shot.seconds < q.minSeconds) continue;
    let similarity = 0;
    if (query) {
      const row = i * dim;
      for (let k = 0; k < dim; k++) similarity += query[k] * vectors[row + k];
      similarity *= vectorScale;
    }
    const hits = terms.reduce((n, t) => n + Number(shotWords[i].has(t)), 0);
    if (text && !query && hits === 0) continue;
    results.push({ ...shot, score: +(similarity + hits * KEYWORD_BONUS).toFixed(4) });
  }
  if (text) results.sort((a, b) => b.score - a.score);
  // No query: a stable shuffle across every film, without title cards and near-black frames.
  else {
    const hash = (id: string) => {
      let h = 2166136261;
      for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
      // Avalanche (murmur3 finalizer): ids differing only in the last digits land far apart.
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      return (h ^ (h >>> 16)) >>> 0;
    };
    const browsable = results.filter((r) => !r.titleCard && r.brightness >= 35);
    browsable.sort((a, b) => hash(a.id) - hash(b.id));
    results.splice(0, results.length, ...browsable);
  }
  const offset = Math.max(0, q.offset ?? 0);
  const limit = Math.min(60, Math.max(1, q.limit ?? 24));
  return {
    total: index.count,
    matches: results.length,
    offset,
    mode: query ? "meaning" : text ? "keywords" : "browse",
    results: results.slice(offset, offset + limit),
  };
}

async function shots(base: string, ids: string[]) {
  const { index } = await getCatalog(base);
  const byId = new Map(index.shots.map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id) ?? null) as (BrollShot | null)[];
}

scope.addEventListener("message", async (event: MessageEvent) => {
  const { id, type, base, payload } = event.data as { id: number; type: string; base: string; payload: unknown };
  try {
    let result: unknown;
    if (type === "search") result = await search(base, payload as BrollQuery & { wait?: boolean });
    else if (type === "shots") result = await shots(base, payload as string[]);
    else throw new Error(`Unknown request ${type}`);
    scope.postMessage({ type: "result", id, result });
  } catch (error) {
    scope.postMessage({ type: "error", id, error: error instanceof Error ? error.message : String(error) });
  }
});
