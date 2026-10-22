import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, exitOut, mix, pop, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  name: string;
  title: string;
  accent: string;
  textColor: string;
  panel: string;
  position: string;
  font: string;
};

/** A name and role card that slides in at the bottom of the frame, holds, and slides out. */
export function LowerThird(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const right = props.position.endsWith("right");
  const top = props.position.startsWith("top");
  const bar = pop(frame, fps, 0, 200);
  const card = pop(frame, fps, 4);
  const titleIn = ramp(frame, 12, 14);
  const out = exitOut(frame, durationInFrames, 14);
  const exitShift = (1 - out) * 60 * u * (right ? 1 : -1);
  const nameSize = (vertical ? 54 : 46) * u;
  const margin = (vertical ? 64 : 80) * u;

  return (
    <AbsoluteFill
      style={{
        justifyContent: top ? "flex-start" : "flex-end",
        alignItems: right ? "flex-end" : "flex-start",
        padding: `${margin * (vertical ? 2.6 : 1)}px ${margin}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: right ? "row-reverse" : "row",
          alignItems: "stretch",
          gap: 14 * u,
          opacity: out,
          transform: `translateX(${exitShift}px)`,
        }}
      >
        <div
          style={{
            width: 8 * u,
            borderRadius: 8 * u,
            background: props.accent,
            transform: `scaleY(${bar})`,
            transformOrigin: "bottom",
          }}
        />
        <div
          style={{
            background: props.panel,
            borderRadius: 18 * u,
            padding: `${18 * u}px ${28 * u}px`,
            boxShadow: `0 ${18 * u}px ${48 * u}px rgba(0,0,0,0.28)`,
            transform: `translateX(${mix(right ? 40 : -40, 0, card) * u}px)`,
            opacity: Math.min(1, card * 1.3),
            textAlign: right ? "right" : "left",
          }}
        >
          <div
            style={{
              fontFamily: FONTS[props.font] ?? FONTS.sans,
              fontWeight: 800,
              fontSize: nameSize,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: props.textColor,
            }}
          >
            {props.name}
          </div>
          {props.title ? (
            <div
              style={{
                marginTop: 6 * u,
                fontFamily: FONTS.sans,
                fontWeight: 500,
                fontSize: nameSize * 0.52,
                color: props.textColor,
                opacity: 0.72 * titleIn,
                transform: `translateY(${mix(10, 0, titleIn) * u}px)`,
              }}
            >
              {props.title}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
}
