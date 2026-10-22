import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { FONTS, alpha, blurStyle, easeInOut, easeOutExpo, exitOut, fill, mix, onColor, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  title: string;
  items: string[];
  accent: string;
  theme: string;
  background: string;
  strike: boolean;
  progress: boolean;
};

/** A to-do card: items get ticked off one by one (a checkmark draws in a filling circle), with a progress bar. */
export function Checklist(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const dark = props.theme === "dark";
  const items = props.items.filter((i) => i.trim()).slice(0, 6);
  const n = Math.max(1, items.length);
  const cardWidth = Math.min(width * (vertical ? 0.88 : 0.46), 1000 * u);
  const s = cardWidth / 800;
  const enter = spring({ frame, fps, config: { damping: 17, stiffness: 130, mass: 0.9 } });
  const out = exitOut(frame, d, 14);
  // Ticks spread from just after the entrance to ~25 frames before the end.
  const first = 18;
  const gap = Math.max(6, Math.min(20, (d - 30 - first) / n));
  const tickAt = (i: number) => first + i * gap;
  const done = items.reduce((sum, _, i) => sum + ramp(frame, tickAt(i), 10, easeInOut), 0);

  const fg = dark ? "#f4f4f5" : "#111114";
  const muted = dark ? "rgba(244,244,245,0.42)" : "rgba(17,17,20,0.4)";
  const line = dark ? "rgba(255,255,255,0.1)" : "rgba(17,17,20,0.09)";
  const box = 50 * s;
  const fontSize = 36 * s;

  return (
    <AbsoluteFill style={{ background: fill(props.background), alignItems: "center", justifyContent: "center", opacity: out }}>
      <div
        style={{
          width: cardWidth,
          boxSizing: "border-box",
          padding: `${44 * s}px ${48 * s}px`,
          borderRadius: 40 * s,
          background: dark ? "#16171c" : "#ffffff",
          border: `${Math.max(1, 2 * s)}px solid ${line}`,
          boxShadow: `0 ${30 * s}px ${90 * s}px rgba(0,0,0,${dark ? 0.5 : 0.16})`,
          fontFamily: FONTS.sans,
          color: fg,
          opacity: Math.min(1, enter * 1.5),
          transform: `translateY(${mix(120 * s, 0, enter)}px) scale(${mix(0.94, 1, enter)})`,
          ...blurStyle((1 - Math.min(1, enter)) * 10 * s),
        }}
      >
        {props.title ? (
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 26 * s }}>
            <div style={{ fontFamily: FONTS.display, fontSize: 48 * s, fontWeight: 700, letterSpacing: "-0.03em" }}>{props.title}</div>
            <div style={{ marginLeft: "auto", fontFamily: FONTS.mono, fontSize: 26 * s, color: muted }}>
              {Math.round(done)}/{items.length}
            </div>
          </div>
        ) : null}
        {items.map((item, i) => {
          const t = tickAt(i);
          const rowIn = ramp(frame, 4 + i * 3, 18, easeOutExpo);
          const check = spring({ frame: frame - t, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
          const draw = ramp(frame, t + 2, 9, easeInOut);
          const dim = ramp(frame, t + 4, 10);
          const on = frame >= t;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26 * s,
                padding: `${18 * s}px 0`,
                borderTop: i > 0 ? `${Math.max(1, 1.5 * s)}px solid ${line}` : undefined,
                opacity: rowIn,
                transform: `translateX(${(1 - rowIn) * 40 * s}px)`,
              }}
            >
              <svg width={box} height={box} viewBox="0 0 50 50" style={{ flexShrink: 0 }}>
                <circle cx={25} cy={25} r={22} fill="none" stroke={on ? props.accent : muted} strokeWidth={3} />
                {on ? <circle cx={25} cy={25} r={23.5 * Math.min(1.08, check)} fill={props.accent} /> : null}
                <path
                  d="M15 25.5l7 7 13-14"
                  fill="none"
                  stroke={onColor(props.accent)}
                  strokeWidth={4.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - draw}
                  opacity={draw > 0 ? 1 : 0}
                />
              </svg>
              <div style={{ position: "relative", fontSize, lineHeight: 1.25, color: fg, opacity: mix(1, 0.45, dim) }}>
                {item}
                {props.strike ? (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "52%",
                      height: Math.max(2, 3 * s),
                      width: `${ramp(frame, t + 3, 12, easeInOut) * 100}%`,
                      borderRadius: 3 * s,
                      background: fg,
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        {props.progress ? (
          <div style={{ marginTop: 22 * s, height: 12 * s, borderRadius: 12 * s, background: alpha(props.accent, dark ? 0.16 : 0.14), overflow: "hidden" }}>
            <div style={{ width: `${(done / n) * 100}%`, height: "100%", borderRadius: 12 * s, background: props.accent }} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
