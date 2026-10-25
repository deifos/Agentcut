import { AbsoluteFill, useCurrentFrame } from "remotion";
import { exitOut, ramp } from "../lib";
import type { LoopTone } from "../loops/engine";
import { LoopCanvas } from "../loops/LoopCanvas";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  loop: string;
  tone: LoopTone;
  accent: string;
  accent2: string;
  speed: number;
  seed: number;
  transparent: boolean;
  blur: number;
  fade: boolean;
};

/** A library loop as a timeline clip: brand palette, tone, speed and layout from the inspector. */
export function MotionLoop(props: Props) {
  const frame = useCurrentFrame();
  const opacity = props.fade ? ramp(frame, 0, 10) * exitOut(frame, props.durationInFrames, 10) : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      <LoopCanvas
        loop={props.loop}
        tone={props.tone}
        accent={props.accent}
        accent2={props.accent2}
        speed={props.speed}
        seed={props.seed}
        transparent={props.transparent}
        blur={props.blur}
      />
    </AbsoluteFill>
  );
}
