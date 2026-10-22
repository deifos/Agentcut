import { z } from "zod";

// Agentcut project format (v1). Mirrors template/runtime/types.ts.

const finite = z.number().finite();
const frame = z.number().int().min(0);
const positiveFrames = z.number().int().min(1);
const unit = finite.min(0).max(1);

export const boxSchema = z
  .object({ x: finite, y: finite, width: finite.positive(), height: finite.positive() })
  .strict();

export const clipAnimSchema = z
  .object({
    preset: z.enum([
      "fade",
      "slide-up",
      "slide-down",
      "slide-left",
      "slide-right",
      "pop",
      "scale",
      "blur",
      "none",
    ]),
    frames: z.number().int().min(0),
  })
  .strict();

const textStyleSchema = z
  .object({
    fontFamily: z.string().optional(),
    fontSize: finite.positive().optional(),
    fontWeight: z.number().int().min(100).max(1000).optional(),
    color: z.string().optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    lineHeight: finite.positive().optional(),
    letterSpacing: finite.optional(),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
    shadow: z.string().optional(),
  })
  .strict();

const captionStyleSchema = z
  .object({
    preset: z.enum(["pop", "karaoke", "plain"]).optional(),
    fontFamily: z.string().optional(),
    fontSize: finite.positive().optional(),
    fontWeight: z.number().int().min(100).max(1000).optional(),
    color: z.string().optional(),
    highlight: z.string().optional(),
    position: z.enum(["bottom", "center", "top"]).optional(),
    maxWordsPerLine: z.number().int().min(1).max(20).optional(),
  })
  .strict();

const baseClipShape = {
  id: z.string().min(1),
  name: z.string().optional(),
  from: frame,
  duration: positiveFrames,
  enter: clipAnimSchema.optional(),
  exit: clipAnimSchema.optional(),
  opacity: unit.optional(),
  note: z.string().optional(),
};

const srcSchema = z.string().min(1);

const sceneFields = {
  /** A scene file in scenes/ (scenes/Hook.tsx → "Hook")… */
  scene: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "scene must be a component file name like Hook").optional(),
  /** …or a component from the Agentcut library ("text-reveal"). One of the two. */
  component: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "component must be a library id like text-reveal").optional(),
  props: z.record(z.unknown()).optional(),
};

/** What the helper knows about the library components (template/components/catalog.json). */
export interface ComponentCatalogEntry {
  id: string;
  props: Record<string, { type: string; min?: number; max?: number; options?: { value: string }[] }>;
}
/** Color grade for footage (CSS filters, so the browser export draws it). 1 = unchanged. */
const gradeSchema = z
  .object({
    brightness: finite.min(0).max(3).optional(),
    contrast: finite.min(0).max(3).optional(),
    saturation: finite.min(0).max(3).optional(),
    /** -1 cool … 0 neutral … 1 warm */
    warmth: finite.min(-1).max(1).optional(),
    /** degrees */
    hue: finite.min(-180).max(180).optional(),
  })
  .strict();
const videoCursorSchema = z
  .object({
    /** `<video>.cursor.json` (path, clicks and scrolls in frames of the video file). */
    src: srcSchema,
    style: z.enum(["classic", "accent", "spotlight", "hand", "hidden"]).optional(),
    size: finite.min(50).max(200).optional(),
    clicks: z.boolean().optional(),
    smoothing: unit.optional(),
  })
  .strict();
const videoFields = {
  src: srcSchema,
  trimStart: frame.optional(),
  grade: gradeSchema.optional(),
  volume: finite.min(0).max(4).optional(),
  muted: z.boolean().optional(),
  fit: z.enum(["cover", "contain"]).optional(),
  box: boxSchema.optional(),
  radius: finite.min(0).optional(),
  playbackRate: finite.positive().optional(),
  cursor: videoCursorSchema.optional(),
  /** "none" keeps the project style's camera moves off this clip. */
  camera: z.enum(["style", "none"]).optional(),
};
const imageFields = {
  src: srcSchema,
  fit: z.enum(["cover", "contain"]).optional(),
  box: boxSchema.optional(),
  radius: finite.min(0).optional(),
};
const textFields = {
  text: z.string(),
  box: boxSchema.optional(),
  style: textStyleSchema.optional(),
};
const captionsFields = {
  words: z.array(z.object({ text: z.string(), from: frame, to: frame }).strict()),
  style: captionStyleSchema.optional(),
};
const audioFields = {
  src: srcSchema,
  volume: finite.min(0).max(4).optional(),
  trimStart: frame.optional(),
  fadeIn: frame.optional(),
  fadeOut: frame.optional(),
  loop: z.boolean().optional(),
  playbackRate: finite.positive().optional(),
  role: z.enum(["voice", "music", "sfx", "ambience"]).optional(),
};

function clipSchema<T extends z.ZodRawShape>(fields: T) {
  const overrideShape = { ...baseClipShape, ...fields } as z.ZodRawShape;
  delete (overrideShape as Record<string, unknown>).id;
  const override = z.object(overrideShape).partial().strict();
  return z
    .object({ ...baseClipShape, ...fields, variants: z.record(override).optional() })
    .strict();
}

export const clipSchemas = {
  scene: clipSchema(sceneFields),
  video: clipSchema(videoFields),
  image: clipSchema(imageFields),
  text: clipSchema(textFields),
  captions: clipSchema(captionsFields),
  audio: clipSchema(audioFields),
} as const;

export type TrackKind = keyof typeof clipSchemas;
export const TRACK_KINDS = Object.keys(clipSchemas) as TrackKind[];

const trackBase = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-_]*$/i, "track id must be kebab-case"),
  name: z.string().min(1),
  hidden: z.boolean().optional(),
  muted: z.boolean().optional(),
  locked: z.boolean().optional(),
  volume: finite.min(0).max(4).optional(),
};

export const trackSchema = z.discriminatedUnion("kind", [
  z.object({ ...trackBase, kind: z.literal("scene"), clips: z.array(clipSchemas.scene) }).strict(),
  z.object({ ...trackBase, kind: z.literal("video"), clips: z.array(clipSchemas.video) }).strict(),
  z.object({ ...trackBase, kind: z.literal("image"), clips: z.array(clipSchemas.image) }).strict(),
  z.object({ ...trackBase, kind: z.literal("text"), clips: z.array(clipSchemas.text) }).strict(),
  z.object({ ...trackBase, kind: z.literal("captions"), clips: z.array(clipSchemas.captions) }).strict(),
  z.object({ ...trackBase, kind: z.literal("audio"), clips: z.array(clipSchemas.audio) }).strict(),
]);

export const markerSchema = z
  .object({
    id: z.string().min(1),
    frame,
    label: z.string(),
    kind: z.enum(["beat", "cue", "section"]).optional(),
  })
  .strict();

export const layersSchema = z
  .object({
    version: z.literal(1),
    tracks: z.array(trackSchema),
    markers: z.array(markerSchema).default([]),
  })
  .strict();

export const projectSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1),
    fps: z.number().int().min(1).max(120),
    durationInFrames: positiveFrames,
    background: z.string().default("#000000"),
    variants: z
      .record(
        z
          .object({
            width: z.number().int().min(16).max(7680),
            height: z.number().int().min(16).max(7680),
          })
          .strict(),
      )
      .refine((value) => Object.keys(value).length > 0, "at least one variant is required"),
    defaultVariant: z.string().min(1),
    fonts: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              family: z.string().min(1),
              src: z.string().min(1),
              weight: z.string().optional(),
              style: z.enum(["normal", "italic"]).optional(),
            })
            .strict(),
        ]),
      )
      .default([]),
    /** A style id from components/STYLES.md ("clean", "loud", …). */
    style: z.string().min(1).optional(),
  })
  .strict()
  .refine((value) => value.variants[value.defaultVariant] !== undefined, {
    message: "defaultVariant must be one of variants",
    path: ["defaultVariant"],
  });

export type StudioLayers = z.infer<typeof layersSchema>;
export type StudioProject = z.infer<typeof projectSchema>;

export interface ValidationIssue {
  file: "project.json" | "layers.json";
  path: string;
  message: string;
  severity: "error" | "warning";
}

function issuesFromZod(file: ValidationIssue["file"], error: z.ZodError): ValidationIssue[] {
  return error.issues.slice(0, 40).map((issue) => ({
    file,
    path: issue.path.join("."),
    message: issue.message,
    severity: "error" as const,
  }));
}

export function parseProject(
  raw: unknown,
  styleIds: string[] | null = null,
):
  | { ok: true; value: StudioProject; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] } {
  const result = projectSchema.safeParse(raw);
  if (!result.success) return { ok: false, issues: issuesFromZod("project.json", result.error) };
  const issues: ValidationIssue[] = [];
  const style = result.data.style;
  if (style && styleIds && !styleIds.includes(style)) {
    issues.push({
      file: "project.json",
      path: "style",
      message: `Unknown style "${style}" (styles: ${styleIds.join(", ")}). The project renders without one.`,
      severity: "warning",
    });
  }
  return { ok: true, value: result.data, issues };
}

/** Schema + cross-checks (unique ids, sorted clips, overlaps, clips past the end). */
export function parseLayers(
  raw: unknown,
  project: StudioProject | null,
  sceneNames: string[] | null,
  components: ComponentCatalogEntry[] | null = null,
):
  | { ok: true; value: StudioLayers; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] } {
  const result = layersSchema.safeParse(raw);
  if (!result.success) return { ok: false, issues: issuesFromZod("layers.json", result.error) };
  const layers = result.data;
  const issues: ValidationIssue[] = [];
  const trackIds = new Set<string>();
  const clipIds = new Set<string>();
  layers.tracks.forEach((track, t) => {
    if (trackIds.has(track.id)) {
      issues.push({ file: "layers.json", path: `tracks.${t}.id`, message: `duplicate track id "${track.id}"`, severity: "error" });
    }
    trackIds.add(track.id);
    let previousFrom = -1;
    let previousEnd = -1;
    track.clips.forEach((clip, c) => {
      const path = `tracks.${t}.clips.${c}`;
      if (clipIds.has(clip.id)) {
        issues.push({ file: "layers.json", path: `${path}.id`, message: `duplicate clip id "${clip.id}"`, severity: "error" });
      }
      clipIds.add(clip.id);
      if (clip.from < previousFrom) {
        issues.push({ file: "layers.json", path, message: `clips on track "${track.id}" must be sorted by from`, severity: "warning" });
      }
      const overlapAllowed = track.kind === "scene" || track.kind === "audio";
      if (!overlapAllowed && clip.from < previousEnd) {
        issues.push({ file: "layers.json", path, message: `clip "${clip.id}" overlaps the previous clip on ${track.kind} track "${track.id}"`, severity: "warning" });
      }
      previousFrom = clip.from;
      previousEnd = Math.max(previousEnd, clip.from + clip.duration);
      if (project && clip.from + clip.duration > project.durationInFrames) {
        issues.push({
          file: "layers.json",
          path,
          message: `clip "${clip.id}" ends at frame ${clip.from + clip.duration}, after the project end (${project.durationInFrames})`,
          severity: "warning",
        });
      }
      if (track.kind === "scene") {
        const sceneClip = clip as { scene?: string; component?: string; props?: Record<string, unknown> };
        if (!sceneClip.scene && !sceneClip.component) {
          issues.push({
            file: "layers.json",
            path,
            message: `scene clip "${clip.id}" needs "scene" (a file in scenes/) or "component" (a library id)`,
            severity: "error",
          });
        } else if (sceneClip.scene && sceneClip.component) {
          issues.push({
            file: "layers.json",
            path,
            message: `scene clip "${clip.id}" has both "scene" and "component"; keep one`,
            severity: "error",
          });
        }
        if (sceneClip.component && components) {
          const entry = components.find((c) => c.id === sceneClip.component);
          if (!entry) {
            issues.push({
              file: "layers.json",
              path: `${path}.component`,
              message: `unknown component "${sceneClip.component}" (agentcut_components lists them)`,
              severity: "error",
            });
          } else {
            for (const [key, value] of Object.entries(sceneClip.props ?? {})) {
              const spec = entry.props[key];
              const at = `${path}.props.${key}`;
              if (!spec) {
                issues.push({ file: "layers.json", path: at, message: `"${key}" isn't a prop of ${entry.id} (props: ${Object.keys(entry.props).join(", ")})`, severity: "warning" });
              } else if (spec.type === "number" && (typeof value !== "number" || (spec.min !== undefined && value < spec.min) || (spec.max !== undefined && value > spec.max))) {
                issues.push({ file: "layers.json", path: at, message: `${key} should be a number from ${spec.min} to ${spec.max}`, severity: "warning" });
              } else if (spec.type === "select" && !spec.options?.some((o) => o.value === value)) {
                issues.push({ file: "layers.json", path: at, message: `${key} should be one of ${spec.options?.map((o) => o.value).join(", ")}`, severity: "warning" });
              } else if (spec.type === "boolean" && typeof value !== "boolean") {
                issues.push({ file: "layers.json", path: at, message: `${key} should be true or false`, severity: "warning" });
              } else if (spec.type === "lines" && !Array.isArray(value)) {
                issues.push({ file: "layers.json", path: at, message: `${key} should be a list of lines`, severity: "warning" });
              }
            }
          }
        }
      }
      if (track.kind === "scene" && sceneNames && "scene" in clip && clip.scene && !sceneNames.includes(clip.scene)) {
        issues.push({
          file: "layers.json",
          path: `${path}.scene`,
          message: `scene "${clip.scene}" has no scenes/${clip.scene}.tsx`,
          severity: "error",
        });
      }
      if (project && clip.variants) {
        for (const key of Object.keys(clip.variants)) {
          if (!project.variants[key]) {
            issues.push({ file: "layers.json", path: `${path}.variants.${key}`, message: `unknown variant "${key}"`, severity: "warning" });
          }
        }
      }
    });
  });
  // Duplicate ids make clips unaddressable; treat the file as invalid so the
  // page keeps the last good version until it's fixed.
  if (issues.some((issue) => issue.severity === "error" && issue.message.startsWith("duplicate"))) {
    return { ok: false, issues };
  }
  layers.markers.forEach((marker, m) => {
    if (project && marker.frame > project.durationInFrames) {
      issues.push({ file: "layers.json", path: `markers.${m}`, message: `marker "${marker.label}" is after the project end`, severity: "warning" });
    }
  });
  return { ok: true, value: layers, issues };
}
