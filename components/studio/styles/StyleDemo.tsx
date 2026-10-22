"use client";

// A style's demo reel on a talking-head clip: the hook in the style's own layout around the
// speaker, then the style's own choreography (demo-reels.ts) over the speaker with its camera,
// captions and texture. The same library pieces the studio runtime draws.
import { AbsoluteFill, Html5Video, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import {
  getMotionStyle,
  hookSpeakerBox,
  MOTION_COMPONENTS,
  resolveComponentProps,
  StyleOverlay,
  StyledCaptions,
  styleCamera,
} from "@/motion/components";
import { DEMO_FRAMES, type DemoWord } from "@/components/studio/styles/demo-script";
import { reelFor } from "@/components/studio/styles/demo-reels";

export interface StyleDemoProps {
  styleId: string;
  src: string;
  words: DemoWord[];
  [key: string]: unknown;
}

function Part({ id, props, styleId, from, duration }: { id: string; props: Record<string, unknown>; styleId: string; from: number; duration: number }) {
  const { width, height, fps } = useVideoConfig();
  const entry = MOTION_COMPONENTS[id];
  if (!entry) return null;
  return (
    <Sequence from={from} durationInFrames={duration} layout="none">
      <AbsoluteFill>
        <entry.Component
          {...resolveComponentProps(id, props, styleId)}
          width={width}
          height={height}
          fps={fps}
          durationInFrames={duration}
          variant={height > width ? "mobile" : "wide"}
        />
      </AbsoluteFill>
    </Sequence>
  );
}

/**
 * Where the full-frame footage sits inside a smaller box so the face stays in it: as wide as the
 * box, shifted so the upper third (where a talking head's face is) lands in the box's middle.
 */
function frameFace(boxW: number, boxH: number, frameW: number, frameH: number) {
  const scale = Math.max(boxW / frameW, boxH / frameH);
  const w = frameW * scale;
  const h = frameH * scale;
  const top = Math.min(0, Math.max(boxH - h, boxH * 0.42 - h * 0.36));
  return { left: (boxW - w) / 2, top, width: w, height: h };
}

export function StyleDemo({ styleId, src, words }: StyleDemoProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const style = getMotionStyle(styleId);
  if (!style) return null;
  const reel = reelFor(style);
  const hookShot = style.shots.find((s) => s.component === "hook-card")?.props ?? {};
  const hookProps: Record<string, unknown> = { sub: "", ...hookShot, ...reel.hook };
  const layout = String(hookProps.layout ?? "top");
  const inHook = frame < reel.hookEnd;
  const box = inHook ? hookSpeakerBox(layout, width, height, Number(hookProps.split ?? 54)) : null;
  const camera = !inHook ? styleCamera(styleId, { frame: frame - reel.hookEnd, durationInFrames: DEMO_FRAMES - reel.hookEnd, width, height }) : null;
  const footage = box
    ? { left: box.x * width, top: box.y * height, width: box.width * width, height: box.height * height, borderRadius: box.radius }
    : { left: 0, top: 0, width, height, borderRadius: 0 };

  return (
    <AbsoluteFill style={{ background: style.tokens.backdrop }}>
      <div style={{ position: "absolute", ...footage, overflow: "hidden" }}>
        <div style={{ position: "absolute", ...frameFace(footage.width, footage.height, width, height), ...camera }}>
          <Html5Video src={src} loop style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
      <Part id="hook-card" styleId={styleId} from={0} duration={reel.hookEnd} props={hookProps} />
      {reel.captions.map(([from, to]) => (
        <Sequence key={from} from={from} durationInFrames={to - from} layout="none">
          <StyledCaptions
            styleId={styleId}
            position={reel.captionPosition}
            words={words.filter((w) => w.from >= from && w.from < to).map((w) => ({ ...w, from: w.from - from, to: w.to - from }))}
          />
        </Sequence>
      ))}
      {reel.parts.map((part) => (
        <Part key={`${part.id}-${part.from}`} id={part.id} styleId={styleId} from={part.from} duration={part.to - part.from} props={part.props ?? {}} />
      ))}
      <StyleOverlay styleId={styleId} />
    </AbsoluteFill>
  );
}
