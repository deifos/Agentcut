import type { CSSProperties } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, easeInOut, easeOutExpo, exitOut, fill, mix, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  text: string;
  color: string;
  fillColor: string;
  background: string;
  size: number;
  font: string;
  weight: string;
  uppercase: boolean;
  stroke: number;
  echo: boolean;
};

// Rough width of one character, in em, so the word always fits the frame.
const CHAR_WIDTH: Record<string, number> = { wide: 0.9, condensed: 0.46, serif: 0.5, syne: 0.72, mono: 0.62 };

/**
 * Giant outlined type that fills up from the bottom like liquid, with optional echo copies of the
 * outline stacked above and below that drift apart. A poster look for a single word.
 */
export function OutlineFill(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const chars = Math.max(1, props.text.length);
  const fontSize = Math.min(
    (props.size / 100) * Math.min(width, height) * (vertical ? 1.2 : 1),
    (width * 0.86) / (chars * (CHAR_WIDTH[props.font] ?? 0.66) * (props.uppercase ? 1.12 : 1)),
  );
  const strokeWidth = Math.max(1, props.stroke * u);
  const enter = ramp(frame, 0, 24, easeOutExpo);
  const fillT = ramp(frame, 14, Math.max(10, d * 0.3), easeInOut);
  const spread = ramp(frame, 8, Math.max(12, d * 0.5), easeOutExpo);
  const out = exitOut(frame, d, 14);

  const word = (style: CSSProperties, key: string) => (
    <div
      key={key}
      style={{
        position: "absolute",
        whiteSpace: "nowrap",
        fontFamily: FONTS[props.font] ?? FONTS.wide,
        fontWeight: Number(props.weight) || 800,
        fontSize,
        lineHeight: 1,
        letterSpacing: `${mix(0.12, -0.02, enter)}em`,
        textTransform: props.uppercase ? "uppercase" : undefined,
        ...style,
      }}
    >
      {props.text}
    </div>
  );

  const outline: CSSProperties = { color: "transparent", WebkitTextStrokeWidth: strokeWidth, WebkitTextStrokeColor: props.color };
  const echoes = props.echo ? [-2, -1, 1, 2] : [];

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        opacity: out,
      }}
    >
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${mix(1.25, 1, enter)})`,
          opacity: enter,
        }}
      >
        {echoes.map((n) =>
          word(
            {
              ...outline,
              opacity: (0.5 / Math.abs(n)) * spread,
              transform: `translateY(${n * fontSize * 0.92 * spread}px)`,
            },
            `echo${n}`,
          ),
        )}
        {word(outline, "outline")}
        {/* The fill: a solid copy clipped from the top, the clip line rising. */}
        {word(
          {
            color: props.fillColor,
            WebkitTextStrokeWidth: strokeWidth,
            WebkitTextStrokeColor: props.fillColor,
            clipPath: `inset(${((1 - fillT) * 100).toFixed(2)}% 0 0 0)`,
          },
          "fill",
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
