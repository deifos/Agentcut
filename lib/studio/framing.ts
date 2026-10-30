import type { Box, FramingKeyframe, StudioLayers, VideoClip } from "./types";

/** All coordinates refer to the upright, displayed source image, not the output canvas. */
export interface FaceBox extends Box {
  score: number;
}
export interface FaceSample {
  seconds: number;
  faces: FaceBox[];
  sceneChange?: boolean;
}
export type FramingResult =
  | {
      status: "ready";
      crop: Box;
      coverage: number;
      samples: number;
      boundsLimited: boolean;
    }
  | {
      status:
        | "no_face"
        | "multiple_faces"
        | "low_confidence"
        | "unstable"
        | "cannot_fit";
      next: string;
      samples: number;
    };

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const median = (ns: number[]) =>
  [...ns].sort((a, b) => a - b)[Math.floor(ns.length / 2)];

/** One crop for the entire source range. Never chooses the largest of several faces. */
export function stableFaceCrop(
  samples: FaceSample[],
  source: { width: number; height: number },
  targetAspect: number,
): FramingResult {
  const fail = (
    status: Exclude<FramingResult["status"], "ready">,
    next: string,
  ): FramingResult => ({ status, next, samples: samples.length });
  if (
    !samples.length ||
    !Number.isFinite(targetAspect) ||
    targetAspect <= 0 ||
    source.width <= 0 ||
    source.height <= 0
  )
    return fail(
      "no_face",
      "Provide a readable video clip with a visible face.",
    );
  const credible = samples.map((s) =>
    s.faces.filter(
      (f) =>
        f.score >= 0.5 &&
        [f.x, f.y, f.width, f.height, f.score].every(Number.isFinite) &&
        f.width > 0 &&
        f.height > 0,
    ),
  );
  if (credible.some((faces) => faces.length > 1))
    return fail(
      "multiple_faces",
      "More than one face is visible. Ask which person to frame and split or select a range that shows only that person; this version cannot choose an identity.",
    );
  const faces = credible.flat().filter((f) => f.score >= 0.7);
  if (!credible.flat().length)
    return fail(
      "no_face",
      "No face was found. Select a clearer, closer talking-head range or use a manual crop. No framing was changed.",
    );
  if (faces.length < Math.max(3, Math.ceil(samples.length * 0.65)))
    return fail(
      "low_confidence",
      "A clear face was not present in enough samples. Select a shorter range with one visible face, then retry.",
    );
  const width = Math.min(1, targetAspect / (source.width / source.height));
  const height = Math.min(1, source.width / source.height / targetAspect);
  const cx = median(faces.map((f) => f.x + f.width / 2));
  // A face at 38% of the crop height leaves space for hair and shoulders.
  const cy = median(faces.map((f) => f.y + f.height / 2));
  const x = clamp(cx - width / 2, 0, 1 - width);
  const y = clamp(cy - height * 0.38, 0, 1 - height);
  let minX = Math.max(0, Math.min(...faces.map((f) => f.x - f.width * 0.12)));
  let maxX = Math.min(1, Math.max(...faces.map((f) => f.x + f.width * 1.12)));
  const tight = maxX - minX > width;
  if (tight) {
    minX = Math.max(0, Math.min(...faces.map((f) => f.x)));
    maxX = Math.min(1, Math.max(...faces.map((f) => f.x + f.width)));
  }
  const minY = Math.max(
    0,
    Math.min(...faces.map((f) => f.y - f.height * 0.35)),
  );
  const maxY = Math.min(
    1,
    Math.max(...faces.map((f) => f.y + f.height * 1.18)),
  );
  if (maxX - minX > width || maxY - minY > height)
    return fail(
      "cannot_fit",
      "One stable crop cannot keep the face and headroom in view. Use a wider format or split the moving shot into shorter clips.",
    );
  const finalX = clamp(
    x,
    Math.max(0, maxX - width),
    Math.min(1 - width, Math.max(0, minX)),
  );
  const finalY = clamp(
    y,
    Math.max(0, maxY - height),
    Math.min(1 - height, Math.max(0, minY)),
  );
  if (
    faces.some(
      (f) =>
        Math.abs(f.x + f.width / 2 - cx) > width * 0.22 ||
        Math.abs(f.y + f.height / 2 - cy) > height * 0.22,
    )
  )
    return fail(
      "unstable",
      "The face moves too far for a fixed crop, or the shot changes. Use follow mode for a moving speaker, or split the shot and frame each section.",
    );
  return {
    status: "ready",
    crop: { x: finalX, y: finalY, width, height },
    coverage: faces.length / samples.length,
    samples: samples.length,
    boundsLimited:
      tight ||
      Math.abs(finalX + width / 2 - cx) > 0.03 ||
      Math.abs(finalY + height * 0.38 - cy) > 0.03,
  };
}

/** Exact source-time samples, respecting source trim and playback speed. */
export function framingSampleTimes(clip: VideoClip, fps: number) {
  const start = (clip.trimStart ?? 0) / fps;
  const seconds = (clip.duration / fps) * (clip.playbackRate ?? 1);
  return Array.from(
    { length: 9 },
    (_, i) => start + seconds * (0.02 + i * 0.12),
  );
}

/** Inspect the entire displayed range at 2 Hz, including the first and final source frame. */
export function followSampleTimes(clip: VideoClip, fps: number) {
  const start = (clip.trimStart ?? 0) / fps;
  const span = Math.max(
    0,
    ((clip.duration - 1) / fps) * (clip.playbackRate ?? 1),
  );
  const count = Math.max(2, Math.ceil(span / 0.5) + 1);
  if (count > 1201) return null;
  return span === 0
    ? [start]
    : Array.from({ length: count }, (_, i) => start + (span * i) / (count - 1));
}

export type FollowResult =
  | {
      status: "ready";
      crop: Box;
      path: FramingKeyframe[];
      samples: number;
      coverage: number;
      heldSamples: number;
      boundsLimited: boolean;
    }
  | {
      status:
        | "no_face"
        | "multiple_faces"
        | "low_confidence"
        | "long_loss"
        | "subject_change"
        | "scene_change"
        | "cannot_fit"
        | "motion_too_fast";
      next: string;
      samples: number;
    };

/** Conservative single-subject association, with local smoothing and a short loss hold. */
export function followFaceCrop(
  samples: FaceSample[],
  source: { width: number; height: number },
  targetAspect: number,
): FollowResult {
  const fail = (
    status: Exclude<FollowResult["status"], "ready">,
    next: string,
  ): FollowResult => ({ status, next, samples: samples.length });
  if (!samples.length)
    return fail("no_face", "Use a clip with one visible face.");
  const reliable: (FaceBox | null)[] = [];
  let previous: { face: FaceBox; seconds: number } | undefined;
  let firstReliable = -1;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (
      !Number.isFinite(sample.seconds) ||
      (i > 0 && sample.seconds <= samples[i - 1].seconds)
    )
      return fail(
        "subject_change",
        "Source sample times are invalid. Correct the clip range and retry.",
      );
    if (sample.sceneChange)
      return fail(
        "scene_change",
        "A large picture change suggests a scene cut. Split the source into shots and follow each shot separately.",
      );
    const faces = sample.faces.filter(
      (f) =>
        f.score >= 0.5 &&
        [f.x, f.y, f.width, f.height].every(Number.isFinite) &&
        f.width > 0 &&
        f.height > 0,
    );
    if (faces.length > 1)
      return fail(
        "multiple_faces",
        "More than one face is visible. Select a shot with only the intended person; the tool will not switch identities.",
      );
    const face = faces[0]?.score >= 0.7 ? faces[0] : null;
    reliable.push(face);
    if (!face) {
      if (previous && sample.seconds - previous.seconds > 1.5)
        return fail(
          "long_loss",
          "The face is lost for more than 1.5 seconds. Split or trim this section, or use an explicit static crop.",
        );
      continue;
    }
    if (firstReliable < 0) {
      firstReliable = i;
      if (sample.seconds - samples[0].seconds > 1.5)
        return fail(
          "long_loss",
          "The opening has no reliable face for more than 1.5 seconds. Trim or split the opening before following.",
        );
    }
    if (previous) {
      const dt = sample.seconds - previous.seconds;
      if (dt > 2)
        return fail(
          "long_loss",
          "The face is missing too long to retain the subject safely. Split the shot and retry.",
        );
      const old = previous.face;
      const distance = Math.hypot(
        face.x + face.width / 2 - old.x - old.width / 2,
        face.y + face.height / 2 - old.y - old.height / 2,
      );
      const ratio = face.width / old.width;
      if (
        distance >
          Math.max(0.12, Math.min(old.width, face.width) * 0.8) +
            Math.max(0, dt - 0.5) * 0.1 ||
        ratio < 0.55 ||
        ratio > 1.8
      )
        return fail(
          "subject_change",
          "The face position or size changes abruptly. This may be a scene cut or a different person. Split the shot rather than switching subjects.",
        );
    }
    previous = { face, seconds: sample.seconds };
  }
  const count = reliable.filter(Boolean).length;
  if (!count)
    return fail(
      "no_face",
      "No reliable face was found. Use clearer talking-head footage or a manual crop.",
    );
  if (count < Math.min(3, samples.length) || count / samples.length < 0.65)
    return fail(
      "low_confidence",
      "Too few samples show a clear face. Use a clearer or shorter shot; no path was applied.",
    );
  const path: FramingKeyframe[] = [];
  let lastFace = reliable[firstReliable]!;
  let boundsLimited = false;
  let heldSamples = 0;
  for (let i = 0; i < samples.length; i++) {
    const face = reliable[i];
    if (face) lastFace = face;
    else heldSamples++;
    const target = stableFaceCrop(
      [
        { seconds: 0, faces: [lastFace] },
        { seconds: 1, faces: [lastFace] },
        { seconds: 2, faces: [lastFace] },
      ],
      source,
      targetAspect,
    );
    if (target.status !== "ready")
      return fail(
        "cannot_fit",
        "The face and headroom cannot fit this output box. Use a wider format or adjust the clip box.",
      );
    boundsLimited ||= target.boundsLimited;
    let crop = target.crop;
    const prior = path.at(-1);
    if (prior) {
      const dt = samples[i].seconds - prior.seconds;
      if (!face) crop = prior.crop;
      else {
        const axis = (old: number, next: number, span: number) => {
          const delta = next - old;
          const dead = span * 0.045;
          const desired =
            Math.abs(delta) <= dead ? old : next - Math.sign(delta) * dead;
          const move = (desired - old) * (1 - Math.exp(-dt / 0.3));
          return old + clamp(move, -0.45 * dt, 0.45 * dt);
        };
        const { width, height } = crop;
        const x = clamp(
          axis(prior.crop.x, crop.x, width),
          Math.max(0, lastFace.x + lastFace.width - width),
          Math.min(1 - width, lastFace.x),
        );
        const y = clamp(
          axis(prior.crop.y, crop.y, height),
          Math.max(0, lastFace.y + lastFace.height - height),
          Math.min(1 - height, lastFace.y),
        );
        if (Math.hypot(x - prior.crop.x, y - prior.crop.y) / dt > 0.55)
          return fail(
            "motion_too_fast",
            "Following would require a fast crop jump. Split the movement into shorter shots or use a wider frame.",
          );
        crop = { x, y, width, height };
      }
    }
    path.push({ seconds: samples[i].seconds, crop });
  }
  return {
    status: "ready",
    crop: path[0].crop,
    path,
    samples: samples.length,
    coverage: count / samples.length,
    heldSamples,
    boundsLimited,
  };
}

/** Only the requested variant changes. Reset removes our crop, never another edit. */
export function updateFraming(
  layers: StudioLayers,
  variant: string,
  crops: Map<string, Box> | null,
  ids: string[],
  paths?: Map<string, FramingKeyframe[]>,
): StudioLayers {
  return {
    ...layers,
    tracks: layers.tracks.map((track) =>
      track.kind !== "video"
        ? track
        : {
            ...track,
            clips: (track.clips as VideoClip[]).map((clip) => {
              if (!ids.includes(clip.id)) return clip;
              const overrides: Partial<Omit<VideoClip, "id">> = {
                ...clip.variants?.[variant],
              };
              if (crops) {
                const previous = overrides.framing;
                const beforePath =
                  previous && "before" in previous
                    ? previous.beforePath
                    : previous?.path;
                overrides.framing = {
                  crop: crops.get(clip.id)!,
                  ...(paths?.has(clip.id) ? { path: paths.get(clip.id)! } : {}),
                  ...(beforePath ? { beforePath } : {}),
                  before: previous
                    ? "before" in previous
                      ? previous.before
                      : previous.crop
                    : null,
                };
              } else {
                if (!overrides.framing || !("before" in overrides.framing))
                  return clip;
                if (overrides.framing.before)
                  overrides.framing = {
                    crop: overrides.framing.before,
                    ...(overrides.framing.beforePath
                      ? { path: overrides.framing.beforePath }
                      : {}),
                  };
                else delete overrides.framing;
              }
              const variants: NonNullable<VideoClip["variants"]> = {
                ...clip.variants,
                [variant]: overrides,
              };
              if (!Object.keys(overrides).length) delete variants[variant];
              const result: VideoClip = { ...clip, variants };
              if (!Object.keys(variants).length) delete result.variants;
              return result;
            }),
          },
    ),
  };
}
