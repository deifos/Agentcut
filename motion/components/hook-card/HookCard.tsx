import type { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { exitOut, ramp, unit } from "../lib";
import { Backdrop, Chip, Headline, Label, Panel, Tag, Words, enter, hash, headWeight, lookKit, type LookKit, type LookProps } from "../looks";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps &
  LookProps & {
    kicker: string;
    lines: string[];
    sub: string;
    tagline: string;
    layout: string;
    position?: string;
    split: number;
    align: string;
    size: number;
  };

/** Where the speaker's footage goes for a layout, as fractions of the frame (+ corner radius in px). */
export interface SpeakerBox {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/**
 * The hole a hook layout leaves for the speaker's video. Give the speaker's video clip this `box`
 * (and `radius`) for the hook's duration; null for "full" and "card" (the footage stays full frame).
 */
export function hookSpeakerBox(layout: string, width: number, height: number, split = 52): SpeakerBox | null {
  const vertical = height > width;
  const s = split / 100;
  const u = unit(width, height);
  switch (layout) {
    case "top":
    case "stack":
      return vertical ? { x: 0, y: s, width: 1, height: 1 - s, radius: 0 } : { x: s, y: 0, width: 1 - s, height: 1, radius: 0 };
    case "collage":
      return vertical ? { x: 0.11, y: 0.45, width: 0.78, height: 0.41, radius: 0 } : { x: 0.53, y: 0.14, width: 0.38, height: 0.72, radius: 0 };
    case "window":
      return vertical ? { x: 0.07, y: 0.47, width: 0.86, height: 0.42, radius: 0 } : { x: 0.5, y: 0.2, width: 0.44, height: 0.66, radius: 0 };
    case "hud":
      return vertical ? { x: 0.06, y: 0.45, width: 0.88, height: 0.45, radius: 0 } : { x: 0.5, y: 0.14, width: 0.44, height: 0.72, radius: 0 };
    case "frame":
      return vertical ? { x: 0.1, y: 0.44, width: 0.8, height: 0.46, radius: 0 } : { x: 0.52, y: 0.14, width: 0.4, height: 0.72, radius: 0 };
    case "tv":
      return vertical
        ? { x: 0.13, y: 0.45, width: 0.74, height: 0.34, radius: Math.round(44 * u) }
        : { x: 0.53, y: 0.16, width: 0.36, height: 0.56, radius: Math.round(44 * u) };
    case "inset":
      return vertical
        ? { x: 0.08, y: 0.47, width: 0.84, height: 0.43, radius: Math.round(36 * u) }
        : { x: 0.52, y: 0.12, width: 0.4, height: 0.76, radius: Math.round(36 * u) };
    default:
      return null;
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The look's backdrop everywhere except the hole (four strips cut from one full-frame backdrop). */
function BackdropAround({ kit, width, height, hole }: { kit: LookKit; width: number; height: number; hole: Rect }) {
  const strips: Rect[] = [
    { x: 0, y: 0, w: width, h: hole.y },
    { x: 0, y: hole.y + hole.h, w: width, h: height - hole.y - hole.h },
    { x: 0, y: hole.y, w: hole.x, h: hole.h },
    { x: hole.x + hole.w, y: hole.y, w: width - hole.x - hole.w, h: hole.h },
  ].filter((r) => r.w > 0.5 && r.h > 0.5);
  return (
    <>
      {strips.map((r, i) => (
        <div key={i} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: -r.x, top: -r.y, width, height }}>
            <Backdrop kit={kit} width={width} height={height} seed={3} />
          </div>
        </div>
      ))}
    </>
  );
}

/** Jagged torn edge points along a horizontal (or vertical) line of length `len`. */
function tornEdge(len: number, depth: number, vertical: boolean) {
  const steps = Math.max(12, Math.round(len / (depth * 1.3)));
  const pts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const along = (i / steps) * len;
    const across = depth * 0.5 + (hash(i, 9) - 0.5) * depth;
    pts.push(vertical ? `${across.toFixed(1)},${along.toFixed(1)}` : `${along.toFixed(1)},${across.toFixed(1)}`);
  }
  return pts;
}

/** The seam between the title panel and the footage for split layouts, in the look's way. */
function Seam({ kit, hole, vertical, width, height }: { kit: LookKit; hole: Rect; vertical: boolean; width: number; height: number }) {
  const u = kit.u;
  const depth = 44 * u;
  if (kit.look === "notebook" || kit.look === "paper") {
    // Torn paper overlapping the top (or left) of the footage.
    const pts = tornEdge(vertical ? width : height, depth, !vertical);
    const poly = vertical ? ["0,0", ...pts, `${width},0`].join(" ") : ["0,0", ...pts, `0,${height}`].join(" ");
    const box: CSSProperties = vertical
      ? { position: "absolute", left: 0, top: hole.y - 1, width, height: depth }
      : { position: "absolute", left: hole.x - 1, top: 0, width: depth, height };
    return (
      <svg style={{ ...box, overflow: "visible" }} width={vertical ? width : depth} height={vertical ? depth : height}>
        <polygon points={poly} transform={vertical ? `translate(0 ${7 * u})` : `translate(${7 * u} 0)`} fill="rgba(0,0,0,0.28)" />
        <polygon points={poly} fill={kit.backdrop} />
      </svg>
    );
  }
  if (kit.look === "line") {
    const t = Math.max(2, 3 * u);
    return (
      <div
        style={
          vertical
            ? { position: "absolute", left: 0, top: hole.y - t / 2, width, height: t, background: kit.line }
            : { position: "absolute", left: hole.x - t / 2, top: 0, width: t, height, background: kit.line }
        }
      />
    );
  }
  if (kit.look === "neon") {
    // Two neon rules, magenta over cyan.
    const t = Math.max(2, 4 * u);
    const at = (offset: number, color: string): CSSProperties =>
      vertical
        ? { position: "absolute", left: 0, top: hole.y + offset, width, height: t, background: color, boxShadow: `0 0 ${18 * u}px ${color}` }
        : { position: "absolute", left: hole.x + offset, top: 0, width: t, height, background: color, boxShadow: `0 0 ${18 * u}px ${color}` };
    return (
      <>
        <div style={at(-t * 1.5, kit.accent)} />
        <div style={at(t * 1.5, kit.line)} />
      </>
    );
  }
  const thick = kit.look === "ink" ? Math.max(4, 9 * u) : Math.max(2, 3 * u);
  const color = kit.look === "ink" ? kit.line : kit.accent;
  const glow = kit.look === "crt" ? `0 0 ${22 * u}px ${color}` : kit.look === "ink" ? `0 ${10 * u}px 0 rgba(0,0,0,0.3)` : undefined;
  if (kit.look === "clean") {
    // A soft fade of the panel into the footage.
    const fade = 120 * u;
    return (
      <div
        style={
          vertical
            ? { position: "absolute", left: 0, top: hole.y, width, height: fade, background: `linear-gradient(180deg, ${kit.backdrop} 0%, rgba(0,0,0,0) 100%)` }
            : { position: "absolute", left: hole.x, top: 0, width: fade, height, background: `linear-gradient(90deg, ${kit.backdrop} 0%, rgba(0,0,0,0) 100%)` }
        }
      />
    );
  }
  return (
    <div
      style={
        vertical
          ? { position: "absolute", left: 0, top: hole.y - thick / 2, width, height: thick, background: color, boxShadow: glow }
          : { position: "absolute", left: hole.x - thick / 2, top: 0, width: thick, height, background: color, boxShadow: glow }
      }
    />
  );
}

/** The frame around a boxed speaker: a taped photo, a terminal window or a soft rounded card. */
function SpeakerFrame({ kit, layout, hole, frame, fps, tagline }: { kit: LookKit; layout: string; hole: Rect; frame: number; fps: number; tagline: string }) {
  const u = kit.u;
  if (layout === "collage") {
    const border = 18 * u;
    const e = enter(kit, frame, fps, 2, 0, 41);
    const tape = (left: number, top: number, rotate: number): CSSProperties => ({
      position: "absolute",
      left,
      top,
      width: 170 * u,
      height: 46 * u,
      background: "rgba(232,220,186,0.88)",
      transform: `rotate(${rotate}deg)`,
      boxShadow: `0 ${2 * u}px ${4 * u}px rgba(0,0,0,0.12)`,
    });
    return (
      <div style={{ opacity: e.opacity }}>
        <div
          style={{
            position: "absolute",
            left: hole.x - border,
            top: hole.y - border,
            width: hole.w + border * 2,
            height: hole.h + border * 3.2,
            border: `${border}px solid #f7f2e6`,
            borderBottomWidth: border * 3.2,
            boxShadow: `${10 * u}px ${16 * u}px ${0}px rgba(20,12,4,0.38)`,
          }}
        />
        <div style={tape(hole.x - 70 * u, hole.y - 30 * u, -28)} />
        <div style={tape(hole.x + hole.w - 100 * u, hole.y - 26 * u, 24)} />
        {tagline ? (
          <div style={{ position: "absolute", left: hole.x, width: hole.w, top: hole.y + hole.h + border * 0.6, display: "flex", justifyContent: "center" }}>
            <Chip kit={kit} line={tagline} fontSize={44 * u} frame={frame} fps={fps} start={16} stagger={3} seed={13} />
          </div>
        ) : null}
      </div>
    );
  }
  if (layout === "window") {
    const bar = 54 * u;
    const blink = Math.floor(frame / 15) % 2 === 0;
    return (
      <>
        <div
          style={{
            position: "absolute",
            left: hole.x - 3 * u,
            top: hole.y - bar,
            width: hole.w + 6 * u,
            height: hole.h + bar + 3 * u,
            border: `${Math.max(2, 3 * u)}px solid ${kit.line}`,
            boxShadow: `0 0 ${36 * u}px rgba(57,255,136,0.35)`,
            opacity: ramp(frame, 0, 4),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: hole.x,
            top: hole.y - bar,
            width: hole.w,
            height: bar,
            display: "flex",
            alignItems: "center",
            gap: 12 * u,
            padding: `0 ${18 * u}px`,
            background: kit.panel,
            borderBottom: `${Math.max(1, 2 * u)}px solid ${kit.line}`,
            fontFamily: kit.body,
            fontSize: 34 * u,
            color: kit.line,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 15 * u, height: 15 * u, background: kit.line, opacity: 0.8 - i * 0.22 }} />
          ))}
          <span style={{ marginLeft: 6 * u }}>{tagline ? tagline.replace(/\*/g, "") : "camera.mp4"}</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 * u }}>
            <span style={{ width: 14 * u, height: 14 * u, borderRadius: "50%", background: "#ff4d4d", opacity: blink ? 1 : 0.2 }} />
            REC
          </span>
        </div>
      </>
    );
  }
  if (layout === "tv") {
    // A 90s TV set around the speaker: thick rounded bezel, a control strip with knobs below.
    const bezel = 46 * u;
    const strip = 120 * u;
    const e = enter(kit, frame, fps, 0, 0, 29);
    const knob = (left: number) => (
      <span style={{ position: "absolute", top: strip * 0.28, left, width: strip * 0.44, height: strip * 0.44, borderRadius: "50%", background: "radial-gradient(#5b524a 0%, #2a2420 70%)", boxShadow: `inset 0 0 0 ${3 * u}px #1a1512` }} />
    );
    return (
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <div
          style={{
            position: "absolute",
            left: hole.x - bezel,
            top: hole.y - bezel,
            width: hole.w + bezel * 2,
            height: hole.h + bezel * 2 + strip,
            borderRadius: 70 * u,
            border: `${bezel}px solid #3a332d`,
            borderBottomWidth: bezel + strip,
            boxShadow: `0 ${24 * u}px ${60 * u}px rgba(0,0,0,0.55), inset 0 0 0 ${6 * u}px #1d1814`,
          }}
        />
        <div style={{ position: "absolute", left: hole.x - bezel, top: hole.y + hole.h + bezel * 0.6, width: hole.w + bezel * 2, height: strip }}>
          <span style={{ position: "absolute", left: bezel * 1.4, top: strip * 0.36, fontFamily: kit.head, fontSize: 30 * u, letterSpacing: "0.2em", color: "#b9ab99" }}>SONIQ</span>
          {knob(hole.w + bezel * 2 - strip * 1.3)}
          {knob(hole.w + bezel * 2 - strip * 0.75)}
          <span style={{ position: "absolute", left: hole.w * 0.55, top: strip * 0.42, width: 14 * u, height: 14 * u, borderRadius: "50%", background: "#ff3b30", boxShadow: `0 0 ${12 * u}px #ff3b30` }} />
        </div>
        {tagline ? (
          <div style={{ position: "absolute", left: hole.x, width: hole.w, top: hole.y + 18 * u, display: "flex", justifyContent: "flex-start", paddingLeft: 24 * u }}>
            <Tag kit={kit} text={tagline.replace(/\*/g, "")} fontSize={30 * u} frame={frame} fps={fps} start={6} tilt={0} />
          </div>
        ) : null}
      </div>
    );
  }
  if (layout === "frame") {
    // A thin frame drawn around the speaker, a small label above it.
    const t = Math.max(2, 3 * u);
    const draw = ramp(frame, 0, 14);
    const perimeter = 2 * (hole.w + hole.h);
    return (
      <>
        <svg style={{ position: "absolute", left: hole.x - t, top: hole.y - t, overflow: "visible" }} width={hole.w + t * 2} height={hole.h + t * 2}>
          <rect x={t / 2} y={t / 2} width={hole.w + t} height={hole.h + t} fill="none" stroke={kit.line} strokeWidth={t} strokeDasharray={perimeter} strokeDashoffset={perimeter * (1 - draw)} />
        </svg>
        {tagline ? (
          <div style={{ position: "absolute", left: hole.x, width: hole.w, top: hole.y + hole.h + 26 * u, display: "flex", justifyContent: "center" }}>
            <Chip kit={kit} line={tagline} fontSize={34 * u} frame={frame} fps={fps} start={10} stagger={3} seed={23} />
          </div>
        ) : null}
      </>
    );
  }
  if (layout === "hud") {
    // Targeting brackets, a live label and a scan line over the speaker.
    const arm = 90 * u;
    const t = Math.max(3, 6 * u);
    const glow = `0 0 ${14 * u}px ${kit.line}`;
    const corner = (left: number, top: number, sx: number, sy: number) => (
      <div style={{ position: "absolute", left, top, width: arm, height: arm, transform: `scale(${sx}, ${sy})`, transformOrigin: "0 0" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: arm, height: t, background: kit.line, boxShadow: glow }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: t, height: arm, background: kit.line, boxShadow: glow }} />
      </div>
    );
    const grow = ramp(frame, 0, 8);
    const pad = mixPad(grow, 40 * u);
    const scan = hole.y + ((frame * 6 * u) % hole.h);
    const blink = Math.floor(frame / 12) % 2 === 0;
    return (
      <div style={{ opacity: grow }}>
        {corner(hole.x - pad, hole.y - pad, 1, 1)}
        {corner(hole.x + hole.w + pad, hole.y - pad, -1, 1)}
        {corner(hole.x - pad, hole.y + hole.h + pad, 1, -1)}
        {corner(hole.x + hole.w + pad, hole.y + hole.h + pad, -1, -1)}
        <div style={{ position: "absolute", left: hole.x, top: scan, width: hole.w, height: Math.max(1, 2 * u), background: kit.line, opacity: 0.35, boxShadow: glow }} />
        <div
          style={{
            position: "absolute",
            left: hole.x,
            top: hole.y - 62 * u,
            display: "flex",
            alignItems: "center",
            gap: 12 * u,
            fontFamily: kit.body,
            fontWeight: 700,
            fontSize: 30 * u,
            letterSpacing: "0.12em",
            color: kit.line,
            textShadow: glow,
          }}
        >
          <span style={{ width: 16 * u, height: 16 * u, borderRadius: "50%", background: kit.accent, opacity: blink ? 1 : 0.25, boxShadow: `0 0 ${12 * u}px ${kit.accent}` }} />
          LIVE // CAM_01
        </div>
        {tagline ? (
          <div style={{ position: "absolute", left: hole.x, width: hole.w, top: hole.y + hole.h + 34 * u, display: "flex", justifyContent: "center" }}>
            <Chip kit={kit} line={tagline} fontSize={40 * u} frame={frame} fps={fps} start={12} stagger={3} seed={19} />
          </div>
        ) : null}
      </div>
    );
  }
  if (layout === "inset") {
    const e = enter(kit, frame, fps, 4);
    return (
      <>
        <div
          style={{
            position: "absolute",
            left: hole.x,
            top: hole.y,
            width: hole.w,
            height: hole.h,
            borderRadius: 36 * u,
            border: `${Math.max(1, 2 * u)}px solid rgba(255,255,255,0.18)`,
            boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.5), 0 0 ${60 * u}px ${kit.accent.startsWith("#") ? `${kit.accent}33` : "transparent"}`,
          }}
        />
        {tagline ? (
          <div style={{ position: "absolute", left: hole.x, width: hole.w, top: hole.y - 30 * u, display: "flex", justifyContent: "center", opacity: e.opacity, transform: e.transform }}>
            <Chip kit={kit} line={tagline} fontSize={40 * u} frame={frame} fps={fps} />
          </div>
        ) : null}
      </>
    );
  }
  return null;
}

/**
 * The opening title of a talking-head video, laid out the project style's way around the speaker:
 * a split with a torn or ruled seam ("top", "stack"), a taped photo collage, a terminal window, a
 * rounded inset, full frame, or a card over the footage.
 */
export function HookCard(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const kit = lookKit(props, u);
  const vertical = height > width;
  const out = exitOut(frame, d, 10);
  const layout = props.layout;
  const box = hookSpeakerBox(layout, width, height, props.split);
  const centered = props.align === "center" || layout === "stack" || layout === "window" || layout === "inset" || layout === "hud" || layout === "frame" || layout === "tv";
  const align = centered ? "center" : "left";
  const headSize = (props.size / 100) * Math.min(width, height) * (layout === "card" ? 0.72 : box && !vertical ? 0.8 : 1);
  const pad = (vertical ? 70 : 110) * u;
  const placement: CSSProperties = {
    justifyContent: props.position === "top" ? "flex-start" : props.position === "lower" ? "flex-end" : "center",
    paddingTop: props.position === "top" ? height * 0.1 : 0,
    paddingBottom: props.position === "lower" ? height * 0.18 : 0,
  };

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: centered ? "center" : "flex-start",
        textAlign: align,
        gap: headSize * 0.16,
        padding: layout === "card" ? `${headSize * 0.45}px ${headSize * 0.5}px` : `0 ${pad}px`,
      }}
    >
      {props.kicker ? <Kicker kit={kit} text={props.kicker} size={headSize * 0.3} frame={frame} fps={fps} /> : null}
      <Headline kit={kit} lines={props.lines} fontSize={headSize} frame={frame} fps={fps} start={4} align={align} />
      {props.sub ? <Sub kit={kit} text={props.sub} size={headSize * 0.42} frame={frame} fps={fps} start={10 + props.lines.length * 6} /> : null}
    </div>
  );

  if (layout === "full") {
    return (
      <AbsoluteFill style={{ opacity: out, background: kit.backdrop }}>
        <Backdrop kit={kit} width={width} height={height} />
        <AbsoluteFill style={placement}>{content}</AbsoluteFill>
      </AbsoluteFill>
    );
  }
  if (!box) {
    const e = enter(kit, frame, fps, 0, kit.look === "ink" || kit.look === "paper" ? -2 : 0);
    return (
      <AbsoluteFill style={{ ...placement, alignItems: centered ? "center" : "flex-start", paddingLeft: centered ? 0 : pad, opacity: out }}>
        <div style={{ opacity: e.opacity, transform: e.transform, maxWidth: width * (vertical ? 0.88 : 0.62) }}>
          <Panel kit={kit} title="~/hook.txt">
            {content}
          </Panel>
        </div>
      </AbsoluteFill>
    );
  }

  const hole: Rect = { x: box.x * width, y: box.y * height, w: box.width * width, h: box.height * height };
  // The text sits in the panel part: above the speaker (mobile) or beside it (wide).
  const region: CSSProperties = vertical
    ? { position: "absolute", left: 0, top: 0, width, height: layout === "top" || layout === "stack" ? hole.y : hole.y - 70 * u }
    : { position: "absolute", left: 0, top: 0, width: hole.x - (layout === "top" || layout === "stack" ? 0 : 40 * u), height };
  const split = layout === "top" || layout === "stack";
  // Splits slide the panel in from the top (or left); framed layouts fade the ground in.
  const reveal = Math.min(ramp(frame, 0, 10), 1 - ramp(frame, d - 10, 10));
  const slide = split ? (vertical ? `translateY(${(reveal - 1) * hole.y}px)` : `translateX(${(reveal - 1) * hole.x}px)`) : undefined;
  return (
    <AbsoluteFill style={{ opacity: split ? 1 : out }}>
      <AbsoluteFill style={{ transform: slide, opacity: split ? 1 : ramp(frame, 0, 6) }}>
        {split ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: vertical ? width : hole.x, height: vertical ? hole.y : height, overflow: "hidden" }}>
            <Backdrop kit={kit} width={width} height={height} seed={3} />
          </div>
        ) : (
          <BackdropAround kit={kit} width={width} height={height} hole={hole} />
        )}
        {split ? <Seam kit={kit} hole={hole} vertical={vertical} width={width} height={height} /> : null}
        <div style={{ ...region, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: centered ? "center" : "stretch" }}>{content}</div>
      </AbsoluteFill>
      <SpeakerFrame kit={kit} layout={layout} hole={hole} frame={frame} fps={fps} tagline={props.tagline} />
      {split && props.tagline ? (
        <Tagline kit={kit} text={props.tagline} hole={hole} vertical={vertical} centered={centered} frame={frame} fps={fps} start={14 + props.lines.length * 6} />
      ) : null}
    </AbsoluteFill>
  );
}

/** Brackets start wide and close in on the speaker. */
const mixPad = (t: number, gap: number) => gap * (2.2 - 1.2 * t);

/** A phrase sitting on the seam between the title panel and the footage. */
function Tagline({ kit, text, hole, vertical, centered, frame, fps, start }: { kit: LookKit; text: string; hole: Rect; vertical: boolean; centered: boolean; frame: number; fps: number; start: number }) {
  const u = kit.u;
  const size = 46 * u;
  const e = enter(kit, frame, fps, start, kit.look === "ink" ? -2 : kit.look === "notebook" ? -1.5 : 0, 7);
  const style: CSSProperties = vertical
    ? { position: "absolute", left: 0, right: 0, top: hole.y, transform: "translateY(-50%)", display: "flex", justifyContent: centered ? "center" : "flex-start", padding: `0 ${60 * u}px` }
    : { position: "absolute", left: 0, width: hole.x, bottom: 90 * u, display: "flex", justifyContent: "center" };
  const chip =
    kit.look === "notebook" ? (
      // Written on a paper scrap, half over the torn edge.
      <span style={{ display: "inline-block", background: kit.panel, padding: `${size * 0.1}px ${size * 0.4}px`, boxShadow: `0 ${4 * u}px ${12 * u}px rgba(0,0,0,0.2)` }}>
        <span style={{ fontFamily: kit.head, fontWeight: 700, fontSize: size * 1.15, color: kit.panelText }}>
          <Words kit={kit} line={text} fontSize={size * 1.15} frame={frame} />
        </span>
      </span>
    ) : (
      <Chip kit={kit} line={text} fontSize={size} frame={frame} fps={fps} seed={17} />
    );
  return (
    <div style={style}>
      <div style={{ opacity: e.opacity, transform: e.transform, display: "flex", alignItems: "center", gap: 18 * u }}>
        {kit.look === "ink" && centered ? <span style={{ width: 60 * u, height: Math.max(3, 6 * u), background: kit.accent }} /> : null}
        {chip}
        {kit.look === "ink" && centered ? <span style={{ width: 60 * u, height: Math.max(3, 6 * u), background: kit.accent }} /> : null}
      </div>
    </div>
  );
}

function Kicker({ kit, text, size, frame, fps }: { kit: LookKit; text: string; size: number; frame: number; fps: number }) {
  const e = enter(kit, frame, fps, 0);
  if (kit.look === "paper") {
    return (
      <div style={{ opacity: e.opacity, transform: e.transform }}>
        <Chip kit={kit} line={text} fontSize={size * 0.9} frame={frame} fps={fps} />
      </div>
    );
  }
  return (
    <div style={{ opacity: e.opacity, transform: e.transform }}>
      <Label
        kit={kit}
        fontSize={size * 0.62}
        style={kit.look === "notebook" ? { fontFamily: kit.head, fontSize: size * 1.1, letterSpacing: 0 } : kit.look === "ink" ? { opacity: 1 } : undefined}
      >
        {text}
      </Label>
    </div>
  );
}

function Sub({ kit, text, size, frame, fps, start }: { kit: LookKit; text: string; size: number; frame: number; fps: number; start: number }) {
  if (kit.look === "paper") return <Chip kit={kit} line={text} fontSize={size * 0.75} frame={frame} fps={fps} start={start} stagger={3} seed={5} />;
  const e = enter(kit, frame, fps, start);
  return (
    <div
      style={{
        opacity: e.opacity,
        transform: e.transform,
        fontFamily: kit.head,
        fontWeight: headWeight(kit),
        fontSize: size,
        lineHeight: 1.05,
        color: kit.panelText,
        textTransform: kit.look === "crt" ? "uppercase" : "none",
      }}
    >
      <Words kit={kit} line={text} fontSize={size} frame={frame} />
    </div>
  );
}

