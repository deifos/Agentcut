import { homedir } from "node:os";
import { join } from "node:path";
import { resolveCommand } from "../proc.js";
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

// A file name, web page or transcript can carry instructions, and the agent runs without anyone
// approving its commands. So its shell only writes to the workspace, only reaches these sites, and
// neither the shell nor Read can open logins and keys.
const SHELL_DOMAINS = ["registry.npmjs.org", "api.openverse.org", "freesound.org", "cdn.freesound.org", "upload.wikimedia.org"];

const SECRET_FOLDERS = [
  ".ssh",
  ".aws",
  ".azure",
  ".gnupg",
  ".kube",
  ".config/gh",
  ".config/gcloud",
  ".mozilla",
  ".config/google-chrome",
  ".config/BraveSoftware",
  ".config/microsoft-edge",
  "Library/Keychains",
  "Library/Cookies",
  "Library/Safari",
  "Library/Application Support/Google/Chrome",
  "Library/Application Support/BraveSoftware",
  "Library/Application Support/Microsoft Edge",
  "Library/Application Support/Firefox",
  "AppData/Local/Google/Chrome",
  "AppData/Local/BraveSoftware",
  "AppData/Local/Microsoft/Edge",
  "AppData/Roaming/Mozilla",
];
const SECRET_FILES = [
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".git-credentials",
  ".docker/config.json",
  ".claude/.credentials.json",
  ".codex/auth.json",
  ".agentcut/studio-keys.json",
  ".agentcut/transcription-keys.json",
];

/** What the agent could use to run code outside the sandbox on a later turn. */
const CONTROL_FOLDERS = [".agentcut", ".claude", ".agents", ".codex"];
const CONTROL_FILES = [".mcp.json", "CLAUDE.md", "AGENTS.md", "remotion.config.ts"];

const fileRule = (file: string) => absoluteRule(file).slice(0, -3);

/** The `--settings` file: Claude Code's OS sandbox for the shell, and the same limits on its file tools. */
export function claudeSettings(run: Pick<AgentRun, "workspace" | "readDirs" | "shellDomains">, home = homedir()) {
  const secretFolders = SECRET_FOLDERS.map((path) => join(home, path));
  const secretFiles = SECRET_FILES.map((path) => join(home, path));
  const controlFolders = CONTROL_FOLDERS.map((path) => join(run.workspace, path));
  const controlFiles = CONTROL_FILES.map((path) => join(run.workspace, path));
  return {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      filesystem: {
        denyRead: [...secretFolders, ...secretFiles],
        allowWrite: [join(home, ".npm")],
        denyWrite: [...controlFolders, ...controlFiles, ...run.readDirs],
      },
      network: { allowedDomains: [...SHELL_DOMAINS, ...run.shellDomains] },
    },
    permissions: {
      deny: [
        ...secretFolders.map((path) => `Read(${absoluteRule(path)})`),
        ...secretFiles.map((path) => `Read(${fileRule(path)})`),
        ...controlFolders.map((path) => `Edit(${absoluteRule(path)})`),
        ...controlFiles.map((path) => `Edit(${fileRule(path)})`),
      ],
    },
  };
}

/** Claude Code's sandbox runs on macOS, and on Linux with bubblewrap and socat. Elsewhere its shell is unconfined. */
export function claudeSandboxAvailable() {
  if (process.platform === "darwin") return true;
  return process.platform === "linux" && Boolean(resolveCommand("bwrap")) && Boolean(resolveCommand("socat"));
}

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

  settings: claudeSettings,

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
      "--settings",
      run.settingsPath,
    ];
    for (const dir of run.readDirs) args.push("--add-dir", dir);
    // Extra folders are for reading (e.g. the user's app repo): block Claude's file-edit tools there.
    const deniedTools = [
      ...(!run.allowShell ? ["Bash", "PowerShell", "Monitor"] : []),
      ...run.readDirs.map((dir) => `Edit(${absoluteRule(dir)})`),
    ];
    if (deniedTools.length) args.push("--disallowedTools", ...deniedTools);
    if (run.model) args.push("--model", run.model);
    if (run.effort) args.push("--effort", run.effort);
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
    efforts: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: null,
  }),

  createParser: () => new ClaudeParser(),

  isLostSession: (stderr) => /no conversation found|session.*not found/i.test(stderr),
};
