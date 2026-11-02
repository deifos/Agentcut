// Asks the helper for fast-seeking copies of the footage on the timeline (packages/agentcut/src/studio/
// proxies.ts) and hands them to the preview's Player as they become ready. A helper without them answers
// 404 and the preview keeps using the originals.
import { useEffect, useMemo, useState } from "react";
import { STUDIO_BRIDGE_ORIGIN } from "@/lib/studio/origin";
import type { AssetEntry, StudioLayers } from "@/lib/studio/types";

const POLL_MS = 4000;
const NO_PROXIES: Record<string, string> = {};

/** Project files the timeline plays as footage. */
export function footagePaths(layers: StudioLayers | null) {
  const paths = new Set<string>();
  for (const track of layers?.tracks ?? []) {
    if (track.kind !== "video" || track.hidden) continue;
    for (const clip of track.clips as { src?: string }[]) {
      if (clip.src && !/^(https?:|data:|blob:|library:)/i.test(clip.src)) paths.add(clip.src);
    }
  }
  return [...paths].sort();
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export function proxySourcesKey(layers: StudioLayers | null, assets: AssetEntry[]) {
  const byPath = new Map(assets.map((asset) => [asset.path, asset]));
  return JSON.stringify(footagePaths(layers).map((path) => {
    const asset = byPath.get(path);
    return [path, asset?.size ?? null, asset?.updatedAt ?? null];
  }));
}

export function usePreviewProxies(slug: string | null, layers: StudioLayers | null, playing: boolean, assets: AssetEntry[]) {
  const sourcesKey = proxySourcesKey(layers, assets);
  const requestKey = `${slug}|${sourcesKey}`;
  const [found, setFound] = useState<{ key: string | null; urls: Record<string, string> }>({ key: null, urls: {} });
  /** Which timeline has had its first answers, so film strips don't start decoding an original needlessly. */
  const [answered, setAnswered] = useState<string | null>(null);

  useEffect(() => {
    const paths = (JSON.parse(sourcesKey) as [string, number | null, number | null][]).map(([path]) => path);
    if (!slug || !paths.length) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const waiting = new Set(paths);
    const poll = async () => {
      await Promise.all(
        [...waiting].map(async (path) => {
          const response = await fetch(`${STUDIO_BRIDGE_ORIGIN}/studio/proxy/${slug}/${encodePath(path)}`).catch(() => null);
          const answer = response?.ok ? ((await response.json().catch(() => null)) as { state?: string; file?: string } | null) : null;
          if (answer?.state === "working") return;
          waiting.delete(path);
          if (stopped || answer?.state !== "ready" || !answer.file) return;
          const url = `${STUDIO_BRIDGE_ORIGIN}/studio/proxy-file/${answer.file}`;
          setFound((current) => ({
            key: requestKey,
            urls: { ...(current.key === requestKey ? current.urls : {}), [path]: url },
          }));
        }),
      );
      if (stopped) return;
      setAnswered(requestKey);
      if (waiting.size) timer = setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [slug, sourcesKey, requestKey]);

  // Changing a clip's file reloads its decoder, so a copy that lands during playback waits for a pause.
  const [applied, setApplied] = useState<Record<string, string>>(NO_PROXIES);
  const ready = found.key === requestKey ? found.urls : NO_PROXIES;
  if (!playing && applied !== ready) setApplied(ready);
  const player = useMemo(() => (Object.keys(applied).length ? applied : undefined), [applied]);
  return {
    /** For the preview's Player: changes only while paused. */
    player,
    /** For film strips, as soon as each is ready. */
    ready,
    /** The helper has answered for this timeline. */
    checked: sourcesKey === "[]" || answered === requestKey,
  };
}
