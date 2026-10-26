// Server-side b-roll search: SigLIP text vectors (Transformers.js) against the catalog's image vectors,
// plus a keyword bonus for words found in a shot's description and tags.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BROLL_CDN_URL, brollUrl, type BrollIndex, type BrollQuery, type BrollResult } from "@/lib/broll";

const TEXT_MODEL = "Xenova/siglip-base-patch16-224";
// Image–text similarity sits around 0.0–0.2; a keyword hit is a strong extra signal.
const KEYWORD_BONUS = 0.02;
const INDEX_TTL_MS = 60 * 60 * 1000;
const CALM_MOTION = 6;

interface LoadedIndex extends BrollIndex {
  vectors: Float32Array;
  words: Set<string>[];
  loadedAt: number;
}

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

let indexPromise: Promise<LoadedIndex> | null = null;

async function loadIndex(): Promise<LoadedIndex> {
  const [meta, vectors] = await Promise.all([
    fetch(brollUrl("shots.json"), { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`b-roll index: HTTP ${r.status}`);
      return r.json() as Promise<BrollIndex>;
    }),
    fetch(brollUrl("vectors.f32"), { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`b-roll vectors: HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);
  return {
    ...meta,
    vectors: new Float32Array(vectors),
    words: meta.shots.map((s) => new Set(words([s.description, s.setting, ...s.subjects, ...s.mood, ...s.tags].join(" ")))),
    loadedAt: Date.now(),
  };
}

async function getIndex() {
  const current = indexPromise ? await indexPromise.catch(() => null) : null;
  if (!current || Date.now() - current.loadedAt > INDEX_TTL_MS) {
    indexPromise = loadIndex();
    // Keep serving the old index if a refresh fails.
    return indexPromise.catch((error) => {
      if (current) {
        indexPromise = Promise.resolve(current);
        return current;
      }
      indexPromise = null;
      throw error;
    });
  }
  return current;
}

type TextEncoder = (text: string) => Promise<Float32Array>;
let encoderPromise: Promise<TextEncoder> | null = null;

function getEncoder() {
  encoderPromise ??= (async () => {
    const { AutoTokenizer, SiglipTextModel, env } = await import("@huggingface/transformers");
    env.cacheDir = process.env.BROLL_MODEL_CACHE || join(tmpdir(), "agentcut-models");
    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(TEXT_MODEL),
      SiglipTextModel.from_pretrained(TEXT_MODEL, { dtype: "q8" }),
    ]);
    return async (text: string) => {
      // SigLIP was trained with max_length padding.
      const inputs = tokenizer([text], { padding: "max_length", truncation: true });
      const { pooler_output } = await model(inputs);
      const v = Float32Array.from(pooler_output.data as Float32Array);
      let norm = 0;
      for (const x of v) norm += x * x;
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < v.length; i++) v[i] /= norm;
      return v;
    };
  })().catch((error) => {
    encoderPromise = null;
    throw error;
  });
  return encoderPromise;
}

export async function searchBroll(q: BrollQuery) {
  if (!BROLL_CDN_URL) throw new Error("NEXT_PUBLIC_BROLL_CDN_URL isn't set.");
  const index = await getIndex();
  const text = (q.query ?? "").trim().slice(0, 300);
  const query = text ? await (await getEncoder())(`a film still of ${text}`) : null;
  const terms = words(text).filter((w) => w.length > 2);
  const { dim, vectors } = index;
  const results: BrollResult[] = [];
  for (const [i, shot] of index.shots.entries()) {
    if (q.color && shot.color !== q.color) continue;
    if (q.backgroundOk && !shot.backgroundOk) continue;
    if (q.noPeople && shot.people !== "none") continue;
    if (q.calm && shot.motion > CALM_MOTION) continue;
    if (q.minSeconds && shot.seconds < q.minSeconds) continue;
    let similarity = 0;
    if (query) for (let k = 0; k < dim; k++) similarity += query[k] * vectors[i * dim + k];
    const hits = terms.reduce((n, t) => n + Number(index.words[i].has(t)), 0);
    results.push({ ...shot, score: +(similarity + hits * KEYWORD_BONUS).toFixed(4) });
  }
  // No query: browse in catalog order.
  if (query || terms.length) results.sort((a, b) => b.score - a.score);
  const offset = Math.max(0, q.offset ?? 0);
  const limit = Math.min(60, Math.max(1, q.limit ?? 24));
  return {
    total: index.count,
    matches: results.length,
    offset,
    results: results.slice(offset, offset + limit),
  };
}
