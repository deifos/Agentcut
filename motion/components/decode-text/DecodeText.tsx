import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FONTS, exitOut, fill, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lines: string[];
  glyphs: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  align: string;
  speed: number;
  seed: number;
};

const GLYPHS: Record<string, string> = {
  symbols: "!<>-_\\/[]{}=+*^?#%&$@",
  binary: "01",
  letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  katakana: "アイウエオカキクケコサシスセソタチツテトナニヌネノ",
};

/** The decoder: text scrambles through random glyphs and locks in letter by letter, left to right. */
export function DecodeText(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.1 : 1);
  const out = exitOut(frame, d, 10);
  const pool = GLYPHS[props.glyphs] ?? GLYPHS.symbols;
  const justify = props.align === "left" ? "flex-start" : "center";
  // Glyphs change every 2 frames (every frame looks like noise, not decoding).
  const tick = Math.floor(frame / 2);
  // Scramble starts appearing ahead of the locked letters (a wave front).
  const lead = 8;
  let index = 0;

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: justify,
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 60 : 120) * u)}px`,
        opacity: out,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: justify,
          fontFamily: FONTS[props.font] ?? FONTS.mono,
          fontWeight: Number(props.weight) || 600,
          fontSize,
          lineHeight: 1.15,
          letterSpacing: "0.02em",
        }}
      >
        {props.lines.map((line, lineIndex) => (
          <div key={lineIndex} style={{ display: "flex", flexWrap: "wrap", justifyContent: justify, whiteSpace: "pre" }}>
            {splitHighlights(line).map((word, wordIndex) => (
              <span key={wordIndex} style={{ whiteSpace: "pre" }}>
                {wordIndex > 0 ? " " : ""}
                {Array.from(word.text).map((char, charIndex) => {
                  const i = index++;
                  const lockAt = 6 + (i * fps) / props.speed;
                  const appearAt = lockAt - lead;
                  if (frame < appearAt) return <span key={charIndex} style={{ opacity: 0 }}>{char}</span>;
                  const locked = frame >= lockAt;
                  const glyph = locked
                    ? char
                    : pool[Math.floor(random(`${props.seed}-${i}-${tick}`) * pool.length)];
                  return (
                    <span
                      key={charIndex}
                      style={{
                        color: locked ? (word.highlighted ? props.accent : props.color) : props.accent,
                        opacity: locked ? 1 : 0.55 + 0.45 * random(`o${props.seed}-${i}-${tick}`),
                      }}
                    >
                      {glyph}
                    </span>
                  );
                })}
              </span>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
