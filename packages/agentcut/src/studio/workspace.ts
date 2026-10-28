import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCommand, spawnCommand } from "./proc.js";
import { getConfig, PACKAGE_VERSION } from "../config.js";
import { AGENTS, type McpServerSpec } from "./agents/index.js";

export const REMOTION_VERSION = "4.0.536";
export const REACT_VERSION = "19.2.8";

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const TEMPLATE_DIR = join(packageRoot, "template");
export const MCP_ENTRY = join(packageRoot, "dist", "index.js");

export interface WorkspacePaths {
  root: string;
  projects: string;
  library: string;
  internal: string;
  runtime: string;
  render: string;
  mcpConfig: string;
}

export const SKILL_NAME = "agentcut";

export function defaultWorkspaceDir() {
  return join(homedir(), "Agentcut");
}

export function workspacePaths(root: string): WorkspacePaths {
  const absolute = resolve(root);
  return {
    root: absolute,
    projects: join(absolute, "projects"),
    library: join(absolute, "library"),
    internal: join(absolute, ".agentcut"),
    runtime: join(absolute, ".agentcut", "runtime"),
    render: join(absolute, ".agentcut", "render"),
    mcpConfig: join(absolute, ".agentcut", "mcp.json"),
  };
}

/** The agentcut MCP server every agent in the workspace connects to. */
export function studioMcpServer(paths: WorkspacePaths): McpServerSpec {
  return {
    name: "agentcut",
    command: process.execPath,
    args: [MCP_ENTRY],
    env: {
      AGENTCUT_WORKSPACE: paths.root,
      AGENTCUT_PORT: String(getConfig().port),
    },
  };
}

function copyDir(from: string, to: string) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else copyFileSync(source, target);
  }
}

function writeIfChanged(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  try {
    if (readFileSync(path, "utf8") === contents) return;
  } catch {}
  writeFileSync(path, contents);
}

const MANAGED_DEPENDENCIES: Record<string, string> = {
  remotion: REMOTION_VERSION,
  "@remotion/media": REMOTION_VERSION,
  "@remotion/transitions": REMOTION_VERSION,
  "@remotion/shapes": REMOTION_VERSION,
  "@remotion/paths": REMOTION_VERSION,
  "@remotion/noise": REMOTION_VERSION,
  "@remotion/light-leaks": REMOTION_VERSION,
  "@remotion/cli": REMOTION_VERSION,
  // The cinematic toolkit's 3D devices (agentcut/components) for local renders.
  three: "0.183.2",
  react: REACT_VERSION,
  "react-dom": REACT_VERSION,
};

const MANAGED_DEV_DEPENDENCIES: Record<string, string> = {
  "@types/react": "^19.2.0",
  // three ships no types; the workspace typecheck covers agentcut/components (Device3D).
  "@types/three": "0.183.1",
  typescript: "^5.8.3",
};

/**
 * Managed packages that aren't installed in the workspace (or are on another pinned version).
 * Previews and local renders install missing packages so new library dependencies arrive automatically.
 */
export function missingManagedDependencies(root: string) {
  return Object.entries(MANAGED_DEPENDENCIES)
    .filter(([name, wanted]) => {
      try {
        const installed = JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")) as { version?: string };
        return /^\d/.test(wanted) && installed.version !== wanted;
      } catch {
        return true;
      }
    })
    .map(([name]) => name);
}

const dependencyInstalls = new Map<string, Promise<void>>();

/** Share setup across project previews; failed installs can be retried on the next build. */
export async function ensurePreviewDependencies(root: string): Promise<void> {
  root = resolve(root);
  const pending = dependencyInstalls.get(root);
  if (pending) return pending;
  if (!missingManagedDependencies(root).length) return;
  const install = (async () => {
    ensurePackageJson(root);
    const npm = resolveCommand("npm");
    if (!npm) throw new Error("Preview dependency setup failed: npm is not on PATH.");
    await new Promise<void>((resolveInstall, reject) => {
      const child = spawnCommand(npm, ["install", "--no-audit", "--no-fund"], {
        cwd: root,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let tail = "";
      const capture = (chunk: Buffer) => { tail = (tail + chunk.toString()).slice(-1500); };
      child.stdout?.on("data", capture);
      child.stderr?.on("data", capture);
      child.on("error", (error) => reject(new Error(`Preview dependency setup failed: ${error.message}`)));
      child.on("close", (code) => {
        if (code === 0) resolveInstall();
        else reject(new Error(`Preview dependency setup failed (npm install). Retry opening the project.\n${tail}`));
      });
    });
    const missing = missingManagedDependencies(root);
    if (missing.length) throw new Error(`Preview dependency setup did not install: ${missing.join(", ")}. Retry opening the project.`);
  })();
  dependencyInstalls.set(root, install);
  try {
    await install;
  } finally {
    dependencyInstalls.delete(root);
  }
}

function ensurePackageJson(root: string) {
  const path = join(root, "package.json");
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {}
  const dependencies = { ...(current.dependencies as Record<string, string> | undefined) };
  const devDependencies = { ...(current.devDependencies as Record<string, string> | undefined) };
  Object.assign(dependencies, MANAGED_DEPENDENCIES);
  Object.assign(devDependencies, MANAGED_DEV_DEPENDENCIES);
  const next = {
    name: "agentcut-workspace",
    private: true,
    description: "Agentcut workspace. Remotion versions are managed by agentcut.",
    ...current,
    dependencies,
    devDependencies,
    scripts: {
      typecheck: "tsc --noEmit",
      ...(current.scripts as Record<string, string> | undefined),
    },
  };
  writeIfChanged(path, `${JSON.stringify(next, null, 2)}\n`);
}

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "Bundler",
    jsx: "react-jsx",
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    resolveJsonModule: true,
    baseUrl: ".",
    paths: {
      "agentcut": [".agentcut/runtime/helpers.tsx"],
      "agentcut/components": [".agentcut/components/index.ts"],
    },
  },
  include: ["projects/**/*.ts", "projects/**/*.tsx", ".agentcut/runtime/**/*.tsx", ".agentcut/runtime/**/*.ts", ".agentcut/components/**/*.tsx", ".agentcut/components/**/*.ts"],
};

export interface ScaffoldResult {
  paths: WorkspacePaths;
  created: boolean;
}

/** Create or refresh the workspace. Managed files are rewritten; projects are never touched. */
export function scaffoldWorkspace(root: string): ScaffoldResult {
  const paths = workspacePaths(root);
  const created = !existsSync(paths.root);
  for (const dir of [paths.root, paths.projects, paths.library, paths.internal, paths.render]) {
    mkdirSync(dir, { recursive: true });
  }

  copyDir(join(TEMPLATE_DIR, "runtime"), paths.runtime);
  // The component library: the agent reads it (and the catalog), local renders import it.
  if (existsSync(join(TEMPLATE_DIR, "components"))) {
    copyDir(join(TEMPLATE_DIR, "components"), join(paths.root, ".agentcut", "components"));
  }
  // Built-in video style presets land in the library once; after that they're the user's to edit.
  const presets = join(TEMPLATE_DIR, "presets");
  if (existsSync(presets)) {
    for (const entry of readdirSync(presets, { withFileTypes: true })) {
      const target = join(paths.library, "presets", entry.name);
      if (entry.isDirectory() && !existsSync(target)) copyDir(join(presets, entry.name), target);
    }
  }
  // Each agent reads its own instructions file and finds skills in its own folder.
  const instructions = readFileSync(join(TEMPLATE_DIR, "AGENTS.md"), "utf8");
  for (const dir of new Set(AGENTS.map((agent) => agent.skillsDir))) {
    copyDir(join(TEMPLATE_DIR, "skill"), join(paths.root, dir, SKILL_NAME));
  }
  for (const agent of AGENTS) {
    const skillPath = `${agent.skillsDir}/${SKILL_NAME}/SKILL.md`;
    writeIfChanged(join(paths.root, agent.instructionsFile), instructions.replaceAll("{{SKILL_PATH}}", skillPath));
  }
  writeIfChanged(join(paths.root, "tsconfig.json"), `${JSON.stringify(TSCONFIG, null, 2)}\n`);
  ensurePackageJson(paths.root);
  const mcp = studioMcpServer(paths);
  writeIfChanged(
    paths.mcpConfig,
    `${JSON.stringify({ mcpServers: { [mcp.name]: { command: mcp.command, args: mcp.args, env: mcp.env } } }, null, 2)}\n`,
  );
  writeIfChanged(join(paths.internal, "VERSION"), `${PACKAGE_VERSION}\n`);
  writeIfChanged(
    join(paths.internal, "README.md"),
    "Managed by agentcut. Files here are rewritten every time the studio starts.\n",
  );

  const projectEntries = readdirSync(paths.projects).filter((name) => !name.startsWith("."));
  if (projectEntries.length === 0) {
    copyDir(join(TEMPLATE_DIR, "starter"), join(paths.projects, "welcome"));
  }
  return { paths, created };
}

export function isDirectory(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
