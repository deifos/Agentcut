import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import { debugLog } from "../log.js";
import { projectDir, StudioError, uniquePath } from "./projects.js";
import { killTree, resolveCommand, spawnCommand } from "./proc.js";
import type { StudioProject } from "./schema.js";
import { missingManagedDependencies, type WorkspacePaths } from "./workspace.js";

export interface LocalRenderOptions {
  paths: WorkspacePaths;
  slug: string;
  variant: string;
  entryPath: string;
  port: number;
  masterGain: number;
  project: StudioProject;
  layers: unknown;
  onProgress(data: Record<string, unknown>): void;
}

let running: Promise<unknown> | null = null;
/** The process the current local render is waiting on (npm install or remotion render). */
let child: ChildProcess | null = null;
let cancelled = false;

/** Stop the running local render, if any. Returns whether there was one. */
export function cancelLocalRender() {
  if (!running) return false;
  cancelled = true;
  if (child) killTree(child);
  return true;
}

function run(
  command: string,
  args: string[],
  cwd: string,
  onLine: (line: string) => void,
): Promise<{ code: number | null; tail: string }> {
  const resolved = resolveCommand(command);
  if (!resolved) return Promise.reject(new StudioError(`"${command}" is not on PATH.`));
  return new Promise((resolve) => {
    if (cancelled) return resolve({ code: null, tail: "" });
    // Own process group on macOS/Linux so cancel can stop npx and everything it started.
    const proc = spawnCommand(resolved, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    child = proc;
    let tail = "";
    const onData = (chunk: Buffer) => {
      // No terminal colors in what the page shows.
      const text = chunk.toString("utf8").replace(/\u001b\[[0-9;]*m/g, "");
      tail = (tail + text).slice(-6000);
      for (const line of text.split(/\r?\n|\r/)) if (line.trim()) onLine(line.trim());
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("error", (error) => {
      tail += `\n${error.message}`;
    });
    proc.on("close", (code) => {
      if (child === proc) child = null;
      resolve({ code, tail });
    });
  });
}

function linkOrCopy(from: string, to: string) {
  mkdirSync(join(to, ".."), { recursive: true });
  try {
    linkSync(from, to);
  } catch {
    copyFileSync(from, to);
  }
}

function mirrorDir(from: string, to: string) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) mirrorDir(source, target);
    else if (entry.isFile()) linkOrCopy(source, target);
  }
}

const REMOTION_CONFIG = `// Managed by agentcut.
import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      "agentcut/components$": path.join(process.cwd(), ".agentcut", "components", "index.ts"),
      "agentcut$": path.join(process.cwd(), ".agentcut", "runtime", "helpers.tsx"),
    },
  },
}));
`;

/**
 * Render with Remotion's classic renderer on this computer (fallback for
 * compositions the browser export can't draw). Installs the workspace's
 * dependencies on first use.
 */
export async function runLocalRender(options: LocalRenderOptions) {
  if (running) throw new StudioError("A local render is already running.", "busy");
  cancelled = false;
  let outPath = "";
  const work = (async () => {
    const { paths, slug, variant } = options;
    const root = paths.root;
    const missing = missingManagedDependencies(root);
    if (missing.length > 0) {
      const first = !existsSync(join(root, "node_modules", "@remotion", "cli", "package.json"));
      options.onProgress({
        stage: "installing",
        message: first
          ? "Installing Remotion in the workspace (first local render only)…"
          : `Installing ${missing.join(", ")}…`,
      });
      const install = await run("npm", ["install", "--no-audit", "--no-fund"], root, (line) =>
        options.onProgress({ stage: "installing", message: line.slice(0, 200) }),
      );
      if (cancelled) throw new StudioError("Render cancelled.", "cancelled");
      if (install.code !== 0) throw new StudioError(`npm install failed:\n${install.tail.slice(-1500)}`);
    }
    writeFileSync(join(root, "remotion.config.ts"), REMOTION_CONFIG);

    // Public dir = this project's assets + the shared library (hard links, no copies when possible).
    const publicDir = join(paths.render, `public-${slug}`);
    rmSync(publicDir, { recursive: true, force: true });
    mirrorDir(join(projectDir(paths, slug), "assets"), join(publicDir, "assets"));
    mirrorDir(paths.library, join(publicDir, "library"));

    const propsPath = join(paths.render, `${slug}.props.json`);
    writeFileSync(
      propsPath,
      JSON.stringify({
        project: options.project,
        layers: options.layers,
        variant,
        assetBase: "static:",
        libraryBase: "static:library",
        masterGain: options.masterGain,
      }),
    );

    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
    const rendersDir = join(projectDir(paths, slug), "renders");
    mkdirSync(rendersDir, { recursive: true });
    outPath = uniquePath(join(rendersDir, `${slug}-${variant}-${stamp}-local.mp4`));
    const args = [
      "remotion",
      "render",
      options.entryPath,
      `studio-${variant}`,
      outPath,
      `--props=${propsPath}`,
      `--public-dir=${publicDir}`,
      "--codec=h264",
      "--audio-codec=aac",
    ];
    if (process.platform === "win32") args.push("--gl=angle");
    options.onProgress({ stage: "rendering", progress: 0 });
    const result = await run("npx", args, root, (line) => {
      const match = /Rendered\s+(\d+)\/(\d+)/i.exec(line) ?? /(\d+)\/(\d+)\s+frames/i.exec(line);
      if (match) {
        options.onProgress({ stage: "rendering", progress: Number(match[1]) / Math.max(1, Number(match[2])) });
      } else if (/Encoded|Stitch/i.test(line)) {
        options.onProgress({ stage: "encoding", message: line.slice(0, 200) });
      }
    });
    if (cancelled) throw new StudioError("Render cancelled.", "cancelled");
    if (result.code !== 0 || !existsSync(outPath)) {
      debugLog(`local render failed ${result.tail}`);
      throw new StudioError(`Local render failed:\n${result.tail.slice(-1500)}`);
    }
    const rel = outPath.slice(projectDir(paths, slug).length + 1).split(/[\\/]/).join("/");
    options.onProgress({ stage: "done", path: rel });
    return { path: rel, absolutePath: outPath };
  })();
  running = work;
  try {
    return await work;
  } catch (error) {
    if (cancelled) {
      // Don't leave a half-written video in renders/.
      if (outPath) rmSync(outPath, { force: true });
      options.onProgress({ stage: "cancelled" });
    } else {
      options.onProgress({ stage: "error", message: error instanceof Error ? error.message : String(error) });
    }
    throw error;
  } finally {
    running = null;
    child = null;
  }
}
