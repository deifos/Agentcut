"use client";

// The colour page of the inspector: one panel for a clip's grade, an adjustment layer or the whole video.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { Copy, Diamond, Eye, Loader2, Plus, Scale, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { captureFrame } from "@/lib/studio/capture";
import { analyzePixels, colorIssues, type FrameStats } from "@/lib/studio/color/analyze";
import { blobToPixels, captureClipPixels, type FramePixels } from "@/lib/studio/color/frames";
import { bakeGradeCube, drawGradePreview, queueGradePreview, sharedGradePreview } from "@/lib/studio/color/preview";
import { drawScope, type ScopeKind } from "@/lib/studio/color/scopes";
import { gradesToReplace } from "@/lib/studio/color/copy-grade";
import { SUBJECT_PRESETS } from "@/lib/studio/color/tool";
import { uploadToProject } from "@/lib/studio/export";
import { studioFileUrl } from "@/lib/studio/file-url";
import type { FrameStore } from "@/lib/studio/frame-store";
import { updateClip } from "@/lib/studio/edit";
import { LIVE_PROJECT, clearLiveClip, setLiveClip } from "@/motion/components/live-clip";
import type { AssetEntry, ColorGrade, GradeFields, GradeKey, GradeBand, GradeCurvePoint, ImageClip, LoadedModule, StudioDoc, VideoClip } from "@/lib/studio/types";
import { GRADE_BANDS, bakeCurve, gradeAtFrame, isNeutralGrade, parseCube, type CubeLut } from "@/motion/components/color/grade";
import { warmGradeShaders } from "@/motion/components/color/grade-effect";
import { GRADE_LOOKS } from "@/motion/components/color/looks";
import { RangeField, Section } from "@/components/studio/StudioInspector";
import { confirmDestructive } from "@/components/studio/ConfirmHost";

export interface ColorTools {
  getModule(): LoadedModule | null;
  run(method: string, params: Record<string, unknown>): Promise<unknown>;
}

type Tab = "basic" | "wheels" | "curves" | "mixer" | "looks" | "finish" | "match";
const TABS: { id: Tab; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "wheels", label: "Wheels" },
  { id: "curves", label: "Curves" },
  { id: "mixer", label: "Mixer" },
  { id: "looks", label: "Looks" },
  { id: "finish", label: "Finish" },
  { id: "match", label: "Match" },
];

interface SliderSpec { key: keyof GradeFields; label: string; min: number; max: number; step: number; neutral: number; format(v: number): string }
const percent = (v: number) => `${Math.round(v * 100)}`;
const fromOne = (v: number) => `${Math.round((v - 1) * 100)}`;
const amount = (key: keyof GradeFields, label: string): SliderSpec => ({ key, label, min: -1, max: 1, step: 0.01, neutral: 0, format: percent });
const unit = (key: keyof GradeFields, label: string): SliderSpec => ({ key, label, min: 0, max: 1, step: 0.01, neutral: 0, format: percent });

const BASIC: SliderSpec[] = [
  { key: "exposure", label: "Exposure", min: -3, max: 3, step: 0.01, neutral: 0, format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}` },
  { key: "contrast", label: "Contrast", min: 0.5, max: 1.5, step: 0.01, neutral: 1, format: fromOne },
  amount("highlights", "Highlights"),
  amount("shadows", "Shadows"),
  amount("whites", "Whites"),
  amount("blacks", "Blacks"),
  amount("temperature", "Temperature"),
  amount("tint", "Tint"),
  amount("vibrance", "Vibrance"),
  { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.01, neutral: 1, format: fromOne },
  unit("skinProtect", "Skin protect"),
];
const MORE: SliderSpec[] = [
  { key: "brightness", label: "Brightness", min: 0.5, max: 1.5, step: 0.01, neutral: 1, format: fromOne },
  amount("warmth", "Warmth"),
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1, neutral: 0, format: (v) => `${Math.round(v)}°` },
  { key: "blackPoint", label: "Black point", min: 0, max: 0.5, step: 0.005, neutral: 0, format: percent },
  { key: "whitePoint", label: "White point", min: 0.5, max: 1, step: 0.005, neutral: 1, format: percent },
  { key: "gamma", label: "Gamma", min: 0.3, max: 3, step: 0.01, neutral: 1, format: (v) => v.toFixed(2) },
];
const FINISH: SliderSpec[] = [
  unit("grain", "Grain"),
  { key: "grainSize", label: "Grain size", min: 0.5, max: 4, step: 0.1, neutral: 1, format: (v) => v.toFixed(1) },
  unit("halation", "Halation"),
  unit("bloom", "Bloom"),
  amount("vignette", "Vignette"),
];
const SCOPES: { id: ScopeKind; label: string }[] = [
  { id: "waveform", label: "Waveform" },
  { id: "parade", label: "Parade" },
  { id: "vectorscope", label: "Vector" },
  { id: "histogram", label: "Histogram" },
];

function prune(grade: ColorGrade): ColorGrade | undefined {
  return isNeutralGrade(grade) && !grade.skinProtect ? undefined : grade;
}

const SEGMENT = "rounded px-1.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground";

function Segments<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange(value: T): void }) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-md bg-muted/40 p-0.5">
      {options.map((option) => (
        <button key={option.id} type="button" onClick={() => onChange(option.id)}
          className={cn(SEGMENT, "flex-1", option.id === value && "bg-background text-foreground")}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scopes

function useProgramFrame(options: { doc: StudioDoc; variant: string; frame: number; tools: ColorTools }) {
  const { doc, variant, frame, tools } = options;
  const [pixels, setPixels] = useState<FramePixels | null>(null);
  useEffect(() => {
    const loaded = tools.getModule();
    if (!loaded || !doc.project || !doc.layers) return;
    let cancelled = false;
    // Only once the playhead rests: this is a real render, the same as the export's.
    const timer = window.setTimeout(() => {
      const size = doc.project!.variants[variant];
      void captureFrame({ doc, loaded, variant, frame, scale: Math.min(1, 320 / size.width), format: "png" })
        .then(blobToPixels)
        .then((next) => {
          if (!cancelled) setPixels(next);
        })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc, variant, frame, tools]);
  return pixels;
}

function Scope({ kind, pixels }: { kind: ScopeKind; pixels: FramePixels }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const image = drawScope(kind, pixels.data, pixels.width, pixels.height);
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0b0b0d";
    ctx.fillRect(0, 0, image.width, image.height);
    const layer = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    const offscreen = new OffscreenCanvas(image.width, image.height);
    offscreen.getContext("2d")!.putImageData(layer, 0, 0);
    ctx.drawImage(offscreen, 0, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    if (kind === "vectorscope") {
      const c = (image.width - 1) / 2;
      ctx.beginPath();
      ctx.arc(c, c, c - 1, 0, Math.PI * 2);
      ctx.moveTo(c - 4, c);
      ctx.lineTo(c + 4, c);
      ctx.moveTo(c, c - 4);
      ctx.lineTo(c, c + 4);
      ctx.stroke();
      // The skin line, about 123 degrees round from the blue axis.
      ctx.strokeStyle = "rgba(255,190,150,0.65)";
      ctx.beginPath();
      ctx.moveTo(c, c);
      const angle = (123 * Math.PI) / 180;
      ctx.lineTo(c + Math.cos(angle) * (c - 1), c - Math.sin(angle) * (c - 1));
      ctx.stroke();
    } else {
      for (const level of [0.25, 0.5, 0.75]) {
        const at = kind === "histogram" ? level * image.width : level * image.height;
        ctx.beginPath();
        if (kind === "histogram") {
          ctx.moveTo(at, 0);
          ctx.lineTo(at, image.height);
        } else {
          ctx.moveTo(0, at);
          ctx.lineTo(image.width, at);
        }
        ctx.stroke();
      }
    }
  }, [kind, pixels]);
  return <canvas ref={ref} data-testid="color-scope" className={cn("w-full rounded border border-border/60 bg-black", kind === "vectorscope" && "mx-auto max-w-40")} />;
}

function statsLine(stats: FrameStats) {
  const parts = [`Clipped ${stats.clippedHighlights.toFixed(1)}%`, `Crushed ${stats.crushedShadows.toFixed(1)}%`, `Median ${Math.round(stats.luma.p50 * 100)}%`];
  if (stats.skin.hueOffset !== null) parts.push(`Skin ${stats.skin.hueOffset > 0 ? "+" : ""}${Math.round(stats.skin.hueOffset)}°`);
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Colour wheel

const WHEEL_SIZE = 76;

function Wheel({ label, x, y, level, disabled, onPreview, onCommit }: {
  label: string;
  x: number;
  y: number;
  level: number;
  disabled: boolean;
  onPreview(next: { x: number; y: number; level: number }): void;
  onCommit(next: { x: number; y: number; level: number }): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Holds its own position while moving, so a move re-renders this wheel and nothing else.
  const [moving, setMoving] = useState<{ x: number; y: number; level: number } | null>(null);
  const dragging = moving !== null;
  const shownX = moving?.x ?? x;
  const shownY = moving?.y ?? y;
  const shownLevel = moving?.level ?? level;
  const positionFrom = (event: ReactPointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    let px = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    let py = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    const length = Math.hypot(px, py);
    if (length > 1) {
      px /= length;
      py /= length;
    }
    // Fine control: the outer half of the wheel is more than any real grade needs.
    return { x: Number((px * 0.6).toFixed(3)), y: Number((py * 0.6).toFixed(3)), level };
  };
  return (
    <div className="flex min-w-0 flex-col items-center gap-1">
      <div
        ref={ref}
        role="slider"
        aria-label={`${label} colour`}
        aria-valuetext={`x ${shownX.toFixed(2)}, y ${shownY.toFixed(2)}`}
        aria-valuenow={Math.round(Math.hypot(shownX, shownY) * 100)}
        tabIndex={disabled ? -1 : 0}
        data-testid={`wheel-${label.toLowerCase()}`}
        className={cn("relative rounded-full border border-border/70 touch-none", disabled ? "opacity-50" : "cursor-crosshair")}
        style={{
          width: WHEEL_SIZE,
          height: WHEEL_SIZE,
          background: "radial-gradient(circle, rgba(127,127,127,1) 0%, rgba(127,127,127,0) 70%), conic-gradient(from 90deg, #e8483c, #d943c5, #4a57e0, #3fc8d6, #42c55a, #d9c63c, #e8483c)",
        }}
        onDoubleClick={() => !disabled && onCommit({ x: 0, y: 0, level })}
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const next = positionFrom(event);
          setMoving(next);
          onPreview(next);
        }}
        onPointerMove={(event) => {
          if (!dragging) return;
          const next = positionFrom(event);
          setMoving(next);
          onPreview(next);
        }}
        onPointerUp={(event) => {
          if (!dragging) return;
          setMoving(null);
          onCommit(positionFrom(event));
        }}
      >
        <span
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${50 + (shownX / 0.6) * 50}%`, top: `${50 - (shownY / 0.6) * 50}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
      <input
        type="range"
        min={-1}
        max={1}
        step={0.01}
        value={shownLevel}
        disabled={disabled}
        aria-label={`${label} level`}
        className="h-1 w-full accent-foreground"
        onChange={(event) => {
          const next = { x, y, level: Number(event.target.value) };
          setMoving(next);
          onPreview(next);
        }}
        onPointerUp={(event) => {
          setMoving(null);
          onCommit({ x, y, level: Number(event.currentTarget.value) });
        }}
        onKeyUp={(event) => {
          setMoving(null);
          onCommit({ x, y, level: Number(event.currentTarget.value) });
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curves

type CurveChannel = "master" | "r" | "g" | "b";
const CURVE_COLORS: Record<CurveChannel, string> = { master: "currentColor", r: "#ef5a4f", g: "#4cc36a", b: "#5a7bf0" };
const DEFAULT_CURVE: GradeCurvePoint[] = [[0, 0], [1, 1]];

function CurveEditor({ points: savedPoints, channel, disabled, onPreview, onCommit }: {
  points: GradeCurvePoint[];
  channel: CurveChannel;
  disabled: boolean;
  onPreview(points: GradeCurvePoint[]): void;
  onCommit(points: GradeCurvePoint[]): void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  // Holds its own points while moving, so a move re-renders this editor and nothing else.
  const [moving, setMoving] = useState<GradeCurvePoint[] | null>(null);
  const points = moving ?? savedPoints;
  const line = useMemo(() => {
    const baked = bakeCurve(points, 128);
    return Array.from(baked, (y, i) => `${(i / 127) * 100},${(1 - y) * 100}`).join(" ");
  }, [points]);
  const at = (event: ReactPointerEvent): GradeCurvePoint => {
    const rect = ref.current!.getBoundingClientRect();
    return [
      Number(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)).toFixed(3)),
      Number(Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height)).toFixed(3)),
    ];
  };
  const moved = (index: number, point: GradeCurvePoint) => {
    const next = points.map((p): GradeCurvePoint => [...p]);
    // A point can't pass its neighbours, and the end points stay at the ends.
    const min = index === 0 ? 0 : next[index - 1][0] + 0.01;
    const max = index === next.length - 1 ? 1 : next[index + 1][0] - 0.01;
    next[index] = [index === 0 ? 0 : index === next.length - 1 ? 1 : Math.min(max, Math.max(min, point[0])), point[1]];
    return next;
  };
  return (
    <svg
      ref={ref}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="curve-editor"
      className={cn("h-40 w-full touch-none rounded border border-border/60 bg-muted/40 text-foreground", disabled && "opacity-50")}
      onPointerDown={(event) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = at(event);
        const hit = points.findIndex((p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < 0.06);
        if (hit >= 0) {
          setDrag(hit);
          return;
        }
        if (points.length >= 16) return;
        const next = [...points, point].sort((a, b) => a[0] - b[0]);
        setDrag(next.findIndex((p) => p === point));
        setMoving(next);
        onPreview(next);
      }}
      onPointerMove={(event) => {
        if (drag === null) return;
        const next = moved(drag, at(event));
        setMoving(next);
        onPreview(next);
      }}
      onPointerUp={(event) => {
        if (drag === null) return;
        const next = moved(drag, at(event));
        setDrag(null);
        setMoving(null);
        onCommit(next);
      }}
      onDoubleClick={(event) => {
        if (disabled) return;
        const point = at(event as unknown as ReactPointerEvent);
        const hit = points.findIndex((p, i) => i > 0 && i < points.length - 1 && Math.hypot(p[0] - point[0], p[1] - point[1]) < 0.06);
        if (hit >= 0) onCommit(points.filter((_, i) => i !== hit));
      }}
    >
      {[25, 50, 75].map((v) => (
        <g key={v} stroke="currentColor" strokeOpacity={0.14} strokeWidth={0.5} vectorEffect="non-scaling-stroke">
          <line x1={v} y1={0} x2={v} y2={100} />
          <line x1={0} y1={v} x2={100} y2={v} />
        </g>
      ))}
      <line x1={0} y1={100} x2={100} y2={0} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.5} />
      <polyline points={line} fill="none" stroke={CURVE_COLORS[channel]} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], i) => (
        <rect key={i} x={x * 100 - 1.2} y={(1 - y) * 100 - 1.6} width={2.4} height={3.2} fill={CURVE_COLORS[channel]} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Look thumbnails, drawn from the real frame with the same shader as the export

// One object per look, so a re-render of the panel doesn't redraw every thumbnail.
const LOOK_GRADES: Record<string, ColorGrade> = Object.fromEntries(GRADE_LOOKS.map((look) => [look.id, { look: look.id }]));

function LookThumb({ source, grade, label, active, disabled, title, onClick }: {
  source: OffscreenCanvas | null;
  grade: ColorGrade;
  label: string;
  active: boolean;
  disabled: boolean;
  title: string;
  onClick(): void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!source) return;
    return queueGradePreview(() => {
      const preview = sharedGradePreview();
      if (ref.current && preview) drawGradePreview(preview, source, grade, ref.current);
    });
  }, [source, grade]);
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} data-testid={`look-${label}`}
      className={cn("group min-w-0 overflow-hidden rounded border text-left", active ? "border-foreground" : "border-border/60 hover:border-foreground/50")}>
      <canvas ref={ref} className="aspect-video w-full bg-muted object-cover" />
      <span className="block truncate px-1 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------

export function ColorPanel({
  title = "Color",
  grade: savedGrade,
  clip,
  kind,
  doc,
  variant,
  frameStore,
  assets,
  disabled,
  tools,
  clipFrom = 0,
  liveId,
  onChange,
  onAssetsChanged,
  onAddAdjustment,
}: {
  title?: string;
  grade: ColorGrade | undefined;
  /** The clip this grades, when it has its own footage. */
  clip?: VideoClip | ImageClip;
  kind?: "video" | "image";
  doc: StudioDoc;
  variant: string;
  frameStore: FrameStore;
  assets: AssetEntry[];
  disabled: boolean;
  tools: ColorTools | null;
  /** Where the grade's key frames count from on the timeline. */
  clipFrom?: number;
  /** Where edits in progress go: the clip's id, or LIVE_PROJECT. */
  liveId: string;
  /** Save the grade. Runs when a control is released, not while it moves. */
  onChange(grade: ColorGrade | undefined): void;
  onAssetsChanged(): void;
  onAddAdjustment?(): void;
}) {
  useEffect(warmGradeShaders, []);
  const [tab, setTab] = useState<Tab>("basic");
  const [scopeKind, setScopeKind] = useState<ScopeKind>("waveform");
  const [scopesOpen, setScopesOpen] = useState(false);
  // The grade while a control moves. A ref, because a move must not re-render the panel.
  const draft = useRef<ColorGrade | null>(null);
  const scopeTimer = useRef<number | undefined>(undefined);
  const [scopeDraft, setScopeDraft] = useState<ColorGrade | null>(null);
  const [channel, setChannel] = useState<CurveChannel>("master");
  const [band, setBand] = useState<GradeBand>("orange");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const grade = savedGrade ?? {};
  const keyed = Boolean(grade.keys?.length);
  // Only follow the playhead when something here shows it, so playback doesn't re-render all of this.
  const followsFrame = keyed || scopesOpen || tab === "looks";
  const readFrame = () => (followsFrame ? frameStore.get() : 0);
  const frame = useSyncExternalStore(frameStore.subscribe, readFrame, readFrame);
  const localFrame = Math.max(0, frame - clipFrom);
  // With keys, the controls show and edit the grade at the playhead.
  const shown: GradeFields = keyed ? gradeAtFrame(grade, localFrame) : grade;
  const keyHere = grade.keys?.find((key) => key.frame === localFrame);

  const emit = (next: ColorGrade, preview: boolean) => {
    const pruned = prune(next);
    window.clearTimeout(scopeTimer.current);
    if (preview) {
      draft.current = next;
      setLiveClip(liveId, { grade: pruned });
      // Scopes catch up when the control pauses.
      if (scopesOpen) scopeTimer.current = window.setTimeout(() => setScopeDraft(next), 200);
      return;
    }
    draft.current = null;
    setScopeDraft(null);
    onChange(pruned);
    clearLiveClip(liveId);
  };

  /** Write fields to the grade, or to a key at the playhead when the grade is animated. */
  const write = (fields: GradeFields, preview: boolean) => {
    const base = draft.current ?? savedGrade ?? {};
    if (!base.keys?.length) {
      const next: ColorGrade = { ...base, ...fields };
      for (const [key, value] of Object.entries(fields)) if (value === undefined) delete next[key as keyof GradeFields];
      emit(next, preview);
      return;
    }
    const keys = [...base.keys];
    const at = Math.max(0, frameStore.get() - clipFrom);
    const index = keys.findIndex((key) => key.frame === at);
    const updated: GradeKey = { ...(index >= 0 ? keys[index] : { frame: at }), ...fields };
    if (index >= 0) keys[index] = updated;
    else keys.push(updated);
    keys.sort((a, b) => a.frame - b.frame);
    emit({ ...base, keys }, preview);
  };

  const sliders = (specs: SliderSpec[]) =>
    specs.map((spec) => {
      const clean = (value: number) => (Math.abs(value - spec.neutral) < 1e-6 && !keyed ? undefined : value);
      return (
        <RangeField
          key={spec.key}
          label={spec.label}
          disabled={disabled}
          value={(shown[spec.key] as number | undefined) ?? spec.neutral}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          format={spec.format}
          onPreview={(value) => write({ [spec.key]: clean(value) }, true)}
          onCommit={(value) => write({ [spec.key]: clean(value) }, false)}
        />
      );
    });

  const scopeDoc = useMemo(() => {
    if (!scopeDraft) return doc;
    if (liveId === LIVE_PROJECT) return doc.project ? { ...doc, project: { ...doc.project, grade: scopeDraft } } : doc;
    return doc.layers ? { ...doc, layers: updateClip(doc.layers, liveId, { grade: scopeDraft } as Partial<VideoClip>) } : doc;
  }, [doc, liveId, scopeDraft]);
  const program = useProgramFrame({ doc: scopeDoc, variant, frame, tools: useToolsOrIdle(tools, scopesOpen) });
  const programStats = useMemo(() => (program ? analyzePixels(program.data) : null), [program]);
  const issues = useMemo(() => (programStats ? colorIssues(programStats) : []), [programStats]);

  // Look thumbnails: this clip's frame without any look, redrawn only when the frame or clip changes.
  const [lookSource, setLookSource] = useState<OffscreenCanvas | null>(null);
  const looksOpen = tab === "looks";
  const sourceFrame = clip ? Math.max(0, Math.min(clip.duration - 1, frame - clip.from)) : 0;
  useEffect(() => {
    if (!looksOpen || !tools) return;
    const loaded = tools.getModule();
    if (!loaded || !doc.project || !doc.layers) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const size = doc.project!.variants[variant];
      const take = clip
        ? captureClipPixels({ doc, loaded, variant, clip, kind, stage: "balanced", at: [sourceFrame], width: 240 }).then((frames) => frames[0])
        : captureFrame({ doc: { ...doc, project: { ...doc.project!, grade: undefined } }, loaded, variant, frame, scale: Math.min(1, 240 / size.width), format: "png" }).then(blobToPixels);
      void take
        .then((pixels) => {
          if (cancelled) return;
          const canvas = new OffscreenCanvas(pixels.width, pixels.height);
          canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
          setLookSource(canvas);
        })
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // The look source ignores colour changes: it is the frame before any look.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looksOpen, tools, clip?.id, clip?.src, sourceFrame, variant]);
  const runBusy = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    try {
      await work();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const importCube = (file: File) =>
    runBusy("Importing LUT", async () => {
      const text = await file.text();
      parseCube(text);
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const saved = await uploadToProject(doc.slug, `assets/looks/${safe}`, new Blob([text], { type: "text/plain" }));
      onAssetsChanged();
      write({ lut: saved, lutStrength: 1 }, false);
      toast.success(`Applied ${file.name}`);
    });

  const saveCube = () =>
    runBusy("Saving look", async () => {
      const name = `look-${Date.now().toString(36)}`;
      const fields = gradeAtFrame(grade, Math.max(0, frameStore.get() - clipFrom));
      let lut: CubeLut | null = null;
      if (fields.lut) {
        const response = await fetch(studioFileUrl(doc.slug, fields.lut));
        if (!response.ok) throw new Error(`Couldn't read ${fields.lut}.`);
        lut = parseCube(await response.text());
      }
      const cube = bakeGradeCube(fields, name, lut);
      const saved = await uploadToProject(doc.slug, `assets/looks/${name}.cube`, new Blob([cube], { type: "text/plain" }));
      onAssetsChanged();
      toast.success(`Saved ${saved}`);
    });

  const references = useMemo(
    () => assets.filter((asset) => asset.path.startsWith("assets/") && (asset.kind === "image" || asset.kind === "video") && !asset.path.startsWith("assets/cutouts/")),
    [assets],
  );

  const callTool = (label: string, method: string, params: Record<string, unknown>) =>
    runBusy(label, async () => {
      if (!tools) throw new Error("The studio is still loading.");
      const result = (await tools.run(method, { project: doc.slug, ...params })) as { status?: string; message?: string; reason?: string; summary?: string };
      if (result.status === "error") throw new Error(result.message ?? "That didn't work.");
      if (result.status === "skipped") toast.info(result.reason ?? "Nothing to do.");
      else toast.success(result.summary ?? `${label}: done`);
    });

  /** Copying replaces other clips' own grades, so it asks first when there are any. */
  const copyingTool = async (label: string, params: Record<string, unknown>) => {
    if (!clip || !doc.layers) return;
    const replaced = gradesToReplace(doc.layers, clip.id);
    if (replaced > 0) {
      const confirmed = await confirmDestructive({
        title: `Replace the grade on ${replaced} other ${replaced === 1 ? "clip" : "clips"}?`,
        description: "They'll get this clip's look and settings instead of their own. You can bring them back with Undo.",
        action: "Replace grades",
      });
      if (!confirmed) return;
    }
    await callTool(label, "studio_match_shots", { anchorClipId: clip.id, ...params });
  };

  /** A button's icon, swapped for a spinner while that button's work runs. */
  const toolIcon = (label: string, Icon: typeof Sparkles) =>
    busy === label ? <Loader2 className="size-3 animate-spin" data-testid="tool-spinner" /> : <Icon className="size-3" />;

  const addKey = () => {
    const at = Math.max(0, frameStore.get() - clipFrom);
    const current = gradeAtFrame(grade, at);
    const { look: _look, lut: _lut, match: _match, curves: _curves, ...numbers } = current;
    void _look; void _lut; void _match; void _curves;
    const keys = [...(grade.keys ?? []).filter((key) => key.frame !== at), { ...numbers, frame: at }].sort((a, b) => a.frame - b.frame);
    emit({ ...grade, keys }, false);
  };
  const removeKey = (at: number) => {
    const keys = (grade.keys ?? []).filter((key) => key.frame !== at);
    const next: ColorGrade = { ...grade, keys: keys.length ? keys : undefined };
    if (!keys.length) delete next.keys;
    emit(next, false);
  };
  const toggleHold = (at: number) => {
    emit({ ...grade, keys: (grade.keys ?? []).map((key) => (key.frame === at ? { ...key, hold: key.hold ? undefined : true } : key)) }, false);
  };

  const wheels = shown.wheels ?? {};
  const setWheel = (name: "shadows" | "midtones" | "highlights", next: { x: number; y: number; level: number }, preview: boolean) =>
    write({ wheels: { ...wheels, [name]: next } }, preview);
  const curves = shown.curves ?? {};
  const setCurve = (points: GradeCurvePoint[], preview: boolean) => write({ curves: { ...curves, [channel]: points } }, preview);
  const bandValue = shown.hsl?.[band] ?? {};
  const setBandField = (field: "hue" | "saturation" | "luminance", value: number, preview: boolean) =>
    write({ hsl: { ...(shown.hsl ?? {}), [band]: { ...bandValue, [field]: value } } }, preview);

  const hasGrade = Boolean(savedGrade && Object.keys(savedGrade).length);

  return (
    <Section
      title={title}
      right={
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={scopesOpen}
            onClick={() => setScopesOpen((open) => !open)}
            className={cn(SEGMENT, scopesOpen && "bg-muted text-foreground")}
          >
            Scopes
          </button>
          {hasGrade ? (
            <>
              <button
                type="button"
                title="Hold to see the picture without this grade"
                aria-label="Hold to compare with the original"
                disabled={disabled}
                className={SEGMENT}
                onPointerDown={() => setLiveClip(liveId, { grade: undefined })}
                onPointerUp={() => clearLiveClip(liveId)}
                onPointerLeave={() => clearLiveClip(liveId)}
              >
                <Eye className="size-3" />
              </button>
              <Button type="button" variant="ghost" size="xs" disabled={disabled}
                onClick={async () => {
                  const confirmed = await confirmDestructive({
                    title: "Reset this grade?",
                    description: "Every colour setting here goes back to neutral. You can bring it back with Undo.",
                    action: "Reset grade",
                  });
                  if (confirmed) emit({}, false);
                }}
                className="h-5 px-1.5 text-[10px]">
                Reset
              </Button>
            </>
          ) : null}
        </span>
      }
    >
      {scopesOpen ? (
        <div className="space-y-1.5">
          <Segments<ScopeKind> value={scopeKind} options={SCOPES} onChange={setScopeKind} />
          {program ? <Scope kind={scopeKind} pixels={program} /> : <div className="h-20 animate-pulse rounded bg-muted/40" />}
          {programStats ? <p className="text-[10px] tabular-nums text-muted-foreground" data-testid="color-stats">{statsLine(programStats)}</p> : null}
          {issues.map((issue) => (
            <p key={issue.code} className="text-[10px] text-amber-600 dark:text-amber-400">{issue.message}</p>
          ))}
        </div>
      ) : null}

      <Segments<Tab> value={tab} options={TABS} onChange={setTab} />

      {tab === "basic" ? (
        <div className="space-y-2">
          {sliders(BASIC)}
          <button type="button" className={SEGMENT} onClick={() => setShowMore((open) => !open)}>
            {showMore ? "Fewer controls" : "More controls"}
          </button>
          {showMore ? sliders(MORE) : null}
        </div>
      ) : null}

      {tab === "wheels" ? (
        <div className="grid grid-cols-3 gap-2">
          {(["shadows", "midtones", "highlights"] as const).map((name) => {
            const wheel = wheels[name] ?? {};
            return (
              <Wheel
                key={name}
                label={name === "midtones" ? "Midtones" : name === "shadows" ? "Shadows" : "Highlights"}
                x={wheel.x ?? 0}
                y={wheel.y ?? 0}
                level={wheel.level ?? 0}
                disabled={disabled}
                onPreview={(next) => setWheel(name, next, true)}
                onCommit={(next) => setWheel(name, next, false)}
              />
            );
          })}
        </div>
      ) : null}

      {tab === "curves" ? (
        <div className="space-y-1.5">
          <Segments<CurveChannel>
            value={channel}
            options={[{ id: "master", label: "Master" }, { id: "r", label: "Red" }, { id: "g", label: "Green" }, { id: "b", label: "Blue" }]}
            onChange={setChannel}
          />
          <CurveEditor
            points={curves[channel] ?? DEFAULT_CURVE}
            channel={channel}
            disabled={disabled}
            onPreview={(points) => setCurve(points, true)}
            onCommit={(points) => setCurve(points, false)}
          />
          <p className="text-[10px] text-muted-foreground">Click to add a point, drag to move, double-click to remove.</p>
        </div>
      ) : null}

      {tab === "mixer" ? (
        <div className="space-y-2">
          <div className="flex gap-1" role="radiogroup" aria-label="Colour band">
            {GRADE_BANDS.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={band === name}
                aria-label={name}
                title={name}
                onClick={() => setBand(name)}
                className={cn("h-4 flex-1 rounded-sm border", band === name ? "border-foreground" : "border-transparent")}
                style={{ background: { red: "#e0433a", orange: "#e8913a", yellow: "#e5d03f", green: "#4cbb58", aqua: "#40c4c9", blue: "#4a6be0", purple: "#8e55d8", magenta: "#d748b6" }[name] }}
              />
            ))}
          </div>
          {(["hue", "saturation", "luminance"] as const).map((field) => (
            <RangeField
              key={field}
              label={`${band[0].toUpperCase()}${band.slice(1)} ${field}`}
              disabled={disabled}
              value={bandValue[field] ?? 0}
              min={-1}
              max={1}
              step={0.01}
              format={percent}
              onPreview={(value) => setBandField(field, value, true)}
              onCommit={(value) => setBandField(field, value, false)}
            />
          ))}
        </div>
      ) : null}

      {tab === "looks" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {GRADE_LOOKS.map((look) => (
              <LookThumb
                key={look.id}
                source={lookSource}
                grade={LOOK_GRADES[look.id]}
                label={look.name}
                title={look.description}
                active={shown.look === look.id}
                disabled={disabled}
                onClick={() => write({ look: shown.look === look.id ? undefined : look.id }, false)}
              />
            ))}
          </div>
          {shown.look ? (
            <RangeField label="Look strength" disabled={disabled} value={shown.lookStrength ?? 1} min={0} max={1} step={0.01} format={percent}
              onPreview={(value) => write({ lookStrength: value }, true)} onCommit={(value) => write({ lookStrength: value }, false)} />
          ) : null}
          {shown.lut ? (
            <div className="space-y-1 rounded border border-border/60 p-1.5">
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className="truncate font-medium" title={shown.lut}>{shown.lut.split("/").pop()}</span>
                <button type="button" aria-label="Remove LUT" disabled={disabled} onClick={async () => {
                  const confirmed = await confirmDestructive({
                    title: "Remove this LUT from the grade?",
                    description: "The .cube file stays in assets/looks/. You can bring it back with Undo.",
                    action: "Remove LUT",
                  });
                  if (confirmed) write({ lut: undefined, lutStrength: undefined }, false);
                }}><X className="size-3" /></button>
              </div>
              <RangeField label="LUT strength" disabled={disabled} value={shown.lutStrength ?? 1} min={0} max={1} step={0.01} format={percent}
                onPreview={(value) => write({ lutStrength: value }, true)} onCommit={(value) => write({ lutStrength: value }, false)} />
            </div>
          ) : null}
          <div className="flex gap-1">
            <input ref={fileInput} type="file" accept=".cube" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importCube(file);
            }} />
            <Button type="button" variant="outline" size="xs" className="flex-1 text-[10px]" disabled={disabled || Boolean(busy)} onClick={() => fileInput.current?.click()}>
              <Upload className="size-3" /> Import .cube
            </Button>
            <Button type="button" variant="outline" size="xs" className="flex-1 text-[10px]" disabled={disabled || Boolean(busy) || !hasGrade} onClick={() => void saveCube()}>
              Save as .cube
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "finish" ? <div className="space-y-2">{sliders(FINISH)}</div> : null}

      {tab === "match" ? (
        <div className="space-y-2 text-[11px]">
          {clip ? (
            <div className="space-y-1">
              <p className="font-semibold text-muted-foreground">Shots</p>
              <Button type="button" variant="outline" size="xs" className="w-full text-[10px]" disabled={disabled || Boolean(busy)}
                onClick={() => void copyingTool("Match shots", { copyGrade: true })}>
                {toolIcon("Match shots", Sparkles)} Match all shots to this one
              </Button>
              <p className="text-[10px] text-muted-foreground">Evens out exposure and colour, then gives every clip this clip&apos;s look and settings.</p>
              <div className="grid grid-cols-2 gap-1">
                <Button type="button" variant="ghost" size="xs" className="h-auto min-h-6 whitespace-normal py-1 text-[10px]" disabled={disabled || Boolean(busy)}
                  onClick={() => void copyingTool("Copy grade", { copyGrade: true, balance: false })}>
                  {toolIcon("Copy grade", Copy)} Only copy the grade
                </Button>
                <Button type="button" variant="ghost" size="xs" className="h-auto min-h-6 whitespace-normal py-1 text-[10px]" disabled={disabled || Boolean(busy)}
                  onClick={() => void callTool("Even out shots", "studio_match_shots", { anchorClipId: clip.id })}>
                  {toolIcon("Even out shots", Scale)} Only even out exposure
                </Button>
              </div>
              {grade.match ? (
                <Button type="button" variant="ghost" size="xs" className="w-full text-[10px]" disabled={disabled}
                  onClick={async () => {
                    const confirmed = await confirmDestructive({
                      title: "Clear this clip's match?",
                      description: "Its shot matching correction goes away. You can bring it back with Undo.",
                      action: "Clear match",
                    });
                    if (confirmed) write({ match: undefined }, false);
                  }}>
                  Clear this clip&apos;s match
                </Button>
              ) : null}
            </div>
          ) : null}
          {clip ? (
            <div className="space-y-1">
              <p className="font-semibold text-muted-foreground">Match a reference</p>
              <select className="h-7 w-full rounded border border-border bg-background px-1 text-[11px]" aria-label="Reference" value={reference} onChange={(event) => setReference(event.target.value)}>
                <option value="">Choose an image or video…</option>
                {references.map((asset) => <option key={asset.path} value={asset.path}>{asset.path.replace(/^assets\//, "")}</option>)}
              </select>
              <Button type="button" variant="outline" size="xs" className="w-full text-[10px]" disabled={disabled || Boolean(busy) || !reference}
                onClick={() => void callTool("Match look", "studio_match_look", { reference })}>
                {toolIcon("Match look", Sparkles)} Match all footage to it
              </Button>
            </div>
          ) : null}
          {clip && kind === "video" ? (
            <div className="space-y-1">
              <p className="font-semibold text-muted-foreground">Person and background</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(SUBJECT_PRESETS).map(([id, preset]) => (
                  <Button key={id} type="button" variant="outline" size="xs" className="h-auto min-h-6 whitespace-normal py-1 text-[10px]" disabled={disabled || Boolean(busy)}
                    onClick={() => void callTool(preset.label, "studio_grade_subject", { clipId: clip.id, preset: id })}>
                    {busy === preset.label ? toolIcon(preset.label, Sparkles) : null} {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {onAddAdjustment ? (
            <Button type="button" variant="outline" size="xs" className="w-full text-[10px]" disabled={disabled} onClick={onAddAdjustment}>
              <Plus className="size-3" /> Add an adjustment layer here
            </Button>
          ) : null}
          {busy ? (
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground" role="status">
              <Loader2 className="size-3 animate-spin" /> {busy}…
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1 border-t border-border/40 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground">Over time</span>
          <Button type="button" variant="ghost" size="xs" className="h-5 px-1.5 text-[10px]" disabled={disabled} onClick={addKey} title="Keep the grade at this frame; it eases to the next key">
            <Diamond className={cn("size-3", keyHere && "fill-current")} /> Key at playhead
          </Button>
        </div>
        {grade.keys?.length ? (
          <ul className="flex flex-wrap gap-1">
            {grade.keys.map((key) => (
              <li key={key.frame} className={cn("flex items-center gap-1 rounded border px-1 text-[10px] tabular-nums", key.frame === localFrame ? "border-foreground" : "border-border/60")}>
                <button type="button" title={key.hold ? "Jumps to the next key" : "Eases to the next key"} onClick={() => toggleHold(key.frame)} disabled={disabled}>
                  {key.frame}f {key.hold ? "hold" : ""}
                </button>
                <button type="button" aria-label={`Remove key at frame ${key.frame}`} onClick={async () => {
                    const confirmed = await confirmDestructive({
                      title: `Remove the key at frame ${key.frame}?`,
                      description: "You can bring it back with Undo.",
                      action: "Remove key",
                    });
                    if (confirmed) removeKey(key.frame);
                  }} disabled={disabled}><X className="size-2.5" /></button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

const IDLE_TOOLS: ColorTools = { getModule: () => null, run: async () => null };

/** Scopes render frames, so they only get real tools while they're open. */
function useToolsOrIdle(tools: ColorTools | null, active: boolean) {
  return active && tools ? tools : IDLE_TOOLS;
}
