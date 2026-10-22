"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AudioLines,
  Download,
  FolderOpen,
  FileQuestion,
  Film,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LabeledSlider } from "@/components/ui/labeled-slider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  getMotionStyle,
  MOTION_COMPONENTS,
  resolveComponentProps,
  styledPropKeys,
  type MotionStyle,
} from "@/motion/components";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AssetPreview, MediaPlayer } from "@/components/studio/AssetPreview";
import { StyleSection } from "@/components/studio/StyleSection";
import {
  COMPONENT_COUNT,
  ComponentsSection,
} from "@/components/studio/ComponentsSection";
import {
  ASSET_DRAG_TYPE,
  referenceFromAsset,
} from "@/components/studio/ChatReferences";
import { studioFileUrl } from "@/lib/studio/bundle";
import {
  addClip,
  deleteClips,
  findClip,
  uniqueClipId,
  updateClip,
  isRippleTrack,
  rippleTrimEnd,
} from "@/lib/studio/edit";
import { uploadToProject } from "@/lib/studio/export";
import { fileName, formatBytes, formatFrameTime } from "@/lib/studio/format";
import type { FrameStore } from "@/lib/studio/frame-store";
import type {
  AssetEntry,
  AudioClip,
  Box,
  CaptionsClip,
  ClipAnim,
  ColorGrade,
  ImageClip,
  SceneClip,
  StudioClip,
  StudioDoc,
  StudioLayers,
  StudioProject,
  TextClip,
  TrackKind,
  VideoClip,
  VideoCursor,
} from "@/lib/studio/types";
import { VIDEO_CURSOR_STYLES } from "@/lib/studio/types";
import { TRACK_KIND_STYLE } from "@/components/studio/StudioTimeline";
import {
  RendersList,
  rendersFrom,
  useRenderFileActions,
} from "@/components/studio/RendersList";
import type { StudioBridge } from "@/lib/studio/bridge";
import { useAgentName } from "@/components/studio/StudioAgent";

const ANIM_PRESETS: ClipAnim["preset"][] = [
  "none",
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "pop",
  "scale",
  "blur",
];

// ---------------------------------------------------------------------------
// Field primitives (commit on blur / Enter so one edit = one undo step)

function Row({
  label,
  children,
  hint,
  badge,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  /** Small tag under the label (e.g. "style" when the value comes from the project style). */
  badge?: string;
}) {
  return (
    <label
      className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2 text-[11px]"
      title={hint}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-muted-foreground">
          {label}
        </span>
        {badge ? (
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}

const inputClass =
  "h-7 w-full min-w-0 rounded-md border border-border/70 bg-background px-2 text-[12px] outline-none focus:border-foreground/50 disabled:opacity-50";

function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  disabled,
  suffix,
}: {
  value: number | undefined;
  onCommit(value: number | undefined): void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [focused, setFocused] = useState(false);
  const shown = focused ? draft : value === undefined ? "" : String(value);
  const commit = () => {
    setFocused(false);
    if (draft.trim() === "") {
      if (value !== undefined) onCommit(undefined);
      return;
    }
    let next = Number(draft);
    if (!Number.isFinite(next)) return;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (step >= 1) next = Math.round(next);
    if (next !== value) onCommit(next);
  };
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        className={inputClass}
        value={shown}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onFocus={() => {
          setDraft(value === undefined ? "" : String(value));
          setFocused(true);
        }}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      {suffix ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

function TextField({
  value,
  onCommit,
  multiline,
  disabled,
  placeholder,
}: {
  value: string | undefined;
  onCommit(value: string): void;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [focused, setFocused] = useState(false);
  const shown = focused ? draft : (value ?? "");
  const props = {
    value: shown,
    disabled,
    placeholder,
    onFocus: () => {
      setDraft(value ?? "");
      setFocused(true);
    },
    onChange: (event: { target: { value: string } }) =>
      setDraft(event.target.value),
    onBlur: () => {
      setFocused(false);
      if (draft !== (value ?? "")) onCommit(draft);
    },
  };
  return multiline ? (
    <textarea
      {...props}
      rows={3}
      className={cn(inputClass, "h-auto resize-y py-1.5")}
    />
  ) : (
    <input
      {...props}
      className={inputClass}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
    />
  );
}

function SelectField<T extends string>({
  value,
  options,
  onCommit,
  disabled,
}: {
  value: T | undefined;
  options: readonly T[];
  onCommit(value: T): void;
  disabled?: boolean;
}) {
  return (
    <select
      className={inputClass}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onCommit(event.target.value as T)}
    >
      {value === undefined ? <option value="">—</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function ColorField({
  value,
  onCommit,
  disabled,
}: {
  value: string | undefined;
  onCommit(value: string): void;
  disabled?: boolean;
}) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
  return (
    <span className="flex items-center gap-1">
      {/* The editor's shared picker: saved brand colors, and it only commits once a drag settles. */}
      <ColorPicker
        value={hex}
        onChange={onCommit}
        disabled={disabled}
        debounceMs={120}
        className="h-7 w-8 rounded border border-border/70"
      />
      <TextField
        value={value}
        onCommit={onCommit}
        disabled={disabled}
        placeholder="#ffffff"
      />
    </span>
  );
}

/** The editor's slider look (label baked into the fill, value badge on the right). */
function RangeField({
  value,
  min,
  max,
  step,
  onPreview,
  onCommit,
  format,
  label,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onPreview(value: number): void;
  onCommit(value: number): void;
  format(value: number): string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <LabeledSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      formatValue={format}
      onChange={onPreview}
      sliderProps={{ onValueCommit: ([next]) => onCommit(next) }}
    />
  );
}

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="space-y-2 border-b border-border/50 px-3 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------

export interface StudioInspectorProps {
  doc: StudioDoc;
  variant: string;
  selection: string[];
  assets: AssetEntry[];
  library: AssetEntry[];
  frameStore: FrameStore;
  readOnly: boolean;
  onPreview(layers: StudioLayers): void;
  onCommit(
    layers: StudioLayers,
    base?: StudioLayers,
    durationInFrames?: number,
  ): void;
  onSelect(ids: string[]): void;
  onSaveProject(project: StudioProject): void;
  onAssetsChanged(): void;
  /** Send a chat message about a file (it goes with the message as a reference). */
  onAskClaude(asset: AssetEntry, text: string): Promise<void>;
  /** Put the file in the chat box as a chip, for a longer message. */
  onMentionAsset(asset: AssetEntry): void;
  /** Send a plain chat message (e.g. about a library component). */
  onAskText(text: string): Promise<void>;
  chatBusy: boolean;
  chatDisabled: boolean;
  getBridge(): StudioBridge | null;
  /** Open the export dialog. */
  onExport(): void;
  /** The helper accepts a style in project.json. */
  stylesSupported: boolean;
  /** Open the style gallery. */
  onOpenStyles(): void;
}

export function StudioInspector(props: StudioInspectorProps) {
  const { doc, selection } = props;
  const [tab, setTab] = useState<"clip" | "assets" | "renders" | "project">(
    "assets",
  );
  const hasSelection = selection.length > 0;
  const activeTab = hasSelection
    ? tab !== "clip"
      ? tab
      : "clip"
    : tab === "clip"
      ? "assets"
      : tab;
  const renderCount = rendersFrom(props.assets).length;
  const [lastSelection, setLastSelection] = useState<string[]>([]);
  if (selection !== lastSelection) {
    setLastSelection(selection);
    if (selection.length > 0) setTab("clip");
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setTab(value as typeof tab)}
      className="flex h-full min-h-0 flex-col gap-0"
    >
      <div className="flex h-10 shrink-0 items-center border-b border-border/60 px-2">
        <TabsList variant="line" className="h-8">
          {(["clip", "assets", "renders", "project"] as const).map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              disabled={value === "clip" && !hasSelection}
              className="px-2 text-[11px] font-bold uppercase tracking-wide"
            >
              {value === "clip"
                ? selection.length > 1
                  ? `${selection.length} clips`
                  : "Clip"
                : value}
              {value === "renders" && renderCount > 0 ? (
                <span className="ml-1 rounded-full bg-muted px-1.5 font-mono text-[9px] text-muted-foreground">
                  {renderCount}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block">
        {activeTab === "clip" && doc.layers ? (
          <ClipInspector {...props} layers={doc.layers} />
        ) : null}
        {activeTab === "assets" ? <AssetsPanel {...props} /> : null}
        {activeTab === "renders" ? <RendersPanel {...props} /> : null}
        {activeTab === "project" && doc.project ? (
          <ProjectInspector {...props} project={doc.project} />
        ) : null}
      </ScrollArea>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Clip inspector

function ClipInspector({
  layers,
  doc,
  variant,
  selection,
  readOnly,
  onPreview,
  onCommit,
  onSelect,
}: StudioInspectorProps & { layers: StudioLayers }) {
  const [scope, setScope] = useState<"all" | "variant">("all");
  if (selection.length > 1) {
    return (
      <Section title={`${selection.length} clips selected`}>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            onCommit(deleteClips(layers, selection));
            onSelect([]);
          }}
          className="flex h-8 items-center gap-1.5 rounded-md border border-red-500/40 px-3 text-xs font-semibold text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="size-3.5" /> Delete clips
        </button>
      </Section>
    );
  }
  const location = findClip(layers, selection[0]);
  if (!location)
    return (
      <p className="p-3 text-xs text-muted-foreground">
        The selected clip no longer exists.
      </p>
    );
  const { track, clip } = location;
  const fps = doc.project?.fps ?? 30;
  const kind = track.kind;
  const locked = readOnly || Boolean(track.locked);
  const override =
    (clip as { variants?: Record<string, Partial<StudioClip>> }).variants?.[
      variant
    ] ?? {};
  const view =
    scope === "variant" ? ({ ...clip, ...override } as StudioClip) : clip;
  const hasVariants = Object.keys(doc.project?.variants ?? {}).length > 1;

  /** Patch the clip (or its override for this variant). */
  const patch = (fields: Partial<StudioClip>, preview = false) => {
    let next: StudioLayers;
    if (scope === "variant") {
      const variants = {
        ...((clip as { variants?: Record<string, Partial<StudioClip>> })
          .variants ?? {}),
      };
      variants[variant] = { ...(variants[variant] ?? {}), ...fields };
      next = updateClip(layers, clip.id, { variants } as Partial<StudioClip>);
    } else {
      next = updateClip(layers, clip.id, fields);
    }
    if (preview) onPreview(next);
    else onCommit(next, layers);
  };
  const style = TRACK_KIND_STYLE[kind];
  const Icon = style.icon;

  return (
    <div>
      <Section
        title={`${style.label} clip`}
        right={
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Icon className="size-3" /> {track.name}
          </span>
        }
      >
        <Row label="Name">
          <TextField
            value={clip.name}
            onCommit={(value) => patch({ name: value || undefined })}
            disabled={locked}
            placeholder={clip.id}
          />
        </Row>
        <Row label="Start" hint="Frame where the clip starts">
          <NumberField
            value={clip.from}
            min={0}
            onCommit={(value) =>
              onCommit(
                updateClip(layers, clip.id, { from: value ?? 0 }),
                layers,
              )
            }
            disabled={locked}
            suffix={formatFrameTime(clip.from, fps)}
          />
        </Row>
        <Row label="Length" hint="Frames">
          <NumberField
            value={clip.duration}
            min={1}
            onCommit={(value) => {
              const length = Math.max(1, value ?? 1);
              // Scenes are magnetic: a longer scene pushes everything after it, like dragging its edge.
              if (isRippleTrack(kind) && doc.project) {
                const result = rippleTrimEnd(
                  layers,
                  clip.id,
                  clip.from + length,
                  doc.project.durationInFrames,
                );
                onCommit(
                  result.layers,
                  layers,
                  result.delta
                    ? Math.max(1, doc.project.durationInFrames + result.delta)
                    : undefined,
                );
                return;
              }
              onCommit(
                updateClip(layers, clip.id, { duration: length }),
                layers,
              );
            }}
            disabled={locked}
            suffix={`${(clip.duration / fps).toFixed(2)}s`}
          />
        </Row>
        {clip.note ? (
          <p className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
            {clip.note}
          </p>
        ) : null}
        {hasVariants && kind !== "audio" ? (
          <div className="flex items-center gap-1 rounded-md bg-muted/40 p-1 text-[11px]">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={cn(
                "flex-1 rounded px-2 py-1",
                scope === "all" && "bg-background font-semibold",
              )}
            >
              All sizes
            </button>
            <button
              type="button"
              onClick={() => setScope("variant")}
              className={cn(
                "flex-1 rounded px-2 py-1",
                scope === "variant" && "bg-background font-semibold",
              )}
            >
              Only {variant}
            </button>
          </div>
        ) : null}
      </Section>

      {kind === "scene" ? (
        <SceneFields
          clip={view as SceneClip}
          doc={doc}
          disabled={locked}
          patch={patch}
        />
      ) : null}
      {kind === "text" ? (
        <TextFields
          clip={view as TextClip}
          motionStyle={getMotionStyle(doc.project?.style)}
          disabled={locked}
          patch={patch}
        />
      ) : null}
      {kind === "captions" ? (
        <CaptionFields
          clip={view as CaptionsClip}
          motionStyle={getMotionStyle(doc.project?.style)}
          disabled={locked}
          patch={patch}
        />
      ) : null}
      {kind === "image" ? (
        <MediaVisualFields
          clip={view as ImageClip}
          disabled={locked}
          patch={patch}
          kind={kind}
        />
      ) : null}
      {kind === "video" ? (
        <>
          <MediaVisualFields
            clip={view as VideoClip}
            disabled={locked}
            patch={patch}
            kind={kind}
            styleName={getMotionStyle(doc.project?.style)?.name}
          />
          <GradeFields
            clip={view as VideoClip}
            disabled={locked}
            patch={patch}
          />
          {(view as VideoClip).cursor ? (
            <CursorFields
              cursor={(view as VideoClip).cursor!}
              disabled={locked}
              patch={patch}
            />
          ) : null}
        </>
      ) : null}
      {kind === "audio" || kind === "video" ? (
        <AudioFields
          clip={view as AudioClip}
          disabled={locked}
          patch={patch}
          fps={fps}
          kind={kind}
          slug={doc.slug}
        />
      ) : null}
      {kind !== "audio" ? (
        <AnimationFields clip={view} disabled={locked} patch={patch} />
      ) : null}

      <Section title="Clip">
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            onCommit(deleteClips(layers, [clip.id]));
            onSelect([]);
          }}
          className="flex h-8 items-center gap-1.5 rounded-md border border-red-500/40 px-3 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-40"
        >
          <Trash2 className="size-3.5" /> Delete
        </button>
        <p className="font-mono text-[10px] text-muted-foreground">
          id: {clip.id}
        </p>
      </Section>
    </div>
  );
}

type Patch = (fields: Partial<StudioClip>, preview?: boolean) => void;

function BoxFields({
  box,
  disabled,
  patch,
}: {
  box: Box | undefined;
  disabled: boolean;
  patch: Patch;
}) {
  const value = box ?? { x: 0, y: 0, width: 1, height: 1 };
  const set = (key: keyof Box, v: number | undefined) =>
    patch({ box: { ...value, [key]: (v ?? 0) / 100 } } as Partial<StudioClip>);
  const pct = (n: number) => Math.round(n * 1000) / 10;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Row label="X %">
        <NumberField
          value={pct(value.x)}
          step={0.1}
          onCommit={(v) => set("x", v)}
          disabled={disabled}
        />
      </Row>
      <Row label="Y %">
        <NumberField
          value={pct(value.y)}
          step={0.1}
          onCommit={(v) => set("y", v)}
          disabled={disabled}
        />
      </Row>
      <Row label="W %">
        <NumberField
          value={pct(value.width)}
          step={0.1}
          min={0.1}
          onCommit={(v) => set("width", v)}
          disabled={disabled}
        />
      </Row>
      <Row label="H %">
        <NumberField
          value={pct(value.height)}
          step={0.1}
          min={0.1}
          onCommit={(v) => set("height", v)}
          disabled={disabled}
        />
      </Row>
    </div>
  );
}

/** A library component's props as a form (built from its meta.json). */
function ComponentFields({
  clip,
  styleId,
  disabled,
  patch,
}: {
  clip: SceneClip;
  styleId: string | undefined;
  disabled: boolean;
  patch: Patch;
}) {
  const agentName = useAgentName();
  const id = clip.component ?? "";
  const entry = MOTION_COMPONENTS[id];
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  if (!entry) {
    return (
      <Section title="Component">
        <p className="text-[11px] text-red-400">
          Unknown component “{id}”. Available:{" "}
          {Object.keys(MOTION_COMPONENTS).join(", ")}.
        </p>
      </Section>
    );
  }
  const { meta } = entry;
  const stored = clip.props ?? {};
  const motionStyle = getMotionStyle(styleId);
  const values = resolveComponentProps(
    id,
    { ...stored, ...(preview ?? {}) },
    styleId,
  );
  // What each prop is when the clip leaves it out: the style's value, else the default.
  const unset = resolveComponentProps(id, {}, styleId);
  const styled = motionStyle ? styledPropKeys(id) : [];
  const overridden = styled.filter((key) => key in stored);
  const set = (key: string, value: unknown, transient = false) => {
    const next: Record<string, unknown> = { ...stored, ...(preview ?? {}) };
    if (JSON.stringify(value) === JSON.stringify(unset[key])) delete next[key];
    else next[key] = value;
    if (transient) setPreview({ ...(preview ?? {}), [key]: value });
    else setPreview(null);
    patch({ props: next } as Partial<StudioClip>, transient);
  };
  const changed = Object.keys(stored).length > 0;
  return (
    <Section
      title={meta.name}
      right={
        overridden.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            title={`Drop this clip's own ${overridden.join(", ")} so it follows ${motionStyle?.name}`}
            onClick={() => {
              const next = { ...stored };
              for (const key of overridden) delete next[key];
              patch({ props: next } as Partial<StudioClip>);
            }}
            className="h-5 px-1.5 text-[10px]"
          >
            Use style
          </Button>
        ) : changed ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => patch({ props: {} } as Partial<StudioClip>)}
            className="h-5 px-1.5 text-[10px]"
          >
            Defaults
          </Button>
        ) : null
      }
    >
      <p className="text-[11px] leading-snug text-muted-foreground">
        {meta.description}
      </p>
      {meta.examples.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {meta.examples.map((example) => (
            <Button
              key={example.name}
              type="button"
              variant="outline"
              size="xs"
              disabled={disabled}
              onClick={() =>
                patch({
                  props: { ...stored, ...example.props },
                } as Partial<StudioClip>)
              }
              className="h-6 rounded-full px-2 text-[10px] font-normal"
            >
              {example.name}
            </Button>
          ))}
        </div>
      ) : null}
      {Object.entries(meta.props).map(([key, spec]) => {
        const value = values[key];
        const field = (() => {
          switch (spec.type) {
            case "text":
              return (
                <TextField
                  value={String(value ?? "")}
                  multiline={spec.multiline}
                  disabled={disabled}
                  onCommit={(next) => set(key, next)}
                />
              );
            case "lines":
              return (
                <TextField
                  value={(value as string[]).join("\n")}
                  multiline
                  disabled={disabled}
                  onCommit={(next) =>
                    set(
                      key,
                      next
                        .split("\n")
                        .filter((line, i, all) => line || i < all.length - 1),
                    )
                  }
                />
              );
            case "color":
              return (
                <ColorField
                  value={String(value)}
                  disabled={disabled}
                  onCommit={(next) => set(key, next)}
                />
              );
            case "number":
              return spec.max - spec.min <= 400 ? (
                <RangeField
                  label={spec.label}
                  disabled={disabled}
                  value={Number(value)}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  format={(v) =>
                    `${Number.isInteger(spec.step) ? Math.round(v) : v.toFixed(1)}${spec.unit && spec.unit.length <= 3 ? spec.unit : ""}`
                  }
                  onPreview={(next) => set(key, next, true)}
                  onCommit={(next) => set(key, next)}
                />
              ) : (
                <NumberField
                  value={Number(value)}
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  disabled={disabled}
                  suffix={spec.unit}
                  onCommit={(next) => set(key, next ?? spec.default)}
                />
              );
            case "select":
              return (
                <SelectField
                  value={String(value)}
                  options={spec.options.map((o) => o.value)}
                  disabled={disabled}
                  onCommit={(next) => set(key, next)}
                />
              );
            case "boolean":
              return (
                <Switch
                  checked={Boolean(value)}
                  disabled={disabled}
                  onCheckedChange={(next) => set(key, next)}
                />
              );
          }
        })();
        // Sliders carry their own label inside the fill.
        if (spec.type === "number" && spec.max - spec.min <= 400)
          return (
            <div key={key} title={spec.help}>
              {field}
            </div>
          );
        const fromStyle = styled.includes(key) && !(key in stored);
        return (
          <Row
            key={key}
            label={spec.label}
            hint={
              fromStyle
                ? `From the ${motionStyle?.name} style. ${spec.help ?? ""}`.trim()
                : spec.help
            }
            badge={fromStyle ? "style" : undefined}
          >
            {field}
          </Row>
        );
      })}
      <p className="text-[10px] text-muted-foreground">
        Library component <code>{id}</code>. Ask {agentName} to change it, or edit it
        here.
      </p>
    </Section>
  );
}

function SceneFields({
  clip,
  doc,
  disabled,
  patch,
}: {
  clip: SceneClip;
  doc: StudioDoc;
  disabled: boolean;
  patch: Patch;
}) {
  if (clip.component)
    return (
      <ComponentFields
        clip={clip}
        styleId={doc.project?.style}
        disabled={disabled}
        patch={patch}
      />
    );
  return (
    <SceneFileFields clip={clip} doc={doc} disabled={disabled} patch={patch} />
  );
}

function SceneFileFields({
  clip,
  doc,
  disabled,
  patch,
}: {
  clip: SceneClip;
  doc: StudioDoc;
  disabled: boolean;
  patch: Patch;
}) {
  const [draft, setDraft] = useState(() =>
    JSON.stringify(clip.props ?? {}, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const serialized = JSON.stringify(clip.props ?? {}, null, 2);
  const [lastSerialized, setLastSerialized] = useState(serialized);
  if (serialized !== lastSerialized) {
    setLastSerialized(serialized);
    setDraft(serialized);
    setError(null);
  }
  return (
    <Section title="Scene">
      <Row label="Component">
        <SelectField
          value={clip.scene}
          options={doc.scenes}
          onCommit={(value) => patch({ scene: value } as Partial<StudioClip>)}
          disabled={disabled}
        />
      </Row>
      <p className="text-[10px] text-muted-foreground">
        scenes/{clip.scene}.tsx · props passed to the scene:
      </p>
      <textarea
        value={draft}
        disabled={disabled}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          try {
            const parsed = JSON.parse(draft) as unknown;
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
              throw new Error("Props must be a JSON object.");
            setError(null);
            if (JSON.stringify(parsed, null, 2) !== serialized)
              patch({
                props: parsed as Record<string, unknown>,
              } as Partial<StudioClip>);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }}
        rows={Math.min(16, Math.max(4, draft.split("\n").length))}
        className={cn(
          inputClass,
          "h-auto resize-y py-1.5 font-mono text-[11px]",
          error && "border-red-500",
        )}
      />
      {error ? <p className="text-[10px] text-red-400">{error}</p> : null}
    </Section>
  );
}

function TextFields({
  clip,
  motionStyle,
  disabled,
  patch,
}: {
  clip: TextClip;
  motionStyle: MotionStyle | null;
  disabled: boolean;
  patch: Patch;
}) {
  const fallback = motionStyle?.text;
  const style = clip.style ?? {};
  const setStyle = (fields: Partial<NonNullable<TextClip["style"]>>) =>
    patch({ style: { ...style, ...fields } } as Partial<StudioClip>);
  return (
    <Section title="Text">
      <TextField
        value={clip.text}
        multiline
        onCommit={(value) => patch({ text: value } as Partial<StudioClip>)}
        disabled={disabled}
      />
      <Row label="Font">
        <TextField
          value={style.fontFamily}
          onCommit={(value) => setStyle({ fontFamily: value || undefined })}
          disabled={disabled}
          placeholder={fallback?.fontFamily ?? "Inter"}
        />
      </Row>
      <Row label="Size">
        <NumberField
          value={style.fontSize}
          min={4}
          onCommit={(value) => setStyle({ fontSize: value })}
          disabled={disabled}
          suffix="px"
        />
      </Row>
      <Row label="Weight">
        <SelectField
          value={
            style.fontWeight
              ? String(style.fontWeight)
              : fallback
                ? String(fallback.fontWeight)
                : undefined
          }
          options={["300", "400", "500", "600", "700", "800", "900"] as const}
          onCommit={(value) => setStyle({ fontWeight: Number(value) })}
          disabled={disabled}
        />
      </Row>
      <Row label="Color">
        <ColorField
          value={style.color ?? fallback?.color}
          onCommit={(value) => setStyle({ color: value })}
          disabled={disabled}
        />
      </Row>
      <Row label="Align">
        <SelectField
          value={style.align}
          options={["left", "center", "right"] as const}
          onCommit={(value) => setStyle({ align: value })}
          disabled={disabled}
        />
      </Row>
      <Row label="Case">
        <SelectField
          value={style.textTransform}
          options={["none", "uppercase", "lowercase", "capitalize"] as const}
          onCommit={(value) => setStyle({ textTransform: value })}
          disabled={disabled}
        />
      </Row>
      <BoxFields
        box={clip.box ?? { x: 0.05, y: 0.4, width: 0.9, height: 0.2 }}
        disabled={disabled}
        patch={patch}
      />
    </Section>
  );
}

function CaptionFields({
  clip,
  motionStyle,
  disabled,
  patch,
}: {
  clip: CaptionsClip;
  motionStyle: MotionStyle | null;
  disabled: boolean;
  patch: Patch;
}) {
  const fallback = motionStyle?.captions;
  const style = clip.style ?? {};
  const setStyle = (fields: Partial<NonNullable<CaptionsClip["style"]>>) =>
    patch({ style: { ...style, ...fields } } as Partial<StudioClip>);
  return (
    <Section title={`Captions · ${clip.words.length} words`}>
      <Row label="Style">
        <SelectField
          value={style.preset ?? fallback?.preset ?? "pop"}
          options={["pop", "karaoke", "plain"] as const}
          onCommit={(value) => setStyle({ preset: value })}
          disabled={disabled}
        />
      </Row>
      <Row label="Position">
        <SelectField
          value={style.position ?? "bottom"}
          options={["bottom", "center", "top"] as const}
          onCommit={(value) => setStyle({ position: value })}
          disabled={disabled}
        />
      </Row>
      <Row label="Words/line">
        <NumberField
          value={style.maxWordsPerLine ?? 4}
          min={1}
          max={20}
          onCommit={(value) => setStyle({ maxWordsPerLine: value })}
          disabled={disabled}
        />
      </Row>
      <Row label="Font">
        <TextField
          value={style.fontFamily}
          onCommit={(value) => setStyle({ fontFamily: value || undefined })}
          disabled={disabled}
          placeholder={fallback?.fontFamily ?? "Inter"}
        />
      </Row>
      <Row label="Size">
        <NumberField
          value={style.fontSize}
          min={4}
          onCommit={(value) => setStyle({ fontSize: value })}
          disabled={disabled}
          suffix="px"
        />
      </Row>
      <Row label="Color">
        <ColorField
          value={style.color ?? fallback?.color}
          onCommit={(value) => setStyle({ color: value })}
          disabled={disabled}
        />
      </Row>
      <Row label="Highlight">
        <ColorField
          value={style.highlight ?? fallback?.highlight}
          onCommit={(value) => setStyle({ highlight: value })}
          disabled={disabled}
        />
      </Row>
      <details className="text-[11px]">
        <summary className="cursor-pointer text-muted-foreground">
          Words
        </summary>
        <WordsEditor clip={clip} disabled={disabled} patch={patch} />
      </details>
    </Section>
  );
}

function WordsEditor({
  clip,
  disabled,
  patch,
}: {
  clip: CaptionsClip;
  disabled: boolean;
  patch: Patch;
}) {
  return (
    <ScrollArea className="mt-2" viewportClassName="max-h-64">
      <div className="space-y-1 pr-3">
        {clip.words.map((word, index) => (
          <div
            key={`${index}-${word.from}`}
            className="grid grid-cols-[1fr_44px] items-center gap-1"
          >
            <TextField
              value={word.text}
              disabled={disabled}
              onCommit={(value) => {
                const words = clip.words.map((w, i) =>
                  i === index ? { ...w, text: value } : w,
                );
                patch({ words } as Partial<StudioClip>);
              }}
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              f{word.from}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function MediaVisualFields({
  clip,
  disabled,
  patch,
  kind,
  styleName,
}: {
  clip: ImageClip | VideoClip;
  disabled: boolean;
  patch: Patch;
  kind: TrackKind;
  /** The project style, when it moves the camera on video clips. */
  styleName?: string;
}) {
  return (
    <Section title={kind === "image" ? "Image" : "Video"}>
      <p
        className="truncate font-mono text-[10px] text-muted-foreground"
        title={clip.src}
      >
        {clip.src}
      </p>
      <Row label="Fit">
        <SelectField
          value={clip.fit ?? "cover"}
          options={["cover", "contain"] as const}
          onCommit={(value) => patch({ fit: value } as Partial<StudioClip>)}
          disabled={disabled}
        />
      </Row>
      <Row label="Corner radius">
        <NumberField
          value={clip.radius}
          min={0}
          onCommit={(value) => patch({ radius: value } as Partial<StudioClip>)}
          disabled={disabled}
          suffix="px"
        />
      </Row>
      {kind === "video" && styleName ? (
        <Row
          label="Style camera"
          hint={`${styleName}'s camera moves (punch-ins, drift…) on this clip. Turn off for screen recordings.`}
        >
          <Switch
            checked={(clip as VideoClip).camera !== "none"}
            disabled={disabled}
            onCheckedChange={(on) =>
              patch({ camera: on ? undefined : "none" } as Partial<StudioClip>)
            }
          />
        </Row>
      ) : null}
      <BoxFields box={clip.box} disabled={disabled} patch={patch} />
    </Section>
  );
}

const GRADE_SLIDERS: {
  key: keyof ColorGrade;
  label: string;
  min: number;
  max: number;
  step: number;
  neutral: number;
  format(value: number): string;
}[] = [
  {
    key: "brightness",
    label: "Brightness",
    min: 0.5,
    max: 1.5,
    step: 0.01,
    neutral: 1,
    format: (v) => `${Math.round((v - 1) * 100)}`,
  },
  {
    key: "contrast",
    label: "Contrast",
    min: 0.5,
    max: 1.5,
    step: 0.01,
    neutral: 1,
    format: (v) => `${Math.round((v - 1) * 100)}`,
  },
  {
    key: "saturation",
    label: "Saturation",
    min: 0,
    max: 2,
    step: 0.01,
    neutral: 1,
    format: (v) => `${Math.round((v - 1) * 100)}`,
  },
  {
    key: "warmth",
    label: "Warmth",
    min: -1,
    max: 1,
    step: 0.01,
    neutral: 0,
    format: (v) => `${Math.round(v * 100)}`,
  },
  {
    key: "hue",
    label: "Hue",
    min: -180,
    max: 180,
    step: 1,
    neutral: 0,
    format: (v) => `${Math.round(v)}°`,
  },
];

/** Color grade for footage: CSS filters, so the preview and the export match. */
/** The recorded mouse drawn over a Companion screen recording. */
function CursorFields({
  cursor,
  disabled,
  patch,
}: {
  cursor: VideoCursor;
  disabled: boolean;
  patch: Patch;
}) {
  const set = (next: Partial<VideoCursor>) =>
    patch({ cursor: { ...cursor, ...next } } as Partial<StudioClip>);
  return (
    <Section title="Cursor">
      <Row label="Style">
        <SelectField
          value={cursor.style ?? "classic"}
          options={VIDEO_CURSOR_STYLES}
          onCommit={(style) => set({ style })}
          disabled={disabled}
        />
      </Row>
      <Row label="Size">
        <NumberField
          value={cursor.size ?? 100}
          min={50}
          max={200}
          step={10}
          onCommit={(size) => set({ size })}
          disabled={disabled}
          suffix="%"
        />
      </Row>
      <Row label="Click rings">
        <SelectField
          value={cursor.clicks === false ? "off" : "on"}
          options={["on", "off"] as const}
          onCommit={(value) => set({ clicks: value === "on" })}
          disabled={disabled}
        />
      </Row>
      <Row label="Smoothing" hint="0 follows the recorded path, 1 glides">
        <NumberField
          value={cursor.smoothing ?? 0.3}
          min={0}
          max={1}
          step={0.1}
          onCommit={(smoothing) => set({ smoothing })}
          disabled={disabled}
        />
      </Row>
    </Section>
  );
}

function GradeFields({
  clip,
  disabled,
  patch,
}: {
  clip: VideoClip;
  disabled: boolean;
  patch: Patch;
}) {
  const [preview, setPreview] = useState<ColorGrade | null>(null);
  const grade = preview ?? clip.grade ?? {};
  const changed = GRADE_SLIDERS.some(
    (s) => clip.grade?.[s.key] !== undefined && clip.grade[s.key] !== s.neutral,
  );
  const next = (key: keyof ColorGrade, value: number) => {
    const neutral = GRADE_SLIDERS.find((s) => s.key === key)!.neutral;
    const merged: ColorGrade = { ...(clip.grade ?? {}), ...(preview ?? {}) };
    if (Math.abs(value - neutral) < 1e-6) delete merged[key];
    else merged[key] = value;
    return Object.keys(merged).length ? merged : undefined;
  };
  return (
    <Section
      title="Color"
      right={
        changed ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => {
              setPreview(null);
              patch({ grade: undefined } as Partial<StudioClip>);
            }}
            className="h-5 px-1.5 text-[10px]"
          >
            Reset
          </Button>
        ) : null
      }
    >
      {GRADE_SLIDERS.map((slider) => (
        <RangeField
          key={slider.key}
          label={slider.label}
          disabled={disabled}
          value={grade[slider.key] ?? slider.neutral}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          format={slider.format}
          onPreview={(value) => {
            const merged = next(slider.key, value);
            setPreview(merged ?? {});
            patch({ grade: merged } as Partial<StudioClip>, true);
          }}
          onCommit={(value) => {
            const merged = next(slider.key, value);
            setPreview(null);
            patch({ grade: merged } as Partial<StudioClip>);
          }}
        />
      ))}
    </Section>
  );
}

function AudioFields({
  clip,
  disabled,
  patch,
  fps,
  kind,
  slug,
}: {
  clip: AudioClip | VideoClip;
  disabled: boolean;
  patch: Patch;
  fps: number;
  kind: TrackKind;
  slug: string;
}) {
  const [volume, setVolume] = useState<number | null>(null);
  const shownVolume = volume ?? clip.volume ?? 1;
  const audio = clip as AudioClip;
  return (
    <Section title="Sound">
      {kind === "audio" ? (
        <>
          <p
            className="truncate font-mono text-[10px] text-muted-foreground"
            title={clip.src}
          >
            {clip.src}
          </p>
          {/* Listen to the part of the file this clip plays, at the clip's volume. */}
          <MediaPlayer
            key={clip.src}
            url={studioFileUrl(slug, clip.src)}
            kind="audio"
            segment={{
              start: (clip.trimStart ?? 0) / fps,
              end:
                ((clip.trimStart ?? 0) +
                  clip.duration * ((clip as AudioClip).playbackRate ?? 1)) /
                fps,
            }}
            volume={shownVolume}
          />
        </>
      ) : null}
      <RangeField
        label="Volume"
        disabled={disabled}
        value={shownVolume}
        min={0}
        max={2}
        step={0.01}
        format={(v) =>
          v === 0 ? "-∞ dB" : `${(20 * Math.log10(v)).toFixed(1)} dB`
        }
        onPreview={(value) => {
          setVolume(value);
          patch({ volume: value } as Partial<StudioClip>, true);
        }}
        onCommit={(value) => {
          setVolume(null);
          patch({ volume: value } as Partial<StudioClip>);
        }}
      />
      <Row label="Starts at" hint="Skip this many frames of the file">
        <NumberField
          value={clip.trimStart ?? 0}
          min={0}
          onCommit={(value) =>
            patch({ trimStart: value || undefined } as Partial<StudioClip>)
          }
          disabled={disabled}
          suffix={`${((clip.trimStart ?? 0) / fps).toFixed(2)}s`}
        />
      </Row>
      {kind === "audio" ? (
        <>
          <Row label="Fade in">
            <NumberField
              value={audio.fadeIn ?? 0}
              min={0}
              onCommit={(value) =>
                patch({ fadeIn: value || undefined } as Partial<StudioClip>)
              }
              disabled={disabled}
              suffix="f"
            />
          </Row>
          <Row label="Fade out">
            <NumberField
              value={audio.fadeOut ?? 0}
              min={0}
              onCommit={(value) =>
                patch({ fadeOut: value || undefined } as Partial<StudioClip>)
              }
              disabled={disabled}
              suffix="f"
            />
          </Row>
          <Row label="Role">
            <SelectField
              value={audio.role}
              options={["voice", "music", "sfx", "ambience"] as const}
              onCommit={(value) =>
                patch({ role: value } as Partial<StudioClip>)
              }
              disabled={disabled}
            />
          </Row>
          <Row label="Loop">
            <input
              type="checkbox"
              checked={Boolean(audio.loop)}
              disabled={disabled}
              onChange={(event) =>
                patch({
                  loop: event.target.checked || undefined,
                } as Partial<StudioClip>)
              }
            />
          </Row>
        </>
      ) : (
        <Row label="Muted">
          <input
            type="checkbox"
            checked={Boolean((clip as VideoClip).muted)}
            disabled={disabled}
            onChange={(event) =>
              patch({
                muted: event.target.checked || undefined,
              } as Partial<StudioClip>)
            }
          />
        </Row>
      )}
    </Section>
  );
}

function AnimationFields({
  clip,
  disabled,
  patch,
}: {
  clip: StudioClip;
  disabled: boolean;
  patch: Patch;
}) {
  const [opacity, setOpacity] = useState<number | null>(null);
  const anim = (key: "enter" | "exit", fields: Partial<ClipAnim>) => {
    const current = clip[key] ?? { preset: "none" as const, frames: 10 };
    const next = { ...current, ...fields };
    patch({
      [key]: next.preset === "none" ? undefined : next,
    } as Partial<StudioClip>);
  };
  return (
    <Section title="Look & motion">
      <RangeField
        label="Opacity"
        disabled={disabled}
        value={opacity ?? clip.opacity ?? 1}
        min={0}
        max={1}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onPreview={(value) => {
          setOpacity(value);
          patch({ opacity: value } as Partial<StudioClip>, true);
        }}
        onCommit={(value) => {
          setOpacity(null);
          patch({
            opacity: value >= 1 ? undefined : value,
          } as Partial<StudioClip>);
        }}
      />
      {(["enter", "exit"] as const).map((key) => (
        <Row key={key} label={key === "enter" ? "Enter" : "Exit"}>
          <span className="grid grid-cols-[1fr_64px] gap-1">
            <SelectField
              value={clip[key]?.preset ?? "none"}
              options={ANIM_PRESETS}
              onCommit={(value) => anim(key, { preset: value })}
              disabled={disabled}
            />
            <NumberField
              value={clip[key]?.frames ?? 10}
              min={1}
              onCommit={(value) => anim(key, { frames: value ?? 10 })}
              disabled={disabled || !clip[key]}
              suffix="f"
            />
          </span>
        </Row>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Assets

function assetIcon(kind: AssetEntry["kind"]) {
  return kind === "audio"
    ? AudioLines
    : kind === "video"
      ? Film
      : kind === "image"
        ? ImageIcon
        : FileQuestion;
}

type AssetFilter = "all" | "video" | "audio" | "image" | "motion";
const ASSET_FILTERS: { value: AssetFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "image", label: "Images" },
  { value: "motion", label: "Motion" },
];

function AssetsPanel({
  doc,
  assets,
  library,
  frameStore,
  readOnly,
  onCommit,
  onSelect,
  onAssetsChanged,
  onAskClaude,
  onMentionAsset,
  onAskText,
  chatBusy,
  chatDisabled,
}: StudioInspectorProps) {
  const agentName = useAgentName();
  const [uploading, setUploading] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fps = doc.project?.fps ?? 30;
  // One preview player for the whole list: clicking another file switches to it.
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState<string | null>(null);
  // Close the preview once its row scrolls out of the list (it would float off on its own otherwise).
  useEffect(() => {
    if (!openPreview) return;
    const row = document.querySelector<HTMLElement>(
      `[data-asset-row="${CSS.escape(openPreview)}"]`,
    );
    if (!row) return;
    const root = row.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setOpenPreview(null);
      },
      { root, threshold: 0 },
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [openPreview]);
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(
    () => () => {
      previewRef.current?.pause();
      previewRef.current = null;
    },
    [],
  );

  const togglePreview = (asset: AssetEntry) => {
    const current = previewRef.current;
    if (current && previewing === asset.path) {
      current.pause();
      setPreviewing(null);
      return;
    }
    current?.pause();
    const audio = new Audio(studioFileUrl(doc.slug, asset.path));
    audio.onended = () =>
      setPreviewing((path) => (path === asset.path ? null : path));
    audio.onerror = () => {
      setPreviewing((path) => (path === asset.path ? null : path));
      toast.error(`Couldn't play ${fileName(asset.path)}.`);
    };
    previewRef.current = audio;
    setPreviewing(asset.path);
    void audio.play().catch(() => setPreviewing(null));
  };

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        const safe = file.name.replace(/[^\w.\- ]+/g, "_");
        await uploadToProject(doc.slug, `assets/${safe}`, file);
      } catch (error) {
        toast.error(
          `${file.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onAssetsChanged();
  };

  const addToTimeline = async (asset: AssetEntry) => {
    if (!doc.layers || !doc.project || readOnly) return;
    const kind: TrackKind | null =
      asset.kind === "audio"
        ? "audio"
        : asset.kind === "video"
          ? "video"
          : asset.kind === "image"
            ? "image"
            : null;
    if (!kind) return;
    setAdding(asset.path);
    try {
      let duration = fps * 3;
      if (kind !== "image") {
        const { mediaInfo } = await import("@/lib/studio/audio/media-info");
        const info = (await mediaInfo(
          studioFileUrl(doc.slug, asset.path),
          asset.path,
          fps,
        )) as { frames?: number };
        if (info.frames) duration = Math.max(1, info.frames);
      }
      const from = Math.min(
        frameStore.get(),
        Math.max(0, doc.project.durationInFrames - 1),
      );
      const id = uniqueClipId(
        doc.layers,
        fileName(asset.path).replace(/\.[^.]+$/, ""),
      );
      const clip = {
        id,
        name: fileName(asset.path),
        from,
        duration,
        src: asset.path,
      } as StudioClip;
      const result = addClip(doc.layers, kind, clip, {
        trackName: kind === "audio" ? "SFX" : undefined,
      });
      onCommit(result.layers);
      onSelect([id]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setAdding(null);
    }
  };

  const allProjectAssets = assets.filter((asset) =>
    asset.path.startsWith("assets/"),
  );
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (asset: AssetEntry) =>
    (filter === "all" || asset.kind === filter) &&
    words.every((word) => asset.path.toLowerCase().includes(word));
  const projectAssets = allProjectAssets.filter(matches);
  // Video style presets (library/presets/…) are kits for the agent, browsed in the style gallery.
  const userLibrary = library.filter(
    (asset) => !asset.path.startsWith("library:presets/"),
  );
  const libraryAssets = userLibrary.filter(matches);
  const counts: Record<AssetFilter, number> = {
    all: allProjectAssets.length + userLibrary.length,
    video: 0,
    audio: 0,
    image: 0,
    motion: COMPONENT_COUNT,
  };
  for (const asset of [...allProjectAssets, ...userLibrary]) {
    if (
      asset.kind === "video" ||
      asset.kind === "audio" ||
      asset.kind === "image"
    )
      counts[asset.kind] += 1;
  }
  const renders = assets.filter(
    (asset) => asset.path.startsWith("renders/") && /\.mp4$/i.test(asset.path),
  );

  const list = (items: AssetEntry[], addable: boolean) =>
    items.map((asset) => {
      const Icon = assetIcon(asset.kind);
      const url = studioFileUrl(doc.slug, asset.path);
      const isOpen = openPreview === asset.path;
      const canAdd = addable && asset.kind !== "other";
      return (
        <Popover
          key={asset.path}
          open={isOpen}
          onOpenChange={(open) => {
            if (open) {
              // One sound at a time: the quick-play button stops when the full player opens.
              previewRef.current?.pause();
              setPreviewing(null);
            }
            setOpenPreview(open ? asset.path : null);
          }}
        >
          <PopoverAnchor asChild>
            <div
              data-asset-row={asset.path}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  ASSET_DRAG_TYPE,
                  JSON.stringify(referenceFromAsset(asset)),
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
              title={`Click to preview and ask ${agentName} · drag into the chat to point at it`}
              onClick={(event) => {
                // The whole row opens the preview, except its own buttons (play, add, ask).
                if ((event.target as HTMLElement).closest("button")) return;
                setOpenPreview(isOpen ? null : asset.path);
              }}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted/60",
                isOpen && "bg-muted",
              )}
            >
              {asset.kind === "audio" ? (
                <button
                  type="button"
                  title={previewing === asset.path ? "Stop" : "Play"}
                  aria-label={
                    previewing === asset.path
                      ? `Stop ${fileName(asset.path)}`
                      : `Play ${fileName(asset.path)}`
                  }
                  onClick={() => togglePreview(asset)}
                  className={`shrink-0 rounded p-0.5 hover:bg-background hover:text-foreground ${previewing === asset.path ? "text-primary" : "text-muted-foreground"}`}
                >
                  {previewing === asset.path ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </button>
              ) : asset.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- thumbnail of a local helper file
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="size-5 shrink-0 rounded-[3px] bg-muted object-cover"
                />
              ) : (
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-[12px] hover:underline"
                  title={`Preview ${asset.path}`}
                >
                  {fileName(asset.path)}
                </button>
              </PopoverTrigger>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatBytes(asset.size)}
              </span>
              <button
                type="button"
                title={`Ask ${agentName} to use this`}
                aria-label={`Ask ${agentName} about ${fileName(asset.path)}`}
                onClick={() => setOpenPreview(isOpen ? null : asset.path)}
                className={cn(
                  "rounded p-0.5 text-primary hover:bg-primary/10",
                  isOpen
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                <MessageSquarePlus className="size-3.5" />
              </button>
              {canAdd ? (
                <button
                  type="button"
                  title="Add at the playhead"
                  disabled={readOnly || adding !== null}
                  onClick={() => void addToTimeline(asset)}
                  className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100 disabled:opacity-30"
                >
                  {adding === asset.path ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                </button>
              ) : null}
            </div>
          </PopoverAnchor>
          <PopoverContent
            side="left"
            align="start"
            sideOffset={14}
            collisionPadding={12}
            hideWhenDetached
            // Keep focus (and the list's scroll position) where it is.
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="w-[380px] max-w-[calc(100vw-24px)] rounded-xl p-3"
          >
            <AssetPreview
              asset={asset}
              url={url}
              addable={canAdd && !readOnly}
              adding={adding === asset.path}
              chatBusy={chatBusy}
              chatDisabled={chatDisabled}
              onAdd={() => void addToTimeline(asset)}
              onAsk={async (text) => {
                await onAskClaude(asset, text);
                setOpenPreview(null);
              }}
              onMention={() => {
                onMentionAsset(asset);
                setOpenPreview(null);
              }}
              onClose={() => setOpenPreview(null)}
            />
          </PopoverContent>
        </Popover>
      );
    });

  return (
    <div
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        void upload(event.dataTransfer.files);
      }}
    >
      <Section
        title="Project assets"
        right={
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={readOnly}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {uploading > 0 ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Upload className="size-3" />
            )}{" "}
            Upload
          </button>
        }
      >
        <div className="mb-2 space-y-1.5">
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as AssetFilter)}
          >
            <TabsList className="h-7 w-full">
              {ASSET_FILTERS.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  disabled={item.value !== "all" && counts[item.value] === 0}
                  className="h-6 gap-1 px-1.5 text-[11px]"
                >
                  {item.label}
                  <span className="text-[10px] text-muted-foreground">
                    {counts[item.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {counts.all + counts.motion > 6 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files and components"
                className="h-7 pl-7 text-[12px] md:text-[12px]"
              />
            </div>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="audio/*,video/*,image/*"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files);
            event.target.value = "";
          }}
        />
        {filter === "motion" ? null : allProjectAssets.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 p-3 text-center text-[11px] text-muted-foreground">
            Drop audio, images or video here. {agentName} can use anything in
            assets/.
          </p>
        ) : projectAssets.length === 0 ? (
          <p className="px-1.5 py-2 text-[11px] text-muted-foreground">
            No{" "}
            {filter === "all"
              ? ""
              : `${ASSET_FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} `}
            files
            {words.length ? ` matching “${query.trim()}”` : ""}.
          </p>
        ) : (
          <div className="space-y-0.5">{list(projectAssets, true)}</div>
        )}
      </Section>
      {filter === "all" || filter === "motion" ? (
        <Section title="Motion components">
          <ComponentsSection
            doc={doc}
            frameStore={frameStore}
            readOnly={readOnly}
            chatBusy={chatBusy}
            chatDisabled={chatDisabled}
            query={query}
            onCommit={onCommit}
            onSelect={onSelect}
            onAsk={onAskText}
          />
        </Section>
      ) : null}
      {libraryAssets.length > 0 && filter !== "motion" ? (
        <Section title="Library">
          <div className="space-y-0.5">{list(libraryAssets, true)}</div>
        </Section>
      ) : null}
      <Section title="Renders">
        {renders.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Exports land in renders/ and are never overwritten.
          </p>
        ) : (
          <div className="space-y-0.5">
            {list(renders.slice().reverse(), false)}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project settings

function ProjectInspector({
  project,
  readOnly,
  onSaveProject,
  onCommit,
  onAskText,
  chatBusy,
  chatDisabled,
  stylesSupported,
  onOpenStyles,
  doc,
}: StudioInspectorProps & { project: StudioProject }) {
  const agentName = useAgentName();
  const fps = project.fps;
  const save = (fields: Partial<StudioProject>) =>
    onSaveProject({ ...project, ...fields });
  return (
    <div>
      <Section title="Style">
        <StyleSection
          project={project}
          layers={doc.layers}
          supported={stylesSupported}
          readOnly={readOnly}
          onSaveProject={onSaveProject}
          onCommit={(layers) => onCommit(layers)}
          onAskText={onAskText}
          chatDisabled={chatDisabled || chatBusy}
          onBrowse={onOpenStyles}
        />
      </Section>
      <Section title="Project">
        <Row label="Name">
          <TextField
            value={project.name}
            onCommit={(value) => value.trim() && save({ name: value.trim() })}
            disabled={readOnly}
          />
        </Row>
        <Row label="Length">
          <NumberField
            value={project.durationInFrames}
            min={1}
            onCommit={(value) =>
              save({ durationInFrames: value ?? project.durationInFrames })
            }
            disabled={readOnly}
            suffix={`${(project.durationInFrames / fps).toFixed(2)}s`}
          />
        </Row>
        <Row label="FPS">
          <NumberField
            value={fps}
            min={1}
            max={120}
            onCommit={(value) => value && save({ fps: value })}
            disabled={readOnly}
          />
        </Row>
        <Row label="Background">
          <ColorField
            value={project.background}
            onCommit={(value) => save({ background: value })}
            disabled={readOnly}
          />
        </Row>
        <Row
          label="Fonts"
          hint={`Google Fonts, e.g. "Inter:400;800". Local font files are set by ${agentName} in project.json.`}
        >
          <TextField
            value={project.fonts
              .filter((f): f is string => typeof f === "string")
              .join(", ")}
            onCommit={(value) =>
              save({
                fonts: [
                  ...value
                    .split(",")
                    .map((f) => f.trim())
                    .filter(Boolean),
                  ...project.fonts.filter((f) => typeof f !== "string"),
                ],
              })
            }
            disabled={readOnly}
          />
        </Row>
      </Section>
      <Section title="Sizes">
        {Object.entries(project.variants).map(([name, size]) => (
          <p key={name} className="flex justify-between text-[12px]">
            <span className="font-semibold">
              {name}
              {name === project.defaultVariant ? (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  (default)
                </span>
              ) : null}
            </span>
            <span className="font-mono text-muted-foreground">
              {size.width}×{size.height}
            </span>
          </p>
        ))}
      </Section>
      <Section title="Folder">
        <p className="break-all font-mono text-[10px] text-muted-foreground">
          {doc.dir}
        </p>
      </Section>
    </div>
  );
}

/** Everything in renders/: where it is, play it, open it, show it in the folder. */
function RendersPanel({
  doc,
  assets,
  getBridge,
  onExport,
}: StudioInspectorProps) {
  const renders = rendersFrom(assets);
  const files = useRenderFileActions(doc.slug, getBridge);
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 flex-1"
          onClick={onExport}
          disabled={!doc.project}
        >
          <Download className="size-3.5" /> Export…
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={files.openFolder}
        >
          <FolderOpen className="size-3.5" /> Open folder
        </Button>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        {doc.slug}/renders/
      </p>
      {renders.length > 0 ? (
        <RendersList
          slug={doc.slug}
          renders={renders}
          getBridge={getBridge}
          layout="card"
        />
      ) : (
        <div className="rounded-md border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
          No renders yet. Export puts each MP4 (and its cover image) here, and
          nothing is ever overwritten.
        </div>
      )}
    </div>
  );
}
