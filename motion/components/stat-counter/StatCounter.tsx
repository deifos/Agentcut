import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { FONTS, exitOut, mix, pop, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  label: string;
  accent: string;
  textColor: string;
  background: string;
  ring: boolean;
  countFrames: number;
};

function format(value: number, decimals: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A big number that counts up to its value, with a label and an optional progress ring. */
export function StatCounter(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = props;
  const u = unit(width, height);
  const appear = pop(frame, fps, 0);
  const count = ramp(frame, 4, props.countFrames, Easing.bezier(0.16, 1, 0.3, 1));
  const labelIn = ramp(frame, 10, 16);
  const out = exitOut(frame, durationInFrames);
  const shown = props.value * count;
  const size = 220 * u;
  const ringSize = size * 2.2;
  const stroke = 16 * u;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A % value fills the ring to it; any other value fills it completely as it counts.
  const fill = props.suffix.trim() === "%" ? Math.min(1, Math.max(0, shown / 100)) : count;
  const done = count >= 0.999;

  return (
    <AbsoluteFill
      style={{
        background: props.background === "transparent" ? undefined : props.background,
        alignItems: "center",
        justifyContent: "center",
        opacity: out,
      }}
    >
      <div
        style={{
          position: "relative",
          width: props.ring ? ringSize : undefined,
          height: props.ring ? ringSize : undefined,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${mix(0.86, 1, appear)})`,
          opacity: Math.min(1, appear * 1.4),
        }}
      >
        {props.ring ? (
          <svg width={ringSize} height={ringSize} style={{ position: "absolute", inset: 0 }}>
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={props.textColor} strokeOpacity={0.12} strokeWidth={stroke} />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke={props.accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fill)}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            />
          </svg>
        ) : null}
        <div
          style={{
            fontFamily: FONTS.sans,
            fontWeight: 800,
            fontSize: props.ring ? size * 0.62 : size,
            letterSpacing: "-0.045em",
            lineHeight: 1,
            color: props.textColor,
            fontVariantNumeric: "tabular-nums",
            // A small settle when the count lands.
            transform: `scale(${done ? 1 : mix(0.98, 1, count)})`,
          }}
        >
          <span style={{ color: props.accent }}>{props.prefix}</span>
          {format(shown, props.decimals)}
          <span style={{ color: props.accent }}>{props.suffix}</span>
        </div>
        {props.label ? (
          <div
            style={{
              marginTop: 18 * u,
              maxWidth: props.ring ? ringSize * 0.7 : 900 * u,
              textAlign: "center",
              fontFamily: FONTS.sans,
              fontWeight: 600,
              fontSize: 40 * u,
              color: props.textColor,
              opacity: 0.75 * labelIn,
              transform: `translateY(${mix(14, 0, labelIn) * u}px)`,
            }}
          >
            {props.label}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
