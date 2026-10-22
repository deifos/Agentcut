import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, easeOutExpo, exitOut, fill, mix, ramp, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  quote: string[];
  author: string;
  role: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  font: string;
  italic: boolean;
  marks: boolean;
};

/** A magazine pull quote: big serif lines drift up out of a blur, then the attribution draws in. */
export function EditorialQuote(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.05 : 1);
  const out = exitOut(frame, d, 18);
  const markIn = ramp(frame, 0, 26, easeOutExpo);
  const lineDelay = 9;
  const afterLines = 10 + props.quote.length * lineDelay;
  const rule = ramp(frame, afterLines, 18, easeOutExpo);
  const byIn = ramp(frame, afterLines + 6, 18, easeOutExpo);

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 80 : 200) * u)}px`,
        opacity: out,
        filter: out < 0.98 ? `blur(${((1 - out) * 10 * u).toFixed(2)}px)` : undefined,
      }}
    >
      <div style={{ position: "relative" }}>
        {props.marks ? (
          <div
            style={{
              position: "absolute",
              left: -fontSize * 0.1,
              top: -fontSize * 1.1,
              fontFamily: FONTS.serif,
              fontSize: fontSize * 2.6,
              lineHeight: 1,
              color: props.accent,
              opacity: markIn * 0.9,
              transform: `translateY(${mix(fontSize * 0.4, 0, markIn)}px)`,
            }}
          >
            “
          </div>
        ) : null}
        <div
          style={{
            fontFamily: FONTS[props.font] ?? FONTS.serif,
            fontStyle: props.italic ? "italic" : undefined,
            fontWeight: 400,
            fontSize,
            lineHeight: 1.12,
            letterSpacing: "-0.015em",
            color: props.color,
          }}
        >
          {props.quote.map((line, i) => {
            const t = ramp(frame, 8 + i * lineDelay, 30, easeOutExpo);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  columnGap: fontSize * 0.25,
                  opacity: t,
                  transform: `translateY(${mix(fontSize * 0.45, 0, t)}px)`,
                  ...blurStyle((1 - t) * fontSize * 0.12),
                }}
              >
                {splitHighlights(line).map((word, j) => (
                  <span key={j} style={{ color: word.highlighted ? props.accent : undefined }}>
                    {word.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
        {props.author ? (
          <div style={{ display: "flex", alignItems: "center", gap: 24 * u, marginTop: fontSize * 0.7 }}>
            <div style={{ width: 90 * u * rule, height: Math.max(2, 3 * u), background: props.accent }} />
            <div style={{ opacity: byIn, transform: `translateX(${mix(-20 * u, 0, byIn)}px)` }}>
              <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: Math.max(16, fontSize * 0.42), color: props.color }}>
                {props.author}
              </div>
              {props.role ? (
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: Math.max(12, fontSize * 0.26),
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: props.color,
                    opacity: 0.6,
                    marginTop: 6 * u,
                  }}
                >
                  {props.role}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
