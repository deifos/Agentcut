/**
 * A coding agent CLI the studio chat can drive (Claude Code, Codex, …).
 *
 * The chat engine (../chat.ts) owns everything agent-independent: history, the queue, cancel,
 * hand-offs between agents, the pictures shown in the chat. An adapter only knows how to start
 * its CLI for one turn and how to turn the CLI's output into `AgentEvent`s.
 *
 * Adding an agent: write one file that exports an `AgentAdapter` and list it in ./index.ts.
 */

/** What the page shows about an agent (also printed by the CLI). */
export interface AgentInfo {
  id: string;
  /** Short name used in the chat copy: "Claude is working". */
  name: string;
  /** The product to install: "Claude Code". */
  product: string;
  found: boolean;
  path: string | null;
  version: string | null;
  error?: string;
  installUrl: string;
  /** What to run once in a terminal to sign in, e.g. `claude`. */
  loginCommand: string;
  /** Models the page offers; leaving the model out uses the CLI's own default. */
  models?: AgentModel[];
  /** The model the CLI uses by default, when known (shown as "Default (…)"). */
  defaultModel?: string | null;
  /** Thinking levels for the default model (a model may list its own). */
  efforts?: string[];
  /** The CLI's default thinking level, when known. */
  defaultEffort?: string | null;
}

export interface AgentModel {
  /** What the CLI takes, e.g. `opus` or `gpt-6.1-sol`. */
  id: string;
  label: string;
  /** Thinking levels this model takes, when they differ from the agent's. */
  efforts?: string[];
}

/** Model names the CLIs accept: letters, digits and . _ : - [ ] (never passed through a shell unchecked). */
export const MODEL_ID = /^[A-Za-z0-9][\w.:\-[\]]{0,79}$/;
/** Thinking levels: one plain word (low, medium, high, xhigh, max…). */
export const EFFORT_ID = /^[a-z]{2,12}$/;

/** The MCP server the agent connects to (the agentcut tools). */
export interface McpServerSpec {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** Everything an adapter needs to start one turn. */
export interface AgentRun {
  /** The full prompt (studio context + the user's text). Always sent on stdin, never in argv. */
  prompt: string;
  /** Resume this session (an id the adapter reported earlier), or start a new one. */
  sessionId: string | null;
  /** Absolute paths of images attached to this message (frames, pointed-at pictures). */
  images: string[];
  /** The workspace folder (cwd of the process). */
  workspace: string;
  mcp: McpServerSpec;
  /** The same server as a Claude-style `{ mcpServers }` JSON file, for CLIs that take one. */
  mcpConfigPath: string;
  /** Let the agent run shell commands (`--no-bash` turns it off where the CLI allows it). */
  allowShell: boolean;
  /** Extra folders the agent may read but must not change. */
  readDirs: string[];
  /** The model to use (checked against MODEL_ID), or null for the CLI's default. */
  model: string | null;
  /** The thinking level (checked against EFFORT_ID), or null for the CLI's default. */
  effort: string | null;
}

/**
 * Tool calls are reported in one vocabulary so the chat (summaries, icons, "files changed",
 * pictures) works the same for every agent:
 *
 * - `Read`, `Write`, `Edit` with `input.file_path`
 * - `Glob`, `Grep` with `input.pattern`
 * - `Bash` with `input.command` (and optional `input.description`)
 * - `WebSearch` with `input.query`, `WebFetch` with `input.url`
 * - `TodoWrite`, `Skill` (`input.skill`)
 * - MCP tools as `mcp__<server>__<tool>` with the tool's arguments
 *
 * Anything else is shown by its name.
 */
export type AgentEvent =
  /** The CLI's session id: saved so the next turn resumes it. */
  | { type: "session"; sessionId: string }
  /** A new assistant message begins (the chat separates it from the previous text). */
  | { type: "message-start" }
  /** Assistant text: streamed deltas or whole blocks, never both for the same text. */
  | { type: "text"; text: string }
  | { type: "tool-start"; id: string; name: string; input: Record<string, unknown> }
  /** `content` is the raw tool result (the chat looks in it for captured frames). */
  | { type: "tool-end"; id: string; ok: boolean; error?: string; content?: unknown }
  /** A problem the CLI reported; used as the turn's error if it ends without a result. */
  | { type: "error"; message: string }
  /** The turn finished. */
  | { type: "result"; ok: boolean; error?: string; text?: string; costUsd?: number; durationMs?: number; sessionId?: string };

/** Turns the CLI's stdout lines into events. One parser per turn (it may keep state). */
export interface AgentParser {
  line(line: string): AgentEvent[];
}

export interface AgentAdapter {
  id: string;
  name: string;
  product: string;
  /** The command looked up on PATH. */
  command: string;
  /** Env var that points at the CLI explicitly (skips the PATH lookup). */
  envOverride: string;
  installUrl: string;
  loginCommand: string;
  /** Instructions file the CLI reads from the workspace root (written on every helper start). */
  instructionsFile: string;
  /** Folder (relative to the workspace) where the CLI discovers project skills. */
  skillsDir: string;
  /** How the prompt tells the agent to look at an attached image, e.g. "open it with Read". */
  imageHint: string;
  /** The models and thinking levels to offer, and the CLI's defaults when they can be read. */
  listModels(): { models: AgentModel[]; defaultModel: string | null; efforts: string[]; defaultEffort: string | null };
  /** Arguments for one turn. The prompt goes on stdin. */
  buildArgs(run: AgentRun): string[];
  createParser(): AgentParser;
  /** The saved session can't be resumed (stderr of a failed run): start a fresh one. */
  isLostSession(stderr: string): boolean;
}
