// Xerox-paper wall: torn color panels re-cut every few strong beats (hard punk cuts), halftone blots, newsprint scraps.
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { asset, type SceneProps } from "agentcut";
import { P, Paper, Halftone, beatIndex, beatPulse, hash } from "./lib/punk";

type Props = SceneProps & {
  colors?: string[]; // panel colors for this section
  cutEvery?: number; // re-cut the layout every N strong beats
  energy?: number; // 0..1: how many panels / how wild
  seed?: number;
};

export default function Backdrop({ colors = [P.yellow, P.red, P.ink], cutEvery = 4, energy = 0.6, seed = 1, width, height, clip }: Props) {
  const f = useCurrentFrame();
  const abs = clip.from + f;
  const bi = Math.max(0, beatIndex(abs));
  const cut = Math.floor(bi / Math.max(1, cutEvery));
  const pulse = beatPulse(abs, 9);
  const cs = seed * 1000 + cut * 13;
  const W = width, H = height;
  const diag = Math.hypot(W, H);
  const nPanels = 1 + Math.round(energy * 2);

  const panels = Array.from({ length: nPanels }).map((_, i) => {
    const s = cs + i * 71;
    const color = colors[Math.floor(hash(s, 1) * colors.length)];
    const ph = H * (0.22 + hash(s, 2) * 0.3);
    const rot = (hash(s, 3) - 0.5) * 34;
    const cy = H * (0.15 + hash(s, 4) * 0.7);
    const cx = W * (0.3 + hash(s, 6) * 0.4);
    return (
      <Paper key={`${cut}-${i}`} w={diag * 1.2} h={ph} seed={s} color={color} kind="tear" grain={0.5} shadow={0.8}
        style={{ left: cx - diag * 0.6, top: cy - ph / 2, transform: `rotate(${rot}deg) scale(${1 + pulse * 0.015})` }} />
    );
  });

  const blots = Array.from({ length: 2 }).map((_, i) => {
    const s = cs + 500 + i * 37;
    const c = (["black", "red", "yellow"] as const)[Math.floor(hash(s, 1) * 3)];
    return <Halftone key={i} x={W * hash(s, 2)} y={H * hash(s, 3)} size={Math.min(W, H) * (0.5 + hash(s, 4) * 0.5)} color={c} o={0.22 + energy * 0.25} rot={hash(s, 5) * 90} />;
  });

  const scraps = Array.from({ length: 3 }).map((_, i) => {
    const s = cs + 900 + i * 53;
    const w = Math.min(W, H) * (0.22 + hash(s, 1) * 0.2);
    const h = w * (0.35 + hash(s, 2) * 0.5);
    return (
      <Paper key={`s${cut}-${i}`} w={w} h={h} seed={s} tex="newsprint" kind={hash(s, 3) > 0.5 ? "tear" : "cut"} shadow={0.6}
        style={{ left: W * hash(s, 4) - w / 2, top: H * hash(s, 5) - h / 2, transform: `rotate(${(hash(s, 6) - 0.5) * 40}deg)`, opacity: 0.85 }} />
    );
  });

  // scribbled X marks and stars
  const marks = Array.from({ length: 4 }).map((_, i) => {
    const s = cs + 1300 + i * 19;
    const x = W * hash(s, 1), y = H * hash(s, 2), sz = 40 + hash(s, 3) * 60;
    const star = hash(s, 4) > 0.5;
    return (
      <svg key={i} width={sz} height={sz} viewBox="0 0 40 40" style={{ position: "absolute", left: x, top: y, transform: `rotate(${hash(s, 5) * 90}deg)` }}>
        {star ? <path d="M20 2 L24 15 L38 15 L27 23 L31 37 L20 29 L9 37 L13 23 L2 15 L16 15 Z" fill={P.ink} />
          : <path d="M6 6 L34 34 M34 6 L6 34" stroke={P.ink} strokeWidth="5" strokeLinecap="round" />}
      </svg>
    );
  });

  return (
    <AbsoluteFill style={{ background: P.paper, overflow: "hidden" }}>
      <Img src={asset("assets/paper/desk-cream.jpg")} style={{ position: "absolute", left: 0, top: 0, width: Math.max(W, H * 16 / 9), height: Math.max(H, W * 9 / 16) }} />
      {blots}
      {scraps}
      {panels}
      {marks}
    </AbsoluteFill>
  );
}
