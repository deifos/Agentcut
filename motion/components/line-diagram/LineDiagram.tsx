import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, easeInOut, exitOut, fill, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  kind: string;
  title: string;
  labels: string[];
  color: string;
  accent: string;
  background: string;
  font: string;
  size: number;
  speed: number;
};

/** viewBox units: the diagram is drawn in a 1000×1000 square. */
const V = 1000;

/**
 * Minimal explainer line art that draws itself on, black-and-white with one accent: two ideas
 * overlapping, one reaching many, growth, a loop, small vs big, steps up. A title sits under it.
 */
export function LineDiagram(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const side = (props.size / 100) * Math.min(width, height) * (height > width ? 1.1 : 1);
  const out = exitOut(frame, d, 10);
  // Every stroke draws over `speed` frames, one after another.
  const step = Math.max(4, props.speed);
  const draw = (i: number) => ramp(frame, 4 + i * step * 0.6, step, easeInOut);
  const stroke = 7;
  const line = { fill: "none", stroke: props.color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, pathLength: 1, strokeDasharray: 1 };
  const label = (text: string | undefined, x: number, y: number, at: number, anchor: "start" | "middle" | "end" = "middle", accent = false) =>
    text ? (
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontFamily={FONTS[props.font] ?? FONTS.sans}
        fontWeight={800}
        fontSize={46}
        letterSpacing={2}
        fill={accent ? props.accent : props.color}
        // A dark outline keeps labels readable where they cross the lines.
        stroke="#000000"
        strokeWidth={14}
        paintOrder="stroke"
        opacity={ramp(frame, at, 8)}
        style={{ textTransform: "uppercase" }}
      >
        {text.toUpperCase()}
      </text>
    ) : null;
  const L = props.labels;

  let art: ReactNode = null;
  switch (props.kind) {
    case "venn": {
      const overlap = ramp(frame, 4 + step * 1.6, 10);
      art = (
        <>
          <defs>
            <clipPath id="ld-venn">
              <circle cx={380} cy={470} r={270} />
            </clipPath>
          </defs>
          <circle cx={620} cy={470} r={270} clipPath="url(#ld-venn)" fill={props.accent} opacity={overlap * 0.9} />
          <circle cx={380} cy={470} r={270} {...line} strokeDashoffset={1 - draw(0)} transform="rotate(-90 380 470)" />
          <circle cx={620} cy={470} r={270} {...line} strokeDashoffset={1 - draw(1)} transform="rotate(90 620 470)" />
          {label(L[0], 250, 485, 4 + step)}
          {label(L[1], 750, 485, 4 + step * 1.5)}
          {label(L[2], 500, 485, 4 + step * 2.2, "middle")}
        </>
      );
      break;
    }
    case "network": {
      const n = 8;
      const nodes = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        return { x: 500 + Math.cos(a) * 340, y: 470 + Math.sin(a) * 340 };
      });
      art = (
        <>
          {nodes.map((p, i) => (
            <path key={`l${i}`} d={`M 500 470 L ${p.x.toFixed(0)} ${p.y.toFixed(0)}`} {...line} strokeDashoffset={1 - ramp(frame, 10 + i * 2, 10)} />
          ))}
          {nodes.map((p, i) => {
            const t = ramp(frame, 18 + i * 2, 6);
            return <circle key={`n${i}`} cx={p.x} cy={p.y} r={34 * t} fill="#000000" stroke={props.color} strokeWidth={stroke} />;
          })}
          <circle cx={500} cy={470} r={62 * ramp(frame, 2, 8)} fill={props.accent} />
          {label(L[0], 500, 600, 14)}
          {label(L[1], 500, 930, 34)}
        </>
      );
      break;
    }
    case "growth": {
      const curve = "M 170 820 C 420 800, 560 700, 650 520 S 800 200, 850 150";
      const t = draw(1);
      art = (
        <>
          <path d="M 170 140 L 170 820 L 860 820" {...line} strokeDashoffset={1 - draw(0)} />
          <path d={curve} {...line} stroke={props.accent} strokeWidth={stroke * 1.4} strokeDashoffset={1 - t} />
          <circle cx={850} cy={150} r={22 * ramp(frame, 4 + step * 1.6 + step, 6)} fill={props.accent} />
          {label(L[0], 860, 890, 4 + step, "end")}
          {label(L[1], 200, 120, 4 + step, "start")}
        </>
      );
      break;
    }
    case "cycle": {
      const count = Math.max(3, Math.min(4, L.length || 3));
      const r = 300;
      const arcs = Array.from({ length: count }, (_, i) => {
        const a0 = (i / count) * Math.PI * 2 - Math.PI / 2 + 0.22;
        const a1 = ((i + 1) / count) * Math.PI * 2 - Math.PI / 2 - 0.22;
        const p0 = { x: 500 + Math.cos(a0) * r, y: 480 + Math.sin(a0) * r };
        const p1 = { x: 500 + Math.cos(a1) * r, y: 480 + Math.sin(a1) * r };
        const head = a1 + Math.PI / 2;
        const hx = (dx: number, dy: number) => `${(p1.x + dx * Math.cos(head) - dy * Math.sin(head)).toFixed(0)} ${(p1.y + dx * Math.sin(head) + dy * Math.cos(head)).toFixed(0)}`;
        return {
          d: `M ${p0.x.toFixed(0)} ${p0.y.toFixed(0)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(0)} ${p1.y.toFixed(0)}`,
          arrow: `M ${hx(-34, -26)} L ${p1.x.toFixed(0)} ${p1.y.toFixed(0)} L ${hx(-34, 26)}`,
        };
      });
      art = (
        <>
          {arcs.map((arc, i) => (
            <g key={i}>
              <path d={arc.d} {...line} strokeDashoffset={1 - draw(i)} />
              <path d={arc.arrow} {...line} strokeDashoffset={1 - ramp(frame, 4 + i * step * 0.6 + step, 4)} />
            </g>
          ))}
          {arcs.map((_, i) => {
            const a = (i / count) * Math.PI * 2 - Math.PI / 2;
            return <g key={`t${i}`}>{label(L[i], 500 + Math.cos(a) * 300, 480 + Math.sin(a) * 300 + 16, 4 + i * step * 0.6 + step, "middle", i === 0)}</g>;
          })}
        </>
      );
      break;
    }
    case "versus": {
      art = (
        <>
          <rect x={150} y={600} width={170} height={170} {...line} strokeDashoffset={1 - draw(0)} />
          <rect x={430} y={350} width={420} height={420} {...line} stroke={props.accent} strokeDashoffset={1 - draw(1)} />
          <path d="M 120 770 L 880 770" {...line} strokeDashoffset={1 - draw(0)} />
          {label(L[0], 235, 850, 4 + step)}
          {label(L[1], 640, 850, 4 + step * 1.6, "middle", true)}
        </>
      );
      break;
    }
    default: {
      // stairs: steps up with a dot climbing them.
      const climb = ramp(frame, 4 + step, step * 2.4, easeInOut);
      const steps = 4;
      const sx = (k: number) => 170 + k * 170;
      const sy = (k: number) => 820 - k * 170;
      const path = Array.from({ length: steps }, (_, k) => `L ${sx(k)} ${sy(k + 1)} L ${sx(k + 1)} ${sy(k + 1)}`).join(" ");
      const k = Math.min(steps - 1, Math.floor(climb * steps));
      art = (
        <>
          <path d={`M ${sx(0)} ${sy(0)} ${path}`} {...line} strokeDashoffset={1 - draw(0)} />
          <circle cx={sx(k) + 85} cy={sy(k + 1) - 40} r={30 * ramp(frame, 4 + step, 6)} fill={props.accent} />
          {label(L[0], sx(0), sy(0) + 70, 4 + step, "start")}
          {label(L[1], sx(steps), sy(steps) - 60, 4 + step * 2.4, "end", true)}
        </>
      );
    }
  }

  return (
    <AbsoluteFill style={{ background: fill(props.background), alignItems: "center", justifyContent: "center", opacity: out }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 * u }}>
        <svg width={side} height={side} viewBox={`0 0 ${V} ${V}`} style={{ overflow: "visible" }}>
          {art}
        </svg>
        {props.title ? (
          <div
            style={{
              fontFamily: FONTS[props.font] ?? FONTS.sans,
              fontWeight: 900,
              fontSize: side * 0.085,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: props.color,
              textAlign: "center",
              maxWidth: width * 0.86,
              opacity: ramp(frame, 4 + step * 2, 10),
              transform: `translateY(${(1 - ramp(frame, 4 + step * 2, 10, easeInOut)) * 20 * u}px)`,
            }}
          >
            {props.title}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
