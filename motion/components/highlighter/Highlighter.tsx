import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, easeInOut, easeOutExpo, exitOut, fill, mix, ramp, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lines: string[];
  style: string;
  color: string;
  marker: string;
  markedText: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  align: string;
};

/**
 * A sentence fades in, then a marker sweeps behind each *starred* word, one after another, like
 * someone highlighting the important part. Also as an underline or a box.
 */
export function Highlighter(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.05 : 1);
  const out = exitOut(frame, d, 12);
  const justify = props.align === "left" ? "flex-start" : "center";
  const marksStart = 10 + props.lines.length * 5;
  let mark = 0;

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: justify,
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 70 : 150) * u)}px`,
        opacity: out,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: justify,
          gap: fontSize * 0.1,
          fontFamily: FONTS[props.font] ?? FONTS.sans,
          fontWeight: Number(props.weight) || 700,
          fontSize,
          lineHeight: 1.15,
          letterSpacing: "-0.025em",
          color: props.color,
        }}
      >
        {props.lines.map((line, i) => {
          const t = ramp(frame, i * 5, 22, easeOutExpo);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: justify,
                columnGap: fontSize * 0.26,
                opacity: t,
                transform: `translateY(${mix(fontSize * 0.3, 0, t)}px)`,
                ...blurStyle((1 - t) * fontSize * 0.08),
              }}
            >
              {splitHighlights(line).map((word, j) => {
                if (!word.highlighted) return <span key={j}>{word.text}</span>;
                const sweep = ramp(frame, marksStart + mark++ * 10, 14, easeInOut);
                return (
                  <span key={j} style={{ position: "relative", display: "inline-block" }}>
                    <MarkShape kind={props.style} sweep={sweep} color={props.marker} fontSize={fontSize} />
                    <span style={{ position: "relative", color: props.style === "marker" && sweep > 0.5 ? props.markedText : undefined }}>
                      {word.text}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function MarkShape({ kind, sweep, color, fontSize }: { kind: string; sweep: number; color: string; fontSize: number }) {
  if (sweep <= 0) return null;
  if (kind === "underline") {
    return (
      <span
        style={{
          position: "absolute",
          left: 0,
          bottom: fontSize * 0.02,
          height: fontSize * 0.09,
          width: `${sweep * 100}%`,
          borderRadius: fontSize * 0.05,
          background: color,
        }}
      />
    );
  }
  if (kind === "box") {
    const pad = fontSize * 0.12;
    return (
      <span
        style={{
          position: "absolute",
          left: -pad,
          right: -pad,
          top: 0,
          bottom: 0,
          border: `${Math.max(2, fontSize * 0.04)}px solid ${color}`,
          borderRadius: fontSize * 0.14,
          opacity: sweep,
          transform: `scale(${mix(1.25, 1, sweep)})`,
        }}
      />
    );
  }
  // The marker: slightly taller than the x-height, tilted a hair, swept left to right.
  return (
    <span
      style={{
        position: "absolute",
        left: -fontSize * 0.08,
        top: fontSize * 0.14,
        height: fontSize * 0.9,
        width: `calc(${sweep * 100}% + ${sweep * fontSize * 0.16}px)`,
        borderRadius: fontSize * 0.08,
        background: color,
        transform: "rotate(-1.2deg)",
      }}
    />
  );
}
