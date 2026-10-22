import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, exitOut, fill, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  prefix: string;
  lines: string[];
  speed: number;
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  align: string;
  caret: string;
};

/** Text typed out character by character behind a blinking caret, with an optional prompt prefix. */
export function Typewriter(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 0.95 : 1);
  const out = exitOut(frame, d, 10);
  const startAt = 8;
  const typed = Math.max(0, Math.floor(((frame - startAt) * props.speed) / fps));
  // Where each line starts in the typed sequence (words joined by single spaces).
  const lines: { words: ReturnType<typeof splitHighlights>; start: number; chars: number }[] = [];
  for (const line of props.lines) {
    const words = splitHighlights(line);
    const start = lines.length ? lines[lines.length - 1].start + lines[lines.length - 1].chars : 0;
    lines.push({ words, start, chars: words.reduce((n, w) => n + w.text.length, 0) + Math.max(0, words.length - 1) });
  }
  const total = lines.length ? lines[lines.length - 1].start + lines[lines.length - 1].chars : 0;
  // The caret sits on the line being typed (or the last one once everything is typed).
  const typingLine = lines.findIndex((line) => typed < line.start + line.chars);
  const caretLine = typingLine === -1 ? lines.length - 1 : typingLine;
  const typing = typed > 0 && typed < total;
  // Solid while typing, blinking (every half second) while it waits.
  const caretOn = typing || Math.floor(frame / (fps / 2)) % 2 === 0;
  const justify = props.align === "center" ? "center" : "flex-start";
  const caret = (key: string) => {
    if (props.caret === "none") return null;
    const block = props.caret === "block";
    return (
      <span
        key={key}
        style={{
          display: "inline-block",
          width: block ? fontSize * 0.55 : Math.max(2, fontSize * 0.07),
          height: fontSize * (block ? 0.95 : 1.05),
          marginLeft: fontSize * 0.04,
          transform: `translateY(${fontSize * 0.14}px)`,
          background: props.accent,
          opacity: caretOn ? (block ? 0.85 : 1) : 0,
        }}
      />
    );
  };

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: justify,
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 70 : 140) * u)}px`,
        opacity: out,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: justify,
          fontFamily: FONTS[props.font] ?? FONTS.mono,
          fontWeight: Number(props.weight) || 500,
          fontSize,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          color: props.color,
        }}
      >
        {lines.map(({ words, start: lineStart }, lineIndex) => {
          if (typed < lineStart && lineIndex > 0) return <div key={lineIndex} style={{ height: fontSize * 1.25 }} />;
          let left = Math.max(0, typed - lineStart);
          const pieces = words.map((word, wordIndex) => {
            const text = (wordIndex > 0 ? " " : "") + word.text;
            const visible = text.slice(0, left);
            left -= visible.length;
            return (
              <span key={wordIndex} style={{ color: word.highlighted ? props.accent : undefined, whiteSpace: "pre" }}>
                {visible}
              </span>
            );
          });
          return (
            <div key={lineIndex} style={{ display: "flex", alignItems: "baseline", minHeight: fontSize * 1.25 }}>
              {lineIndex === 0 && props.prefix ? (
                <span style={{ color: props.accent, marginRight: fontSize * 0.35, whiteSpace: "pre" }}>{props.prefix}</span>
              ) : null}
              {pieces}
              {lineIndex === caretLine ? caret(`caret-${lineIndex}`) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
