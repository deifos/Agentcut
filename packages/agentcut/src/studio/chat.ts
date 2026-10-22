import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import type { ChildProcess } from "node:child_process";
import { debugLog } from "../log.js";
import { getAgent, type AgentAdapter, type AgentEvent, type AgentInfo, type AgentParser, type McpServerSpec } from "./agents/index.js";
import { atomicWrite, projectDir, StudioError } from "./projects.js";
import { VOICE_KEY_ENV_VARS } from "./voice.js";
import { DETACH_FOR_GROUP_KILL, killTree, spawnCommand } from "./proc.js";
import type { WorkspacePaths } from "./workspace.js";

// ---------------------------------------------------------------------------
// Chat history model (persisted to projects/<slug>/.studio/chat.json)

export type ChatPart =
  | { type: "text"; text: string }
  | {
      type: "tool";
      id: string;
      name: string;
      summary: string;
      file?: string;
      status: "running" | "done" | "error";
      error?: string;
      /** Pictures the agent looked at in this step (project-relative, served by /studio/files). */
      images?: string[];
    };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  at: number;
  /** assistant: the agent that wrote it (see ./agents). */
  agent?: string;
  text?: string;
  parts?: ChatPart[];
  /** user messages: "queued" while waiting for the running turn; assistant: the turn state. */
  status?: "running" | "done" | "error" | "cancelled" | "queued";
  error?: string;
  costUsd?: number;
  durationMs?: number;
  attachments?: string[];
  /** Project files the user pointed at with this message (assets panel, drag and drop). */
  references?: ChatReference[];
}

export interface ChatReference {
  path: string;
  kind: string;
}

interface ChatFile {
  version: 1;
  sessionId: string | null;
  /** The agent the session belongs to (chats from before agents were pluggable are Claude's). */
  agent: string | null;
  messages: ChatMessage[];
}

const MAX_MESSAGES = 400;
/** The agent of chats saved before the `agent` field existed. */
const LEGACY_AGENT = "claude";

interface Turn {
  /** Project the turn belongs to; changes when the agent creates a project mid-turn. */
  slug: string;
  agent: AgentAdapter;
  parser: AgentParser;
  message: ChatMessage;
  child: ChildProcess;
  startedAt: number;
  cancelled: boolean;
  stderr: string;
  /** The last problem the agent reported (shown if the turn ends without a result). */
  lastError: string | null;
  gotResult: boolean;
  retriedWithoutResume: boolean;
}

export interface ChatEngineDeps {
  paths: WorkspacePaths;
  allowBash: boolean;
  emit(event: string, data: unknown): void;
  /** Every agent with its install state (see ./agents). */
  getAgents(): Promise<AgentInfo[]>;
  /** The agent to use when the page doesn't pick one and the chat has none yet. */
  defaultAgent(): Promise<string | null>;
  /** The agentcut MCP server every agent connects to. */
  mcp: McpServerSpec;
  getPageContext(): Record<string, unknown> | null;
  /** Extra folders the agent may read, e.g. the app's repo. */
  addDirs: string[];
}

type ResolvedAgent = { adapter: AgentAdapter; info: AgentInfo; path: string; agents: AgentInfo[] };

const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

const IMAGE_FILE = /\.(png|jpe?g|webp|gif)$/i;
/** A frame the bridge saved for the agent (see persistAgentFrameResult). */
const SAVED_FRAME = /[\\/]agentcut-frame-[\w-]+\.(png|jpe?g|webp)$/i;

/** Every saved-frame `filePath` in a tool result (text blocks hold JSON, sometimes JSON in JSON). */
function collectFramePaths(value: unknown, out: Set<string>, depth: number) {
  if (depth > 12 || out.size >= 24) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        collectFramePaths(JSON.parse(trimmed), out, depth + 1);
      } catch {}
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectFramePaths(item, out, depth + 1);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "filePath" && typeof item === "string" && SAVED_FRAME.test(item)) out.add(item);
    else collectFramePaths(item, out, depth + 1);
  }
}
const MAX_CHAT_FRAMES = 400;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** A message sent while the agent was busy. Its context (and agent) is captured when it was sent. */
interface QueuedMessage {
  slug: string;
  messageId: string;
  text: string;
  agentId: string;
  context: Record<string, unknown>;
}

export class ChatEngine {
  private readonly turns = new Map<string, Turn>();
  /** One agent at a time: messages wait here and run in order when the current turn ends. */
  private readonly queue: QueuedMessage[] = [];

  constructor(private readonly deps: ChatEngineDeps) {}

  private chatPath(slug: string) {
    return join(projectDir(this.deps.paths, slug), ".studio", "chat.json");
  }

  private load(slug: string): ChatFile {
    try {
      const raw = JSON.parse(readFileSync(this.chatPath(slug), "utf8")) as Partial<ChatFile>;
      if (raw && Array.isArray(raw.messages)) {
        const sessionId = raw.sessionId ?? null;
        return { version: 1, sessionId, agent: raw.agent ?? (sessionId ? LEGACY_AGENT : null), messages: raw.messages };
      }
    } catch {}
    return { version: 1, sessionId: null, agent: null, messages: [] };
  }

  private save(slug: string, file: ChatFile) {
    const path = this.chatPath(slug);
    mkdirSync(join(path, ".."), { recursive: true });
    const trimmed = { ...file, messages: file.messages.slice(-MAX_MESSAGES) };
    atomicWrite(path, `${JSON.stringify(trimmed, null, 2)}\n`);
  }

  private upsertMessage(slug: string, message: ChatMessage) {
    const file = this.load(slug);
    const index = file.messages.findIndex((m) => m.id === message.id);
    if (index >= 0) file.messages[index] = message;
    else file.messages.push(message);
    this.save(slug, file);
  }

  private saveSession(slug: string, agentId: string, sessionId: string | null) {
    const file = this.load(slug);
    if (file.sessionId === sessionId && file.agent === agentId) return;
    file.sessionId = sessionId;
    file.agent = agentId;
    this.save(slug, file);
  }

  history(slug: string) {
    const file = this.load(slug);
    // Queued messages from a previous helper run are gone from memory: show them as not sent.
    let stale = false;
    for (const message of file.messages) {
      if (message.status === "queued" && !this.queue.some((q) => q.messageId === message.id)) {
        message.status = "cancelled";
        stale = true;
      }
    }
    if (stale) this.save(slug, file);
    return {
      sessionId: file.sessionId,
      agent: file.agent,
      messages: file.messages,
      running: this.turns.has(slug) ? this.turns.get(slug)?.message.id : null,
    };
  }

  reset(slug: string) {
    this.dropQueued(slug);
    this.cancel(slug);
    this.save(slug, { version: 1, sessionId: null, agent: null, messages: [] });
    this.deps.emit("studio.chat", { slug, kind: "reset" });
    return { ok: true };
  }

  cancel(slug: string) {
    const turn = this.turns.get(slug);
    if (!turn) return { ok: true, cancelled: false };
    turn.cancelled = true;
    killTree(turn.child);
    return { ok: true, cancelled: true };
  }

  /** The running turn (there is at most one). */
  runningSlug(): string | null {
    return [...this.turns.keys()][0] ?? null;
  }

  /**
   * The agent created a new project from a chat in another one: the conversation moves with
   * it, so the new project's chat shows the work in progress and later messages resume
   * the same session there.
   */
  moveRunningTurn(to: string) {
    const from = this.runningSlug();
    if (!from || from === to) return false;
    const turn = this.turns.get(from)!;
    const source = this.load(from);
    const target = this.load(to);
    const moving = source.messages.filter((m) => !target.messages.some((t) => t.id === m.id));
    // The whole conversation goes along when the new chat is empty; otherwise just this turn.
    const userIndex = source.messages.findIndex((m) => m.id === turn.message.id) - 1;
    const turnMessages = source.messages.slice(Math.max(0, userIndex));
    target.messages = target.messages.length === 0 ? moving : [...target.messages, ...turnMessages];
    target.sessionId = source.sessionId;
    target.agent = source.agent;
    this.save(to, target);
    // Leave a pointer in the old chat instead of the moved turn.
    source.messages = source.messages.filter((m) => !turnMessages.some((t) => t.id === m.id));
    source.messages.push({
      id: randomUUID(),
      role: "assistant",
      at: Date.now(),
      agent: turn.agent.id,
      status: "done",
      parts: [{ type: "text", text: `${turn.agent.name} created the project **${to}** and moved this conversation there.` }],
    });
    this.save(from, source);
    this.turns.delete(from);
    turn.slug = to;
    this.turns.set(to, turn);
    // Messages queued in the old chat follow the conversation.
    const followers = this.queue.filter((q) => q.slug === from);
    if (followers.length) {
      const src = this.load(from);
      const dst = this.load(to);
      for (const item of followers) {
        const message = src.messages.find((m) => m.id === item.messageId);
        if (message && !dst.messages.some((m) => m.id === message.id)) dst.messages.push(message);
        src.messages = src.messages.filter((m) => m.id !== item.messageId);
        item.slug = to;
      }
      this.save(from, src);
      this.save(to, dst);
    }
    debugLog(`chat moved from ${from} to ${to}`);
    this.deps.emit("studio.chat", { slug: from, kind: "reload" });
    this.deps.emit("studio.chat", { slug: to, kind: "reload" });
    return true;
  }

  cancelAll() {
    for (const slug of [...this.turns.keys()]) this.cancel(slug);
  }

  /** The agent for a message: the one the page picked, else the chat's, else the default. */
  private async resolveAgent(slug: string, requested: unknown) {
    const agents = await this.deps.getAgents();
    const id =
      (typeof requested === "string" && requested) || this.load(slug).agent || (await this.deps.defaultAgent()) || agents[0]?.id;
    const adapter = id ? getAgent(id) : undefined;
    const info = agents.find((agent) => agent.id === id);
    if (!adapter || !info) throw new StudioError(`Unknown agent "${String(id)}".`, "no_agent");
    if (!info.found || !info.path) {
      throw new StudioError(info.error ?? `${info.product} was not found.`, "no_agent");
    }
    return { adapter, info, path: info.path, agents };
  }

  /**
   * The context block sent with a message, plus the images to attach. Captured when the user
   * sends it (a queued message keeps the playhead it was sent with).
   */
  private buildContext(slug: string, context: Record<string, unknown>, agent: AgentAdapter) {
    const page = { ...(this.deps.getPageContext() ?? {}), ...context };
    const dir = projectDir(this.deps.paths, slug);
    const lines = [
      `<studio-context>`,
      `You are working inside Agentcut. The user watches the studio page: chat, live preview, timeline. Follow the agentcut skill.`,
      `Active project: ${slug} (folder: ${dir})`,
    ];
    if (this.deps.addDirs.length) {
      lines.push(
        `Other folders you can read (e.g. the app's source repo; never change files there, not even with shell commands): ${this.deps.addDirs.join(", ")}`,
      );
    }
    if (typeof page.variant === "string") lines.push(`Variant on screen: ${page.variant}`);
    if (typeof page.playheadFrame === "number") {
      const fps = typeof page.fps === "number" ? page.fps : 30;
      lines.push(`Playhead: frame ${page.playheadFrame} (${(page.playheadFrame / fps).toFixed(2)} s)`);
    }
    if (Array.isArray(page.selectedClipIds) && page.selectedClipIds.length > 0) {
      lines.push(`Selected clips: ${page.selectedClipIds.join(", ")}`);
    }
    const attachments = Array.isArray(context.attachments) ? context.attachments.filter((a): a is string => typeof a === "string") : [];
    const images = attachments.map((attachment) => join(dir, attachment));
    for (const image of images) {
      lines.push(`Attached image (${agent.imageHint}): ${image}`);
    }
    const references = (Array.isArray(context.references) ? context.references : [])
      .map((value) => asRecord(value))
      .filter((ref) => typeof ref.path === "string" && !String(ref.path).includes(".."))
      .slice(0, 12)
      .map((ref) => ({ path: String(ref.path), kind: typeof ref.kind === "string" ? ref.kind : "other" }));
    if (references.length) {
      lines.push(`The user is pointing at these project files (paths relative to the project folder):`);
      for (const ref of references) {
        const hint = ref.kind === "image" ? ` (an image: ${agent.imageHint})` : ref.kind === "audio" ? " (audio: use the listen/media tools)" : "";
        lines.push(`- ${ref.path} [${ref.kind}]${hint}`);
        if (ref.kind === "image") images.push(join(dir, ref.path));
      }
      lines.push(`"Here", "now" or "at the playhead" means the playhead frame above.`);
    }
    lines.push(`</studio-context>`);
    return { text: lines.join("\n"), attachments, references, images: images.filter((image) => existsSync(image)) };
  }

  /**
   * The conversation so far, for an agent that takes over a chat another agent started
   * (sessions can't move between CLIs). The project files stay the source of truth.
   */
  private handoff(file: ChatFile, agents: AgentInfo[], to: AgentAdapter, skipId: string) {
    const nameOf = (id: string | undefined) => agents.find((agent) => agent.id === id)?.name ?? "Assistant";
    const lines: string[] = [];
    for (const message of file.messages.slice(-16)) {
      if (message.id === skipId || message.status === "queued") continue;
      const text =
        message.role === "user"
          ? (message.text ?? "")
          : (message.parts ?? [])
              .map((part) => (part.type === "text" ? part.text : ""))
              .join("")
              .trim();
      if (!text.trim()) continue;
      const who = message.role === "user" ? "User" : nameOf(message.agent ?? file.agent ?? undefined);
      lines.push(`${who}: ${text.length > 700 ? `${text.slice(0, 700)}…` : text}`);
    }
    if (!lines.length) return "";
    return [
      `<earlier-conversation>`,
      `This chat was started with ${nameOf(file.agent ?? undefined)}; you (${to.name}) are taking over. Recent messages, for context. Re-read the project files before changing them.`,
      ...lines,
      `</earlier-conversation>`,
    ].join("\n");
  }

  async send(slug: string, text: string, context: Record<string, unknown>, agentId?: unknown) {
    const trimmed = text.trim();
    if (!trimmed) throw new StudioError("Type a message first.", "empty");
    const resolved = await this.resolveAgent(slug, agentId);
    const { adapter } = resolved;

    // The context (playhead, selection, pointed-at files) is taken now, when the user sent it.
    const { attachments, references } = this.buildContext(slug, context, adapter);
    const busy = this.turns.size > 0 || this.queue.length > 0;
    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: "user",
      at: Date.now(),
      text: trimmed,
      attachments: attachments.length ? attachments : undefined,
      references: references.length ? references : undefined,
      ...(busy ? { status: "queued" as const } : {}),
    };
    this.upsertMessage(slug, userMessage);
    this.deps.emit("studio.chat", { slug, kind: "user", message: userMessage });

    // Frozen now: a queued message keeps the playhead and selection it was sent with.
    const frozen = { ...(this.deps.getPageContext() ?? {}), ...context };
    if (busy) {
      // One agent at a time: two runs writing the same workspace overwrite each other.
      this.queue.push({ slug, messageId: userMessage.id, text: trimmed, agentId: adapter.id, context: frozen });
      debugLog(`chat ${slug}: queued (${this.queue.length} waiting)`);
      return { queued: true, position: this.queue.length, userMessageId: userMessage.id };
    }
    const turnId = this.startTurn(slug, resolved, frozen, trimmed, userMessage.id);
    return { turnId, userMessageId: userMessage.id };
  }

  /** Synchronous once the agent is resolved, so no other turn can start in between. */
  private startTurn(slug: string, resolved: ResolvedAgent, context: Record<string, unknown>, text: string, userMessageId: string) {
    const { adapter, path, agents } = resolved;
    const { text: contextText, images } = this.buildContext(slug, context, adapter);
    const file = this.load(slug);
    // Another agent owns the saved session: start a new one and pass the conversation along.
    const switching = Boolean(file.sessionId) && file.agent !== adapter.id;
    const handoff = switching ? this.handoff(file, agents, adapter, userMessageId) : "";
    const assistant: ChatMessage = {
      id: randomUUID(),
      role: "assistant",
      at: Date.now(),
      agent: adapter.id,
      parts: [],
      status: "running",
    };
    this.upsertMessage(slug, assistant);
    this.deps.emit("studio.chat", { slug, kind: "start", message: assistant });
    const prompt = [handoff, contextText, text].filter(Boolean).join("\n\n");
    this.startProcess(slug, adapter, path, prompt, images, assistant, switching ? null : file.sessionId, false);
    return assistant.id;
  }

  /** Start the next queued message once nothing is running. */
  private async drain() {
    if (this.turns.size > 0) return;
    const next = this.queue.shift();
    if (!next) return;
    const file = this.load(next.slug);
    const message = file.messages.find((m) => m.id === next.messageId);
    if (message) {
      // It moves down to where the answer will start, so each answer follows its message.
      delete message.status;
      message.at = Date.now();
      file.messages = [...file.messages.filter((m) => m.id !== message.id), message];
      this.save(next.slug, file);
      this.deps.emit("studio.chat", { slug: next.slug, kind: "dequeue", message });
    }
    try {
      const resolved = await this.resolveAgent(next.slug, next.agentId);
      if (this.turns.size > 0) {
        this.queue.unshift(next);
        return;
      }
      debugLog(`chat ${next.slug}: starting queued message (${this.queue.length} still waiting)`);
      this.startTurn(next.slug, resolved, next.context, next.text, next.messageId);
    } catch (error) {
      // The agent went missing since the message was queued: say so in the chat, then go on.
      const failed: ChatMessage = {
        id: randomUUID(),
        role: "assistant",
        at: Date.now(),
        agent: next.agentId,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
      this.upsertMessage(next.slug, failed);
      this.deps.emit("studio.chat", { slug: next.slug, kind: "done", message: failed });
      void this.drain();
    }
  }

  /** The waiting messages, in order (for the page). */
  queued() {
    return this.queue.map((q, index) => ({ slug: q.slug, messageId: q.messageId, position: index + 1 }));
  }

  /** Edit a message that hasn't started yet. */
  editQueued(slug: string, messageId: string, text: string) {
    const item = this.queue.find((q) => q.slug === slug && q.messageId === messageId);
    const trimmed = text.trim();
    if (!item) throw new StudioError("That message already started or was removed.", "not_queued");
    if (!trimmed) throw new StudioError("Type a message first.", "empty");
    item.text = trimmed;
    const file = this.load(slug);
    const message = file.messages.find((m) => m.id === messageId);
    if (message) {
      message.text = trimmed;
      this.save(slug, file);
      this.deps.emit("studio.chat", { slug, kind: "update", message });
    }
    return { ok: true };
  }

  /** Take a message out of the queue (it never reaches the agent). */
  removeQueued(slug: string, messageId: string) {
    const index = this.queue.findIndex((q) => q.slug === slug && q.messageId === messageId);
    if (index < 0) return { ok: true, removed: false };
    this.queue.splice(index, 1);
    const file = this.load(slug);
    file.messages = file.messages.filter((m) => m.id !== messageId);
    this.save(slug, file);
    this.deps.emit("studio.chat", { slug, kind: "remove", messageId });
    return { ok: true, removed: true };
  }

  /** "Stop and send this now": move it to the front and stop the running turn. */
  sendQueuedNow(slug: string, messageId: string) {
    const index = this.queue.findIndex((q) => q.slug === slug && q.messageId === messageId);
    if (index < 0) throw new StudioError("That message already started or was removed.", "not_queued");
    const [item] = this.queue.splice(index, 1);
    this.queue.unshift(item);
    const running = this.runningSlug();
    if (running) this.cancel(running);
    else void this.drain();
    return { ok: true };
  }

  /** Forget the messages waiting for a project (it is being deleted or reset). */
  dropQueued(slug: string) {
    for (const item of this.queue.filter((q) => q.slug === slug)) this.removeQueued(slug, item.messageId);
  }

  private startProcess(
    slug: string,
    agent: AgentAdapter,
    agentPath: string,
    prompt: string,
    images: string[],
    assistant: ChatMessage,
    sessionId: string | null,
    isRetry: boolean,
  ) {
    const args = agent.buildArgs({
      prompt,
      sessionId,
      images,
      workspace: this.deps.paths.root,
      mcp: this.deps.mcp,
      mcpConfigPath: this.deps.paths.mcpConfig,
      allowShell: this.deps.allowBash,
      readDirs: this.deps.addDirs,
    });

    const child = spawnCommand(agentPath, args, {
      cwd: this.deps.paths.root,
      env: {
        // Voice-provider keys stay in the helper: the agent (and the tools it runs) never get them.
        ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !VOICE_KEY_ENV_VARS.includes(name))),
        AGENTCUT_WORKSPACE: this.deps.paths.root,
        AGENTCUT_PROJECT: slug,
      },
      stdio: ["pipe", "pipe", "pipe"],
      detached: DETACH_FOR_GROUP_KILL,
    });

    const turn: Turn = {
      slug,
      agent,
      parser: agent.createParser(),
      message: assistant,
      child,
      startedAt: Date.now(),
      cancelled: false,
      stderr: "",
      lastError: null,
      gotResult: false,
      retriedWithoutResume: isRetry,
    };
    this.turns.set(slug, turn);

    child.stdin?.on("error", () => undefined);
    child.stdin?.end(prompt);

    const handleLine = (line: string) => {
      for (const event of turn.parser.line(line)) this.handleEvent(turn, event);
    };
    let buffer = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) handleLine(line);
        newline = buffer.indexOf("\n");
      }
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      turn.stderr = (turn.stderr + chunk).slice(-4000);
    });
    child.on("error", (error) => {
      turn.stderr = `${turn.stderr}\n${error.message}`.slice(-4000);
    });
    child.on("close", (code) => {
      if (buffer.trim()) handleLine(buffer.trim());
      const slug = turn.slug; // may have moved to a new project mid-turn
      this.turns.delete(slug);
      if (!turn.cancelled && !turn.gotResult && sessionId && agent.isLostSession(turn.stderr) && !turn.retriedWithoutResume) {
        // The saved session is gone (e.g. cleared); start a fresh one.
        debugLog(`chat ${slug}: resume failed, starting a new session`);
        this.saveSession(slug, agent.id, null);
        this.startProcess(slug, agent, agentPath, prompt, images, assistant, null, true);
        return;
      }
      if (turn.cancelled) {
        assistant.status = "cancelled";
      } else if (!turn.gotResult) {
        assistant.status = "error";
        assistant.error =
          turn.lastError ?? (turn.stderr.trim().split(/\r?\n/).slice(-6).join("\n") || `${agent.product} exited with code ${code}.`);
      }
      this.finishRunningTools(assistant, assistant.status === "done" ? "done" : "error");
      this.upsertMessage(slug, assistant);
      this.deps.emit("studio.chat", { slug, kind: "done", message: assistant });
      void this.drain().catch((error) => debugLog(`chat queue: ${error instanceof Error ? error.message : String(error)}`));
    });
  }

  private finishRunningTools(message: ChatMessage, status: "done" | "error") {
    for (const part of message.parts ?? []) {
      if (part.type === "tool" && part.status === "running") part.status = status;
    }
  }

  private relativeFile(slug: string, file: unknown) {
    if (typeof file !== "string") return undefined;
    const dir = projectDir(this.deps.paths, slug);
    const rel = relative(dir, file);
    if (!rel.startsWith("..") && !rel.includes(`..${sep}`)) return rel.split(sep).join("/");
    const fromRoot = relative(this.deps.paths.root, file);
    return fromRoot.startsWith("..") ? file : fromRoot.split(sep).join("/");
  }

  /**
   * The pictures a step showed the agent, so the chat can show them too: frames the studio captured
   * (copied out of the bridge's scratch folder, which it prunes) and images it read from the project.
   * (The folder keeps its old name so earlier chats still find their pictures.)
   */
  private imagesFor(slug: string, part: Extract<ChatPart, { type: "tool" }>, content: unknown): string[] {
    try {
      if (part.name === "Read") {
        return part.file && IMAGE_FILE.test(part.file) && !isAbsolute(part.file) && !part.file.startsWith("..") ? [part.file] : [];
      }
      if (!part.name.startsWith("mcp__agentcut__")) return [];
      const found = new Set<string>();
      collectFramePaths(content, found, 0);
      if (found.size === 0) return [];
      const dir = join(projectDir(this.deps.paths, slug), ".studio", "attachments", "claude-frames");
      mkdirSync(dir, { recursive: true });
      const out: string[] = [];
      for (const source of [...found].slice(0, 24)) {
        if (!existsSync(source)) continue;
        const name = basename(source);
        copyFileSync(source, join(dir, name));
        out.push(`.studio/attachments/claude-frames/${name}`);
      }
      this.pruneFrames(dir);
      return out;
    } catch (error) {
      debugLog(`chat images ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private pruneFrames(dir: string) {
    const files = readdirSync(dir)
      .map((name) => ({ name, mtime: statSync(join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const old of files.slice(MAX_CHAT_FRAMES)) rmSync(join(dir, old.name), { force: true });
  }

  private toolSummary(slug: string, name: string, input: Record<string, unknown>) {
    const file = this.relativeFile(slug, input.file_path ?? input.path ?? input.notebook_path);
    switch (name) {
      case "Write":
        return { summary: `Wrote ${file ?? "a file"}`, file };
      case "Edit":
      case "MultiEdit":
        return { summary: `Edited ${file ?? "a file"}`, file };
      case "Read":
        return { summary: `Read ${file ?? "a file"}`, file };
      case "Glob":
      case "Grep":
        return { summary: `${name} ${String(input.pattern ?? "").slice(0, 60)}` };
      case "Bash":
        return { summary: `Ran ${String(input.description ?? input.command ?? "").trim().split(/\r?\n/)[0].slice(0, 80)}` };
      case "WebSearch":
        return { summary: `Searched “${String(input.query ?? "").slice(0, 60)}”` };
      case "WebFetch":
        return { summary: `Fetched ${String(input.url ?? "").slice(0, 80)}` };
      case "TodoWrite":
        return { summary: "Updated the plan" };
      case "Skill":
        return { summary: `Loaded skill ${String(input.skill ?? input.name ?? "")}` };
      default:
        if (name.startsWith("mcp__agentcut__")) {
          return { summary: name.replace("mcp__agentcut__agentcut_", "").replace(/_/g, " ") };
        }
        return { summary: name };
    }
  }

  private appendText(turn: Turn, text: string) {
    const parts = (turn.message.parts ??= []);
    const last = parts[parts.length - 1];
    if (last && last.type === "text") last.text += text;
    else parts.push({ type: "text", text });
  }

  /** Apply one agent event to the running turn: chat parts, session, result. */
  private handleEvent(turn: Turn, event: AgentEvent) {
    const { slug } = turn;
    const parts = (turn.message.parts ??= []);
    switch (event.type) {
      case "session":
        this.saveSession(slug, turn.agent.id, event.sessionId);
        return;
      case "message-start": {
        // Separate consecutive assistant messages with a paragraph break.
        const last = parts[parts.length - 1];
        if (last && last.type === "text" && last.text && !last.text.endsWith("\n\n")) last.text += "\n\n";
        this.upsertMessage(slug, turn.message);
        return;
      }
      case "text":
        this.appendText(turn, event.text);
        this.deps.emit("studio.chat", { slug, kind: "text", messageId: turn.message.id, text: event.text });
        return;
      case "tool-start": {
        if (parts.some((part) => part.type === "tool" && part.id === event.id)) return;
        const { summary, file } = this.toolSummary(slug, event.name, event.input);
        const part: ChatPart = { type: "tool", id: event.id, name: event.name, summary, file, status: "running" };
        parts.push(part);
        this.deps.emit("studio.chat", { slug, kind: "tool", messageId: turn.message.id, part });
        this.upsertMessage(slug, turn.message);
        return;
      }
      case "tool-end": {
        const part = parts.find((candidate) => candidate.type === "tool" && candidate.id === event.id);
        if (!part || part.type !== "tool") return;
        part.status = event.ok ? "done" : "error";
        if (event.ok) {
          const images = this.imagesFor(slug, part, event.content);
          if (images.length > 0) part.images = images;
        } else {
          part.error = event.error?.slice(0, 400);
        }
        this.deps.emit("studio.chat", { slug, kind: "tool_result", messageId: turn.message.id, part });
        if (FILE_TOOLS.has(part.name) && part.status === "done") {
          this.deps.emit("studio.chat", { slug, kind: "file", messageId: turn.message.id, file: part.file });
        }
        return;
      }
      case "error":
        turn.lastError = event.message.slice(0, 1200);
        return;
      case "result": {
        turn.gotResult = true;
        turn.message.status = event.ok ? "done" : "error";
        if (!event.ok) turn.message.error = event.error ?? turn.lastError ?? `${turn.agent.name} stopped.`;
        if (event.costUsd !== undefined) turn.message.costUsd = event.costUsd;
        turn.message.durationMs = event.durationMs ?? Date.now() - turn.startedAt;
        if (event.sessionId) this.saveSession(slug, turn.agent.id, event.sessionId);
        // If nothing was streamed (very short answers), fall back to the final text.
        const hasText = parts.some((part) => part.type === "text" && part.text.trim());
        if (!hasText && event.ok && event.text?.trim()) this.appendText(turn, event.text);
        this.upsertMessage(slug, turn.message);
        return;
      }
    }
  }
}
