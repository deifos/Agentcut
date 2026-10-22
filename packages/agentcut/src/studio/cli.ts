#!/usr/bin/env node
// `npx -y agentcut` — the local half of Agentcut.
import { BridgeTakeoverError, setBridgeExtension, startOwnedBridge } from "../bridge.js";
import { getConfig, PACKAGE_VERSION } from "../config.js";
import { debugLog } from "../log.js";
import { AGENTS, getAgent } from "./agents/index.js";
import { DEFAULT_ALLOWED_ORIGINS, STUDIO_APP_URL, StudioHost } from "./host.js";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defaultWorkspaceDir, scaffoldWorkspace, type WorkspacePaths } from "./workspace.js";

interface CliOptions {
  dir: string;
  allowBash: boolean;
  origins: string[];
  addDirs: string[];
  removeDirs: string[];
  agent: string | undefined;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: process.env.AGENTCUT_DIR || defaultWorkspaceDir(),
    allowBash: true,
    origins: [],
    addDirs: [],
    removeDirs: [],
    agent: process.env.AGENTCUT_AGENT || undefined,
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === "--dir") options.dir = next();
    else if (arg.startsWith("--dir=")) options.dir = arg.slice(6);
    else if (arg === "--port") process.env.AGENTCUT_PORT = next();
    else if (arg.startsWith("--port=")) process.env.AGENTCUT_PORT = arg.slice(7);
    else if (arg === "--origin") options.origins.push(next());
    else if (arg.startsWith("--origin=")) options.origins.push(arg.slice(9));
    else if (arg === "--no-bash") options.allowBash = false;
    else if (arg === "--add-dir") options.addDirs.push(next());
    else if (arg.startsWith("--add-dir=")) options.addDirs.push(arg.slice(10));
    else if (arg === "--remove-dir") options.removeDirs.push(next());
    else if (arg.startsWith("--remove-dir=")) options.removeDirs.push(arg.slice(13));
    else if (arg === "--agent") options.agent = next();
    else if (arg.startsWith("--agent=")) options.agent = arg.slice(8);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--version" || arg === "-v") options.version = true;
    else throw new Error(`Unknown option ${arg}`);
  }
  const fromEnv = (process.env.AGENTCUT_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  options.origins = [...options.origins, ...fromEnv].map((origin) => origin.replace(/\/+$/, ""));
  if (options.agent && !getAgent(options.agent)) {
    throw new Error(`Unknown agent "${options.agent}". Choose one of: ${AGENTS.map((agent) => agent.id).join(", ")}`);
  }
  return options;
}

const HELP = `Agentcut ${PACKAGE_VERSION}

Runs the local side of Agentcut: the bridge on 127.0.0.1:32118,
your video workspace, live bundles for the preview, and a coding agent for chat
(${AGENTS.map((agent) => agent.product).join(" or ")}: whichever you have; switch in the chat).

Usage: npx -y agentcut [options]

  --dir <path>      Workspace folder (default: ~/Agentcut)
  --port <n>        Bridge port (default 32118)
  --origin <url>    Also allow this web origin (repeatable)
  --agent <id>      Agent the chat starts with: ${AGENTS.map((agent) => agent.id).join(", ")} (default: the first one installed)
  --add-dir <path>  Let the agent read another folder, e.g. your app's repo (it may not change it;
                    remembered for the next runs)
  --remove-dir <p>  Forget a folder added with --add-dir
  --no-bash         Don't let the agent run shell commands (Codex always has a sandboxed shell:
                    this turns off its network access instead)
  -h, --help        Show this help
`;

/** Folders the agent may read besides the workspace, kept in .agentcut/settings.json. */
function resolveReadFolders(paths: WorkspacePaths, add: string[], remove: string[]) {
  const file = join(paths.internal, "settings.json");
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {}
  const saved = Array.isArray(settings.readFolders) ? settings.readFolders.filter((d): d is string => typeof d === "string") : [];
  const removed = new Set(remove.map((d) => resolve(d).toLowerCase()));
  const folders: string[] = [];
  for (const dir of [...saved, ...add.map((d) => resolve(d))]) {
    if (removed.has(dir.toLowerCase()) || folders.some((f) => f.toLowerCase() === dir.toLowerCase())) continue;
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      process.stderr.write(`  Skipping ${dir}: not a folder.\n`);
      continue;
    }
    folders.push(dir);
  }
  if (add.length || remove.length) {
    writeFileSync(file, `${JSON.stringify({ ...settings, readFolders: folders }, null, 2)}\n`);
  }
  return folders;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (options.version) {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return;
  }

  const { paths, created } = scaffoldWorkspace(options.dir);
  const readFolders = resolveReadFolders(paths, options.addDirs, options.removeDirs);
  const { port } = getConfig();
  const host = new StudioHost({
    paths,
    port,
    allowBash: options.allowBash,
    addDirs: readFolders,
    agent: options.agent,
    allowedOrigins: [...DEFAULT_ALLOWED_ORIGINS, ...options.origins],
  });
  setBridgeExtension(host);

  try {
    await startOwnedBridge();
  } catch (error) {
    const reason = error instanceof BridgeTakeoverError ? error.reason : (error as NodeJS.ErrnoException).code;
    const messages: Record<string, string> = {
      studio_running: `Agentcut is already running (port ${port}). Use that window, or close it first.\n`,
      old_mcp:
        `Port ${port} is used by an older Agentcut MCP server inside an agent session.\n` +
        `Restart that session (it picks up the new version) or close it, then start Agentcut again.\n`,
      unknown_owner: `Port ${port} is used by another program. Close it and start Agentcut again (the Agentcut page always uses this port).\n`,
      EADDRINUSE: `Port ${port} is still busy. Wait a moment and start Agentcut again.\n`,
    };
    const message = typeof reason === "string" ? messages[reason] : undefined;
    if (message) {
      process.stderr.write(message);
      process.exit(1);
    }
    throw error;
  }
  host.start();
  const agents = await host.getAgents();
  const defaultAgent = await host.defaultAgent();

  const lines = [
    "",
    `  Agentcut ${PACKAGE_VERSION}`,
    "",
    `  Workspace   ${paths.root}${created ? "  (new)" : ""}`,
    `  Bridge      http://127.0.0.1:${port}`,
    ...agents.map(
      (agent) =>
        `  ${agent.product.padEnd(11)} ${
          agent.found
            ? `found (${agent.version ?? "unknown version"})${agent.id === defaultAgent ? ", default" : ""}`
            : `not found (install from ${agent.installUrl} and log in)`
        }`,
    ),
    ...(agents.some((agent) => agent.found)
      ? []
      : ["  No coding agent found: install one of the above, log in once, then start Agentcut again."]),
    `  Shell tools ${options.allowBash ? "allowed for the agent" : "off (--no-bash)"}`,
    `  Extra folders ${readFolders.length ? readFolders.join(", ") : "none configured (add a folder with --add-dir <path>)"}`,
    "",
    `  Open ${STUDIO_APP_URL}/studio in Chrome.`,
    "  Keep this window open while you work. Ctrl+C to stop.",
    "",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);

  const shutdown = () => {
    host.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  debugLog(`studio fatal ${error instanceof Error ? error.stack : String(error)}`);
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
