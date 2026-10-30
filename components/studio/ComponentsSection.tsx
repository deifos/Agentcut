"use client";

// The component library in the Assets tab: a grid of stills (playing on hover); click one to
// preview it, add it at the playhead, or ask the agent to use it. Everything here goes through
// layers.json like a scene clip.
import { TooltipHint } from "@/components/ui/tooltip";
import { useState } from "react";
import { ArrowUp, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAgentName } from "@/components/studio/StudioAgent";
import { SpeakButton, useSpeechInput } from "@/components/studio/SpeakButton";
import {
  ComponentPlayer,
  ComponentThumb,
} from "@/components/motion/ComponentPlayer";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import { addClip, uniqueClipId } from "@/lib/studio/edit";
import type { FrameStore } from "@/lib/studio/frame-store";
import type { StudioClip, StudioDoc, StudioLayers } from "@/lib/studio/types";
import {
  COMPONENT_CATEGORIES,
  MOTION_COMPONENTS,
  type ComponentMeta,
} from "@/motion/components";

const ALL = "All";
const ALL_METAS = Object.values(MOTION_COMPONENTS).map((entry) => entry.meta);
// Categories that have components, in the library's order.
const CATEGORIES = COMPONENT_CATEGORIES.filter((category) =>
  ALL_METAS.some((meta) => meta.category === category),
);

/** "0:03" from seconds. */
function formatSeconds(seconds: number) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function ideasFor(meta: ComponentMeta) {
  switch (meta.category) {
    case "Talking Head":
      return [
        `Add a ${meta.name} here, timed to what I'm saying`,
        `Use the ${meta.name} wherever it fits in this video`,
      ];
    case "Text & Titles":
      return [
        `Use the ${meta.name} for the opening title`,
        `Use the ${meta.name} for every section title`,
      ];
    case "Overlays":
      return [
        `Add a ${meta.name} here`,
        `Add a ${meta.name} for each person or feature`,
      ];
    case "Charts & Stats":
      return [
        `Show our key number here with the ${meta.name}`,
        `Add a row of stats with the ${meta.name}`,
      ];
    case "AI & Product":
      return [`Use the ${meta.name} to show what the user asks here`];
    default:
      return [`Use the ${meta.name} here`];
  }
}

function ComponentItem({
  meta,
  doc,
  frameStore,
  readOnly,
  chatBusy,
  chatDisabled,
  onCommit,
  onSelect,
  onAsk,
}: {
  meta: ComponentMeta;
  doc: StudioDoc;
  frameStore: FrameStore;
  readOnly: boolean;
  chatBusy: boolean;
  chatDisabled: boolean;
  onCommit(layers: StudioLayers): void;
  onSelect(ids: string[]): void;
  onAsk(text: string): Promise<void>;
}) {
  const agentName = useAgentName();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tileRef, inView] = useInView<HTMLButtonElement>();
  const [example, setExample] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const speech = useSpeechInput({ value: text, onChange: setText, disabled: !open || chatDisabled || sending !== null });
  const variant =
    doc.project?.variants?.mobile && !doc.project?.variants?.wide
      ? "mobile"
      : "wide";
  const props = meta.examples[example]?.props ?? {};

  const add = () => {
    if (!doc.layers || !doc.project || readOnly) return;
    const from = Math.min(
      frameStore.get(),
      Math.max(0, doc.project.durationInFrames - 1),
    );
    const id = uniqueClipId(doc.layers, meta.id);
    const clip = {
      id,
      name: meta.name,
      from,
      duration: Math.min(
        meta.durationInFrames,
        Math.max(1, doc.project.durationInFrames - from),
      ),
      component: meta.id,
      props: { ...props },
    } as unknown as StudioClip;
    const result = addClip(doc.layers, "scene", clip, { trackName: "Motion" });
    onCommit(result.layers);
    onSelect([id]);
    setOpen(false);
  };

  const send = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || chatDisabled || sending || speech.dictating) return;
    setSending(trimmed);
    try {
      await onAsk(
        `${trimmed}\n\n(Library component "${meta.id}"${example > 0 ? `, the "${meta.examples[example].name}" example: ${JSON.stringify(props)}` : ""}.)`,
      );
      setText("");
      setOpen(false);
    } catch {
      // the controller shows the error
    } finally {
      setSending(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <TooltipHint content={`${meta.name} · ${meta.category}`}>
          <button
            ref={tileRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="group flex w-full min-w-0 flex-col gap-1 text-left"
          >
            <span
              className={cn(
                "relative block w-full overflow-hidden rounded-lg bg-[#0b0d10] ring-1 ring-border transition-shadow group-hover:ring-2 group-hover:ring-foreground/40",
                open && "ring-2 ring-foreground",
              )}
            >
              {/* A still until it's on screen; plays while hovered. */}
              {hovered && !open ? (
                <ComponentPlayer id={meta.id} props={props} />
              ) : inView ? (
                <ComponentThumb id={meta.id} props={props} />
              ) : (
                <span className="block aspect-video" />
              )}
              <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 font-mono text-[9px] leading-4 text-white tabular-nums">
                {formatSeconds(meta.durationInFrames / 30)}
              </span>
            </span>
            <span className="truncate text-[11px] font-medium leading-tight">
              {meta.name}
            </span>
          </button>
        </TooltipHint>
      </PopoverAnchor>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={14}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[400px] max-w-[calc(100vw-24px)] space-y-2.5 rounded-xl p-3"
      >
        <div>
          <p className="text-[13px] font-semibold">{meta.name}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {meta.description}
          </p>
        </div>
        <div className="overflow-hidden rounded-lg ring-1 ring-border/60">
          {open ? (
            <ComponentPlayer id={meta.id} props={props} aspect={variant} />
          ) : null}
        </div>
        {meta.examples.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {meta.examples.map((ex, index) => (
              <Button
                key={ex.name}
                type="button"
                size="xs"
                variant={index === example ? "secondary" : "outline"}
                onClick={() => setExample(index)}
                className="h-6 rounded-full px-2 text-[10px] font-normal"
              >
                {ex.name}
              </Button>
            ))}
          </div>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={readOnly || !doc.layers}
          onClick={add}
          className="w-full"
        >
          <Plus /> Add at the playhead
        </Button>
        <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-2">
          <div className="flex flex-col gap-1">
            {ideasFor(meta).map((idea) => (
              <Button
                key={idea}
                type="button"
                variant="outline"
                size="sm"
                disabled={chatDisabled || sending !== null}
                onClick={() => void send(idea)}
                className="h-auto justify-start whitespace-normal py-1.5 text-left text-[12px] font-normal"
              >
                {sending === idea ? <Spinner /> : null}
                {idea}
              </Button>
            ))}
          </div>
          <div className="flex items-end gap-1.5">
            <Textarea
              data-speech={speech.id}
              value={text}
              readOnly={speech.dictating}
              rows={2}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (!speech.handleEnter()) void send(text);
                }
              }}
              placeholder={`Ask ${agentName} to use the ${meta.name}…`}
              className="min-h-12 resize-none bg-background text-[13px] md:text-[13px]"
            />
            <SpeakButton speech={speech} />
            <Button
              type="button"
              size="icon-sm"
              className="shrink-0 rounded-full"
              disabled={!text.trim() || chatDisabled || sending !== null || speech.dictating}
              onClick={() => void send(text)}
              aria-label={chatBusy ? "Queue" : "Send"}
            >
              {sending && sending === text.trim() ? (
                <Spinner />
              ) : chatBusy ? (
                <Clock />
              ) : (
                <ArrowUp />
              )}
            </Button>
          </div>
          {chatBusy ? (
            <p className="text-[10px] text-muted-foreground">
              {agentName} is working: this runs right after.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ComponentsSection(props: {
  doc: StudioDoc;
  frameStore: FrameStore;
  readOnly: boolean;
  chatBusy: boolean;
  chatDisabled: boolean;
  query: string;
  onCommit(layers: StudioLayers): void;
  onSelect(ids: string[]): void;
  onAsk(text: string): Promise<void>;
}) {
  const [category, setCategory] = useState(ALL);
  const words = props.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = ALL_METAS.filter((meta) =>
    words.every((word) =>
      `${meta.name} ${meta.category} ${meta.tags.join(" ")}`
        .toLowerCase()
        .includes(word),
    ),
  );
  if (matching.length === 0) return null;
  const shown = matching.filter(
    (meta) => category === ALL || meta.category === category,
  );
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1">
        {[ALL, ...CATEGORIES].map((name) => (
          <Button
            key={name}
            type="button"
            size="xs"
            variant={category === name ? "default" : "secondary"}
            onClick={() => setCategory(name)}
            aria-pressed={category === name}
            className="rounded-full px-2.5 text-[11px] font-medium"
          >
            {name}
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          No {category.toLowerCase()} components match.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-x-2 gap-y-2.5">
          {shown.map((meta) => (
            <ComponentItem key={meta.id} meta={meta} {...props} />
          ))}
        </div>
      )}
    </div>
  );
}

export const COMPONENT_COUNT = ALL_METAS.length;
