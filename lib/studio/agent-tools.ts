// Claude's MCP tools that need the browser (pixels, audio, export). The MCP
// server sends `{ id, method, params }` over the bridge; StudioBridge calls
// runStudioTool() and returns the result. Images go back as data URLs; the MCP
// server saves them as files Claude can open.
import type { PlayerRef } from "@remotion/player";
import type { StudioBridge } from "@/lib/studio/bridge";
import { studioFileUrl } from "@/lib/studio/bundle";
import { blobToDataUrl, variantSize } from "@/lib/studio/composition-props";
import type { FrameStore } from "@/lib/studio/frame-store";
import { findClip } from "@/lib/studio/edit";
import type { StudioCursorTrack } from "@/lib/studio/cursor-track";
import type { LoadedModule, StudioDoc } from "@/lib/studio/types";

const NO_MUSIC_LIBRARY =
  "The hosted music library isn't set up on this Agentcut (NEXT_PUBLIC_MUSIC_CDN_URL). Use agentcut_generate_music, a CC0 track, or music the user adds to assets/.";

export interface StudioExportJobUpdate {
  slug: string;
  variant: string;
  stage:
    | "preparing"
    | "rendering"
    | "encoding"
    | "uploading"
    | "installing"
    | "done"
    | "cancelled"
    | "error";
  progress: number;
  message?: string;
  path?: string;
  where: "browser" | "local";
}

export interface StudioToolContext {
  getDoc(): StudioDoc | null;
  getModule(): LoadedModule | null;
  getVariant(): string;
  getSelection(): string[];
  frameStore: FrameStore;
  getPlayer(): PlayerRef | null;
  setSelection(ids: string[]): void;
  setVariant(variant: string | null): void;
  openProject(slug: string): Promise<void>;
  syncProject(): Promise<void>;
  setExportJob(job: StudioExportJobUpdate | null): void;
  bridge(): StudioBridge | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function numberList(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((n) => Number.isFinite(n))
    : [];
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

/** Make sure the page shows `project` (if given) with the latest files and bundle. */
async function ready(
  context: StudioToolContext,
  params: Record<string, unknown>,
) {
  const wanted = typeof params.project === "string" ? params.project : null;
  const current = context.getDoc();
  if (wanted && wanted !== current?.slug) await context.openProject(wanted);
  else await context.syncProject();
  const doc = context.getDoc();
  if (!doc)
    throw new Error(
      "No project is open in the studio. Open or create one first.",
    );
  if (!doc.project || !doc.layers) {
    const errors = doc.issues.filter((issue) => issue.severity === "error");
    throw new Error(
      `The project files are invalid: ${errors.map((issue) => `${issue.file} ${issue.path}: ${issue.message}`).join("; ")}`,
    );
  }
  return doc;
}

function requireModule(context: StudioToolContext, doc: StudioDoc) {
  const loaded = context.getModule();
  if (!loaded || loaded.slug !== doc.slug) {
    throw new Error(
      "The project's code hasn't loaded in the page (check agentcut_status for build errors).",
    );
  }
  return loaded;
}

function pickVariant(
  context: StudioToolContext,
  doc: StudioDoc,
  value: unknown,
) {
  const variant =
    typeof value === "string" && value ? value : context.getVariant();
  if (!doc.project?.variants[variant]) {
    throw new Error(
      `Unknown variant "${variant}". Variants: ${Object.keys(doc.project?.variants ?? {}).join(", ")}.`,
    );
  }
  return variant;
}

function assertProjectPath(path: string) {
  if (
    /^[a-z]:[\\/]/i.test(path) ||
    path.startsWith("/") ||
    path.includes("..")
  ) {
    throw new Error(
      `"${path}" isn't a project path. Use assets/<file> (copy the file into the project's assets/ folder first) or library:<path>.`,
    );
  }
}

export async function runStudioTool(
  method: string,
  rawParams: unknown,
  context: StudioToolContext,
): Promise<unknown> {
  const params = asRecord(rawParams);
  switch (method) {
    case "studio_page_status": {
      const doc = context.getDoc();
      const loaded = context.getModule();
      return {
        activeProject: doc?.slug ?? null,
        projectName: doc?.project?.name ?? null,
        variant: context.getVariant(),
        playheadFrame: context.frameStore.get(),
        selectedClipIds: context.getSelection(),
        loadedBundleRevision:
          loaded?.slug === doc?.slug ? (loaded?.revision ?? null) : null,
        issues: doc?.issues ?? [],
      };
    }

    case "studio_open_project": {
      const slug = String(params.project ?? params.slug ?? "");
      if (!slug) throw new Error("project is required.");
      await context.openProject(slug);
      const doc = context.getDoc();
      return { opened: doc?.slug === slug, project: doc?.slug ?? null };
    }

    case "studio_focus": {
      const doc = await ready(context, params);
      if (typeof params.variant === "string")
        context.setVariant(pickVariant(context, doc, params.variant));
      let frame = typeof params.frame === "number" ? params.frame : null;
      if (typeof params.clipId === "string") {
        const location = doc.layers
          ? findClip(doc.layers, params.clipId)
          : null;
        if (!location) throw new Error(`No clip "${params.clipId}".`);
        context.setSelection([params.clipId]);
        if (frame === null) frame = location.clip.from;
      }
      if (frame !== null) {
        const clamped = Math.max(
          0,
          Math.min((doc.project?.durationInFrames ?? 1) - 1, Math.round(frame)),
        );
        context.getPlayer()?.pause();
        context.getPlayer()?.seekTo(clamped);
        context.frameStore.set(clamped);
      }
      return {
        ok: true,
        frame: context.frameStore.get(),
        selectedClipIds: context.getSelection(),
      };
    }

    case "studio_capture_frames": {
      const doc = await ready(context, params);
      const loaded = requireModule(context, doc);
      const variant = pickVariant(context, doc, params.variant);
      const frames = numberList(params.frames);
      if (frames.length === 0)
        throw new Error("frames is required (a list of frame numbers).");
      if (frames.length > 24)
        throw new Error(
          "Capture at most 24 frames per call (use contact_sheet for more).",
        );
      const size = variantSize(doc.project!, variant);
      const scale =
        typeof params.scale === "number"
          ? Math.max(0.1, Math.min(1, params.scale))
          : size.width > 1920
            ? 0.5
            : 1;
      const { captureFrame } = await import("@/lib/studio/capture");
      const out = [];
      for (const frame of frames) {
        const blob = await captureFrame({
          doc,
          loaded,
          variant,
          frame,
          scale,
          format: "png",
        });
        out.push({
          frame,
          seconds: Number((frame / doc.project!.fps).toFixed(3)),
          variant,
          width: Math.round(size.width * scale),
          height: Math.round(size.height * scale),
          mimeType: "image/png",
          dataUrl: await blobToDataUrl(blob),
        });
      }
      return {
        project: doc.slug,
        frames: out,
        renderer: "remotion-web-renderer (same as browser export)",
      };
    }

    case "studio_contact_sheet": {
      const doc = await ready(context, params);
      const loaded = requireModule(context, doc);
      const variant = pickVariant(context, doc, params.variant);
      const total = doc.project!.durationInFrames;
      let frames = numberList(params.frames);
      if (frames.length === 0) {
        const from = typeof params.from === "number" ? params.from : 0;
        const to = typeof params.to === "number" ? params.to : total - 1;
        const every =
          typeof params.every === "number" && params.every > 0
            ? params.every
            : Math.max(1, Math.round((to - from) / 15));
        for (let f = from; f <= to; f += every) frames.push(Math.round(f));
      }
      frames = frames.slice(0, 48);
      const { captureContactSheet } = await import("@/lib/studio/capture");
      const blob = await captureContactSheet({
        doc,
        loaded,
        variant,
        frames,
        columns:
          typeof params.columns === "number" ? params.columns : undefined,
      });
      return {
        project: doc.slug,
        variant,
        frames,
        mimeType: "image/png",
        dataUrl: await blobToDataUrl(blob),
      };
    }

    case "studio_media_info": {
      const doc = await ready(context, params);
      const paths = stringList(params.paths ?? params.path);
      if (paths.length === 0) throw new Error("paths is required.");
      const [{ mediaInfo }, cursorTracks] = await Promise.all([
        import("@/lib/studio/audio/media-info"),
        import("@/lib/studio/cursor-track"),
      ]);
      const fps = doc.project!.fps;
      // Companion recordings have a `<video>.cursor.json`: summarize clicks, idle and typing.
      const cursorSummary = async (path: string) => {
        const response = await fetch(studioFileUrl(doc.slug, path)).catch(
          () => null,
        );
        if (!response?.ok) return undefined;
        const track = (await response
          .json()
          .catch(() => null)) as StudioCursorTrack | null;
        return track?.version === 1
          ? { path, ...cursorTracks.summarizeCursorTrack(track) }
          : undefined;
      };
      const results = [];
      for (const path of paths.slice(0, 40)) {
        assertProjectPath(path);
        try {
          if (path.endsWith(".cursor.json")) {
            const cursor = await cursorSummary(path);
            if (!cursor) throw new Error("Not a cursor file.");
            results.push({ path, cursor });
            continue;
          }
          const cursor = /\.(mp4|webm|mov|m4v|mkv)$/i.test(path)
            ? await cursorSummary(cursorTracks.cursorTrackPathFor(path))
            : undefined;
          results.push({
            path,
            ...(await mediaInfo(studioFileUrl(doc.slug, path), path, fps)),
            ...(cursor ? { cursor } : {}),
          });
        } catch (error) {
          results.push({
            path,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return { fps, files: results };
    }

    case "studio_transcribe": {
      const doc = await ready(context, params);
      const path = String(params.path ?? "");
      assertProjectPath(path);
      const { transcribeUrl } = await import("@/lib/studio/audio/transcribe");
      return transcribeUrl(studioFileUrl(doc.slug, path), {
        fps: doc.project!.fps,
        language: typeof params.language === "string" ? params.language : "en",
        model:
          params.model === "small" || params.model === "tiny"
            ? params.model
            : "base",
      });
    }

    case "studio_analyze_audio": {
      const doc = await ready(context, params);
      const path = String(params.path ?? "");
      assertProjectPath(path);
      const { analyzeAudioUrl } = await import("@/lib/studio/audio/analyze");
      return analyzeAudioUrl(studioFileUrl(doc.slug, path), doc.project!.fps);
    }

    case "studio_listen_measure":
    case "studio_listen_rank":
    case "studio_listen_tags":
    case "studio_listen_realness":
    case "studio_listen_critique": {
      const doc = await ready(context, params);
      const { runListenTool } = await import("@/lib/studio/listen");
      return runListenTool(method, params, {
        doc,
        variant: pickVariant(context, doc, params.variant),
      });
    }

    case "studio_export": {
      const doc = await ready(context, params);
      const loaded = requireModule(context, doc);
      const variants = stringList(params.variants);
      const list = variants.length
        ? variants
        : Object.keys(doc.project!.variants);
      for (const variant of list) pickVariant(context, doc, variant);
      const { exportInBrowser } = await import("@/lib/studio/export");
      const results = [];
      for (const variant of list) {
        context.setExportJob({
          slug: doc.slug,
          variant,
          stage: "preparing",
          progress: 0,
          where: "browser",
        });
        try {
          const result = await exportInBrowser({
            doc,
            loaded,
            variant,
            normalizeLoudness: params.normalizeLoudness !== false,
            coverFrame:
              typeof params.coverFrame === "number"
                ? params.coverFrame
                : undefined,
            videoCodec:
              params.videoCodec === "vp9" || params.videoCodec === "av1"
                ? params.videoCodec
                : "h264",
            onProgress: (stage, progress, message) =>
              context.setExportJob({
                slug: doc.slug,
                variant,
                stage,
                progress,
                message,
                where: "browser",
              }),
          });
          context.setExportJob({
            slug: doc.slug,
            variant,
            stage: "done",
            progress: 1,
            path: result.path,
            where: "browser",
          });
          results.push({
            variant,
            path: result.path,
            cover: result.coverPath,
            bytes: result.size,
            mastering: result.mastering,
            measuredAfterEncode: result.measured,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          context.setExportJob({
            slug: doc.slug,
            variant,
            stage: "error",
            progress: 0,
            message,
            where: "browser",
          });
          results.push({ variant, error: message });
        }
      }
      return {
        project: doc.slug,
        folder: doc.dir ? `${doc.dir}/renders` : "renders/",
        results,
      };
    }

    case "studio_music_catalog": {
      // The editor's hosted Agentcut music library.
      const { MUSIC_TRACKS, MUSIC_LIBRARY_AVAILABLE } = await import("@/lib/music-tracks");
      if (!MUSIC_LIBRARY_AVAILABLE) throw new Error(NO_MUSIC_LIBRARY);
      const query =
        typeof params.query === "string"
          ? params.query.trim().toLowerCase()
          : "";
      const words = query.split(/\s+/).filter(Boolean);
      const category =
        typeof params.category === "string" ? params.category : "";
      const min = typeof params.minSeconds === "number" ? params.minSeconds : 0;
      const max =
        typeof params.maxSeconds === "number" ? params.maxSeconds : Infinity;
      const tracks = MUSIC_TRACKS.filter(
        (t) =>
          !t.isCustom &&
          (!category || t.category === category) &&
          t.durationSeconds >= min &&
          t.durationSeconds <= max &&
          (!words.length ||
            words.some((w) =>
              `${t.name} ${t.category}`.toLowerCase().includes(w),
            )),
      );
      const counts: Record<string, number> = {};
      for (const t of MUSIC_TRACKS)
        counts[t.category] = (counts[t.category] ?? 0) + 1;
      return {
        total: MUSIC_TRACKS.length,
        categories: counts,
        matches: tracks.length,
        tracks: tracks.slice(0, 300).map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          seconds: t.durationSeconds,
          ...(t.isNew ? { new: true } : {}),
        })),
        note: "Names and categories only say so much: add 3–6 candidates with studio_add_catalog_music, then rank them by ear with the listen tools.",
      };
    }

    case "studio_add_catalog_music": {
      const doc = await ready(context, params);
      const ids = stringList(params.ids ?? params.id).slice(0, 8);
      if (ids.length === 0)
        throw new Error(
          "ids is required (track ids from studio_music_catalog).",
        );
      const { MUSIC_TRACKS, MUSIC_LIBRARY_AVAILABLE, getMusicTrackUrl } =
        await import("@/lib/music-tracks");
      if (!MUSIC_LIBRARY_AVAILABLE) throw new Error(NO_MUSIC_LIBRARY);
      const { uploadToProject } = await import("@/lib/studio/export");
      const existing = new Set(
        (
          (await context
            .bridge()
            ?.request<{ assets: { path: string }[] }>("studio.assets.list", {
              slug: doc.slug,
            })
            .catch(() => null)) ?? { assets: [] }
        ).assets.map((a) => a.path),
      );
      const results = [];
      for (const id of ids) {
        const track = MUSIC_TRACKS.find((t) => t.id === id);
        if (!track) {
          results.push({ id, error: "No such track id." });
          continue;
        }
        try {
          const ext = (track.filename.split(".").pop() || "mp3").toLowerCase();
          const target = `assets/music/${track.id}.${ext}`;
          if (existing.has(target)) {
            results.push({
              id,
              name: track.name,
              path: target,
              seconds: track.durationSeconds,
              note: "already in the project",
            });
            continue;
          }
          const url = new URL(
            getMusicTrackUrl(track.filename, track.sourceUrl),
            window.location.href,
          ).href;
          const response = await fetch(url);
          if (!response.ok)
            throw new Error(`Download failed (${response.status}).`);
          const blob = await response.blob();
          const saved = await uploadToProject(doc.slug, target, blob);
          results.push({
            id,
            name: track.name,
            path: saved,
            seconds: track.durationSeconds,
          });
        } catch (error) {
          results.push({
            id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      await context.syncProject();
      return { added: results };
    }

    case "studio_components": {
      // The Agentcut component library, as this page renders it.
      const { getMotionStyle, MOTION_COMPONENTS, styledPropKeys } =
        await import("@/motion/components");
      const id = typeof params.id === "string" ? params.id : "";
      if (id) {
        const entry = MOTION_COMPONENTS[id];
        if (!entry)
          throw new Error(
            `No component "${id}". Available: ${Object.keys(MOTION_COMPONENTS).join(", ")}.`,
          );
        const { meta } = entry;
        // With a project style, the example's colors and fonts would override it: leave them out.
        const style = getMotionStyle(context.getDoc()?.project?.style);
        const styled = style ? styledPropKeys(meta.id) : [];
        const props = Object.fromEntries(
          Object.entries(meta.examples[0]?.props ?? {}).filter(
            ([key]) => !styled.includes(key),
          ),
        );
        return {
          ...meta,
          usage: {
            note: style
              ? `A clip on a scene track. Props left out get their defaults; put only what you change. The project uses the ${style.name} style: leave ${styled.join(", ") || "nothing"} out so they follow it.`
              : "A clip on a scene track. Props left out get their defaults; put only what you change.",
            clip: {
              id: `${meta.id}-1`,
              from: 0,
              duration: meta.durationInFrames,
              component: meta.id,
              props,
            },
          },
        };
      }
      const query =
        typeof params.query === "string"
          ? params.query.toLowerCase().split(/\s+/).filter(Boolean)
          : [];
      const category =
        typeof params.category === "string" ? params.category : "";
      const list = Object.values(MOTION_COMPONENTS)
        .map((entry) => entry.meta)
        .filter((meta) => !category || meta.category === category)
        .filter((meta) =>
          query.every((word) =>
            `${meta.id} ${meta.name} ${meta.category} ${meta.description} ${meta.useWhen} ${meta.tags.join(" ")}`
              .toLowerCase()
              .includes(word),
          ),
        );
      return {
        total: Object.keys(MOTION_COMPONENTS).length,
        components: list.map((meta) => ({
          id: meta.id,
          name: meta.name,
          category: meta.category,
          description: meta.description,
          useWhen: meta.useWhen,
          layer: meta.layer,
          durationInFrames: meta.durationInFrames,
          props: Object.keys(meta.props),
          examples: meta.examples.map((e) => e.name),
        })),
        next: "Call again with id for the full props and a ready clip to paste into layers.json.",
      };
    }

    default:
      throw new Error(
        `"${method}" isn't an Agentcut tool. This tab is the studio; the video editor tools need the editor page open instead.`,
      );
  }
}
