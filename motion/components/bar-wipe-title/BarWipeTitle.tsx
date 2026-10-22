import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, easeInOut, fill, ramp, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lines: string[];
  color: string;
  accent: string;
  barColor: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  uppercase: boolean;
  align: string;
  stagger: number;
};

/**
 * Each line is wiped on by a solid bar: the bar sweeps across, the text appears behind it and the
 * bar pulls away. At the end the bars sweep back over and take the text with them.
 */
export function BarWipeTitle(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.05 : 1);
  const justify = props.align === "left" ? "flex-start" : props.align === "right" ? "flex-end" : "center";
  const sweep = 12;

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: justify,
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 70 : 120) * u)}px`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: justify, gap: fontSize * 0.14 }}>
        {props.lines.map((line, i) => {
          const start = i * props.stagger;
          const grow = ramp(frame, start, sweep, easeInOut);
          const shrink = ramp(frame, start + sweep + 2, sweep, easeInOut);
          // The exit runs the same wipe again, the lines in reverse order.
          const exitStart = d - 2 * sweep - 4 - (props.lines.length - 1 - i) * Math.min(props.stagger, 4);
          const regrow = ramp(frame, exitStart, sweep, easeInOut);
          const gone = ramp(frame, exitStart + sweep + 2, sweep, easeInOut);
          const exiting = frame >= exitStart;
          const showText = exiting ? regrow < 1 : grow >= 1;
          const left = exiting ? (gone > 0 ? gone : 0) : shrink;
          const right = exiting ? 1 - regrow : 1 - grow;
          return (
            <div key={i} style={{ position: "relative", padding: `${fontSize * 0.04}px ${fontSize * 0.12}px` }}>
              <div
                style={{
                  display: "flex",
                  gap: fontSize * 0.26,
                  fontFamily: FONTS[props.font] ?? FONTS.sans,
                  fontWeight: Number(props.weight) || 800,
                  fontSize,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  textTransform: props.uppercase ? "uppercase" : undefined,
                  whiteSpace: "nowrap",
                  opacity: showText ? 1 : 0,
                }}
              >
                {splitHighlights(line).map((word, j) => (
                  <span key={j} style={{ color: word.highlighted ? props.accent : props.color }}>
                    {word.text}
                  </span>
                ))}
              </div>
              {left < 1 && right < 1 ? (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${left * 100}%`,
                    right: `${right * 100}%`,
                    background: i % 2 === 1 && props.accent !== props.barColor ? props.accent : props.barColor,
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
