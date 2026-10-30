"use client";

// "Ask here": a small bubble on the playhead. The request goes to the agent with the exact
// time and a snapshot of that frame, so "here" means this spot in the video.
import { TooltipHint } from "@/components/ui/tooltip";
import { memo, useState } from "react";
import { ArrowUp, Clock, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAgentName } from "@/components/studio/StudioAgent";
import { SpeakButton, useSpeechInput } from "@/components/studio/SpeakButton";
import { formatFrameTime } from "@/lib/studio/format";
import type { FrameStore } from "@/lib/studio/frame-store";

const IDEAS = [
  "Fade in from black here",
  "Add a whoosh here",
  "Make this moment hit harder",
  "Change the text here",
];

/** Memoized and reads the frame only when it opens: it rides on the playhead, so it must not re-render 30×/s. */
export const PlayheadAsk = memo(function PlayheadAsk({
  frameStore,
  fps,
  busy,
  disabled,
  onAsk,
}: {
  frameStore: FrameStore;
  fps: number;
  /** The agent is working on another message: this one is queued and runs next. */
  busy: boolean;
  disabled: boolean;
  onAsk(frame: number, text: string): Promise<void>;
}) {
  const agentName = useAgentName();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  // Freeze the time when the bubble opens, so scrubbing behind it doesn't change the target.
  const [at, setAt] = useState(() => frameStore.get());
  const blocked = disabled || sending;
  const speech = useSpeechInput({
    value: text,
    onChange: setText,
    disabled: !open || blocked,
    priority: "overlay",
  });

  const send = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || blocked || speech.dictating) return;
    setSending(true);
    try {
      await onAsk(at, trimmed);
      setText("");
      setOpen(false);
    } catch {
      // the controller shows the error
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setAt(frameStore.get());
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <TooltipHint content={`Ask ${agentName} about this moment`}>
          <Button
            type="button"
            size="icon-xs"
            aria-label={`Ask ${agentName} about this moment`}
            onPointerDown={(event) => event.stopPropagation()}
            className="pointer-events-auto size-5 rounded-full rounded-bl-none bg-foreground text-background shadow-md hover:bg-foreground/85 [&_svg:not([class*='size-'])]:size-3"
          >
            <MessageSquarePlus />
          </Button>
        </TooltipHint>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-80 space-y-2 rounded-xl p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        // The popover renders in a portal, but React still bubbles its events up the component
        // tree, into the timeline ruler, whose pointerdown scrubs the playhead. Keep them here.
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <p className="text-[11px] font-semibold">
          At{" "}
          <span className="font-mono text-foreground">
            {formatFrameTime(at, fps)}
          </span>
          <span className="font-normal text-muted-foreground">
            {" "}
            · frame {at} · {agentName} also sees this frame
          </span>
        </p>
        <Textarea
          data-speech={speech.id}
          autoFocus
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
          placeholder="What should happen here? e.g. “change the background to black and fade in”"
          className="min-h-14 resize-none text-[13px] md:text-[13px]"
        />
        <div className="flex flex-wrap gap-1">
          {IDEAS.map((idea) => (
            <Button
              key={idea}
              type="button"
              variant="outline"
              size="xs"
              disabled={blocked}
              onClick={() => setText(idea)}
              className="rounded-full text-[11px] font-normal"
            >
              {idea}
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {busy
              ? `${agentName} is working: this runs right after.`
              : "Enter to send · hold Ctrl+Space to speak"}
          </span>
          <SpeakButton speech={speech} className="ml-auto" />
          <Button
            type="button"
            size="icon-sm"
            className="rounded-full"
            disabled={!text.trim() || blocked || speech.dictating}
            onClick={() => void send(text)}
            aria-label={busy ? "Queue" : "Send"}
          >
            {sending ? <Spinner /> : busy ? <Clock /> : <ArrowUp />}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
});
