"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { studioFileUrl } from "@/lib/studio/file-url";
import { sceneStill } from "@/lib/studio/scene-stills";
import { buildInputProps } from "@/lib/studio/composition-props";
import { videoPoster } from "@/lib/studio/video-poster";
import type { CanvasExportCut, ExportVideo } from "@/lib/studio/canvas-export";
import type { LoadedModule } from "@/lib/studio/types";

export function exportDuration(video?: ExportVideo) {
  const project = video?.doc.project;
  if (
    !project ||
    !Number.isFinite(project.durationInFrames) ||
    !Number.isFinite(project.fps) ||
    project.fps <= 0
  )
    return null;
  const seconds = Math.ceil(project.durationInFrames / project.fps);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Reuse the current composition or an existing cover/frame; never start a video export. */
export function ExportVideoThumbnail({
  video,
  poster,
  loaded,
  variant,
  frame,
  paused,
}: {
  video?: ExportVideo;
  poster?: CanvasExportCut["poster"];
  loaded: LoadedModule | null;
  variant: string;
  frame: number;
  paused: boolean;
}) {
  const [picture, setPicture] = useState<{
    key: string;
    src: string;
    label: string;
  } | null>(null);
  const [failed, setFailed] = useState("");
  const key = JSON.stringify([
    video?.slug,
    video?.doc.projectHash,
    video?.doc.layersHash,
    video?.bundle.revision,
    variant,
    frame,
    poster,
  ]);
  const cover = video?.assets
    .filter((asset) => /^renders\/.*-cover\.(?:png|jpe?g)$/i.test(asset.path))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const savedCover =
    video && cover ? studioFileUrl(video.slug, cover.path) : "";
  useEffect(() => {
    if (!video || paused || video.editing || video.queued) return;
    let live = true;
    const controller = new AbortController();
    void (async () => {
      const { project, layers } = video.doc;
      if (
        loaded?.slug === video.slug &&
        loaded.revision === video.bundle.revision &&
        project &&
        layers
      ) {
        const chosen = project.variants[variant]
          ? variant
          : project.defaultVariant;
        const still = await sceneStill(
          loaded,
          buildInputProps(video.slug, project, layers, chosen),
          Math.max(0, Math.min(frame, project.durationInFrames - 1)),
          controller.signal,
          320,
        );
        if (still && live) {
          setPicture({ key, src: still, label: "Current video preview" });
          return;
        }
      }
      if (!live || (savedCover && failed !== savedCover)) return;
      const latest = video.assets
        .filter(
          (asset) =>
            asset.path.startsWith("renders/") && asset.kind === "video",
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (latest) {
        const url = studioFileUrl(video.slug, latest.path);
        const src = await videoPoster(url, 1, 320).catch(() => null);
        if (!live) return;
        if (src) {
          setPicture({ key, src, label: "Saved export preview" });
          return;
        }
        if (poster?.project === video.slug && poster.path === latest.path && poster.seconds === 1) return;
      }
      if (!poster) return;
      const url = studioFileUrl(poster.project, poster.path);
      const image = /\.(?:png|jpe?g|webp)$/i.test(poster.path)
        ? url
        : await videoPoster(url, poster.seconds ?? 0, 320);
      if (live)
        setPicture({
          key,
          src: image,
          label: "Source frame preview",
        });
    })().catch(() => undefined);
    return () => {
      live = false;
      controller.abort();
    };
  }, [key, video, loaded, variant, frame, paused, savedCover, poster, failed]);
  const src = picture?.key === key ? picture.src : savedCover;
  const label = picture?.key === key ? picture.label : "Saved export preview";
  const duration = exportDuration(video);
  return (
    <span
      className="relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted sm:w-28"
      data-export-thumbnail={video?.slug}
    >
      {src && failed !== src ? (
        <Image
          unoptimized
          src={src}
          alt={`${video?.name ?? "Video"} preview`}
          title={label}
          width={320}
          height={180}
          className="size-full object-contain"
          onError={() => setFailed(src)}
        />
      ) : (
        <Film
          aria-label="Preview unavailable"
          className="size-6 text-muted-foreground"
        />
      )}
      {duration ? (
        <Badge
          variant="secondary"
          className="absolute right-1 bottom-1 px-1 py-0 text-[10px] tabular-nums"
        >
          {duration}
        </Badge>
      ) : null}
    </span>
  );
}
