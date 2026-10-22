import type { TimelineClip } from "@/types/editor";

export interface SourceScopedTimelineItem {
  sourceClipId?: string;
  sourceAssetId?: string;
}

function getLiveTimelineClips(clips: TimelineClip[]): TimelineClip[] {
  return clips.filter((clip) => !clip.deleted);
}

/**
 * Source ownership is explicit. Legacy timeline items without either id are
 * retained so older projects can still be migrated from their timing data.
 */
export function isOrphanedSourceScopedItem(
  item: SourceScopedTimelineItem,
  clips: TimelineClip[],
): boolean {
  const liveClips = getLiveTimelineClips(clips);

  // A clip id identifies the authored clip instance and is authoritative.
  // Its asset id may legitimately change while a persisted clip is remapped
  // to a freshly loaded asset, so that mismatch is normalized by the caller.
  if (item.sourceClipId) {
    return !liveClips.some((clip) => clip.id === item.sourceClipId);
  }

  if (item.sourceAssetId) {
    return !liveClips.some((clip) => clip.assetId === item.sourceAssetId);
  }

  return false;
}

export function pruneOrphanedSourceScopedItems<
  T extends SourceScopedTimelineItem,
>(items: T[], clips: TimelineClip[]): T[] {
  const retained = items.filter(
    (item) => !isOrphanedSourceScopedItem(item, clips),
  );
  return retained.length === items.length ? items : retained;
}
