import { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { StudioInspector, type StudioInspectorProps } from "../../components/studio/StudioInspector";
import { ConfirmHost } from "../../components/studio/ConfirmHost";
import { TooltipProvider } from "../../components/ui/tooltip";
import { usePreviewProxies } from "../../lib/studio/use-preview-proxies";
import type { AssetEntry, StudioDoc, StudioLayers } from "../../lib/studio/types";

const root = createRoot(document.getElementById("root")!);
const clip = (id: string) => ({ id, src: "assets/a.mp4", from: 0, duration: 30 });
let current: StudioDoc;
let committed: StudioLayers | null = null;
const doc = (): StudioDoc => ({ slug: "test", layersHash: null, projectHash: null, issues: [], scenes: [], dir: "test", project: { version: 1, name: "Test", background: "#000000", fonts: [], fps: 30, durationInFrames: 60, defaultVariant: "wide", variants: { wide: { width: 320, height: 180 } } },
  layers: { version: 1, markers: [], tracks: [{ id: "audio", name: "Audio", kind: "audio", clips: [clip("a"), clip("b")] }] } });
const noop = () => {};
const frameStore = { get: () => 0, set: noop, subscribe: () => noop, scrubbing: false };

let proxyResult: ReturnType<typeof usePreviewProxies>;
let changeAssets: (assets: AssetEntry[]) => void;
let changePlaying: (playing: boolean) => void;
const requests: string[] = [];
let sourceVersion = 1;
let responseState = "ready";
window.fetch = (async (url: string) => {
  requests.push(url);
  return new Response(JSON.stringify({ state: responseState, file: `copy-${sourceVersion}.mp4` }), { status: 200 });
}) as typeof fetch;
const assets = (version: number): AssetEntry[] => [{ path: "assets/a.mp4", kind: "video", size: 100, updatedAt: version }];
const videoLayers = { version: 1, tracks: [{ id: "v", kind: "video", clips: [clip("v")] }] } as StudioLayers;
function Proxies() {
  const [files, setFiles] = useState(assets(1));
  const [playing, setPlaying] = useState(false);
  const result = usePreviewProxies("test", videoLayers, playing, files);
  useLayoutEffect(() => {
    changeAssets = setFiles;
    changePlaying = setPlaying;
    proxyResult = result;
  }, [result]);
  return null;
}

Object.assign(window, { api: {
  inspector(ids: string[]) {
    current = doc();
    committed = null;
    const props = { doc: current, getDoc: () => current, selection: ids, variant: "wide", assets: [], library: [], frameStore,
      readOnly: false, onCommit: (layers: StudioLayers) => { committed = layers; }, onSelect: noop,
      onPreview: noop, onSaveProject: noop, onAssetsChanged: noop, onAskClaude: async () => {}, onMentionAsset: noop,
      onAskText: async () => {}, chatBusy: false, chatDisabled: false, getBridge: () => null, onExport: noop,
      stylesSupported: false, onOpenStyles: noop } as StudioInspectorProps;
    flushSync(() => root.render(<TooltipProvider><StudioInspector {...props} /><ConfirmHost /></TooltipProvider>));
  },
  editWhileConfirming(mode: string) {
    current = { ...current, slug: mode === "switch" ? "other" : current.slug,
      layers: { ...current.layers!, tracks: [{ ...current.layers!.tracks[0], locked: mode === "lock",
        clips: [...current.layers!.tracks[0].clips, clip("new-agent-clip")] }] } };
  },
  committed: () => committed?.tracks[0].clips.map((entry) => entry.id) ?? null,
  proxies() { requests.length = 0; sourceVersion = 1; responseState = "ready"; flushSync(() => root.render(<Proxies />)); },
  replace(version: number, state = "ready") {
    sourceVersion = version; responseState = state;
    flushSync(() => changeAssets(assets(version)));
    return proxyResult;
  },
  playing(value: boolean) { flushSync(() => changePlaying(value)); },
  proxyResult: () => ({ ...proxyResult, requests: requests.length }),
} });
