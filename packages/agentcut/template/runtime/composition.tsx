// StudioComposition: draws a project's layers.json with Remotion.
// Tracks are drawn bottom → top (tracks[0] is the top layer) so stacking never
// depends on z-index, which the browser export ignores.
import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useRemotionEnvironment,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
// The Agentcut component library, provided by the studio page (and by a copy in
// .agentcut/components for local renders).
import * as ComponentLibrary from "agentcut/components";
import { MOTION_COMPONENTS, resolveComponentProps } from "agentcut/components";

// Project styles (project.json "style") come from the library too. Pages from before styles don't
// provide them: the project then renders as if it had none.
type LibraryStyle = { captions: CaptionsClip["style"]; text: TextClip["style"] };
function projectStyle(id: string | undefined): LibraryStyle | null {
  const get = (ComponentLibrary as { getMotionStyle?: (id?: string) => LibraryStyle | null }).getMotionStyle;
  return id && typeof get === "function" ? get(id) : null;
}

type StyleLayer = {
  styleCamera?: (
    id: string | undefined,
    at: { frame: number; durationInFrames: number; width: number; height: number },
  ) => CSSProperties | null;
  StyleOverlay?: ComponentType<{ styleId: string | undefined }>;
  StyledCaptions?: ComponentType<{
    styleId: string | undefined;
    words: CaptionsClip["words"];
    position?: string;
    wordsPerLine?: number;
    fontSize?: number;
  }>;
};
const styleLayer = ComponentLibrary as StyleLayer;

/** Loads the library's fonts (the style's caption and text fonts) and holds the render until they're in. */
function StyleFonts() {
  const use = (ComponentLibrary as { useMotionFonts?: () => void }).useMotionFonts;
  use?.();
  return null;
}
import {
  StudioRuntimeContext,
  asset,
  clamp,
  setRuntimeState,
  type StudioRuntimeContextValue,
} from "./helpers";
import type {
  AudioClip,
  Box,
  CaptionsClip,
  ClipAnim,
  ImageClip,
  SceneClip,
  SceneProps,
  StudioClip,
  StudioCompositionProps,
  StudioFont,
  StudioTrack,
  TextClip,
  CursorTrack,
  VideoClip,
  VideoCursor,
} from "./types";

export type SceneRegistry = Record<string, ComponentType<SceneProps & Record<string, unknown>>>;

// ---------------------------------------------------------------------------
// Fonts

const loadedFontSpecs = new Map<string, Promise<void>>();

function fontSpecToCss(spec: string) {
  // "Inter:400;700;900" → family=Inter:wght@400;700;900 ; "Inter" → family=Inter
  const [family, weights] = spec.split(":");
  const name = family.trim().replace(/\s+/g, "+");
  return weights ? `family=${name}:wght@${weights.trim()}` : `family=${name}`;
}

function loadLocalFont(font: Exclude<StudioFont, string>): Promise<void> {
  const key = `${font.family}|${font.src}|${font.weight ?? ""}|${font.style ?? ""}`;
  const existing = loadedFontSpecs.get(key);
  if (existing) return existing;
  const promise = (async () => {
    if (typeof document === "undefined") return;
    const face = new FontFace(font.family, `url(${JSON.stringify(asset(font.src))})`, {
      weight: font.weight ?? "400",
      style: font.style ?? "normal",
    });
    try {
      document.fonts.add(await face.load());
    } catch {
      // Missing font file: keep rendering with the fallback font.
    }
  })();
  loadedFontSpecs.set(key, promise);
  return promise;
}

function loadFont(font: StudioFont): Promise<void> {
  return typeof font === "string" ? loadFontSpec(font) : loadLocalFont(font);
}

function loadFontSpec(spec: string): Promise<void> {
  const existing = loadedFontSpecs.get(spec);
  if (existing) return existing;
  const promise = (async () => {
    if (typeof document === "undefined") return;
    const href = `https://fonts.googleapis.com/css2?${fontSpecToCss(spec)}&display=block`;
    if (!document.querySelector(`link[data-studio-font="${CSS.escape(spec)}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.crossOrigin = "anonymous";
      link.dataset.studioFont = spec;
      await new Promise<void>((resolve) => {
        link.onload = () => resolve();
        link.onerror = () => resolve();
        document.head.appendChild(link);
      });
    }
    const [family, weights] = spec.split(":");
    const list = weights ? weights.split(";").map((w) => w.trim()) : ["400"];
    await Promise.all(
      list.map((weight) =>
        document.fonts.load(`${weight} 32px "${family.trim()}"`).catch(() => undefined),
      ),
    );
  })();
  loadedFontSpecs.set(spec, promise);
  return promise;
}

function useProjectFonts(fonts: StudioFont[]) {
  const key = fonts.map((font) => (typeof font === "string" ? font : `${font.family}|${font.src}|${font.weight ?? ""}`)).join("||");
  const [handle] = useState(() =>
    fonts.length > 0 ? delayRender(`Loading fonts ${key}`, { timeoutInMilliseconds: 20_000 }) : null,
  );
  useEffect(() => {
    if (handle === null) return;
    let cancelled = false;
    Promise.all(fonts.map(loadFont)).finally(() => {
      if (!cancelled) continueRender(handle);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, key]);
}

// ---------------------------------------------------------------------------
// Clip helpers

export function resolveClip<T extends StudioClip>(clip: T, variant: string): T {
  const override = (clip as { variants?: Record<string, Partial<T>> }).variants?.[variant];
  return override ? ({ ...clip, ...override } as T) : clip;
}

function animState(anim: ClipAnim | undefined, t: number) {
  // t: 0 = fully hidden, 1 = fully shown
  const preset = anim?.preset ?? "none";
  const out: { opacity: number; transform: string; filter?: string } = { opacity: 1, transform: "" };
  if (preset === "none" || t >= 1) return out;
  const inv = 1 - t;
  switch (preset) {
    case "fade":
      out.opacity = t;
      break;
    case "slide-up":
      out.opacity = t;
      out.transform = `translateY(${inv * 8}%)`;
      break;
    case "slide-down":
      out.opacity = t;
      out.transform = `translateY(${-inv * 8}%)`;
      break;
    case "slide-left":
      out.opacity = t;
      out.transform = `translateX(${inv * 8}%)`;
      break;
    case "slide-right":
      out.opacity = t;
      out.transform = `translateX(${-inv * 8}%)`;
      break;
    case "pop": {
      // overshoot: 0 → 1.08 → 1
      const s = t < 0.7 ? interpolate(t, [0, 0.7], [0.6, 1.08]) : interpolate(t, [0.7, 1], [1.08, 1]);
      out.opacity = Math.min(1, t * 2);
      out.transform = `scale(${s})`;
      break;
    }
    case "scale":
      out.opacity = t;
      out.transform = `scale(${0.85 + 0.15 * t})`;
      break;
    case "blur":
      out.opacity = t;
      out.filter = `blur(${inv * 16}px)`;
      break;
  }
  return out;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Enter/exit + opacity wrapper for one visual clip; frame is local to the clip. */
function useClipStyle(clip: StudioClip): CSSProperties {
  const frame = useCurrentFrame();
  const enterFrames = clip.enter && clip.enter.preset !== "none" ? Math.max(1, clip.enter.frames) : 0;
  const exitFrames = clip.exit && clip.exit.preset !== "none" ? Math.max(1, clip.exit.frames) : 0;
  const tIn = enterFrames ? easeOutCubic(interpolate(frame, [0, enterFrames], [0, 1], clamp)) : 1;
  const tOut = exitFrames
    ? easeOutCubic(interpolate(frame, [clip.duration - exitFrames, clip.duration], [1, 0], clamp))
    : 1;
  const a = animState(clip.enter, tIn);
  const b = animState(clip.exit, tOut);
  const transform = [a.transform, b.transform].filter(Boolean).join(" ");
  const filter = [a.filter, b.filter].filter(Boolean).join(" ");
  return {
    opacity: a.opacity * b.opacity * (clip.opacity ?? 1),
    transform: transform || undefined,
    filter: filter || undefined,
  };
}

function boxStyle(box: Box | undefined): CSSProperties {
  if (!box) return { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" };
  return {
    position: "absolute",
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}

// ---------------------------------------------------------------------------
// Clip renderers (all frames local to the clip's <Sequence>)

function SceneClipView({
  clip,
  scenes,
  ctx,
}: {
  clip: SceneClip;
  scenes: SceneRegistry;
  ctx: StudioRuntimeContextValue;
}) {
  const style = useClipStyle(clip);
  if (clip.component) {
    const entry = MOTION_COMPONENTS[clip.component];
    if (!entry) {
      return (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(220,38,38,0.25)",
            color: "#fff",
            fontFamily: "sans-serif",
            fontSize: Math.round(ctx.height * 0.03),
          }}
        >
          Unknown component “{clip.component}”
        </AbsoluteFill>
      );
    }
    const Component = entry.Component;
    return (
      <AbsoluteFill style={style}>
        <Component
          {...resolveComponentProps(clip.component, clip.props, ctx.project.style)}
          width={ctx.width}
          height={ctx.height}
          fps={ctx.fps}
          durationInFrames={clip.duration}
          variant={ctx.variant}
        />
      </AbsoluteFill>
    );
  }
  const Scene = clip.scene ? scenes[clip.scene] : undefined;
  if (!Scene) {
    return (
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(220,38,38,0.25)",
          color: "#fff",
          fontFamily: "sans-serif",
          fontSize: Math.round(ctx.height * 0.03),
        }}
      >
        Missing scene “{clip.scene}” (scenes/{clip.scene}.tsx)
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={style}>
      <Scene
        {...(clip.props ?? {})}
        clip={{ id: clip.id, from: clip.from, duration: clip.duration }}
        variant={ctx.variant}
        width={ctx.width}
        height={ctx.height}
        fps={ctx.fps}
      />
    </AbsoluteFill>
  );
}

function ImageClipView({ clip }: { clip: ImageClip }) {
  const style = useClipStyle(clip);
  return (
    <div style={{ ...boxStyle(clip.box), ...style, overflow: "hidden", borderRadius: clip.radius }}>
      <Img
        src={asset(clip.src)}
        style={{ width: "100%", height: "100%", objectFit: clip.fit ?? "cover", display: "block" }}
      />
    </div>
  );
}

/** CSS filter for a color grade (supported by the browser export). */
function gradeFilter(grade: VideoClip["grade"]): string | undefined {
  if (!grade) return undefined;
  const parts: string[] = [];
  if (grade.brightness !== undefined && grade.brightness !== 1) parts.push(`brightness(${grade.brightness})`);
  if (grade.contrast !== undefined && grade.contrast !== 1) parts.push(`contrast(${grade.contrast})`);
  if (grade.saturation !== undefined && grade.saturation !== 1) parts.push(`saturate(${grade.saturation})`);
  const warmth = grade.warmth ?? 0;
  if (warmth > 0) parts.push(`sepia(${(warmth * 0.35).toFixed(3)})`, `saturate(${(1 + warmth * 0.25).toFixed(3)})`);
  const hue = (grade.hue ?? 0) + (warmth < 0 ? warmth * -12 : warmth * -4);
  if (hue) parts.push(`hue-rotate(${hue.toFixed(1)}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}

function VideoClipView({
  clip,
  trackMuted,
  gain,
  ctx,
}: {
  clip: VideoClip;
  trackMuted: boolean;
  gain: number;
  ctx: StudioRuntimeContextValue;
}) {
  const style = useClipStyle(clip);
  const frame = useCurrentFrame();
  // The project style's camera (punch-ins, drift, …) moves the footage inside its box.
  const camera =
    ctx.project.style && clip.camera !== "none" && styleLayer.styleCamera
      ? styleLayer.styleCamera(ctx.project.style, { frame, durationInFrames: clip.duration, width: ctx.width, height: ctx.height })
      : null;
  return (
    <div style={{ ...boxStyle(clip.box), ...style, overflow: "hidden", borderRadius: clip.radius }}>
      <div style={{ position: "absolute", inset: 0, ...camera }}>
      <Video
        src={asset(clip.src)}
        trimBefore={clip.trimStart && clip.trimStart > 0 ? clip.trimStart : undefined}
        volume={(clip.volume ?? 1) * gain}
        muted={trackMuted || clip.muted}
        playbackRate={clip.playbackRate}
        // @remotion/media draws the frame itself: fit has to be its prop (CSS object-fit is ignored).
        objectFit={clip.fit ?? "cover"}
        style={{ width: "100%", height: "100%", filter: gradeFilter(clip.grade) }}
      />
      {clip.cursor ? <CursorOverlay cursor={clip.cursor} clip={clip} /> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recorded cursor (`cursor` on a video clip): the pointer and click ripples from a
// `<video>.cursor.json`, drawn inside the clip so it follows its trim, speed and box.

const loadedCursorTracks = new Map<string, CursorTrack | null>();
const pendingCursorTracks = new Map<string, Promise<CursorTrack | null>>();

function loadCursorTrack(url: string) {
  let pending = pendingCursorTracks.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => (response.ok ? (response.json() as Promise<CursorTrack>) : null))
      .catch(() => null)
      .then((track) => {
        loadedCursorTracks.set(url, track);
        return track;
      });
    pendingCursorTracks.set(url, pending);
  }
  return pending;
}

function useCursorTrack(src: string) {
  const url = asset(src);
  const [track, setTrack] = useState(() => loadedCursorTracks.get(url) ?? null);
  const [handle] = useState(() =>
    loadedCursorTracks.has(url) ? null : delayRender(`Loading cursor ${src}`, { timeoutInMilliseconds: 20_000 }),
  );
  useEffect(() => {
    let cancelled = false;
    loadCursorTrack(url)
      .then((loaded) => {
        if (!cancelled) setTrack(loaded);
      })
      .finally(() => {
        if (handle !== null) continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [url, handle]);
  return track;
}

function cursorPointAt(path: CursorTrack["path"], frame: number) {
  let low = 0;
  let high = path.length - 1;
  let index = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (path[mid][0] <= frame) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (index < 0) return null;
  const [from, x, y] = path[index];
  if (x === null || y === null) return null;
  const next = path[index + 1];
  if (!next || next[1] === null || next[2] === null || next[0] <= from) return { x, y };
  const t = Math.min(1, (frame - from) / (next[0] - from));
  return { x: x + (next[1] - x) * t, y: y + (next[2] - y) * t };
}

const CURSOR_POINTER_PATH =
  "M3.55 1.75Q2.65 1.4 2.65 2.45L2.65 19.95Q2.65 21.45 3.6 21.75Q4.2 21.95 4.85 21.3L8.25 17.85Q8.65 17.45 8.9 17.98L11.65 23.4Q12.15 24.35 13.1 23.88L15.55 22.7Q16.55 22.22 16.05 21.25L13.3 15.8Q13.02 15.25 13.65 15.25L19.1 15.25Q20.55 15.25 20.78 14.2Q20.95 13.42 20.05 12.78L4.45 1.95Q3.98 1.62 3.55 1.75Z";
const CURSOR_GREEN = "#2dd47a";
const HAND_EMOJI = "\u{1F446}";

function CursorOverlay({ cursor, clip }: { cursor: VideoCursor; clip: VideoClip }) {
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight } = useVideoConfig();
  const track = useCursorTrack(cursor.src);
  // Edits ("source" space) carry clicks for timing only: their positions don't match the picture.
  if (!track || track.space !== "video") return null;

  const style = cursor.style ?? "classic";
  const fps = track.fps;
  const sourceFrame = (clip.trimStart ?? 0) + frame * (clip.playbackRate ?? 1);

  // Where the video's picture sits inside the clip box (contain letterboxes, cover crops).
  const box = clip.box ?? { x: 0, y: 0, width: 1, height: 1 };
  const boxWidth = box.width * compWidth;
  const boxHeight = box.height * compHeight;
  const videoWidth = track.width ?? boxWidth;
  const videoHeight = track.height ?? boxHeight;
  const scale =
    (clip.fit ?? "cover") === "contain"
      ? Math.min(boxWidth / videoWidth, boxHeight / videoHeight)
      : Math.max(boxWidth / videoWidth, boxHeight / videoHeight);
  const offsetX = (boxWidth - videoWidth * scale) / 2;
  const offsetY = (boxHeight - videoHeight * scale) / 2;
  const toBox = (x: number, y: number) => ({
    left: offsetX + x * videoWidth * scale,
    top: offsetY + y * videoHeight * scale,
  });

  // Sized to the frame, not the box, so a punch-in doesn't blow the pointer up.
  const size =
    Math.max(18, Math.min(44, Math.min(compWidth, compHeight) * 0.032)) * ((cursor.size ?? 100) / 100);

  // Smoothing averages the path over a short window around this frame.
  const reach = Math.round((cursor.smoothing ?? 0.3) * 0.2 * fps);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let offset = -reach; offset <= reach; offset += 1) {
    const sample = cursorPointAt(track.path, sourceFrame + offset);
    if (!sample) continue;
    sumX += sample.x;
    sumY += sample.y;
    count += 1;
  }
  const point = cursorPointAt(track.path, sourceFrame) && count ? toBox(sumX / count, sumY / count) : null;

  const rippleFrames = 0.6 * fps;
  const ripples =
    cursor.clicks === false
      ? []
      : track.clicks.filter((click) => sourceFrame >= click.frame && sourceFrame - click.frame < rippleFrames);
  let lastPressFrame: number | null = null;
  for (const click of track.clicks) {
    if (click.frame > sourceFrame) break;
    lastPressFrame = click.frame;
  }
  const press = lastPressFrame === null ? 0 : Math.max(0, 1 - (sourceFrame - lastPressFrame) / (0.3 * fps));
  const rippleColor = style === "accent" || style === "spotlight" ? CURSOR_GREEN : "#ffffff";

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {ripples.map((click) => {
        const progress = (sourceFrame - click.frame) / rippleFrames;
        const diameter = size * (0.6 + 2.2 * progress);
        const at = toBox(click.x, click.y);
        return (
          <div
            key={click.frame}
            style={{
              position: "absolute",
              left: at.left - diameter / 2,
              top: at.top - diameter / 2,
              width: diameter,
              height: diameter,
              borderRadius: "50%",
              border: `${Math.max(2, size * 0.09)}px solid ${rippleColor}`,
              boxShadow: "0 0 6px rgba(0,0,0,0.45)",
              boxSizing: "border-box",
              opacity: 0.9 * (1 - progress),
            }}
          />
        );
      })}
      {point && style === "spotlight" ? (
        <div
          style={{
            position: "absolute",
            left: point.left - size * 0.42,
            top: point.top - size * 0.42,
            width: size * 0.84,
            height: size * 0.84,
            borderRadius: "50%",
            border: `${Math.max(2, size * 0.08)}px solid ${CURSOR_GREEN}`,
            background: "rgba(45, 212, 122, 0.16)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
            boxSizing: "border-box",
            transform: `scale(${1 - press * 0.15})`,
          }}
        />
      ) : null}
      {point && style === "hand" ? (
        <div
          style={{
            position: "absolute",
            left: point.left - size * 0.42,
            top: point.top - size * 0.16,
            fontSize: size,
            lineHeight: 1,
            textShadow: "0 1px 3px rgba(0,0,0,0.55)",
            transform: `rotate(${press * 9}deg) scale(${1 - press * 0.05})`,
            transformOrigin: "42% 16%",
          }}
        >
          {HAND_EMOJI}
        </div>
      ) : null}
      {point && (style === "classic" || style === "accent") ? (
        <svg
          width={size}
          height={size * 1.1}
          viewBox="0 0 24 26.4"
          style={{
            position: "absolute",
            left: point.left - (3.55 / 24) * size,
            top: point.top - (1.75 / 24) * size,
            overflow: "visible",
            transform: `scale(${1 - press * 0.08})`,
            transformOrigin: `${(3.55 / 24) * 100}% ${(1.75 / 26.4) * 100}%`,
          }}
        >
          <defs>
            <filter id="studio-cursor-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.1" floodColor="#000000" floodOpacity="0.65" />
            </filter>
          </defs>
          <path
            d={CURSOR_POINTER_PATH}
            fill={style === "accent" ? CURSOR_GREEN : "#ffffff"}
            stroke="#000000"
            strokeWidth={2.4}
            strokeLinejoin="round"
            filter="url(#studio-cursor-shadow)"
          />
        </svg>
      ) : null}
    </div>
  );
}

function TextClipView({ clip, ctx }: { clip: TextClip; ctx: StudioRuntimeContextValue }) {
  const style = useClipStyle(clip);
  const s = { ...projectStyle(ctx.project.style)?.text, ...clip.style };
  const align = s.align ?? "center";
  return (
    <div
      style={{
        ...boxStyle(clip.box ?? { x: 0.05, y: 0.4, width: 0.9, height: 0.2 }),
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
      }}
    >
      <div
        style={{
          fontFamily: s.fontFamily ? `"${s.fontFamily}", sans-serif` : "sans-serif",
          fontSize: s.fontSize ?? Math.round(ctx.height * 0.07),
          fontWeight: s.fontWeight ?? 800,
          color: s.color ?? "#ffffff",
          textAlign: align,
          lineHeight: s.lineHeight ?? 1.1,
          letterSpacing: s.letterSpacing,
          textTransform: s.textTransform,
          textShadow: s.shadow,
          whiteSpace: "pre-wrap",
          width: "100%",
        }}
      >
        {clip.text}
      </div>
    </div>
  );
}

function CaptionsClipView({ clip, ctx }: { clip: CaptionsClip; ctx: StudioRuntimeContextValue }) {
  const StyledCaptions = styleLayer.StyledCaptions;
  if (ctx.project.style && !clip.style?.preset && StyledCaptions && projectStyle(ctx.project.style)) {
    return (
      <StyledCaptionsClip clip={clip} ctx={ctx}>
        <StyledCaptions
          styleId={ctx.project.style}
          words={clip.words}
          position={clip.style?.position}
          wordsPerLine={clip.style?.maxWordsPerLine}
          fontSize={clip.style?.fontSize}
        />
      </StyledCaptionsClip>
    );
  }
  return <PlainCaptionsClipView clip={clip} ctx={ctx} />;
}

function StyledCaptionsClip({ clip, children }: { clip: CaptionsClip; ctx: StudioRuntimeContextValue; children: ReactNode }) {
  const style = useClipStyle(clip);
  return <AbsoluteFill style={{ ...style, pointerEvents: "none" }}>{children}</AbsoluteFill>;
}

function PlainCaptionsClipView({ clip, ctx }: { clip: CaptionsClip; ctx: StudioRuntimeContextValue }) {
  const frame = useCurrentFrame();
  const style = useClipStyle(clip);
  const s = { ...projectStyle(ctx.project.style)?.captions, ...clip.style };
  const perLine = Math.max(1, s.maxWordsPerLine ?? 4);
  const words = clip.words;
  // Group words into lines of N; show the line containing the current (or last spoken) word.
  let current = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].from <= frame) current = i;
    else break;
  }
  if (current < 0) return null;
  const lineStart = Math.floor(current / perLine) * perLine;
  const line = words.slice(lineStart, lineStart + perLine);
  const lastWord = line[line.length - 1];
  // Hide the line once its last word ended and the next line hasn't started (pause > 12 frames).
  const next = words[lineStart + perLine];
  if (frame > lastWord.to + 12 && (!next || next.from > frame)) return null;

  const fontSize = s.fontSize ?? Math.round(ctx.height * (ctx.height > ctx.width ? 0.045 : 0.06));
  const top = s.position === "top" ? "8%" : s.position === "center" ? "50%" : undefined;
  const bottom = s.position === "top" || s.position === "center" ? undefined : "10%";
  const preset = s.preset ?? "pop";
  return (
    <AbsoluteFill style={{ ...style, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "6%",
          right: "6%",
          top,
          bottom,
          transform: s.position === "center" ? "translateY(-50%)" : undefined,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: `0 ${Math.round(fontSize * 0.28)}px`,
          fontFamily: s.fontFamily ? `"${s.fontFamily}", sans-serif` : "sans-serif",
          fontWeight: s.fontWeight ?? 900,
          fontSize,
          lineHeight: 1.15,
          textAlign: "center",
        }}
      >
        {line.map((word, i) => {
          const index = lineStart + i;
          const active = index === current && frame <= word.to + 2;
          const spoken = index <= current;
          let scale = 1;
          if (preset === "pop" && index === current) {
            scale = interpolate(frame, [word.from, word.from + 4, word.from + 8], [0.85, 1.12, 1], clamp);
          }
          const color =
            preset === "plain"
              ? (s.color ?? "#fff")
              : active || (preset === "karaoke" && spoken)
                ? (s.highlight ?? "#facc15")
                : (s.color ?? "#fff");
          return (
            <span
              key={`${index}-${word.text}`}
              style={{
                display: "inline-block",
                color,
                opacity: preset === "pop" && !spoken ? 0 : 1,
                transform: `scale(${scale})`,
                textShadow: "0 4px 18px rgba(0,0,0,0.55)",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function AudioClipView({ clip, trackMuted, gain }: { clip: AudioClip; trackMuted: boolean; gain: number }) {
  const base = (clip.volume ?? 1) * gain;
  const fadeIn = Math.max(0, clip.fadeIn ?? 0);
  const fadeOut = Math.max(0, clip.fadeOut ?? 0);
  const duration = clip.duration;
  return (
    <Audio
      src={asset(clip.src)}
      trimBefore={clip.trimStart && clip.trimStart > 0 ? clip.trimStart : undefined}
      muted={trackMuted}
      loop={clip.loop}
      playbackRate={clip.playbackRate}
      volume={
        fadeIn || fadeOut
          ? (f: number) => {
              const a = fadeIn ? interpolate(f, [0, fadeIn], [0, 1], clamp) : 1;
              const b = fadeOut ? interpolate(f, [duration - fadeOut, duration], [1, 0], clamp) : 1;
              return base * a * b;
            }
          : base
      }
    />
  );
}

const PREMOUNT_SECONDS = 1;

function TrackView({
  track,
  scenes,
  ctx,
  masterGain,
}: {
  track: StudioTrack;
  scenes: SceneRegistry;
  ctx: StudioRuntimeContextValue;
  masterGain: number;
}) {
  const visual = track.kind !== "audio";
  const { isRendering } = useRemotionEnvironment();
  if (visual && track.hidden) return null;
  const gain = (track.volume ?? 1) * masterGain;
  const trackMuted = Boolean(track.muted);
  return (
    <>
      {(track.clips as StudioClip[]).map((raw) => {
        const clip = resolveClip(raw, ctx.variant);
        if (clip.duration <= 0) return null;
        let body: ReactNode = null;
        switch (track.kind) {
          case "scene":
            body = <SceneClipView clip={clip as SceneClip} scenes={scenes} ctx={ctx} />;
            break;
          case "image":
            body = <ImageClipView clip={clip as ImageClip} />;
            break;
          case "video":
            body = <VideoClipView clip={clip as VideoClip} trackMuted={trackMuted} gain={gain} ctx={ctx} />;
            break;
          case "text":
            body = <TextClipView clip={clip as TextClip} ctx={ctx} />;
            break;
          case "captions":
            body = <CaptionsClipView clip={clip as CaptionsClip} ctx={ctx} />;
            break;
          case "audio":
            body = <AudioClipView clip={clip as AudioClip} trackMuted={trackMuted} gain={gain} />;
            break;
        }
        const premountFor = clip.from > 0 ? Math.round(ctx.fps * PREMOUNT_SECONDS) : undefined;
        const name = `${track.name} · ${clip.name ?? clip.id}`;
        if (!visual && !isRendering) {
          // Audio in the preview. Remotion only premounts a <Sequence> that has a layout box
          // (layout="none" silently skips premountFor), and an <Audio> that mounts on its start frame
          // pauses the player while it fetches and decodes the file, which is the hitch you feel on
          // every voice line, SFX and music cut. So give it an invisible box purely to enable premount.
          return (
            <Sequence
              key={clip.id}
              from={clip.from}
              durationInFrames={clip.duration}
              premountFor={premountFor}
              name={name}
              style={{ display: "none" }}
            >
              {body}
            </Sequence>
          );
        }
        return (
          <Sequence
            key={clip.id}
            from={clip.from}
            durationInFrames={clip.duration}
            // Mount each clip a moment early in the preview (hidden), so heavy scene setup
            // (WebGL, big DOM) and media buffering happen before the cut instead of on it.
            // No effect on captures or the export.
            premountFor={premountFor}
            name={name}
            layout={visual ? "absolute-fill" : "none"}
          >
            {body}
          </Sequence>
        );
      })}
    </>
  );
}

// Compositions render inside the Agentcut page (Player, captures, browser export). Its global CSS
// (Tailwind preflight: border-box everywhere, line-height 1.5, image rules…) must not leak in, or a
// project would lay out differently than in a plain Remotion render. Revert author styles inside the
// composition to browser defaults; inline styles (everything scenes set) still win.
// SVG content is excluded: its presentation attributes (fill, stroke…) lose to any CSS rule.
// Then Remotion's own page defaults (remotion/dist default-css: * { box-sizing: border-box }).
const ISOLATION_CSS = `.studio-composition, .studio-composition :not(svg, svg *) { all: revert; }
.studio-composition, .studio-composition :not(svg, svg *), .studio-composition svg, .studio-composition svg * { box-sizing: border-box; }
.studio-composition svg { display: inline; vertical-align: baseline; }`;

function useStyleIsolation() {
  if (typeof document === "undefined") return;
  if (document.getElementById("studio-composition-isolation")) return;
  const style = document.createElement("style");
  style.id = "studio-composition-isolation";
  style.textContent = ISOLATION_CSS;
  document.head.appendChild(style);
}

export function createStudioComposition(scenes: SceneRegistry) {
  function StudioComposition(props: StudioCompositionProps) {
    const { project, layers, variant, assetBase, libraryBase } = props;
    const size = project.variants[variant] ?? project.variants[project.defaultVariant] ?? {
      width: 1920,
      height: 1080,
    };
    setRuntimeState({ fps: project.fps, assetBase, libraryBase });
    useStyleIsolation();
    useProjectFonts(project.fonts ?? []);
    const ctx = useMemo<StudioRuntimeContextValue>(
      () => ({
        project,
        variant,
        width: size.width,
        height: size.height,
        fps: project.fps,
        assetBase,
        libraryBase,
      }),
      [project, variant, size.width, size.height, assetBase, libraryBase],
    );
    const masterGain = props.masterGain ?? 1;
    const ordered = [...layers.tracks].reverse();
    return (
      <StudioRuntimeContext.Provider value={ctx}>
        <AbsoluteFill
          className="studio-composition"
          style={{
            background: project.background || "#000",
            overflow: "hidden",
            // Same starting point as a bare Remotion page: browser default font, size, color, line height.
            font: "initial",
            color: "black",
            letterSpacing: "normal",
          }}
        >
          {project.style && projectStyle(project.style) ? <StyleFonts /> : null}
          {ordered.map((track, index) => (
            <TrackView key={`${track.id}:${index}`} track={track} scenes={scenes} ctx={ctx} masterGain={masterGain} />
          ))}
          {project.style && styleLayer.StyleOverlay ? <styleLayer.StyleOverlay styleId={project.style} /> : null}
        </AbsoluteFill>
      </StudioRuntimeContext.Provider>
    );
  }
  return StudioComposition;
}
