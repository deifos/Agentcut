/**
 * The public library of community editing styles.
 *
 * A community style is a saved editing style (style.json + PROMPT.md) that someone shared, plus a
 * poster frame and a short demo clip. The catalog is static files: each style is a folder in
 * public/community-styles/<id>/, added by pull request after review, and the site serves an index
 * of them at /community-styles/index.json (built at deploy time, no server work per request).
 *
 * A style is instructions the agent follows, so the catalog is text and media only, each prompt is
 * pinned by its SHA-256 in the index, and the studio checks that hash before installing.
 *
 * This file is shared by the site (build time), the studio page and the tests: no Node imports.
 */

export const COMMUNITY_STYLE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const COMMUNITY_TAG = /^[a-z0-9][a-z0-9-]{0,23}$/;
export const GITHUB_USER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** The only files a style folder may hold, with their size limits in bytes. */
export const COMMUNITY_STYLE_FILES = {
  "style.json": 4_000,
  "PROMPT.md": 64_000,
  "poster.jpg": 400_000,
  "demo.mp4": 4_000_000,
} as const;
export type CommunityStyleFile = keyof typeof COMMUNITY_STYLE_FILES;
export const REQUIRED_COMMUNITY_FILES: CommunityStyleFile[] = ["style.json", "PROMPT.md", "poster.jpg"];

export const MAX_TAGS = 6;
export const DEMO_MAX_SECONDS = 10;

/** Where submissions go: an issue on the Agentcut repository with the zip attached. */
export const COMMUNITY_REPO = "deifos/Agentcut";

/**
 * The catalog's base URL. Defaults to this site; set NEXT_PUBLIC_COMMUNITY_STYLES_URL to read the
 * catalog from elsewhere (an R2 bucket with the same layout, or the main site from a self-host).
 */
export const COMMUNITY_STYLES_URL = (process.env.NEXT_PUBLIC_COMMUNITY_STYLES_URL ?? "/community-styles").replace(/\/+$/, "");

export interface CommunityAuthor {
  name: string;
  github?: string;
}

/** style.json inside a catalog folder. */
export interface CommunityStyleMeta {
  version: 1;
  name: string;
  description: string;
  author: CommunityAuthor;
  tags: string[];
  /** Goes up by one each time the rules change. */
  revision: number;
}

/** One entry of index.json. File URLs are relative to the catalog base. */
export interface CommunityStyleEntry extends CommunityStyleMeta {
  id: string;
  promptSha256: string;
  promptBytes: number;
  poster: string;
  demo: string | null;
}

export interface CommunityIndex {
  version: 1;
  styles: CommunityStyleEntry[];
}

export class CommunityStyleError extends Error {}

function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new CommunityStyleError(`${field} must be 1–${max} characters.`);
  // Control characters (other than ordinary whitespace) have no place in names and descriptions.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
    throw new CommunityStyleError(`${field} contains control characters.`);
  return value.trim();
}

/** Validate a catalog style.json. Throws a CommunityStyleError naming the first problem. */
export function parseCommunityStyleMeta(value: unknown): CommunityStyleMeta {
  const meta = value as Record<string, unknown> | null;
  if (!meta || typeof meta !== "object" || Array.isArray(meta))
    throw new CommunityStyleError("style.json must be an object.");
  if (meta.version !== 1) throw new CommunityStyleError("style.json version must be 1.");
  const allowed = new Set(["version", "name", "description", "author", "tags", "revision"]);
  const extra = Object.keys(meta).filter((key) => !allowed.has(key));
  if (extra.length) throw new CommunityStyleError(`style.json has unknown fields: ${extra.join(", ")}.`);
  const author = meta.author as Record<string, unknown> | null;
  if (!author || typeof author !== "object" || Array.isArray(author))
    throw new CommunityStyleError("author must be an object with a name.");
  const authorExtra = Object.keys(author).filter((key) => key !== "name" && key !== "github");
  if (authorExtra.length) throw new CommunityStyleError(`author has unknown fields: ${authorExtra.join(", ")}.`);
  if (author.github !== undefined && (typeof author.github !== "string" || !GITHUB_USER.test(author.github)))
    throw new CommunityStyleError("author.github must be a GitHub username.");
  if (!Array.isArray(meta.tags) || meta.tags.length > MAX_TAGS || meta.tags.some((tag) => typeof tag !== "string" || !COMMUNITY_TAG.test(tag)))
    throw new CommunityStyleError(`tags must be up to ${MAX_TAGS} lowercase words (a–z, 0–9, dashes).`);
  if (!Number.isInteger(meta.revision) || (meta.revision as number) < 1 || (meta.revision as number) > 10_000)
    throw new CommunityStyleError("revision must be a whole number from 1.");
  return {
    version: 1,
    name: text(meta.name, "name", 80),
    description: text(meta.description, "description", 500),
    author: {
      name: text(author.name, "author.name", 60),
      ...(author.github ? { github: author.github as string } : {}),
    },
    tags: [...new Set(meta.tags as string[])],
    revision: meta.revision as number,
  };
}

/** Validate index.json as fetched (the studio doesn't trust it to be well formed). */
export function parseCommunityIndex(value: unknown): CommunityIndex {
  const index = value as Record<string, unknown> | null;
  if (!index || index.version !== 1 || !Array.isArray(index.styles))
    throw new CommunityStyleError("The community catalog is not in a format this Agentcut understands.");
  const styles: CommunityStyleEntry[] = [];
  for (const raw of index.styles as Record<string, unknown>[]) {
    try {
      if (typeof raw.id !== "string" || !COMMUNITY_STYLE_ID.test(raw.id)) continue;
      if (typeof raw.promptSha256 !== "string" || !/^[0-9a-f]{64}$/.test(raw.promptSha256)) continue;
      const { id, promptSha256, promptBytes, poster, demo, ...meta } = raw;
      styles.push({
        ...parseCommunityStyleMeta(meta),
        id,
        promptSha256,
        promptBytes: Number(promptBytes) || 0,
        poster: catalogFile(id, poster, "poster.jpg"),
        demo: demo == null ? null : catalogFile(id, demo, "demo.mp4"),
      });
    } catch {
      // One bad entry shouldn't hide the rest of the catalog.
    }
  }
  return { version: 1, styles };
}

/** Catalog file paths are fixed by the folder layout; anything else in the index is ignored. */
function catalogFile(id: string, value: unknown, file: CommunityStyleFile) {
  const expected = `${id}/${file}`;
  if (value !== expected) throw new CommunityStyleError(`Unexpected file path for ${id}.`);
  return expected;
}

export function communityFileUrl(path: string, base = COMMUNITY_STYLES_URL) {
  return `${base}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Prompts are stored with one trailing newline; hashes are of the trimmed text. */
export function normalizePrompt(prompt: string) {
  return prompt.replace(/\r\n/g, "\n").trim();
}

export async function fetchCommunityIndex(base = COMMUNITY_STYLES_URL, signal?: AbortSignal) {
  const response = await fetch(`${base}/index.json`, { cache: "no-store", signal });
  if (!response.ok) throw new CommunityStyleError(`Could not load the community library (${response.status}).`);
  return parseCommunityIndex(await response.json());
}

/** Fetch a style's rules and check them against the hash in the index. */
export async function fetchCommunityPrompt(entry: CommunityStyleEntry, base = COMMUNITY_STYLES_URL, signal?: AbortSignal) {
  const response = await fetch(communityFileUrl(`${entry.id}/PROMPT.md`, base), { cache: "no-store", signal });
  if (!response.ok) throw new CommunityStyleError(`Could not load the rules for ${entry.name} (${response.status}).`);
  const prompt = normalizePrompt(await response.text());
  if ((await sha256Hex(prompt)) !== entry.promptSha256)
    throw new CommunityStyleError(`The rules for ${entry.name} don't match the reviewed version, so they weren't loaded.`);
  return prompt;
}

/** Search and tag filter for the gallery. */
export function filterCommunityStyles(styles: CommunityStyleEntry[], query: string, tag: string | null) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return styles.filter((style) => {
    if (tag && !style.tags.includes(tag)) return false;
    const haystack = `${style.name} ${style.description} ${style.author.name} ${style.author.github ?? ""} ${style.tags.join(" ")}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function communityTags(styles: CommunityStyleEntry[]) {
  const counts = new Map<string, number>();
  for (const style of styles) for (const tag of style.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
}

/** The studio link that opens a community style (the site's "Open in Agentcut"). */
export function communityStudioHash(id: string) {
  return `#community-style=${id}`;
}

export function communityStyleFromHash(hash: string) {
  const match = /^#community-style=([a-z0-9][a-z0-9-]{0,63})$/.exec(hash);
  return match ? match[1] : null;
}

/** Turn free text into tags: "Vertical, Talking head" → ["vertical", "talking-head"]. */
export function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,\n]/)
        .map((tag) => tag.trim().normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24).replace(/-$/, ""))
        .filter((tag) => COMMUNITY_TAG.test(tag)),
    ),
  ].slice(0, MAX_TAGS);
}

/** A GitHub "new issue" link for a submission; the zip is attached by the person submitting. */
export function submissionIssueUrl(meta: CommunityStyleMeta, id: string) {
  const body = [
    `### Style`,
    `**${meta.name}** (\`${id}\`), revision ${meta.revision}`,
    "",
    meta.description,
    "",
    `**Author:** ${meta.author.name}${meta.author.github ? ` (@${meta.author.github})` : ""}`,
    `**Tags:** ${meta.tags.join(", ") || "none"}`,
    "",
    "### Submission",
    `Drag \`${id}.zip\` (from the Share publicly dialog) into this issue before submitting.`,
    "",
    "- [x] I made this style and the demo, and I'm happy for both to be public.",
    "- [x] The demo's footage and music are mine or licensed for this use.",
    "- [x] The rules contain no personal details.",
  ].join("\n");
  const params = new URLSearchParams({
    title: `Community style: ${meta.name}`,
    labels: "community-style",
    body,
  });
  return `https://github.com/${COMMUNITY_REPO}/issues/new?${params}`;
}
