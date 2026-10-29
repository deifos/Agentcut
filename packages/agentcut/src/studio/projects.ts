import { createHash } from "node:crypto";
import { readRenderDuration } from "./render-metadata.js";
import { componentCatalog, styleIds } from "./components.js";
import {
  existsSync,
  mkdirSync,
  lstatSync,
  realpathSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import {
  parseLayers,
  parseProject,
  type StudioLayers,
  type StudioProject,
  type ValidationIssue,
} from "./schema.js";
import type { WorkspacePaths } from "./workspace.js";

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SCENE_FILE = /^([A-Za-z_][A-Za-z0-9_]*)\.(tsx|ts|jsx|js)$/;

export class StudioError extends Error {
  constructor(
    message: string,
    readonly code: string = "studio_error",
  ) {
    super(message);
  }
}

export function assertSlug(slug: unknown): string {
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    throw new StudioError(`Invalid project slug "${String(slug)}". Use lowercase letters, digits and dashes.`, "bad_slug");
  }
  return slug;
}

export function slugify(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "video";
}

/** Resolve `rel` inside `root`; throws if it escapes. */
export function safeJoin(root: string, rel: string) {
  const cleaned = rel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.split("/").some((part) => part === "..")) {
    throw new StudioError("Path escapes the project folder.", "bad_path");
  }
  const full = resolve(root, cleaned);
  const rootResolved = resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + sep)) {
    throw new StudioError("Path escapes the project folder.", "bad_path");
  }
  // Check existing ancestors too: an assets junction must not expose or
  // overwrite files outside the project. Missing leaves are valid uploads.
  let ancestor = full;
  while (!existsSync(ancestor)) {
    try {
      if (lstatSync(ancestor).isSymbolicLink()) {
        throw new StudioError("Broken link in project path.", "bad_path");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (ancestor === rootResolved) return full;
    ancestor = dirname(ancestor);
  }
  const realRoot = realpathSync(rootResolved);
  const realAncestor = realpathSync(ancestor);
  const relativeAncestor = relative(realRoot, realAncestor);
  if (relativeAncestor === ".." || relativeAncestor.startsWith(`..${sep}`) || resolve(realRoot, relativeAncestor) !== realAncestor) {
    throw new StudioError("Path escapes the project folder through a link.", "bad_path");
  }
  return full;
}

export function hashText(text: string) {
  return createHash("sha1").update(text).digest("hex").slice(0, 16);
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function atomicWrite(path: string, contents: string | Buffer) {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
}

export function projectDir(paths: WorkspacePaths, slug: string) {
  return safeJoin(paths.projects, assertSlug(slug));
}

export function listSceneNames(dir: string): string[] {
  try {
    return readdirSync(join(dir, "scenes"))
      .map((name) => SCENE_FILE.exec(name)?.[1])
      .filter((name): name is string => Boolean(name))
      .sort();
  } catch {
    return [];
  }
}

export interface ProjectSummary {
  slug: string;
  name: string;
  updatedAt: number;
  durationInFrames?: number;
  fps?: number;
}

export function listProjects(paths: WorkspacePaths): ProjectSummary[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(paths.projects);
  } catch {
    return [];
  }
  const out: ProjectSummary[] = [];
  for (const slug of entries) {
    if (!SLUG_PATTERN.test(slug)) continue;
    const dir = join(paths.projects, slug);
    const projectPath = join(dir, "project.json");
    if (!existsSync(projectPath)) continue;
    let name = slug;
    let durationInFrames: number | undefined;
    let fps: number | undefined;
    try {
      const raw = JSON.parse(readFileSync(projectPath, "utf8")) as Record<string, unknown>;
      if (typeof raw.name === "string") name = raw.name;
      if (typeof raw.durationInFrames === "number") durationInFrames = raw.durationInFrames;
      if (typeof raw.fps === "number") fps = raw.fps;
    } catch {}
    let updatedAt = 0;
    for (const file of ["project.json", "layers.json"]) {
      try {
        updatedAt = Math.max(updatedAt, statSync(join(dir, file)).mtimeMs);
      } catch {}
    }
    out.push({ slug, name, updatedAt, durationInFrames, fps });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Bytes in a folder. Links are counted, not followed (a junction can point anywhere). */
function folderSize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += folderSize(path);
    else if (entry.isFile()) total += lstatSync(path).size;
  }
  return total;
}

/**
 * Delete a project and everything in it (assets, renders, chat) from disk. Links inside are
 * removed, never followed. Returns the bytes freed.
 */
export function deleteProject(paths: WorkspacePaths, slug: string) {
  const dir = projectDir(paths, slug);
  if (!existsSync(join(dir, "project.json"))) throw new StudioError(`Project "${slug}" not found.`, "not_found");
  let bytes = 0;
  try {
    bytes = folderSize(dir);
  } catch {}
  try {
    // Windows: the preview may still be streaming a file for a moment; retry instead of failing.
    rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  } catch (error) {
    throw new StudioError(
      `Couldn't delete every file in ${dir} (${(error as Error).message}). Close anything using it and try again.`,
      "delete_failed",
    );
  }
  return { slug, bytes };
}

export interface CreateProjectInput {
  name: string;
  slug?: string;
  fps?: number;
  durationInFrames?: number;
  variants?: Record<string, { width: number; height: number }>;
  defaultVariant?: string;
  background?: string;
  fonts?: (string | { family: string; src: string; weight?: string; style?: "normal" | "italic" })[];
}

export function createProject(paths: WorkspacePaths, input: CreateProjectInput) {
  const name = String(input.name ?? "").trim() || "Untitled video";
  let slug = input.slug ? assertSlug(input.slug) : slugify(name);
  if (!input.slug) {
    let n = 2;
    const base = slug;
    while (existsSync(join(paths.projects, slug))) slug = `${base}-${n++}`;
  } else if (existsSync(join(paths.projects, slug))) {
    throw new StudioError(`A project named "${slug}" already exists.`, "exists");
  }
  const fps = input.fps ?? 30;
  const variants = input.variants ?? {
    wide: { width: 1920, height: 1080 },
    mobile: { width: 1080, height: 1920 },
  };
  const project = {
    version: 1,
    name,
    fps,
    durationInFrames: input.durationInFrames ?? fps * 15,
    background: input.background ?? "#0b0b0f",
    variants,
    defaultVariant: input.defaultVariant ?? Object.keys(variants)[0],
    fonts: input.fonts ?? ["Inter:400;600;800"],
  };
  const parsed = parseProject(project);
  if (!parsed.ok) {
    throw new StudioError(`Invalid project: ${parsed.issues.map((i) => `${i.path} ${i.message}`).join("; ")}`, "invalid");
  }
  const dir = join(paths.projects, slug);
  for (const sub of ["scenes", "assets", "renders", ".studio"]) mkdirSync(join(dir, sub), { recursive: true });
  writeFileSync(join(dir, "project.json"), `${JSON.stringify(project, null, 2)}\n`);
  writeFileSync(
    join(dir, "layers.json"),
    `${JSON.stringify({ version: 1, tracks: [], markers: [] }, null, 2)}\n`,
  );
  writeFileSync(join(dir, "notes.md"), `# ${name}\n\nCue sheet and decisions.\n`);
  return { slug };
}

export interface ProjectState {
  slug: string;
  dir: string;
  project: StudioProject | null;
  projectRaw: unknown;
  layers: StudioLayers | null;
  layersRaw: unknown;
  layersHash: string | null;
  projectHash: string | null;
  scenes: string[];
  issues: ValidationIssue[];
}

export function readProjectState(paths: WorkspacePaths, slug: string): ProjectState {
  const dir = projectDir(paths, slug);
  if (!existsSync(join(dir, "project.json"))) {
    throw new StudioError(`Project "${slug}" not found.`, "not_found");
  }
  const scenes = listSceneNames(dir);
  const issues: ValidationIssue[] = [];

  const projectText = readText(join(dir, "project.json"));
  let projectRaw: unknown = null;
  let project: StudioProject | null = null;
  try {
    projectRaw = JSON.parse(projectText ?? "");
    const parsed = parseProject(projectRaw, styleIds());
    if (parsed.ok) project = parsed.value;
    issues.push(...parsed.issues);
  } catch (error) {
    issues.push({ file: "project.json", path: "", message: `Invalid JSON: ${(error as Error).message}`, severity: "error" });
  }

  const layersText = readText(join(dir, "layers.json"));
  let layersRaw: unknown = null;
  let layers: StudioLayers | null = null;
  try {
    layersRaw = JSON.parse(layersText ?? "");
    const parsed = parseLayers(layersRaw, project, scenes, componentCatalog());
    if (parsed.ok) layers = parsed.value;
    issues.push(...parsed.issues);
  } catch (error) {
    issues.push({ file: "layers.json", path: "", message: `Invalid JSON: ${(error as Error).message}`, severity: "error" });
  }

  return {
    slug,
    dir,
    project,
    projectRaw,
    layers,
    layersRaw,
    layersHash: layersText === null ? null : hashText(layersText),
    projectHash: projectText === null ? null : hashText(projectText),
    scenes,
    issues,
  };
}

export function writeLayers(paths: WorkspacePaths, slug: string, layers: unknown, baseHash: string | null) {
  const dir = projectDir(paths, slug);
  const file = join(dir, "layers.json");
  const currentText = readText(file);
  const currentHash = currentText === null ? null : hashText(currentText);
  if (baseHash !== null && currentHash !== null && baseHash !== currentHash) {
    throw new StudioError(
      "layers.json changed on disk since you loaded it (Claude may be editing). Reload and try again.",
      "conflict",
    );
  }
  let project: StudioProject | null = null;
  try {
    const parsed = parseProject(JSON.parse(readText(join(dir, "project.json")) ?? ""));
    if (parsed.ok) project = parsed.value;
  } catch {}
  const parsed = parseLayers(layers, project, listSceneNames(dir), componentCatalog());
  if (!parsed.ok) {
    throw new StudioError(
      `layers.json would be invalid: ${parsed.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`,
      "invalid",
    );
  }
  const text = `${JSON.stringify(layers, null, 2)}\n`;
  atomicWrite(file, text);
  return { layersHash: hashText(text), issues: parsed.issues };
}

export function writeProjectFile(paths: WorkspacePaths, slug: string, project: unknown) {
  const dir = projectDir(paths, slug);
  const parsed = parseProject(project);
  if (!parsed.ok) {
    throw new StudioError(
      `project.json would be invalid: ${parsed.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`,
      "invalid",
    );
  }
  const text = `${JSON.stringify(project, null, 2)}\n`;
  atomicWrite(join(dir, "project.json"), text);
  return { projectHash: hashText(text) };
}

const MEDIA_KINDS: Record<string, "audio" | "video" | "image" | "other"> = {
  ".wav": "audio",
  ".mp3": "audio",
  ".m4a": "audio",
  ".aac": "audio",
  ".ogg": "audio",
  ".opus": "audio",
  ".flac": "audio",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".m4v": "video",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".gif": "image",
  ".svg": "image",
  ".avif": "image",
};

export function mediaKind(path: string) {
  return MEDIA_KINDS[extname(path).toLowerCase()] ?? "other";
}

export interface AssetEntry {
  path: string;
  size: number;
  kind: "audio" | "video" | "image" | "other";
  updatedAt: number;
  renderDurationMs?: number;
}

function walk(root: string, dir: string, out: AssetEntry[], limit: number) {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= limit) return;
    if (entry.name.startsWith(".") || (entry.isFile() && /\.mp4\.render\.json$/i.test(entry.name))) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(root, full, out, limit);
    } else if (entry.isFile()) {
      try {
        const stat = statSync(full);
        out.push({
          path: relative(root, full).split(sep).join("/"),
          size: stat.size,
          kind: mediaKind(entry.name),
          updatedAt: stat.mtimeMs,
          ...(/\.mp4$/i.test(entry.name) ? { renderDurationMs: readRenderDuration(full) } : {}),
        });
      } catch {}
    }
  }
}

/** Files under assets/ and renders/ (paths relative to the project folder). */
export function listAssets(paths: WorkspacePaths, slug: string): AssetEntry[] {
  const dir = projectDir(paths, slug);
  const out: AssetEntry[] = [];
  walk(dir, join(dir, "assets"), out, 2000);
  walk(dir, join(dir, "renders"), out, 2500);
  // Style Spy's frames, metadata and recipe are for the agent, not the asset panel.
  return out.filter((entry) => !/^assets\/references\/[^/]+\/(frames\/|motion\/|reference\.json$|recipe\.md$)/.test(entry.path));
}

export function listLibrary(paths: WorkspacePaths): AssetEntry[] {
  const out: AssetEntry[] = [];
  walk(paths.library, paths.library, out, 3000);
  return out.map((entry) => ({ ...entry, path: `library:${entry.path}` }));
}

/** A file name that doesn't exist yet: name.ext → name-2.ext → name-3.ext … */
export function uniquePath(path: string) {
  if (!existsSync(path)) return path;
  const ext = extname(path);
  const base = path.slice(0, path.length - ext.length);
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base}-${n}${ext}`;
    if (!existsSync(candidate)) return candidate;
  }
  throw new StudioError("Could not find a free file name.");
}
