import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { FONTS, exitOut, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lines: string[];
  enterFrom: string;
  pan: string;
  zoom: number;
  color: string;
  accent: string;
  background: string;
  size: number;
  weight: string;
  font: string;
  motionBlur: boolean;
};

const out = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * The classic intro move: the message slides in from the side with motion blur, the camera
 * pushes in on its first words, travels along the line, then pulls back to show it all.
 * Phases scale with the clip length: slide 0–16%, hold, zoom in 24–44%, pan 44–68%, zoom out 68–88%.
 */
export function SlideZoomMessage(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const fontSize =
    (props.size / 100) * Math.min(width, height) * (vertical ? 1.15 : 1);
  const at = (fraction: number) => Math.round(d * fraction);
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  // 1. Slide in (with a velocity-based motion trail).
  const sign = props.enterFrom === "right" ? 1 : -1;
  const travel = width * 0.75;
  const slideAt = (f: number) =>
    interpolate(f, [0, at(0.16)], [sign * travel, 0], {
      ...clamp,
      easing: out,
    });
  const x = slideAt(frame);
  const velocity = x - slideAt(frame - 1);

  // 2–4. Camera: focus point and scale (the content moves the opposite way).
  const span = width * (vertical ? 0.16 : 0.24);
  const start = props.pan === "right" ? span : -span;
  const end = -start;
  const zoomT = interpolate(frame, [at(0.24), at(0.44)], [0, 1], {
    ...clamp,
    easing: inOut,
  });
  const panT = interpolate(frame, [at(0.44), at(0.68)], [0, 1], {
    ...clamp,
    easing: inOut,
  });
  const backT = interpolate(frame, [at(0.68), at(0.88)], [0, 1], {
    ...clamp,
    easing: inOut,
  });
  const scale = 1 + (props.zoom - 1) * zoomT * (1 - backT);
  const focus = (start * zoomT + (end - start) * panT) * (1 - backT);
  const camAt = (f: number) => {
    const z = interpolate(f, [at(0.24), at(0.44)], [0, 1], {
      ...clamp,
      easing: inOut,
    });
    const p = interpolate(f, [at(0.44), at(0.68)], [0, 1], {
      ...clamp,
      easing: inOut,
    });
    const b = interpolate(f, [at(0.68), at(0.88)], [0, 1], {
      ...clamp,
      easing: inOut,
    });
    return {
      s: 1 + (props.zoom - 1) * z * (1 - b),
      x: (start * z + (end - start) * p) * (1 - b),
    };
  };
  const previous = camAt(frame - 1);
  const camSpeed =
    Math.abs(focus * scale - previous.x * previous.s) +
    Math.abs(scale - previous.s) * width * 0.25;

  const fade = exitOut(frame, d, 10);
  const blurPx = props.motionBlur
    ? Math.min(14 * u, Math.abs(velocity) * 0.05 + camSpeed * 0.03)
    : 0;
  const trail = props.motionBlur
    ? Math.min(Math.abs(velocity) / (8 * u), 6)
    : 0;

  const text = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: fontSize * 0.04,
        fontFamily: FONTS[props.font] ?? FONTS.sans,
        fontWeight: Number(props.weight) || 800,
        fontSize,
        lineHeight: 1.02,
        letterSpacing: "-0.04em",
        whiteSpace: "nowrap",
      }}
    >
      {props.lines.map((line, i) => (
        <div key={i} style={{ display: "flex", gap: fontSize * 0.26 }}>
          {splitHighlights(line).map((word, j) => (
            <span
              key={j}
              style={{ color: word.highlighted ? props.accent : props.color }}
            >
              {word.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        background:
          props.background === "transparent" ? undefined : props.background,
        overflow: "hidden",
        opacity: fade,
      }}
    >
      {/* Blur on an untransformed layer: the browser export clips a filtered element to its own box. */}
      <AbsoluteFill
        style={{
          filter: blurPx > 0.4 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        }}
      >
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${scale}) translateX(${-focus}px)`,
          }}
        >
          {/* Ghost copies behind the text, spaced by its speed: a motion trail the browser export can draw. */}
          {Array.from({ length: Math.ceil(trail) }, (_, i) => (
            <AbsoluteFill
              key={i}
              style={{
                alignItems: "center",
                justifyContent: "center",
                transform: `translateX(${x - velocity * (i + 1) * 0.6}px)`,
                opacity: 0.22 * (1 - i / Math.max(1, trail)),
              }}
            >
              {text}
            </AbsoluteFill>
          ))}
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              transform: `translateX(${x}px)`,
            }}
          >
            {text}
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
