// Search over the hosted music library and its offline analysis (lib/music-analysis.json, made by
// scripts/music-catalog/analyze.py): tempo, energy, moods, genres, instruments and each song's shape.
import ANALYSIS from "@/lib/music-analysis.json";
import { MUSIC_TRACKS, type MusicTrack } from "@/lib/music-tracks";

export interface MusicAnalysis {
  bpm: number;
  /** 1–5, relative to the rest of the library (5 = the most driving fifth). */
  energy: number;
  beat: "steady" | "light" | "loose";
  vocals: boolean;
  moods: string[];
  genres: string[];
  instruments: string[];
  /** Seconds until the song first holds its full level. */
  introS: number;
  /** Seconds where the level jumps up (entrances, drops). */
  drops: number[];
  ending: "fade" | "hard" | "ring-out";
  /** The level over the song in 12 steps. */
  shape: string;
  /** The same recording as this id (the library has a few under two names): left out of searches. */
  sameAs?: string;
}

export const MUSIC_ANALYSIS = ANALYSIS as Record<string, MusicAnalysis>;

export interface MusicSearch {
  query?: string;
  category?: string;
  minSeconds?: number;
  maxSeconds?: number;
  /** Energy 1–5 (or a [min, max] range). */
  energy?: number | [number, number];
  minBpm?: number;
  maxBpm?: number;
  vocals?: boolean;
  ids?: string[];
}

// Plain words in a request that mean a filter rather than a name or tag.
const ENERGY_WORDS: [RegExp, [number, number]][] = [
  [/\b(very high|max(imum)?|extreme|insane)[- ]energy\b|\bhype\b|\bbanger\b/, [5, 5]],
  [/\bhigh[- ]energy\b|\bintense\b|\bpumped\b|\bpowerful\b/, [4, 5]],
  [/\bmedium[- ]energy\b|\bmoderate\b/, [2, 4]],
  [/\blow[- ]energy\b|\bcalm\b|\brelax(ed|ing)?\b|\bgentle\b|\bsoft\b|\bquiet\b|\bmellow\b/, [1, 2]],
];
const STOP = new Set(["a", "an", "the", "and", "or", "with", "for", "song", "songs", "music", "track", "tracks", "energy", "bpm", "some", "something", "like", "video"]);

/** Turns "high energy 120 bpm no vocals launch" into filters plus the words left to match. */
export function parseMusicQuery(raw: string) {
  let q = raw.toLowerCase();
  const out: { energy?: [number, number]; minBpm?: number; maxBpm?: number; vocals?: boolean; words: string[] } = { words: [] };
  for (const [re, range] of ENERGY_WORDS) {
    if (re.test(q)) {
      out.energy = range;
      q = q.replace(re, " ");
      break;
    }
  }
  const bpm = q.match(/\b(\d{2,3})\s*bpm\b/);
  if (bpm) {
    out.minBpm = Number(bpm[1]) - 8;
    out.maxBpm = Number(bpm[1]) + 8;
    q = q.replace(bpm[0], " ");
  } else if (/\bfast\b/.test(q)) {
    out.minBpm = 125;
    q = q.replace(/\bfast\b/, " ");
  } else if (/\bslow\b/.test(q)) {
    out.maxBpm = 100;
    q = q.replace(/\bslow\b/, " ");
  }
  if (/\b(no vocals?|instrumental|without vocals?)\b/.test(q)) {
    out.vocals = false;
    q = q.replace(/\b(no vocals?|instrumental|without vocals?)\b/g, " ");
  } else if (/\b(vocals?|singing|sung)\b/.test(q)) {
    out.vocals = true;
    q = q.replace(/\b(vocals?|singing|sung)\b/g, " ");
  }
  out.words = q.split(/[^a-z0-9-]+/).filter((w) => w.length > 1 && !STOP.has(w));
  return out;
}

function haystack(t: MusicTrack, a: MusicAnalysis | undefined) {
  return `${t.name} ${t.category} ${a ? [...a.moods, ...a.genres, ...a.instruments].join(" ") : ""}`.toLowerCase();
}

export function searchMusic(search: MusicSearch) {
  const parsed = parseMusicQuery(search.query ?? "");
  const energy: [number, number] | undefined =
    typeof search.energy === "number"
      ? [search.energy, search.energy]
      : Array.isArray(search.energy)
        ? search.energy
        : parsed.energy;
  const minBpm = search.minBpm ?? parsed.minBpm ?? 0;
  const maxBpm = search.maxBpm ?? parsed.maxBpm ?? Infinity;
  const vocals = search.vocals ?? parsed.vocals;
  const min = search.minSeconds ?? 0;
  const max = search.maxSeconds ?? Infinity;
  const words = parsed.words;
  const ranked = MUSIC_TRACKS.filter((t) => !t.isCustom)
    .map((t) => ({ t, a: MUSIC_ANALYSIS[t.id] }))
    .filter(({ t, a }) => {
      if (search.ids?.length) return search.ids.includes(t.id);
      if (search.category && t.category !== search.category) return false;
      if (t.durationSeconds < min || t.durationSeconds > max) return false;
      if (!a) return !energy && !minBpm && maxBpm === Infinity && vocals === undefined;
      if (energy && (a.energy < energy[0] || a.energy > energy[1])) return false;
      if (a.bpm < minBpm || a.bpm > maxBpm) return false;
      if (vocals !== undefined && a.vocals !== vocals) return false;
      return true;
    })
    .map((x) => {
      const text = haystack(x.t, x.a);
      const hits = words.filter((w) => text.includes(w)).length;
      return { ...x, hits };
    })
    // Words narrow the list when any song matches them; otherwise they only rank.
    .filter((x, _, all) => search.ids?.length || !words.length || x.hits > 0 || all.every((y) => y.hits === 0))
    .sort((x, y) => y.hits - x.hits || (energy ? (y.a?.energy ?? 0) - (x.a?.energy ?? 0) : 0));
  // Keep a matching alias if the canonical entry was filtered out. Explicit ids return every request.
  const seen = new Set<string>();
  const unique = ranked.filter(({ t, a }) => {
    if (search.ids?.length) return true;
    const recording = a?.sameAs ?? t.id;
    if (seen.has(recording)) return false;
    seen.add(recording);
    return true;
  });
  return {
    filters: {
      ...(energy ? { energy } : {}),
      ...(minBpm ? { minBpm } : {}),
      ...(maxBpm !== Infinity ? { maxBpm } : {}),
      ...(vocals !== undefined ? { vocals } : {}),
      ...(words.length ? { words } : {}),
    },
    tracks: unique.map(({ t, a }) => ({ track: t, analysis: a })),
  };
}
