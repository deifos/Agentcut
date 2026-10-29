import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { availableParallelism } from "node:os";
import type { ChildProcess } from "node:child_process";
import { debugLog } from "../log.js";
import { projectDir, StudioError, uniquePath } from "./projects.js";
import { killTree, resolveCommand, spawnCommand } from "./proc.js";
import type { StudioProject } from "./schema.js";
import { missingManagedDependencies, type WorkspacePaths } from "./workspace.js";
import { renderLines, renderPolicy, renderProgress } from "./render-policy.js";
import { availableRenderMemory } from "./render-memory.js";
import { saveRenderDuration } from "./render-metadata.js";

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
/** Set once the headless shell has crashed: later renders go straight to full Chrome. */
let fullChrome = false;

// How a headless-shell crash shows up: the tab dies outright, or (when another tab's crash takes the
// asset server down) a frame times out waiting on an image or video that never arrives.
const BROWSER_CRASH = /Page crashed|Target closed|Fatal error in|got no response|delayRender\(\).*not cleared/i;

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
    const recordLine = (line: string) => {
      tail = (tail + line + "\n").slice(-6000);
      onLine(line);
    };
    const stdout = renderLines(recordLine);
    const stderr = renderLines(recordLine);
    proc.stdout?.on("data", stdout.write);
    proc.stderr?.on("data", stderr.write);
    proc.on("error", (error) => {
      tail += `\n${error.message}`;
    });
    proc.on("close", (code) => {
      stdout.end();
      stderr.end();
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
  const exportStarted = performance.now();
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
    const render = async (extra: string[]) => {
      const memory = await availableRenderMemory();
      if (cancelled) return { code: null, tail: "" };
      const freeBytes = memory.availableBytes;
      const policy = renderPolicy(freeBytes, availableParallelism(), process.env.AGENTCUT_RENDER_CONCURRENCY);
      const started = Date.now();
      let lastAdvance = started;
      let lastLog = started;
      let state = { stage: "preparing", progress: 0, message: `Starting ${policy.workers} render workers` };
      let lastCount = "";
      debugLog(`local render start ${slug}/${variant} ${JSON.stringify({ ...policy, freeBytes, memory, extra })}`);
      options.onProgress(state);
      const heartbeat = setInterval(() => {
        const idle = Math.floor((Date.now() - lastAdvance) / 1000);
        if (idle < 30) return;
        const message = `${state.message} · No frame progress for ${idle}s`;
        options.onProgress({ ...state, message });
        debugLog(`local render waiting ${slug}/${variant}: ${message}`);
      }, 15_000);
      try {
        const result = await run("npx", [...args,
          `--concurrency=${policy.workers}`,
          `--media-cache-size-in-bytes=${policy.cacheBytes}`,
          `--offthreadvideo-cache-size-in-bytes=${policy.cacheBytes}`,
          ...extra,
        ], root, (line) => {
          const progress = renderProgress(line);
          if (progress) {
            const count = `${progress.stage}:${progress.done}`;
            if (count !== lastCount) lastAdvance = Date.now();
            lastCount = count;
            state = {
              stage: progress.stage,
              progress: Math.max(state.progress, progress.progress),
              message: `${progress.done}/${progress.total} frames · ${Math.floor((performance.now() - exportStarted) / 60_000)}m ${Math.floor((performance.now() - exportStarted) / 1000) % 60}s elapsed · ${policy.workers} workers`,
            };
            options.onProgress(state);
            if (Date.now() - lastLog >= 15_000) {
              debugLog(`local render ${slug}/${variant}: ${line}`);
              lastLog = Date.now();
            }
          } else if (/Encoded|Encoding|Stitch/i.test(line)) {
            state = { stage: "encoding", progress: state.progress, message: line.slice(0, 200) };
            options.onProgress(state);
          }
        });
        debugLog(`local render exit ${slug}/${variant} code=${result.code} elapsedMs=${Date.now() - started}\n${result.tail}`);
        return result;
      } finally {
        clearInterval(heartbeat);
      }
    };
    // The lightweight headless shell can crash partway through some projects (seen with @remotion/media
    // videos); the full Chrome for Testing build renders them. Downloaded by Remotion on first use.
    const FULL_CHROME = ["--chrome-mode=chrome-for-testing"];
    let result = await render(fullChrome ? FULL_CHROME : []);
    if (!cancelled && !fullChrome && result.code !== 0 && BROWSER_CRASH.test(result.tail)) {
      debugLog(`local render crashed in headless shell; retrying with chrome-for-testing`);
      fullChrome = true;
      rmSync(outPath, { force: true });
      options.onProgress({ stage: "preparing", message: "The renderer crashed; retrying with full Chrome…" });
      result = await render(FULL_CHROME);
    }
    if (cancelled) throw new StudioError("Render cancelled.", "cancelled");
    if (result.code !== 0 || !existsSync(outPath)) {
      debugLog(`local render failed ${result.tail}`);
      throw new StudioError(`Local render failed:\n${result.tail.slice(-1500)}`);
    }
    const rel = outPath.slice(projectDir(paths, slug).length + 1).split(/[\\/]/).join("/");
    const renderDurationMs = Math.round(performance.now() - exportStarted);
    try {
      saveRenderDuration(outPath, renderDurationMs);
    } catch (error) {
      // A timing record must never turn a completed video into a failed render.
      debugLog(`Could not save render time: ${String(error)}`);
    }
    options.onProgress({ stage: "done", progress: 1, path: rel });
    return { path: rel, absolutePath: outPath, renderDurationMs };
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
