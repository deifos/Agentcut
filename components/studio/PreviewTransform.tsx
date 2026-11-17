"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { PlayerRef } from "@remotion/player";
import { toast } from "sonner";
import { getMotionStyle, resolveComponentProps } from "@/motion/components";
import { clearLiveClip, setLiveClip } from "@/motion/components/live-clip";
import { cn } from "@/lib/utils";
import { useAgentName } from "@/components/studio/StudioAgent";
import { findClip } from "@/lib/studio/edit";
import type { FrameStore } from "@/lib/studio/frame-store";
import { clipClasses, contentRect, textAt, textsAround } from "@/lib/studio/preview-dom";
import {
  boxContains,
  clipBox,
  dragBox,
  FULL_BOX,
  isBoxKind,
  matchTextLeaf,
  patchClipForVariant,
  RESIZE_HANDLES,
  setAtPath,
  snapMove,
  textLeaves,
  transformForRect,
  viewClip,
  type PropPath,
  type SnapGuides,
  type TransformHandle,
} from "@/lib/studio/transform";
import type {
  Box,
  SceneClip,
  StudioClip,
  StudioLayers,
  StudioProject,
  TextClip,
} from "@/lib/studio/types";

/** Screen pixels the pointer travels before a press becomes a drag. */
const DRAG_START = 3;
/** Screen pixels within which a moved clip snaps to the frame's edges and centre. */
const SNAP = 6;

const HANDLE_STYLE: Record<
  (typeof RESIZE_HANDLES)[number],
  { left: string; top: string; cursor: string }
> = {
  nw: { left: "0%", top: "0%", cursor: "nwse-resize" },
  n: { left: "50%", top: "0%", cursor: "ns-resize" },
  ne: { left: "100%", top: "0%", cursor: "nesw-resize" },
  e: { left: "100%", top: "50%", cursor: "ew-resize" },
  se: { left: "100%", top: "100%", cursor: "nwse-resize" },
  s: { left: "50%", top: "100%", cursor: "ns-resize" },
  sw: { left: "0%", top: "100%", cursor: "nesw-resize" },
  w: { left: "0%", top: "50%", cursor: "ew-resize" },
};
const CORNERS = RESIZE_HANDLES.filter((handle) => handle.length === 2);

function percentBox(box: Box) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}

function defaultFontSize(frameHeight: number) {
  return Math.round(frameHeight * 0.07);
}

function sameBox(a: Box | null, b: Box | null) {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** The props a scene clip is drawn with: a library component's include its defaults. */
function sceneValues(clip: SceneClip, styleId: string | undefined): Record<string, unknown> {
  return clip.component
    ? (resolveComponentProps(clip.component, clip.props, styleId) as Record<string, unknown>)
    : (clip.props ?? {});
}

interface PropEdit {
  id: string;
  path: PropPath;
  text: string;
  /** Where the text sits, in frame fractions. */
  anchor: Box;
}

export interface PreviewTransformProps {
  layers: StudioLayers;
  project: StudioProject;
  variant: string;
  /** The composition in its own pixels. */
  size: { width: number; height: number };
  /** Where the composition sits on screen, inside the preview container. */
  rect: { left: number; top: number; width: number; height: number };
  /** The element the player draws in: scenes are found and measured there. */
  stageRef: RefObject<HTMLElement | null>;
  /** The helper's runtime draws `clip.transform` (older helpers don't, so scenes stay put). */
  canMoveScenes: boolean;
  selection: string[];
  frameStore: FrameStore;
  playerRef: RefObject<PlayerRef | null>;
  /** The text clip being retyped in place (the preview holds it, so "Add text" can start it). */
  typing: string | null;
  onTypingChange(id: string | null): void;
  onSelect(ids: string[]): void;
  onCommit(layers: StudioLayers, base?: StudioLayers): void;
}

/**
 * Editing by hand on the picture: click text or a picture to select its clip, drag to move it,
 * pull a handle to resize it, double-click text to retype it. Text, image and video clips change
 * their box; scenes and components move and scale as a whole.
 */
export function PreviewTransform({
  layers,
  project,
  variant,
  size,
  rect,
  stageRef,
  canMoveScenes,
  selection,
  frameStore,
  playerRef,
  typing,
  onTypingChange: setTyping,
  onSelect,
  onCommit,
}: PreviewTransformProps) {
  const agentName = useAgentName();
  const layerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; box: Box; guides: SnapGuides } | null>(null);
  const [propEdit, setPropEdit] = useState<PropEdit | null>(null);
  const stopGesture = useRef<(() => void) | null>(null);
  useEffect(() => () => stopGesture.current?.(), []);

  const classes = useMemo(
    () => clipClasses(layers.tracks.flatMap((track) => (track.clips as StudioClip[]).map((clip) => clip.id))),
    [layers],
  );

  const location = selection.length === 1 ? findClip(layers, selection[0]) : null;
  const view = location ? viewClip(location.clip, variant) : null;
  const kind = location?.track.kind;
  const sceneId = location && kind === "scene" ? location.clip.id : null;

  // A scene has no box: follow what it draws, frame by frame.
  const [measured, setMeasured] = useState<{ id: string; box: Box | null; onScreen: boolean } | null>(null);
  useEffect(() => {
    if (!sceneId) return;
    let raf = 0;
    const tick = () => {
      const stage = stageRef.current;
      const clip = findClip(layers, sceneId)?.clip;
      const frame = frameStore.get();
      const onScreen = Boolean(clip && frame >= clip.from && frame < clip.from + clip.duration);
      const box = stage && onScreen ? contentRect(stage, sceneId) : null;
      setMeasured((previous) =>
        previous && previous.id === sceneId && previous.onScreen === onScreen && sameBox(previous.box, box)
          ? previous
          : { id: sceneId, box, onScreen },
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sceneId, layers, frameStore, stageRef]);

  let savedBox: Box | null = null;
  if (location && view && kind) {
    if (isBoxKind(kind)) savedBox = clipBox(kind, view);
    else if (sceneId && measured?.id === sceneId && measured.onScreen) savedBox = measured.box ?? FULL_BOX;
  }
  const selected =
    location && view && kind && savedBox
      ? {
          id: location.clip.id,
          kind,
          view,
          fixed: Boolean(location.track.locked) || (kind === "scene" && !canMoveScenes),
        }
      : null;
  const box = selected && drag?.id === selected.id ? drag.box : savedBox;
  const typingClip =
    selected && typing === selected.id && selected.kind === "text" ? (selected.view as TextClip) : null;
  const editingProp =
    selected && propEdit?.id === selected.id && selected.kind === "scene" ? propEdit : null;

  const pointIn = (event: { clientX: number; clientY: number }) => {
    const bounds = layerRef.current?.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height) return null;
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  };

  /** What the pointer is on: the text right under it, else the topmost clip whose content is there. */
  const pick = (event: { clientX: number; clientY: number }): { id: string; element?: Element; root?: Element } | null => {
    const point = pointIn(event);
    if (!point) return null;
    const frame = frameStore.get();
    const stage = stageRef.current;
    if (stage) {
      for (const hit of textAt(stage, event.clientX, event.clientY, classes)) {
        const found = findClip(layers, hit.id);
        if (!found || found.track.hidden || found.track.locked) continue;
        if (frame < found.clip.from || frame >= found.clip.from + found.clip.duration) continue;
        return hit;
      }
    }
    // The first track is drawn last, so it is on top.
    for (const track of layers.tracks) {
      if (track.hidden || track.locked) continue;
      if (!isBoxKind(track.kind) && track.kind !== "scene") continue;
      for (const clip of track.clips as StudioClip[]) {
        if (frame < clip.from || frame >= clip.from + clip.duration) continue;
        const area = isBoxKind(track.kind)
          ? clipBox(track.kind, viewClip(clip, variant))
          : stage
            ? contentRect(stage, clip.id)
            : null;
        if (area && boxContains(area, point.x, point.y)) return { id: clip.id };
      }
    }
    return null;
  };

  /** Follow the pointer until it is released. `onClick` runs if it never moved. */
  const begin = (
    event: ReactPointerEvent,
    handle: TransformHandle,
    clipId: string,
    start: Box,
    onClick?: () => void,
  ) => {
    const target = findClip(layers, clipId);
    if (!target || !rect.width || !rect.height) return;
    const targetKind = target.track.kind;
    const fixed = Boolean(target.track.locked) || (targetKind === "scene" && !canMoveScenes);
    const clip = viewClip(target.clip, variant);
    event.preventDefault();
    const corner = handle.length === 2;
    const scene = targetKind === "scene" ? (clip as SceneClip) : null;
    const textStyle = targetKind === "text" ? ((clip as TextClip).style ?? {}) : null;
    const fontSize = textStyle?.fontSize ?? defaultFontSize(size.height);
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let fields: Partial<StudioClip> | null = null;

    const move = (e: PointerEvent) => {
      if (fixed) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_START) return;
        moved = true;
        // The clip is edited on one frame: hold the picture still under the pointer.
        playerRef.current?.pause();
      }
      // Text and scenes always scale evenly from a corner; Shift frees a picture's shape.
      const keepRatio = corner && (targetKind !== "image" && targetKind !== "video" ? true : !e.shiftKey);
      let next = dragBox(start, handle, dx / rect.width, dy / rect.height, keepRatio);
      let guides: SnapGuides = {};
      if (handle === "move" && !e.metaKey && !e.ctrlKey) {
        const snapped = snapMove(next.box, SNAP / rect.width, SNAP / rect.height);
        next = { ...next, box: snapped.box };
        guides = snapped.guides;
      }
      if (scene) {
        fields = { transform: transformForRect(scene.transform, start, next.box) } as Partial<StudioClip>;
      } else {
        fields = { box: next.box } as Partial<StudioClip>;
        if (textStyle && corner) {
          fields = {
            ...fields,
            style: { ...textStyle, fontSize: Math.max(4, Math.round(fontSize * next.scale)) },
          } as Partial<StudioClip>;
        }
      }
      setLiveClip(clipId, fields);
      setDrag({ id: clipId, box: next.box, guides });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      stopGesture.current = null;
      clearLiveClip(clipId);
      setDrag(null);
    };
    const end = (e: PointerEvent) => {
      if (moved && fields && e.type === "pointerup") {
        onCommit(
          patchClipForVariant(layers, clipId, fields, variant, project.defaultVariant),
          layers,
        );
      } else if (!moved && e.type === "pointerup") {
        onClick?.();
      }
      stop();
    };
    stopGesture.current?.();
    stopGesture.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  /** Where a clip is right now, to start a drag from. */
  const areaOf = (clipId: string): Box | null => {
    const found = findClip(layers, clipId);
    if (!found) return null;
    if (isBoxKind(found.track.kind)) return clipBox(found.track.kind, viewClip(found.clip, variant));
    if (found.track.kind !== "scene") return null;
    const stage = stageRef.current;
    return (stage ? contentRect(stage, clipId) : null) ?? FULL_BOX;
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    const point = pointIn(event);
    if (!point) return;
    const hit = pick(event);
    if (selected && box && boxContains(box, point.x, point.y)) {
      // A drag moves the selection even under another clip; a plain click picks what's on top.
      begin(event, "move", selected.id, box, () => {
        if (hit && hit.id !== selected.id) onSelect([hit.id]);
      });
    } else if (hit) {
      onSelect([hit.id]);
      const area = areaOf(hit.id);
      if (area) begin(event, "move", hit.id, area);
    } else if (selection.length > 0) {
      onSelect([]);
    }
  };

  const onDoubleClick = (event: { clientX: number; clientY: number }) => {
    const hit = pick(event);
    if (!hit) {
      // This layer covers the player, so its own double-click never fires.
      playerRef.current?.requestFullscreen();
      return;
    }
    const found = findClip(layers, hit.id);
    if (!found) return;
    if (found.track.kind === "text") {
      playerRef.current?.pause();
      onSelect([hit.id]);
      setTyping(hit.id);
      return;
    }
    if (found.track.kind !== "scene") return;
    const bounds = layerRef.current?.getBoundingClientRect();
    if (!hit.element || !hit.root || !bounds) return;
    const around = textsAround(hit.element, hit.root);
    const values = sceneValues(viewClip(found.clip, variant) as SceneClip, project.style);
    const leaf = matchTextLeaf(textLeaves(values), around.map((entry) => entry.text));
    if (!leaf) {
      toast(`This text is written in the scene's code. Ask ${agentName} to change it.`);
      return;
    }
    const at = around[leaf.level].element.getBoundingClientRect();
    playerRef.current?.pause();
    onSelect([hit.id]);
    setPropEdit({
      id: hit.id,
      path: leaf.path,
      text: leaf.text,
      anchor: {
        x: (at.left - bounds.left) / bounds.width,
        y: (at.top - bounds.top) / bounds.height,
        width: at.width / bounds.width,
        height: at.height / bounds.height,
      },
    });
  };

  /** A scene's props with one text replaced. Only the prop that changed is added to the clip's own. */
  const propsWith = (clip: SceneClip, path: PropPath, text: string) => {
    const values = sceneValues(clip, project.style);
    const key = String(path[0]);
    return { ...(clip.props ?? {}), [key]: setAtPath(values, path, text)[key] };
  };

  const handles = selected?.kind === "scene" ? CORNERS : RESIZE_HANDLES;

  return (
    <div
      ref={layerRef}
      className="absolute touch-none select-none"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {drag?.guides.x !== undefined ? (
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-fuchsia-400"
          style={{ left: `${drag.guides.x * 100}%` }}
        />
      ) : null}
      {drag?.guides.y !== undefined ? (
        <div
          className="pointer-events-none absolute inset-x-0 h-px bg-fuchsia-400"
          style={{ top: `${drag.guides.y * 100}%` }}
        />
      ) : null}
      {selected && box && typingClip ? (
        <InlineText
          key={selected.id}
          clip={typingClip}
          box={box}
          scale={rect.width / size.width}
          frameHeight={size.height}
          styleId={project.style}
          onDone={(text) => {
            setTyping(null);
            if (text === null || text === typingClip.text) return;
            onCommit(
              patchClipForVariant(
                layers,
                selected.id,
                { text } as Partial<StudioClip>,
                variant,
                project.defaultVariant,
                // Words are the same on every layout unless this one already has its own.
                false,
              ),
              layers,
            );
          }}
        />
      ) : selected && box ? (
        <div
          title={
            selected.kind === "scene" && !canMoveScenes
              ? "Update the Agentcut helper to move and resize scenes"
              : undefined
          }
          className={cn(
            "absolute border-2 border-primary/90 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]",
            selected.fixed ? "border-dashed" : "cursor-move",
          )}
          style={percentBox(box)}
        >
          {selected.fixed || editingProp
            ? null
            : handles.map((handle) => (
                <div
                  key={handle}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    begin(event, handle, selected.id, box);
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-primary bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                  style={HANDLE_STYLE[handle]}
                />
              ))}
        </div>
      ) : null}
      {selected && editingProp ? (
        <PropText
          key={`${editingProp.id}:${editingProp.path.join(".")}`}
          edit={editingProp}
          onInput={(text) =>
            setLiveClip(editingProp.id, { props: propsWith(selected.view as SceneClip, editingProp.path, text) })
          }
          onDone={(text) => {
            setPropEdit(null);
            if (text === null || text === editingProp.text) return;
            onCommit(
              patchClipForVariant(
                layers,
                editingProp.id,
                { props: propsWith(selected.view as SceneClip, editingProp.path, text) } as Partial<StudioClip>,
                variant,
                project.defaultVariant,
                false,
              ),
              layers,
            );
          }}
        />
      ) : null}
    </div>
  );
}

/** Retype one text of a scene or component: a small field by the text, which redraws as you type. */
function PropText({
  edit,
  onInput,
  onDone,
}: {
  edit: PropEdit;
  onInput(text: string): void;
  /** The new text, or null when the edit was dropped. */
  onDone(text: string | null): void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancelled = useRef(false);
  const [value, setValue] = useState(edit.text);
  const id = edit.id;
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    return () => clearLiveClip(id);
  }, [id]);
  // Below the text, or above it when there is no room.
  const below = edit.anchor.y + edit.anchor.height < 0.78;
  const left = Math.min(Math.max(edit.anchor.x + edit.anchor.width / 2, 0.2), 0.8);
  return (
    <div
      className="absolute z-10 w-72 max-w-[80%] -translate-x-1/2 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
      style={{
        left: `${left * 100}%`,
        ...(below
          ? { top: `calc(${(edit.anchor.y + edit.anchor.height) * 100}% + 8px)` }
          : { bottom: `calc(${(1 - edit.anchor.y) * 100}% + 8px)` }),
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <textarea
        ref={ref}
        aria-label="Text"
        value={value}
        rows={Math.min(4, Math.max(1, value.split("\n").length))}
        spellCheck={false}
        className="block w-full resize-none rounded-md bg-background px-2 py-1.5 text-sm outline-none select-text focus:ring-1 focus:ring-ring"
        onChange={(event) => {
          setValue(event.target.value);
          onInput(event.target.value);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            cancelled.current = true;
            event.currentTarget.blur();
          } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={() => onDone(cancelled.current || !value.trim() ? null : value)}
      />
      <p className="px-1 pt-1 text-[10px] text-muted-foreground">
        Enter saves, Esc cancels{value.includes("*") ? ". *Stars* mark accent words" : ""}
      </p>
    </div>
  );
}

/** Retype a text clip where it stands. The clip itself redraws as you type; this only holds the caret. */
function InlineText({
  clip,
  box,
  scale,
  frameHeight,
  styleId,
  onDone,
}: {
  clip: TextClip;
  box: Box;
  scale: number;
  frameHeight: number;
  styleId: string | undefined;
  /** The new text, or null when the edit was dropped. */
  onDone(text: string | null): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);
  const id = clip.id;
  const initial = useRef(clip.text);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = initial.current;
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return () => clearLiveClip(id);
  }, [id]);

  // Same look as the runtime's text clip, so the caret sits on the letters underneath.
  const s = { ...getMotionStyle(styleId)?.text, ...clip.style };
  const align = s.align ?? "center";
  const read = () => (ref.current?.innerText ?? "").replace(/\n+$/, "");
  return (
    <div
      className="absolute flex items-center border-2 border-primary/90 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
      style={{
        ...percentBox(box),
        justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div
        ref={ref}
        role="textbox"
        aria-label="Clip text"
        aria-multiline
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck={false}
        className="w-full cursor-text select-text outline-none"
        style={{
          fontFamily: s.fontFamily ? `"${s.fontFamily}", sans-serif` : "sans-serif",
          fontSize: (s.fontSize ?? defaultFontSize(frameHeight)) * scale,
          fontWeight: s.fontWeight ?? 800,
          textAlign: align,
          lineHeight: s.lineHeight ?? 1.1,
          letterSpacing: s.letterSpacing === undefined ? undefined : s.letterSpacing * scale,
          textTransform: s.textTransform,
          whiteSpace: "pre-wrap",
          color: "transparent",
          caretColor: s.color ?? "#ffffff",
        }}
        onInput={() => setLiveClip(id, { text: read() })}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            cancelled.current = true;
            event.currentTarget.blur();
          } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.currentTarget.blur();
          }
        }}
        onBlur={() => {
          const text = read();
          // An empty text clip would be invisible and hard to find again: keep the old words.
          onDone(cancelled.current || !text ? null : text);
        }}
      />
    </div>
  );
}
