import { randomUUID } from "node:crypto";
import {
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { copyFile, mkdir, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import {
  assertSlug,
  atomicWrite,
  hashText,
  listAssets,
  listProjects,
  mediaKind,
  projectDir,
  readCanvasMembership,
  readProjectState,
  safeJoin,
  slugify,
  StudioError,
} from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

export const cutInput = z.object({
  project: z.string(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["clip", "version"]),
  reuseAssets: z.boolean().default(false),
  segments: z
    .array(
      z
        .object({
          source: z.string(),
          start: z.number().finite().nonnegative(),
          end: z.number().finite().positive(),
        })
        .refine((s) => s.end > s.start, "End must follow start"),
    )
    .max(500)
    .default([]),
});

export function readCanvas(paths: WorkspacePaths, slug: string) {
  const active = readCanvasMembership(projectDir(paths, slug), slug);
  const sources = new Map<
    string,
    { id: string; project: string; path: string; name: string; recording: boolean }
  >();
  const cuts = [];
  const members = listProjects(paths).flatMap((summary) => {
    try {
      const entry = readCanvasMembership(
        projectDir(paths, summary.slug),
        summary.slug,
      );
      return entry.group === active.group ? [{ summary, entry }] : [];
    } catch {
      return [];
    }
  });
  const sharedOrigins = new Map<string, string>();
  for (const { entry } of members) {
    for (const [path, origin] of Object.entries(entry.origins)) {
      if (path.startsWith("library:")) sharedOrigins.set(path, origin);
    }
  }
  for (const { summary, entry } of members) {
    const register = (path: string) => {
      const id =
        entry.origins[path] ??
        sharedOrigins.get(path) ??
        (path.startsWith("library:") ? path : summary.slug + "/" + path);
      if (!sources.has(id) || path.startsWith("library:"))
        sources.set(id, {
          id,
          project: summary.slug,
          path,
          name: basename(id),
          recording: sharedOrigins.has(path) || path.startsWith("assets/canvas-sources/"),
        });
      return id;
    };
    const assets = listAssets(paths, summary.slug);
    for (const file of assets) {
      if (
        file.path.startsWith("assets/") &&
        (file.kind === "video" || file.kind === "audio")
      )
        register(file.path);
    }
    const state = readProjectState(paths, summary.slug);
    const used = new Set<string>();
    let poster: { project: string; path: string; seconds: number } | undefined;
    for (const track of state.layers?.tracks ?? []) {
      if (track.kind !== "video" && track.kind !== "audio") continue;
      for (const item of track.clips) {
        if (!("src" in item) || !/^(assets\/|library:)/.test(item.src))
          continue;
        used.add(register(item.src));
        if (!poster && track.kind === "video")
          poster = {
            project: summary.slug,
            path: item.src,
            seconds: (item.trimStart ?? 0) / (summary.fps ?? 30),
          };
      }
    }
    if (!poster) {
      const render = assets.filter(file => file.kind === "video" && file.path.startsWith("renders/"))
        .sort((a,b) => b.updatedAt - a.updatedAt)[0];
      if (render) poster = { project: summary.slug, path: render.path, seconds: 1 };
    }
    const sourceOnly = Boolean(
      entry.workspace &&
      state.layers &&
      state.layers.tracks.every((track) => track.clips.length === 0),
    );
    cuts.push({
      slug: summary.slug,
      title: summary.name,
      clip: entry.clip,
      version: entry.version,
      sourceOnly,
      size: state.project?.variants[state.project.defaultVariant],
      seconds: (summary.durationInFrames ?? 0) / (summary.fps ?? 30),
      sources: [...used],
      poster,
      created: summary.createdAt ?? 0,
    });
  }
  return {
    group: active.group,
    sources: [...sources.values()],
    cuts: cuts.sort((a, b) => a.created - b.created),
  };
}

async function copyTree(from: string, to: string) {
  if (!existsSync(from)) return;
  await mkdir(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name),
      dst = join(to, entry.name);
    if (entry.isDirectory()) await copyTree(src, dst);
    else if (entry.isFile())
      await copyFile(src, dst, constants.COPYFILE_FICLONE);
    else throw new StudioError("Cannot copy a linked asset or scene.");
  }
}

const publishing = new Map<string, Promise<void>>();

// Ten simultaneous clips from one long recording need only one media copy.
async function publishMedia(src: string, dest: string) {
  await mkdir(dirname(dest), { recursive: true });
  const tmp = dest + "." + randomUUID() + ".tmp";
  try {
    await copyFile(src, tmp, constants.COPYFILE_FICLONE);
    renameSync(tmp, dest);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function shareMedia(
  paths: WorkspacePaths,
  source: ReturnType<typeof readCanvas>["sources"][number],
) {
  if (source.path.startsWith("library:")) {
    const file = safeJoin(paths.library, source.path.slice(8));
    if (!existsSync(file) || !statSync(file).isFile())
      throw new StudioError("The source recording is missing from the library.");
    return source.path;
  }
  const src = safeJoin(projectDir(paths, source.project), source.path);
  const stat = statSync(src);
  const rel =
    "canvas/" +
    hashText(JSON.stringify([source.id, stat.size, stat.mtimeMs])) +
    "/" +
    basename(src);
  const dest = safeJoin(paths.library, rel);
  if (!existsSync(dest)) {
    let transfer = publishing.get(dest);
    if (!transfer) {
      transfer = publishMedia(src, dest).finally(() => publishing.delete(dest));
      publishing.set(dest, transfer);
    }
    await transfer;
  }
  return "library:" + rel;
}

export async function createCut(paths: WorkspacePaths, input: unknown) {
  const { project, name, kind, segments, reuseAssets } = cutInput.parse(input);
  const slug = assertSlug(project);
  const state = readProjectState(paths, slug);
  if (!state.project || !state.layers)
    throw new StudioError("Fix the active timeline before creating a clip.");
  const base = readCanvasMembership(state.dir, slug);
  if (!existsSync(safeJoin(state.dir, ".studio/canvas.json"))) {
    base.group = randomUUID();
    mkdirSync(safeJoin(state.dir, ".studio"), { recursive: true });
    atomicWrite(
      safeJoin(state.dir, ".studio/canvas.json"),
      JSON.stringify(base),
    );
  }
  const version = kind === "version";
  if (version && segments.length)
    throw new StudioError("Create the version first, then edit its timeline.");
  const canvas = readCanvas(paths, slug);
  const target = slugify(name) + "-" + randomUUID().slice(0, 8);
  const stage = mkdtempSync(join(paths.projects, ".cut-"));
  try {
    for (const dir of ["assets", "scenes", "renders", ".studio"])
      mkdirSync(join(stage, dir));
    const origins: Record<string, string> = {};
    const tracks = new Map<
      string,
      { id: string; kind: string; name: string; clips: object[] }
    >();
    let frames = 0;
    for (const segment of segments) {
      const source = canvas.sources.find((s) => s.id === segment.source);
      if (!source)
        throw new StudioError("Source does not belong to this canvas.");
      const src = await shareMedia(paths, source);
      origins[src] = source.id;
      const type = mediaKind(source.path);
      if (type !== "video" && type !== "audio")
        throw new StudioError("Choose a video or audio recording.");
      const track = tracks.get(type) ?? {
        id: type,
        kind: type,
        name: type === "audio" ? "Audio" : "Video",
        clips: [],
      };
      const fps = state.project.fps,
        trimStart = Math.round(segment.start * fps);
      const duration = Math.max(1, Math.round(segment.end * fps) - trimStart);
      if (
        !Number.isSafeInteger(trimStart) ||
        !Number.isSafeInteger(frames + duration)
      )
        throw new StudioError("Source time is too large.");
      track.clips.push({
        id: randomUUID(),
        name: source.name,
        src,
        trimStart,
        from: frames,
        duration,
      });
      tracks.set(type, track);
      frames += duration;
    }
    if (version) {
      for (const dir of ["assets", "scenes"])
        await copyTree(safeJoin(state.dir, dir), join(stage, dir));
      Object.assign(origins, base.origins);
      for (const asset of listAssets(paths, slug))
        origins[asset.path] ??= slug + "/" + asset.path;
    }
    if (!version && reuseAssets) {
      await copyTree(safeJoin(state.dir, "assets"), join(stage, "assets"));
      for (const asset of listAssets(paths, slug)) {
        if (asset.path.startsWith("assets/")) origins[asset.path] = base.origins[asset.path] ?? slug + "/" + asset.path;
      }
    }
    const metadata = {
      ...state.project,
      name: version ? state.project.name : name,
      durationInFrames: version
        ? state.project.durationInFrames
        : frames || state.project.fps * 15,
    };
    if (!version && !reuseAssets) {
      const localFiles = metadata.fonts.flatMap((font) =>
        typeof font === "string" ? [] : [font.src],
      );
      if (metadata.grade?.lut) localFiles.push(metadata.grade.lut);
      for (const path of new Set(
        localFiles.filter((path) => path.startsWith("assets/")),
      )) {
        const destination = safeJoin(stage, path);
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(
          safeJoin(state.dir, path),
          destination,
          constants.COPYFILE_FICLONE,
        );
      }
    }
    const layers = version
      ? state.layersRaw
      : { version: 1, tracks: [...tracks.values()], markers: [] };
    atomicWrite(join(stage, "project.json"), JSON.stringify(metadata, null, 2));
    atomicWrite(join(stage, "layers.json"), JSON.stringify(layers, null, 2));
    atomicWrite(join(stage, "notes.md"), "# " + name + "\n");
    atomicWrite(
      join(stage, ".studio/canvas.json"),
      JSON.stringify({
        group: base.group,
        clip: version ? base.clip : target,
        version: version ? name : "Original",
        origins,
      }),
    );
    if (version) {
      const latest = readProjectState(paths, slug);
      if (
        state.projectHash !== latest.projectHash ||
        state.layersHash !== latest.layersHash
      ) {
        throw new StudioError(
          "The cut changed during the copy. Create the version again.",
          "conflict",
        );
      }
    }
    renameSync(stage, projectDir(paths, target));
    return { slug: target, dir: projectDir(paths, target) };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
