import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, exitOut, mix, onColor, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  app: string;
  icon: string;
  title: string;
  message: string;
  time: string;
  accent: string;
  theme: string;
  position: string;
  stack: number;
};

/** A phone-style notification that drops in with a spring, with optional earlier ones stacked behind. */
export function Notification(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const dark = props.theme === "dark";
  const cardWidth = Math.min(width * (vertical ? 0.9 : 0.42), 980 * u * (vertical ? 1.15 : 1));
  const s = cardWidth / 760;
  const drop = spring({ frame, fps, config: { damping: 15, stiffness: 140, mass: 0.9 } });
  const leave = 1 - exitOut(frame, d, 14);
  const top = props.position === "top";
  const fromY = top ? -260 * s : 120 * s;
  const y = mix(fromY, 0, drop) + (top ? -leave * 300 * s : leave * 60 * s);
  const stack = Math.round(props.stack);
  const stackIn = ramp(frame, 10, 14);
  const bg = dark ? "rgba(32, 33, 38, 0.94)" : "rgba(250, 250, 252, 0.96)";
  const fg = dark ? "#f4f4f5" : "#111114";
  const muted = dark ? "rgba(244,244,245,0.55)" : "rgba(17,17,20,0.5)";
  const radius = 44 * s;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: top ? "flex-start" : "center",
        paddingTop: top ? (vertical ? 120 : 60) * u : 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: cardWidth,
          transform: `translateY(${y}px) scale(${mix(0.92, 1, drop)})`,
          opacity: Math.min(1, drop * 1.5) * (1 - leave),
          ...blurStyle((1 - Math.min(1, drop)) * 12 * s + leave * 10 * s),
        }}
      >
        {/* Older notifications peeking out underneath. */}
        {Array.from({ length: stack }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (i + 1) * 26 * s,
              right: (i + 1) * 26 * s,
              bottom: -(i + 1) * 18 * s * stackIn,
              height: 80 * s,
              borderRadius: radius,
              background: bg,
              opacity: (0.7 - i * 0.25) * stackIn,
            }}
          />
        ))}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: 26 * s,
            padding: `${28 * s}px ${32 * s}px`,
            borderRadius: radius,
            background: bg,
            boxShadow: `0 ${24 * s}px ${70 * s}px rgba(0,0,0,${dark ? 0.5 : 0.25})`,
            fontFamily: FONTS.sans,
            color: fg,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 96 * s,
              height: 96 * s,
              borderRadius: 24 * s,
              background: props.accent,
              color: onColor(props.accent),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 50 * s,
              fontWeight: 800,
            }}
          >
            {props.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 * s }}>
              <span style={{ fontSize: 25 * s, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: muted }}>
                {props.app}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 25 * s, color: muted }}>{props.time}</span>
            </div>
            <div style={{ marginTop: 6 * s, fontSize: 33 * s, fontWeight: 700, lineHeight: 1.2 }}>{props.title}</div>
            <div style={{ marginTop: 4 * s, fontSize: 31 * s, lineHeight: 1.3, color: fg, opacity: 0.85 }}>{props.message}</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
