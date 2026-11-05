import { useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ChatPanel, type ChatPanelProps } from "../../components/studio/ChatPanel";
import { TooltipProvider } from "../../components/ui/tooltip";
import { createFrameStore } from "../../lib/studio/frame-store";
import type { ChatReference } from "../../lib/studio/types";

const root = createRoot(document.getElementById("root")!);
const noop = () => {};
const frameStore = createFrameStore();
let sent: { text: string; options: unknown }[] = [];
let rejectSend = false;
let resolveSend: (() => void) | undefined;
let holdSend = false;
let mountId = 0;
let addReference: (ref: ChatReference) => void;

function Harness({ config }: { config: Partial<ChatPanelProps> }) {
  const [references, setReferences] = useState(config.references ?? []);
  useLayoutEffect(() => {
    addReference = (ref) => flushSync(() => setReferences((current) => [...current, ref]));
  }, []);
  return <TooltipProvider><ChatPanel
    chat={{ messages: [], running: null, sessionId: null }} agent={null} agents={[]}
    onAgentChange={noop} model={null} onModelChange={noop} efforts={[]} effort={null}
    onEffortChange={noop} disabled={false} frameStore={frameStore} fps={30} selectionCount={0}
    onCancel={noop} onReset={noop} onEditQueued={async () => {}} onRemoveQueued={noop}
    onRunQueuedNow={noop} slug="launch-test" simple
    {...config} references={references} onReferencesChange={setReferences}
    onSend={async (text, options) => {
      sent.push({ text, options });
      if (holdSend) await new Promise<void>((resolve) => { resolveSend = resolve; });
      if (rejectSend) throw new Error("Test send failure");
    }}
  /></TooltipProvider>;
}

Object.assign(window, { api: {
  mount(config: Partial<ChatPanelProps> = {}, fail = false, hold = false) {
    sent = []; rejectSend = fail; holdSend = hold;
    flushSync(() => root.render(null));
    flushSync(() => root.render(<Harness config={{ slug: `launch-test-${++mountId}`, ...config }} />));
  },
  sent: () => sent,
  addReference: (ref: ChatReference) => addReference(ref),
  finish: () => resolveSend?.(),
} });
