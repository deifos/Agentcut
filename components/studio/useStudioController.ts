"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PlayerRef } from "@remotion/player";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/version";
import {
  StudioBridge,
  StudioRequestError,
  type StudioBridgeStatus,
} from "@/lib/studio/bridge";
import { forgetDecodedAudio } from "@/lib/studio/audio/decode";
import { evaluateStudioBundle, fetchStudioBundle } from "@/lib/studio/bundle";
import { createFrameStore } from "@/lib/studio/frame-store";
import { createPreviewPerfStore } from "@/lib/studio/preview-perf";
import { formatBytes } from "@/lib/studio/format";
import {
  runStudioTool,
  type StudioExportJobUpdate,
  type StudioToolContext,
} from "@/lib/studio/agent-tools";
import type {
  AssetEntry,
  BundleSummary,
  ChatHistory,
  ChatReference,
  ChatMessage,
  ChatPart,
  OpenProjectResult,
  ProjectPayload,
  ProjectSummary,
  StudioInfo,
  LoadedModule,
  StudioDoc,
  StudioLayers,
  StudioProject,
  ValidationIssue,
} from "@/lib/studio/types";

const LAST_PROJECT_KEY = "agentcut.lastProject";
const WRITE_DEBOUNCE_MS = 300;
const UNDO_LIMIT = 100;

export type { LoadedModule, StudioDoc } from "@/lib/studio/types";

export type ExportJob = StudioExportJobUpdate;

// How long an agent tool waits for the user to open its project. Under the helper's shortest
// timeout for page tools (1 minute), so the agent gets this explanation rather than a timeout.
const PREVIEW_WAIT_MS = 50_000;

interface PreviewWait {
  slug: string;
  resolve(): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

function readLastProject() {
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

function writeLastProject(slug: string) {
  try {
    window.localStorage.setItem(LAST_PROJECT_KEY, slug);
  } catch {}
}

function normalizeLayers(raw: unknown): StudioLayers {
  const value = raw as StudioLayers;
  return {
    ...value,
    markers: Array.isArray(value.markers) ? value.markers : [],
  };
}

function mergePayload(
  previous: StudioDoc | null,
  payload: ProjectPayload & { dir?: string },
): StudioDoc {
  const sameProject = previous?.slug === payload.slug;
  return {
    slug: payload.slug,
    project: payload.projectValid
      ? (payload.project as StudioProject)
      : sameProject
        ? previous.project
        : null,
    layers: payload.layersValid
      ? normalizeLayers(payload.layers)
      : sameProject
        ? previous.layers
        : null,
    layersHash: payload.layersHash,
    projectHash: payload.projectHash,
    issues: payload.issues,
    scenes: payload.scenes,
    dir: payload.dir ?? (sameProject ? previous.dir : null),
  };
}

function applyChatEvent(
  chat: ChatHistory,
  data: Record<string, unknown>,
): ChatHistory {
  const kind = data.kind;
  const messages = chat.messages;
  const replace = (id: unknown, fn: (message: ChatMessage) => ChatMessage) =>
    messages.map((message) => (message.id === id ? fn(message) : message));
  switch (kind) {
    case "reset":
      return { sessionId: null, messages: [], running: null };
    case "user":
    case "start": {
      const message = data.message as ChatMessage;
      if (messages.some((m) => m.id === message.id)) return chat;
      return {
        ...chat,
        messages: [...messages, message],
        running: kind === "start" ? message.id : chat.running,
      };
    }
    case "update": {
      const message = data.message as ChatMessage;
      return { ...chat, messages: replace(message.id, () => message) };
    }
    case "dequeue": {
      // A queued message starts: it moves down to where the answer begins.
      const message = data.message as ChatMessage;
      return {
        ...chat,
        messages: [...messages.filter((m) => m.id !== message.id), message],
      };
    }
    case "remove":
      return {
        ...chat,
        messages: messages.filter((m) => m.id !== data.messageId),
      };
    case "text":
      return {
        ...chat,
        messages: replace(data.messageId, (message) => {
          const parts = [...(message.parts ?? [])];
          const last = parts[parts.length - 1];
          if (last && last.type === "text")
            parts[parts.length - 1] = {
              ...last,
              text: last.text + String(data.text ?? ""),
            };
          else parts.push({ type: "text", text: String(data.text ?? "") });
          return { ...message, parts };
        }),
      };
    case "tool":
    case "tool_result": {
      const part = data.part as ChatPart;
      return {
        ...chat,
        messages: replace(data.messageId, (message) => {
          const parts = [...(message.parts ?? [])];
          const index = parts.findIndex(
            (p) =>
              p.type === "tool" && part.type === "tool" && p.id === part.id,
          );
          if (index >= 0) parts[index] = part;
          else parts.push(part);
          return { ...message, parts };
        }),
      };
    }
    case "done": {
      const message = data.message as ChatMessage;
      const exists = messages.some((m) => m.id === message.id);
      return {
        ...chat,
        messages: exists
          ? replace(message.id, () => message)
          : [...messages, message],
        running: chat.running === message.id ? null : chat.running,
      };
    }
    default:
      return chat;
  }
}

export function useStudioController() {
  const [frameStore] = useState(() => createFrameStore());
  const [previewPerf] = useState(() => createPreviewPerfStore());
  const playerRef = useRef<PlayerRef | null>(null);
  const bridgeRef = useRef<StudioBridge | null>(null);

  const [status, setStatus] = useState<StudioBridgeStatus>("connecting");
  const [info, setInfo] = useState<StudioInfo | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [doc, setDoc] = useState<StudioDoc | null>(null);
  const [opening, setOpening] = useState(false);
  const [bundle, setBundle] = useState<BundleSummary | null>(null);
  const [loaded, setLoaded] = useState<LoadedModule | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [library, setLibrary] = useState<AssetEntry[]>([]);
  const [chat, setChat] = useState<ChatHistory>({
    sessionId: null,
    messages: [],
    running: null,
  });
  const [variantChoice, setVariantChoice] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const [agentActivity, setAgentActivity] = useState<{
    method: string;
    at: number;
  } | null>(null);
  const [flashClipIds, setFlashClipIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const variant =
    doc?.project && variantChoice && doc.project.variants[variantChoice]
      ? variantChoice
      : (doc?.project?.defaultVariant ?? "wide");

  const undoRef = useRef<{ past: StudioLayers[]; future: StudioLayers[] }>({
    past: [],
    future: [],
  });
  // Project length that goes with a layers state, for edits that change both (ripple trims), so
  // undo/redo put the length back too.
  const durationsRef = useRef(new WeakMap<StudioLayers, number>());
  const writeChain = useRef<Promise<void>>(Promise.resolve());
  const writing = useRef(false);
  /** Bumped by each openProject call, so a slower earlier open can't overwrite a later one. */
  const openSeq = useRef(0);
  /** Agent tools waiting for the user to open their project (see waitForProject). */
  const previewWaits = useRef<PreviewWait[]>([]);
  const [previewRequest, setPreviewRequest] = useState<string | null>(null);
  const writeRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    layers: StudioLayers | null;
    slug: string | null;
  }>({
    timer: null,
    layers: null,
    slug: null,
  });

  // Latest values for socket callbacks and agent tools.
  const latest = useRef({
    doc,
    loaded,
    variant,
    selection,
    assets,
  });
  useLayoutEffect(() => {
    latest.current = { doc, loaded, variant, selection, assets };
  });

  // ---------------------------------------------------------------------------
  // Bundles

  const loadBundle = useCallback(
    async (slug: string, summary: BundleSummary | null) => {
      if (!summary?.hasCode) {
        setModuleError(
          summary && !summary.ok ? "The project has build errors." : null,
        );
        return;
      }
      const current = latest.current.loaded;
      if (
        current &&
        current.slug === slug &&
        current.revision >= summary.revision
      )
        return;
      try {
        const { code, revision } = await fetchStudioBundle(slug);
        if (latest.current.doc?.slug !== slug) return;
        const active = latest.current.loaded;
        if (active?.slug === slug && active.revision >= revision) return;
        const evaluated = evaluateStudioBundle(code, slug, revision);
        const next = { slug, revision, module: evaluated };
        latest.current.loaded = next;
        setLoaded(next);
        setModuleError(null);
      } catch (error) {
        setModuleError(error instanceof Error ? error.message : String(error));
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Projects

  const resetHistory = useCallback(() => {
    undoRef.current = { past: [], future: [] };
    setHistorySize({ past: 0, future: 0 });
  }, []);

  const flushWrite = useCallback(() => {
    const bridge = bridgeRef.current;
    const task = writeChain.current.then(async () => {
      const pending = writeRef.current;
      if (pending.timer) clearTimeout(pending.timer);
      pending.timer = null;
      const layers = pending.layers;
      const slug = pending.slug;
      if (!layers || !slug) return;
      const current = latest.current.doc;
      if (!bridge || !current || current.slug !== slug) return;
      pending.layers = null;
      writing.current = true;
      try {
        const result = await bridge.request<{
          layersHash: string;
          issues: ValidationIssue[];
        }>("studio.layers.write", {
          slug,
          layers,
          baseHash: current.layersHash,
        });
        if (latest.current.doc?.slug === slug) {
          latest.current.doc = {
            ...latest.current.doc,
            layersHash: result.layersHash,
            issues: result.issues,
          };
        }
        setDoc((previous) =>
          previous && previous.slug === slug
            ? {
                ...previous,
                layersHash: result.layersHash,
                issues: result.issues,
              }
            : previous,
        );
      } catch (error) {
        const code =
          error instanceof StudioRequestError ? error.code : undefined;
        toast.error(
          code === "conflict"
            ? "The agent changed the timeline at the same time. Reloaded the latest version; redo your last change."
            : `Couldn't save the timeline: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (code === "conflict") {
          try {
            const fresh = await bridge.request<OpenProjectResult>(
              "studio.project.open",
              { slug },
            );
            if (latest.current.doc?.slug === slug) {
              pending.layers = null;
              latest.current.doc = mergePayload(latest.current.doc, fresh);
              setDoc(latest.current.doc);
            }
          } catch {}
        } else if (!pending.layers) {
          pending.layers = layers;
          pending.slug = slug;
        }
      } finally {
        writing.current = false;
      }
    });
    writeChain.current = task;
    return task;
  }, []);

  /** Let agent tools waiting for `slug` go on (error = null) or fail. */
  const settlePreviewWaits = useCallback(
    (slug: string, error: Error | null) => {
      const settled = previewWaits.current.filter((w) => w.slug === slug);
      if (settled.length === 0) return;
      previewWaits.current = previewWaits.current.filter((w) => w.slug !== slug);
      setPreviewRequest(previewWaits.current[0]?.slug ?? null);
      for (const wait of settled) {
        clearTimeout(wait.timer);
        if (error) wait.reject(error);
        else wait.resolve();
      }
    },
    [],
  );

  const openProject = useCallback(
    async (slug: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      // Opening waits for the project's build; only the latest open may land.
      const seq = ++openSeq.current;
      await flushWrite();
      if (writeRef.current.layers || seq !== openSeq.current) return;
      setOpening(true);
      try {
        const result = await bridge.request<OpenProjectResult>(
          "studio.project.open",
          { slug },
          120_000,
        );
        if (seq !== openSeq.current) return;
        const isNewProject = latest.current.doc?.slug !== slug;
        setDoc((previous) => mergePayload(previous, result));
        setBundle(result.bundle);
        setAssets(result.assets);
        setChat(result.chat);
        if (isNewProject) {
          forgetDecodedAudio();
          setSelection([]);
          setLoaded(null);
          setModuleError(null);
          resetHistory();
          frameStore.set(0);
        }
        writeLastProject(slug);
        latest.current.doc = mergePayload(latest.current.doc, result);
        await loadBundle(slug, result.bundle);
        if (seq === openSeq.current) settlePreviewWaits(slug, null);
        void bridge
          .request<{ assets: AssetEntry[]; library: AssetEntry[] }>(
            "studio.assets.list",
            { slug },
          )
          .then((value) => setLibrary(value.library))
          .catch(() => undefined);
      } catch (error) {
        toast.error(
          `Couldn't open the project: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        if (seq === openSeq.current) setOpening(false);
      }
    },
    [flushWrite, frameStore, loadBundle, resetHistory, settlePreviewWaits],
  );

  /**
   * An agent tool needs `slug` on screen. Ask the user (banner) instead of switching away
   * from what they're doing; resolves once they open it.
   */
  const waitForProject = useCallback(
    (slug: string) => {
      if (latest.current.doc?.slug === slug) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const wait: PreviewWait = {
          slug,
          resolve,
          reject,
          timer: setTimeout(() => {
            previewWaits.current = previewWaits.current.filter((w) => w !== wait);
            setPreviewRequest(previewWaits.current[0]?.slug ?? null);
            reject(
              new Error(
                `The user is working on another project and didn't open "${slug}" (they were asked). ` +
                  "Keep working on the files, and ask them to open the project when you need to see it.",
              ),
            );
          }, PREVIEW_WAIT_MS),
        };
        previewWaits.current = [...previewWaits.current, wait];
        setPreviewRequest(previewWaits.current[0].slug);
      });
    },
    [],
  );

  /** "Not now" on the banner. */
  const declinePreviewRequest = useCallback(() => {
    const slug = previewWaits.current[0]?.slug;
    if (slug)
      settlePreviewWaits(
        slug,
        new Error(
          `The user chose to stay on the project they're working on instead of opening "${slug}". ` +
            "Keep working on the files, and ask them to open the project when you need to see it.",
        ),
      );
  }, [settlePreviewWaits]);

  /** Re-read the open project from disk (waits for the helper's current build). */
  const syncProject = useCallback(async () => {
    const bridge = bridgeRef.current;
    const current = latest.current.doc;
    if (!bridge || !current) return;
    const seq = openSeq.current;
    await flushWrite();
    const result = await bridge.request<OpenProjectResult>(
      "studio.project.open",
      { slug: current.slug },
      120_000,
    );
    // The user opened another project while this one was building: don't switch back.
    if (seq !== openSeq.current || latest.current.doc?.slug !== current.slug)
      return;
    const next = mergePayload(latest.current.doc, result);
    latest.current.doc = next;
    setDoc(next);
    setBundle(result.bundle);
    await loadBundle(current.slug, result.bundle);
  }, [flushWrite, loadBundle]);

  const createProject = useCallback(
    async (name: string, options: { vertical?: boolean } = {}) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      try {
        const variants = options.vertical
          ? {
              mobile: { width: 1080, height: 1920 },
              wide: { width: 1920, height: 1080 },
            }
          : undefined;
        const created = await bridge.request<{ slug: string }>(
          "studio.projects.create",
          { name, variants },
        );
        await openProject(created.slug);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    },
    [openProject],
  );

  /** Delete a project and its files from disk. Leaves it first if it's the open one. */
  const deleteProject = useCallback(
    async (slug: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      const isOpen = latest.current.doc?.slug === slug;
      if (isOpen && chat.running) {
        toast.error("The agent is working on this project. Stop it first.");
        return;
      }
      try {
        if (isOpen) {
          // Switch away first so the preview lets go of the project's files.
          const next = projects.find((project) => project.slug !== slug);
          if (next) await openProject(next.slug);
          if (latest.current.doc?.slug === slug) {
            await flushWrite();
            latest.current.doc = null;
            setDoc(null);
            setBundle(null);
            setLoaded(null);
            setAssets([]);
            setChat({ sessionId: null, messages: [], running: null });
            setSelection([]);
            resetHistory();
          }
        }
        const result = await bridge.request<{ bytes: number }>(
          "studio.projects.delete",
          { slug },
          60_000,
        );
        toast.success(
          result.bytes > 0
            ? `Project deleted. Freed ${formatBytes(result.bytes)}.`
            : "Project deleted.",
        );
      } catch (error) {
        toast.error(
          `Couldn't delete the project: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [chat.running, flushWrite, openProject, projects, resetHistory],
  );

  const refreshAssets = useCallback(async () => {
    const bridge = bridgeRef.current;
    const slug = latest.current.doc?.slug;
    if (!bridge || !slug) return;
    try {
      const result = await bridge.request<{
        assets: AssetEntry[];
        library: AssetEntry[];
      }>("studio.assets.list", { slug });
      if (latest.current.doc?.slug !== slug) return;
      setAssets(result.assets);
      setLibrary(result.library);
    } catch {}
  }, []);

  // ---------------------------------------------------------------------------
  // Layer edits (timeline + inspector)

  const scheduleWrite = useCallback(
    (slug: string, layers: StudioLayers) => {
      const pending = writeRef.current;
      pending.layers = layers;
      pending.slug = slug;
      if (pending.timer) clearTimeout(pending.timer);
      pending.timer = setTimeout(() => void flushWrite(), WRITE_DEBOUNCE_MS);
    },
    [flushWrite],
  );

  /** Show layers without saving (during a drag). */
  const previewLayers = useCallback((layers: StudioLayers) => {
    setDoc((previous) => (previous ? { ...previous, layers } : previous));
  }, []);

  /** Save layers as one undo step. `base` = the layers before the gesture. */
  const saveProject = useCallback(async (project: StudioProject) => {
    const bridge = bridgeRef.current;
    const current = latest.current.doc;
    if (!bridge || !current) return;
    setDoc({ ...current, project });
    try {
      await bridge.request("studio.project.write", {
        slug: current.slug,
        project,
      });
    } catch (error) {
      toast.error(
        `Couldn't save project settings: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, []);

  const commitLayers = useCallback(
    (layers: StudioLayers, base?: StudioLayers, durationInFrames?: number) => {
      const current = latest.current.doc;
      if (!current?.layers) return;
      const before = base ?? current.layers;
      if (before === layers) return;
      if (
        durationInFrames !== undefined &&
        current.project &&
        durationInFrames !== current.project.durationInFrames
      ) {
        durationsRef.current.set(before, current.project.durationInFrames);
        durationsRef.current.set(layers, durationInFrames);
        void saveProject({ ...current.project, durationInFrames });
      }
      const history = undoRef.current;
      history.past = [...history.past, before].slice(-UNDO_LIMIT);
      history.future = [];
      setHistorySize({ past: history.past.length, future: 0 });
      setDoc((previous) => (previous ? { ...previous, layers } : previous));
      latest.current.doc = { ...current, layers };
      scheduleWrite(current.slug, layers);
    },
    [scheduleWrite, saveProject],
  );

  /** After undo/redo: if that state came with its own project length, put it back. */
  const restoreDuration = useCallback(
    (layers: StudioLayers) => {
      const duration = durationsRef.current.get(layers);
      const project = latest.current.doc?.project;
      if (
        duration === undefined ||
        !project ||
        project.durationInFrames === duration
      )
        return;
      void saveProject({ ...project, durationInFrames: duration });
    },
    [saveProject],
  );

  const undo = useCallback(() => {
    const current = latest.current.doc;
    const history = undoRef.current;
    const previous = history.past[history.past.length - 1];
    if (!current?.layers || !previous) return;
    history.past = history.past.slice(0, -1);
    history.future = [current.layers, ...history.future].slice(0, UNDO_LIMIT);
    setHistorySize({
      past: history.past.length,
      future: history.future.length,
    });
    setDoc({ ...current, layers: previous });
    latest.current.doc = { ...current, layers: previous };
    scheduleWrite(current.slug, previous);
    restoreDuration(previous);
  }, [scheduleWrite, restoreDuration]);

  const redo = useCallback(() => {
    const current = latest.current.doc;
    const history = undoRef.current;
    const next = history.future[0];
    if (!current?.layers || !next) return;
    history.future = history.future.slice(1);
    history.past = [...history.past, current.layers].slice(-UNDO_LIMIT);
    setHistorySize({
      past: history.past.length,
      future: history.future.length,
    });
    setDoc({ ...current, layers: next });
    latest.current.doc = { ...current, layers: next };
    scheduleWrite(current.slug, next);
    restoreDuration(next);
  }, [scheduleWrite, restoreDuration]);

  // ---------------------------------------------------------------------------
  // Chat

  const sendChat = useCallback(
    async (
      text: string,
      extra: {
        attachments?: string[];
        references?: ChatReference[];
        /** The agent to answer (left out for helpers that can't switch). */
        agent?: string;
        /** The agent's model (left out for its default). */
        model?: string;
        /** The agent's thinking level (left out for its default). */
        effort?: string;
        /** The pencil's strokes, described (helpers with the "drawing" feature). */
        drawing?: string;
      } = {},
    ) => {
      const bridge = bridgeRef.current;
      const current = latest.current.doc;
      if (!bridge || !current) return;
      await flushWrite();
      try {
        await bridge.request("studio.chat.send", {
          slug: current.slug,
          text,
          agent: extra.agent,
          ...(extra.model ? { model: extra.model } : {}),
          ...(extra.effort ? { effort: extra.effort } : {}),
          context: {
            variant: latest.current.variant,
            playheadFrame: frameStore.get(),
            fps: current.project?.fps ?? 30,
            selectedClipIds: latest.current.selection,
            attachments: extra.attachments ?? [],
            references: extra.references ?? [],
            ...(extra.drawing ? { drawing: extra.drawing } : {}),
          },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
    [flushWrite, frameStore],
  );

  const queueAction = useCallback(
    async (
      method:
        | "studio.chat.queue.edit"
        | "studio.chat.queue.remove"
        | "studio.chat.queue.now",
      messageId: string,
      text?: string,
    ) => {
      const bridge = bridgeRef.current;
      const current = latest.current.doc;
      if (!bridge || !current) return;
      try {
        await bridge.request(method, { slug: current.slug, messageId, text });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      }
    },
    [],
  );
  const editQueued = useCallback(
    (messageId: string, text: string) =>
      queueAction("studio.chat.queue.edit", messageId, text),
    [queueAction],
  );
  const removeQueued = useCallback(
    (messageId: string) => queueAction("studio.chat.queue.remove", messageId),
    [queueAction],
  );
  const runQueuedNow = useCallback(
    (messageId: string) => queueAction("studio.chat.queue.now", messageId),
    [queueAction],
  );

  const cancelChat = useCallback(async () => {
    const bridge = bridgeRef.current;
    const current = latest.current.doc;
    if (!bridge || !current) return;
    await bridge
      .request("studio.chat.cancel", { slug: current.slug })
      .catch(() => undefined);
  }, []);

  const resetChat = useCallback(async () => {
    const bridge = bridgeRef.current;
    const current = latest.current.doc;
    if (!bridge || !current) return;
    await bridge
      .request("studio.chat.reset", { slug: current.slug })
      .catch(() => undefined);
  }, []);

  // ---------------------------------------------------------------------------
  // Agent tools (the agent's MCP calls that need the page)

  const toolContext = useRef<StudioToolContext | null>(null);
  useLayoutEffect(() => {
    toolContext.current = {
      getDoc: () => latest.current.doc,
      getModule: () => latest.current.loaded,
      getVariant: () => latest.current.variant,
      getSelection: () => latest.current.selection,
      frameStore,
      previewPerf,
      getPlayer: () => playerRef.current,
      setSelection,
      setVariant: setVariantChoice,
      openProject,
      waitForProject,
      syncProject,
      setExportJob,
      bridge: () => bridgeRef.current,
      applyToolLayers: async (layers, base) => {
        const current = latest.current.doc;
        if (!current || current.slug !== base.slug || current.layers !== base.layers || current.projectHash !== base.projectHash || current.layersHash !== base.layersHash)
          throw new Error("The project changed during face analysis. No crop was applied. Retry on the current clip.");
        commitLayers(layers, current.layers!);
        await flushWrite();
        if (writeRef.current.layers || latest.current.doc?.slug !== base.slug || latest.current.doc.layers !== layers)
          throw new Error("The framing could not be confirmed on disk, or the project changed during save. Check the timeline before retrying; Undo can restore the last edit.");
      },
    };
  }, [frameStore, previewPerf, openProject, syncProject, waitForProject, commitLayers, flushWrite]);

  // ---------------------------------------------------------------------------
  // Connection

  useEffect(() => {
    const bridge = new StudioBridge(
      () => {
        const current = latest.current.doc;
        return {
          appVersion: APP_VERSION,
          activeProject: current?.slug ?? null,
          projectName: current?.project?.name ?? null,
          variant: latest.current.variant,
          fps: current?.project?.fps ?? null,
          playheadFrame: frameStore.get(),
          selectedClipIds: latest.current.selection,
        };
      },
      async (method, params) => {
        const context = toolContext.current;
        if (!context) throw new Error("The studio page is still loading.");
        setAgentActivity({ method, at: Date.now() });
        return runStudioTool(method, params, context);
      },
    );
    bridgeRef.current = bridge;
    const offStatus = bridge.onStatus(setStatus);
    const offs = [
      bridge.on("studio.projects", (data) => {
        const list = (data as { projects?: ProjectSummary[] })?.projects;
        if (Array.isArray(list)) setProjects(list);
      }),
      bridge.on("studio.project", (data) => {
        const payload = data as ProjectPayload;
        const current = latest.current.doc;
        if (!current || payload.slug !== current.slug) return;
        if (
          payload.layersHash === current.layersHash &&
          payload.projectHash === current.projectHash
        ) {
          setDoc((previous) =>
            previous
              ? { ...previous, issues: payload.issues, scenes: payload.scenes }
              : previous,
          );
          return;
        }
        const pending = writeRef.current;
        if (
          pending.layers &&
          pending.slug === payload.slug &&
          payload.layersHash !== current.layersHash
        ) {
          // Someone else (the agent) wrote layers.json while a hand edit was queued: disk wins.
          if (pending.timer) clearTimeout(pending.timer);
          pending.timer = null;
          pending.layers = null;
          toast.message(
            "The agent updated the timeline; your last unsaved change was replaced.",
          );
        }
        const next = mergePayload(current, payload);
        // Flash clips that just appeared or changed (the agent's edits).
        if (current.layers && next.layers && next.layers !== current.layers) {
          const before = new Map<string, string>();
          for (const track of current.layers.tracks)
            for (const clip of track.clips)
              before.set(clip.id, JSON.stringify(clip));
          const changed = new Set<string>();
          for (const track of next.layers.tracks) {
            for (const clip of track.clips)
              if (before.get(clip.id) !== JSON.stringify(clip))
                changed.add(clip.id);
          }
          if (changed.size > 0 && changed.size < 200) {
            setFlashClipIds(changed);
            if (flashTimer.current) clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(
              () => setFlashClipIds(new Set()),
              1600,
            );
          }
        }
        latest.current.doc = next;
        setDoc(next);
      }),
      bridge.on("studio.bundle", (data) => {
        const summary = data as BundleSummary;
        if (summary.slug !== latest.current.doc?.slug) return;
        setBundle(summary);
        void loadBundle(summary.slug, summary);
      }),
      bridge.on("studio.assets", (data) => {
        if ((data as { slug?: string })?.slug === latest.current.doc?.slug)
          void refreshAssets();
      }),
      bridge.on("studio.library", () => void refreshAssets()),
      bridge.on("studio.open", (data) => {
        // An agent created a project. Follow it from the project its chat was in; anywhere else the
        // user is working on something of their own, so offer it instead of switching.
        const { slug, from } = data as { slug?: string; from?: string | null };
        if (!slug) return;
        const current = latest.current.doc?.slug;
        if (!current || !from || current === from) {
          void openProject(slug);
          return;
        }
        toast.message(`The agent created the project "${slug}".`, {
          action: { label: "Open", onClick: () => void openProject(slug) },
        });
      }),
      bridge.on("studio.chat", (data) => {
        const record = data as Record<string, unknown>;
        if (record.slug !== latest.current.doc?.slug) return;
        if (record.kind === "reload") {
          // The conversation moved between projects (the agent created a new one mid-turn).
          void bridge
            .request<ChatHistory>("studio.chat.history", { slug: record.slug })
            .then((history) => {
              if (latest.current.doc?.slug === record.slug) setChat(history);
            })
            .catch(() => undefined);
          return;
        }
        setChat((previous) => applyChatEvent(previous, record));
      }),
      bridge.on("studio.render", (data) => {
        const record = data as {
          slug: string;
          variant: string;
          stage?: string;
          progress?: number;
          message?: string;
          path?: string;
        };
        setExportJob({
          slug: record.slug,
          variant: record.variant,
          stage: (record.stage as ExportJob["stage"]) ?? "rendering",
          progress: record.progress ?? 0,
          message: record.message,
          path: record.path,
          where: "local",
        });
      }),
    ];
    bridge.connect();
    return () => {
      offStatus();
      for (const off of offs) off();
      // Client-side navigation does not fire beforeunload. Finish the save
      // before closing the socket, including a save already in progress.
      void flushWrite().finally(() => {
        bridge.close();
        if (bridgeRef.current === bridge) bridgeRef.current = null;
      });
    };
  }, [flushWrite, frameStore, loadBundle, openProject, refreshAssets]);

  // On connect: load info, then the last project.
  useEffect(() => {
    if (status !== "connected") return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await bridge.request<StudioInfo>("studio.info");
        if (cancelled) return;
        setInfo(result);
        setProjects(result.projects);
        const current = latest.current.doc?.slug;
        const wanted = current ?? readLastProject();
        const target =
          result.projects.find((project) => project.slug === wanted)?.slug ??
          result.projects[0]?.slug ??
          null;
        if (target) await openProject(target);
      } catch (error) {
        if (!cancelled)
          toast.error(error instanceof Error ? error.message : String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, openProject]);

  // Keep the bridge's session (active project, variant, selection) current.
  const slug = doc?.slug ?? null;
  const projectName = doc?.project?.name ?? null;
  useEffect(() => {
    if (status !== "connected") return;
    const timer = setTimeout(() => bridgeRef.current?.sendHello(), 150);
    return () => clearTimeout(timer);
  }, [status, slug, projectName, variant, selection]);

  // Save pending edits before the tab closes.
  useEffect(() => {
    const onUnload = (event: BeforeUnloadEvent) => {
      if (writeRef.current.layers || writing.current) {
        event.preventDefault();
        event.returnValue = "";
        void flushWrite();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flushWrite]);

  const reconnect = useCallback(() => bridgeRef.current?.connect(), []);
  const getBridge = useCallback(() => bridgeRef.current, []);
  const getDoc = useCallback(() => latest.current.doc, []);

  return {
    frameStore,
    playerRef,
    getBridge,
    getDoc,
    status,
    info,
    projects,
    doc,
    opening,
    bundle,
    loaded,
    moduleError,
    assets,
    library,
    chat,
    variant,
    setVariant: setVariantChoice,
    selection,
    setSelection,
    exportJob,
    setExportJob,
    canUndo: historySize.past > 0,
    canRedo: historySize.future > 0,
    agentActivity,
    flashClipIds,
    toolContext,
    previewPerf,
    openProject,
    syncProject,
    previewRequest,
    declinePreviewRequest,
    createProject,
    deleteProject,
    refreshAssets,
    previewLayers,
    commitLayers,
    undo,
    redo,
    saveProject,
    sendChat,
    editQueued,
    removeQueued,
    runQueuedNow,
    cancelChat,
    resetChat,
    reconnect,
    flushWrite,
  };
}

export type StudioController = ReturnType<typeof useStudioController>;
