import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, easeInOut, easeOutExpo, exitOut, fill, mix, onColor, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  prefix: string;
  words: string[];
  suffix: string;
  layout: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  pill: boolean;
  motion: string;
};

/**
 * "Built for designers / founders / teams": a fixed phrase with a word that keeps swapping. The old
 * word blurs up and away while the next one rises in. The slot is as wide as the longest word, so
 * the line never jumps.
 */
export function WordSwap(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.05 : 1);
  const words = props.words.length ? props.words : [""];
  const enter = ramp(frame, 0, 22, easeOutExpo);
  const out = exitOut(frame, d, 12);
  // Each word holds for an equal share of the clip (after the phrase comes in, before the exit).
  const usable = Math.max(1, d - 16 - 14);
  const slot = usable / words.length;
  const swap = Math.min(14, slot * 0.6);
  const stacked = props.layout === "stacked";

  const wordStyle = (i: number) => {
    // t: 0 hidden below, 1 in place, 2 gone above.
    const start = 14 + i * slot;
    const inT = i === 0 ? enter : ramp(frame, start - swap, swap, easeInOut);
    const outT = i === words.length - 1 ? 0 : ramp(frame, start + slot - swap, swap, easeInOut);
    const t = inT + outT;
    const away = t > 1 ? t - 1 : 1 - t;
    const dir = t > 1 ? -1 : 1;
    const move =
      props.motion === "flip"
        ? { transform: `translateY(${dir * away * fontSize * 0.5}px) scaleY(${1 - away * 0.6})` }
        : props.motion === "zoom"
          ? { transform: `scale(${1 + dir * away * 0.35})` }
          : { transform: `translateY(${dir * away * fontSize * 0.7}px)` };
    return {
      gridArea: "1 / 1",
      justifySelf: stacked ? "center" : "start",
      opacity: 1 - away,
      ...move,
      ...blurStyle(away * fontSize * 0.08),
    } as const;
  };

  const text = {
    fontFamily: FONTS[props.font] ?? FONTS.sans,
    fontWeight: Number(props.weight) || 700,
    fontSize,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    color: props.color,
    whiteSpace: "nowrap",
  } as const;
  const fixed = (value: string) =>
    value ? (
      <span
        style={{
          display: "inline-block",
          opacity: enter,
          transform: `translateY(${mix(fontSize * 0.25, 0, enter)}px)`,
          ...blurStyle((1 - enter) * fontSize * 0.06),
        }}
      >
        {value}
      </span>
    ) : null;

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 60 : 110) * u)}px`,
        opacity: out,
      }}
    >
      <div
        style={{
          ...text,
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: stacked ? "center" : "baseline",
          gap: stacked ? fontSize * 0.08 : fontSize * 0.26,
        }}
      >
        {fixed(props.prefix)}
        <span style={{ display: "inline-grid", padding: `${fontSize * 0.06}px 0` }}>
          {words.map((word, i) => (
            <span key={i} style={wordStyle(i)}>
              <span
                style={{
                  display: "inline-block",
                  color: props.pill ? onColor(props.accent) : props.accent,
                  background: props.pill ? props.accent : undefined,
                  borderRadius: fontSize * 0.22,
                  padding: props.pill ? `0 ${fontSize * 0.22}px` : undefined,
                }}
              >
                {word}
              </span>
            </span>
          ))}
        </span>
        {fixed(props.suffix)}
      </div>
    </AbsoluteFill>
  );
}
