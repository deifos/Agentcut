import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, exitOut, mix, pop, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  text: string;
  placeholder: string;
  theme: string;
  accent: string;
  speed: number;
  delay: number;
  label: string;
};

/** An AI prompt box that types a request, then presses send. */
export function PromptBox(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const dark = props.theme !== "light";
  const appear = pop(frame, fps, 0);
  const out = exitOut(frame, durationInFrames);
  const typingFrames = (props.text.length / Math.max(1, props.speed)) * fps;
  const typed = Math.floor(
    Math.max(0, Math.min(props.text.length, ((frame - props.delay) / Math.max(1, typingFrames)) * props.text.length)),
  );
  const doneAt = props.delay + typingFrames;
  const press = frame >= doneAt + 6 ? ramp(frame, doneAt + 6, 8) : 0;
  const pressScale = press > 0 && press < 1 ? mix(1, 0.86, Math.sin(press * Math.PI)) : 1;
  const sent = frame >= doneAt + 10;
  const caretOn = !sent && Math.floor(frame / (fps * 0.5)) % 2 === 0;
  const boxWidth = Math.min(width * (vertical ? 0.88 : 0.62), 1400 * u);
  const fontSize = (vertical ? 40 : 34) * u;
  const surface = dark ? "#16181d" : "#ffffff";
  const border = dark ? "rgba(255,255,255,0.10)" : "rgba(10,12,16,0.10)";
  const ink = dark ? "#f4f4f5" : "#0b0d10";
  const muted = dark ? "rgba(244,244,245,0.42)" : "rgba(11,13,16,0.42)";
  const glow = sent ? ramp(frame, doneAt + 10, 14) : 0;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out }}>
      <div
        style={{
          width: boxWidth,
          transform: `translateY(${mix(40 * u, 0, appear)}px) scale(${mix(0.96, 1, appear)})`,
          opacity: Math.min(1, appear * 1.4),
        }}
      >
        {props.label ? (
          <div
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 700,
              fontSize: fontSize * 0.62,
              color: dark ? "rgba(255,255,255,0.7)" : "rgba(11,13,16,0.6)",
              marginBottom: 14 * u,
              paddingLeft: 6 * u,
            }}
          >
            {props.label}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 20 * u,
            background: surface,
            border: `${Math.max(1, 1.5 * u)}px solid ${border}`,
            borderRadius: 30 * u,
            padding: `${26 * u}px ${26 * u}px ${26 * u}px ${34 * u}px`,
            boxShadow: `0 ${24 * u}px ${70 * u}px rgba(0,0,0,${dark ? 0.45 : 0.16})${
              glow > 0 && /^#[0-9a-f]{6}$/i.test(props.accent)
                ? `, 0 0 ${60 * u * glow}px ${props.accent}${Math.round(glow * 70).toString(16).padStart(2, "0")}`
                : ""
            }`,
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: fontSize * 2.6,
              fontFamily: FONTS.sans,
              fontSize,
              lineHeight: 1.3,
              color: typed > 0 ? ink : muted,
              whiteSpace: "pre-wrap",
            }}
          >
            {typed > 0 ? props.text.slice(0, typed) : props.placeholder}
            <span
              style={{
                display: "inline-block",
                width: Math.max(2, 3 * u),
                height: fontSize * 1.1,
                marginLeft: 3 * u,
                verticalAlign: "text-bottom",
                background: props.accent,
                opacity: caretOn ? 1 : 0,
              }}
            />
          </div>
          <div
            style={{
              width: 64 * u,
              height: 64 * u,
              flexShrink: 0,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: typed >= props.text.length ? props.accent : dark ? "rgba(255,255,255,0.12)" : "rgba(11,13,16,0.08)",
              transform: `scale(${pressScale})`,
            }}
          >
            <svg width={30 * u} height={30 * u} viewBox="0 0 24 24" fill="none">
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke={typed >= props.text.length ? "#0b0d10" : muted}
                strokeWidth={2.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
