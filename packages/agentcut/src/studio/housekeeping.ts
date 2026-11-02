// What Agentcut keeps on disk for itself stays bounded: caches expire, scratch from a crash is
// removed, and nothing outlives the project or file it was made for. Runs when the helper starts
// and every few hours. Never touches a project's own files (scenes, assets, renders, notes).
import { existsSync, lstatSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { debugLog } from "../log.js";
import type { WorkspacePaths } from "./workspace.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Deleted editing styles can be recovered by hand for this long. */
const STYLE_TRASH_DAYS = 30;
/** A share import that hasn't finished in this long was interrupted. */
const INCOMING_HOURS = 24;
/** Agents' throwaway files (`.studio/scratch/`, see the skill): kept this long, and within this size. */
const SCRATCH_DAYS = 14;
const MAX_SCRATCH_BYTES = 500 * 1024 * 1024;
const MAX_CHAT_FRAMES = 400;
/** Pictures kept for a project's chat; the oldest go first (old messages then just don't show them). */
const MAX_CHAT_FRAME_BYTES = 150 * 1024 * 1024;

function entries(dir: string) {
  try {
    // A scratch folder or one of its parents can be a junction to user files.
    for (let path = resolve(dir); ; path = dirname(path)) {
      if (lstatSync(path).isSymbolicLink()) return [];
      if (dirname(path) === path) break;
    }
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function ageMs(path: string) {
  try {
    return Date.now() - statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function remove(path: string, why: string) {
  try {
    rmSync(path, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
    debugLog(`housekeeping: removed ${path} (${why})`);
    return true;
  } catch (error) {
    debugLog(`housekeeping: couldn't remove ${path}: ${(error as Error).message}`);
    return false;
  }
}

/** The newest chat pictures within MAX_CHAT_FRAMES and MAX_CHAT_FRAME_BYTES; the rest are removed. */
export function pruneChatFrames(dir: string) {
  const files = entries(dir)
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const stat = statSync(join(dir, entry.name));
      return { name: entry.name, mtime: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.mtime - a.mtime);
  let bytes = 0;
  files.forEach((file, index) => {
    bytes += file.size;
    if (index >= MAX_CHAT_FRAMES || bytes > MAX_CHAT_FRAME_BYTES) rmSync(join(dir, file.name), { force: true });
  });
}

/** Files in a project's scratch folder, oldest first; what's past SCRATCH_DAYS or MAX_SCRATCH_BYTES goes. */
export function pruneScratch(dir: string) {
  const files: { path: string; mtime: number; size: number }[] = [];
  const walk = (folder: string) => {
    for (const entry of entries(folder)) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        const stat = statSync(path);
        files.push({ path, mtime: stat.mtimeMs, size: stat.size });
      }
    }
  };
  walk(dir);
  files.sort((a, b) => b.mtime - a.mtime);
  let bytes = 0;
  for (const file of files) {
    bytes += file.size;
    if (Date.now() - file.mtime > SCRATCH_DAYS * DAY || bytes > MAX_SCRATCH_BYTES) rmSync(file.path, { force: true });
  }
  // Folders the removals emptied (the scratch folder itself stays).
  const prune = (folder: string) => {
    for (const entry of entries(folder)) {
      if (!entry.isDirectory()) continue;
      const path = join(folder, entry.name);
      prune(path);
      if (entries(path).length === 0) rmSync(path, { recursive: true, force: true });
    }
  };
  prune(dir);
}

const projectExists = (paths: WorkspacePaths, slug: string) => existsSync(join(paths.projects, slug, "project.json"));

/**
 * Local renders link each project's assets into .agentcut/render/public-<slug>. The links cost no space
 * while the originals exist, but they keep deleted footage on disk, and on another drive they are copies.
 * Each render makes its own again, so none are kept between renders.
 */
export function sweepRenderFolder(paths: WorkspacePaths, renderingSlug: string | null) {
  for (const entry of entries(paths.render)) {
    const name = entry.name;
    const mirror = /^public-(.+)$/.exec(name);
    if (entry.isDirectory() && mirror) {
      if (mirror[1] !== renderingSlug) remove(join(paths.render, name), "render asset links");
      continue;
    }
    const perProject = /^(.+)\.(props\.json|render\.tsx)$/.exec(name);
    if (entry.isFile() && perProject && !projectExists(paths, perProject[1]))
      remove(join(paths.render, name), "project deleted");
  }
}

/** Everything the helper made for one project outside its folder. */
export function forgetProject(paths: WorkspacePaths, slug: string) {
  for (const name of [`public-${slug}`, `${slug}.props.json`, `${slug}.render.tsx`]) {
    const path = join(paths.render, name);
    if (existsSync(path)) remove(path, "project deleted");
  }
}

export function sweepWorkspace(paths: WorkspacePaths, { renderingSlug }: { renderingSlug: string | null }) {
  sweepRenderFolder(paths, renderingSlug);

  const trash = join(paths.internal, "deleted-editing-styles");
  for (const entry of entries(trash)) {
    const path = join(trash, entry.name);
    if (ageMs(path) > STYLE_TRASH_DAYS * DAY) remove(path, "deleted style past its recovery window");
  }

  for (const entry of entries(paths.projects)) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      pruneChatFrames(join(paths.projects, entry.name, ".studio", "attachments", "claude-frames"));
      pruneScratch(join(paths.projects, entry.name, ".studio", "scratch"));
    }
    if (!entry.isDirectory() || !entry.name.startsWith(".incoming-")) continue;
    const path = join(paths.projects, entry.name);
    if (ageMs(path) > INCOMING_HOURS * HOUR) remove(path, "interrupted share import");
  }
}
