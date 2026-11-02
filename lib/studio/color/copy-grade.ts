// Giving other clips this clip's grade. Pure, so it can be tested without a page.
import { findClip, updateClip } from "../edit";
import type { ColorGrade, StudioLayers, VideoClip } from "../types";

/** A clip's chosen grade: everything except its shot matching, which belongs to that shot alone. */
export function chosenGrade(grade: ColorGrade | undefined): ColorGrade {
  const chosen = { ...(grade ?? {}) };
  delete chosen.match;
  return chosen;
}

const sameGrade = (a: ColorGrade | undefined, b: ColorGrade | undefined) =>
  JSON.stringify(chosenGrade(a)) === JSON.stringify(chosenGrade(b));

/** Visible, unlocked footage: what "all clips" means. A person cutout goes with its footage instead. */
export function gradableClips(layers: StudioLayers): VideoClip[] {
  const clips: VideoClip[] = [];
  for (const track of layers.tracks) {
    if (track.kind !== "video" || track.hidden || track.locked) continue;
    for (const clip of track.clips as VideoClip[]) if (!clip.src.startsWith("assets/cutouts/")) clips.push(clip);
  }
  return clips;
}

/** How many other clips have a grade of their own that copying `anchorId`'s grade would replace. */
export function gradesToReplace(layers: StudioLayers, anchorId: string) {
  const anchor = findClip(layers, anchorId)?.clip as VideoClip | undefined;
  return gradableClips(layers).filter((clip) => {
    if (clip.id === anchorId) return false;
    return Object.keys(chosenGrade(clip.grade)).length > 0 && !sameGrade(clip.grade, anchor?.grade);
  }).length;
}

/**
 * Give `clipIds` the anchor's chosen grade, keeping each one's own shot matching. A person cutout follows
 * its footage, unless it was graded apart from it (subject and background grading), which is left alone.
 */
export function copyGrade(layers: StudioLayers, anchorId: string, clipIds: string[]): StudioLayers {
  const grade = chosenGrade((findClip(layers, anchorId)?.clip as VideoClip | undefined)?.grade);
  let next = layers;
  const write = (id: string, match: ColorGrade["match"]) => {
    const merged: ColorGrade = { ...grade, ...(match ? { match } : {}) };
    next = updateClip(next, id, { grade: Object.keys(merged).length ? merged : undefined } as Partial<VideoClip>);
  };
  for (const id of clipIds) {
    if (id === anchorId) continue;
    const clip = findClip(layers, id)?.clip as VideoClip | undefined;
    if (!clip) continue;
    for (const track of layers.tracks) {
      if (track.kind !== "video") continue;
      for (const cutout of track.clips as VideoClip[]) {
        if (cutout.id.startsWith(`${id}-cutout-`) && sameGrade(cutout.grade, clip.grade)) write(cutout.id, (findClip(next, cutout.id)?.clip as VideoClip).grade?.match);
      }
    }
    write(id, (findClip(next, id)?.clip as VideoClip).grade?.match);
  }
  return next;
}
