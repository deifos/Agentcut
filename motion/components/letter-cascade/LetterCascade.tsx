import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { FONTS, exitOut, fill, mix, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lines: string[];
  direction: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  uppercase: boolean;
  stagger: number;
  bounce: number;
};

/** Each letter springs up out of its own mask with a little rotation: the classic per-character cascade. */
export function LetterCascade(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.1 : 1);
  const out = exitOut(frame, d, 14);
  const sign = props.direction === "drop" ? -1 : 1;
  // Letters leave in the order they came: the exit is a fast cascade back into the mask.
  const exitStart = d - 16;
  const total = props.lines.reduce((n, line) => n + line.replace(/[\s*]/g, "").length, 0);
  let index = 0;

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: "center",
        justifyContent: "center",
        padding: `0 ${Math.round((vertical ? 60 : 110) * u)}px`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {props.lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              columnGap: fontSize * 0.25,
              fontFamily: FONTS[props.font] ?? FONTS.sans,
              fontWeight: Number(props.weight) || 800,
              fontSize,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textTransform: props.uppercase ? "uppercase" : undefined,
            }}
          >
            {splitHighlights(line).map((word, wordIndex) => (
              // The mask: each word clips its letters, so they rise out of the baseline.
              <span
                key={wordIndex}
                style={{ display: "inline-flex", overflow: "hidden", padding: `${fontSize * 0.08}px 0 ${fontSize * 0.14}px` }}
              >
                {Array.from(word.text).map((char, charIndex) => {
                  const i = index++;
                  const t = spring({
                    frame: frame - i * props.stagger,
                    fps,
                    config: { damping: mix(26, 9, props.bounce), stiffness: 160, mass: 0.8 },
                  });
                  const leave = clampLeave(frame - (exitStart + (i / Math.max(1, total)) * 10));
                  const y = (1 - t) * fontSize * 1.1 * sign - leave * fontSize * 1.1 * sign;
                  return (
                    <span
                      key={charIndex}
                      style={{
                        display: "inline-block",
                        color: word.highlighted ? props.accent : props.color,
                        transform: `translateY(${y}px) rotate(${(1 - t) * 14 * sign}deg)`,
                        transformOrigin: "0% 100%",
                        opacity: out < 0.02 ? 0 : 1,
                      }}
                    >
                      {char}
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

/** 0→1 over 8 frames, eased in (letters accelerate away). */
function clampLeave(f: number) {
  const t = Math.min(1, Math.max(0, f / 8));
  return t * t * t;
}
