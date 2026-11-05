import { spawn } from "node:child_process";
import { existsSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { projectDir, StudioError } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

// The default app for anything else may run it (.command, .bat, .lnk, .desktop, .html, .svg).
const OPENABLE = /\.(mp4|m4v|mov|webm|mkv|avi|wav|mp3|m4a|aac|ogg|opus|flac|png|jpe?g|webp|gif|avif)$/i;

/** A file inside a project's renders/ or assets/ folder, as an absolute path. */
export function projectFile(paths: WorkspacePaths, slug: string, rel: string) {
  if (!/^(renders|assets)(\/|$)/.test(rel)) throw new StudioError("Only files in renders/ or assets/ can be opened.");
  const root = resolve(projectDir(paths, slug));
  const full = resolve(root, rel);
  const inside = ["renders", "assets"].some((sub) => full === join(root, sub) || full.startsWith(join(root, sub) + sep));
  if (!inside) throw new StudioError("That path is outside the project's renders/ and assets/.");
  if (!existsSync(full)) throw new StudioError(`${rel} doesn't exist (moved or deleted?).`);
  return full;
}

function launch(command: string, args: string[], verbatim = false) {
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    // This launches a user-facing window, not a background helper. SW_HIDE
    // creates invisible Explorer windows even though spawning succeeds.
    windowsHide: false,
    windowsVerbatimArguments: verbatim,
  });
  return new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}

/** Show the file in Explorer / Finder (selected), or open its folder on Linux. */
export function revealFile(full: string) {
  // A folder opens as itself, except a macOS bundle (Evil.app), which `open` would launch.
  const target = realpathSync(full);
  if (statSync(target).isDirectory() && !(process.platform === "darwin" && extname(target))) return openWithDefaultApp(target);
  if (process.platform === "win32") return launch("explorer.exe", [`/select,"${full}"`], true);
  if (process.platform === "darwin") return launch("open", ["-R", full]);
  return launch("xdg-open", [dirname(full)]);
}

/** Open a media file with the system's default app (the video player for an MP4). */
export function openFile(full: string) {
  if (!OPENABLE.test(full)) throw new StudioError("Only video, audio and image files can be opened.");
  const target = realpathSync(full);
  if (!OPENABLE.test(target) || !statSync(target).isFile())
    throw new StudioError("Only video, audio and image files can be opened.");
  return openWithDefaultApp(target);
}

function openWithDefaultApp(full: string) {
  if (process.platform === "win32") return launch("explorer.exe", [full]);
  if (process.platform === "darwin") return launch("open", [full]);
  return launch("xdg-open", [full]);
}

/** Open an editor web link without weakening the media-only file opener. */
export function openWebUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new StudioError("Only HTTP or HTTPS links without credentials can be opened.");
  return openWithDefaultApp(url.href);
}
