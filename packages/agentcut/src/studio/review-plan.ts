import type { StudioLayers, StudioProject } from "./schema.js";

export type ReviewScope = "shot" | "shared" | "timing";

/** Make explicit calls for existing review tools. This function never renders or changes a project. */
export function reviewPlan(project: StudioProject, layers: StudioLayers, slug: string, scope: ReviewScope, clipIds: string[]) {
  const allClips = layers.tracks.flatMap((track) => track.clips);
  if (scope === "shot" && !clipIds.length) throw new Error("Provide changed clipIds for shot review, or choose shared/timing for a broad review.");
  const known = new Set(allClips.map((clip) => clip.id));
  const missing = clipIds.filter((id) => !known.has(id));
  if (scope === "shot" && missing.length) throw new Error(`Unknown changed clip IDs: ${missing.join(", ")}. For removed or moved clips use scope=timing to include old boundaries.`);
  const total = project.durationInFrames;
  const variants = Object.keys(project.variants);
  const selected = allClips.filter((clip) => clipIds.includes(clip.id));
  const plans = variants.map((variant) => {
    const ranges = scope === "shot" ? selected.map((clip) => {
      const resolved = { ...clip, ...clip.variants?.[variant] };
      return { clipId: clip.id, from: Math.max(0, resolved.from - 1), to: Math.min(total - 1, resolved.from + resolved.duration) };
    }).filter((range) => range.from <= range.to) : [{ clipId: "whole-project", from: 0, to: total - 1 }];
    const frames = [...new Set(ranges.flatMap(({ from, to }) => {
      if (scope !== "shot") return Array.from({ length: Math.min(16, total) }, (_, i) => Math.round(i * (total - 1) / Math.max(1, Math.min(16, total) - 1)));
      const edge = Math.min(6, Math.floor((to - from) / 4));
      return [from, Math.min(to, from + 1), from + edge, Math.round((from + to) / 2), to - edge, Math.max(from, to - 1), to];
    }))].sort((a, b) => a - b);
    return { variant, ranges, frames,
      calls: Array.from({ length: Math.ceil(frames.length / 24) }, (_, index) => ({
        tool: "agentcut_capture_frames", args: { project: slug, variant, frames: frames.slice(index * 24, index * 24 + 24) },
      })),
      previewRanges: ranges.flatMap(({ from, to }) => {
        const maxFrames = Math.max(1, Math.floor(project.fps * 60));
        return Array.from({ length: Math.ceil((to - from + 1) / maxFrames) }, (_, index) => ({
          tool: "agentcut_preview_check", args: { project: slug, variant, from: from + index * maxFrames, to: Math.min(to, from + (index + 1) * maxFrames - 1) },
        }));
      }),
    };
  });
  return {
    scope, project: slug, intermediate: plans,
    reason: scope === "shot" ? "Full-frame samples of changed shots and their neighboring boundaries in every variant." : "Shared or timing changes require a whole-project visual review in every variant.",
    finalReviewRequired: true,
    finalCalls: variants.flatMap((variant) => [
      { tool: "agentcut_contact_sheet", args: { project: slug, variant, from: 0, to: total - 1 } },
      { tool: "agentcut_listen_critique", args: { project: slug, variant } },
    ]),
    notes: [
      "This is a plan, not a passed check. Run page-heavy calls in sequence and inspect the returned frames and audio findings.",
      "For shot edits, add probes at exact cue frames and inside any entrance/exit not covered by the suggested samples. Test heavy changed scenes with previewRanges.",
      "A shared scene/component/asset/font/style change must use shared unless every affected clip is known. Timing, trim, duration or soundtrack changes must use timing. If impact is uncertain, broaden the review.",
      "Re-read layers and regenerate after timeline edits. Keep final full-picture, sound, caption, action/result and playback checks. Export only when requested.",
    ],
  };
}
