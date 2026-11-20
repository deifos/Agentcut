import { randomUUID } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { projectDir, readProjectState, safeJoin, StudioError, writeLayers, writeProjectFile } from "./projects.js";
import { comparePictures, measureChanges, measureColors, measureInk, readRawFrames, THUMB, tileSize } from "./reference-measure.js";
import { ensureFfmpeg, MEDIA_INPUT_ONLY, probeSize, run } from "./references.js";
import type { WorkspacePaths } from "./workspace.js";

// Style Spy tools that answer with numbers: when a region changes, how big its text is, its
// colours, and how far the edit is from the reference.

const referencePath = z.string().regex(/^assets\/references\/[a-zA-Z0-9_-]{1,80}\/[^/:\\]+\.(mp4|webm|mov|m4v)$/i);
const regionShape = z.object({ x: z.number().min(0), y: z.number().min(0), width: z.number().positive(), height: z.number().positive() })
  .refine((r) => r.x + r.width <= 1 && r.y + r.height <= 1, "Region exceeds the frame.");
type Region = z.infer<typeof regionShape>;

const INK_SIDE = 256;

const measurement = z.object({
  kind: z.enum(["changes", "ink", "colors"]),
  startFrame: z.number().int().min(0).max(10_000_000),
  // For changes: how many frames to read.
  count: z.number().int().min(2).max(900).default(120),
  // Fractions of the displayed frame, measured from its top left.
  region: regionShape.optional(),
}).strict();

export const referenceMeasurement = z.object({
  path: referencePath,
  // One measurement (kind, startFrame, count, region), or several in `batch`.
  kind: measurement.shape.kind.optional(),
  startFrame: measurement.shape.startFrame.optional(),
  count: z.number().int().min(2).max(900).optional(),
  region: regionShape.optional(),
  batch: z.array(measurement).min(1).max(24).optional(),
});

const crop = (region?: Region) => (region ? [`crop=w=max(2\\,iw*${region.width}):h=max(2\\,ih*${region.height}):x=iw*${region.x}:y=ih*${region.y}`] : []);
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export async function measureReference(paths: WorkspacePaths, slug: string, input: unknown) {
  const { path, batch, ...single } = referenceMeasurement.parse(input);
  const video = safeJoin(projectDir(paths, slug), path);
  const ffmpeg = await ensureFfmpeg();
  if (!batch) return measureOne(ffmpeg, video, measurement.parse(single));
  if (single.kind !== undefined || single.startFrame !== undefined) throw new StudioError("Pass either one measurement or batch, not both.", "bad_input");
  // One at a time: each reads the video from its start, and they are short.
  const results: unknown[] = [];
  for (const item of batch) results.push(await measureOne(ffmpeg, video, item).catch((error: unknown) => ({ ...item, error: error instanceof Error ? error.message : String(error) })));
  return { results };
}

async function measureOne(ffmpeg: string, video: string, { kind, startFrame, count, region }: z.infer<typeof measurement>) {
  const read = async (frames: number, scale: string, format: "gray" | "rgb24", bytes: number) => {
    const out: Uint8Array[] = [];
    await readRawFrames(
      ffmpeg,
      ["-hide_banner", "-loglevel", "error", "-nostats", ...MEDIA_INPUT_ONLY, "-i", video, "-map", "0:v:0", "-an", "-vf",
        ["setpts=PTS-STARTPTS", `trim=start_frame=${startFrame}:end_frame=${startFrame + frames}`, ...crop(region), scale].join(","),
        "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", format, "pipe:1"],
      bytes,
      (pixels) => out.push(Uint8Array.from(pixels)),
      3 * 60_000,
    ).catch(() => undefined);
    if (!out.length) throw new StudioError("Could not read that frame range. Check the video and its frame count.");
    return out;
  };
  if (kind === "changes") {
    const frames = await read(count, `scale=${THUMB}:${THUMB}:flags=area`, "gray", THUMB * THUMB);
    return { kind, startFrame, framesRead: frames.length, changes: measureChanges(frames, startFrame) };
  }
  const [pixels] = await read(1, `scale=${INK_SIDE}:${INK_SIDE}:flags=area`, "rgb24", INK_SIDE * INK_SIDE * 3);
  if (kind === "colors") return { kind, frame: startFrame, colors: measureColors(pixels) };
  const ink = measureInk(pixels, INK_SIDE, INK_SIDE);
  if (!ink) return { kind, frame: startFrame, ink: null, note: "Nothing stands out from its surroundings in this region." };
  const area = region ?? { x: 0, y: 0, width: 1, height: 1 };
  const size = await probeSize(ffmpeg, video).catch(() => null);
  const box = { x: round3(area.x + ink.box.x * area.width), y: round3(area.y + ink.box.y * area.height), width: round3(ink.box.width * area.width), height: round3(ink.box.height * area.height) };
  const lines = ink.lines.map((line) => ({ y: round3(area.y + line.y * area.height), height: round3(line.height * area.height) }));
  return {
    kind,
    frame: startFrame,
    ink: {
      ...ink,
      box,
      lines,
      // The same in the reference's pixels, to set sizes and positions from.
      ...(size ? {
        pixels: { x: Math.round(box.x * size.width), y: Math.round(box.y * size.height), width: Math.round(box.width * size.width), height: Math.round(box.height * size.height) },
        linePixels: lines.map((line) => ({ y: Math.round(line.y * size.height), height: Math.round(line.height * size.height) })),
      } : {}),
    },
  };
}

export const referenceComparison = z.object({
  path: referencePath,
  pairs: z.array(z.object({ referenceFrame: z.number().int().min(0).max(10_000_000), projectFrame: z.number().int().min(0).max(10_000_000) })).min(1).max(12),
});

const captures = z.array(z.object({ frame: z.number().int(), dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/) })).min(1).max(12);

/**
 * Reference frames beside the edit's frames on one image, and how far apart each pair is.
 * `captured` holds the edit's frames as data URLs.
 */
export async function compareReference(paths: WorkspacePaths, slug: string, input: unknown, captured: unknown) {
  const { path, pairs } = referenceComparison.parse(input);
  const shots = captures.parse(captured);
  const root = projectDir(paths, slug);
  const video = safeJoin(root, path);
  const ffmpeg = await ensureFfmpeg();
  const rel = `.studio/scratch/style-spy/${randomUUID()}.jpg`;
  const output = safeJoin(root, rel);
  const temp = join(dirname(output), `compare-${randomUUID()}`);
  mkdirSync(temp, { recursive: true });
  try {
    const size = await probeSize(ffmpeg, video).catch(() => null);
    const tile = tileSize(size ? size.width / size.height : 16 / 9, pairs.length * 2, 4);
    const fit = `scale=${tile.width}:${tile.height}:force_original_aspect_ratio=decrease,pad=${tile.width}:${tile.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    const small = `scale=${THUMB}:${THUMB}:flags=area,format=gray`;
    const wanted = [...new Set(pairs.map((pair) => pair.referenceFrame))].sort((a, b) => a - b);
    const result = await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostats", ...MEDIA_INPUT_ONLY, "-i", video, "-an",
      "-filter_complex", `[0:v:0]select='${wanted.map((frame) => `eq(n,${frame})`).join("+")}',split[a][b];[a]${fit}[x];[b]${small}[y]`,
      "-map", "[x]", "-fps_mode", "passthrough", "-q:v", "3", join(temp, "r%03d.jpg"),
      "-map", "[y]", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "gray", join(temp, "r.gray")], { timeoutMs: 5 * 60_000 });
    const gray = existsSync(join(temp, "r.gray")) ? readFileSync(join(temp, "r.gray")) : Buffer.alloc(0);
    const bytes = THUMB * THUMB;
    if (result.code !== 0 || gray.length < wanted.length * bytes) throw new StudioError("Could not read those reference frames. Check the frame numbers against timing.frameCount.");
    const captureGray = new Map<number, Uint8Array>();
    for (const [index, shot] of shots.entries()) {
      const [, type, data] = /^data:image\/(png|jpeg|webp);base64,(.*)$/s.exec(shot.dataUrl)!;
      const source = join(temp, `c${index}.${type === "jpeg" ? "jpg" : type}`);
      writeFileSync(source, Buffer.from(data, "base64"));
      const made = await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", source,
        "-filter_complex", `[0:v:0]split[a][b];[a]${fit}[x];[b]${small}[y]`,
        "-map", "[x]", "-frames:v", "1", "-q:v", "3", join(temp, `p${shot.frame}.jpg`),
        "-map", "[y]", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", join(temp, `p${shot.frame}.gray`)], { timeoutMs: 60_000 });
      if (made.code !== 0) throw new StudioError(`Could not read the captured frame ${shot.frame}.`);
      captureGray.set(shot.frame, readFileSync(join(temp, `p${shot.frame}.gray`)));
    }
    const scored = pairs.map((pair, index) => {
      const mine = captureGray.get(pair.projectFrame);
      if (!mine) throw new StudioError(`Frame ${pair.projectFrame} was not captured.`);
      const at = wanted.indexOf(pair.referenceFrame);
      copyFileSync(join(temp, `r${String(at + 1).padStart(3, "0")}.jpg`), join(temp, `t${String(index * 2 + 1).padStart(3, "0")}.jpg`));
      copyFileSync(join(temp, `p${pair.projectFrame}.jpg`), join(temp, `t${String(index * 2 + 2).padStart(3, "0")}.jpg`));
      return { ...pair, ...comparePictures(gray.subarray(at * bytes, (at + 1) * bytes), mine) };
    });
    const sheet = await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", join(temp, "t%03d.jpg"),
      "-vf", `tile=4x${tile.rows}:padding=4:color=black`, "-frames:v", "1", "-q:v", "3", "-y", output], { timeoutMs: 60_000 });
    if (sheet.code !== 0 || !existsSync(output)) throw new StudioError("Could not build the comparison image.");
    return {
      sheet: rel,
      layout: "Reading order: each pair is the reference frame, then the edit's frame. Two pairs a row.",
      // 0 is identical, 100 is opposite. Only meaningful when the edit shows the same content (a clone).
      pairs: scored,
      dataUrl: `data:image/jpeg;base64,${readFileSync(output).toString("base64")}`,
    };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export const cloneSetupInput = z.object({ path: referencePath });

/**
 * Set this project up as a clone of a reference: its size, a whole-number frame rate, its length,
 * its sound, and a marker per shot. The edit that was there is backed up first.
 */
export function cloneSetup(paths: WorkspacePaths, slug: string, input: unknown) {
  const { path } = cloneSetupInput.parse(input);
  const root = projectDir(paths, slug);
  let reference: { width?: number; height?: number; duration?: number; timing?: { frameRate?: string | null; frameCount?: number } | null; shots?: { id: string; startFrame: number; endFrameExclusive: number }[] };
  try {
    reference = JSON.parse(readFileSync(safeJoin(root, `${dirname(path)}/reference.json`), "utf8"));
  } catch {
    throw new StudioError("This reference has no reference.json. Call agentcut_import_reference with its path first.", "bad_input");
  }
  const { width, height, duration } = reference;
  const [top, bottom] = (reference.timing?.frameRate ?? "").split("/").map(Number);
  if (!width || !height || !duration || !(top > 0 && bottom > 0)) {
    throw new StudioError("This reference was imported before it could be measured. Call agentcut_import_reference with its path, then try again.", "bad_input");
  }
  const sourceRate = top / bottom;
  const fps = Math.max(1, Math.min(120, Math.round(sourceRate)));
  const toProject = (frame: number) => Math.round((frame / sourceRate) * fps);
  const durationInFrames = Math.max(1, Math.round(duration * fps));
  const state = readProjectState(paths, slug);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `.studio/style-spy-backups/${stamp}`;
  mkdirSync(safeJoin(root, backup), { recursive: true });
  for (const name of ["project.json", "layers.json", "scenes"]) {
    if (existsSync(join(root, name))) cpSync(join(root, name), join(safeJoin(root, backup), name), { recursive: true });
  }
  const variant = width >= height ? "wide" : "mobile";
  const even = (value: number) => Math.max(16, Math.round(value / 2) * 2);
  const previous = (state.projectRaw && typeof state.projectRaw === "object" ? state.projectRaw : {}) as Record<string, unknown>;
  writeProjectFile(paths, slug, {
    ...previous,
    version: 1,
    name: previous.name ?? slug,
    fps,
    durationInFrames,
    background: "#000000",
    variants: { [variant]: { width: even(width), height: even(height) } },
    defaultVariant: variant,
  });
  const shots = (reference.shots ?? []).map((shot) => ({ id: shot.id, from: toProject(shot.startFrame), duration: Math.max(1, toProject(shot.endFrameExclusive) - toProject(shot.startFrame)) }));
  writeLayers(paths, slug, {
    version: 1,
    tracks: [{
      id: "original-sound",
      name: "Original sound",
      kind: "audio",
      clips: [{ id: "original-sound", name: "Original soundtrack", from: 0, duration: durationInFrames, src: path, volume: 1, trimStart: 0, role: "music" }],
    }],
    markers: shots.map((shot) => ({ id: `shot-${shot.id}`, frame: shot.from, label: `Shot ${shot.id.slice(1)}`, kind: "section" })),
  }, null);
  const last = Math.max(0, (reference.timing?.frameCount ?? 1) - 1);
  return {
    variant,
    width: even(width),
    height: even(height),
    fps,
    durationInFrames,
    backup,
    // Source frame numbers are project frame numbers when the rates agree to the last frame.
    frames: toProject(last) === last
      ? "Project frames equal the reference's frame numbers."
      : `Project frame = round(reference frame / ${Math.round(sourceRate * 1000) / 1000} * ${fps}). The last reference frame ${last} is project frame ${toProject(last)}.`,
    shots,
    // A picture or footage cut from the original: box and crop are the same region, in fractions of the frame.
    cutout: { from: 0, duration: 30, src: path, trimStart: 0, muted: true, box: { x: 0.4, y: 0.35, width: 0.2, height: 0.3 }, framing: { crop: { x: 0.4, y: 0.35, width: 0.2, height: 0.3 } } },
    next: "Add scene tracks above the sound for what you rebuild, and video tracks of cutout clips for pictures and footage. Tracks listed first draw on top. Never put the whole reference on the timeline: look at it with agentcut_inspect_reference and agentcut_compare_reference.",
  };
}
