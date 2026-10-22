// Port of earshot/match.py + vocab calibration: does a sound match a text description?
// z = how far the description stands out among earshot's 322 vocabulary descriptions for
// this very sound, after removing each description's bias (reference mean embedding).
import { DIM, dot, embedFile, embedPhrases, getVocab, loadAudio, type Vocab } from "@/lib/studio/listen/models";

export const VERDICTS: [number, string][] = [
  [3.0, "strong"],
  [2.5, "plausible"],
  [2.0, "weak"],
];

export const VERDICT_EVIDENCE: Record<string, string> = {
  strong: "held-out library search: the right kind of sound 98% of the time, the exact variant 61%",
  plausible: "right kind 41%, exact variant 22% (when searching a library)",
  weak: "right kind 28%, exact variant 17%: evidence, not proof",
  "no match": "no evidence it is this sound",
};

const SKIP_CATEGORIES = new Set(["quality", "production"]);

export function verdictOf(z: number) {
  for (const [threshold, name] of VERDICTS) if (z >= threshold) return name;
  return "no match";
}

interface Calibrated {
  zQuery: number;
  cosine: number;
  percentile: number;
  rankInVocab: number;
  topTerms: { term: string; category: string; z: number }[];
}

function calibrate(vocab: Vocab, audio: Float32Array, query: Float32Array): Calibrated {
  const T = vocab.names.length;
  const U = new Float64Array(T);
  let mean = 0;
  for (let t = 0; t < T; t += 1) {
    U[t] = dot(audio, 0, vocab.E, t * DIM) - vocab.muE[t];
    mean += U[t];
  }
  mean /= T;
  let variance = 0;
  for (let t = 0; t < T; t += 1) variance += (U[t] - mean) ** 2;
  const sd = Math.sqrt(variance / T) + 1e-9;
  const cosine = dot(audio, 0, query, 0);
  const uq = cosine - dot(query, 0, vocab.m, 0);
  let below = 0;
  let above = 0;
  for (let t = 0; t < T; t += 1) {
    if (U[t] < uq) below += 1;
    if (U[t] > uq) above += 1;
  }
  const order = Array.from({ length: T }, (_, t) => t).sort((a, b) => U[b] - U[a]);
  const topTerms = order
    .filter((t) => !SKIP_CATEGORIES.has(vocab.categoryOf.get(vocab.names[t]) ?? ""))
    .slice(0, 4)
    .map((t) => ({
      term: vocab.names[t],
      category: vocab.categoryOf.get(vocab.names[t]) ?? "",
      z: Math.round(((U[t] - mean) / sd) * 100) / 100,
    }));
  return {
    zQuery: (uq - mean) / sd,
    cosine,
    percentile: (100 * below) / T,
    rankInVocab: above + 1,
    topTerms,
  };
}

export interface RankRow {
  path: string;
  z: number;
  verdict: string;
  cosine: number;
  percentile: number;
  rankInVocab: number;
  soundsLike: { term: string; z: number }[];
  peakDbfs: number;
  warning?: string;
}

export async function rankFiles(query: string, files: { path: string; url: string }[]) {
  const vocab = await getVocab();
  const q = await embedPhrases([query]);
  const rows: RankRow[] = [];
  const errors: { path: string; error: string }[] = [];
  for (const file of files) {
    try {
      const audio = await loadAudio(file.url);
      let peak = 0;
      for (const v of audio.mono48) peak = Math.max(peak, Math.abs(v));
      const peakDbfs = peak > 0 ? 20 * Math.log10(peak) : -200;
      const embedding = await embedFile(audio);
      const c = calibrate(vocab, embedding, q);
      const z = Math.round(c.zQuery * 100) / 100;
      rows.push({
        path: file.path,
        z,
        verdict: verdictOf(z),
        cosine: Math.round(c.cosine * 1000) / 1000,
        percentile: Math.round(c.percentile * 10) / 10,
        rankInVocab: c.rankInVocab,
        soundsLike: c.topTerms.map((term) => ({ term: term.term, z: term.z })),
        peakDbfs: Math.round(peakDbfs * 10) / 10,
        warning: peakDbfs < -70 ? "near-silent input: scores are meaningless" : undefined,
      });
    } catch (error) {
      errors.push({ path: file.path, error: error instanceof Error ? error.message : String(error) });
    }
  }
  rows.sort((a, b) => b.z - a.z);
  return { rows, errors, vocabSize: vocab.names.length };
}
