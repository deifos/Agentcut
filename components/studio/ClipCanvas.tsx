"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  useReactFlow,
  type ReactFlowInstance,
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Clapperboard, Film, Plus, Play, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { StudioBridge } from "@/lib/studio/bridge";
import { studioFileUrl } from "@/lib/studio/file-url";
import { sceneStill } from "@/lib/studio/scene-stills";
import { buildInputProps } from "@/lib/studio/composition-props";
import type { TimelineThumbSource } from "./timeline-thumbs";
import type { StudioLayers, AssetEntry } from "@/lib/studio/types";
import { videoPoster } from "@/lib/studio/video-poster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { confirmDestructive } from "./ConfirmHost";
import Image from "next/image";

const CARD_POSTER_EDGE = 1024;

interface Source {
  recording?: boolean;
  id: string;
  project: string;
  path: string;
  name: string;
}
interface Poster {
  project: string;
  path: string;
  seconds: number;
}
interface FrameSize {
  width: number;
  height: number;
}
interface Cut {
  size?: FrameSize;
  slug: string;
  clip: string;
  title: string;
  version: string;
  sourceOnly?: boolean;
  seconds: number;
  sources: string[];
  poster?: Poster;
}
interface Canvas {
  group: string;
  cuts: Cut[];
  sources: Source[];
}
type Card = Node<
  {
    title: string;
    source?: boolean;
    hide?: () => void;
    remove?: (all: boolean) => void;
    ratio?: number;
    active?: boolean;
    still?: string;
    poster?: Poster;
    duration?: number;
    versions?: Cut[];
    current?: string;
    open?: (slug: string) => void;
    preview?: (bounds: DOMRect) => void;
  },
  "card"
>;

function Thumb({ poster }: { poster?: Poster }) {
  const [picture, setPicture] = useState("");
  const url = poster && studioFileUrl(poster.project, poster.path);
  const seconds = poster?.seconds ?? 0;
  useEffect(() => {
    let live = true;
    if (url)
      void videoPoster(url, seconds, CARD_POSTER_EDGE)
        .then((image) => {
          if (live) setPicture(image);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [url, seconds]);
  return picture ? (
    <Image
      alt=""
      draggable={false}
      unoptimized
      width={160}
      height={90}
      src={picture}
      className="size-full object-cover"
    />
  ) : (
    <Film className="size-7 opacity-50" />
  );
}

function CanvasCard({ data }: NodeProps<Card>) {
  const seconds = Math.round(data.duration ?? 0);
  const ratio = data.ratio ?? 16 / 9;
  return (
    <div
      style={{ width: Math.min(192, 148 * ratio + 10) }}
      className={`overflow-hidden rounded-xl border bg-background p-1 shadow-sm ${data.active ? "ring-2 ring-violet-500" : "border-border"}`}
    >
      <Handle
        type={data.source ? "source" : "target"}
        position={data.source ? Position.Right : Position.Left}
        isConnectable={false}
      />
      <div
        style={{ aspectRatio: ratio }}
        className="relative flex items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground"
      >
        {data.still ? <Image draggable={false} alt="" width={160} height={90} unoptimized src={data.still} className="size-full object-cover" /> :
          <Thumb key={JSON.stringify(data.poster)} poster={data.poster} />}
        {data.source ? (
          <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 text-[10px] font-semibold">
            Source
          </span>
        ) : (
          <>
            <button
              type="button"
              aria-label={`Preview ${data.title}`}
              onClick={(event) => {
                event.stopPropagation();
                data.preview?.(event.currentTarget.parentElement!.getBoundingClientRect());
              }}
              className="nodrag absolute bottom-2 left-2 grid size-6 place-items-center rounded-full bg-black/75 text-white"
            >
              <Play className="size-3 fill-current" />
            </button>
            <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1 text-[11px] text-white">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 pl-1.5">
        <span
          className="min-w-0 flex-1 truncate text-xs font-semibold"
          title={data.title}
        >
          {data.title}
        </span>
        <div className="nodrag nopan" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Actions for ${data.title}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {data.source ? (
                  <DropdownMenuItem onSelect={data.hide}>
                    Hide source from canvas
                  </DropdownMenuItem>
                ) : (
                  <>
                    {(data.versions?.length ?? 0) > 1 && (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => data.remove?.(false)}
                      >
                        Delete this version
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => data.remove?.(true)}
                    >
                      Delete clip
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {data.versions && data.versions.length > 1 && (
        <div className="nodrag nopan" onClick={(e) => e.stopPropagation()}>
          <Select value={data.current} onValueChange={data.open}>
            <SelectTrigger
              size="sm"
              className="w-full"
              aria-label={`Version of ${data.title}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {data.versions.map((v) => (
                  <SelectItem key={v.slug} value={v.slug}>
                    {v.version}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
// Position changes move the wrapper. The card contents depend only on its data.
const nodeTypes = { card: memo(CanvasCard, (previous, next) => previous.data === next.data) };

type Props = {
  activeSize?: FrameSize;
  slug: string;
  bridge: StudioBridge;
  revision: unknown;
  assets: AssetEntry[];
  thumbSource: TimelineThumbSource | null;
  layers?: StudioLayers | null;
  layersHash: string | null;
  open: (slug: string) => Promise<void>;
  preview: (slug: string, bounds: DOMRect) => void;
  flush: () => Promise<void>;
  deleteCut: (slug: string, next?: string) => Promise<boolean>;
  upload: (files: File[]) => Promise<void>;
  getActive: () => string | undefined;
};

export default function ClipCanvas(props: Props) {
  const { slug, bridge, revision, assets, layersHash } = props;
  const [result, setResult] = useState<{ slug: string; board: Canvas } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    bridge
      .request<Canvas>("studio.canvas.read", { project: slug })
      .then((board) => {
        if (live) {
          setResult({ slug, board });
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, [slug, bridge, revision, assets, layersHash, retry]);
  useEffect(() => {
    const siblings = new Set(result?.board.cuts.map((cut) => cut.slug));
    siblings.delete(slug);
    const changed = (event: unknown) => {
      if (siblings.has((event as { slug: string }).slug))
        setRetry((value) => value + 1);
    };
    const offLayers = bridge.on("studio.project", changed);
    const offAssets = bridge.on("studio.assets", changed);
    return () => {
      offLayers();
      offAssets();
    };
  }, [result, slug, bridge]);
  if (error)
    return (
      <div className="p-4 text-sm">
        {error} <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
      </div>
    );
  if (!result)
    return (
      <div className="p-4 text-xs text-muted-foreground">Loading canvas…</div>
    );
  if (result.slug !== slug && !result.board.cuts.some((c) => c.slug === slug))
    return null;
  return <Board key={result.board.group} {...props} board={result.board} />;
}

function Board({
  board,
  assets,
  thumbSource,
  layers,
  activeSize,
  slug,
  bridge,
  open,
  preview,
  flush,
  deleteCut,
  upload,
  getActive,
}: Props & { board: Canvas }) {
  const key = "agentcut.canvas.positions." + board.group;
  const [positions] = useState<Record<string, XYPosition>>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}") ?? {};
    } catch {
      return {};
    }
  });
  const [draft, setDraft] = useState<{
    slug: string;
    kind: "clip" | "version";
  } | null>(null);
  const form = draft?.slug === slug ? draft.kind : null;
  const [lastVersions, setLastVersions] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [stills, setStills] = useState<Record<string, string>>({});
  const project = thumbSource?.project;
  const variant = thumbSource?.variant;
  const loaded = thumbSource?.loaded;
  useEffect(() => {
    if (!project || !variant || !layers || loaded?.slug !== slug || !loaded) return;
    const visual = layers.tracks.filter(track => !track.hidden && ["scene", "image", "video", "text"].includes(track.kind))
      .flatMap(track => track.clips).sort((a,b) => a.from - b.from)[0];
    if (!visual) return;
    const controller = new AbortController();
    const frame = Math.min(project.durationInFrames - 1, visual.from + Math.min(Math.floor(visual.duration / 2), project.fps));
    void sceneStill(loaded, buildInputProps(slug, project, layers, variant), frame, controller.signal, CARD_POSTER_EDGE).then(src => {
      if (src && !controller.signal.aborted) setStills(previous => ({ ...previous, [slug]: src }));
    });
    return () => controller.abort();
  }, [slug, project, variant, layers, loaded]);
  const render = assets.filter(file => file.kind === "video" && file.path.startsWith("renders/"))
    .sort((a,b) => b.updatedAt - a.updatedAt)[0];
  const groups = new Map<string, Cut[]>();
  for (const cut of board.cuts) {
    if (
      cut.sourceOnly &&
      !board.cuts.some(
        (other) => other.clip === cut.clip && other.slug !== cut.slug,
      )
    )
      continue;
    groups.set(cut.clip, [...(groups.get(cut.clip) ?? []), cut]);
  }
  const hiddenKey = key + ".hiddenSources";
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(hiddenKey) ?? "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  function hideSources(ids: string[]) {
    setHidden(ids);
    try {
      localStorage.setItem(hiddenKey, JSON.stringify(ids));
    } catch {}
  }
  async function remove(cut: Cut, targets: Cut[], wholeClip: boolean) {
    const label = wholeClip ? "Delete clip" : "Delete version";
    const title = wholeClip ? cut.title : cut.title + " · " + cut.version;
    const confirmed = await confirmDestructive({
      title: `${label} “${title}”?`,
      description: `Permanently deletes ${targets.length > 1 ? "all " + targets.length + " versions and their" : "this edit and its"} project files, local assets, chat, and exports.`,
      action: label,
    });
    if (!confirmed || getActive() !== slug) return;
    const ids = new Set(targets.map((target) => target.slug));
    const survivors = board.cuts.filter((c) => !ids.has(c.slug));
    const next = survivors.find((c) => c.clip === cut.clip) ?? survivors[0];
    // Delete the active edit last so navigation can stay on this canvas.
    for (const target of [...targets].sort(
      (a, b) => Number(a.slug === getActive()) - Number(b.slug === getActive()),
    )) {
      if (!(await deleteCut(target.slug, next?.slug))) break;
    }
  }
  // The helper also indexes timeline assets for the agent. Only source recordings
  // and independent edits belong on the board once the workspace contains a video.
  const recordings = board.sources.filter(source =>
    groups.size === 0 || source.recording || source.path.startsWith("assets/canvas-sources/") ||
    source.path.startsWith("library:canvas/")
  );
  const visibleSources = recordings.filter(source => !hidden.includes(source.id));
  const visibleIds = new Set(visibleSources.map(source => source.id));
  const nodes: Card[] = visibleSources
    .map((s, index) => ({
      id: "src:" + s.id,
      type: "card",
      position: { x: 0, y: index * 180 },
      data: {
        title: s.name,
        source: true,
        hide: () => hideSources([...hidden, s.id]),
        poster: /\.(mp4|mov|webm|m4v)$/i.test(s.path)
          ? { ...s, seconds: 0.1 }
          : undefined,
      },
    }));
  const edges = [];
  for (const [index, [clip, versions]] of [...groups].entries()) {
    const cut =
      versions.find((v) => v.slug === slug) ??
      versions.find((v) => v.slug === lastVersions[clip]) ??
      versions[0];
    const size = cut.slug === slug ? (activeSize ?? cut.size) : cut.size;
    nodes.push({
      id: clip,
      type: "card",
      position: {
        x: (visibleSources.length ? 270 : 0) + (index % 3) * 220,
        y: Math.floor(index / 3) * 225,
      },
      ariaLabel: cut.title,
      data: {
        title: cut.title,
        ratio: size && size.width / size.height,
        duration: cut.seconds,
        still: stills[cut.slug],
        poster: cut.poster ?? (cut.slug === slug && render ? { project: slug, path: render.path, seconds: 1 } : undefined),
        active: cut.slug === slug,
        versions,
        remove: (all) => void remove(cut, all ? versions : [cut], all),
        current: cut.slug,
        open: (next) => {
          setLastVersions((old) => ({ ...old, [clip]: next }));
          void open(next);
        },
        preview: async (bounds) => {
          if (getActive() !== cut.slug) await open(cut.slug);
          if (getActive() === cut.slug) preview(cut.slug, bounds);
        },
      },
    });
    if (cut.slug !== slug) continue;
    for (const source of cut.sources.filter((id) => visibleIds.has(id)))
      edges.push({
        id: JSON.stringify([source, clip]),
        source: "src:" + source,
        target: clip,
        style: { stroke: "#9678d4" },
      });
  }
  for (const n of nodes) n.position = positions[n.id] ?? n.position;
  const active = board.cuts.find((c) => c.slug === slug);
  const usedSources = visibleSources
    .filter((source) => active?.sources.includes(source.id))
    .map((source) => source.name)
    .join(", ");
  const editing = active && [active.title, active.version].join(" · ");
  async function create() {
    if (!form || !name.trim() || gate.current) return;
    gate.current = true;
    setBusy(true);
    try {
      await flush();
      const cut = await bridge.request<{ slug: string }>(
        "studio.canvas.create",
        { project: slug, kind: form, name: name.trim() },
        600_000,
      );
      if (form === "version" && active)
        setLastVersions((old) => ({ ...old, [active.clip]: cut.slug }));
      if (getActive() === slug) await open(cut.slug);
      setDraft(null);
    } catch (e) {
      toast.error(String(e));
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Clip canvas"
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        void upload(Array.from(e.dataTransfer.files)).catch((e) =>
          toast.error(String(e)),
        );
      }}
    >
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs">
        <span className="mr-auto flex items-center gap-1.5">
          <Clapperboard className="size-4" />
          {groups.size} {groups.size === 1 ? "clip" : "clips"}
        </span>
        {recordings.some(source => hidden.includes(source.id)) && (
          <Button size="sm" variant="ghost" onClick={() => hideSources([])}>
            Show hidden sources
          </Button>
        )}
        {(["clip", "version"] as const)
          .filter((kind) => kind === "clip" || !active?.sourceOnly)
          .map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft({ slug, kind });
                setName("");
              }}
            >
              <Plus data-icon="inline-start" />
              {kind === "clip" ? "New clip" : "New version"}
            </Button>
          ))}
      </div>
      <Dialog
        open={Boolean(form)}
        onOpenChange={(open) => {
          if (!open && !busy) setDraft(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form === "clip" ? "New clip" : "New version"}
            </DialogTitle>
            <DialogDescription>
              {form === "clip"
                ? "Create a separate card with an empty timeline. Add footage yourself or ask the agent to build the clip."
                : `Copy the current edit of “${active?.title}”. Switch between edits with the version menu on its card.`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="canvas-cut-name">
                {form === "clip" ? "Clip title" : "Version name"}
              </Label>
              <Input
                id="canvas-cut-name"
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy
                  ? "Creating…"
                  : form === "clip"
                    ? "Create clip"
                    : "Create version"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <div className="min-h-0 flex-1">
        <CardGraph
          definitions={nodes}
          edges={edges}
          storageKey={key}
          slug={slug}
          open={open}
        />
      </div>
      <div className="truncate border-t px-3 py-1.5 text-xs">
        {active?.sourceOnly ? (
          groups.size ? (
            "Select a clip to edit its timeline."
          ) : (
            "Drop a recording here, then ask the agent for clips."
          )
        ) : (
          <>
            Editing <strong>{editing}</strong>
            {usedSources && (
              <span title={usedSources}> · Uses {usedSources}</span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function CardGraph({
  definitions,
  edges,
  storageKey,
  slug,
  open,
}: {
  definitions: Card[];
  edges: Edge[];
  storageKey: string;
  slug: string;
  open: Props["open"];
}) {
  const [initialNodes] = useState(definitions);
  const flow = useRef<ReactFlowInstance<Card, Edge> | null>(null);
  return (
    <ReactFlow
      className="studio-clip-flow"
      defaultNodes={initialNodes}
      onInit={instance => { flow.current = instance; }}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.16, maxZoom: 1.2 }}
      minZoom={0.1}
      nodesConnectable={false}
      deleteKeyCode={null}
      onNodeClick={(_, n) => {
        if (n.data.current && n.data.current !== slug)
          void open(n.data.current);
      }}
      onNodeDragStop={(_, node, moved) => {
        try {
          const saved = Object.fromEntries(
            (flow.current?.getNodes() ?? []).map(card => [card.id, card.position]),
          );
          for (const card of moved) saved[card.id] = card.position;
          saved[node.id] = node.position;
          localStorage.setItem(storageKey, JSON.stringify(saved));
        } catch {}
      }}
    >
      <SyncCardDefinitions definitions={definitions} />
      <Background gap={16} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

// React Flow owns live positions. Update the graph only when the workspace data changes.
function SyncCardDefinitions({ definitions }: { definitions: Card[] }) {
  const { setNodes } = useReactFlow<Card, Edge>();
  const previous = useRef(definitions);
  useEffect(() => {
    if (previous.current === definitions) return;
    previous.current = definitions;
    setNodes(current => {
      const byId = new Map(current.map(node => [node.id, node]));
      return definitions.map(definition => {
        const existing = byId.get(definition.id);
        return existing ? { ...existing, ...definition, position: existing.position } : definition;
      });
    });
  }, [definitions, setNodes]);
  return null;
}
