import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";

const isWindows = process.platform === "win32";

/** Resolve a command on PATH (`where` on Windows, `which` elsewhere). */
export function resolveCommand(command: string): string | null {
  try {
    const result = spawnSync(isWindows ? "where" : "which", [command], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 8_000,
    });
    if (result.status !== 0) return null;
    const lines = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!isWindows) return lines[0] ?? null;
    // Prefer a real executable, then .cmd shims.
    return (
      lines.find((line) => /\.exe$/i.test(line)) ??
      lines.find((line) => /\.(cmd|bat)$/i.test(line)) ??
      lines[0] ??
      null
    );
  } catch {
    return null;
  }
}

function quoteForCmd(arg: string) {
  // Arguments are never user text (prompts go through stdin), but paths can
  // contain spaces. cmd.exe: wrap in quotes, double any embedded quotes.
  if (arg === "") return '""';
  if (!/[\s"&|<>^()%!]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/**
 * Spawn a command without a shell when possible. Windows .cmd/.bat shims need
 * cmd.exe, so their arguments are quoted explicitly.
 */
export function spawnCommand(
  resolved: string,
  args: string[],
  options: SpawnOptions,
): ChildProcess {
  if (isWindows && /\.(cmd|bat)$/i.test(resolved)) {
    const line = [quoteForCmd(resolved), ...args.map(quoteForCmd)].join(" ");
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${line}"`], {
      ...options,
      windowsVerbatimArguments: true,
      windowsHide: true,
    });
  }
  return spawn(resolved, args, { ...options, shell: false, windowsHide: true });
}

/** Kill a process and its children. */
export function killTree(child: ChildProcess) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

export const DETACH_FOR_GROUP_KILL = !isWindows;
