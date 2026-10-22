import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, exitOut, mix, pop, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  kicker: string;
  lines: string[];
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  align: string;
  stagger: number;
  blur: boolean;
};

/** Headline words rise into place one by one; *starred* words take the accent color. */
export function TextReveal(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.05 : 1);
  const out = exitOut(frame, durationInFrames);
  const kickerIn = pop(frame, fps, 0);
  let index = 0;
  const startAt = props.kicker ? 6 : 0;
  const justify = props.align === "left" ? "flex-start" : props.align === "right" ? "flex-end" : "center";

  return (
    <AbsoluteFill
      style={{
        background: props.background === "transparent" ? undefined : props.background,
        alignItems: justify,
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 70 : 120) * u)}px`,
        opacity: out,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: justify, gap: fontSize * 0.08 }}>
        {props.kicker ? (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: Math.max(14, fontSize * 0.22),
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: props.accent,
              marginBottom: fontSize * 0.18,
              opacity: kickerIn,
              transform: `translateY(${mix(fontSize * 0.25, 0, kickerIn)}px)`,
            }}
          >
            {props.kicker}
          </div>
        ) : null}
        {props.lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: justify,
              columnGap: fontSize * 0.26,
              fontFamily: FONTS[props.font] ?? FONTS.sans,
              fontWeight: Number(props.weight) || 800,
              fontSize,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
              textAlign: props.align as "left" | "center" | "right",
            }}
          >
            {splitHighlights(line).map((word, wordIndex) => {
              const t = pop(frame, fps, startAt + index++ * props.stagger);
              return (
                // Each word clips its own rise, so it slides up out of a line, not over the one above.
                <span key={wordIndex} style={{ display: "inline-block", overflow: "hidden", paddingBottom: fontSize * 0.08 }}>
                  <span
                    style={{
                      display: "inline-block",
                      color: word.highlighted ? props.accent : props.color,
                      transform: `translateY(${mix(fontSize * 0.9, 0, t)}px)`,
                      opacity: Math.min(1, t * 1.4),
                      filter: props.blur && t < 0.98 ? `blur(${mix(fontSize * 0.12, 0, t).toFixed(2)}px)` : undefined,
                    }}
                  >
                    {word.text}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
