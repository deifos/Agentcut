"use client";

// Draw on the preview, then say what you want: "a line coming from here, to here". The agent gets
// the frame with the drawing on it and every stroke's path in composition pixels.
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowUp, Clock, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAgentName } from "@/components/studio/StudioAgent";
import { SpeakButton, useSpeechInput } from "@/components/studio/SpeakButton";
import {
  badgePositions,
  DRAW_COLOR,
  strokePath,
  type DrawStroke,
} from "@/lib/studio/drawing";

/** Pen width on screen, in CSS pixels. */
const PEN_PX = 6;

const CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="4" fill="${DRAW_COLOR}" stroke="white" stroke-width="1.5"/></svg>`,
)}") 8 8, crosshair`;

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)),
  );
}

export function DrawAsk({
  rect,
  size,
  busy,
  disabled,
  onSend,
  onClose,
}: {
  /** Where the video sits in the stage, in CSS pixels. */
  rect: { left: number; top: number; width: number; height: number };
  /** The composition size. */
  size: { width: number; height: number };
  /** The agent is working on another message: this one is queued and runs next. */
  busy: boolean;
  disabled: boolean;
  onSend(strokes: DrawStroke[], text: string): Promise<void>;
  onClose(): void;
}) {
  const agentName = useAgentName();
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [live, setLive] = useState<DrawStroke | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const surfaceRef = useRef<SVGSVGElement>(null);
  const blocked = disabled || sending;
  const speech = useSpeechInput({ value: text, onChange: setText, disabled: blocked, priority: "overlay" });
  const scale = rect.width / size.width || 1;

  // The studio's shortcuts (space plays, ⌘Z undoes the edit) would act behind the drawing:
  // while it's open, Escape closes it, ⌘Z takes back the last stroke and space does nothing.
  const latest = useRef({ strokes, text, onClose });
  useEffect(() => {
    latest.current = { strokes, text, onClose };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target);
      const mod = event.metaKey || event.ctrlKey;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        latest.current.onClose();
      } else if (mod && !event.shiftKey && event.key.toLowerCase() === "z") {
        // In the prompt box, ⌘Z undoes typing until there's nothing left to undo.
        if (typing && latest.current.text) return;
        event.preventDefault();
        event.stopPropagation();
        setStrokes((list) => list.slice(0, -1));
      } else if (event.key === " " && !typing) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const toPoint = (event: { clientX: number; clientY: number; pressure: number }, pen: boolean) => {
    const box = surfaceRef.current!.getBoundingClientRect();
    return [
      ((event.clientX - box.left) / box.width) * size.width,
      ((event.clientY - box.top) / box.height) * size.height,
      pen ? event.pressure || 0.5 : 0.5,
    ] as DrawStroke["points"][number];
  };

  const down = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    // Keep the focus in the prompt box: draw, type, draw again without clicking back.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pen = event.pointerType === "pen";
    setLive({ points: [toPoint(event, pen)], size: PEN_PX / scale, pen });
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!live) return;
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const points = (events.length ? events : [event.nativeEvent]).map((e) => toPoint(e, live.pen));
    setLive({ ...live, points: [...live.points, ...points] });
  };
  const up = () => {
    if (!live) return;
    setStrokes((list) => [...list, live]);
    setLive(null);
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || !strokes.length || blocked || speech.dictating) return;
    setSending(true);
    try {
      await onSend(strokes, trimmed);
      onClose();
    } catch {
      // the controller shows the error
      setSending(false);
    }
  };

  const badge = 9 / scale;
  const all = live ? [...strokes, live] : strokes;

  return (
    <>
      <svg
        ref={surfaceRef}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="absolute z-10 touch-none rounded-xl ring-2 ring-[#ff3b5c]/70"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          cursor: CURSOR,
          filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.45))",
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {all.map((stroke, index) => (
          <path
            key={index}
            d={strokePath(stroke, stroke !== live)}
            fill={DRAW_COLOR}
          />
        ))}
        {strokes.length > 1
          ? badgePositions(strokes, badge).map(([x, y], index) => (
              <g key={`n${index}`} transform={`translate(${x} ${y})`}>
                <circle r={badge} fill="#111" stroke={DRAW_COLOR} strokeWidth={badge * 0.18} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={badge * 1.15}
                  fontWeight={700}
                  className="pointer-events-none select-none font-sans"
                >
                  {index + 1}
                </text>
              </g>
            ))
          : null}
      </svg>
      <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-3">
        <div className="drawing-prompt w-full max-w-xl rounded-2xl border border-border/70 bg-popover/95 p-2 text-popover-foreground shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-end gap-1.5 sm:flex-nowrap">
            <Textarea
              data-speech={speech.id}
              autoFocus
              value={text}
              readOnly={speech.dictating}
              rows={1}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (!speech.handleEnter()) void send();
                }
              }}
              placeholder={
                speech.dictating
                  ? "Listening… speak now"
                  : strokes.length
                    ? `What should ${agentName} do with this?`
                    : "Draw on the video, then say or type what you want"
              }
              className="max-h-28 min-h-9 min-w-0 basis-full resize-none border-0 bg-transparent text-[13px] shadow-none focus-visible:ring-0 sm:basis-auto md:text-[13px] dark:bg-transparent"
            />
            <SpeakButton speech={speech} className="ml-auto sm:ml-0" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Undo stroke (⌘Z)"
              aria-label="Undo stroke"
              disabled={!strokes.length}
              onClick={() => setStrokes((list) => list.slice(0, -1))}
            >
              <Undo2 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Clear the drawing"
              aria-label="Clear the drawing"
              disabled={!strokes.length}
              onClick={() => setStrokes([])}
            >
              <Trash2 />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Close (Esc)"
              aria-label="Close the pencil"
              onClick={onClose}
            >
              <X />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              className="rounded-full"
              title={busy ? `${agentName} is working: this runs right after` : "Send (Enter)"}
              aria-label={busy ? "Queue" : "Send"}
              disabled={!text.trim() || !strokes.length || blocked || speech.dictating}
              onClick={() => void send()}
            >
              {sending ? <Spinner /> : busy ? <Clock /> : <ArrowUp />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
