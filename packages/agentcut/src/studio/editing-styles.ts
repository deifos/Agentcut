import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspacePaths } from "./workspace.js";
import { safeJoin, StudioError } from "./projects.js";

export const editingStyleInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  prompt: z.string().trim().min(1).max(64_000),
});

/** Remove from the shared library; retain the files in private workspace trash. */
export function deleteEditingStyle(paths: WorkspacePaths, input: unknown) {
  const id = z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
    .parse(input);
  const root = safeJoin(paths.library, "editing-styles");
  const dir = safeJoin(root, id);
  if (
    lstatSync(root).isSymbolicLink() ||
    lstatSync(dir).isSymbolicLink() ||
    !lstatSync(dir).isDirectory()
  )
    throw new StudioError(
      "Only saved editing style folders can be deleted.",
      "bad_path",
    );
  const trash = safeJoin(paths.internal, "deleted-editing-styles");
  mkdirSync(trash, { recursive: true });
  const trashed = safeJoin(trash, `${id}-${randomUUID()}`);
  renameSync(dir, trashed);
  // When it was deleted: housekeeping empties the trash after 30 days.
  const now = new Date();
  utimesSync(trashed, now, now);
  return { id };
}

/** A folder id from a style name: lowercase, dashes, never a reserved Windows device name. */
function styleSlug(name: string) {
  const slug =
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 55)
      .replace(/-$/, "") || "editing-style";
  return /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(slug) ? `style-${slug}` : slug;
}

/**
 * Create a new style folder (never overwrite): reserve the directory first so concurrent saves
 * can't collide, write PROMPT.md, then style.json last (the gallery only lists complete pairs),
 * and read both back.
 */
function createStyleFolder(paths: WorkspacePaths, name: string, prompt: string, meta: Record<string, unknown>) {
  const base = styleSlug(name);
  const root = safeJoin(paths.library, "editing-styles");
  mkdirSync(root, { recursive: true });
  for (let index = 1; index < 10_000; index += 1) {
    const id = index === 1 ? base : `${base}-${index}`;
    const dir = join(root, id);
    try {
      mkdirSync(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw error;
    }
    const promptFile = join(dir, "PROMPT.md");
    const metaFile = join(dir, "style.json");
    try {
      writeFileSync(promptFile, `${prompt}\n`, { flag: "wx" });
      writeFileSync(metaFile, `${JSON.stringify({ version: 1, ...meta }, null, 2)}\n`, { flag: "wx" });
      if (
        !readFileSync(promptFile, "utf8").trim() ||
        JSON.parse(readFileSync(metaFile, "utf8")).name !== name
      )
        throw new StudioError("Could not verify the saved editing style.");
      return {
        id,
        name,
        path: `library/editing-styles/${id}/`,
        promptPath: `editing-styles/${id}/PROMPT.md`,
      };
    } catch (error) {
      for (const file of [metaFile, promptFile])
        if (existsSync(file)) unlinkSync(file);
      rmdirSync(dir);
      throw error;
    }
  }
  throw new StudioError("Could not find a free editing style name.");
}

/** Create only. Reserve the directory before writing so concurrent saves cannot overwrite. */
export function saveEditingStyle(paths: WorkspacePaths, input: unknown) {
  const { name, description, prompt } = editingStyleInput.parse(input);
  return createStyleFolder(paths, name, prompt, { name, description });
}

const STYLE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Catalog files live on the Agentcut site (or a self-host); only web URLs are stored.
const catalogUrl = z
  .string()
  .max(500)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  }, "Catalog files must be on an https:// address.");

export const communityStyleInput = z.object({
  id: z.string().regex(STYLE_ID),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  prompt: z.string().trim().min(1).max(64_000),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  revision: z.number().int().min(1).max(10_000),
  author: z.object({
    name: z.string().trim().min(1).max(60),
    github: z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/).optional(),
  }),
  tags: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,23}$/)).max(6),
  catalog: catalogUrl,
  poster: catalogUrl,
  demo: catalogUrl.nullable(),
});

interface InstalledSource {
  id: string;
  catalog: string;
  sha256: string;
  revision: number;
}

/** Community styles already in this workspace, by folder id. */
export function installedCommunityStyles(paths: WorkspacePaths) {
  const root = safeJoin(paths.library, "editing-styles");
  const out: { folder: string; source: InstalledSource }[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(root);
  } catch {
    return out;
  }
  for (const folder of names) {
    if (!STYLE_ID.test(folder)) continue;
    try {
      const meta = JSON.parse(readFileSync(join(root, folder, "style.json"), "utf8"));
      const source = meta?.source;
      if (source?.kind === "community" && typeof source.id === "string" && typeof source.sha256 === "string")
        out.push({ folder, source });
    } catch {}
  }
  return out;
}

/**
 * Add a style from the community library. The page fetched the rules and checked them against the
 * catalog's hash; check again here so what's saved is exactly what was reviewed. Installing the
 * same revision twice returns the existing copy; a newer revision is added alongside the old one
 * (saved styles are never overwritten: the person may have edited theirs).
 */
export function installCommunityStyle(paths: WorkspacePaths, input: unknown) {
  const style = communityStyleInput.parse(input);
  const prompt = style.prompt.replace(/\r\n/g, "\n").trim();
  if (createHash("sha256").update(prompt).digest("hex") !== style.sha256)
    throw new StudioError("These rules don't match the reviewed version in the community library, so they weren't added.", "bad_request");
  const catalog = new URL(style.catalog).href.replace(/\/+$/, "");
  const existing = installedCommunityStyles(paths).find(
    (entry) => entry.source.id === style.id && entry.source.catalog === catalog && entry.source.sha256 === style.sha256,
  );
  if (existing) return { id: existing.folder, name: style.name, existing: true };
  const saved = createStyleFolder(paths, style.name, prompt, {
    name: style.name,
    description: style.description,
    author: style.author,
    tags: style.tags,
    source: { kind: "community", id: style.id, catalog, revision: style.revision, sha256: style.sha256 },
    preview: { poster: style.poster, ...(style.demo ? { demo: style.demo } : {}) },
  });
  return { id: saved.id, name: style.name, existing: false };
}
