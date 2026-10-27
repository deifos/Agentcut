"use client";

import { STUDIO_COMMAND } from "@/lib/studio/commands";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Clock,
  Pencil,
  SkipForward,
  Camera,
  Check,
  Ear,
  Eye,
  FilePen,
  Film,
  RotateCcw,
  Search,
  Square,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSlugContext, StepImages } from "@/components/studio/StepImages";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgentName } from "@/components/studio/StudioAgent";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ReferenceChip,
  readDraggedReference,
  uploadChatFiles,
  uploadFailureMessage,
} from "@/components/studio/ChatReferences";
import { formatFrameTime } from "@/lib/studio/format";
import { useFrame, type FrameStore } from "@/lib/studio/frame-store";
import type {
  AgentInfo,
  ChatHistory,
  ChatMessage,
  ChatPart,
  ChatReference,
} from "@/lib/studio/types";

const STARTERS = [
  "Make a 20 second launch video for my app: hook, three feature beats, end card. Wide and mobile.",
  "Add a punchy music bed and a whoosh on every scene change, then check the mix.",
  "Add word-by-word captions from the voiceover in assets/voice.wav.",
];

/** Tiny markdown subset: **bold**, `code`, line breaks, "- " bullets. */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**"))
      out.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else
      out.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-px font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MessageText({ text }: { text: string }) {
  const lines = text.replace(/\n{3,}/g, "\n\n").split("\n");
  return (
    <div className="space-y-1 break-words text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        if (/^#{1,4}\s/.test(line))
          return (
            <p key={i} className="pt-1 font-bold">
              {renderInline(line.replace(/^#{1,4}\s/, ""))}
            </p>
          );
        if (/^\s*[-*]\s/.test(line)) {
          return (
            <p key={i} className="pl-3 -indent-3">
              • {renderInline(line.replace(/^\s*[-*]\s/, ""))}
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function ToolIcon({ name }: { name: string }) {
  const className = "size-3.5 shrink-0 text-muted-foreground";
  if (name === "Write" || name === "Edit" || name === "MultiEdit")
    return <FilePen className={className} />;
  if (name === "Read") return <Eye className={className} />;
  if (name === "Bash") return <Terminal className={className} />;
  if (name === "Grep" || name === "Glob" || name === "WebSearch")
    return <Search className={className} />;
  if (name.includes("capture") || name.includes("contact_sheet"))
    return <Camera className={className} />;
  if (
    name.includes("listen") ||
    name.includes("analyze_audio") ||
    name.includes("transcribe")
  )
    return <Ear className={className} />;
  if (name.includes("export")) return <Film className={className} />;
  return <Wrench className={className} />;
}

function ToolRow({ part }: { part: Extract<ChatPart, { type: "tool" }> }) {
  if (part.images?.length) {
    return (
      <div className="space-y-1">
        <ToolLine part={part} />
        <StepImages images={part.images} title={part.summary} />
      </div>
    );
  }
  return <ToolLine part={part} />;
}

function ToolLine({ part }: { part: Extract<ChatPart, { type: "tool" }> }) {
  const isFile =
    part.name === "Write" || part.name === "Edit" || part.name === "MultiEdit";
  return (
    <Marker
      role={part.status === "running" ? "status" : undefined}
      title={part.error ?? part.name}
      className={cn(
        "rounded-md border px-2 py-1.5 text-[12px]",
        isFile
          ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
          : "border-border/60 bg-muted/30",
        part.status === "error" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <MarkerIcon>
        <ToolIcon name={part.name} />
      </MarkerIcon>
      <MarkerContent
        className={cn(
          "min-w-0 flex-1 truncate",
          part.status === "running" && "shimmer",
        )}
      >
        {part.summary}
      </MarkerContent>
      {part.status === "running" ? (
        <Spinner className="size-3.5 shrink-0" />
      ) : part.status === "done" ? (
        <Check className="size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <X className="size-3.5 shrink-0 text-destructive" />
      )}
    </Marker>
  );
}

function AssistantMessage({
  message,
  agents,
}: {
  message: ChatMessage;
  agents: AgentInfo[];
}) {
  const activeName = useAgentName();
  // Who wrote it (a chat can switch agents); older messages don't say.
  const author = agents.find((agent) => agent.id === message.agent)?.name;
  const parts = message.parts ?? [];
  // Collapse long runs of tool rows (agents read and search a lot).
  const groups: { kind: "text" | "tools"; items: ChatPart[] }[] = [];
  for (const part of parts) {
    const kind = part.type === "text" ? "text" : "tools";
    const last = groups[groups.length - 1];
    if (last && last.kind === kind) last.items.push(part);
    else groups.push({ kind, items: [part] });
  }
  const files = new Set(
    parts
      .filter(
        (p): p is Extract<ChatPart, { type: "tool" }> =>
          p.type === "tool" &&
          p.status === "done" &&
          Boolean(p.file) &&
          /Write|Edit/.test(p.name),
      )
      .map((p) => p.file),
  );
  return (
    <Message align="start">
      <MessageContent className="gap-2">
        {groups.map((group, i) =>
          group.kind === "text" ? (
            <Fragment key={i}>
              {group.items.map((part, j) =>
                part.type === "text" && part.text.trim() ? (
                  <MessageText key={j} text={part.text.trim()} />
                ) : null,
              )}
            </Fragment>
          ) : (
            <ToolGroup
              key={i}
              parts={group.items as Extract<ChatPart, { type: "tool" }>[]}
            />
          ),
        )}
        {message.status === "running" && parts.length === 0 ? (
          <Marker role="status">
            <MarkerIcon>
              <Spinner />
            </MarkerIcon>
            <MarkerContent className="shimmer">
              {author ?? activeName} is thinking…
            </MarkerContent>
          </Marker>
        ) : null}
        {message.status === "error" ? (
          <Bubble variant="destructive">
            <BubbleContent className="whitespace-pre-wrap font-mono text-[11px]">
              {message.error ?? "Something went wrong."}
            </BubbleContent>
          </Bubble>
        ) : null}
        {message.status === "cancelled" ? (
          <MessageFooter className="px-0">Stopped.</MessageFooter>
        ) : null}
        {message.status === "done" && message.durationMs ? (
          <MessageFooter className="px-0 text-[10px] font-normal">
            {author && agents.length > 1 ? `${author} · ` : ""}
            Worked for {Math.round(message.durationMs / 1000)}s
            {files.size
              ? ` · ${files.size} file${files.size > 1 ? "s" : ""} changed`
              : ""}
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function ToolGroup({
  parts,
}: {
  parts: Extract<ChatPart, { type: "tool" }>[];
}) {
  const [open, setOpen] = useState(false);
  const important = parts.filter(
    (part) =>
      /Write|Edit/.test(part.name) ||
      part.status !== "done" ||
      part.name.startsWith("mcp__") ||
      Boolean(part.images?.length),
  );
  const hidden = parts.length - important.length;
  const shown = open ? parts : important;
  return (
    <div className="space-y-1">
      {shown.map((part) => (
        <ToolRow key={part.id} part={part} />
      ))}
      {hidden > 0 ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-[11px] text-muted-foreground"
          onClick={() => setOpen((v) => !v)}
        >
          {open
            ? "Hide steps"
            : `+ ${hidden} more step${hidden > 1 ? "s" : ""} (reading, searching)`}
        </Button>
      ) : null}
    </div>
  );
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}

/** Sticky status above the input while the agent works: what it's doing and for how long. */
function WorkingBar({ message }: { message: ChatMessage | undefined }) {
  const agentName = useAgentName();
  const parts = message?.parts ?? [];
  const last = parts[parts.length - 1];
  const key = `${parts.length}:${last?.type === "text" ? last.text.length : last?.type === "tool" ? last.status : ""}`;
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);
  // Ticks once a second: elapsed time, and how long since the last visible activity.
  const [clock, setClock] = useState({
    now: message?.at ?? 0,
    quietSince: message?.at ?? 0,
  });
  useEffect(() => {
    let seen = keyRef.current;
    const tick = () => {
      const now = Date.now();
      const changed = keyRef.current !== seen;
      seen = keyRef.current;
      setClock((previous) => ({
        now,
        quietSince:
          changed || previous.quietSince === 0 ? now : previous.quietSince,
      }));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  const now = clock.now;
  const runningTool = [...parts]
    .reverse()
    .find(
      (p): p is Extract<ChatPart, { type: "tool" }> =>
        p.type === "tool" && p.status === "running",
    );
  const doing = runningTool
    ? /Write|Edit/.test(runningTool.name)
      ? `${runningTool.summary.replace(/^Wrote /, "Writing ").replace(/^Edited /, "Editing ")}…`
      : `${runningTool.summary}…`
    : last?.type === "text"
      ? "Writing a reply…"
      : "Thinking…";
  const quiet = now - clock.quietSince;
  return (
    <Marker
      role="status"
      className="border-t border-border/60 bg-primary/5 px-3 py-1.5 text-[11px]"
    >
      <MarkerIcon>
        <Spinner className="size-3.5 text-primary" />
      </MarkerIcon>
      <MarkerContent className="min-w-0 flex-1 truncate">
        <span className="font-semibold text-foreground">
          {agentName} is working
        </span>
        <span className="shimmer"> · {doing}</span>
      </MarkerContent>
      <span
        className="shrink-0 tabular-nums"
        title={
          quiet > 20_000 ? "Big files show up when they're finished" : undefined
        }
      >
        {message ? formatElapsed(now - message.at) : ""}
        {quiet > 20_000 ? ` · quiet ${formatElapsed(quiet)}` : ""}
      </span>
    </Marker>
  );
}

/** What the agent gets with every message besides the text: playhead, selection, variant. */
function ContextHint({
  frameStore,
  fps,
  selectionCount,
}: {
  frameStore: FrameStore;
  fps: number;
  selectionCount: number;
}) {
  const frame = useFrame(frameStore);
  const agentName = useAgentName();
  return (
    <span
      className="min-w-0 truncate text-[10px] text-muted-foreground"
      title="Sent with every message, so you can say “here” or “this clip”"
    >
      {agentName} sees: playhead {formatFrameTime(frame, fps)}
      {selectionCount
        ? ` · ${selectionCount} clip${selectionCount > 1 ? "s" : ""} selected`
        : ""}
    </span>
  );
}

/** A message waiting for the agent: edit it, take it out, or stop the current job and run it now. */
function QueuedBubble({
  message,
  position,
  onEdit,
  onRemove,
  onRunNow,
}: {
  message: ChatMessage;
  position: number;
  onEdit(text: string): Promise<void>;
  onRemove(): void;
  onRunNow(): void;
}) {
  const agentName = useAgentName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text ?? "");
  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await onEdit(trimmed);
    setEditing(false);
  };
  return (
    <div className="flex w-full flex-col items-end gap-1">
      {editing ? (
        <div className="w-full space-y-1.5">
          <Textarea
            autoFocus
            value={draft}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void save();
              } else if (event.key === "Escape") {
                setEditing(false);
                setDraft(message.text ?? "");
              }
            }}
            className="min-h-16 resize-none text-[13px] md:text-[13px]"
          />
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setEditing(false);
                setDraft(message.text ?? "");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={() => void save()}
              disabled={!draft.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <Bubble
          variant="muted"
          align="end"
          className="border border-dashed border-border opacity-80"
        >
          <BubbleContent className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {message.text}
          </BubbleContent>
        </Bubble>
      )}
      {!editing ? (
        <div className="flex items-center gap-0.5">
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Clock className="size-3" />
            {position === 1 ? "Next" : `Queued · ${position}`}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Edit"
                onClick={() => setEditing(true)}
              >
                <Pencil />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit before it runs</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Run now"
                onClick={onRunNow}
              >
                <SkipForward />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop {agentName} and run this now</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remove from queue"
                onClick={onRemove}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove (never sent)</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
    </div>
  );
}

/** Switch the agent that answers the next message (Claude Code, Codex…) and its model. */
function AgentPicker({
  agent,
  agents,
  onChange,
  model,
  onModelChange,
}: {
  agent: AgentInfo | null;
  agents: AgentInfo[];
  onChange(id: string): void;
  model: string | null;
  onModelChange(agentId: string, model: string | null): void;
}) {
  const models = agent?.found ? (agent.models ?? []) : [];
  const modelLabel = models.find((m) => m.id === model)?.label;
  const defaultLabel = agent?.defaultModel
    ? `Default (${models.find((m) => m.id === agent.defaultModel)?.label ?? agent.defaultModel})`
    : "Default";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-bold hover:bg-muted">
        <span>{agent?.name ?? "Agent"}</span>
        <span className="truncate text-[11px] font-normal text-muted-foreground">
          {!agent?.found
            ? "not installed"
            : modelLabel
              ? `· ${modelLabel}`
              : (agent.version ?? "")}
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {agents.length > 1 && (
          <>
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
              Who answers your next message. Switching keeps the conversation.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={agent?.id ?? ""}
              onValueChange={onChange}
            >
              {agents.map((option) => (
                <DropdownMenuRadioItem
                  key={option.id}
                  value={option.id}
                  disabled={!option.found}
                  className="text-xs"
                >
                  <span className="font-semibold">{option.product}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {option.found ? (option.version ?? "") : "not installed"}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
        {agent && models.length > 0 && (
          <>
            {agents.length > 1 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
              {agent.name} model
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={model ?? ""}
              onValueChange={(id) => onModelChange(agent.id, id || null)}
            >
              <DropdownMenuRadioItem value="" className="text-xs">
                {defaultLabel}
              </DropdownMenuRadioItem>
              {models.map((option) => (
                <DropdownMenuRadioItem
                  key={option.id}
                  value={option.id}
                  className="text-xs"
                >
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ChatPanelProps {
  chat: ChatHistory;
  /** The agent that answers the next message. */
  agent: AgentInfo | null;
  /** Agents to choose from (empty when the helper can't switch). */
  agents: AgentInfo[];
  onAgentChange(id: string): void;
  /** The model picked for the agent (null: its default). */
  model: string | null;
  onModelChange(agentId: string, model: string | null): void;
  disabled: boolean;
  /** Files to send with the next message (from the assets panel or drag and drop). */
  references: ChatReference[];
  /** Takes an updater too: uploads finish later, after the chips may have changed. */
  onReferencesChange(
    update: ChatReference[] | ((current: ChatReference[]) => ChatReference[]),
  ): void;
  frameStore: FrameStore;
  fps: number;
  selectionCount: number;
  onSend(
    text: string,
    options: { attachFrame: boolean; references: ChatReference[] },
  ): Promise<void>;
  onCancel(): void;
  onReset(): void;
  onEditQueued(messageId: string, text: string): Promise<void>;
  onRemoveQueued(messageId: string): void;
  onRunQueuedNow(messageId: string): void;
  /** The open project (for the pictures in the agent's steps). */
  slug: string | null;
}

/** Unsent text per project, kept while switching projects. */
const drafts = new Map<string, string>();

export function ChatPanel({
  chat,
  agent,
  agents,
  onAgentChange,
  model,
  onModelChange,
  disabled,
  references,
  onReferencesChange,
  frameStore,
  fps,
  selectionCount,
  onSend,
  onCancel,
  onReset,
  onEditQueued,
  onRemoveQueued,
  onRunQueuedNow,
  slug,
}: ChatPanelProps) {
  const [dropping, setDropping] = useState(false);
  const [uploading, setUploading] = useState(0);
  // Files from the computer (dropped or pasted) go into the project's assets and attach to the message.
  const attachFiles = async (files: File[]) => {
    if (!slug || !files.length) return;
    setUploading((n) => n + files.length);
    try {
      const { added, failed } = await uploadChatFiles(slug, files);
      if (added.length) addReferences(added);
      if (failed.length) toast.error(uploadFailureMessage(files.length, failed));
    } finally {
      setUploading((n) => n - files.length);
    }
  };
  // Functional updates: chips added or removed while an upload or a send was in flight stay put.
  const addReferences = (added: ChatReference[]) =>
    onReferencesChange((current) => [
      ...current.filter((r) => !added.some((a) => a.path === r.path)),
      ...added,
    ]);
  const [text, setTextState] = useState(() => drafts.get(slug ?? "") ?? "");
  const setText = (value: string) => {
    drafts.set(slug ?? "", value);
    setTextState(value);
  };
  const [attachFrame, setAttachFrame] = useState(false);
  const [sending, setSending] = useState(false);
  const running = Boolean(chat.running);

  const send = async (value = text) => {
    const trimmed = value.trim();
    // While the agent works, a new message waits in the queue and runs next.
    // Wait for dropped or pasted files to finish uploading, so they go with the message.
    if (!trimmed || sending || disabled || uploading) return;
    setSending(true);
    // Only the chips sent with this message go; files attached while it sends wait for the next one.
    const sent = references;
    try {
      await onSend(trimmed, { attachFrame, references: sent });
      setText("");
      setAttachFrame(false);
      onReferencesChange((current) =>
        current.filter((r) => !sent.some((s) => s.path === r.path)),
      );
    } catch {
      // toast shown by the controller
    } finally {
      setSending(false);
    }
  };

  const agentName = agent?.name ?? "Agent";
  const agentMissing = agent && !agent.found;
  const queuedIds = chat.messages
    .filter((m) => m.role === "user" && m.status === "queued")
    .map((m) => m.id);

  return (
    <ChatSlugContext.Provider value={slug}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/60 px-3">
          <Bot className="size-4" />
          {agents.length > 1 || (agent?.found && agent.models?.length) ? (
            <AgentPicker
              agent={agent}
              agents={agents}
              onChange={onAgentChange}
              model={model}
              onModelChange={onModelChange}
            />
          ) : (
            <>
              <span className="text-xs font-bold">{agentName}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                {agent?.found
                  ? `${agent.product} ${agent.version ?? ""}`
                  : agent
                    ? "not installed"
                    : ""}
              </span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="New conversation"
                onClick={onReset}
                disabled={running || chat.messages.length === 0}
                className="ml-auto text-muted-foreground"
              >
                <RotateCcw />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New conversation</TooltipContent>
          </Tooltip>
        </div>

        <MessageScrollerProvider autoScroll>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="gap-4 px-3 py-3">
                {agentMissing ? (
                  <MessageScrollerItem messageId="agent-missing">
                    <Bubble variant="destructive">
                      <BubbleContent className="text-xs">
                        <p className="mb-1 font-semibold">
                          {agents.length > 1
                            ? "No coding agent is installed on this computer"
                            : `${agent.product} isn't installed on this computer`}
                        </p>
                        <p>
                          Install{" "}
                          {(agents.length > 1 ? agents : [agent]).map(
                            (option, i, list) => (
                              <Fragment key={option.id}>
                                {i > 0
                                  ? i === list.length - 1
                                    ? " or "
                                    : ", "
                                  : ""}
                                <a
                                  href={option.installUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline"
                                >
                                  {option.product}
                                </a>{" "}
                                (sign in once with{" "}
                                <code>{option.loginCommand}</code>)
                              </Fragment>
                            ),
                          )}
                          , then restart <code>{STUDIO_COMMAND}</code>.
                        </p>
                      </BubbleContent>
                    </Bubble>
                  </MessageScrollerItem>
                ) : null}
                {chat.messages.length === 0 && !agentMissing ? (
                  <MessageScrollerItem
                    messageId="starters"
                    className="space-y-2 pt-2"
                  >
                    <p className="text-xs text-muted-foreground">
                      {agentName} builds on this project while you watch. Every layer
                      it adds shows up on the timeline, and you can edit
                      anything by hand.
                    </p>
                    {STARTERS.map((starter) => (
                      <Button
                        key={starter}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => setText(starter)}
                        className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left text-xs font-normal"
                      >
                        {starter}
                      </Button>
                    ))}
                  </MessageScrollerItem>
                ) : null}
                {chat.messages.map((message) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={message.id}
                    scrollAnchor={message.role === "user"}
                  >
                    {message.role === "user" && message.status === "queued" ? (
                      <Message align="end">
                        <MessageContent className="max-w-[88%] items-end">
                          <QueuedBubble
                            message={message}
                            position={queuedIds.indexOf(message.id) + 1}
                            onEdit={(value) => onEditQueued(message.id, value)}
                            onRemove={() => onRemoveQueued(message.id)}
                            onRunNow={() => onRunQueuedNow(message.id)}
                          />
                        </MessageContent>
                      </Message>
                    ) : message.role === "user" ? (
                      <Message align="end">
                        <MessageContent className="max-w-[88%] items-end">
                          {message.references?.length ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              {message.references.map((reference) => (
                                <ReferenceChip
                                  key={reference.path}
                                  reference={reference}
                                />
                              ))}
                            </div>
                          ) : null}
                          <Bubble variant="muted" align="end">
                            <BubbleContent className="whitespace-pre-wrap text-[13px] leading-relaxed">
                              {message.text}
                            </BubbleContent>
                          </Bubble>
                          {message.attachments?.length ? (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Camera className="size-3" /> frame attached
                            </span>
                          ) : null}
                        </MessageContent>
                      </Message>
                    ) : (
                      <AssistantMessage message={message} agents={agents} />
                    )}
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        {running ? (
          <WorkingBar
            message={chat.messages.find((m) => m.id === chat.running)}
          />
        ) : null}
        <div className="shrink-0 border-t border-border/60 p-2">
          <InputGroup
            className={cn(
              "h-auto rounded-xl",
              dropping && "border-primary ring-2 ring-primary/30",
            )}
            onDragOver={(event) => {
              const types = event.dataTransfer.types;
              if (
                !types.includes("application/x-agentcut-asset") &&
                !(types.includes("Files") && slug && !disabled)
              )
                return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setDropping(true);
            }}
            onDragLeave={(event) => {
              // Moving onto a child (the textarea, a chip) fires dragleave too: not a real leave.
              if (
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              )
                return;
              setDropping(false);
            }}
            onDrop={(event) => {
              setDropping(false);
              const reference = readDraggedReference(event.dataTransfer);
              if (!reference) {
                const files = Array.from(event.dataTransfer.files);
                if (!files.length || disabled) return;
                event.preventDefault();
                void attachFiles(files);
                return;
              }
              event.preventDefault();
              addReferences([reference]);
            }}
          >
            {references.length || uploading ? (
              <InputGroupAddon
                align="block-start"
                className="flex-wrap gap-1 pb-0"
              >
                {references.map((reference) => (
                  <ReferenceChip
                    key={reference.path}
                    reference={reference}
                    onRemove={() =>
                      onReferencesChange((current) =>
                        current.filter((r) => r.path !== reference.path),
                      )
                    }
                  />
                ))}
                {uploading ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    Adding {uploading} file{uploading > 1 ? "s" : ""}…
                  </span>
                ) : null}
              </InputGroupAddon>
            ) : null}
            <InputGroupTextarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onPaste={(event) => {
                // A pasted screenshot or file becomes an asset; pasted text stays text.
                const files = Array.from(event.clipboardData.files);
                if (!files.length || !slug) return;
                // Word, Excel and PowerPoint put a picture of the selection next to its text: keep the text.
                if (
                  event.clipboardData.getData("text/plain").trim() &&
                  files.every((file) => file.type.startsWith("image/"))
                )
                  return;
                event.preventDefault();
                void attachFiles(files);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={3}
              disabled={disabled || Boolean(agentMissing)}
              placeholder={
                disabled
                  ? "Connect the studio helper to chat"
                  : running
                    ? `${agentName} is working. Send the next request: it runs right after.`
                    : references.length
                      ? `What should ${agentName} do with this? (Enter to send)`
                      : "Describe a change… drop or paste images and files to show them"
              }
              className="max-h-48 min-h-[4.5rem] text-[13px]"
            />
            <InputGroupAddon align="block-end" className="gap-1">
              <InputGroupButton
                type="button"
                size="xs"
                variant={attachFrame ? "secondary" : "ghost"}
                onClick={() => setAttachFrame((value) => !value)}
                disabled={disabled}
                title={`Attach the current frame so ${agentName} can see what you mean`}
              >
                <Camera /> {attachFrame ? "Frame attached" : "Attach frame"}
              </InputGroupButton>
              <ContextHint
                frameStore={frameStore}
                fps={fps}
                selectionCount={selectionCount}
              />
              {running ? (
                <InputGroupButton
                  type="button"
                  variant={text.trim() ? "outline" : "default"}
                  size="icon-sm"
                  onClick={onCancel}
                  aria-label={`Stop ${agentName}`}
                  title="Stop"
                  className="ml-auto rounded-full"
                >
                  <Square className="fill-current" />
                </InputGroupButton>
              ) : null}
              {!running || text.trim() ? (
                <InputGroupButton
                  type="button"
                  variant="default"
                  size="icon-sm"
                  onClick={() => void send()}
                  disabled={!text.trim() || sending || disabled || uploading > 0}
                  aria-label={running ? "Queue message" : "Send"}
                  title={
                    uploading
                      ? "Adding files…"
                      : running
                        ? `Queue: runs when ${agentName} is done`
                        : "Send"
                  }
                  className={cn("rounded-full", !running && "ml-auto")}
                >
                  {sending ? <Spinner /> : running ? <Clock /> : <ArrowUp />}
                </InputGroupButton>
              ) : null}
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </ChatSlugContext.Provider>
  );
}
