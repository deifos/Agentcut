import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FONTS, alpha, blurStyle, easeOutExpo, exitOut, fill, glowStyle, mix, pop, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  title: string;
  cards: string[];
  accent: string;
  theme: string;
  background: string;
  chart: boolean;
  font: string;
};

/** [col, row, colSpan, rowSpan] for each card. */
type Cell = [number, number, number, number];

/** Grid columns, row weights and each card's cell, for 4–6 cards. */
function layout(n: number, vertical: boolean): { cols: number; rows: number[]; cells: Cell[] } {
  if (vertical) {
    // Hero across the top, the rest two per row (an odd one out spans the row).
    const rest = n - 1;
    const cells: Cell[] = [[0, 0, 2, 1]];
    const rows = [1.5];
    for (let i = 0; i < rest; i++) {
      if (i % 2 === 0) rows.push(1);
      const alone = i === rest - 1 && i % 2 === 0;
      cells.push([i % 2, 1 + Math.floor(i / 2), alone ? 2 : 1, 1]);
    }
    return { cols: 2, rows, cells };
  }
  if (n <= 4) return { cols: 4, rows: [1, 1], cells: [[0, 0, 2, 2], [2, 0, 2, 1], [2, 1, 1, 1], [3, 1, 1, 1]] };
  if (n === 5)
    return { cols: 4, rows: [1, 1], cells: [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1], [2, 1, 1, 1], [3, 1, 1, 1]] };
  return {
    cols: 4,
    rows: [1, 1, 0.8],
    cells: [[0, 0, 2, 2], [2, 0, 2, 1], [2, 1, 1, 1], [3, 1, 1, 1], [0, 2, 2, 1], [2, 2, 2, 1]],
  };
}

const BARS = [0.32, 0.5, 0.41, 0.66, 0.58, 0.8, 0.72, 1];

/** A launch-style bento grid: a big hero card and smaller feature cards that spring into place one by one. */
export function BentoGrid(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const dark = props.theme !== "light";
  const out = exitOut(frame, d, 14);
  const cards = props.cards.filter((c) => c.trim()).slice(0, 6);
  while (cards.length < 4) cards.push("Feature — Add a line in Cards");
  const { cols, rows, cells } = layout(cards.length, vertical);

  const fg = dark ? "#f4f4f5" : "#0f1115";
  const muted = dark ? "rgba(244,244,245,0.6)" : "rgba(15,17,21,0.58)";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(15,17,21,0.08)";
  const bg = fill(props.background) ?? (dark ? "#0a0a0d" : "#f2f2f5");
  const font = FONTS[props.font] ?? FONTS.display;

  const padX = (vertical ? 56 : 110) * u;
  const titleSize = (vertical ? 70 : 64) * u;
  const hasTitle = props.title.trim().length > 0;
  const top = (vertical ? 200 : 90) * u + (hasTitle ? titleSize * 1.7 : 0);
  const bottom = (vertical ? 200 : 90) * u;
  const gap = 22 * u;
  const colW = (width - padX * 2 - gap * (cols - 1)) / cols;
  const rowUnit = (height - top - bottom - gap * (rows.length - 1)) / rows.reduce((a, b) => a + b, 0);
  const rowTop = (r: number) => rows.slice(0, r).reduce((a, b) => a + b * rowUnit + gap, 0);
  const rowSpanH = (r: number, span: number) =>
    rows.slice(r, r + span).reduce((a, b) => a + b * rowUnit, 0) + gap * (span - 1);
  const titleIn = ramp(frame, 0, 24, easeOutExpo);

  return (
    <AbsoluteFill style={{ background: bg, opacity: out, fontFamily: FONTS.sans }}>
      <div style={glowStyle(width * 0.3, height * 0.35, width * 0.9, height * 0.9, props.accent, dark ? 0.22 : 0.12)} />
      {hasTitle ? (
        <div
          style={{
            position: "absolute",
            left: padX,
            right: padX,
            top: top - titleSize * 1.7,
            fontFamily: font,
            fontWeight: 700,
            fontSize: titleSize,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            color: fg,
            textAlign: vertical ? "left" : "center",
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * 30 * u}px)`,
            ...blurStyle((1 - titleIn) * 10 * u),
          }}
        >
          {props.title}
        </div>
      ) : null}
      {cards.map((card, i) => {
        const [c, r, cs, rs] = cells[i];
        const [head, ...rest] = card.split(/\s+[—–-]\s+/);
        const detail = rest.join(" — ");
        const hero = i === 0;
        const p = pop(frame, fps, 8 + i * 5, 150);
        const w = colW * cs + gap * (cs - 1);
        const h = rowSpanH(r, rs);
        const k = Math.min(w, h * 1.6);
        const headSize = Math.max(22 * u, Math.min((hero ? 66 : 38) * u, k * (hero ? 0.09 : 0.11)));
        const chartTop = hero && props.chart;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: padX + c * (colW + gap),
              top: top + rowTop(r),
              width: w,
              height: h,
              boxSizing: "border-box",
              borderRadius: 34 * u,
              background: dark ? (hero ? "#1b1c23" : "#15161b") : "#ffffff",
              border: `${Math.max(1, 1.5 * u)}px solid ${hero ? alpha(props.accent, 0.35) : border}`,
              boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,${dark ? 0.35 : 0.08})`,
              overflow: "hidden",
              opacity: Math.min(1, p * 1.4),
              transform: `translateY(${(1 - p) * 70 * u}px) scale(${mix(0.9, 1, p)})`,
              display: "flex",
              flexDirection: "column",
              justifyContent: chartTop ? "flex-start" : "flex-end",
              padding: 34 * u,
              color: fg,
            }}
          >
            {hero ? <div style={glowStyle(w * 0.85, h * 0.05, w * 1.1, h * 1.1, props.accent, dark ? 0.35 : 0.18)} /> : null}
            {!hero ? (
              <div
                style={{
                  position: "absolute",
                  top: 30 * u,
                  left: 34 * u,
                  width: 46 * u,
                  height: 46 * u,
                  boxSizing: "border-box",
                  borderRadius: 14 * u,
                  background: alpha(props.accent, dark ? 0.18 : 0.12),
                  border: `${1.5 * u}px solid ${alpha(props.accent, 0.4)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: 16 * u, height: 16 * u, borderRadius: i % 2 ? "50%" : 4 * u, background: props.accent }} />
              </div>
            ) : null}
            <div style={{ position: "relative" }}>
              <div style={{ fontFamily: font, fontWeight: 700, fontSize: headSize, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
                {head}
              </div>
              {detail ? (
                <div
                  style={{
                    marginTop: 10 * u,
                    fontSize: Math.max(18 * u, headSize * (hero ? 0.42 : 0.62)),
                    lineHeight: 1.3,
                    color: muted,
                  }}
                >
                  {detail}
                </div>
              ) : null}
            </div>
            {chartTop ? (
              <svg
                width={w - 68 * u}
                height={h * 0.45}
                viewBox={`0 0 ${BARS.length * 10} 100`}
                preserveAspectRatio="none"
                style={{ position: "absolute", left: 34 * u, bottom: 34 * u }}
              >
                {BARS.map((b, j) => {
                  const bh = b * 100 * ramp(frame, 22 + j * 3, 26, easeOutExpo);
                  return (
                    <rect
                      key={j}
                      x={j * 10 + 1.6}
                      y={100 - bh}
                      width={6.8}
                      height={bh}
                      rx={1.6}
                      fill={j === BARS.length - 1 ? props.accent : alpha(props.accent, 0.22 + 0.06 * j)}
                    />
                  );
                })}
              </svg>
            ) : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
