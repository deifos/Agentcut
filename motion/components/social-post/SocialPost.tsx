import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { FONTS, blurStyle, easeOutExpo, exitOut, fill, mix, onColor, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  name: string;
  handle: string;
  text: string;
  time: string;
  replies: number;
  reposts: number;
  likes: number;
  views: number;
  verified: boolean;
  accent: string;
  theme: string;
  background: string;
};

/** 1234 → "1.2K", 3400000 → "3.4M". */
function compact(n: number) {
  const v = Math.round(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1e4) return `${(v / 1e3).toFixed(0)}K`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

const ICONS = {
  reply: "M3 11a8 8 0 0 1 8-8h2a8 8 0 0 1 0 16h-1l-5 3v-4.5A8 8 0 0 1 3 11z",
  repost: "M7 4 3 8l4 4M3 8h12a4 4 0 0 1 4 4v1M17 20l4-4-4-4M21 16H9a4 4 0 0 1-4-4v-1",
  heart: "M12 20s-7.5-4.6-9.2-9.1C1.6 7.6 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.4 3.1 4.2 6.4C19.5 15.4 12 20 12 20z",
  views: "M4 20V12M10 20V6M16 20v-9M22 20V3",
};

/** An X/Threads-style post that slides up, then its counters tick up and the heart pops red. */
export function SocialPost(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const dark = props.theme === "dark";
  const cardWidth = Math.min(width * (vertical ? 0.9 : 0.5), 1100 * u);
  const s = cardWidth / 900;
  const rise = spring({ frame, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } });
  const out = exitOut(frame, d, 14);
  const count = ramp(frame, 22, Math.max(20, d * 0.45), easeOutExpo);
  const likeAt = 26;
  const heart = spring({ frame: frame - likeAt, fps, config: { damping: 9, stiffness: 200, mass: 0.6 } });
  const liked = frame >= likeAt;
  const burst = ramp(frame, likeAt, 16);

  const fg = dark ? "#e7e9ea" : "#0f1419";
  const muted = dark ? "#71767b" : "#536471";
  const cardBg = dark ? "#000000" : "#ffffff";
  const red = "#f91880";
  const iconSize = 34 * s;

  const stat = (key: keyof typeof ICONS, value: number, active = false) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 * s, color: active ? red : muted }}>
      <div style={{ position: "relative", width: iconSize, height: iconSize }}>
        {active && burst > 0 && burst < 1
          ? Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              const r = mix(10, 34, burst) * s;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: iconSize / 2 + Math.cos(a) * r - 4 * s,
                    top: iconSize / 2 + Math.sin(a) * r - 4 * s,
                    width: 8 * s,
                    height: 8 * s,
                    borderRadius: "50%",
                    background: i % 2 ? red : props.accent,
                    opacity: 1 - burst,
                  }}
                />
              );
            })
          : null}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          style={{ position: "absolute", inset: 0, transform: active ? `scale(${liked ? mix(0.4, 1, heart) : 1})` : undefined }}
        >
          <path
            d={ICONS[key]}
            fill={active && liked ? red : "none"}
            stroke="currentColor"
            strokeWidth={active && liked ? 0 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span style={{ fontSize: 28 * s, fontVariantNumeric: "tabular-nums" }}>{compact(value * count)}</span>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: fill(props.background), alignItems: "center", justifyContent: "center", opacity: out }}>
      <div
        style={{
          width: cardWidth,
          boxSizing: "border-box",
          padding: `${40 * s}px ${44 * s}px ${34 * s}px`,
          borderRadius: 36 * s,
          background: cardBg,
          border: `${Math.max(1, 2 * s)}px solid ${dark ? "#2f3336" : "#eff3f4"}`,
          boxShadow: `0 ${30 * s}px ${90 * s}px rgba(0,0,0,${dark ? 0.55 : 0.18})`,
          fontFamily: FONTS.sans,
          color: fg,
          opacity: Math.min(1, rise * 1.5),
          transform: `translateY(${mix(160 * s, 0, rise)}px) scale(${mix(0.94, 1, rise)})`,
          ...blurStyle((1 - Math.min(1, rise)) * 10 * s),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 * s }}>
          <div
            style={{
              flexShrink: 0,
              width: 92 * s,
              height: 92 * s,
              borderRadius: "50%",
              background: props.accent,
              color: onColor(props.accent),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36 * s,
              fontWeight: 700,
            }}
          >
            {initials(props.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 * s, fontSize: 32 * s, fontWeight: 700 }}>
              <span style={{ whiteSpace: "nowrap" }}>{props.name}</span>
              {props.verified ? (
                <svg width={32 * s} height={32 * s} viewBox="0 0 24 24">
                  <path
                    d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z"
                    fill="#1d9bf0"
                  />
                  <path d="M7.8 12.2l2.8 2.8 5.6-5.8" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </div>
            <div style={{ fontSize: 28 * s, color: muted, whiteSpace: "nowrap" }}>
              @{props.handle.replace(/^@/, "")} · {props.time}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 26 * s, fontSize: 38 * s, lineHeight: 1.38, whiteSpace: "pre-wrap", letterSpacing: "-0.005em" }}>
          {props.text}
        </div>
        <div
          style={{
            marginTop: 30 * s,
            paddingTop: 24 * s,
            borderTop: `${Math.max(1, 2 * s)}px solid ${dark ? "#2f3336" : "#eff3f4"}`,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {stat("reply", props.replies)}
          {stat("repost", props.reposts)}
          {stat("heart", props.likes, true)}
          {stat("views", props.views)}
        </div>
      </div>
    </AbsoluteFill>
  );
}
