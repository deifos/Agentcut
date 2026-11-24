import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ensureFfmpeg } from "./references.js";
import { resizeSource } from "./resize-render.js";
import { assertSlug, safeJoin, StudioError } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

/** Limits shared with the community catalog (lib/community-styles.ts). */
export const DEMO_MAX_SECONDS = 10;
const DEMO_MAX_BYTES = 4_000_000;
const POSTER_MAX_BYTES = 400_000;

const demoInput = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  project: z.string(),
  path: z.string(),
  start: z.number().min(0).max(24 * 60 * 60),
  duration: z.number().min(2).max(DEMO_MAX_SECONDS),
});

let busy = false;

function run(ffmpeg: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", ...args], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let error = "";
    child.stderr?.on("data", (chunk) => { error = (error + String(chunk)).slice(-2000); });
    const timeout = setTimeout(() => child.kill(), 5 * 60_000);
    child.on("error", (err) => { clearTimeout(timeout); reject(err); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new StudioError(`Could not make the demo clip: ${error.trim() || `ffmpeg exited with ${code}`}`));
    });
  });
}

/**
 * Make a style's demo: a short, small, metadata-free clip of one of the project's renders, plus a
 * poster frame, saved as demo.mp4 and poster.jpg next to the style's rules. The render itself is
 * only read. Replaces the style's previous demo (those two files are always generated).
 */
export async function makeEditingStyleDemo(paths: WorkspacePaths, input: unknown) {
  const { id, project, path, start, duration } = demoInput.parse(input);
  const slug = assertSlug(project);
  const source = resizeSource(paths, slug, path);
  const dir = safeJoin(safeJoin(paths.library, "editing-styles"), id);
  let folder;
  try {
    folder = lstatSync(dir);
  } catch {
    throw new StudioError("That saved editing style no longer exists. Refresh the list and try again.", "not_found");
  }
  if (folder.isSymbolicLink() || !folder.isDirectory())
    throw new StudioError("Only saved editing style folders can have a demo.", "bad_path");
  if (busy) throw new StudioError("A demo is already being made. Wait for it to finish.", "busy");
  busy = true;
  const work = join(paths.internal, "style-demos");
  const token = randomUUID();
  const demoTemp = join(work, `${token}.mp4`);
  const posterTemp = join(work, `${token}.jpg`);
  try {
    mkdirSync(work, { recursive: true });
    const ffmpeg = await ensureFfmpeg();
    // Phone-sized: the long side at most 960 px. Retry smaller if a busy clip is still too big.
    const attempts = [
      { long: 960, crf: "27" },
      { long: 720, crf: "31" },
    ];
    let bytes = 0;
    for (const attempt of attempts) {
      const factor = `min(1,${attempt.long}/max(iw,ih))`;
      await run(ffmpeg, [
        "-ss", String(start), "-t", String(duration), "-i", source,
        "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-map_chapters", "-1",
        "-vf", `scale=w='max(2,trunc(iw*${factor}/2)*2)':h='max(2,trunc(ih*${factor}/2)*2)',fps=30`,
        "-c:v", "libx264", "-crf", attempt.crf, "-preset", "medium", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", demoTemp,
      ]);
      bytes = statSync(demoTemp).size;
      if (bytes > 0 && bytes <= DEMO_MAX_BYTES) break;
    }
    if (!bytes) throw new StudioError("The demo came out empty. Check that the start time is inside the video.");
    if (bytes > DEMO_MAX_BYTES) throw new StudioError("The demo is still over 4 MB. Choose a shorter length.");
    // The poster: a frame a second in (past any opening flash), at most 540 px wide.
    // A start past the end of the render still gives a small, frameless file; no poster frame
    // comes out of that, so say what went wrong instead of passing on ffmpeg's error.
    const empty = () => new StudioError("The demo came out empty. Check that the start time is inside the video.");
    try {
      await run(ffmpeg, [
        "-ss", String(Math.min(1, duration / 2)), "-i", demoTemp, "-frames:v", "1",
        "-vf", "scale=w='min(540,iw)':h=-2", "-q:v", "4", posterTemp,
      ]);
    } catch {
      throw empty();
    }
    let posterBytes = 0;
    try {
      posterBytes = statSync(posterTemp).size;
    } catch {
      throw empty();
    }
    if (!posterBytes) throw empty();
    if (posterBytes > POSTER_MAX_BYTES) throw new StudioError("Could not make a small enough poster frame.");
    renameSync(demoTemp, join(dir, "demo.mp4"));
    renameSync(posterTemp, join(dir, "poster.jpg"));
    return { id, demo: `editing-styles/${id}/demo.mp4`, poster: `editing-styles/${id}/poster.jpg`, bytes, posterBytes };
  } finally {
    for (const file of [demoTemp, posterTemp]) try { unlinkSync(file); } catch {}
    busy = false;
  }
}
