// The colour tools the agent and the inspector call. Each one measures through the export's renderer and
// reports before and after, so nothing is claimed that wasn't measured.
import { toast } from "sonner";
import { GRADE_LOOKS, gradeLook } from "@/motion/components/color/looks";
import type { StudioToolContext } from "../agent-tools";
import { captureFrame } from "../capture";
import { findClip, updateClip } from "../edit";
import type { ColorGrade, ImageClip, StudioDoc, StudioLayers, VideoClip } from "../types";
import { analyzePixels, averageStats, colorIssues, roundStats, shotDifference, shotsClash, type FrameStats } from "./analyze";
import { chosenGrade, copyGrade, gradableClips } from "./copy-grade";
import { blobToPixels, captureClipPixels, type FramePixels, type GradeStage } from "./frames";
import { canMatchShot, combineMatches, computeShotMatch, lookCube, lookDistance, lookProfile, lookTransfer } from "./match";

function footageClips(doc: StudioDoc) {
  return gradableClips(doc.layers!);
}

function pickClips(doc: StudioDoc, ids: unknown) {
  const all = footageClips(doc);
  if (Array.isArray(ids) && ids.length) {
    const missing = ids.filter((id) => !all.some((clip) => clip.id === id));
    if (missing.length) throw new Error(`Not footage clips in this project: ${missing.join(", ")}`);
    return all.filter((clip) => ids.includes(clip.id));
  }
  return all;
}

const statsOf = (frames: FramePixels[]) => averageStats(frames.map((frame) => analyzePixels(frame.data)));

function unknownLooks(doc: StudioDoc) {
  const seen = new Set<string>();
  const check = (grade?: ColorGrade) => {
    if (grade?.look && !gradeLook(grade.look)) seen.add(grade.look);
  };
  check(doc.project?.grade);
  for (const track of doc.layers?.tracks ?? [])
    for (const clip of track.clips) check((clip as VideoClip).grade);
  return [...seen];
}

/** Measure frames or shots: exposure, clipping, colour cast, skin, and how the shots differ. */
export async function runColorCheck(params: Record<string, unknown>, doc: StudioDoc, context: StudioToolContext) {
  const loaded = context.getModule();
  if (!loaded) throw new Error("The project bundle isn't ready yet.");
  const variant = context.getVariant();
  const looks = unknownLooks(doc);
  const warnings = looks.length ? [`Unknown look${looks.length > 1 ? "s" : ""} ignored when drawing: ${looks.join(", ")}.`] : [];

  if (Array.isArray(params.frames) && params.frames.length) {
    // Finished frames, graphics included.
    const frames = params.frames.slice(0, 24).map(Number);
    const measured = [];
    for (const frame of frames) {
      const size = doc.project!.variants[variant];
      const pixels = await blobToPixels(await captureFrame({ doc, loaded, variant, frame, scale: Math.min(1, 480 / size.width), format: "png" }));
      const stats = analyzePixels(pixels.data);
      measured.push({ frame, stats: roundStats(stats), issues: colorIssues(stats) });
    }
    return { project: doc.slug, measured: "finished frames, including graphics", frames: measured, warnings };
  }

  const stage: GradeStage = params.stage === "source" || params.stage === "balanced" ? params.stage : "graded";
  const clips = pickClips(doc, params.clipIds);
  if (!clips.length) throw new Error("This project has no footage clips to measure.");
  const shots: { clip: VideoClip; stats: FrameStats }[] = [];
  for (const clip of clips.slice(0, 48)) {
    const frames = await captureClipPixels({ doc, loaded, variant, clip, stage, samples: 3 });
    shots.push({ clip, stats: statsOf(frames) });
  }
  const reference = [...shots].sort((a, b) => b.clip.duration - a.clip.duration)[0];
  return {
    project: doc.slug,
    measured: `each clip alone, ${stage === "graded" ? "with its full grade" : stage === "balanced" ? "with shot matching only" : "as recorded"}`,
    comparedTo: reference.clip.id,
    shots: shots.map(({ clip, stats }) => {
      const difference = shotDifference(stats, reference.stats);
      return {
        clipId: clip.id,
        name: clip.name ?? clip.src,
        from: clip.from,
        stats: roundStats(stats),
        issues: colorIssues(stats),
        differenceFromReference: {
          exposureStops: Number(difference.exposure.toFixed(2)),
          color: Number(difference.color.toFixed(3)),
          saturation: Number(difference.saturation.toFixed(2)),
          contrast: Number(difference.contrast.toFixed(2)),
          noticeable: clip.id !== reference.clip.id && shotsClash(difference),
        },
      };
    }),
    warnings,
    next: "Issues are conventions, not rules: weigh them against the intent. Fix a shot with its grade, or run agentcut_match_shots when shots differ noticeably, and check again.",
  };
}

function setGrade(layers: StudioLayers, clipId: string, change: (grade: ColorGrade) => ColorGrade) {
  const location = findClip(layers, clipId);
  if (!location) return layers;
  const next = change((location.clip as VideoClip).grade ?? {});
  return updateClip(layers, clipId, { grade: Object.keys(next).length ? next : undefined } as Partial<VideoClip>);
}

/** Change a footage clip and any person cutouts of it, so the person never drifts from their background. */
function setShotGrade(layers: StudioLayers, clipId: string, change: (grade: ColorGrade) => ColorGrade) {
  let next = setGrade(layers, clipId, change);
  for (const track of layers.tracks) {
    if (track.kind !== "video") continue;
    for (const clip of track.clips)
      if (clip.id.startsWith(`${clipId}-cutout-`)) next = setGrade(next, clip.id, change);
  }
  return next;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Make shots match. `balance` evens out exposure and white balance (pieces of one take get the same
 * correction); `copyGrade` gives them all the anchor's look and settings.
 */
export async function runMatchShots(params: Record<string, unknown>, doc: StudioDoc, context: StudioToolContext) {
  const toastId = `match-${doc.slug}`;
  try {
    return await matchShots(params, doc, context, (text) => toast.loading(text, { id: toastId, duration: Infinity }));
  } finally {
    toast.dismiss(toastId);
  }
}

async function matchShots(params: Record<string, unknown>, doc: StudioDoc, context: StudioToolContext, progress: (text: string) => void) {
  const loaded = context.getModule();
  if (!loaded) throw new Error("The project bundle isn't ready yet.");
  const variant = context.getVariant();
  const clips = pickClips(doc, params.clipIds);
  const balance = params.balance !== false;
  const copying = params.copyGrade === true;
  if (clips.length < 2) return { status: "skipped", project: doc.slug, reason: "This needs at least two footage clips on visible, unlocked tracks." };
  const strength = typeof params.strength === "number" ? Math.max(0, Math.min(1, params.strength)) : 1;
  const anchorClip =
    (typeof params.anchorClipId === "string" ? clips.find((clip) => clip.id === params.anchorClipId) : null) ??
    [...clips].sort((a, b) => b.duration - a.duration)[0];
  if (typeof params.anchorClipId === "string" && anchorClip.id !== params.anchorClipId)
    throw new Error(`Anchor clip not found: ${params.anchorClipId}`);

  const hasGrade = Object.keys(chosenGrade(anchorClip.grade)).length > 0;
  if (!balance) {
    if (!hasGrade) return { status: "skipped", project: doc.slug, reason: `"${anchorClip.name ?? anchorClip.id}" has no grade to copy yet.` };
    const copied = clips.filter((clip) => clip.id !== anchorClip.id);
    await context.applyToolLayers(copyGrade(doc.layers!, anchorClip.id, copied.map((clip) => clip.id)), doc);
    return {
      status: "applied",
      project: doc.slug,
      anchor: anchorClip.id,
      copiedTo: copied.map((clip) => clip.id),
      summary: `Gave ${plural(copied.length, "clip")} this clip's grade.`,
      undo: "Use Undo.",
    };
  }

  const groups = new Map<string, VideoClip[]>();
  for (const clip of clips) groups.set(clip.src, [...(groups.get(clip.src) ?? []), clip]);

  const measureGroup = async (members: VideoClip[], working: StudioDoc, stage: GradeStage) => {
    const stats: FrameStats[] = [];
    for (const clip of members.slice(0, 3)) {
      const latest = (findClip(working.layers!, clip.id)?.clip as VideoClip) ?? clip;
      stats.push(statsOf(await captureClipPixels({ doc: working, loaded, variant, clip: latest, stage, samples: 2 })));
    }
    return averageStats(stats);
  };

  let done = 0;
  const report = () => progress(`Matching shots: ${done} of ${groups.size - 1}`);
  report();
  const anchorMembers = groups.get(anchorClip.src)!;
  const anchorStats = await measureGroup(anchorMembers, doc, "source");
  if (!canMatchShot(anchorStats))
    return { status: "skipped", project: doc.slug, reason: `The anchor "${anchorClip.name ?? anchorClip.id}" is too dark to match other shots to. Pick another clip.` };
  const skipped: string[] = [];
  let layers = doc.layers!;
  const results = [];
  for (const [src, members] of groups) {
    if (src === anchorClip.src) {
      for (const clip of members)
        layers = setShotGrade(layers, clip.id, (grade) => {
          const rest = { ...grade };
          delete rest.match;
          return rest;
        });
      continue;
    }
    const before = await measureGroup(members, doc, "source");
    done += 1;
    report();
    if (!canMatchShot(before)) {
      skipped.push(...members.map((clip) => clip.id));
      continue;
    }
    let match = computeShotMatch(before, anchorStats, { strength, anchorId: anchorClip.id });
    const withMatch = (candidate: typeof match, base: StudioLayers) => {
      let next = base;
      for (const clip of members) next = setShotGrade(next, clip.id, (grade) => ({ ...grade, match: candidate }));
      return next;
    };
    // One refining step: measure what the correction really did, and correct the remainder.
    const firstDoc = { ...doc, layers: withMatch(match, layers) };
    const measured = await measureGroup(members, firstDoc, "balanced");
    if (strength === 1) {
      match = combineMatches(match, computeShotMatch(measured, anchorStats, { strength: 0.7, anchorId: anchorClip.id }));
    }
    layers = withMatch(match, layers);
    const after = await measureGroup(members, { ...doc, layers }, "balanced");
    const was = shotDifference(before, anchorStats);
    const now = shotDifference(after, anchorStats);
    results.push({
      source: src,
      clipIds: members.map((clip) => clip.id),
      match,
      before: { exposureStops: Number(was.exposure.toFixed(2)), color: Number(was.color.toFixed(3)) },
      after: { exposureStops: Number(now.exposure.toFixed(2)), color: Number(now.color.toFixed(3)) },
    });
  }
  const copied = copying && hasGrade ? clips.filter((clip) => clip.id !== anchorClip.id).map((clip) => clip.id) : [];
  if (copied.length) layers = copyGrade(layers, anchorClip.id, copied);
  await context.applyToolLayers(layers, doc);
  const matched = results.reduce((sum, shot) => sum + shot.clipIds.length, 0);
  return {
    status: "applied",
    project: doc.slug,
    anchor: anchorClip.id,
    summary: [
      copied.length ? `Gave ${plural(copied.length, "clip")} this clip's grade` : null,
      `evened out ${plural(matched, "shot")}`,
      skipped.length ? `skipped ${plural(skipped.length, "very dark shot")} for evening out` : null,
    ].filter(Boolean).join(", ").replace(/^./, (c) => c.toUpperCase()) + ".",
    ...(copied.length ? { copiedTo: copied } : {}),
    shots: results,
    ...(skipped.length ? { skipped, skippedReason: "Almost black in the frames measured, so left alone." } : {}),
    note: "Corrections are stored as grade.match, below any look or other grade. Run again to re-match; clearing grade.match removes one.",
    next: "Check with agentcut_capture_frames across a cut, then put a look over the whole video.",
    undo: "Use Undo.",
  };
}

async function referenceFrames(path: string, doc: StudioDoc, context: StudioToolContext): Promise<FramePixels[]> {
  const loaded = context.getModule()!;
  const variant = context.getVariant();
  if (/\.(mp4|m4v|webm|mov)$/i.test(path)) {
    const fps = doc.project!.fps;
    const { mediaInfo } = await import("../audio/media-info");
    const { studioFileUrl } = await import("../file-url");
    const info = (await mediaInfo(studioFileUrl(doc.slug, path), path, fps)) as { frames?: number };
    const length = Math.max(1, info.frames ?? fps);
    const clip = { id: "reference", src: path, from: 0, duration: length } as VideoClip;
    const probeDoc = { ...doc, project: { ...doc.project!, durationInFrames: length } };
    const at = Array.from({ length: 8 }, (_, i) => Math.floor(((i + 0.5) / 8) * length));
    return captureClipPixels({ doc: probeDoc, loaded, variant, clip, stage: "source", at });
  }
  if (/\.(png|jpe?g|webp|avif)$/i.test(path)) {
    const clip = { id: "reference", src: path, from: 0, duration: 1 } as ImageClip;
    return captureClipPixels({ doc, loaded, variant, clip, kind: "image", stage: "source", at: [0], width: 640 });
  }
  throw new Error("The reference must be an image or video in the project's assets/ folder.");
}

/** Build a .cube that moves the footage towards a reference image or video, and apply it. */
export async function runMatchLook(params: Record<string, unknown>, doc: StudioDoc, context: StudioToolContext) {
  const loaded = context.getModule();
  if (!loaded) throw new Error("The project bundle isn't ready yet.");
  const reference = typeof params.reference === "string" ? params.reference : "";
  if (!/^assets\//.test(reference) || /(^|\/)\.\.(\/|$)/.test(reference))
    throw new Error("reference must be a project file under assets/ (use agentcut_import_reference for links).");
  const variant = context.getVariant();
  const clips = pickClips(doc, params.clipIds);
  if (!clips.length) throw new Error("This project has no footage clips to grade.");
  const strength = typeof params.strength === "number" ? Math.max(0, Math.min(1, params.strength)) : 0.85;

  const target = lookProfile((await referenceFrames(reference, doc, context)).map((frame) => frame.data));
  if (!target.pixels) throw new Error("The reference had no visible pixels.");
  const sourceFrames: Uint8ClampedArray[] = [];
  for (const clip of clips.slice(0, 16)) {
    const frames = await captureClipPixels({ doc, loaded, variant, clip, stage: "balanced", samples: clips.length > 6 ? 1 : 2 });
    sourceFrames.push(...frames.map((frame) => frame.data));
  }
  const source = lookProfile(sourceFrames);
  const name = (reference.split("/").pop() ?? "reference").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40);
  const cube = lookCube(lookTransfer(source, target), `Match ${name}`);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cube));
  const hash = Array.from(new Uint8Array(digest).slice(0, 4), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `assets/looks/${name}-${hash}.cube`;
  const { uploadToProject } = await import("../export");
  const saved = await uploadToProject(doc.slug, path, new Blob([cube], { type: "text/plain" }));

  let layers = doc.layers!;
  for (const clip of clips) {
    layers = setShotGrade(layers, clip.id, (grade) => ({
      ...grade,
      lut: saved,
      lutStrength: strength,
      // Skin survives a strong look; a higher setting on the clip stays.
      skinProtect: grade.skinProtect ?? 0.5,
    }));
  }
  await context.applyToolLayers(layers, doc);

  const current = context.getDoc() ?? doc;
  const afterFrames: Uint8ClampedArray[] = [];
  for (const clip of clips.slice(0, 16)) {
    const latest = (findClip(current.layers!, clip.id)?.clip as VideoClip) ?? clip;
    const frames = await captureClipPixels({ doc: current, loaded, variant, clip: latest, stage: "graded", samples: clips.length > 6 ? 1 : 2 });
    afterFrames.push(...frames.map((frame) => frame.data));
  }
  const after = lookProfile(afterFrames);
  return {
    status: "applied",
    project: doc.slug,
    file: saved,
    clipIds: clips.map((clip) => clip.id),
    strength,
    distanceFromReference: { before: lookDistance(source, target), after: lookDistance(after, target) },
    note: "Lower is closer. The reference's colour and tone are matched; what's in the picture can't be, so check skin and text.",
    next: "Look at captures with agentcut_capture_frames. Adjust grade.lutStrength to taste (0.5–0.9 is typical).",
    undo: "Use Undo. The .cube file stays in assets/looks/.",
  };
}

export const SUBJECT_PRESETS: Record<string, { subject: ColorGrade; background: ColorGrade; label: string }> = {
  pop: {
    label: "Subject pop",
    subject: { exposure: 0.15, vibrance: 0.1 },
    background: { exposure: -0.55, saturation: 0.72 },
  },
  "mono-background": {
    label: "Colour on black and white",
    subject: { vibrance: 0.15 },
    background: { saturation: 0, contrast: 1.1 },
  },
  "soft-background": {
    label: "Quiet background",
    subject: { exposure: 0.08 },
    background: { saturation: 0.82, contrast: 0.88, shadows: 0.1, highlights: -0.15 },
  },
  "night-background": {
    label: "Night behind them",
    subject: { exposure: 0.1 },
    background: { look: "day-for-night" },
  },
};

const merged = (base: ColorGrade | undefined, over: ColorGrade): ColorGrade => ({ ...(base ?? {}), ...over });

/** Grade a person and what's behind them separately, using the person cutout. */
export async function runGradeSubject(params: Record<string, unknown>, doc: StudioDoc, context: StudioToolContext, cutout: (params: Record<string, unknown>) => Promise<Record<string, unknown>>) {
  const preset = typeof params.preset === "string" ? SUBJECT_PRESETS[params.preset] : undefined;
  if (typeof params.preset === "string" && !preset)
    throw new Error(`Unknown preset. Presets: ${Object.keys(SUBJECT_PRESETS).join(", ")}.`);
  const subject = (params.subject as ColorGrade | undefined) ?? preset?.subject;
  const background = (params.background as ColorGrade | undefined) ?? preset?.background;
  if (!subject && !background) throw new Error("Pass subject, background or a preset.");
  const cut = await cutout({ project: params.project, clipId: params.clipId, fromFrame: params.fromFrame, durationInFrames: params.durationInFrames, behind: params.behind });
  if (cut.status !== "applied") return cut;
  const current = context.getDoc();
  if (!current?.layers) throw new Error("The project closed while cutting out the person.");
  const cutoutId = String(cut.clipId);
  const sourceId = typeof params.clipId === "string" ? params.clipId : cutoutId.split("-cutout-")[0];
  let layers = current.layers;
  if (subject) layers = setGrade(layers, cutoutId, (grade) => merged(grade, subject));
  if (background) layers = setGrade(layers, sourceId, (grade) => merged(grade, background));
  await context.applyToolLayers(layers, current);
  return {
    ...cut,
    background: sourceId,
    subject: cutoutId,
    note: "The person is its own clip above the footage. Their grades are independent now: the subject's lives on the cutout, the background's on the footage.",
    next: "Check with agentcut_capture_frames, especially hair and edges against the darker background.",
  };
}

export function colorLookCatalog() {
  return {
    looks: GRADE_LOOKS.map(({ id, name, group, description }) => ({ id, name, group, description })),
    subjectPresets: Object.fromEntries(Object.entries(SUBJECT_PRESETS).map(([id, preset]) => [id, preset.label])),
    usage: 'Set "look": "<id>" and optionally "lookStrength": 0…1 in a grade, on a clip, an adjustment clip or project.json. Corrections in the same grade draw first; the look goes on top.',
  };
}
