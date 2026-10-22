import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { projectDir, StudioError } from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";

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
    windowsHide: false,
    windowsVerbatimArguments: verbatim,
  });
  child.on("error", () => undefined);
  child.unref();
}

/** Show the file in Explorer / Finder (selected), or open its folder on Linux. */
export function revealFile(full: string) {
  // A folder opens as itself.
  if (statSync(full).isDirectory()) return openFile(full);
  if (process.platform === "win32") launch("explorer.exe", [`/select,"${full}"`], true);
  else if (process.platform === "darwin") launch("open", ["-R", full]);
  else launch("xdg-open", [dirname(full)]);
}

/** Open the file with the system's default app (the video player for an MP4). */
export function openFile(full: string) {
  if (process.platform === "win32") launch(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `start "" "${full}"`], true);
  else if (process.platform === "darwin") launch("open", [full]);
  else launch("xdg-open", [full]);
}
