import type { AgentAdapter, AgentEvent, AgentParser, AgentRun } from "./types.js";

/**
 * A Claude Code permission path for a folder and everything in it: `//` anchors at the filesystem
 * root, and Windows paths are matched in POSIX form (C:\\code\\app → //c/code/app/**).
 */
export function absoluteRule(dir: string) {
  let path = dir.replace(/\\/g, "/").replace(/\/+$/, "");
  const drive = /^([A-Za-z]):(\/|$)/.exec(path);
  if (drive) path = `/${drive[1].toLowerCase()}${path.slice(2)}`;
  return `/${path.startsWith("/") ? path : `/${path}`}/**`;
}

const BASE_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "Glob",
  "Grep",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "Skill",
  "mcp__agentcut",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** `claude -p --output-format stream-json` → AgentEvents. */
class ClaudeParser implements AgentParser {
  /** Assistant messages whose text already arrived as deltas (skip their full blocks). */
  private readonly streamed = new Set<string>();

  line(line: string): AgentEvent[] {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return [];
    }
    switch (event.type) {
      case "system":
        return event.subtype === "init" && typeof event.session_id === "string"
          ? [{ type: "session", sessionId: event.session_id }]
          : [];
      case "stream_event": {
        const inner = asRecord(event.event);
        if (inner.type === "message_start") {
          const id = asRecord(inner.message).id;
          if (typeof id === "string") this.streamed.add(id);
          return [{ type: "message-start" }];
        }
        if (inner.type === "content_block_delta") {
          const delta = asRecord(inner.delta);
          if (delta.type === "text_delta" && typeof delta.text === "string") return [{ type: "text", text: delta.text }];
        }
        return [];
      }
      case "assistant": {
        const message = asRecord(event.message);
        const id = typeof message.id === "string" ? message.id : null;
        const out: AgentEvent[] = [];
        for (const blockRaw of Array.isArray(message.content) ? message.content : []) {
          const block = asRecord(blockRaw);
          if (block.type === "text" && typeof block.text === "string" && !(id && this.streamed.has(id))) {
            out.push({ type: "text", text: block.text });
          }
          if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
            // MultiEdit is an Edit as far as the chat is concerned.
            const name = block.name === "MultiEdit" ? "Edit" : block.name;
            out.push({ type: "tool-start", id: block.id, name, input: asRecord(block.input) });
          }
        }
        return out;
      }
      case "user": {
        const message = asRecord(event.message);
        const out: AgentEvent[] = [];
        for (const blockRaw of Array.isArray(message.content) ? message.content : []) {
          const block = asRecord(blockRaw);
          if (block.type !== "tool_result" || typeof block.tool_use_id !== "string") continue;
          const ok = !block.is_error;
          out.push({
            type: "tool-end",
            id: block.tool_use_id,
            ok,
            content: block.content,
            error: ok ? undefined : (typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "")).slice(0, 400),
          });
        }
        return out;
      }
      case "result": {
        const ok = !event.is_error && (typeof event.subtype !== "string" || event.subtype === "success");
        const result = typeof event.result === "string" ? event.result : undefined;
        return [
          {
            type: "result",
            ok,
            text: ok ? result : undefined,
            error: ok ? undefined : result ? result.slice(0, 1200) : `Claude stopped (${String(event.subtype)}).`,
            costUsd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : undefined,
            durationMs: typeof event.duration_ms === "number" ? event.duration_ms : undefined,
            sessionId: typeof event.session_id === "string" ? event.session_id : undefined,
          },
        ];
      }
      default:
        return [];
    }
  }
}

export const claudeAgent: AgentAdapter = {
  id: "claude",
  name: "Claude",
  product: "Claude Code",
  command: "claude",
  envOverride: "AGENTCUT_CLAUDE",
  installUrl: "https://claude.com/claude-code",
  loginCommand: "claude",
  instructionsFile: "CLAUDE.md",
  skillsDir: ".claude/skills",
  imageHint: "open it with Read",

  buildArgs(run: AgentRun) {
    const tools = run.allowShell ? [...BASE_TOOLS, "Bash"] : BASE_TOOLS;
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      tools.join(","),
      "--mcp-config",
      run.mcpConfigPath,
    ];
    for (const dir of run.readDirs) args.push("--add-dir", dir);
    // Extra folders are for reading (e.g. the user's app repo): block Claude's file-edit tools there.
    if (run.readDirs.length) {
      args.push("--disallowedTools", ...run.readDirs.map((dir) => `Edit(${absoluteRule(dir)})`));
    }
    if (run.model) args.push("--model", run.model);
    if (run.sessionId) args.push("--resume", run.sessionId);
    // Images reach Claude through the prompt (it opens them with Read).
    return args;
  },

  // Aliases: each always means the latest model of that family.
  listModels: () => ({
    models: [
      { id: "fable", label: "Fable" },
      { id: "opus", label: "Opus" },
      { id: "sonnet", label: "Sonnet" },
      { id: "haiku", label: "Haiku" },
    ],
    defaultModel: null,
  }),

  createParser: () => new ClaudeParser(),

  isLostSession: (stderr) => /no conversation found|session.*not found/i.test(stderr),
};
