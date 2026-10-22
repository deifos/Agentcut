// A photo as a torn, taped cut-out that gets slapped onto the wall. Treatments: color, xerox, red, pink, yellow.
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { asset, type SceneProps } from "agentcut";
import { P, Paper, Tape, Halftone, areas, backOut, easeIn, jit, lerp, st, type Side } from "./lib/punk";

type Props = SceneProps & {
  src?: string;
  imgAspect?: number; // natural width / height of the image
  side?: Side;
  treatment?: "color" | "xerox" | "red" | "pink" | "yellow" | "teal";
  aspect?: number; // frame width / height
  zoom?: number; // 1 = whole photo
  fx?: number; // focus point in the photo (0..1)
  fy?: number;
  rot?: number;
  scale?: number; // size multiplier of the picture area
  from?: "left" | "right" | "top" | "bottom";
  seed?: number;
  x?: number; // optional center override (fraction of width)
  y?: number; // optional center override (fraction of height)
};

const TINT: Record<string, string> = { red: P.red, pink: P.pink, yellow: P.yellow, teal: P.teal };

export default function Photo({ src = "assets/photo.jpg", imgAspect = 0.75, side = "right", treatment = "color", aspect = 0.78, zoom = 1, fx = 0.52, fy = 0.4, rot = -4, scale = 1, from = "bottom", seed = 3, x, y, width, height, clip }: Props) {
  const f = useCurrentFrame();
  const D = clip.duration;
  const vertical = height > width;
  const pic = areas(width, height, side).pic;
  const cx = x != null ? x * width : pic.cx;
  const cy = y != null ? y * height : pic.cy;
  const S = pic.size * scale;
  const h = aspect >= 1 ? (S * 1.15) / aspect : S;
  const w = aspect >= 1 ? S * 1.15 : S * aspect;
  const rim = Math.max(14, S * 0.035);
  const iw = w - rim * 2, ih = h - rim * 2;

  // photo cover + zoom around the focus point
  const drift = lerp(1, 1.06, f / Math.max(1, D));
  const imgW = Math.max(iw, ih * imgAspect) * zoom * drift;
  const imgH = imgW / imgAspect;
  const left = Math.min(0, Math.max(iw - imgW, iw / 2 - fx * imgW));
  const top = Math.min(0, Math.max(ih - imgH, ih / 2 - fy * imgH));

  const inT = st(f, 0, 10, backOut);
  const outT = st(f, D - 9, 8, easeIn);
  const off = vertical ? height : width;
  const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[from];
  const dx = dir[0] * off * (1 - inT) - dir[0] * off * outT * 0.8 + (from === "left" || from === "right" ? 0 : 0);
  const dy = dir[1] * off * (1 - inT) + off * outT * 0.9;
  const j = jit(seed, f, 2);
  const r = rot + (1 - inT) * 25 * (dir[0] || 1) + outT * 30 + j.r;

  const filter = treatment === "color" ? "saturate(1.25) contrast(1.1)" : "grayscale(1) contrast(1.9) brightness(1.1)";
  const tint = TINT[treatment];

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: cx - w / 2 + dx + j.x, top: cy - h / 2 + dy + j.y, width: w, height: h, transform: `rotate(${r}deg)` }}>
        <Paper w={w} h={h} seed={seed} tex="white" kind="tear" shadow={1.4}>
          <div style={{ position: "absolute", left: rim, top: rim, width: iw, height: ih, overflow: "hidden", background: P.ink }}>
            <Img src={asset(src)} style={{ position: "absolute", left, top, width: imgW, height: imgH, filter }} />
            {tint ? <div style={{ position: "absolute", inset: 0, background: tint, opacity: 0.42 }} /> : null}
            {treatment !== "color" ? <Halftone x={iw * 0.8} y={ih * 0.85} size={Math.max(iw, ih) * 0.9} color="black" o={0.35} /> : null}
          </div>
        </Paper>
        <Tape x={w * 0.5} y={4} w={Math.min(220, w * 0.4)} rot={-3 + (seed % 5)} seed={seed} />
        <Tape x={w * 0.92} y={h * 0.96} w={Math.min(170, w * 0.32)} rot={-38} seed={seed + 1} />
      </div>
    </AbsoluteFill>
  );
}
