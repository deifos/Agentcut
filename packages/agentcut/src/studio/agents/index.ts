import { spawnSync } from "node:child_process";
import { resolveCommand } from "../proc.js";
import { claudeAgent } from "./claude.js";
import { codexAgent } from "./codex.js";
import type { AgentAdapter, AgentInfo } from "./types.js";

export type { AgentAdapter, AgentEvent, AgentInfo, AgentParser, AgentRun, McpServerSpec } from "./types.js";

/** Every agent the studio chat can drive, in order of preference (the first one found is the default). */
export const AGENTS: readonly AgentAdapter[] = [claudeAgent, codexAgent];

export function getAgent(id: string): AgentAdapter | undefined {
  return AGENTS.find((agent) => agent.id === id);
}

/** Find the agent's CLI and its version. */
export function detectAgent(agent: AgentAdapter): AgentInfo {
  const base = {
    id: agent.id,
    name: agent.name,
    product: agent.product,
    installUrl: agent.installUrl,
    loginCommand: agent.loginCommand,
  };
  const path = process.env[agent.envOverride] || resolveCommand(agent.command);
  if (!path) {
    return {
      ...base,
      found: false,
      path: null,
      version: null,
      error: `${agent.product} (\`${agent.command}\`) is not on PATH. Install it from ${agent.installUrl} and log in once.`,
    };
  }
  try {
    const result = /\.(cmd|bat)$/i.test(path)
      ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `"${path}" --version`], {
          encoding: "utf8",
          timeout: 15_000,
          windowsHide: true,
          windowsVerbatimArguments: true,
        })
      : spawnSync(path, ["--version"], { encoding: "utf8", timeout: 15_000, windowsHide: true });
    // "2.1.3 (Claude Code)", "codex-cli 0.163.0": the first thing that looks like a version.
    const version = /\d+\.\d+[\w.-]*/.exec(result.stdout || "")?.[0] ?? null;
    const found = result.status === 0;
    return { ...base, found, path, version, error: found ? undefined : (result.stderr || "").slice(0, 400) };
  } catch (error) {
    return { ...base, found: false, path, version: null, error: (error as Error).message };
  }
}

export function detectAgents(): AgentInfo[] {
  return AGENTS.map(detectAgent);
}
