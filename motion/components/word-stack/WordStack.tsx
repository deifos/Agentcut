import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, easeInOut, easeOutExpo, exitOut, fill, mix, ramp } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lead: string;
  words: string[];
  layout: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
};

/**
 * "We help you / design / ship / grow": a fixed lead phrase beside a roller of words. The roller
 * snaps up one word at a time like a slot reel; the centered word is lit in the accent while its
 * neighbours shrink, fade and blur above and below it. It lands on the last word.
 */
export function WordStack(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const vertical = height > width;
  const stacked = props.layout === "stacked" || vertical;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.05 : 1);
  const words = props.words.length ? props.words : [""];
  const enter = ramp(frame, 0, 24, easeOutExpo);
  const out = exitOut(frame, d, 12);
  const lineH = fontSize * 1.12;

  // Each word holds for an equal share; the roller snaps to the next one at the end of each share.
  const usable = Math.max(1, d - 18 - 18);
  const slot = usable / words.length;
  const snap = Math.min(16, slot * 0.7);
  let position = 0;
  for (let i = 1; i < words.length; i++) position += ramp(frame, 18 + i * slot - snap, snap, easeInOut);
  // The reel also rises into place on the way in.
  position -= (1 - enter) * 1.2;

  const text = {
    fontFamily: FONTS[props.font] ?? FONTS.sans,
    fontWeight: Number(props.weight) || 700,
    fontSize,
    lineHeight: 1.12,
    letterSpacing: "-0.03em",
    color: props.color,
    whiteSpace: "nowrap",
  } as const;

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: "center",
        justifyContent: "center",
        opacity: out,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          ...text,
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: "center",
          gap: stacked ? fontSize * 0.5 : fontSize * 0.32,
        }}
      >
        {props.lead ? (
          <span
            style={{
              display: "inline-block",
              opacity: enter,
              transform: `translateX(${stacked ? 0 : mix(-fontSize * 0.4, 0, enter)}px) translateY(${stacked ? mix(fontSize * 0.3, 0, enter) : 0}px)`,
              ...blurStyle((1 - enter) * fontSize * 0.06),
            }}
          >
            {props.lead}
          </span>
        ) : null}
        {/* Every word sits in the same grid cell, so the reel is as wide as the longest word. */}
        <span style={{ display: "inline-grid", height: lineH }}>
          {words.map((word, i) => {
            const offset = i - position;
            const away = Math.abs(offset);
            if (away > 2.6) return <span key={i} style={{ gridArea: "1 / 1", visibility: "hidden" }}>{word}</span>;
            const lit = Math.max(0, 1 - away);
            return (
              <span
                key={i}
                style={{
                  gridArea: "1 / 1",
                  justifySelf: stacked ? "center" : "start",
                  transformOrigin: stacked ? "50% 50%" : "0% 50%",
                  transform: `translateY(${offset * lineH * 0.92}px) scale(${1 - Math.min(1, away) * 0.22 - Math.max(0, away - 1) * 0.12})`,
                  opacity: Math.max(0, 1 - away * 0.62) * enter,
                  color: mixColor(props.color, props.accent, lit),
                  ...blurStyle(Math.min(away, 2) * fontSize * 0.035),
                }}
              >
                {word}
              </span>
            );
          })}
        </span>
      </div>
    </AbsoluteFill>
  );
}

/** a→b between two hex colors (falls back to the nearer one for other color formats). */
function mixColor(a: string, b: string, t: number) {
  const pa = /^#?([0-9a-f]{6})$/i.exec(a.trim());
  const pb = /^#?([0-9a-f]{6})$/i.exec(b.trim());
  if (!pa || !pb) return t > 0.5 ? b : a;
  const na = parseInt(pa[1], 16);
  const nb = parseInt(pb[1], 16);
  const ch = (s: number) => Math.round(mix((na >> s) & 255, (nb >> s) & 255, t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
