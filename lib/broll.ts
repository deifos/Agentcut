// The archival b-roll catalog: public-domain archive.org shots indexed by scripts/broll-index and
// served from a CDN (shots.json, vectors.i8, thumbs/, shots/<id>/{preview,full}.mp4).
// Search runs in the studio page (lib/studio/broll/search.worker.ts): nothing runs on a server.

export const BROLL_CDN_URL = (process.env.NEXT_PUBLIC_BROLL_CDN_URL ?? "").replace(/\/+$/, "");
export const BROLL_AVAILABLE = Boolean(BROLL_CDN_URL);

export const NO_BROLL =
  "The archival b-roll catalog isn't set up on this Agentcut (NEXT_PUBLIC_BROLL_CDN_URL). Use footage the user adds to assets/, or a motion loop for backgrounds.";

/** A catalog file (thumbs/…, shots/…) as an absolute URL. */
export const brollUrl = (path: string) => `${BROLL_CDN_URL}/${path.split("/").map(encodeURIComponent).join("/")}`;

/** One shot as stored in shots.json. */
export interface BrollShot {
  id: string;
  film: { id: string; title: string; year: number | null; url: string; license: string };
  start: number;
  end: number;
  seconds: number;
  description: string;
  subjects: string[];
  setting: string;
  mood: string[];
  tags: string[];
  shotSize: string;
  camera: string;
  people: "none" | "one" | "few" | "crowd";
  color: "black-and-white" | "color" | "tinted";
  backgroundOk: boolean;
  textOnScreen: boolean;
  titleCard?: boolean;
  sensitive?: boolean;
  quality?: string;
  motion: number;
  loopDiff: number;
  brightness: number;
  width: number;
  height: number;
  thumb: string;
  preview: string;
  full: string;
}

export interface BrollIndex {
  version: number;
  builtAt: string;
  embedModel: string;
  dim: number;
  /** vectors.i8 holds round(v / vectorScale). */
  vectorScale: number;
  count: number;
  shots: BrollShot[];
}

export interface BrollQuery {
  query?: string;
  color?: BrollShot["color"];
  /** Only shots calm and simple enough to sit behind text. */
  backgroundOk?: boolean;
  noPeople?: boolean;
  /** Little movement in frame. */
  calm?: boolean;
  minSeconds?: number;
  limit?: number;
  offset?: number;
}

export interface BrollResult extends BrollShot {
  score: number;
}

/** The compact form the agent tools return: enough to choose, cheap in tokens. */
export function brollSummary(s: BrollResult | BrollShot) {
  return {
    id: s.id,
    seconds: s.seconds,
    description: s.description,
    tags: s.tags.slice(0, 10).join(", "),
    mood: s.mood.join(", "),
    shot: `${s.shotSize}, camera ${s.camera}, motion ${s.motion}`,
    people: s.people,
    color: s.color,
    size: `${s.width}x${s.height}`,
    ...(s.backgroundOk ? { backgroundOk: true } : {}),
    ...(s.textOnScreen ? { textOnScreen: true } : {}),
    film: `${s.film.title}${s.film.year ? ` (${s.film.year})` : ""}`,
    thumb: brollUrl(s.thumb),
  };
}
