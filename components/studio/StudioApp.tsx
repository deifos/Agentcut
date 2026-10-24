"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ChevronsUpDown,
  Download,
  FilePlus2,
  FolderOpen,
  Loader2,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Smartphone,
  Trash2,
  Undo2,
  Monitor,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ThemeToggle from "@/components/ThemeToggle";
import { ChatPanel } from "@/components/studio/ChatPanel";
import { StylesGallery } from "@/components/studio/styles/StylesGallery";
import { StyleSpy, StyleSpyTab } from "@/components/studio/StyleSpy";
import { Recorder } from "@/components/studio/Recorder";
import {
  APP_VERSION,
  CHANGELOG_URL,
  isOlderVersion,
  MIN_HELPER_VERSION,
} from "@/lib/version";
import { STUDIO_COMMAND } from "@/lib/studio/commands";
import { StylesTab } from "@/components/studio/styles/StylesTab";
import { getMotionStyle, type MotionStyle } from "@/motion/components";
import {
  StudioAgentContext,
  useAgentName,
} from "@/components/studio/StudioAgent";
import { ConnectScreen } from "@/components/studio/ConnectScreen";
import { ExportDialog } from "@/components/studio/ExportDialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VoicesDialog } from "@/components/studio/VoicesDialog";
import { StudioInspector } from "@/components/studio/StudioInspector";
import { StudioPreview } from "@/components/studio/StudioPreview";
import { StudioTimeline } from "@/components/studio/StudioTimeline";
import { useStudioController } from "@/components/studio/useStudioController";
import { captureFrame } from "@/lib/studio/capture";
import { variantSize } from "@/lib/studio/composition-props";
import {
  burnStrokes,
  describeStrokes,
  type DrawStroke,
} from "@/lib/studio/drawing";
import {
  addClip,
  clipEnd,
  deleteClips,
  duplicateClip,
  findClip,
  splitClip,
  uniqueClipId,
} from "@/lib/studio/edit";
import { studioFileUrl } from "@/lib/studio/bundle";
import type { StudioClip } from "@/lib/studio/types";
import { uploadToProject } from "@/lib/studio/export";
import type {
  ChatReference,
  ProjectSummary,
  StudioLayers,
} from "@/lib/studio/types";
import { referenceFromAsset } from "@/components/studio/ChatReferences";
import { formatFrameTime } from "@/lib/studio/format";
import { TimelineThumbs } from "@/components/studio/timeline-thumbs";
import {
  agentChoiceStore,
  canPickAgent,
  pickAgent,
  studioAgents,
} from "@/lib/studio/agents";

const TIMELINE_HEIGHT_KEY = "agentcut.timelineHeight";

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)
  );
}

function readNumber(key: string, fallback: number) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

/** Rounded card for each area (chat, preview, panel, timeline) on the tinted page. */
const PANEL =
  "min-h-0 overflow-hidden rounded-2xl border border-border bg-background shadow-sm";

export function StudioApp() {
  const studio = useStudioController();
  const {
    status,
    info,
    doc,
    loaded,
    frameStore,
    playerRef,
    selection,
    setSelection,
    variant,
    chat,
  } = studio;
  const agentChoice = useSyncExternalStore(
    agentChoiceStore.subscribe,
    agentChoiceStore.get,
    agentChoiceStore.getServer,
  );
  const agents = studioAgents(info);
  const agent = pickAgent(agents, agentChoice, info?.defaultAgent);
  const agentPickable = canPickAgent(info);
  const [playing, setPlaying] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  // Files attached to the next chat message, per project.
  const [referencesBySlug, setReferencesBySlug] = useState<
    Record<string, ChatReference[]>
  >({});
  const chatSlug = doc?.slug ?? "";
  const chatReferences = referencesBySlug[chatSlug] ?? [];
  const setChatReferences = useCallback(
    (
      update:
        | ChatReference[]
        | ((current: ChatReference[]) => ChatReference[]),
    ) =>
      setReferencesBySlug((all) => ({
        ...all,
        [chatSlug]:
          typeof update === "function" ? update(all[chatSlug] ?? []) : update,
      })),
    [chatSlug],
  );
  const [voicesOpen, setVoicesOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [pendingAsks, setPendingAsks] = useState<
    { frame: number; text: string }[]
  >([]);
  // Pins clear when the agent has finished everything, queued messages included.
  const chatIdle =
    !chat.running && !chat.messages.some((m) => m.status === "queued");
  const [wasIdle, setWasIdle] = useState(chatIdle);
  if (chatIdle !== wasIdle) {
    setWasIdle(chatIdle);
    if (chatIdle && pendingAsks.length) setPendingAsks([]);
  }
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [styleSpyOpen, setStyleSpyOpen] = useState(false);
  // An export in progress (browser or this computer) stays visible on the Export button and the
  // tab title after the dialog closes, like the editor's export.
  const exportJob = studio.exportJob;
  const exporting =
    exportJob && !["done", "error", "cancelled"].includes(exportJob.stage)
      ? exportJob
      : null;
  const exportPercent = exporting
    ? Math.round(Math.max(0, Math.min(1, exporting.progress)) * 100)
    : 0;
  useTabTitleProgress(
    exporting
      ? exporting.stage === "installing"
        ? "Installing Remotion"
        : `${exportPercent}% Exporting`
      : null,
  );
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(
    null,
  );
  // The studio renders client-only (see app/studio/page.tsx), so localStorage is available here.
  const [timelineHeight, setTimelineHeight] = useState(() =>
    readNumber(TIMELINE_HEIGHT_KEY, 300),
  );
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );

  const layers = doc?.layers ?? null;
  const readOnly = !doc?.layers || status !== "connected";

  const seek = useCallback(
    (frame: number) => {
      playerRef.current?.seekTo(frame);
      frameStore.set(frame);
    },
    [frameStore, playerRef],
  );

  const split = useCallback(() => {
    if (readOnly || !layers || selection.length === 0) return;
    let next: StudioLayers = layers;
    const frame = frameStore.get();
    const created: string[] = [];
    for (const id of selection) {
      const location = findClip(next, id);
      if (!location || location.track.locked) continue;
      const result = splitClip(next, id, frame);
      next = result.layers;
      if (result.newId) created.push(result.newId);
    }
    if (next !== layers) {
      studio.commitLayers(next, layers);
      if (created.length) setSelection(created);
    } else {
      toast.message("Put the playhead inside the selected clip to split it.");
    }
  }, [frameStore, layers, readOnly, selection, setSelection, studio]);

  const remove = useCallback(() => {
    if (readOnly || !layers || selection.length === 0) return;
    const ids = selection.filter((id) => !findClip(layers, id)?.track.locked);
    if (ids.length === 0) return;
    studio.commitLayers(deleteClips(layers, ids), layers);
    setSelection([]);
  }, [layers, readOnly, selection, setSelection, studio]);

  const duplicate = useCallback(() => {
    if (readOnly || !layers || selection.length !== 1) return;
    if (findClip(layers, selection[0])?.track.locked) return;
    const result = duplicateClip(layers, selection[0]);
    if (!result.newId) return;
    studio.commitLayers(result.layers, layers);
    setSelection([result.newId]);
  }, [layers, readOnly, selection, setSelection, studio]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        isTypingTarget(event.target) ||
        exportOpen ||
        newProjectOpen ||
        voicesOpen ||
        readOnly
      )
        return;
      const mod = event.metaKey || event.ctrlKey;
      const duration = doc?.project?.durationInFrames ?? 1;
      if (event.key === " ") {
        event.preventDefault();
        if (!chat.running) playerRef.current?.toggle();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step =
          (event.shiftKey ? 10 : 1) * (event.key === "ArrowLeft" ? -1 : 1);
        seek(Math.max(0, Math.min(duration - 1, frameStore.get() + step)));
      } else if (event.key === "Home") {
        seek(0);
      } else if (event.key === "End") {
        seek(duration - 1);
      } else if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) studio.redo();
        else studio.undo();
      } else if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        studio.redo();
      } else if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicate();
      } else if (!mod && event.key.toLowerCase() === "s") {
        split();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        remove();
      } else if (event.key === "Escape") {
        setSelection([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    chat.running,
    doc?.project?.durationInFrames,
    duplicate,
    exportOpen,
    frameStore,
    newProjectOpen,
    voicesOpen,
    readOnly,
    playerRef,
    remove,
    seek,
    setSelection,
    split,
    studio,
  ]);

  const sendChat = useCallback(
    async (
      text: string,
      options: { attachFrame: boolean; references?: ChatReference[] },
    ) => {
      const attachments: string[] = [];
      if (options.attachFrame && doc && loaded) {
        try {
          const frame = frameStore.get();
          const blob = await captureFrame({
            doc,
            loaded,
            variant,
            frame,
            scale: 0.5,
          });
          attachments.push(
            await uploadToProject(
              doc.slug,
              `.studio/attachments/frame-${frame}-${Date.now()}.png`,
              blob,
            ),
          );
        } catch (error) {
          toast.error(
            `Couldn't attach the frame: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      await studio.sendChat(text, {
        attachments,
        references: options.references ?? [],
        agent: agentPickable ? agent?.id : undefined,
      });
    },
    [agent?.id, agentPickable, doc, frameStore, loaded, studio, variant],
  );

  /** A camera take goes at the end of the Footage track (made when missing). */
  const addTake = async (
    path: string,
    take: { seconds: number; startSeconds: number },
  ) => {
    if (!doc?.layers || !doc.project) return;
    const { fps } = doc.project;
    // The file starts with the countdown (encoder warm-up): the clip skips it.
    const trimStart = Math.round(take.startSeconds * fps);
    let total = Math.round(take.seconds * fps);
    try {
      const { mediaInfo } = await import("@/lib/studio/audio/media-info");
      const info = (await mediaInfo(studioFileUrl(doc.slug, path), path, fps)) as {
        frames?: number;
      };
      if (info.frames && Number.isFinite(info.frames)) total = info.frames;
    } catch {}
    const duration = Math.max(1, total - trimStart);
    const footage =
      doc.layers.tracks.find(
        (track) => track.kind === "video" && /footage/i.test(track.name ?? ""),
      ) ?? doc.layers.tracks.find((track) => track.kind === "video");
    const from = footage
      ? Math.max(0, ...(footage.clips as StudioClip[]).map(clipEnd))
      : 0;
    const id = uniqueClipId(doc.layers, "take");
    const clip = {
      id,
      name: path.split("/").pop(),
      from,
      duration,
      src: path,
      trimStart,
      fit: "cover",
    } as StudioClip;
    const result = addClip(doc.layers, "video", clip, {
      trackId: footage?.id,
      trackName: "Footage",
    });
    studio.commitLayers(
      result.layers,
      doc.layers,
      Math.max(doc.project.durationInFrames, from + duration),
    );
    setSelection([id]);
    // Nothing runs yet: the take waits on the chat composer for the user to say what they want.
    setChatOpen(true);
    setChatReferences((current) =>
      current.some((r) => r.path === path)
        ? current
        : [...current, { path, kind: "video" }],
    );
    toast.success("Take added. Tell the agent what you'd like to do with it.");
  };

  // What the timeline's film strips draw with: the compiled project and the variant on screen.
  const project = doc?.project;
  const slug = doc?.slug;
  const thumbSource = useMemo(
    () => (project && slug ? { loaded, project, variant, slug } : null),
    [loaded, project, variant, slug],
  );

  const askAt = async (frame: number, text: string) => {
    seek(frame);
    await sendChat(text, { attachFrame: true });
  };

  /** The pencil: the frame goes with the drawing burned in, and the strokes as coordinates. */
  const drawingSupported = Boolean(info?.features?.includes("drawing"));
  const askWithDrawing = async (strokes: DrawStroke[], text: string) => {
    if (!doc?.project || !loaded) return;
    const frame = frameStore.get();
    const fps = doc.project.fps;
    const size = variantSize(doc.project, variant);
    const description = describeStrokes(strokes, size);
    const attachments: string[] = [];
    try {
      const still = await captureFrame({ doc, loaded, variant, frame, scale: 0.5 });
      attachments.push(
        await uploadToProject(
          doc.slug,
          `.studio/attachments/drawing-${frame}-${Date.now()}.png`,
          await burnStrokes(still, strokes, size.width),
        ),
      );
    } catch (error) {
      toast.error(
        `Couldn't attach the frame: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const message = `[Drawing at ${formatFrameTime(frame, fps)} · frame ${frame}] ${text}`;
    // Older helpers drop unknown context: the strokes ride in the message instead.
    await studio.sendChat(
      drawingSupported ? message : `${message}\n\n${description}`,
      {
        attachments,
        agent: agentPickable ? agent?.id : undefined,
        drawing: drawingSupported ? description : undefined,
      },
    );
    setPendingAsks((list) => [...list, { frame, text }]);
  };

  const stylesSupported = Boolean(info?.features?.includes("styles"));
  const currentStyle = getMotionStyle(doc?.project?.style);
  const useStyle = (styleId: string) => {
    if (doc?.project)
      void studio.saveProject({ ...doc.project, style: styleId });
  };
  const restyle = async (style: MotionStyle) => {
    if (!doc?.project) return;
    await studio.saveProject({ ...doc.project, style: style.id });
    setChatOpen(true);
    await sendChat(
      `Use the ${style.name} style for this video: restyle the edit (graphics, positions, captions, camera) following STYLES.md.`,
      { attachFrame: false },
    );
  };

  if (status !== "connected" && !info) {
    return <ConnectScreen status={status} onReconnect={studio.reconnect} />;
  }

  const variants = Object.entries(doc?.project?.variants ?? {});

  return (
    <StudioAgentContext.Provider value={agent}>
      <div className="studio-app flex h-dvh min-h-0 flex-col overflow-hidden bg-muted text-foreground">
        <header className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2">
          <Link
            href="/"
            aria-label="Agentcut home"
            className="mr-1 px-1 font-display text-lg font-extrabold tracking-[-0.04em]"
          >
            agent<span className="text-brand">cut</span>
          </Link>
          <a
            href={CHANGELOG_URL}
            target="_blank"
            rel="noreferrer"
            title={`Editor ${APP_VERSION}${info?.version ? ` · helper ${info.version}` : ""}. See what's new.`}
            className="-ml-1 mr-1 text-[10px] font-semibold text-muted-foreground tabular-nums hover:text-foreground"
          >
            v{APP_VERSION}
          </a>
          <DropdownMenu
            open={projectMenuOpen}
            onOpenChange={setProjectMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                title={doc?.dir ?? "Switch project"}
                className="max-w-80 gap-2 bg-background pl-3 pr-2.5 text-sm font-semibold"
              >
                <FolderOpen className="text-muted-foreground" />
                <span className="truncate">
                  {doc?.project?.name ??
                    (studio.opening ? "Opening…" : "Choose a project")}
                </span>
                {studio.opening ? (
                  <Loader2 className="animate-spin text-muted-foreground" />
                ) : (
                  <ChevronsUpDown className="text-muted-foreground" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuItem
                onSelect={() => setNewProjectOpen(true)}
                disabled={status !== "connected"}
              >
                <FilePlus2 className="size-4" /> New project…
              </DropdownMenuItem>
              {studio.projects.length > 0 ? <DropdownMenuSeparator /> : null}
              {studio.projects.length > 0 ? (
                <DropdownMenuLabel>Projects</DropdownMenuLabel>
              ) : null}
              {studio.projects.slice(0, 20).map((project) => (
                <DropdownMenuItem
                  key={project.slug}
                  onSelect={() => void studio.openProject(project.slug)}
                  className="group pr-1"
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      project.slug === doc?.slug && "font-semibold",
                    )}
                  >
                    {project.name}
                  </span>
                  {project.durationInFrames && project.fps ? (
                    <span className="text-[10px] tabular-nums text-muted-foreground group-focus:text-accent-foreground/85">
                      {(project.durationInFrames / project.fps).toFixed(1)}s
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Delete ${project.name}`}
                    title="Delete project"
                    disabled={status !== "connected"}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      // Don't open the project: close the menu and ask first.
                      event.preventDefault();
                      event.stopPropagation();
                      setProjectMenuOpen(false);
                      setProjectToDelete(project);
                    }}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 hover:bg-destructive hover:text-white hover:opacity-100 group-focus:text-accent-foreground group-focus:opacity-100 disabled:pointer-events-none"
                  >
                    <Trash2 className="size-3.5 text-current" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="sm"
            onClick={() => setNewProjectOpen(true)}
            disabled={status !== "connected"}
            className="gap-1.5"
          >
            <Plus /> New project
          </Button>

          {variants.length > 1 ? (
            <div className="ml-2 flex items-center rounded-full bg-background p-0.5 shadow-sm">
              {variants.map(([name, size]) => {
                const Icon = size.height > size.width ? Smartphone : Monitor;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => studio.setVariant(name)}
                    title={`${name} ${size.width}×${size.height}`}
                    className={cn(
                      "flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground",
                      variant === name && "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" /> {name}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            <HeaderButton
              label="Undo (Ctrl+Z)"
              onClick={studio.undo}
              disabled={!studio.canUndo}
            >
              <Undo2 className="size-4" />
            </HeaderButton>
            <HeaderButton
              label="Redo (Ctrl+Shift+Z)"
              onClick={studio.redo}
              disabled={!studio.canRedo}
            >
              <Redo2 className="size-4" />
            </HeaderButton>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRecordOpen(true)}
              disabled={readOnly || !doc?.project}
              title="Record a talking-head take with your camera"
              className="text-xs text-muted-foreground"
            >
              <Video /> Record
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setVoicesOpen(true)}
              disabled={status !== "connected"}
              title="Voice-over providers (ElevenLabs, Gemini, OpenAI, Grok)"
              className="text-xs text-muted-foreground"
            >
              <Mic /> Voices
            </Button>
            <ThemeToggle
              className="size-9 rounded-full"
              placeholderClassName="size-9"
            />
            <ConnectionBadge
              helperVersion={info?.version ?? null}
              status={status}
              working={Boolean(chat.running)}
              onReconnect={studio.reconnect}
            />
            {exporting ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setExportOpen(true)}
                title="Export in progress. Click to see details or cancel."
                className="relative w-36 overflow-hidden text-xs font-bold"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-300"
                  style={{ width: `${exportPercent}%` }}
                  aria-hidden="true"
                />
                <Loader2 className="relative animate-spin" />
                <span className="relative truncate tabular-nums">
                  {exporting.stage === "installing"
                    ? "Installing…"
                    : `${exporting.variant} ${exportPercent}%`}
                </span>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setExportOpen(true)}
                disabled={!doc?.project || !loaded}
                className="bg-foreground text-xs font-bold text-background hover:bg-foreground/90"
              >
                <Download /> Export
              </Button>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-2 px-2">
          {chatOpen ? (
            <aside
              className={cn(
                PANEL,
                "flex w-[340px] shrink-0 flex-col lg:w-[380px]",
              )}
            >
              <ChatPanel
                // Each project keeps its own draft.
                key={chatSlug}
                slug={doc?.slug ?? null}
                chat={chat}
                agent={agent}
                agents={agentPickable ? agents : []}
                onAgentChange={agentChoiceStore.set}
                disabled={status !== "connected" || !doc}
                references={chatReferences}
                onReferencesChange={setChatReferences}
                frameStore={frameStore}
                fps={doc?.project?.fps ?? 30}
                selectionCount={selection.length}
                onSend={sendChat}
                onCancel={() => void studio.cancelChat()}
                onReset={() => void studio.resetChat()}
                onEditQueued={studio.editQueued}
                onRemoveQueued={(id) => void studio.removeQueued(id)}
                onRunQueuedNow={(id) => void studio.runQueuedNow(id)}
              />
            </aside>
          ) : null}
          {doc?.project ? (
            // Zero-width slot on the seam: the tab hangs off the chat panel over the preview's edge.
            <div className="relative -mx-1 w-0 shrink-0">
              <div className="absolute top-12 -left-[5px] z-20 flex flex-col gap-2">
                <StylesTab
                  style={currentStyle}
                  onClick={() => setStylesOpen(true)}
                />
                <StyleSpyTab onClick={() => setStyleSpyOpen(true)} />
              </div>
            </div>
          ) : null}
          <main className={cn(PANEL, "flex min-w-0 flex-1 flex-col")}>
            <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 px-2">
              <HeaderButton
                label={chatOpen ? "Hide chat" : "Show chat"}
                onClick={() => setChatOpen((v) => !v)}
                small
              >
                {chatOpen ? (
                  <PanelLeftClose className="size-3.5" />
                ) : (
                  <PanelLeftOpen className="size-3.5" />
                )}
              </HeaderButton>
              <span className="text-[11px] text-muted-foreground">
                {studio.bundle
                  ? studio.bundle.ok
                    ? `${studio.bundle.scenes.length} scene${studio.bundle.scenes.length === 1 ? "" : "s"} · built in ${studio.bundle.durationMs} ms`
                    : "Build error"
                  : ""}
              </span>
              <span className="ml-auto" />
              <HeaderButton
                label={inspectorOpen ? "Hide panel" : "Show panel"}
                onClick={() => setInspectorOpen((v) => !v)}
                small
              >
                {inspectorOpen ? (
                  <PanelRightClose className="size-3.5" />
                ) : (
                  <PanelRightOpen className="size-3.5" />
                )}
              </HeaderButton>
            </div>
            {studio.previewRequest ? (
              <PreviewRequestBar
                name={
                  studio.projects.find((p) => p.slug === studio.previewRequest)
                    ?.name ?? studio.previewRequest
                }
                onOpen={() => void studio.openProject(studio.previewRequest!)}
                onDecline={studio.declinePreviewRequest}
              />
            ) : null}
            <div className="min-h-0 flex-1">
              {doc ? (
                <StudioPreview
                  doc={doc}
                  loaded={loaded}
                  bundle={studio.bundle}
                  moduleError={studio.moduleError}
                  variant={variant}
                  frameStore={frameStore}
                  previewPerf={studio.previewPerf}
                  playerRef={playerRef}
                  selection={selection}
                  playing={playing}
                  onPlayingChange={setPlaying}
                  editing={Boolean(chat.running)}
                  draw={
                    readOnly
                      ? undefined
                      : {
                          busy: Boolean(chat.running),
                          disabled: status !== "connected",
                          onSend: askWithDrawing,
                        }
                  }
                />
              ) : (
                <EmptyState
                  opening={studio.opening}
                  onNew={() => setNewProjectOpen(true)}
                />
              )}
            </div>
          </main>
          {inspectorOpen && doc ? (
            <aside className={cn(PANEL, "w-[340px] shrink-0 xl:w-[360px]")}>
              <StudioInspector
                doc={doc}
                variant={variant}
                selection={selection}
                assets={studio.assets}
                library={studio.library}
                frameStore={frameStore}
                readOnly={readOnly}
                onPreview={studio.previewLayers}
                onCommit={studio.commitLayers}
                onSelect={setSelection}
                onSaveProject={(project) => void studio.saveProject(project)}
                onAssetsChanged={() => void studio.refreshAssets()}
                chatBusy={Boolean(chat.running)}
                chatDisabled={status !== "connected"}
                onAskClaude={(asset, text) =>
                  sendChat(text, {
                    attachFrame: false,
                    references: [referenceFromAsset(asset)],
                  })
                }
                onAskText={(text) => sendChat(text, { attachFrame: false })}
                getBridge={studio.getBridge}
                onExport={() => setExportOpen(true)}
                stylesSupported={stylesSupported}
                onOpenStyles={() => setStylesOpen(true)}
                onMentionAsset={(asset) => {
                  const reference = referenceFromAsset(asset);
                  setChatOpen(true);
                  setChatReferences((list) =>
                    list.some((r) => r.path === reference.path)
                      ? list
                      : [...list, reference],
                  );
                }}
              />
            </aside>
          ) : null}
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline"
          className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center"
          onPointerDown={(event) => {
            (event.currentTarget as HTMLElement).setPointerCapture(
              event.pointerId,
            );
            resizeRef.current = {
              startY: event.clientY,
              startHeight: timelineHeight,
            };
          }}
          onPointerMove={(event) => {
            const resize = resizeRef.current;
            if (!resize) return;
            const next = Math.max(
              140,
              Math.min(
                window.innerHeight * 0.7,
                resize.startHeight + resize.startY - event.clientY,
              ),
            );
            setTimelineHeight(next);
          }}
          onPointerUp={() => {
            resizeRef.current = null;
            try {
              window.localStorage.setItem(
                TIMELINE_HEIGHT_KEY,
                String(Math.round(timelineHeight)),
              );
            } catch {}
          }}
        >
          <span className="h-1 w-12 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
        </div>
        <div
          className={cn(PANEL, "mx-2 mb-2 shrink-0")}
          style={{ height: timelineHeight }}
        >
          {doc?.layers && doc.project ? (
            <TimelineThumbs.Provider value={thumbSource}>
              <StudioTimeline
                layers={doc.layers}
                slug={doc.slug}
                fps={doc.project.fps}
                durationInFrames={doc.project.durationInFrames}
                frameStore={frameStore}
                selection={selection}
                onSelect={setSelection}
                onSeek={seek}
                onPreview={studio.previewLayers}
                onCommit={studio.commitLayers}
                onSplit={split}
                onDelete={remove}
                onDuplicate={duplicate}
                flashClipIds={studio.flashClipIds}
                readOnly={readOnly}
                askBusy={Boolean(chat.running)}
                askDisabled={status !== "connected"}
                pendingAsks={pendingAsks}
                onAskAt={async (frame, text) => {
                  const fps = doc.project?.fps ?? 30;
                  // The time goes in the message itself, so it's exact even if the playhead moves on.
                  await askAt(
                    frame,
                    `[At ${formatFrameTime(frame, fps)} · frame ${frame}] ${text}`,
                  );
                  setPendingAsks((list) => [...list, { frame, text }]);
                }}
              />
            </TimelineThumbs.Provider>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              The timeline appears when a project is open.
            </div>
          )}
        </div>

        {doc?.project ? (
          <Recorder
            key={`record-${doc.slug}`}
            open={recordOpen}
            onOpenChange={setRecordOpen}
            slug={doc.slug}
            frame={
              doc.project.variants[variant] ??
              doc.project.variants[doc.project.defaultVariant] ?? {
                width: 1920,
                height: 1080,
              }
            }
            disabled={readOnly}
            onAdd={addTake}
          />
        ) : null}
        {doc?.project ? (
          <StyleSpy
            key={`style-spy-${doc.slug}`}
            open={styleSpyOpen}
            onOpenChange={setStyleSpyOpen}
            slug={doc.slug}
            assets={studio.assets}
            blank={
              !doc.layers?.tracks.some((track) => track.clips.length > 0) &&
              !studio.assets.some(
                (a) =>
                  a.kind !== "other" && !a.path.startsWith("assets/references/"),
              )
            }
            disabled={readOnly || status !== "connected"}
            running={!chatIdle}
            getBridge={studio.getBridge}
            onSend={async (text) => {
              setChatOpen(true);
              await sendChat(text, { attachFrame: false });
            }}
          />
        ) : null}
        {doc?.project ? (
          <StylesGallery
            open={stylesOpen}
            onOpenChange={setStylesOpen}
            currentStyle={doc.project.style}
            supported={stylesSupported}
            readOnly={readOnly}
            chatDisabled={status !== "connected" || Boolean(chat.running)}
            onUse={useStyle}
            onRestyle={(style) => void restyle(style)}
            slug={doc.slug}
            library={studio.library}
            assets={studio.assets}
            onSend={(text) => {
              setChatOpen(true);
              void sendChat(text, { attachFrame: false });
            }}
          />
        ) : null}
        {doc?.project ? (
          <ExportDialog
            key={`export-${doc.slug}`}
            open={exportOpen}
            onOpenChange={setExportOpen}
            doc={doc}
            loaded={loaded}
            assets={studio.assets}
            currentVariant={variant}
            coverFrame={frameStore.get()}
            job={studio.exportJob}
            setJob={studio.setExportJob}
            getBridge={studio.getBridge}
          />
        ) : null}
        <VoicesDialog
          open={voicesOpen}
          onOpenChange={setVoicesOpen}
          getBridge={studio.getBridge}
          slug={doc?.slug ?? null}
          onGenerated={() => void studio.refreshAssets()}
        />
        <DeleteProjectDialog
          project={projectToDelete}
          isOpen={projectToDelete?.slug === doc?.slug}
          onClose={() => setProjectToDelete(null)}
          onDelete={studio.deleteProject}
        />
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          onCreate={async (name, vertical) => {
            await studio.createProject(name, { vertical });
            setNewProjectOpen(false);
          }}
        />
      </div>
    </StudioAgentContext.Provider>
  );
}

function HeaderButton({
  label,
  onClick,
  disabled,
  small,
  children,
}: {
  label: string;
  onClick(): void;
  disabled?: boolean;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={small ? "icon-xs" : "icon"}
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className="text-muted-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ConnectionBadge({
  helperVersion,
  status,
  working,
  onReconnect,
}: {
  helperVersion: string | null;
  status: string;
  working: boolean;
  onReconnect(): void;
}) {
  const agentName = useAgentName();
  const connected = status === "connected";
  const outdated =
    connected &&
    helperVersion !== null &&
    isOlderVersion(helperVersion, MIN_HELPER_VERSION);
  if (outdated) {
    return (
      <span
        className="flex h-9 items-center gap-2 rounded-md border border-amber-500/50 px-3 text-xs font-semibold"
        title={`Your helper is ${helperVersion}; this editor needs ${MIN_HELPER_VERSION} or newer. Stop it (Ctrl+C) and run: ${STUDIO_COMMAND}@latest`}
      >
        <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
        <span className="hidden sm:inline">Update helper</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={connected ? undefined : onReconnect}
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold",
        connected
          ? "border-emerald-500/40"
          : "border-amber-500/50 hover:bg-muted",
      )}
      title={
        connected
          ? `Connected to the studio helper on this computer${helperVersion ? ` (${helperVersion})` : ""}`
          : "Click to reconnect"
      }
    >
      <span className="relative flex size-2.5">
        {working ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            connected ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
      </span>
      <span className="hidden sm:inline">
        {connected
          ? working
            ? `${agentName} is working`
            : "Connected"
          : status === "taken"
            ? "In use by another tab"
            : "Reconnecting…"}
      </span>
    </button>
  );
}

/** An agent working on another project needs the preview; it waits until the user opens it. */
function PreviewRequestBar({
  name,
  onOpen,
  onDecline,
}: {
  name: string;
  onOpen(): void;
  onDecline(): void;
}) {
  const agentName = useAgentName();
  return (
    <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-1.5 text-xs">
      <span className="min-w-0 flex-1 truncate">
        {agentName} is working on <strong>{name}</strong> and needs to see it.
      </span>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onDecline}>
        Not now
      </Button>
      <Button size="sm" className="h-6 px-2 text-xs" onClick={onOpen}>
        Open
      </Button>
    </div>
  );
}

function EmptyState({ opening, onNew }: { opening: boolean; onNew(): void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      {opening ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <>
          <p>No project open.</p>
          <button
            type="button"
            onClick={onNew}
            className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground"
          >
            <FilePlus2 className="size-4" /> New project
          </button>
        </>
      )}
    </div>
  );
}

/** Confirm before a project and all its files are removed from disk. */
function DeleteProjectDialog({
  project,
  isOpen,
  onClose,
  onDelete,
}: {
  project: ProjectSummary | null;
  /** It's the project on screen (the studio switches to another one first). */
  isOpen: boolean;
  onClose(): void;
  onDelete(slug: string): Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <AlertDialog
      open={Boolean(project)}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{project?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the project folder from your computer: its scenes,
            voice, music, footage, renders and chat. It can&apos;t be undone.
            {isOpen ? " You'll switch to another project." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={async (event) => {
              // Keep the dialog open until the files are gone.
              event.preventDefault();
              if (!project) return;
              setDeleting(true);
              try {
                await onDelete(project.slug);
              } finally {
                setDeleting(false);
                onClose();
              }
            }}
          >
            {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NewProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreate(name: string, vertical: boolean): Promise<void>;
}) {
  const agentName = useAgentName();
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New video</DialogTitle>
          <DialogDescription>
            Every project has a wide (16:9) and a mobile (9:16) version.{" "}
            {agentName} can change this.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim() || busy) return;
            setBusy(true);
            try {
              await onCreate(name.trim(), vertical);
              setName("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Launch video"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground/50"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vertical}
              onChange={(event) => setVertical(event.target.checked)}
            />{" "}
            Mobile (9:16) is the main version
          </label>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FilePlus2 className="size-4" />
            )}{" "}
            Create
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Puts `label` in front of the tab title while set ("42% Exporting | Agentcut"), then restores it. */
function useTabTitleProgress(label: string | null) {
  const original = useRef<string | null>(null);
  useEffect(() => {
    if (label === null) {
      if (original.current !== null) {
        document.title = original.current;
        original.current = null;
      }
      return;
    }
    if (original.current === null) original.current = document.title;
    document.title = `${label} | Agentcut`;
  }, [label]);
  useEffect(
    () => () => {
      if (original.current !== null) document.title = original.current;
    },
    [],
  );
}
