import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, easeOutExpo, fill, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  words: string[];
  beat: number;
  color: string;
  accent: string;
  background: string;
  flashBackground: string;
  size: number;
  font: string;
  weight: string;
  uppercase: boolean;
  alternate: boolean;
  shake: boolean;
};

/**
 * Fast kinetic type: one word (or short phrase) per beat, slammed in from a big blurred scale and
 * creeping forward while it holds. Every other beat can flip the colors for a strobe-like rhythm.
 */
export function KineticPunch(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const words = props.words.length ? props.words : [""];
  // Beats shrink to fit if the clip is shorter than all the words at the chosen pace.
  const beat = Math.max(4, Math.min(props.beat, d / words.length));
  const index = Math.min(words.length - 1, Math.floor(frame / beat));
  const local = frame - index * beat;
  const word = words[index];
  const flipped = props.alternate && index % 2 === 1;
  const fg = flipped ? props.flashBackground : index % 2 === 1 ? props.accent : props.color;
  const bg = flipped ? props.accent : props.background;

  // Size from the longest line in this beat, so long phrases still fit.
  const longest = Math.max(1, ...word.split("|").map((part) => part.length));
  const base = (props.size / 100) * Math.min(width, height) * (vertical ? 1.15 : 1);
  const fontSize = Math.min(base, (width * (vertical ? 0.86 : 0.8)) / (longest * 0.56));
  const t = interpolate(local, [0, Math.min(6, beat * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easeOutExpo,
  });
  const creep = 1 + (local / beat) * 0.06;
  const scale = (1.6 - 0.6 * t) * creep;
  const shake = props.shake && local < 5 ? Math.sin(local * 2.7 + index) * (5 - local) * 3 * u : 0;
  const lastFade = interpolate(frame, [d - 6, d], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: fill(bg), alignItems: "center", justifyContent: "center", opacity: lastFade }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: FONTS[props.font] ?? FONTS.condensed,
          fontWeight: Number(props.weight) || 800,
          fontSize,
          lineHeight: 0.92,
          letterSpacing: "-0.02em",
          textTransform: props.uppercase ? "uppercase" : undefined,
          color: fg,
          transform: `translate(${shake}px, ${shake * 0.4}px) scale(${scale})`,
          opacity: Math.min(1, t * 2),
          ...blurStyle((1 - t) * fontSize * 0.08),
        }}
      >
        {word.split("|").map((part, i) => (
          <span key={i} style={{ whiteSpace: "nowrap" }}>
            {part}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}
