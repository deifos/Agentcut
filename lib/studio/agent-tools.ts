// Claude's MCP tools that need the browser (pixels, audio, export). The MCP
// server sends `{ id, method, params }` over the bridge; StudioBridge calls
// runStudioTool() and returns the result. Images go back as data URLs; the MCP
// server saves them as files Claude can open.
import type { PlayerRef } from "@remotion/player";
import type { StudioBridge } from "@/lib/studio/bridge";
import { studioFileUrl } from "@/lib/studio/bundle";
import { blobToDataUrl, variantSize } from "@/lib/studio/composition-props";
import type { FrameStore } from "@/lib/studio/frame-store";
import {
  PreviewPerfRecorder,
  slowClips,
  type PreviewPerfReport,
  type PreviewPerfStore,
} from "@/lib/studio/preview-perf";
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
  previewPerf: PreviewPerfStore;
  getPlayer(): PlayerRef | null;
  setSelection(ids: string[]): void;
  setVariant(variant: string | null): void;
  openProject(slug: string): Promise<void>;
  /** Wait for the user to open `slug` (the page asks them); never switches on its own. */
  waitForProject(slug: string): Promise<void>;
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
  // The user may be working on another project: ask them instead of switching under them.
  if (wanted && wanted !== current?.slug) await context.waitForProject(wanted);
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

const PREVIEW_ONLY =
  "Preview only: exports render every frame at full quality. Never lower what the render shows to fix this; see the skill's Preview performance rules.";

/** What the agent needs from a smoothness report: totals and the clips that don't keep up. */
function summarizePerf(report: PreviewPerfReport, currentRevision: number | null) {
  return {
    source: report.source,
    variant: report.variant,
    bundleRevision: report.revision,
    current: report.revision === currentRevision,
    measuredAt: new Date(report.at).toISOString(),
    framesPlayed: report.framesPlayed,
    framesDropped: report.framesDropped,
    dropRate: report.dropRate,
    stalls: report.stalls,
    stallMs: report.stallMs,
    longestFreezeMs: report.longestFreezeMs,
    longestFreezeFrame: report.longestFreezeFrame,
    maxElements: report.maxElements,
    ...(report.tabHidden ? { tabHidden: "The tab was hidden for part of it; those frames aren't counted." } : {}),
    slowClips: slowClips(report).map((c) => ({
      id: c.id,
      label: c.label,
      kind: c.kind,
      from: c.from,
      to: c.to,
      verdict: c.verdict,
      dropRate: c.dropRate,
      stallMs: c.stallMs,
      longestFreezeMs: c.longestFreezeMs,
      maxElements: c.maxElements,
      ...(c.cause ? {} : { sharesDropsOnly: "Another slow clip on screen at the same time draws more: fix that one first." }),
      ...(c.slowToMount
        ? { slowToMount: `Drops ${c.mountDropped} of ${c.mountFrames} frames in the second before it starts, while it mounts early (setup work in render).` }
        : {}),
      ...(c.overlaps.length ? { overlaps: c.overlaps } : {}),
    })),
    clips: report.clips.map((c) => ({
      id: c.id,
      label: c.label,
      verdict: c.verdict,
      dropRate: c.dropRate,
      maxElements: c.maxElements,
      ...(c.droppedWhileOthersMount ? { droppedWhileOthersMount: c.droppedWhileOthersMount } : {}),
    })),
    note: PREVIEW_ONLY,
  };
}

// A hidden tab doesn't paint: never wait on it for more than a moment.
const nextPaint = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 250);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      }),
    );
  });

const BACKGROUND_TAB =
  "The Agentcut tab is in the background, where the browser slows it down on purpose, so a check would be meaningless. Ask the user to bring the Agentcut tab to the front, then run it again.";

/**
 * Play `from`..`to` muted in the user's preview and record how smoothly it draws. The page keeps its
 * play button, playhead and mute state on the user's side while `checking` (StudioPreview), so a
 * player that remounts mid-check comes back where the user left it.
 */
async function checkPreview(
  context: StudioToolContext,
  doc: StudioDoc,
  revision: number,
  variant: string,
  from: number,
  to: number,
) {
  const player = context.getPlayer();
  if (!player) throw new Error("The preview isn't on screen; ask the user to open the project.");
  if (context.previewPerf.get().checking)
    throw new Error("A preview check is already playing. Wait for it to finish; run checks one at a time.");
  const fps = doc.project!.fps;
  const frame0 = player.getCurrentFrame();
  const wasPlaying = player.isPlaying();
  const wasMuted = player.isMuted();
  // Paused before `checking`, so the page shows the user's playback as paused for the check.
  player.pause();
  context.previewPerf.setChecking(true);
  player.mute();
  const recorder = new PreviewPerfRecorder(
    { slug: doc.slug, variant, revision, fps, layers: doc.layers!, source: "check", lastFrame: to },
    () => player.getContainerNode(),
  );
  let timedOut = false;
  const cleanups: (() => void)[] = [];
  try {
    player.seekTo(from);
    await nextPaint();
    await new Promise<void>((resolve, reject) => {
      let previous = -1;
      const done = () => {
        recorder.finish(to);
        resolve();
      };
      const onFrame = (event: { detail: { frame: number } }) => {
        const frame = event.detail.frame;
        // Past the end, or looped back to the start (it can skip `to` itself): done.
        if (frame > to || frame < from || frame < previous) return done();
        previous = frame;
        recorder.frame(frame);
        if (frame === to) done();
      };
      const onWaiting = () => recorder.waiting(player.getCurrentFrame());
      const onResume = () => recorder.resume();
      // The player pauses itself just before `ended` (end of the video, loop off).
      let ended = false;
      const onEnded = () => {
        ended = true;
        done();
      };
      const tookOver = () =>
        reject(new Error("The user paused or moved the preview during the check, so it stopped. Run it again when they're done."));
      const onPause = () => setTimeout(() => !ended && tookOver(), 0);
      player.addEventListener("frameupdate", onFrame);
      player.addEventListener("waiting", onWaiting);
      player.addEventListener("resume", onResume);
      player.addEventListener("ended", onEnded);
      player.addEventListener("pause", onPause);
      player.addEventListener("seeked", tookOver);
      cleanups.push(() => {
        player.removeEventListener("frameupdate", onFrame);
        player.removeEventListener("waiting", onWaiting);
        player.removeEventListener("resume", onResume);
        player.removeEventListener("ended", onEnded);
        player.removeEventListener("pause", onPause);
        player.removeEventListener("seeked", tookOver);
      });
      const limit = ((to - from + 1) / fps) * 4000 + 10_000;
      const timer = setTimeout(() => {
        timedOut = true;
        resolve();
      }, limit);
      // A rebuild or variant switch replaces the player mid-check: the numbers would mix two versions.
      // A hidden tab barely plays: the numbers would be meaningless.
      const watch = setInterval(() => {
        if (context.getPlayer() !== player)
          reject(new Error("The preview reloaded during the check (a rebuild or variant switch). Run it again."));
        else if (document.visibilityState !== "visible") reject(new Error(BACKGROUND_TAB));
      }, 250);
      cleanups.push(() => {
        clearTimeout(timer);
        clearInterval(watch);
      });
      player.play();
    });
  } finally {
    for (const cleanup of cleanups) cleanup();
    recorder.resume();
    const current = context.getPlayer();
    if (current === player) {
      player.pause();
      player.seekTo(frame0);
      if (!wasMuted) player.unmute();
    }
    // StudioPreview puts the user's mute choice back once `checking` ends (also on a new player).
    context.previewPerf.setChecking(false);
    if (wasPlaying) current?.play();
  }
  const report = recorder.report();
  context.previewPerf.setReport(report);
  return { report, timedOut };
}

/** A capture region in composition pixels, clamped to the frame (null: the whole frame). */
function captureRegion(value: unknown, size: { width: number; height: number }) {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN);
  const x = Math.max(0, num(r.x));
  const y = Math.max(0, num(r.y));
  const width = Math.min(size.width - x, num(r.width));
  const height = Math.min(size.height - y, num(r.height));
  if (![x, y, width, height].every(Number.isFinite) || width < 1 || height < 1)
    throw new Error(`region must be {x, y, width, height} in pixels inside the ${size.width}x${size.height} frame.`);
  return { x, y, width, height };
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
        ...(() => {
          const { check, playback } = context.previewPerf.get();
          if (!doc) return {};
          const revision = loaded?.slug === doc.slug ? loaded.revision : null;
          const mine = (report: PreviewPerfReport | null) => (report?.slug === doc.slug ? report : null);
          const lastCheck = mine(check);
          const userPlayback = mine(playback);
          if (!lastCheck && !userPlayback) return {};
          return {
            previewPerformance: {
              ...(lastCheck ? { lastCheck: summarizePerf(lastCheck, revision) } : {}),
              ...(userPlayback ? { playback: summarizePerf(userPlayback, revision) } : {}),
            },
          };
        })(),
      };
    }

    case "studio_preview_check": {
      const doc = await ready(context, params);
      const loaded = requireModule(context, doc);
      const variant = pickVariant(context, doc, params.variant);
      if (variant !== context.getVariant())
        throw new Error(
          `The preview shows "${context.getVariant()}". Check that variant, or ask the user to switch to "${variant}" first.`,
        );
      if (typeof document !== "undefined" && document.visibilityState !== "visible")
        throw new Error(BACKGROUND_TAB);
      const total = doc.project!.durationInFrames;
      const fps = doc.project!.fps;
      const from = Math.max(0, Math.min(total - 1, Math.round(typeof params.from === "number" ? params.from : 0)));
      let to = Math.max(from, Math.min(total - 1, Math.round(typeof params.to === "number" ? params.to : total - 1)));
      const cap = from + fps * 60 - 1;
      const capped = to > cap;
      if (capped) to = cap;
      const { report, timedOut } = await checkPreview(context, doc, loaded.revision, variant, from, to);
      return {
        project: doc.slug,
        from,
        to,
        ...(capped ? { capped: "Checked the first 60 seconds of the range; check the rest separately." } : {}),
        ...(timedOut ? { timedOut: "Playback didn't reach the end of the range in time; the numbers cover what played." } : {}),
        ...summarizePerf(report, loaded.revision),
      };
    }

    case "studio_open_project": {
      const slug = String(params.project ?? params.slug ?? "");
      if (!slug) throw new Error("project is required.");
      if (!context.getDoc()) await context.openProject(slug);
      else if (context.getDoc()?.slug !== slug) await context.waitForProject(slug);
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
          ? Math.max(0.1, Math.min(2, params.scale))
          : size.width > 1920
            ? 0.5
            : 1;
      const region = captureRegion(params.region, size);
      const { captureFrame, cropToRegion } = await import("@/lib/studio/capture");
      const out = [];
      for (const frame of frames) {
        let blob = await captureFrame({
          doc,
          loaded,
          variant,
          frame,
          scale,
          format: "png",
        });
        if (region) blob = await cropToRegion(blob, region, scale);
        out.push({
          frame,
          seconds: Number((frame / doc.project!.fps).toFixed(3)),
          variant,
          ...(region ? { region } : {}),
          width: Math.round((region?.width ?? size.width) * scale),
          height: Math.round((region?.height ?? size.height) * scale),
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
        })),
        note: "Names and categories only say so much: add 3–6 candidates with studio_add_catalog_music, then rank them by ear with the listen tools.",
      };
    }

    case "studio_sfx_catalog": {
      // Agentcut's own sound effects library (public/sfx), described and measured with earshot.
      // One call should be enough: without filters it returns a compact index of every sound; full
      // details (timing, volume, readings) come back for specific ids or a small filtered set.
      const { SFX_LIBRARY } = await import("@/lib/sfx-library");
      const words = (typeof params.query === "string" ? params.query : "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const category = typeof params.category === "string" ? params.category : "";
      const recordedOnly = params.recordedOnly === true;
      const ids = stringList(params.ids ?? params.id);
      const counts: Record<string, number> = {};
      for (const e of SFX_LIBRARY) counts[e.category] = (counts[e.category] ?? 0) + 1;
      const matches = ids.length
        ? SFX_LIBRARY.filter((e) => ids.includes(e.id))
        : SFX_LIBRARY.filter(
            (e) =>
              (!category || e.category === category) &&
              (!recordedOnly || e.recorded) &&
              (!words.length ||
                words.some((w) =>
                  `${e.id} ${e.category} ${e.description} ${e.useFor} ${e.readings.map((r) => r.sound).join(" ")}`
                    .toLowerCase()
                    .includes(w),
                )),
          );
      // Recordings first: they sound more expensive than synthesized ones when both fit.
      matches.sort((x, y) => Number(y.recorded) - Number(x.recorded));
      const FULL = 40;
      const full = ids.length > 0 || matches.length <= FULL;
      const placement =
        "Place a clip at the cue frame minus onsetS (in frames); for whooshes and risers put peakS on the cut. Start from volume (it evens out loudness), then balance with agentcut_listen_critique.";
      return {
        total: SFX_LIBRARY.length,
        categories: counts,
        matches: matches.length,
        ...(full
          ? { sounds: matches }
          : {
              index: matches.map((e) => ({
                id: e.id,
                category: e.category,
                recorded: e.recorded,
                seconds: e.seconds,
                sound: e.description.length > 90 ? `${e.description.slice(0, 87)}...` : e.description,
              })),
            }),
        note: full
          ? `${placement} Add with agentcut_add_sfx (up to 40 ids at once).`
          : `A compact index of ${matches.length} sounds: pick candidates from it, then call again with ids: [...] (or a narrower query/category) for full details. Prefer recorded: true when one fits. ${placement} Add with agentcut_add_sfx (up to 40 ids at once).`,
      };
    }

    case "studio_add_sfx": {
      const doc = await ready(context, params);
      const ids = stringList(params.ids ?? params.id).slice(0, 40);
      if (ids.length === 0) throw new Error("ids is required (sound ids from studio_sfx_catalog).");
      const { SFX_LIBRARY, sfxUrl } = await import("@/lib/sfx-library");
      const { uploadToProject } = await import("@/lib/studio/export");
      const existing = new Set(
        (
          (await context
            .bridge()
            ?.request<{ assets: { path: string }[] }>("studio.assets.list", { slug: doc.slug })
            .catch(() => null)) ?? { assets: [] }
        ).assets.map((a) => a.path),
      );
      const results = [];
      for (const id of ids) {
        const entry = SFX_LIBRARY.find((e) => e.id === id);
        if (!entry) {
          results.push({ id, error: "No such sound id." });
          continue;
        }
        // Named by id: unique across both sources.
        const target = `assets/sfx/${entry.id}.mp3`;
        const info = { id, path: target, seconds: entry.seconds, onsetS: entry.onsetS, peakS: entry.peakS, volume: entry.volume };
        if (existing.has(target)) {
          results.push({ ...info, note: "already in the project" });
          continue;
        }
        try {
          const response = await fetch(new URL(sfxUrl(entry.file), window.location.href).href);
          if (!response.ok) throw new Error(`Download failed (${response.status}).`);
          const saved = await uploadToProject(doc.slug, target, await response.blob());
          results.push({ ...info, path: saved });
        } catch (error) {
          results.push({ id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return { project: doc.slug, results };
    }

    case "studio_broll_search": {
      // Archival b-roll: public-domain shots searched by meaning in a worker (lib/studio/broll).
      const { BROLL_AVAILABLE, NO_BROLL, brollSummary } = await import("@/lib/broll");
      if (!BROLL_AVAILABLE) throw new Error(NO_BROLL);
      const { searchBroll } = await import("@/lib/studio/broll/search");
      const color = params.color;
      const data = await searchBroll({
        query: typeof params.query === "string" ? params.query : undefined,
        color: color === "black-and-white" || color === "color" || color === "tinted" ? color : undefined,
        backgroundOk: params.backgroundOk === true,
        noPeople: params.noPeople === true,
        calm: params.calm === true,
        minSeconds: typeof params.minSeconds === "number" ? params.minSeconds : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
        offset: typeof params.offset === "number" ? params.offset : undefined,
        // The agent waits for ranking by meaning (the first search downloads the model once).
        wait: true,
      });
      return {
        total: data.total,
        matches: data.matches,
        offset: data.offset,
        shots: data.results.map(brollSummary),
        note: "Descriptions come from a vision model: open the thumb of a shot you're unsure of before using it. Add picks with studio_add_broll.",
      };
    }

    case "studio_add_broll": {
      const doc = await ready(context, params);
      const ids = stringList(params.ids ?? params.id).slice(0, 12);
      if (ids.length === 0) throw new Error("ids is required (shot ids from studio_broll_search).");
      const { BROLL_AVAILABLE, NO_BROLL, brollUrl } = await import("@/lib/broll");
      if (!BROLL_AVAILABLE) throw new Error(NO_BROLL);
      const { uploadToProject } = await import("@/lib/studio/export");
      const existing = new Set(
        (
          (await context
            .bridge()
            ?.request<{ assets: { path: string }[] }>("studio.assets.list", { slug: doc.slug })
            .catch(() => null)) ?? { assets: [] }
        ).assets.map((a) => a.path),
      );
      const { brollShots } = await import("@/lib/studio/broll/search");
      const found = await brollShots(ids);
      const results = [];
      for (const [i, id] of ids.entries()) {
        const shot = found[i];
        if (!shot) {
          results.push({ id, error: "No such shot id." });
          continue;
        }
        // The full-quality cut (a few MB): exports use the same file the preview plays.
        const target = `assets/broll/${shot.id}.mp4`;
        const info = {
          id,
          path: target,
          seconds: shot.seconds,
          size: `${shot.width}x${shot.height}`,
          credit: `${shot.film.title}${shot.film.year ? ` (${shot.film.year})` : ""}, ${shot.film.url}, public domain`,
        };
        if (existing.has(target)) {
          results.push({ ...info, note: "already in the project" });
          continue;
        }
        try {
          const response = await fetch(brollUrl(shot.full));
          if (!response.ok) throw new Error(`Download failed (${response.status}).`);
          const saved = await uploadToProject(doc.slug, target, await response.blob());
          results.push({ ...info, path: saved });
        } catch (error) {
          results.push({ id, error: error instanceof Error ? error.message : String(error) });
        }
      }
      return {
        project: doc.slug,
        results,
        next: "Put each on a video track (fit cover; the shots are silent and mostly 4:3, so frame them for wide and mobile), check with agentcut_capture_frames, and list the credits in notes.md.",
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
