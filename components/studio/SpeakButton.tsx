"use client";

// Speak instead of typing, in any box that writes to the agent. One box listens at a time.
// Ctrl+Space goes to the box with the focus, else the open overlay (pencil, playhead ask), else the chat:
// Hold to talk. Every release stops capture and keeps the words for review.
import { TooltipHint } from "@/components/ui/tooltip";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useDictation,
  type DictationState,
} from "@/lib/studio/audio/dictation";

/** Who gets Ctrl+Space when no box has the focus: an open overlay first, then the chat. */
export type SpeechPriority = "chat" | "overlay" | "focus";

interface Target {
  id: string;
  element(): HTMLElement | null;
  priority: SpeechPriority;
  dictating(): boolean;
  start(): void;
  stop(): Promise<void>;
}

const targets: Target[] = [];
let listening: Target | null = null;
let pressed: { target: Target } | null = null;
let listenerCount = 0;

function shortcutTarget() {
  const focused = document.activeElement;
  const buttonTarget = focused
    ?.closest("[data-speech-target]")
    ?.getAttribute("data-speech-target");
  for (let i = targets.length - 1; i >= 0; i--) {
    if (
      buttonTarget === targets[i].id ||
      (focused && targets[i].element()?.contains(focused))
    )
      return targets[i];
  }
  for (const priority of ["overlay", "chat"] as const) {
    for (let i = targets.length - 1; i >= 0; i--) {
      if (targets[i].priority === priority) return targets[i];
    }
  }
  return null;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.code !== "Space" || !event.ctrlKey || event.altKey || event.metaKey)
    return;
  // Not play/pause: the studio's Space shortcut never sees it.
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat || pressed) return;
  const target = shortcutTarget();
  if (!target) return;
  pressed = { target };
  target.start();
}

function onKeyUp(event: KeyboardEvent) {
  if (!pressed || (event.code !== "Space" && event.key !== "Control")) return;
  event.preventDefault();
  event.stopPropagation();
  const { target } = pressed;
  pressed = null;
  void target.stop();
}

function onBlur() {
  pressed = null;
  void listening?.stop();
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden") onBlur();
}

/** One box listens at a time: starting here stops the other. */
function claim(target: Target) {
  if (listening && listening !== target) void listening.stop();
  listening = target;
}

function register(target: Target) {
  targets.push(target);
  if (listenerCount++ === 0) {
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    targets.splice(targets.indexOf(target), 1);
    if (listening === target) listening = null;
    if (pressed?.target === target) pressed = null;
    void target.stop();
    if (--listenerCount === 0) {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

/** One text box that can listen: what Ctrl+Space and the mic button talk to. */
class SpeechTarget implements Target {
  priority: SpeechPriority = "focus";
  disabled = false;
  isDictating = false;
  value = "";
  /** What was in the box when you started: the words land after it. */
  base = "";
  onChange: (value: string) => void = () => {};
  startDictation: () => Promise<void> = async () => {};
  stopDictation: () => Promise<void> = async () => {};
  stopping: Promise<void> | null = null;
  /** The text box carries `data-speech={id}`. */
  id = "";

  element() {
    return document.querySelector<HTMLElement>(
      `[data-speech="${CSS.escape(this.id)}"]`,
    );
  }
  dictating() {
    return this.isDictating;
  }
  start() {
    if (this.isDictating || this.stopping || this.disabled) return;
    claim(this);
    this.isDictating = true;
    this.base = this.value;
    this.startDictation().catch((error: unknown) => {
      this.isDictating = false;
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't start the microphone.",
      );
    });
  }
  stop() {
    if (this.stopping) return this.stopping;
    this.stopping = this.stopDictation()
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Couldn't finish speech input.",
        );
      })
      .finally(() => {
        this.isDictating = false;
        this.stopping = null;
        if (listening === this) listening = null;
      });
    return this.stopping;
  }
  write(spoken: string) {
    const before = this.base.replace(/\s+$/, "");
    const next = !spoken.trim()
      ? this.base
      : before
        ? `${before} ${spoken}`
        : spoken;
    this.value = next;
    this.onChange(next);
  }
}

export interface SpeechInput {
  /** Put on the text box as `data-speech`: Ctrl+Space goes to the box with the focus. */
  id: string;
  state: DictationState;
  progress: number | null;
  dictating: boolean;
  disabled: boolean;
  start(): void;
  stop(): Promise<void>;
  /** Call on Enter: while listening it stops (the words stay to read before sending) and returns true. */
  handleEnter(): boolean;
}

export function useSpeechInput({
  value,
  onChange,
  disabled = false,
  priority = "focus",
}: {
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  priority?: SpeechPriority;
}): SpeechInput {
  const id = useId();
  const [target] = useState(() => new SpeechTarget());
  const dictation = useDictation({
    onText: (spoken) => target.write(spoken),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Speech recognition failed.",
      ),
    enabled: !disabled,
  });
  const dictating = dictation.state !== "idle";
  useEffect(() => {
    Object.assign(target, {
      id,
      value,
      onChange,
      disabled,
      priority,
      isDictating: dictating,
      startDictation: dictation.start,
      stopDictation: dictation.stop,
    });
  });
  useEffect(
    () => (disabled ? undefined : register(target)),
    [target, disabled],
  );

  return {
    id,
    state: dictation.state,
    progress: dictation.progress,
    dictating,
    disabled,
    start: () => target.start(),
    stop: () => target.stop(),
    handleEnter: () => {
      if (!dictating) return false;
      void target.stop();
      return true;
    },
  };
}

/** The mic button for a box using `useSpeechInput`; `label` shows the state next to it. */
export function SpeakButton({
  speech,
  label = true,
  className,
}: {
  speech: SpeechInput;
  label?: boolean;
  className?: string;
}) {
  const { state, progress, dictating } = speech;
  const pointer = useRef<number | null>(null);
  const key = useRef<string | null>(null);
  const latest = useRef(speech);
  useEffect(() => {
    latest.current = speech;
  });
  const hintId = useId();
  useEffect(() => {
    const release = () => {
      if (pointer.current === null && key.current === null) return;
      pointer.current = null;
      key.current = null;
      void latest.current.stop();
    };
    const pointerEnd = (event: PointerEvent) => {
      if (event.pointerId === pointer.current) release();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") release();
    };
    window.addEventListener("pointerup", pointerEnd);
    window.addEventListener("pointercancel", pointerEnd);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pointerup", pointerEnd);
      window.removeEventListener("pointercancel", pointerEnd);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hidden);
      release();
    };
  }, []);
  const busy = state === "loading" || state === "finishing";
  const text =
    state === "loading"
      ? progress !== null
        ? `Loading voice ${Math.round(progress)}%`
        : "Loading voice…"
      : state === "listening"
        ? "Listening"
        : state === "finishing"
          ? "Processing…"
          : "Hold to record";
  return (
    <>
      <TooltipHint content={`${text}. Hold the microphone or Ctrl+Space to speak. Release to keep the words. On a focused button, hold Space or Enter. Speech stays on this computer.`}>
        <Button
          type="button"
          variant={dictating ? "secondary" : "ghost"}
          size={label ? "xs" : "icon-sm"}
          data-speech-target={speech.id}
          data-speech-state={state}
          onClick={(event) => event.preventDefault()}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (
              event.button !== 0 ||
              !event.isPrimary ||
              pointer.current !== null ||
              key.current !== null ||
              speech.disabled ||
              dictating
            )
              return;
            event.preventDefault();
            pointer.current = event.pointerId;
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* Window release also ends the hold. */
            }
            speech.start();
          }}
          onPointerUp={(event) => {
            if (pointer.current !== event.pointerId) return;
            pointer.current = null;
            void speech.stop();
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            if (pointer.current !== null) {
              pointer.current = null;
              void speech.stop();
            }
          }}
          onLostPointerCapture={() => {
            if (pointer.current !== null) {
              pointer.current = null;
              void speech.stop();
            }
          }}
          onKeyDown={(event) => {
            if (
              !["Space", "Enter", "NumpadEnter"].includes(event.code) ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            if (
              event.repeat ||
              key.current !== null ||
              pointer.current !== null ||
              dictating
            )
              return;
            key.current = event.code;
            speech.start();
          }}
          onKeyUp={(event) => {
            if (key.current !== event.code) return;
            event.preventDefault();
            event.stopPropagation();
            key.current = null;
            void speech.stop();
          }}
          onBlur={() => {
            if (key.current !== null) {
              key.current = null;
              void speech.stop();
            }
          }}
          disabled={speech.disabled || state === "finishing"}
          aria-pressed={dictating}
          aria-busy={busy}
          aria-label={text}
          aria-describedby={hintId}
          aria-keyshortcuts="Control+Space"
          className={cn(
            "speech-button relative touch-none select-none shrink-0",
            className,
          )}
        >
          <span className="relative inline-flex shrink-0" aria-hidden="true">
            <Mic className="speech-mic size-4" />
            {busy ? (
              <Spinner
                aria-hidden="true"
                role={undefined}
                className="speech-processing absolute -right-1.5 -bottom-1.5 size-2.5 motion-reduce:animate-none"
              />
            ) : null}
          </span>
          {state === "listening" ? (
            <span
              aria-hidden="true"
              className="absolute top-0 right-0 size-2 rounded-full border border-current bg-current animate-pulse motion-reduce:animate-none"
            />
          ) : null}
        {label ? (state === "loading" ? "Loading…" : text) : null}
        </Button>
      </TooltipHint>
      <span id={hintId} className="sr-only">
        Hold to speak, then release to keep the words. Hold Ctrl+Space, or hold
        Space or Enter while the button has focus. Nothing is sent
        automatically.
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {dictating ? text : ""}
      </span>
    </>
  );
}

/** A form text box with the mic in its corner, for fields that describe the video to the agent. */
export function SpeechTextarea({
  value,
  onValueChange,
  speechPriority = "focus",
  onDictatingChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string;
  onValueChange(value: string): void;
  /** "overlay": Ctrl+Space comes here while this dialog is open, even without the focus. */
  speechPriority?: SpeechPriority;
  onDictatingChange?(dictating: boolean): void;
}) {
  const speech = useSpeechInput({
    value,
    onChange: onValueChange,
    disabled: Boolean(props.disabled || props.readOnly),
    priority: speechPriority,
  });
  const notify = useEffectEvent((dictating: boolean) =>
    onDictatingChange?.(dictating),
  );
  useEffect(() => {
    notify(speech.dictating);
    return () => notify(false);
  }, [speech.dictating]);
  return (
    <div className="relative">
      <Textarea
        {...props}
        data-speech={speech.id}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        readOnly={speech.dictating || props.readOnly}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            speech.handleEnter()
          ) {
            event.preventDefault();
            return;
          }
          props.onKeyDown?.(event);
        }}
        className={cn("pb-10", className)}
      />
      <div className="absolute bottom-1 right-1">
        <SpeakButton speech={speech} />
      </div>
    </div>
  );
}
