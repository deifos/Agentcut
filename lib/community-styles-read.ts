/**
 * Read and validate a community style catalog folder (public/community-styles/ by default).
 * Node only: used by the site at build time, the maintainer script and the tests.
 */
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  COMMUNITY_STYLE_FILES,
  COMMUNITY_STYLE_ID,
  CommunityStyleError,
  normalizePrompt,
  parseCommunityStyleMeta,
  REQUIRED_COMMUNITY_FILES,
  type CommunityIndex,
  type CommunityStyleEntry,
  type CommunityStyleFile,
} from "./community-styles";

export const DEFAULT_CATALOG_DIR = resolve(process.cwd(), "public", "community-styles");

const JPEG = [0xff, 0xd8, 0xff];

/** Validate one style folder and return its index entry. */
export function readCommunityStyleFolder(dir: string, id: string): CommunityStyleEntry {
  const fail = (message: string): never => {
    throw new CommunityStyleError(`Community style "${id}": ${message}`);
  };
  if (!COMMUNITY_STYLE_ID.test(id)) fail("the folder name must be lowercase letters, numbers and dashes.");
  if (lstatSync(dir).isSymbolicLink() || !lstatSync(dir).isDirectory()) fail("must be a plain folder.");
  const files = new Map<string, number>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) fail(`"${entry.name}" is not allowed (folders and links aren't).`);
    if (!(entry.name in COMMUNITY_STYLE_FILES)) fail(`"${entry.name}" is not allowed. A style holds only ${Object.keys(COMMUNITY_STYLE_FILES).join(", ")}.`);
    const size = lstatSync(join(dir, entry.name)).size;
    const limit = COMMUNITY_STYLE_FILES[entry.name as CommunityStyleFile];
    if (size > limit) fail(`${entry.name} is ${size} bytes; the limit is ${limit}.`);
    if (size === 0) fail(`${entry.name} is empty.`);
    files.set(entry.name, size);
  }
  for (const file of REQUIRED_COMMUNITY_FILES) if (!files.has(file)) fail(`${file} is missing.`);

  let meta;
  try {
    meta = parseCommunityStyleMeta(JSON.parse(readFileSync(join(dir, "style.json"), "utf8")));
  } catch (error) {
    return fail(`style.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  const raw = readFileSync(join(dir, "PROMPT.md"));
  const prompt = normalizePrompt(new TextDecoder("utf-8", { fatal: false }).decode(raw));
  if (raw.includes(0) || prompt.includes("�")) fail("PROMPT.md must be UTF-8 text.");
  if (!prompt) fail("PROMPT.md is empty.");

  const poster = readFileSync(join(dir, "poster.jpg"));
  if (!JPEG.every((byte, index) => poster[index] === byte)) fail("poster.jpg must be a JPEG image.");
  if (files.has("demo.mp4")) {
    const demo = readFileSync(join(dir, "demo.mp4"));
    if (demo.subarray(4, 8).toString("latin1") !== "ftyp") fail("demo.mp4 must be an MP4 video.");
  }
  return {
    ...meta,
    id,
    promptSha256: createHash("sha256").update(prompt).digest("hex"),
    promptBytes: Buffer.byteLength(prompt),
    poster: `${id}/poster.jpg`,
    demo: files.has("demo.mp4") ? `${id}/demo.mp4` : null,
  };
}

/** The whole catalog, newest revision data first by name. Throws on the first invalid folder. */
export function readCommunityCatalog(dir = DEFAULT_CATALOG_DIR): CommunityIndex {
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { version: 1, styles: [] };
  }
  const styles: CommunityStyleEntry[] = [];
  for (const entry of entries) {
    if (entry.name === "README.md") continue;
    if (!entry.isDirectory()) throw new CommunityStyleError(`"${entry.name}" in the catalog is not a style folder.`);
    styles.push(readCommunityStyleFolder(join(dir, entry.name), entry.name));
  }
  styles.sort((a, b) => a.name.localeCompare(b.name));
  return { version: 1, styles };
}

export function readCommunityPrompt(id: string, dir = DEFAULT_CATALOG_DIR) {
  return normalizePrompt(readFileSync(join(dir, id, "PROMPT.md"), "utf8"));
}
