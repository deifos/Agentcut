import { useId, type ReactNode } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FONTS, alpha, easeInOut, easeOutExpo, exitOut, fill, mix, ramp, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  title: string;
  label: string;
  stats: string[];
  targetX: number;
  targetY: number;
  lockSize: number;
  color: string;
  secondary: string;
  background: string;
  radar: boolean;
  hexGrid: boolean;
  dataStream: boolean;
  scanlines: boolean;
  seed: number;
};

/** Rounded so the server-rendered still and the client agree on every attribute. */
const r2 = (v: number) => Math.round(v * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;
const HEX = "0123456789ABCDEF";
/** The red fringe of the chromatic offset. */
const FRINGE = "#ff3b6b";

/**
 * A sci-fi head-up display: neon wireframes grow in level by level, corner brackets shrink onto a
 * target and lock, a radar sweeps, data streams scroll and readouts scramble before landing, all
 * under a glow, a slight chromatic offset and scanlines. It powers down into a line at the end.
 */
export function TargetLock(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const id = `hud${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const seed = props.seed;
  const c = props.color;
  const s2 = props.secondary;
  const short = Math.min(width, height);
  const m = Math.round(short * 0.05);
  const stroke = Math.max(1, 1.6 * u);
  const micro = Math.max(10, 14 * u);
  const glowText = `0 0 ${r2(8 * u)}px ${alpha(c, 0.85)}`;

  // Entry flicker, pre-exit flicker, then the power-down collapse.
  const flick = (start: number, len: number) =>
    frame >= start && frame < start + len && random(`${seed}-fl-${frame}`) < 0.4 ? 0.3 : 1;
  const down = ramp(frame, d - 12, 8, easeInOut);
  const out = exitOut(frame, d, 5) * flick(0, 7) * flick(d - 17, 5);

  // ---- Layout: panels in the corners (wide), bands at the top and bottom (vertical). ----
  const R = (vertical ? 0.17 : 0.12) * short;
  const radarC = vertical ? { x: width - m - R, y: m + R } : { x: width - m - R, y: height - m - R };
  const stats = props.stats.slice(0, 6);
  const rowH = 46 * u;
  const titlePanel = {
    x: m,
    y: m,
    w: vertical ? width - 2 * m - (props.radar ? 2 * R + 30 * u : 0) : width * 0.34,
    h: 128 * u,
  };
  const statsH = 52 * u + stats.length * rowH;
  const statsW = vertical ? (width - 2 * m) * (props.dataStream ? 0.6 : 1) : Math.max(360 * u, width * 0.27);
  const statsPanel = { x: m, y: height - m - statsH, w: statsW, h: statsH };
  const dsLines = vertical ? Math.max(4, Math.floor(statsH / (micro * 1.45)) - 1) : 12;
  const dsPanel = vertical
    ? { x: m + statsW + 24 * u, y: height - m - statsH, w: width - m - (m + statsW + 24 * u), h: statsH }
    : { x: width - m - 250 * u, y: m, w: 250 * u, h: 20 * u + dsLines * micro * 1.45 };

  // ---- Target lock: brackets shrink 1.4 → 1 onto the target, drifting until they snap. ----
  const tx = (props.targetX / 100) * width;
  const ty = (props.targetY / 100) * height;
  const box = (props.lockSize / 100) * short;
  const LOCK_AT = 34;
  const lockT = ramp(frame, 16, LOCK_AT - 16, easeOutExpo);
  const locked = frame >= LOCK_AT;
  const drift = 1 - lockT;
  const jx = drift * (random(`${seed}-jx-${Math.floor(frame / 3)}`) - 0.5) * box * 0.3;
  const jy = drift * (random(`${seed}-jy-${Math.floor(frame / 3)}`) - 0.5) * box * 0.3;
  const lx = tx + jx;
  const ly = ty + jy;
  const half = (box / 2) * mix(1.4, 1, lockT);
  const arm = box * 0.2;
  const bracketsIn = ramp(frame, 14, 4);
  const lockFlash = locked && frame < LOCK_AT + 12 && Math.floor((frame - LOCK_AT) / 3) % 2 === 0;
  const crossIn = ramp(frame, 22, 12, easeOutExpo);
  const lockAngle = r2(frame * 1.5);

  // ---- Radar sweep ----
  const sweepStart = 14;
  const sweepDeg = (frame - sweepStart) * 6 - 90;
  const polar = (deg: number, dist: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: radarC.x + Math.cos(a) * dist, y: radarC.y + Math.sin(a) * dist };
  };

  // Grows a stroke along its length (0 → 1).
  const grow = (length: number, p: number) => ({
    strokeDasharray: `${r2(length)} ${r2(length + 1)}`,
    strokeDashoffset: r2(length * (1 - p)),
  });

  const chamfer = (x: number, y: number, w: number, h: number) => {
    const ch = Math.min(w, h) * 0.14;
    const path = `M ${pt(x, y)} L ${pt(x + w - ch, y)} L ${pt(x + w, y + ch)} L ${pt(x + w, y + h)} L ${pt(x + ch, y + h)} L ${pt(x, y + h - ch)} Z`;
    const length = 2 * w + 2 * h - 4 * ch + 2 * ch * Math.SQRT2;
    return { path, length };
  };

  /** The wireframes: drawn twice, in the main color and as the offset fringe. */
  const wires = (col: string, key: string) => {
    const els: ReactNode[] = [];
    // Frame corners.
    const fc = ramp(frame, 0, 12, easeOutExpo);
    const inset = m * 0.55;
    const farm = 60 * u;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = sx < 0 ? inset : width - inset;
      const y = sy < 0 ? inset : height - inset;
      els.push(
        <path
          key={`${key}-fc${sx}${sy}`}
          d={`M ${pt(x - sx * farm, y)} L ${pt(x, y)} L ${pt(x, y - sy * farm)}`}
          fill="none"
          stroke={col}
          strokeWidth={r2(stroke * 1.4)}
          {...grow(farm * 2, fc)}
        />,
      );
    }
    // Heading tape, top center: ticks scroll under a fixed caret.
    const tapeIn = ramp(frame, 4, 14, easeOutExpo);
    const tapeY = m * 0.55;
    const tapeHalf = (vertical ? 0.22 : 0.12) * width * tapeIn;
    const sp = 16 * u;
    const pos = frame * 1.3 * u;
    if (tapeHalf > 1) {
      els.push(
        <line
          key={`${key}-tb`}
          x1={r2(width / 2 - tapeHalf)}
          x2={r2(width / 2 + tapeHalf)}
          y1={r2(tapeY)}
          y2={r2(tapeY)}
          stroke={col}
          strokeWidth={r2(stroke * 0.8)}
          opacity={0.6}
        />,
      );
      for (let i = Math.ceil((pos - tapeHalf) / sp); i <= Math.floor((pos + tapeHalf) / sp); i++) {
        const x = width / 2 + i * sp - pos;
        const major = i % 5 === 0;
        els.push(
          <line
            key={`${key}-t${i}`}
            x1={r2(x)}
            x2={r2(x)}
            y1={r2(tapeY)}
            y2={r2(tapeY + (major ? 16 : 8) * u)}
            stroke={col}
            strokeWidth={r2(stroke * (major ? 1 : 0.7))}
            opacity={major ? 0.95 : 0.55}
          />,
        );
      }
    }
    // Panels.
    const panels = [
      { p: titlePanel, at: 8 },
      { p: statsPanel, at: 26 },
      ...(props.dataStream ? [{ p: dsPanel, at: 12 }] : []),
    ];
    for (const [i, { p, at }] of panels.entries()) {
      const { path, length } = chamfer(p.x, p.y, p.w, p.h);
      els.push(
        <path
          key={`${key}-p${i}`}
          d={path}
          fill="none"
          stroke={col}
          strokeWidth={r2(stroke)}
          opacity={0.85}
          {...grow(length, ramp(frame, at, 16, easeInOut))}
        />,
      );
    }
    // Lock brackets, crosshair and a rotating dashed ring.
    if (bracketsIn > 0) {
      const bcol = key === "main" && lockFlash ? s2 : col;
      const corners = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
        .map(([sx, sy]) => {
          const x = lx + sx * half;
          const y = ly + sy * half;
          return `M ${pt(x - sx * arm, y)} L ${pt(x, y)} L ${pt(x, y - sy * arm)}`;
        })
        .join(" ");
      els.push(
        <path
          key={`${key}-br`}
          d={corners}
          fill="none"
          stroke={bcol}
          strokeWidth={r2(stroke * 2)}
          strokeLinecap="square"
          opacity={r2(bracketsIn)}
        />,
      );
    }
    if (crossIn > 0) {
      const a = box * 0.12;
      const b = mix(a, box * 0.42, crossIn);
      els.push(
        <path
          key={`${key}-cx`}
          d={`M ${pt(lx - b, ly)} L ${pt(lx - a, ly)} M ${pt(lx + a, ly)} L ${pt(lx + b, ly)} M ${pt(lx, ly - b)} L ${pt(lx, ly - a)} M ${pt(lx, ly + a)} L ${pt(lx, ly + b)}`}
          stroke={col}
          strokeWidth={r2(stroke)}
          opacity={0.9}
        />,
        <circle
          key={`${key}-ring`}
          cx={r2(lx)}
          cy={r2(ly)}
          r={r2(box * 0.34)}
          fill="none"
          stroke={col}
          strokeWidth={r2(stroke * 0.8)}
          strokeDasharray={`${r2(10 * u)} ${r2(14 * u)}`}
          opacity={r2(0.7 * crossIn)}
          transform={`rotate(${lockAngle} ${pt(lx, ly)})`}
        />,
      );
    }
    // Radar rings, cross and bezel ticks.
    if (props.radar) {
      for (const [i, f] of [1, 0.66, 0.33].entries()) {
        const rr = R * f;
        els.push(
          <circle
            key={`${key}-rr${i}`}
            cx={r2(radarC.x)}
            cy={r2(radarC.y)}
            r={r2(rr)}
            fill="none"
            stroke={col}
            strokeWidth={r2(stroke * (i === 0 ? 1.2 : 0.8))}
            opacity={i === 0 ? 0.95 : 0.5}
            transform={`rotate(-90 ${pt(radarC.x, radarC.y)})`}
            {...grow(2 * Math.PI * rr, ramp(frame, 8 + i * 3, 14, easeInOut))}
          />,
        );
      }
      const crossR = R * ramp(frame, 12, 10);
      els.push(
        <path
          key={`${key}-rc`}
          d={`M ${pt(radarC.x - crossR, radarC.y)} L ${pt(radarC.x + crossR, radarC.y)} M ${pt(radarC.x, radarC.y - crossR)} L ${pt(radarC.x, radarC.y + crossR)}`}
          stroke={col}
          strokeWidth={r2(stroke * 0.6)}
          opacity={0.4}
        />,
      );
      const ticksIn = Math.floor(36 * ramp(frame, 14, 12));
      for (let k = 0; k < ticksIn; k++) {
        const p1 = polar(k * 10 - 90, R * 1.04);
        const p2 = polar(k * 10 - 90, R * (k % 3 === 0 ? 1.12 : 1.08));
        els.push(
          <line
            key={`${key}-rt${k}`}
            x1={r2(p1.x)}
            y1={r2(p1.y)}
            x2={r2(p2.x)}
            y2={r2(p2.y)}
            stroke={col}
            strokeWidth={r2(stroke * 0.8)}
            opacity={0.7}
          />,
        );
      }
    }
    return els;
  };

  // ---- Hex grid: revealed outward from the target, with a few cells blinking. ----
  const hs = 30 * u;
  const hh = Math.sqrt(3) * hs;
  const hexPath = (x: number, y: number, r: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (k * Math.PI) / 3;
      return `${k === 0 ? "M" : "L"} ${pt(x + Math.cos(a) * r, y + Math.sin(a) * r)}`;
    }).join(" ") + " Z";
  const hexReveal = ramp(frame, 6, 30, easeInOut) * Math.hypot(width, height);
  const litHexes = Array.from({ length: 7 }, (_, i) => {
    const col = Math.floor(random(`${seed}-hc-${i}`) * (width / (1.5 * hs)));
    const row = Math.floor(random(`${seed}-hr-${i}`) * (height / hh));
    const x = col * 1.5 * hs;
    const y = row * hh + (col % 2 ? hh / 2 : 0);
    const on = Math.floor(frame / 5 + random(`${seed}-hp-${i}`) * 10) % 4 !== 0;
    return { x, y, on };
  });

  // ---- Radar blips: brightest right after the sweep passes them. ----
  const blips = Array.from({ length: 5 }, (_, i) => {
    const deg = random(`${seed}-ba-${i}`) * 360 - 90;
    const p = polar(deg, R * (0.22 + random(`${seed}-bd-${i}`) * 0.68));
    const age = ((((sweepDeg - deg) % 360) + 360) % 360) / 360;
    return { ...p, op: frame >= sweepStart ? Math.max(0, 1 - age * 2.6) : 0, age };
  });
  const sweepSlices = 10;

  // ---- Text: typewriter title, scrambling readouts, scrolling data. ----
  const typed = (text: string, start: number, cps = 0.9) => text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));
  const titleTyped = typed(props.title, 20);
  const typing = titleTyped.length < props.title.length;
  const cursorOn = typing || Math.floor(frame / 8) % 2 === 0;
  const titleFs = Math.min(44 * u, (titlePanel.w - 40 * u) / Math.max(6, props.title.length * 0.72));
  const scramble = (text: string, land: number, key: string) =>
    frame >= land
      ? text
      : text.replace(/[0-9]/g, (_, i: number) => String(Math.floor(random(`${seed}-${key}-${i}-${frame}`) * 10)));
  const hex = (key: string, n: number) =>
    Array.from({ length: n }, (_, i) => HEX[Math.floor(random(`${key}-${i}`) * 16)]).join("");
  const scroll = Math.floor(frame / 3);
  const dist = `${String(100 + Math.floor(random(`${seed}-dist`) * 899)).padStart(4, "0")}.${Math.floor(random(`${seed}-dd`) * 10)} M`;
  const distShown = scramble(dist, LOCK_AT, "dist");

  const tagBelow = ly + half + 70 * u < height - m;
  const mono = FONTS.mono;

  return (
    <AbsoluteFill style={{ background: fill(props.background), overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          opacity: r2(out),
          transform: `scaleY(${r2(1 - 0.985 * down)}) scaleX(${r2(1 + 0.06 * down)})`,
        }}
      >
        <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={r2(3 * u)} result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id={`${id}-hex`} width={r2(3 * hs)} height={r2(hh)} patternUnits="userSpaceOnUse">
              <path
                d={[hexPath(0, 0, hs), hexPath(0, hh, hs), hexPath(1.5 * hs, hh / 2, hs), hexPath(3 * hs, 0, hs), hexPath(3 * hs, hh, hs)].join(" ")}
                fill="none"
                stroke={c}
                strokeWidth={r2(Math.max(0.8, u))}
              />
            </pattern>
            <radialGradient id={`${id}-hexfade`}>
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
            <mask id={`${id}-hexmask`}>
              <circle cx={r2(tx)} cy={r2(ty)} r={r2(Math.max(1, hexReveal))} fill={`url(#${id}-hexfade)`} />
            </mask>
            <linearGradient id={`${id}-band`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0} />
              <stop offset="50%" stopColor={c} stopOpacity={0.07} />
              <stop offset="100%" stopColor={c} stopOpacity={0} />
            </linearGradient>
            <pattern id={`${id}-scan`} width={8} height={r2(Math.max(3, 4 * u))} patternUnits="userSpaceOnUse">
              <rect width={8} height={r2(Math.max(1, 1.5 * u))} fill="#000000" fillOpacity={0.22} />
            </pattern>
          </defs>

          {props.hexGrid ? (
            <g mask={`url(#${id}-hexmask)`}>
              <rect width={width} height={height} fill={`url(#${id}-hex)`} opacity={0.2} />
              {litHexes.map((h, i) =>
                h.on ? <path key={i} d={hexPath(h.x, h.y, hs * 0.9)} fill={alpha(i % 3 ? c : s2, 0.16)} /> : null,
              )}
            </g>
          ) : null}

          {/* Chromatic offset: a red fringe of the wireframes, nudged left. */}
          <g transform={`translate(${r2(-2.2 * u)} 0)`} opacity={0.35}>
            {wires(FRINGE, "fringe")}
          </g>

          <g filter={`url(#${id}-glow)`}>
            {wires(c, "main")}
            {props.radar && frame >= sweepStart ? (
              <>
                {Array.from({ length: sweepSlices }, (_, j) => {
                  const a1 = sweepDeg - j * 4;
                  const a2 = a1 - 4.4;
                  const p1 = polar(a1, R);
                  const p2 = polar(a2, R);
                  return (
                    <path
                      key={`sw${j}`}
                      d={`M ${pt(radarC.x, radarC.y)} L ${pt(p1.x, p1.y)} A ${r2(R)} ${r2(R)} 0 0 0 ${pt(p2.x, p2.y)} Z`}
                      fill={c}
                      opacity={r2(0.3 * (1 - j / sweepSlices))}
                    />
                  );
                })}
                <line
                  x1={r2(radarC.x)}
                  y1={r2(radarC.y)}
                  x2={r2(polar(sweepDeg, R).x)}
                  y2={r2(polar(sweepDeg, R).y)}
                  stroke={c}
                  strokeWidth={r2(stroke * 1.4)}
                />
                {blips.map((b, i) =>
                  b.op > 0 ? (
                    <g key={`b${i}`}>
                      <circle cx={r2(b.x)} cy={r2(b.y)} r={r2(5 * u)} fill={s2} opacity={r2(b.op)} />
                      <circle
                        cx={r2(b.x)}
                        cy={r2(b.y)}
                        r={r2(5 * u + b.age * 60 * u)}
                        fill="none"
                        stroke={s2}
                        strokeWidth={r2(stroke * 0.8)}
                        opacity={r2(b.op * 0.6)}
                      />
                    </g>
                  ) : null,
                )}
              </>
            ) : null}
            {/* Heading caret and the panels' secondary-colored tabs. */}
            <path
              d={`M ${pt(width / 2, m * 0.55 + 18 * u)} L ${pt(width / 2 - 7 * u, m * 0.55 + 30 * u)} L ${pt(width / 2 + 7 * u, m * 0.55 + 30 * u)} Z`}
              fill={s2}
              opacity={r2(ramp(frame, 10, 6))}
            />
            {[titlePanel, statsPanel].map((p, i) => (
              <rect
                key={`tab${i}`}
                x={r2(p.x)}
                y={r2(p.y - 7 * u)}
                width={r2(54 * u * ramp(frame, 12 + i * 16, 10, easeOutExpo))}
                height={r2(4 * u)}
                fill={s2}
              />
            ))}
          </g>

          {props.scanlines ? (
            <>
              <rect width={width} height={height} fill={`url(#${id}-scan)`} />
              <rect
                y={r2(((frame * 9 * u) % (height + 200 * u)) - 200 * u)}
                width={width}
                height={r2(200 * u)}
                fill={`url(#${id}-band)`}
              />
            </>
          ) : null}
        </svg>

        {/* Title panel */}
        <div
          style={{
            position: "absolute",
            left: r2(titlePanel.x + 22 * u),
            top: r2(titlePanel.y + 18 * u),
            width: r2(titlePanel.w - 44 * u),
            fontFamily: mono,
            color: c,
            textShadow: glowText,
          }}
        >
          <div
            style={{
              fontSize: micro,
              letterSpacing: "0.18em",
              color: s2,
              opacity: r2(ramp(frame, 14, 4)),
              whiteSpace: "nowrap",
            }}
          >
            {`// SYS.HUD ${hex(`${seed}-sys`, 4)} · ${typed("ONLINE", 16, 0.8)}`}
          </div>
          <div
            style={{
              marginTop: r2(10 * u),
              fontSize: r2(titleFs),
              fontWeight: 700,
              letterSpacing: "0.08em",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              color: "#ffffff",
            }}
          >
            {titleTyped}
            <span style={{ color: c, opacity: cursorOn && frame >= 18 ? 1 : 0 }}>█</span>
          </div>
          <div style={{ display: "flex", gap: r2(4 * u), marginTop: r2(12 * u) }}>
            {Array.from({ length: 16 }, (_, i) => (
              <div
                key={i}
                style={{
                  width: r2(14 * u),
                  height: r2(4 * u),
                  background: i < 16 * ramp(frame, 28, 20) ? (i >= 13 ? s2 : c) : alpha(c, 0.15),
                }}
              />
            ))}
          </div>
        </div>

        {/* Stats panel */}
        <div
          style={{
            position: "absolute",
            left: r2(statsPanel.x + 22 * u),
            top: r2(statsPanel.y + 20 * u),
            width: r2(statsPanel.w - 44 * u),
            fontFamily: mono,
            fontSize: r2(micro * 1.25),
            textShadow: glowText,
          }}
        >
          {stats.map((line, i) => {
            const start = 34 + i * 6;
            const land = start + 4 + Math.floor(random(`${seed}-land-${i}`) * 2);
            const split = line.indexOf(":");
            const name = split >= 0 ? line.slice(0, split) : line;
            const value = split >= 0 ? line.slice(split + 1).trim() : "";
            const shown = ramp(frame, start, 3);
            const gauge = (0.35 + random(`${seed}-g-${i}`) * 0.6) * ramp(frame, start, 16, easeOutExpo);
            return (
              <div key={i} style={{ height: r2(rowH), opacity: r2(shown) }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: r2(12 * u), whiteSpace: "nowrap" }}>
                  <span style={{ color: alpha(c, 0.75), letterSpacing: "0.12em" }}>{typed(name, start, 1.6)}</span>
                  <span style={{ color: frame >= land ? "#ffffff" : s2, fontWeight: 700 }}>
                    {frame >= start ? scramble(value, land, `v${i}`) : ""}
                  </span>
                </div>
                <div style={{ position: "relative", height: r2(3 * u), marginTop: r2(8 * u), background: alpha(c, 0.15) }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${r2(gauge * 100)}%`, background: c }} />
                  <div
                    style={{
                      position: "absolute",
                      left: `${r2(gauge * 100)}%`,
                      top: r2(-2 * u),
                      width: r2(4 * u),
                      height: r2(7 * u),
                      background: s2,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Data stream */}
        {props.dataStream ? (
          <div
            style={{
              position: "absolute",
              left: r2(dsPanel.x + 18 * u),
              top: r2(dsPanel.y + 12 * u),
              width: r2(dsPanel.w - 36 * u),
              height: r2(dsPanel.h - 24 * u),
              overflow: "hidden",
              fontFamily: mono,
              fontSize: micro,
              lineHeight: 1.45,
              color: alpha(c, 0.8),
              textShadow: glowText,
              whiteSpace: "nowrap",
            }}
          >
            {Array.from({ length: dsLines }, (_, i) => {
              const k = i + scroll;
              const hot = random(`${seed}-hot-${k}`) < 0.14;
              return (
                <div key={i} style={{ opacity: frame > 14 + i * 2 ? 1 : 0, color: hot ? s2 : undefined }}>
                  {`${hex(`${seed}-a-${k}`, 4)} ${hex(`${seed}-b-${k}`, 4)} ${hot ? "!ACK" : "·OK "} ${hex(`${seed}-c-${k}`, 2)}`}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Radar readout */}
        {props.radar ? (
          <div
            style={{
              position: "absolute",
              left: r2(radarC.x - R),
              top: r2(vertical ? radarC.y + R * 1.16 + 6 * u : radarC.y - R * 1.16 - micro * 1.6),
              width: r2(R * 2),
              display: "flex",
              justifyContent: "space-between",
              fontFamily: mono,
              fontSize: micro,
              letterSpacing: "0.12em",
              color: c,
              textShadow: glowText,
              opacity: r2(ramp(frame, 16, 6)),
              whiteSpace: "nowrap",
            }}
          >
            <span>{`SCAN ${String(Math.round((((sweepDeg + 90) % 360) + 360) % 360)).padStart(3, "0")}°`}</span>
            <span style={{ color: s2 }}>{`CNT 0${blips.filter((b) => b.op > 0.2).length}`}</span>
          </div>
        ) : null}

        {/* Lock tag */}
        {bracketsIn > 0 ? (
          <div
            style={{
              position: "absolute",
              left: r2(lx - half),
              top: r2(tagBelow ? ly + half + 12 * u : ly - half - 12 * u - micro * 3.2),
              fontFamily: mono,
              fontSize: micro,
              lineHeight: 1.5,
              letterSpacing: "0.14em",
              color: c,
              textShadow: glowText,
              whiteSpace: "nowrap",
              opacity: r2(bracketsIn),
            }}
          >
            <div style={{ color: "#ffffff" }}>{`[ ${typed(props.label, 18, 1.2)} ]`}</div>
            <div>
              <span style={{ color: locked ? s2 : c, opacity: locked && !lockFlash && frame < LOCK_AT + 12 ? 0.4 : 1 }}>
                {locked ? "■ LOCKED" : `□ TRACKING${".".repeat(Math.floor(frame / 4) % 4)}`}
              </span>
              <span style={{ marginLeft: r2(14 * u), opacity: 0.8 }}>{`DST ${distShown}`}</span>
            </div>
          </div>
        ) : null}
      </AbsoluteFill>

      {/* Power-down line */}
      {down > 0 && down < 1 ? (
        <div
          style={{
            position: "absolute",
            left: r2(width * 0.5 * down * 0.6),
            right: r2(width * 0.5 * down * 0.6),
            top: r2(height / 2 - stroke),
            height: r2(stroke * 2),
            background: c,
            boxShadow: `0 0 ${r2(18 * u)}px ${c}`,
            opacity: r2(exitOut(frame, d, 5)),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}
