import { useId } from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { FONTS, easeInOut, easeOutExpo, mix, ramp } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  text: string;
  color: string;
  background: string;
  backdrop: boolean;
  font: string;
  originX: number;
  originY: number;
  zoom: number;
  reveal: string;
};

const easeIn = Easing.bezier(0.7, 0, 0.84, 0);

/**
 * A type-led cut: one big word fills the frame, then the camera dives into it, faster and faster,
 * until the letters' color swallows the screen at the clip's midpoint. Then the color clears
 * (fade, wipe or an iris from the zoom point) to reveal whatever is under the clip.
 */
export function TypeZoom(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const id = `tz${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mid = d / 2;
  const text = props.text || " ";
  // Fit the word to the frame (condensed faces are narrower per letter).
  const perChar = props.font === "condensed" ? 0.5 : props.font === "wide" ? 0.82 : 0.64;
  const fontSize = Math.min(height * 0.62, (width * 0.9) / Math.max(1, text.length * perChar));

  const textIn = ramp(frame, 0, d * 0.2, easeOutExpo);
  const zoomT = ramp(frame, d * 0.2, mid - d * 0.2, easeIn);
  const scale = Math.pow(props.zoom, zoomT) * mix(0.86, 1, textIn);
  // The solid comes up over the last part of the dive, so the screen is fully covered at the cut.
  const cover = ramp(frame, mid - d * 0.12, d * 0.12, easeIn);
  const revealT = ramp(frame, mid, d - mid, easeInOut);
  const before = frame < mid;

  const cx = (props.originX / 100) * width;
  const cy = (props.originY / 100) * height;
  const reach = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(width - cx, cy),
    Math.hypot(cx, height - cy),
    Math.hypot(width - cx, height - cy),
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {before ? (
        <>
          {props.backdrop ? <AbsoluteFill style={{ background: props.background }} /> : null}
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              transformOrigin: `${props.originX}% ${props.originY}%`,
              transform: `scale(${scale})`,
              opacity: textIn,
            }}
          >
            <div
              style={{
                fontFamily: FONTS[props.font] ?? FONTS.condensed,
                fontWeight: props.font === "condensed" ? 400 : 800,
                fontSize,
                lineHeight: 1,
                letterSpacing: props.font === "condensed" ? "0.01em" : "-0.04em",
                color: props.color,
                whiteSpace: "nowrap",
                textTransform: "uppercase",
              }}
            >
              {text}
            </div>
          </AbsoluteFill>
        </>
      ) : null}
      {cover > 0 ? (
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <mask id={`${id}-hole`}>
              <rect width={width} height={height} fill="white" />
              <circle cx={cx} cy={cy} r={reach * 1.02 * revealT} fill="black" />
            </mask>
          </defs>
          <rect
            width={width}
            height={height}
            fill={props.color}
            opacity={props.reveal === "fade" ? cover * (1 - revealT) : cover}
            y={props.reveal === "wipe" ? -height * revealT : 0}
            mask={props.reveal === "iris" && !before ? `url(#${id}-hole)` : undefined}
          />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
}
