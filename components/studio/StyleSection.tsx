"use client";

import { Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentName } from "@/components/studio/StudioAgent";
import { getMotionStyle, styledPropKeys } from "@/motion/components";
import type {
  CaptionsClip,
  SceneClip,
  StudioLayers,
  StudioProject,
  TextClip,
} from "@/lib/studio/types";

const CAPTION_KEYS = ["fontFamily", "fontWeight", "color", "highlight", "preset"] as const;
const TEXT_KEYS = ["fontFamily", "fontWeight", "color"] as const;

function omit<T extends object>(value: T | undefined, keys: readonly string[]) {
  if (!value) return { value, dropped: 0 };
  const next = { ...value } as Record<string, unknown>;
  let dropped = 0;
  for (const key of keys) {
    if (key in next) {
      delete next[key];
      dropped += 1;
    }
  }
  return { value: next as T, dropped };
}

/** The layers with every clip's own look (colors, fonts) dropped so it follows the style, and how many clips changed. */
function followStyle(layers: StudioLayers) {
  let changed = 0;
  const tracks = layers.tracks.map((track) => {
    const clips = track.clips.map((clip) => {
      if (track.kind === "scene") {
        const scene = clip as SceneClip;
        if (!scene.component) return clip;
        const { value, dropped } = omit(scene.props, styledPropKeys(scene.component));
        if (!dropped) return clip;
        changed += 1;
        return { ...scene, props: value };
      }
      if (track.kind === "captions" || track.kind === "text") {
        const styled = clip as CaptionsClip | TextClip;
        const { value, dropped } = omit(
          styled.style as Record<string, unknown> | undefined,
          track.kind === "captions" ? CAPTION_KEYS : TEXT_KEYS,
        );
        if (!dropped) return clip;
        changed += 1;
        return { ...styled, style: value };
      }
      return clip;
    });
    return { ...track, clips } as typeof track;
  });
  return { layers: { ...layers, tracks }, changed };
}

/** The project's style in the Project panel: what it is, restyle, and the gallery to change it. */
export function StyleSection({
  project,
  layers,
  supported,
  readOnly,
  onSaveProject,
  onCommit,
  onAskText,
  chatDisabled,
  onBrowse,
}: {
  project: StudioProject;
  layers: StudioLayers | null;
  /** The helper validates project.json; older ones reject a style. */
  supported: boolean;
  readOnly: boolean;
  onSaveProject(project: StudioProject): void;
  onCommit(layers: StudioLayers): void;
  onAskText(text: string): Promise<void>;
  chatDisabled: boolean;
  /** Open the style gallery. */
  onBrowse(): void;
}) {
  const agentName = useAgentName();
  const current = getMotionStyle(project.style);
  const pending = current && layers ? followStyle(layers) : null;

  if (!supported) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Update the Agentcut helper to pick a style for this project.
        </p>
        <Button type="button" variant="outline" size="xs" onClick={onBrowse} className="h-7 w-full gap-1.5 text-[11px]">
          <Palette className="size-3.5" />
          Browse styles
        </Button>
      </div>
    );
  }

  const choose = (id: string | null) => {
    const next = { ...project };
    if (id) next.style = id;
    else delete next.style;
    onSaveProject(next);
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        disabled={readOnly}
        onClick={onBrowse}
        className="flex w-full items-center gap-2.5 rounded-md border border-border/70 px-2.5 py-2 text-left hover:bg-muted/50 disabled:opacity-50"
      >
        {current ? (
          <span className="flex shrink-0 -space-x-1">
            {[current.tokens.backdrop, current.tokens.accent, current.tokens.line].map((color, i) => (
              <span key={i} className="size-4 rounded-full border border-border" style={{ background: color }} />
            ))}
          </span>
        ) : (
          <Palette className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold">{current?.name ?? "No style"}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {current ? "Browse styles to switch" : "Browse styles: see them live on a talking head"}
          </span>
        </span>
      </button>
      {current ? (
        <div className="space-y-2">
          <p className="text-[11px] leading-snug text-muted-foreground">{current.description}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-muted-foreground">
            {current.guide.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <Button
            type="button"
            size="xs"
            disabled={readOnly || chatDisabled}
            onClick={() =>
              void onAskText(
                `Use the ${current.name} style for this video: restyle the edit (graphics, positions, captions, camera) following STYLES.md.`,
              )
            }
            className="h-7 w-full gap-1.5 text-[11px]"
          >
            <Sparkles className="size-3.5" />
            Restyle the edit with {agentName}
          </Button>
          {pending && pending.changed > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={readOnly}
              onClick={() => onCommit(pending.layers)}
              className="h-7 w-full text-[11px]"
            >
              Make {pending.changed} {pending.changed === 1 ? "clip" : "clips"} with their own colors follow {current.name}
            </Button>
          ) : null}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => choose(null)}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Remove the style
          </button>
        </div>
      ) : null}
    </div>
  );
}
