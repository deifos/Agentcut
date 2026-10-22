import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, easeOutExpo, exitOut, fill, mix, ramp, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  kicker: string;
  lines: string[];
  by: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  italicAccent: boolean;
  align: string;
  stagger: number;
  blur: number;
  tracking: boolean;
};

/**
 * The focus-pull title: letters (or words) come out of a heavy blur, settle from a slight scale and
 * the line tightens its tracking as it lands. On the way out everything melts back into blur.
 */
export function BlurInTitle(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.05 : 1);
  const maxBlur = fontSize * 0.04 * props.blur;
  const out = exitOut(frame, d, 16);
  const justify = props.align === "left" ? "flex-start" : props.align === "right" ? "flex-end" : "center";
  const settle = ramp(frame, 0, Math.min(48, d * 0.5), easeOutExpo);
  const spacing = props.tracking ? mix(0.14, -0.03, settle) : -0.03;
  const startAt = props.kicker ? 8 : 0;
  let index = 0;

  const piece = (text: string, highlighted: boolean, key: number) => {
    const t = ramp(frame, startAt + index++ * props.stagger, 26, easeOutExpo);
    const gone = 1 - out;
    return (
      <span
        key={key}
        style={{
          display: "inline-block",
          whiteSpace: "pre",
          color: highlighted ? props.accent : props.color,
          fontStyle: highlighted && props.italicAccent ? "italic" : undefined,
          opacity: Math.min(1, t * 1.3) * out,
          transform: `translateY(${mix(fontSize * 0.18, 0, t) - gone * fontSize * 0.1}px) scale(${mix(1.18, 1, t)})`,
          ...blurStyle(maxBlur * (1 - t) + maxBlur * 0.8 * gone),
        }}
      >
        {text}
      </span>
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: justify,
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 70 : 120) * u)}px`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: justify, gap: fontSize * 0.04 }}>
        {props.kicker ? (
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: Math.max(14, fontSize * 0.2),
              letterSpacing: `${mix(0.5, 0.2, settle)}em`,
              textTransform: "uppercase",
              color: props.accent,
              marginBottom: fontSize * 0.2,
              opacity: ramp(frame, 0, 18) * out,
              ...blurStyle(fontSize * 0.06 * (1 - ramp(frame, 0, 18))),
            }}
          >
            {props.kicker}
          </div>
        ) : null}
        {props.lines.map((line, lineIndex) => {
          const words = splitHighlights(line);
          return (
            <div
              key={lineIndex}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: justify,
                columnGap: fontSize * 0.24,
                fontFamily: FONTS[props.font] ?? FONTS.sans,
                fontWeight: Number(props.weight) || 700,
                fontSize,
                lineHeight: 1.06,
                letterSpacing: `${spacing}em`,
              }}
            >
              {props.by === "line"
                ? piece(line.replace(/\*/g, ""), false, 0)
                : words.map((word, wordIndex) =>
                    props.by === "letter" ? (
                      <span key={wordIndex} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                        {Array.from(word.text).map((char, charIndex) => piece(char, word.highlighted, charIndex))}
                      </span>
                    ) : (
                      piece(word.text, word.highlighted, wordIndex)
                    ),
                  )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
