import type { CSSProperties } from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { FONTS, exitOut, fill, mix, ramp, splitHighlights, unit } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  lines: string[];
  tileColor: string;
  color: string;
  accent: string;
  background: string;
  size: number;
  font: string;
  stagger: number;
  flips: number;
  uppercase: boolean;
  seed: number;
};

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** Frames per flap flip. */
const FLIP = 3;

/**
 * A split-flap board (the airport departures sign): every character sits in its own tile and flips
 * through random glyphs, top flap folding down then the bottom flap dropping in, before it lands.
 * Tiles land left to right, line by line.
 */
export function SplitFlap(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames: d } = props;
  const u = unit(width, height);
  const vertical = height > width;
  const out = exitOut(frame, d, 10);

  const rows = props.lines.map((line) =>
    splitHighlights(props.uppercase ? line.toUpperCase() : line).flatMap((word, w) => [
      ...(w > 0 ? [{ char: " ", highlighted: false }] : []),
      ...Array.from(word.text).map((char) => ({ char, highlighted: word.highlighted })),
    ]),
  );
  const cols = Math.max(1, ...rows.map((row) => row.length));

  // Tile size: the size prop, shrunk so the longest line fits the frame.
  const gap = Math.max(2, 6 * u);
  const room = width - (vertical ? 70 : 140) * u;
  const wanted = (props.size / 100) * Math.min(width, height) * (vertical ? 1.1 : 1);
  const tileW = Math.min(wanted * 0.74, (room - gap * (cols - 1)) / cols);
  const tileH = tileW * 1.42;
  const fontSize = tileW * 1.18;
  const radius = tileW * 0.1;

  // Landing schedule fits the clip: the last tile lands by ~65% of it.
  const longestFlips = props.flips + 6;
  const budget = Math.max(8, d * 0.65 - 6 - longestFlips * FLIP);
  const stagger = Math.min(props.stagger, budget / Math.max(1, cols - 1 + (rows.length - 1) * 2));

  const glyphStyle: CSSProperties = {
    position: "absolute",
    left: 0,
    width: tileW,
    height: tileH,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: FONTS[props.font] ?? FONTS.mono,
    fontWeight: props.font === "condensed" ? 400 : 600,
    fontSize,
    lineHeight: 1,
  };

  // shade: darkens (< 0) or lightens (> 0) the flap with a plain overlay (the browser export can't draw brightness()).
  const half = (char: string, color: string, which: "top" | "bottom", extra?: CSSProperties, shade = 0) => (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: which === "top" ? 0 : tileH / 2,
        width: tileW,
        height: tileH / 2,
        overflow: "hidden",
        background: props.tileColor,
        borderRadius: which === "top" ? `${radius}px ${radius}px 0 0` : `0 0 ${radius}px ${radius}px`,
        ...extra,
      }}
    >
      <div style={{ ...glyphStyle, top: which === "top" ? 0 : -tileH / 2, color }}>{char === " " ? "" : char}</div>
      {shade !== 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: shade < 0 ? `rgba(0, 0, 0, ${-shade})` : `rgba(255, 255, 255, ${shade})`,
          }}
        />
      ) : null}
    </div>
  );

  return (
    <AbsoluteFill
      style={{ background: fill(props.background), alignItems: "center", justifyContent: "center", opacity: out }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: gap * 1.6 }}>
        {rows.map((row, r) => {
          const padded = [...row, ...Array.from({ length: cols - row.length }, () => ({ char: " ", highlighted: false }))];
          return (
            <div key={r} style={{ display: "flex", gap }}>
              {padded.map((cell, c) => {
                const key = `${props.seed}-${r}-${c}`;
                const start = 4 + (c + r * 2) * stagger;
                const appear = ramp(frame, start - 4, 6);
                const flipsHere = cell.char === " " ? 0 : props.flips + Math.floor(random(`n${key}`) * 6);
                // glyph k (0…flipsHere): random glyphs, the last one is the real character.
                const glyph = (k: number) =>
                  k <= 0 && flipsHere > 0
                    ? " "
                    : k >= flipsHere
                      ? cell.char
                      : POOL[Math.floor(random(`g${key}-${k}`) * POOL.length)];
                const t = (frame - start) / FLIP;
                const k = Math.max(0, Math.min(flipsHere, Math.floor(t)));
                const flipping = t >= 0 && t < flipsHere;
                const p = flipping ? t - Math.floor(t) : 0;
                const prev = glyph(k);
                const next = flipping ? glyph(k + 1) : prev;
                const landed = t >= flipsHere;
                const color = landed && cell.highlighted ? props.accent : props.color;
                // A brief accent flash on the tile as its real character lands.
                const flash = cell.char !== " " && landed ? 1 - ramp(frame, start + flipsHere * FLIP, 8) : 0;
                return (
                  <div
                    key={c}
                    style={{
                      position: "relative",
                      width: tileW,
                      height: tileH,
                      opacity: appear,
                      transform: `translateY(${mix(tileH * 0.15, 0, appear)}px)`,
                      boxShadow: `0 ${4 * u}px ${12 * u}px rgba(0, 0, 0, 0.35)`,
                      borderRadius: radius,
                    }}
                  >
                    {/* Behind: the next glyph's top, the previous glyph's bottom. */}
                    {half(next, color, "top")}
                    {half(prev, color, "bottom")}
                    {/* The moving flap: previous top folding down, then next bottom dropping in. */}
                    {flipping && p < 0.5
                      ? half(prev, color, "top", {
                          transform: `scaleY(${1 - p * 2})`,
                          transformOrigin: "50% 100%",
                        }, -0.4 * p * 2)
                      : null}
                    {flipping && p >= 0.5
                      ? half(next, color, "bottom", {
                          transform: `scaleY(${(p - 0.5) * 2})`,
                          transformOrigin: "50% 0%",
                        }, 0.18 * (1 - (p - 0.5) * 2))
                      : null}
                    {flash > 0 ? (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: radius,
                          border: `${Math.max(1, 2 * u)}px solid ${props.accent}`,
                          opacity: flash * 0.8,
                        }}
                      />
                    ) : null}
                    {/* The seam between the flaps. */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: tileH / 2 - Math.max(1, 1.5 * u) / 2,
                        height: Math.max(1, 1.5 * u),
                        background: "rgba(0, 0, 0, 0.55)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
