import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, exitOut, fill, glowStyle, mix, onColor, pop, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  from: number;
  final: string;
  style: string;
  color: string;
  accent: string;
  track: string;
  background: string;
  size: number;
  font: string;
  glow: boolean;
};

/**
 * A countdown: big numbers count down from `from`, each punching in on its own beat with an arc
 * draining around it, then the final word lands. The clip is split evenly among the beats.
 */
export function Countdown(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const out = exitOut(frame, d, 10);
  const from = Math.max(1, Math.round(props.from));
  const hasFinal = props.final.trim().length > 0;
  const beats = from + (hasFinal ? 1 : 0);
  const beat = d / beats;
  const index = Math.min(beats - 1, Math.floor(frame / beat));
  const local = frame - index * beat;
  const progress = Math.min(1, local / beat);
  const isFinal = hasFinal && index === from;
  const isLast = index === beats - 1;
  const label = isFinal ? props.final : String(from - index);

  const base = (props.size / 100) * Math.min(width, height) * (vertical ? 1.1 : 1);
  const hit = pop(local, fps, 0, 320);
  // Each number leaves fast in the last frames of its beat (the last one stays for the clip's exit).
  const leave = isLast ? 0 : ramp(local, beat - 4, 4);
  const ringSize = base * 2.3;
  const stroke = Math.max(3, base * (props.style === "minimal" ? 0.025 : 0.07));
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const finalLength = Math.max(1, Array.from(label).length);
  // Long final words shrink to fit the frame.
  const fontSize = isFinal
    ? Math.min(base * 1.05, (width * (vertical ? 0.86 : 0.8)) / (finalLength * 0.62))
    : base * (props.style === "bold" ? 1.35 : 1);

  const scale =
    props.style === "bold" ? mix(1.9, 1, hit) * mix(1, 0.7, leave) : mix(0.55, 1, hit) * mix(1, 1.25, leave);
  const shake = props.style === "bold" && local < 6 ? Math.sin(local * 2.6) * (1 - local / 6) * 14 * u : 0;
  const color = isFinal ? props.accent : props.color;
  const font = FONTS[props.font] ?? FONTS.condensed;

  return (
    <AbsoluteFill
      style={{ background: fill(props.background), alignItems: "center", justifyContent: "center", opacity: out }}
    >
      {props.glow ? (
        <div
          style={glowStyle(width / 2, height / 2, ringSize * 1.8, ringSize * 1.8, props.accent, (isFinal ? 0.55 : 0.3) * hit)}
        />
      ) : null}

      {props.style === "bold" && !isFinal ? (
        // A solid disc punches behind every number, alternating accent and track.
        <div
          style={{
            position: "absolute",
            width: ringSize,
            height: ringSize,
            borderRadius: "50%",
            background: index % 2 === 0 ? props.accent : props.track,
            transform: `scale(${mix(0.2, 1, hit) * mix(1, 1.6, leave)})`,
            opacity: 1 - leave,
          }}
        />
      ) : null}

      {props.style === "ring" || (props.style === "bold" && isFinal) ? (
        <svg
          width={ringSize}
          height={ringSize}
          style={{ position: "absolute", transform: `rotate(-90deg) scale(${isFinal ? mix(0.8, 1.15, ramp(local, 0, 20)) : 1})` }}
        >
          <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={props.track} strokeWidth={stroke} />
          {!isFinal ? (
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke={props.accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * progress}
            />
          ) : null}
        </svg>
      ) : null}

      {isFinal
        ? // Two rings ripple out as the final word lands.
          [0, 6].map((delay) => {
            const t = ramp(local, delay, 22);
            if (t <= 0 || t >= 1) return null;
            return (
              <div
                key={delay}
                style={{
                  position: "absolute",
                  width: ringSize,
                  height: ringSize,
                  borderRadius: "50%",
                  border: `${Math.max(2, stroke * 0.6)}px solid ${props.accent}`,
                  transform: `scale(${mix(0.6, 1.9, t)})`,
                  opacity: 1 - t,
                }}
              />
            );
          })
        : null}

      <div
        style={{
          position: "relative",
          fontFamily: font,
          fontWeight: props.font === "condensed" ? 400 : props.style === "minimal" ? 300 : 800,
          fontSize,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          color: props.style === "bold" && !isFinal && index % 2 === 0 ? onColor(props.accent) : color,
          opacity: Math.min(1, hit * 1.5) * (1 - leave),
          transform: `translateX(${shake}px) scale(${scale})`,
        }}
      >
        {label}
      </div>

      {props.style === "minimal" && !isFinal ? (
        // A thin progress line under the number.
        <div
          style={{
            position: "absolute",
            top: height / 2 + base * 0.78,
            width: base * 1.4,
            height: Math.max(2, 3 * u),
            background: props.track,
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${(1 - progress) * 100}%`, height: "100%", background: props.accent }} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
}

