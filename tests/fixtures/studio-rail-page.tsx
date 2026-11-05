import { createRoot } from "react-dom/client";
import { useState } from "react";
import { StyleActionRail } from "../../components/studio/styles/StyleActionRail";
import { StylesTab } from "../../components/studio/styles/StylesTab";
import { StyleSpyTab } from "../../components/studio/StyleSpy";
import { CinematicTab } from "../../components/studio/Cinematic";
import ClipCanvas from "../../components/studio/ClipCanvas";
import { TooltipProvider } from "../../components/ui/tooltip";
import { VoicesDialog } from "../../components/studio/VoicesDialog";
import { KOKORO_VOICES } from "../../packages/agentcut/src/studio/voice/kokoro-catalog";
import type { StudioBridge } from "../../lib/studio/bridge";
const noop = () => {};
const local = {
  id: "kokoro",
  name: "Kokoro (free, local)",
  local: true,
  configured: true,
  source: null,
  models: [{ id: "kokoro-model", label: "Local CPU" }],
  defaultModel: "kokoro-model",
  defaultVoice: "af_heart",
  styleNote: "English only",
};
const paid = {
  ...local,
  id: "openai",
  name: "OpenAI",
  local: false,
  source: "saved",
  defaultVoice: "cedar",
};
const calls: Record<string, unknown>[] = [];
const bridge = {
  request: async (method: string, p: Record<string, unknown>) => {
    calls.push({ method, ...p });
    if (method === "studio.voice.settings")
      return { providers: [local, paid], defaultProvider: "kokoro" };
    if (method === "studio.voice.voices")
      return {
        voices:
          p.provider === "kokoro"
            ? KOKORO_VOICES
            : [{ id: "cedar", name: "Cedar" }],
      };
    if (method === "studio.voice.generate")
      return { provider: p.provider, voice: p.voice, takes: [] };
    return {
      group: "test",
      sources: [],
      cuts: [
        {
          slug: "a",
          title: "Tutorial",
          clip: "one",
          version: "Original",
          sources: [],
        },
        {
          slug: "b",
          title: "Launch",
          clip: "two",
          version: "Original",
          sources: [],
        },
      ],
    };
  },
  on: () => noop,
} as unknown as StudioBridge;
function App() {
  const [height, setHeight] = useState(350),
    [panels, setPanels] = useState(true);
  Object.assign(window, {
    setLayout: (h: number, p: boolean) => {
      setHeight(h);
      setPanels(p);
    },
    calls,
  });
  if (new URLSearchParams(location.search).has("voice"))
    return (
      <TooltipProvider>
        <VoicesDialog
          open
          onOpenChange={noop}
          getBridge={() => bridge}
          slug="fixture"
          onGenerated={noop}
        />
      </TooltipProvider>
    );
  return (
    <TooltipProvider>
      <div className="studio-app flex h-screen flex-col">
        <div
          id="upper"
          className="flex min-h-0 shrink-0 gap-1"
          style={{ height }}
        >
          {panels ? <aside className="w-44 shrink-0">Chat</aside> : null}
          <StyleActionRail>
            <StylesTab
              style={null}
              onClick={noop}
              onSave={noop}
              saveDisabled={false}
            />
            <StyleSpyTab onClick={noop} />
            <CinematicTab onClick={noop} />
          </StyleActionRail>
          <div className="flex min-w-0 flex-1">
            <ClipCanvas
              slug="a"
              bridge={bridge}
              revision={0}
              assets={[]}
              thumbSource={null}
              layersHash={null}
              layers={{ version: 1, tracks: [], markers: [] }}
              activeSize={{ width: 1920, height: 1080 }}
              open={async () => {}}
              preview={noop}
              flush={async () => {}}
              deleteCut={async () => true}
              upload={async () => {}}
              getActive={() => "a"}
            />
          </div>
          {panels ? <aside className="w-44 shrink-0">Assets</aside> : null}
        </div>
        <div id="timeline" className="flex-1 border-t">
          Timeline ruler
        </div>
      </div>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
