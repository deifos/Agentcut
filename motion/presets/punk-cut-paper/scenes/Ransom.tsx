// One sung line as a ransom note: each word is a cut-out paper chip that slaps down on its sung frame.
// Words starting with "*" are accents: cut letter by letter, bigger. Props: words [{t, at}] (frames from clip start).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SceneProps } from "agentcut";
import { CHIPS, FACES, P, areas, easeIn, hash, jit, outline, slap, st, strSeed, type Side } from "./lib/punk";
import { Img } from "remotion";
import { asset } from "agentcut";

type Word = { t: string; at: number };
type Props = SceneProps & {
  words: Word[];
  side?: Side;
  seed?: number;
  size?: number; // max font size px (wide); mobile scales
  letters?: boolean; // cut every word letter by letter
  stagger?: number; // frames between letters of an accent word
  align?: "left" | "center" | "right";
  yShift?: number; // fraction of height
  palette?: number[]; // indexes into CHIPS to use
};

function Chip({ text, size, face, chip, seed, rot, f, t0, exitT, exitDir }: {
  text: string; size: number; face: (typeof FACES)[number]; chip: (typeof CHIPS)[number]; seed: number; rot: number;
  f: number; t0: number; exitT: number; exitDir: number;
}) {
  const [family, mult, upper] = face;
  const [bg, fg, tex] = chip;
  const fs = size * mult;
  const s = slap(f, t0, 1.9);
  const j = f >= t0 + 8 ? jit(seed, f, 1.6) : { x: 0, y: 0, r: 0 };
  const e = exitT;
  const estW = text.length * fs * 0.6 + fs * 0.5;
  const estH = fs * 1.4;
  const clip = outline(estW, estH, seed, hash(seed, 9) > 0.5 ? "tear" : "cut");
  return (
    <div style={{
      position: "relative", display: "inline-block", margin: `${size * 0.05}px ${size * 0.11}px`,
      opacity: s.o * (1 - e),
      transform: `translate(${j.x + e * exitDir * 260}px, ${j.y - e * 380}px) rotate(${rot + j.r + e * exitDir * 70}deg) scale(${s.s})`,
    }}>
      <div style={{ position: "absolute", left: 7, top: 11, right: -7, bottom: -11, background: "rgba(20,12,4,0.45)", clipPath: clip }} />
      <div style={{ position: "relative", background: bg, clipPath: clip, overflow: "hidden" }}>
        {tex ? <Img src={asset(`assets/paper/${tex === "newsprint" ? "newsprint" : tex === "kraft" ? "kraft" : tex === "white" ? "paper-white" : "paper-cream"}.jpg`)}
          style={{ position: "absolute", left: -((seed * 37) % 400), top: -((seed * 53) % 400), width: 1024, height: 1024 }} />
          : <Img src={asset("assets/paper/grain-overlay.png")} style={{ position: "absolute", left: -((seed * 37) % 300), top: -((seed * 53) % 300), width: 1024, height: 1024, opacity: 0.4 }} />}
        <div style={{
          position: "relative", fontFamily: family, fontSize: fs, lineHeight: 1.08, color: fg, whiteSpace: "nowrap",
          textTransform: upper ? "uppercase" : "none", padding: `${fs * 0.1}px ${fs * 0.2}px ${fs * 0.06}px`,
        }}>{text}</div>
      </div>
    </div>
  );
}

export default function Ransom({ words = [], side = "left", seed = 1, size, letters = false, stagger = 2, align, yShift = 0, palette, width, height, clip }: Props) {
  const f = useCurrentFrame();
  const vertical = height > width;
  const A = areas(width, height, side).text;
  const base = seed * 101 + strSeed(words.map((w) => w.t).join(" "));
  const chips = palette && palette.length ? palette.map((i) => CHIPS[i % CHIPS.length]) : CHIPS;

  // fit the type to the area
  const chars = words.reduce((n, w) => n + w.t.replace("*", "").length * (w.t.startsWith("*") ? 1.5 : 1), 0) + words.length * 0.8;
  const maxSize = size ?? (vertical ? 120 : 118);
  const fit = Math.sqrt((A.w * A.h * 0.85) / (Math.max(1, chars) * 0.62 * 1.5));
  // the widest single word (accent words are cut letter by letter, ~1.3em per letter) must fit the area
  const widest = Math.max(...words.map((w) => {
    const n = w.t.replace("*", "").length;
    return letters || w.t.startsWith("*") ? n * 1.34 + 0.3 : n * 0.66 + 0.6;
  }), 1);
  const fs = Math.max(40, Math.min(maxSize * (vertical ? 1.05 : 1), fit, (A.w * 0.94) / widest));

  const D = clip.duration;
  let k = 0;
  const nodes = words.map((w, wi) => {
    const accent = letters || w.t.startsWith("*");
    const text = w.t.replace(/^\*/, "");
    const ws = base + wi * 17;
    const dir = hash(ws, 5) > 0.5 ? 1 : -1;
    if (!accent) {
      const face = FACES[Math.floor(hash(ws, 1) * FACES.length)];
      const chip = chips[Math.floor(hash(ws, 2) * chips.length)];
      const exitT = st(f, D - 10 + (k++) * 0.6, 7, easeIn);
      return (
        <Chip key={wi} text={text} size={fs} face={face} chip={chip} seed={ws} rot={(hash(ws, 3) - 0.5) * 9}
          f={f} t0={w.at} exitT={exitT} exitDir={dir} />
      );
    }
    return (
      <div key={wi} style={{ display: "inline-flex", alignItems: "center", margin: `0 ${fs * 0.12}px` }}>
        {Array.from(text.toUpperCase()).map((ch, ci) => {
          if (ch === " ") return <div key={ci} style={{ width: fs * 0.35 }} />;
          const ls = ws + ci * 7;
          const face = FACES[Math.floor(hash(ls, 1) * FACES.length)];
          const chip = chips[Math.floor(hash(ls, 2) * chips.length)];
          const exitT = st(f, D - 10 + (k++) * 0.4, 7, easeIn);
          return (
            <Chip key={ci} text={ch} size={fs * 1.2} face={face} chip={chip} seed={ls} rot={(hash(ls, 3) - 0.5) * 18}
              f={f} t0={w.at + ci * stagger} exitT={exitT} exitDir={hash(ls, 5) > 0.5 ? 1 : -1} />
          );
        })}
      </div>
    );
  });

  const justify = align ?? (vertical || side === "center" ? "center" : side === "left" ? "flex-start" : "flex-end");
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: A.x, top: A.y + yShift * height, width: A.w, height: A.h,
        display: "flex", flexWrap: "wrap", alignContent: "center", alignItems: "center", justifyContent: justify,
        color: P.ink,
      }}>
        {nodes}
      </div>
    </AbsoluteFill>
  );
}
