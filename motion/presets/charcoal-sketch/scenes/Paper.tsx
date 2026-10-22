// Drawing paper under everything. The sheet shifts a pixel or two on threes, like rotoscoped frames.
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { asset, type SceneProps } from "agentcut";
import { boil, rng } from "./lib/sketch";

export default function Paper(_: SceneProps) {
  const f = useCurrentFrame();
  const r = rng(boil(f) + 5);
  const dx = (r() - 0.5) * 6, dy = (r() - 0.5) * 6;
  return (
    <AbsoluteFill style={{ background: "#E9E6DF", overflow: "hidden" }}>
      <Img src={asset("assets/paper/sketch-paper.jpg")} style={{
        position: "absolute", left: -12, top: -12, width: 1944, height: 1104, transform: `translate(${dx}px, ${dy}px)`,
      }} />
    </AbsoluteFill>
  );
}
