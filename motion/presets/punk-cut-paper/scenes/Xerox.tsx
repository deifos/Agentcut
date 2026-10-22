// Photocopy / tape-era overlay on top of everything: boiling grain, scratches, dark copier edges, flicker.
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { asset, type SceneProps } from "agentcut";
import { hash, beatPulse } from "./lib/punk";

type Props = SceneProps & { grain?: number; edges?: number; flash?: number };

export default function Xerox({ grain = 0.28, edges = 0.5, flash = 0.12, width, height, clip }: Props) {
  const f = useCurrentFrame();
  const abs = clip.from + f;
  const k = Math.floor(f / 2);
  const ox = -Math.floor(hash(k, 1) * 600), oy = -Math.floor(hash(k, 2) * 600);
  const T = Math.max(width, height) + 700;
  const scratch = hash(k, 3) > 0.6;
  const flick = beatPulse(abs, 4) * flash;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Img src={asset("assets/paper/grain-overlay.png")} style={{ position: "absolute", left: ox, top: oy, width: T, height: T, opacity: grain }} />
      {scratch ? (
        <div style={{ position: "absolute", left: hash(k, 4) * width, top: 0, width: 2 + hash(k, 5) * 2, height, background: "rgba(20,20,20,0.35)" }} />
      ) : null}
      {hash(k, 6) > 0.8 ? (
        <div style={{ position: "absolute", left: 0, top: hash(k, 7) * height, width, height: 3, background: "rgba(255,255,255,0.4)" }} />
      ) : null}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, rgba(10,8,6,${0.55 * edges}) 0%, rgba(10,8,6,0) 9%, rgba(10,8,6,0) 91%, rgba(10,8,6,${0.55 * edges}) 100%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(10,8,6,${0.45 * edges}) 0%, rgba(10,8,6,0) 10%, rgba(10,8,6,0) 90%, rgba(10,8,6,${0.45 * edges}) 100%)` }} />
      {flick > 0 ? <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flick }} /> : null}
    </AbsoluteFill>
  );
}
