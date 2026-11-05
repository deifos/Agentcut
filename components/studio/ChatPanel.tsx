"use client";

import { confirmDestructive } from "@/components/studio/ConfirmHost";
import { TooltipHint } from "@/components/ui/tooltip";
import { STUDIO_COMMAND } from "@/lib/studio/commands";
import { pendingReply } from "@/lib/studio/pending-input";
import { ambiguousVideoType, bareVideoType, creationVideoType, hasEstablishedVideoContext, videoRequest, VIDEO_TYPES, type VideoIntake, type VideoType, type NewVideoRequest } from "@/lib/studio/video-requests";
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
  Paperclip,
  Palette,
  Plus,
  ScanEye,
  Scissors,
  Captions,
  WandSparkles,
  Music2,
  Video,
  RotateCcw,
  Rocket,
  BookOpen,
  MessageCircleQuestion,
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
import { StylePoster } from "@/components/studio/styles/StylesGallery";
import { SpeakButton, useSpeechInput } from "@/components/studio/SpeakButton";
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
    <TooltipHint content={part.error ?? part.name}>
      <Marker
        role={part.status === "running" ? "status" : undefined}
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
    </TooltipHint>
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
        {((message.status === "done" && message.durationMs != null) || message.usage) && (
          <MessageFooter className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-md bg-muted px-2 py-1 text-[11px] font-normal">
            {message.status === "done" && message.durationMs != null && (
              <span>
                {author && agents.length > 1 ? `${author} · ` : ""}
                Worked for {Math.round(message.durationMs / 1000)}s
                {files.size ? ` · ${files.size} file${files.size > 1 ? "s" : ""} changed` : ""}
              </span>
            )}
            {message.usage && (
              <span className="whitespace-nowrap font-medium text-foreground tabular-nums" title={`${message.usage.inputTokens.toLocaleString()} input · ${message.usage.outputTokens.toLocaleString()} output · ${message.usage.cachedInputTokens.toLocaleString()} cached input (included)`}>
                {message.usage.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </MessageFooter>
        )}
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
      <TooltipHint content={
          quiet > 20_000 ? "Big files show up when they're finished" : undefined
        }>
        <span tabIndex={0}
          className="shrink-0 tabular-nums"
        >
          {message ? formatElapsed(now - message.at) : ""}
          {quiet > 20_000 ? ` · quiet ${formatElapsed(quiet)}` : ""}
        </span>
      </TooltipHint>
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
    <TooltipHint content="Sent with every message, so you can say “here” or “this clip”">
      <span tabIndex={0}
        className="text-xs text-muted-foreground"
      >
        {agentName} sees: playhead {formatFrameTime(frame, fps)}
        {selectionCount
          ? ` · ${selectionCount} clip${selectionCount > 1 ? "s" : ""} selected`
          : ""}
      </span>
    </TooltipHint>
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
  const speech = useSpeechInput({ value: draft, onChange: setDraft, disabled: !editing });
  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed || speech.dictating) return;
    await onEdit(trimmed);
    setEditing(false);
  };
  return (
    <div className="flex w-full flex-col items-end gap-1">
      {editing ? (
        <div className="w-full space-y-1.5">
          <Textarea
            data-speech={speech.id}
            autoFocus
            value={draft}
            readOnly={speech.dictating}
            rows={3}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!speech.handleEnter()) void save();
              } else if (event.key === "Escape") {
                setEditing(false);
                setDraft(message.text ?? "");
              }
            }}
            className="min-h-16 resize-none text-[13px] md:text-[13px]"
          />
          <div className="flex justify-end gap-1">
            <SpeakButton speech={speech} className="mr-auto" />
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
              disabled={!draft.trim() || speech.dictating}
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
  separateModel = false,
}: {
  agent: AgentInfo | null;
  agents: AgentInfo[];
  onChange(id: string): void;
  model: string | null;
  onModelChange(agentId: string, model: string | null): void;
  separateModel?: boolean;
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
            : separateModel ? "" : modelLabel
              ? `· ${modelLabel}`
              : defaultLabel}
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
        {!separateModel && agent && models.length > 0 && (
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

function ModelPicker({ agent, model, onChange }: {
  agent: AgentInfo;
  model: string | null;
  onChange(agentId: string, model: string | null): void;
}) {
  const models = agent.models ?? [];
  const current = models.find((item) => item.id === (model ?? agent.defaultModel));
  return <DropdownMenu>
    <DropdownMenuTrigger className="flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-xs" aria-label="Model for next request">Model: {current?.label ?? "Default"}<ChevronDown className="size-3" /></DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuLabel>Model for next request</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={model ?? ""} onValueChange={(id) => onChange(agent.id, id || null)}>
        <DropdownMenuRadioItem value="">Default</DropdownMenuRadioItem>
        {models.map((item) => <DropdownMenuRadioItem key={item.id} value={item.id}>{item.label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

const EFFORT_LABELS: Record<string, string> = { xhigh: "Extra high" };
const effortLabel = (effort: string) =>
  EFFORT_LABELS[effort] ?? effort.charAt(0).toUpperCase() + effort.slice(1);

/** How hard the agent thinks on the next message (the CLI's own levels). */
function EffortPicker({
  agent,
  efforts,
  effort,
  onChange,
}: {
  agent: AgentInfo;
  efforts: string[];
  effort: string | null;
  onChange(agentId: string, effort: string | null): void;
}) {
  const fallback = agent.defaultEffort && efforts.includes(agent.defaultEffort) ? effortLabel(agent.defaultEffort) : null;
  return (
    <DropdownMenu>
      <TooltipHint content="Thinking level">
        <DropdownMenuTrigger
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Thinking: {effort ? effortLabel(effort) : (fallback ?? "Default")}
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
      </TooltipHint>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          Thinking level. Higher is slower and uses more of your plan.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={effort ?? ""}
          onValueChange={(value) => onChange(agent.id, value || null)}
        >
          <DropdownMenuRadioItem value="" className="text-xs">
            {fallback ? `Default (${fallback})` : "Default"}
          </DropdownMenuRadioItem>
          {efforts.map((level) => (
            <DropdownMenuRadioItem key={level} value={level} className="text-xs">
              {effortLabel(level)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ChatPanelProps {
  externalUploading?: number;
  simple?: boolean;
  selectedStyle?: { id: string; name: string } | null;
  onClearStyle?(): void;
  onOpenStyles?(): void;
  onSaveStyle?(): void;
  saveStyleDisabled?: boolean;
  onOpenStyleSpy?(): void;
  selectedMusic?: { id: string; name: string } | null;
  onClearMusic?(): void;
  onOpenMusic?(): void;
  onDraw?(): void;
  drawingAvailable?: boolean;
  drawingOpen?: boolean;
  onRecord?(): void;
  /** The project already has footage or composition content to edit. */
  hasVideo?: boolean;
  /** Images or footage in this project's assets, even when not on the timeline or attached. */
  hasLaunchMedia?: boolean;
  chat: ChatHistory;
  /** The agent that answers the next message. */
  agent: AgentInfo | null;
  /** Agents to choose from (empty when the helper can't switch). */
  agents: AgentInfo[];
  onAgentChange(id: string): void;
  /** The model picked for the agent (null: its default). */
  model: string | null;
  onModelChange(agentId: string, model: string | null): void;
  /** Thinking levels the agent offers with its model (empty: no picker). */
  efforts: string[];
  effort: string | null;
  onEffortChange(agentId: string, effort: string | null): void;
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
    options: { attachFrame: boolean; references: ChatReference[]; newVideo?: NewVideoRequest },
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
const videoIntakes = new Map<string, VideoIntake>();
const creationRequests = new Map<string, NewVideoRequest>();

function WaitingForReply({ question, onCancel, disabled }: { question: string; onCancel?(): void; disabled?: boolean }) {
  return (
    <section className="flex items-start gap-3 rounded-xl border-2 border-brand bg-card p-3 text-card-foreground" role="status" aria-live="polite" aria-label="Waiting for your reply">
      <span data-waiting-badge className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground" aria-hidden="true"><MessageCircleQuestion className="size-5" /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold">Waiting for your reply</p>
        <p className="whitespace-pre-line text-sm leading-relaxed [overflow-wrap:anywhere]">{question}</p>
      </div>
      {onCancel ? <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onCancel}>Cancel</Button> : null}
    </section>
  );
}

export function ChatPanel({
  chat,
  agent,
  agents,
  onAgentChange,
  model,
  onModelChange,
  efforts,
  effort,
  onEffortChange,
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
  simple = false,
  externalUploading = 0,
  selectedStyle,
  onClearStyle,
  onOpenStyles,
  onSaveStyle,
  saveStyleDisabled,
  onOpenStyleSpy,
  selectedMusic,
  onClearMusic,
  onOpenMusic,
  onDraw,
  drawingAvailable,
  drawingOpen,
  onRecord,
  hasVideo = false,
  hasLaunchMedia = false,
}: ChatPanelProps) {
  const attachmentInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const sendInFlight = useRef(false);
  const creationRequest = useRef<NewVideoRequest | null>(creationRequests.get(slug ?? "") ?? null);
  const [targetChoice, setTargetChoice] = useState<{ text: string; type: VideoType } | null>(null);
  const [dropping, setDropping] = useState(false);
  const [localUploading, setUploading] = useState(0);
  const uploading = localUploading + externalUploading;
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
  const [answeredQuestion, setAnsweredQuestion] = useState<string | null>(null);
  const pendingQuestion = pendingReply(chat);
  const waitingQuestion = pendingQuestion?.messageId !== answeredQuestion ? pendingQuestion : null;
  const [videoIntake, setVideoIntakeState] = useState(() => videoIntakes.get(slug ?? "") ?? null);
  const setVideoIntake = (intake: VideoIntake | null) => {
    if (intake === null) videoIntakes.delete(slug ?? "");
    else videoIntakes.set(slug ?? "", intake);
    setVideoIntakeState(intake);
  };
  const running = Boolean(chat.running);

  // Speak instead of typing; Ctrl+Space comes here when no other prompt box has the focus.
  const speech = useSpeechInput({
    value: text,
    onChange: setText,
    disabled: disabled || sending || Boolean(agent && !agent.found),
    priority: "chat",
  });
  const dictating = speech.dictating;
  const videoContext = hasVideo || references.some((reference) => reference.kind === "video");
  const inferredRequest = videoContext
    ? selectedStyle
      ? `Apply the ${selectedStyle.name} style to this video${selectedMusic ? " and add the selected background music" : ""}.`
      : selectedMusic ? "Add the selected background music to this video." : ""
    : "";
  const intakeMaterial = references.length > 0 || attachFrame
    || (videoIntake?.type === "product-launch" && (hasLaunchMedia || hasVideo));
  const requestReady = Boolean(text.trim() || (!videoIntake && inferredRequest) || (videoIntake && intakeMaterial));

  const send = async (value = text, action?: VideoType, destination?: "edit" | "new") => {
    const trimmed = value.trim() || (!action && videoIntake === null ? inferredRequest : "");
    // While the agent works, a new message waits in the queue and runs next.
    // Wait for dropped or pasted files to finish uploading, so they go with the message.
    if ((!trimmed && !action && !requestReady) || sendInFlight.current || sending || disabled || uploading || dictating || Boolean(agent && !agent.found)) return;
    const ambiguous = !action && !destination && hasVideo ? ambiguousVideoType(trimmed) : null;
    if (ambiguous) {
      setTargetChoice({ text: value, type: ambiguous });
      return;
    }
    const type = destination === "edit" ? null : action ?? videoIntake?.type ?? (waitingQuestion ? null : creationVideoType(trimmed));
    const intake = videoIntake?.type === type ? videoIntake : null;
    // Existing pictures or a finished launch do not identify a new tutorial task.
    // Current attachments are deliberate inputs; incidental project material is inspected after intake.
    const hasContext = (type !== "how-to" && (hasVideo || hasLaunchMedia)) || references.length > 0 || attachFrame
      || (type && hasEstablishedVideoContext(type, chat.messages))
      || Boolean(trimmed && !bareVideoType(trimmed));
    if (type && !hasContext) {
      setVideoIntake(intake ?? { type, request: trimmed || VIDEO_TYPES[type].request });
      // Keep the initial words in the intake, ready to combine with the answer.
      setText("");
      messageInput.current?.focus();
      return;
    }
    const request = intake !== null
      ? `${intake.request}\n\n${trimmed || "Use the supplied project material."}`
      : action ? videoRequest(action, trimmed) : trimmed;
    sendInFlight.current = true;
    setSending(true);
    // Only the chips sent with this message go; files attached while it sends wait for the next one.
    const sent = references;
    try {
      if (type && creationRequest.current?.type !== type) {
        creationRequest.current = { type, requestId: crypto.randomUUID() };
        creationRequests.set(slug ?? "", creationRequest.current);
      }
      await onSend(request, { attachFrame, references: sent, ...(type ? { newVideo: creationRequest.current! } : {}) });
      if (pendingQuestion) setAnsweredQuestion(pendingQuestion.messageId);
      creationRequest.current = null;
      creationRequests.delete(slug ?? "");
      setTargetChoice(null);
      setVideoIntake(null);
      setText("");
      setAttachFrame(false);
      onReferencesChange((current) =>
        current.filter((r) => !sent.some((s) => s.path === r.path)),
      );
    } catch {
      // toast shown by the controller
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  const agentName = agent?.name ?? "Agent";
  const agentMissing = agent && !agent.found;
  const sendAction = running ? "Press Send to queue this request." : "Press Send to start.";
  const musicSummary = selectedMusic ? selectedMusic.id === "auto" ? "choose suitable music" : `add ${selectedMusic.name}` : "";
  const readiness = disabled ? "Open a project and connect the helper to start."
    : agentMissing ? `Install ${agent.product} before you send a request.`
    : uploading ? "Adding your files. Wait for the upload to finish."
    : dictating ? "Stop voice input to review your request before you send."
    : sending ? "Sending your request…"
    : waitingQuestion ? "Add your reply and press Send."
    : !requestReady ? selectedStyle || selectedMusic
      ? "Add footage or describe your video before you send."
      : videoContext ? "Choose a style or describe what to change."
        : "Describe a video, or add footage and choose a style."
    : !text.trim() && selectedStyle ? `Ready to apply ${selectedStyle.name} to your video${musicSummary ? ` and ${musicSummary}` : ""}. ${sendAction}`
    : !text.trim() && selectedMusic ? `Ready to ${musicSummary} for your video. ${sendAction}`
    : selectedStyle || selectedMusic ? `Your request will ${[selectedStyle ? `use ${selectedStyle.name}` : "", musicSummary].filter(Boolean).join(" and ")}. ${sendAction}`
    : `Your request is ready. ${sendAction}`;
  const queuedIds = chat.messages
    .filter((m) => m.role === "user" && m.status === "queued")
    .map((m) => m.id);

  const agentControls = (
    <div className="chat-agent-controls flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-3">
          <Bot className="size-4" />
          {agents.length > 1 || (agent?.found && agent.models?.length) ? (
            <AgentPicker
              separateModel={simple}
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
          {simple && agent?.found && agent.models?.length ? <ModelPicker agent={agent} model={model} onChange={onModelChange} /> : null}
          {agent?.found && efforts.length > 0 && (
            <EffortPicker
              agent={agent}
              efforts={efforts}
              effort={effort}
              onChange={onEffortChange}
            />
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
  );

  return (
    <ChatSlugContext.Provider value={slug}>
      <div className={cn("studio-chat flex h-full min-h-0 flex-col", simple && "studio-chat-simple")}>
        {!simple ? agentControls : null}
        <div id="studio-conversation" className="chat-history min-h-0 flex-1">
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
                            onRemove={async () => {
                              const confirmed = await confirmDestructive({
                                title: "Remove this queued message?",
                                description: "It hasn't been sent, and it can't be recovered.",
                                action: "Remove message",
                              });
                              if (confirmed) onRemoveQueued(message.id);
                            }}
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
        </div>

        {running ? (
          <WorkingBar
            message={chat.messages.find((m) => m.id === chat.running)}
          />
        ) : null}
        <div className="chat-composer shrink-0 border-t border-border/60 p-2">
          <input ref={attachmentInput} type="file" multiple className="hidden" aria-label="Attach files" accept="image/*,video/*,audio/*,.ttf,.otf,.woff,.woff2" onChange={(event) => {
            if (event.target.files) void attachFiles(Array.from(event.target.files));
            event.target.value = "";
          }} />
          {videoIntake !== null ? (
            <WaitingForReply question={VIDEO_TYPES[videoIntake.type].question} disabled={sending} onCancel={() => setVideoIntake(null)} />
          ) : null}
          {!videoIntake && !targetChoice && waitingQuestion ? (
            <WaitingForReply question={waitingQuestion.question} />
          ) : null}
          {targetChoice ? (
            <div className="flex flex-col gap-2 px-2 pb-2" role="group" aria-label="Choose a video destination">
              <p role="status" className="text-sm">Should I edit this video or create a separate new video?</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => void send(targetChoice.text, undefined, "edit")}>Edit this video</Button>
                <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => void send(targetChoice.text, targetChoice.type, "new")}>Create new video</Button>
                <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => setTargetChoice(null)}>Cancel</Button>
              </div>
            </div>
          ) : null}
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
            <div className="chat-context order-first flex w-full flex-col">
            {selectedStyle ? (
              <InputGroupAddon align="block-start" className="gap-1 pb-0">
                <span className="inline-flex w-64 max-w-full items-start gap-2 rounded-xl border border-border/80 bg-background/40 p-2">
                  <button type="button" onClick={onOpenStyles} aria-label={`Change style: ${selectedStyle.name}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="pointer-events-none flex size-16 shrink-0 justify-center overflow-hidden rounded-lg bg-muted" aria-hidden="true"><span className="block h-16 w-9"><StylePoster styleId={selectedStyle.id} /></span></span>
                    <span className="flex min-w-0 flex-col gap-1"><span className="truncate text-[11px] font-medium text-foreground">{selectedStyle.name}</span><span className="text-[10px] text-muted-foreground">Style · change</span></span>
                  </button>
                  <button type="button" onClick={onClearStyle} aria-label="Remove selected style" className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3.5" /></button>
                </span>
              </InputGroupAddon>
            ) : null}
            {selectedMusic ? <InputGroupAddon align="block-start" className="gap-1 pb-0"><Badge variant="secondary" className="gap-1">
              <button type="button" onClick={onOpenMusic} aria-label={`Change music: ${selectedMusic.name}`}>Music: {selectedMusic.name}</button>
              <button type="button" onClick={onClearMusic} aria-label="Remove selected music" className="rounded p-1"><X className="size-3" /></button>
            </Badge></InputGroupAddon> : null}
            {references.length || uploading ? (
              <InputGroupAddon
                align="block-start"
                className="flex-wrap gap-2 pb-0"
              >
                {references.map((reference) => (
                  <ReferenceChip
                    key={reference.path}
                    reference={reference}
                    slug={slug}
                    showPreview
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
            </div>
            <InputGroupTextarea
              ref={messageInput}
              aria-label="Video request"
              data-speech={speech.id}
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
                  // While speaking, Enter stops and keeps the words for a look before sending.
                  if (!speech.handleEnter()) void send();
                }
              }}
              rows={3}
              disabled={disabled || sending || Boolean(agentMissing)}
              readOnly={dictating}
              placeholder={
                disabled
                  ? "Connect the studio helper to chat"
                  : dictating
                    ? "Listening… speak now"
                  : videoIntake !== null
                    ? VIDEO_TYPES[videoIntake.type].placeholder
                  : waitingQuestion
                    ? "Reply to the question above…"
                  : running
                    ? `${agentName} is working. Send the next request: it runs right after.`
                    : references.length
                      ? `What should ${agentName} do with this? (Enter to send)`
                      : simple ? "Describe your video or what to change. Add a product link or files…" : "Describe a change… drop or paste images and files to show them"
              }
              className="max-h-48 min-h-[4.5rem] text-[13px]"
            />
            <InputGroupAddon align="block-end" className={cn("chat-action-controls gap-1", simple ? "gap-3" : "flex-wrap")}>
              {simple ? <SpeakButton speech={speech} className="simple-voice" /> : null}
              <TooltipHint content="Attach files"><InputGroupButton type="button" size="icon-sm" aria-label="Attach files" disabled={disabled || uploading > 0} onClick={() => attachmentInput.current?.click()}><Paperclip /></InputGroupButton></TooltipHint>
              <TooltipHint content={`Attach the current frame so ${agentName} can see what you mean`}>
                <InputGroupButton
                  type="button"
                  size={simple ? "icon-sm" : "xs"}
                  aria-label={simple ? "Attach current frame" : undefined}
                  variant={attachFrame ? "secondary" : "ghost"}
                  onClick={() => setAttachFrame((value) => !value)}
                  disabled={disabled}
                >
                  <Camera /> {simple ? null : attachFrame ? "Frame attached" : "Attach frame"}
                </InputGroupButton>
              </TooltipHint>
              {simple ? <>
                <TooltipHint content="Record yourself"><InputGroupButton type="button" size="icon-sm" aria-label="Record yourself" onClick={onRecord} disabled={disabled}><Video /></InputGroupButton></TooltipHint>
                <TooltipHint content="Draw on video"><InputGroupButton type="button" size="icon-sm" aria-label="Draw on video" aria-pressed={drawingOpen} onClick={onDraw} disabled={disabled || !drawingAvailable}><Pencil /></InputGroupButton></TooltipHint>
              </> : <SpeakButton speech={speech} label />}
              {running ? (
                <TooltipHint content="Stop">
                  <InputGroupButton
                    type="button"
                    variant={requestReady ? "outline" : "default"}
                    size="icon-sm"
                    onClick={onCancel}
                    aria-label={`Stop ${agentName}`}
                    className="ml-auto rounded-full"
                  >
                    <Square className="fill-current" />
                  </InputGroupButton>
                </TooltipHint>
              ) : null}
              {!running || requestReady ? (
                <TooltipHint content={
                    uploading
                      ? "Adding files…"
                      : running
                        ? `Queue: runs when ${agentName} is done`
                        : "Send"
                  }>
                  <InputGroupButton
                    type="button"
                    variant="default"
                    size="icon-sm"
                    onClick={() => void send()}
                    disabled={!requestReady || sending || disabled || Boolean(agentMissing) || uploading > 0 || dictating}
                    aria-label={running ? "Queue message" : "Send"}
                    className={cn("rounded-full", !running && "ml-auto")}
                  >
                    {sending ? <Spinner /> : running ? <Clock /> : <ArrowUp />}
                  </InputGroupButton>
                </TooltipHint>
              ) : null}
            </InputGroupAddon>
          </InputGroup>
          {chat.projectTokens !== undefined && (
            <div className="px-2 pt-1 text-xs text-muted-foreground">
              Project tokens: {chat.projectTokens.toLocaleString()}
            </div>
          )}
          {!simple && (
            <div className="px-2 pt-1">
              <ContextHint frameStore={frameStore} fps={fps} selectionCount={selectionCount} />
            </div>
          )}
          {simple ? <p className="chat-readiness px-1 pt-1 pb-2 text-xs leading-relaxed text-muted-foreground" role="status" aria-live="polite">{readiness}</p> : null}
          {simple ? agentControls : null}
          <div className="flex flex-wrap justify-center gap-2 pt-2" aria-label="Video types">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || sending || Boolean(agentMissing) || uploading > 0 || dictating}
              onClick={() => void send(text, "product-launch")}
            >
              <Rocket data-icon="inline-start" /> Product Launch
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || sending || Boolean(agentMissing) || uploading > 0 || dictating}
              onClick={() => void send(text, "how-to")}
            >
              <BookOpen data-icon="inline-start" /> How-to
            </Button>
          </div>
        </div>
        {simple ? (
          <div className="simple-quick-actions flex flex-wrap justify-center gap-2" aria-label="Prepare a video request">
            <div className="simple-style-actions flex shrink-0 items-center" role="group" aria-label="Styles">
              <Button variant="outline" size="sm" className="rounded-r-none" onClick={onOpenStyles} disabled={disabled}><Palette data-icon="inline-start" /> Styles</Button>
              {onSaveStyle ? <TooltipHint content="Save current style">
                <Button type="button" variant="outline" size="icon-sm" className="rounded-l-none border-l-0" aria-label="Save current style" onClick={onSaveStyle} disabled={disabled || saveStyleDisabled}>
                  <Plus />
                </Button>
              </TooltipHint> : null}
            </div>
            <Button variant="outline" size="sm" onClick={onOpenStyleSpy} disabled={disabled}><ScanEye data-icon="inline-start" /> Style Spy</Button>
            <Button variant="outline" size="sm" onClick={onOpenMusic} disabled={disabled}><Music2 data-icon="inline-start" /> Add music</Button>
            {[
              { label: "Remove filler words", text: "Remove filler words and long pauses from this video.", icon: Scissors },
              { label: "Add captions", text: "Add clear word-by-word captions to this video.", icon: Captions },
              { label: "Make it shorter", text: "Make this video shorter. Keep the main points and a clear ending.", icon: WandSparkles },
            ].map((action) => (
              <Button key={action.label} variant="outline" size="sm" disabled={disabled} onClick={() => { setText(text.trim() ? `${text.trim()}\n${action.text}` : action.text); }}><action.icon data-icon="inline-start" />{action.label}</Button>
            ))}
          </div>
        ) : null}
      </div>
    </ChatSlugContext.Provider>
  );
}
