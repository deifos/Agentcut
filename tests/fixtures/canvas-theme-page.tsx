import { createRoot } from "react-dom/client";
import ClipCanvas from "../../components/studio/ClipCanvas";
import ThemeToggle from "../../components/ThemeToggle";
import { ChatPanel, type ChatPanelProps } from "../../components/studio/ChatPanel";
import { TooltipProvider } from "../../components/ui/tooltip";
import { createFrameStore } from "../../lib/studio/frame-store";
import type { StudioBridge } from "../../lib/studio/bridge";

const noop = () => {};
const bridge = {
  async request() { return { group: "fixture", sources: [], cuts: [
    { slug: "canvas-test", title: "Tutorial", clip: "one", version: "Original", sources: [], seconds: 30 },
    { slug: "second", title: "Launch", clip: "two", version: "Original", sources: [], seconds: 20 },
  ] }; },
  on: () => noop,
} as unknown as StudioBridge;
const chatProps = {
  chat: { sessionId: "test", running: null, messages: [{ id: "question", role: "assistant", status: "done", at: 1,
    parts: [{ type: "text", text: "The outline is ready.\n\nShould it also have a voiceover, or just music with text steps?" }] }] },
  agent: null, agents: [], onAgentChange: noop, model: null, onModelChange: noop, efforts: [], effort: null,
  onEffortChange: noop, disabled: false, frameStore: createFrameStore(), fps: 30, selectionCount: 0, references: [], onReferencesChange: noop,
  onCancel: noop, onReset: noop, onEditQueued: async () => {}, onRemoveQueued: noop, onRunQueuedNow: noop,
  onSend: async () => {}, slug: "theme-test", simple: true,
} as ChatPanelProps;
const root = createRoot(document.getElementById("root")!);
function render(text?: string) {
root.render(<TooltipProvider>
  <style>{`@media(max-width:700px) { #theme-layout { grid-template-columns:minmax(0,1fr)!important; grid-template-rows:300px auto; } #theme-root { height:auto!important; min-height:100vh; } }`}</style>
  <main id="theme-root" className="studio-app" style={{ height: "100vh", background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column" }}>
    <header style={{ padding: 12 }}><ThemeToggle /></header>
    <div id="theme-layout" style={{ display: "grid", gridTemplateColumns: "1fr 400px", flex: 1, minHeight: 0 }}>
      <ClipCanvas slug="canvas-test" bridge={bridge} revision={0} assets={[]} thumbSource={null} layersHash={null}
        layers={{ version: 1, tracks: [], markers: [] }} activeSize={{ width: 1920, height: 1080 }}
        open={async () => {}} preview={noop} flush={async () => {}} deleteCut={async () => true} upload={async () => {}} getActive={() => "canvas-test"} />
      <ChatPanel {...chatProps} chat={text ? { ...chatProps.chat, messages: [{ id: "blocked", role: "assistant", at: 2, status: "done", parts: [{ type: "text", text }] }] } : chatProps.chat} />
    </div>
  </main>
</TooltipProvider>);
}
render();
Object.assign(window, { showBlocked: () => render("The voice and markers are ready.\n\n**Still blocked:** I need a real recording of the canvas screen. Either option unblocks it:\n1. **A screen recording in the Library panel.** Show the actual action.\n2. **Code access.** Provide the source location.\n\nOnce I have either, I will build the scenes.") });
