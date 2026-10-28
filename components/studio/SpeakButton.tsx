"use client";

// Speak instead of typing, in any box that writes to the agent. One box listens at a time.
// Ctrl+Space goes to the box with the focus, else the open overlay (pencil, playhead ask), else the chat:
// hold to talk, or tap to start and tap again to stop.
import {
  useEffect,
  useEffectEvent,
  useId,
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
  element(): HTMLElement | null;
  priority: SpeechPriority;
  dictating(): boolean;
  start(): void;
  stop(): Promise<void>;
}

const targets: Target[] = [];
let listening: Target | null = null;
let pressed: { target: Target; at: number } | null = null;
let listenerCount = 0;

function shortcutTarget() {
  const focused = document.activeElement;
  for (let i = targets.length - 1; i >= 0; i--) {
    if (focused && targets[i].element()?.contains(focused)) return targets[i];
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
  if (event.repeat) return;
  if (listening?.dictating()) {
    void listening.stop();
    return;
  }
  const target = shortcutTarget();
  if (!target) return;
  pressed = { target, at: performance.now() };
  target.start();
}

function onKeyUp(event: KeyboardEvent) {
  if (!pressed || (event.code !== "Space" && event.key !== "Control")) return;
  const { target, at } = pressed;
  pressed = null;
  if (performance.now() - at > 350) void target.stop();
}

function onBlur() {
  if (!pressed) return;
  const { target } = pressed;
  pressed = null;
  void target.stop();
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
  }
  return () => {
    targets.splice(targets.indexOf(target), 1);
    if (listening === target) listening = null;
    if (pressed?.target === target) pressed = null;
    if (--listenerCount === 0) {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
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
    if (this.isDictating || this.disabled) return;
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
    return this.stopDictation();
  }
  write(spoken: string) {
    const before = this.base.replace(/\s+$/, "");
    this.onChange(before && spoken ? `${before} ${spoken}` : before || spoken);
  }
}

export interface SpeechInput {
  /** Put on the text box as `data-speech`: Ctrl+Space goes to the box with the focus. */
  id: string;
  state: DictationState;
  progress: number | null;
  dictating: boolean;
  disabled: boolean;
  toggle(): void;
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
    toggle: () => {
      if (dictating) void dictation.stop();
      else target.start();
    },
    handleEnter: () => {
      if (!dictating) return false;
      void dictation.stop();
      return true;
    },
  };
}

/** The mic button for a box using `useSpeechInput`; `label` shows the state next to it. */
export function SpeakButton({
  speech,
  label = false,
  className,
}: {
  speech: SpeechInput;
  label?: boolean;
  className?: string;
}) {
  const { state, progress, dictating } = speech;
  const busy = state === "loading" || state === "finishing";
  const text =
    state === "loading"
      ? progress !== null
        ? `Loading voice ${Math.round(progress)}%`
        : "Loading voice…"
      : state === "listening"
        ? "Listening"
        : state === "finishing"
          ? "Finishing…"
          : "Speak";
  return (
    <Button
      type="button"
      variant={dictating ? "secondary" : "ghost"}
      size={label ? "xs" : "icon-sm"}
      onClick={speech.toggle}
      // Keep the focus in the box, so Enter and Ctrl+Space keep going to it.
      onMouseDown={(event) => event.preventDefault()}
      disabled={speech.disabled || state === "finishing"}
      aria-pressed={dictating}
      aria-label={label ? undefined : text}
      title={
        dictating
          ? "Stop and keep the words (or release Ctrl+Space)"
          : "Speak instead of typing: click, or hold Ctrl+Space. Runs on this computer."
      }
      className={cn("shrink-0", className)}
    >
      {busy ? <Spinner /> : <Mic className={cn(dictating && "text-red-500")} />}
      {label ? text : null}
    </Button>
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
        className={cn("pr-9", className)}
      />
      <SpeakButton speech={speech} className="absolute top-1 right-1 size-7" />
    </div>
  );
}
