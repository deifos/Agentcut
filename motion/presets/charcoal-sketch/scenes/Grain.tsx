// Charcoal dust over the whole film, swapped on threes (paper "boil"). Drawn above the mascot too, very light.
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { asset, type SceneProps } from "agentcut";
import { boil, rng } from "./lib/sketch";

type Props = SceneProps & { opacity?: number };

export default function Grain({ opacity = 0.55 }: Props) {
  const f = useCurrentFrame();
  const b = boil(f);
  const r = rng(b + 77);
  const dx = Math.round((r() - 0.5) * 300), dy = Math.round((r() - 0.5) * 200);
  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity }}>
      <Img src={asset(`assets/paper/grain-${b % 3}.png`)} style={{
        position: "absolute", left: -200, top: -150, width: 2320, height: 1380, transform: `translate(${dx}px, ${dy}px)`,
      }} />
      <AbsoluteFill style={{
        background: "linear-gradient(90deg, rgba(40,38,36,0.16) 0%, rgba(40,38,36,0) 14%, rgba(40,38,36,0) 86%, rgba(40,38,36,0.16) 100%)",
      }} />
    </AbsoluteFill>
  );
}
