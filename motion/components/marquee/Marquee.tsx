import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, easeOutExpo, exitOut, fill, mix, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  rows: string[];
  separator: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  font: string;
  weight: string;
  uppercase: boolean;
  outline: boolean;
  speed: number;
  tilt: number;
};

/**
 * Rows of big type scrolling in alternating directions, endlessly. Each row is its phrase repeated
 * twice over; moving it by half its own width loops it seamlessly at any text length.
 */
export function Marquee(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.1 : 1);
  const enter = ramp(frame, 0, 20, easeOutExpo);
  const out = exitOut(frame, d, 12);
  const rows = props.rows.length ? props.rows : [""];

  return (
    <AbsoluteFill style={{ background: fill(props.background), overflow: "hidden", opacity: out }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          gap: fontSize * 0.12,
          transform: `rotate(${props.tilt}deg) scale(${1 + Math.abs(props.tilt) * 0.025})`,
        }}
      >
        {rows.map((row, i) => {
          const dir = i % 2 === 0 ? -1 : 1;
          const outlined = props.outline && i % 2 === 1;
          // Repeat the phrase enough times that half the row is wider than the (tilted) frame.
          const phraseWidth = Math.max(1, (row.length + 3) * fontSize * 0.55);
          const repeats = Math.max(2, Math.ceil((width * 1.8) / phraseWidth));
          const phrase = Array.from({ length: repeats }, () => row);
          // About a quarter of the frame width per second at 1×; the loop itself is exact (percent of the row).
          const progress = (((frame / fps) * props.speed * width * 0.25) / (repeats * phraseWidth)) % 1;
          const shift = dir < 0 ? -progress * 50 : -50 + progress * 50;
          const rowIn = ramp(frame, i * 3, 22, easeOutExpo);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                width: "max-content",
                marginLeft: -width * 0.3,
                whiteSpace: "nowrap",
                fontFamily: FONTS[props.font] ?? FONTS.condensed,
                fontWeight: Number(props.weight) || 800,
                fontSize,
                lineHeight: 1,
                letterSpacing: "-0.01em",
                textTransform: props.uppercase ? "uppercase" : undefined,
                color: outlined ? "transparent" : props.color,
                WebkitTextStrokeWidth: outlined ? Math.max(1.5, 2.5 * u) : undefined,
                WebkitTextStrokeColor: outlined ? props.color : undefined,
                transform: `translateX(${shift}%) translateX(${mix(dir * width * 0.15, 0, rowIn)}px)`,
                opacity: enter * rowIn,
              }}
            >
              {[0, 1].map((half) => (
                <span key={half} style={{ display: "flex" }}>
                  {phrase.map((text, k) => (
                    <span key={k} style={{ display: "flex", alignItems: "center" }}>
                      <span>{text}</span>
                      <span
                        style={{
                          color: props.accent,
                          WebkitTextStrokeWidth: 0,
                          margin: `0 ${fontSize * 0.3}px`,
                          fontSize: fontSize * 0.6,
                        }}
                      >
                        {props.separator}
                      </span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
