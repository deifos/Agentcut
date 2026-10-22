// What a project style does to the whole video, beyond the component props: camera moves on the
// footage, a texture over everything, and captions drawn in the style's look. The studio runtime
// calls these (when the page provides them), so a new or changed style ships with the page.
import type { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS, alpha, unit } from "./lib";
import { Chip, Grain, Scanlines, Vignette, hash, lookKit, type LookProps } from "./looks";
import { getMotionStyle, type MotionStyle } from "./styles";

/** The style's tokens as look props (the first of its fonts the library has). */
export function styleLookProps(style: MotionStyle): LookProps {
  const font = style.tokens.font.split(",").map((f) => f.trim()).find((f) => f in FONTS) ?? "archivo";
  return {
    look: style.look,
    accent: style.tokens.accent,
    panel: style.tokens.panel,
    panelText: style.tokens.panelText,
    line: style.tokens.line,
    backdrop: style.tokens.backdrop,
    onVideo: style.tokens.text,
    font,
  };
}

/**
 * The style's camera on a footage clip at `frame` (clip-local): jump-cut punch-ins with a shake,
 * stop-motion snaps, a slow drift or glitch jumps. Null when the style keeps the camera still.
 */
export function styleCamera(
  styleId: string | null | undefined,
  { frame, durationInFrames, width, height }: { frame: number; durationInFrames: number; width: number; height: number },
): CSSProperties | null {
  const style = getMotionStyle(styleId);
  const cam = style?.camera;
  if (!cam) return null;
  const moved = moveCamera(cam, { frame, durationInFrames, width, height });
  if (!cam.grade) return moved;
  return { ...moved, filter: cam.grade };
}

function moveCamera(
  cam: NonNullable<ReturnType<typeof getMotionStyle>>["camera"],
  { frame, durationInFrames, width, height }: { frame: number; durationInFrames: number; width: number; height: number },
): CSSProperties | null {
  if (cam.mode === "still") return null;
  const u = unit(width, height);
  const every = Math.max(8, cam.every);
  const seg = Math.floor(frame / every);
  const t = frame - seg * every;
  const origin = "50% 38%";
  switch (cam.mode) {
    case "punch": {
      // Cut to a tighter or wider framing every beat, with a short shake on the cut.
      const levels = [1, cam.zoom, 1.04, cam.zoom * 1.05];
      const scale = levels[seg % levels.length];
      const kick = seg > 0 && t < 8 ? (1 - t / 8) * cam.shake * 18 * u : 0;
      const x = (hash(seg, t) - 0.5) * 2 * kick;
      const y = (hash(seg + 3, t) - 0.5) * 2 * kick;
      return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale})`, transformOrigin: origin };
    }
    case "snap": {
      // Stop-motion: held on twos, a little hand jitter, framing steps with a 2-frame overshoot.
      const held = frame - (frame % 2);
      const levels = [1, cam.zoom, 1.05];
      const over = seg > 0 && t < 2 ? 1.03 : 1;
      const scale = levels[seg % levels.length] * over;
      const x = (hash(7, held) - 0.5) * cam.shake * 6 * u;
      const y = (hash(11, held) - 0.5) * cam.shake * 6 * u;
      const r = (hash(13, held) - 0.5) * cam.shake * 0.5;
      return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${scale})`, transformOrigin: origin };
    }
    case "drift": {
      // A slow push-in across the clip with a gentle sideways sway.
      const p = Math.min(1, frame / Math.max(1, durationInFrames));
      const scale = 1 + (cam.zoom - 1) * p;
      const x = Math.sin(frame / (every * 0.9)) * cam.shake * 10 * u;
      return { transform: `translate(${x.toFixed(1)}px, 0px) scale(${scale.toFixed(4)})`, transformOrigin: origin };
    }
    case "tape": {
      // Worn tape: a slight wobble on twos, and a tracking hiccup (a sideways tear and a roll) every beat.
      const held = frame - (frame % 2);
      const wobble = (hash(5, held) - 0.5) * cam.shake * 3 * u;
      if (seg > 0 && t < 4) {
        const x = (hash(seg, t) - 0.5) * cam.shake * 40 * u;
        const y = -(4 - t) * cam.shake * 6 * u;
        return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${cam.zoom})`, transformOrigin: origin };
      }
      return { transform: `translate(${wobble.toFixed(1)}px, 0px) scale(${cam.zoom})`, transformOrigin: origin };
    }
    case "glitch": {
      // Still, except a 3-frame jump every beat.
      if (seg > 0 && t < 3) {
        const x = (hash(seg, t) - 0.5) * cam.shake * 60 * u;
        return { transform: `translate(${x.toFixed(1)}px, 0px) scale(${cam.zoom})`, transformOrigin: origin };
      }
      return { transform: "scale(1.02)", transformOrigin: origin };
    }
    default:
      return null;
  }
}

/** The style's texture over the whole frame: paper grain and copier edges, scanlines, or a vignette. */
export function StyleOverlay({ styleId }: { styleId: string | null | undefined }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const style = getMotionStyle(styleId);
  const overlay = style?.overlay;
  if (!style || !overlay || overlay.kind === "none") return null;
  const u = unit(width, height);
  const amount = overlay.amount;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {overlay.kind === "grain" ? (
        <>
          <Grain opacity={amount} seed={Math.floor(frame / 2) % 12} />
          <Vignette color="#2a1a08" amount={amount * 0.9} />
        </>
      ) : null}
      {overlay.kind === "scanlines" ? (
        <>
          <Scanlines u={u} opacity={amount} />
          <div style={{ position: "absolute", inset: 0, background: style.tokens.accent, opacity: 0.035 + hash(frame, 2) * 0.02 }} />
          <Vignette amount={amount * 1.2} />
        </>
      ) : null}
      {overlay.kind === "neon" ? (
        <>
          <Scanlines u={u} opacity={amount * 0.5} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(style.tokens.accent, amount)} 0%, ${alpha(style.tokens.accent, 0)} 18%, ${alpha(style.tokens.line, 0)} 82%, ${alpha(style.tokens.line, amount)} 100%)` }} />
          <Vignette color="#0a0418" amount={amount * 1.6} />
        </>
      ) : null}
      {overlay.kind === "vhs" ? <VhsOverlay frame={frame} fps={fps} width={width} height={height} amount={amount} /> : null}
      {overlay.kind === "vignette" ? <Vignette amount={amount} /> : null}
    </AbsoluteFill>
  );
}

/** Home-video tape: noise, a tracking band rolling down, a dark TV edge and the camcorder's on-screen text. */
function VhsOverlay({ frame, fps, width, height, amount }: { frame: number; fps: number; width: number; height: number; amount: number }) {
  const u = unit(width, height);
  const band = ((frame * 9 * u) % (height * 1.6)) - height * 0.3;
  const seconds = Math.floor(frame / fps);
  const counter = `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const osd: CSSProperties = {
    position: "absolute",
    fontFamily: FONTS.pixel,
    fontSize: 48 * u,
    lineHeight: 1,
    color: "#ffffff",
    textShadow: `0 0 ${3 * u}px rgba(0,0,0,0.9), ${-3 * u}px 0 rgba(255,40,60,0.6), ${3 * u}px 0 rgba(40,220,255,0.55)`,
    letterSpacing: "0.04em",
  };
  return (
    <>
      <Grain opacity={amount} seed={frame % 9} warm={false} frequency={1.2} />
      <div style={{ position: "absolute", left: 0, right: 0, top: band, height: 70 * u, overflow: "hidden", opacity: 0.55 }}>
        <Grain opacity={0.9} seed={(frame + 3) % 9} warm={false} frequency={2.2} />
      </div>
      <Scanlines u={u} opacity={amount * 0.7} />
      <Vignette amount={amount * 2.2} />
      <div style={{ ...osd, left: 60 * u, top: 70 * u }}>{"\u25B6 PLAY"}</div>
      <div style={{ ...osd, right: 60 * u, top: 70 * u }}>SP {counter}</div>
      <div style={{ ...osd, left: 60 * u, bottom: 80 * u, fontSize: 40 * u }}>
        OCT 21 1996
        <br />
        4:20 PM
      </div>
    </>
  );
}

interface CaptionWord {
  text: string;
  from: number;
  to: number;
}

const CAPTION_Y: Record<string, number> = { top: 0.14, center: 0.5, lower: 0.7, bottom: 0.84 };

/**
 * A captions clip drawn in the style's look: the current line as the look's chip (ink box,
 * ransom scraps, handwriting, terminal, pill), each word popping in when spoken and the spoken
 * word in the accent. Frames are clip-local, like the words.
 */
export function StyledCaptions({
  styleId,
  words,
  position,
  wordsPerLine,
  fontSize: size,
}: {
  styleId: string | null | undefined;
  words: CaptionWord[];
  position?: string;
  wordsPerLine?: number;
  fontSize?: number;
}) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const style = getMotionStyle(styleId);
  if (!style) return null;
  const perLine = Math.max(1, wordsPerLine ?? style.captions.wordsPerLine ?? 3);
  let current = -1;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].from <= frame) current = i;
    else break;
  }
  if (current < 0) return null;
  const lineStart = Math.floor(current / perLine) * perLine;
  const line = words.slice(lineStart, lineStart + perLine);
  const last = line[line.length - 1];
  const next = words[lineStart + perLine];
  if (frame > last.to + 12 && (!next || next.from > frame)) return null;

  const kit = lookKit(styleLookProps(style), unit(width, height));
  const fontSize = size ?? Math.min(width, height) * (height > width ? 0.058 : 0.05);
  const text = line
    .map((word, i) => {
      const clean = word.text.replace(/\*/g, "");
      return lineStart + i === current && frame <= word.to + 2 ? `*${clean}*` : clean;
    })
    .join(" ");
  const y = CAPTION_Y[position ?? style.captions.position ?? "lower"] ?? 0.7;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: "7%", right: "7%", top: `${y * 100}%`, transform: "translateY(-50%)", display: "flex", justifyContent: "center", textAlign: "center" }}>
        <Chip kit={kit} line={text} fontSize={fontSize} frame={frame} fps={fps} times={line.map((word) => word.from)} seed={lineStart + 1} />
      </div>
    </AbsoluteFill>
  );
}
