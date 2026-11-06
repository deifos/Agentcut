import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { StudioBridge } from "../../lib/studio/bridge";
import type { StudioDoc, LoadedModule } from "../../lib/studio/types";
import type { ExportJob } from "../../components/studio/useStudioController";
declare global {
  interface Window {
    calls: Record<string, unknown>[];
    replaceFormatAfterRender?: boolean;
  }
}
import { ExportDialog } from "../../components/studio/ExportDialog";
const count = Number(new URLSearchParams(location.search).get("count") || 2);
const snapshots = Object.fromEntries(
  Array.from({ length: count }, (_, i) => {
    const slug = `video-${i}`;
    return [
      slug,
      {
        slug,
        project: {
          name: i ? "How to use Agentcut" : "Agentcut launch",
          variants: { wide: { width: 1920, height: 1080 } },
          defaultVariant: "wide",
          fps: 30,
          durationInFrames: i ? 4140 : 6120,
        },
        layers: { tracks: [{ kind: "scene", clips: [{ id: "clip" }] }] },
        projectValid: true,
        layersValid: true,
        projectHash: "p",
        layersHash: "l",
        issues: [],
        scenes: [],
        assets: [
          {
            path: "renders/fixture-cover.png",
            kind: "image",
            size: 1,
            updatedAt: 1,
          },
        ],
        bundle: { ok: true, hasCode: true, revision: 1 },
        chat: { messages: [], running: null },
      },
    ];
  }),
);
window.calls = [];
let refreshSlug: string | undefined;
const bridge = {
  request: async (method: string, p: Record<string, string>) => {
    window.calls.push({ method, ...p });
    if (method === "studio.canvas.read")
      return {
        cuts: Object.values(snapshots).map((s, i) => ({
          slug: s.slug,
          poster: { project: s.slug, path: "assets/source.jpg", seconds: 0 },
          title: `${s.project.name}${i > 1 ? ` ${i}` : ""}`,
        })),
      };
    if (method === "studio.project.snapshot") {
      const snapshot = structuredClone(snapshots[p.slug]);
      if (refreshSlug === p.slug) {
        // Finish the render check, then simulate a project edit before the dialog refresh.
        Object.assign(snapshots[p.slug].project, {
          variants: { square: { width: 1080, height: 1080 } },
          defaultVariant: "square",
        });
        snapshots[p.slug].projectHash = "edited";
        refreshSlug = undefined;
      }
      return snapshot;
    }
    if (method === "studio.render.local") {
      if (window.replaceFormatAfterRender) refreshSlug = p.slug;
      return { path: `renders/${p.slug}.mp4` };
    }
    throw Error(method);
  },
};
const getBridge = () => bridge as unknown as StudioBridge;
function App() {
  const [job, setJob] = useState<ExportJob | null>(null);
  return (
    <ExportDialog
      open
      onOpenChange={() => {}}
      doc={snapshots["video-0"] as unknown as StudioDoc}
      loaded={{ slug: "video-0", revision: 1, module: {} } as LoadedModule}
      assets={[]}
      currentVariant="wide"
      coverFrame={5}
      job={job}
      setJob={setJob}
      getBridge={getBridge}
      flush={async () => {}}
      onSaveProject={async () => {}}
      qualitySupported
      resolutionSupported
      fourKSupported
    />
  );
}
createRoot(document.getElementById("root")!).render(<App />);
