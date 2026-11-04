import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, realpathSync, renameSync, statSync, unlinkSync } from "node:fs";
import { basename, join, sep } from "node:path";
import { ensureFfmpeg } from "./references.js";
import { projectDir, uniquePath } from "./projects.js";
import { exportResolution } from "./export-resolution.js";
import { exportQuality } from "./export-quality.js";
import { saveRenderDuration } from "./render-metadata.js";
import type { WorkspacePaths } from "./workspace.js";
import { debugLog } from "../log.js";

let busy = false;
let activeSlug: string | null = null;
let child: ChildProcess | null = null;
let cancelled = false;
export const resizeRunning = () => busy;
export const resizeSlug = () => activeSlug;
export function cancelResize() { cancelled = true; child?.kill(); }

export function resizeSource(paths: WorkspacePaths, slug: string, path: string) {
  if (!/^renders\/[^/\\:\x00]+\.mp4$/i.test(path)) throw new Error("Choose an MP4 in this project's renders folder.");
  const project = realpathSync(projectDir(paths, slug));
  if (!project.startsWith(realpathSync(paths.projects) + sep)) throw new Error("The project must be inside the workspace.");
  const root = realpathSync(join(project, "renders"));
  const source = realpathSync(join(project, path));
  if (!root.startsWith(project + sep) || !source.startsWith(root + sep) || !statSync(source).isFile()) {
    throw new Error("The video must be inside this project's renders folder.");
  }
  return source;
}

export async function resizeRender(paths: WorkspacePaths, slug: string, path: string, resolutionValue: unknown, qualityValue: unknown) {
  if (busy) throw new Error("A smaller copy is already being created. Wait for it to finish.");
  const resolution = exportResolution(resolutionValue);
  if (resolution === "project") throw new Error("Choose 1080p or 720p for the smaller copy.");
  const quality = exportQuality(qualityValue);
  const source = resizeSource(paths, slug, path);
  const originalBytes = statSync(source).size;
  busy = true;
  activeSlug = slug;
  cancelled = false;
  const started = performance.now();
  const workDir = join(paths.internal, "resize");
  const temp = join(workDir, `${randomUUID()}.mp4`);
  try {
    mkdirSync(workDir, { recursive: true });
    const ffmpeg = await ensureFfmpeg();
    if (cancelled) throw new Error("Resize cancelled.");
    const limit = resolution === "1080p" ? 1080 : 720;
    const factor = `min(1,${limit}/min(iw,ih))`;
    const filter = `scale=w='max(2,trunc(iw*${factor}/2)*2)':h='max(2,trunc(ih*${factor}/2)*2)'`;
    await new Promise<void>((resolve, reject) => {
      child = spawn(ffmpeg, ["-hide_banner", "-nostdin", "-loglevel", "error", "-n", "-i", source,
        "-map", "0:v:0", "-map", "0:a?", "-vf", filter, "-c:v", "libx264", "-crf", quality === "maximum" ? "18" : "20",
        "-preset", "slow", "-threads", "4", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", temp],
      { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
      let error = "";
      child.stderr?.on("data", (chunk) => { error = (error + String(chunk)).slice(-2000); });
      const timeout = setTimeout(() => { cancelled = true; child?.kill(); }, 2 * 60 * 60_000);
      child.on("error", (err) => { clearTimeout(timeout); reject(err); });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (cancelled) reject(new Error("Resize stopped. The original video is unchanged."));
        else if (code !== 0) reject(new Error(`Could not resize the video: ${error}`));
        else resolve();
      });
    });
    const bytes = statSync(temp).size;
    if (!bytes || bytes >= originalBytes) throw new Error("These settings did not make a smaller file. Try 720p or High quality, smaller file. The original is unchanged.");
    const output = uniquePath(join(projectDir(paths, slug), "renders", `${basename(source).replace(/\.mp4$/i, "")}-${resolution}-smaller.mp4`));
    renameSync(temp, output);
    try {
      saveRenderDuration(output, performance.now() - started);
    } catch (error) {
      // Timing is optional; the completed video must still be returned.
      debugLog(`Could not save resize time: ${String(error)}`);
    }
    return { path: `renders/${basename(output)}`, bytes, originalBytes };
  } finally {
    try { unlinkSync(temp); } catch {}
    child = null;
    busy = false;
    activeSlug = null;
  }
}
