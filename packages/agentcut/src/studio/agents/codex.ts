import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MODEL_ID, type AgentAdapter, type AgentEvent, type AgentModel, type AgentParser, type AgentRun } from "./types.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * A TOML string for a `-c key=value` override. Literal strings ('…') need no escaping, so Windows
 * paths pass through untouched; anything with a quote or newline falls back to a basic string.
 */
function tomlString(value: string) {
  return value.includes("'") || /[\r\n]/.test(value) ? JSON.stringify(value) : `'${value}'`;
}

/** Codex runs shell commands through a wrapper (`powershell.exe -Command "…"`, `bash -lc '…'`): show the inner command. */
export function innerCommand(command: string) {
  const match = /^(?:"[^"]*?(?:powershell|pwsh|bash|zsh|sh|cmd)(?:\.exe)?"|\S*?(?:powershell|pwsh|bash|zsh|sh|cmd)(?:\.exe)?)\s+(?:-NoProfile\s+)?(?:-Command|-lc|-c|\/c)\s+(["']?)([\s\S]*)\1$/i.exec(
    command.trim(),
  );
  return (match ? match[2] : command).trim();
}

/**
 * `codex exec --json` → AgentEvents. Codex reports work as items (`item.started` /
 * `item.completed`); text arrives whole, one agent_message at a time.
 */
class CodexParser implements AgentParser {
  private readonly started = new Set<string>();

  line(line: string): AgentEvent[] {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return [];
    }
    switch (event.type) {
      case "thread.started":
        return typeof event.thread_id === "string" ? [{ type: "session", sessionId: event.thread_id }] : [];
      case "item.started":
        return this.item(asRecord(event.item), false);
      case "item.completed":
        return this.item(asRecord(event.item), true);
      case "turn.completed":
        return [{ type: "result", ok: true }];
      case "turn.failed": {
        const message = asRecord(event.error).message;
        return [{ type: "result", ok: false, error: typeof message === "string" && message ? message.slice(0, 1200) : "Codex stopped." }];
      }
      case "error":
        return typeof event.message === "string" ? [{ type: "error", message: event.message }] : [];
      default:
        return [];
    }
  }

  /** A tool step: start it once, end it when the item completes (some items only arrive completed). */
  private tool(id: string, name: string, input: Record<string, unknown>, done: boolean, end: () => AgentEvent): AgentEvent[] {
    const out: AgentEvent[] = [];
    if (!this.started.has(id)) {
      this.started.add(id);
      out.push({ type: "tool-start", id, name, input });
    }
    if (done) out.push(end());
    return out;
  }

  private item(item: Record<string, unknown>, done: boolean): AgentEvent[] {
    const id = typeof item.id === "string" ? item.id : null;
    if (!id) return [];
    const ok = item.status === undefined || item.status === "completed";
    switch (item.type) {
      case "agent_message":
        return done && typeof item.text === "string" && item.text ? [{ type: "message-start" }, { type: "text", text: item.text }] : [];
      case "reasoning":
        return [];
      case "command_execution": {
        const command = innerCommand(String(item.command ?? ""));
        return this.tool(id, "Bash", { command }, done, () => {
          const exit = typeof item.exit_code === "number" ? item.exit_code : null;
          const success = ok && (exit === null || exit === 0);
          const output = typeof item.aggregated_output === "string" ? item.aggregated_output.trim() : "";
          return {
            type: "tool-end",
            id,
            ok: success,
            error: success ? undefined : (output.slice(-400) || `Exited with code ${exit ?? "?"}.`),
          };
        });
      }
      case "file_change": {
        // One step per file, so the chat lists every file that changed.
        const changes = (Array.isArray(item.changes) ? item.changes : []).map((change) => asRecord(change));
        return changes.flatMap((change, index) =>
          this.tool(
            `${id}:${index}`,
            change.kind === "add" ? "Write" : "Edit",
            { file_path: change.path },
            done,
            () => ({ type: "tool-end", id: `${id}:${index}`, ok }),
          ),
        );
      }
      case "mcp_tool_call": {
        const name = `mcp__${String(item.server ?? "mcp")}__${String(item.tool ?? "tool")}`;
        return this.tool(id, name, asRecord(item.arguments), done, () => {
          const error = asRecord(item.error).message;
          const failed = !ok || typeof error === "string";
          const result = asRecord(item.result);
          // A tool that reports its own failure puts the reason in its text content.
          const resultText = (Array.isArray(result.content) ? result.content : [])
            .map((block) => asRecord(block).text)
            .filter((text): text is string => typeof text === "string")
            .join("\n");
          return {
            type: "tool-end",
            id,
            ok: !failed,
            content: result.content ?? item.result,
            error: failed ? (typeof error === "string" ? error : resultText || "The tool call failed.").slice(0, 400) : undefined,
          };
        });
      }
      case "web_search":
        return this.tool(id, "WebSearch", { query: item.query }, done, () => ({ type: "tool-end", id, ok }));
      case "todo_list":
        return this.tool(id, "TodoWrite", {}, done, () => ({ type: "tool-end", id, ok }));
      case "error":
        return typeof item.message === "string" ? [{ type: "error", message: item.message }] : [];
      default:
        return this.tool(id, String(item.type ?? "step"), {}, done, () => ({ type: "tool-end", id, ok }));
    }
  }
}

/** The models Codex lists in its own picker (its cached model list) and the default from config.toml. */
function codexModels() {
  const home = process.env.CODEX_HOME || join(homedir(), ".codex");
  let models: AgentModel[] = [];
  try {
    const cache = JSON.parse(readFileSync(join(home, "models_cache.json"), "utf8")) as {
      models?: { slug?: unknown; display_name?: unknown; visibility?: unknown; priority?: unknown }[];
    };
    models = (cache.models ?? [])
      .filter((m) => m.visibility === "list" && typeof m.slug === "string" && MODEL_ID.test(m.slug))
      .sort((a, b) => Number(a.priority ?? 99) - Number(b.priority ?? 99))
      .map((m) => ({ id: m.slug as string, label: typeof m.display_name === "string" ? m.display_name : (m.slug as string) }));
  } catch {
    // No cache yet (Codex never ran): only the default.
  }
  let defaultModel: string | null = null;
  try {
    defaultModel = /^\s*model\s*=\s*"([^"]+)"/m.exec(readFileSync(join(home, "config.toml"), "utf8"))?.[1] ?? null;
  } catch {
    // No config: Codex picks.
  }
  return { models, defaultModel };
}

export const codexAgent: AgentAdapter = {
  id: "codex",
  name: "Codex",
  product: "Codex CLI",
  command: "codex",
  envOverride: "AGENTCUT_CODEX",
  installUrl: "https://developers.openai.com/codex/cli",
  loginCommand: "codex",
  instructionsFile: "AGENTS.md",
  skillsDir: ".agents/skills",
  imageHint: "it is attached to this message; to look at it again, open it with view_image",

  buildArgs(run: AgentRun) {
    const server = `mcp_servers.${run.mcp.name}`;
    const env = Object.entries(run.mcp.env)
      .map(([key, value]) => `${key} = ${tomlString(value)}`)
      .join(", ");
    // `codex exec resume` takes no -s/-C flags, so every setting goes in as a -c override.
    const config = [
      `sandbox_mode='workspace-write'`,
      // Codex always has a shell; --no-bash keeps it in the sandbox without network access.
      `sandbox_workspace_write.network_access=${run.allowShell}`,
      `approval_policy='never'`,
      `web_search='live'`,
      `${server}.command=${tomlString(run.mcp.command)}`,
      `${server}.args=[${run.mcp.args.map(tomlString).join(", ")}]`,
      `${server}.env={ ${env} }`,
      // Headless runs can't answer approval prompts: the studio's own tools are pre-approved.
      `${server}.default_tools_approval_mode='approve'`,
      `${server}.startup_timeout_sec=60`,
      // Exports, renders and transcriptions take minutes.
      `${server}.tool_timeout_sec=1800`,
    ];
    if (run.model) config.push(`model=${tomlString(run.model)}`);
    const args = ["exec"];
    if (run.sessionId) args.push("resume");
    args.push("--json", "--skip-git-repo-check");
    for (const entry of config) args.push("-c", entry);
    for (const image of run.images) args.push(`--image=${image}`);
    // Codex reads other folders already (the sandbox only limits writes).
    if (run.sessionId) args.push(run.sessionId);
    args.push("-");
    return args;
  },

  listModels: codexModels,

  createParser: () => new CodexParser(),

  isLostSession: (stderr) => /no (conversation|session|thread|rollout)[^\n]*found|(session|thread|rollout)[^\n]*not found/i.test(stderr),
};
