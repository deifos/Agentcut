import { AbsoluteFill, useCurrentFrame } from "remotion";
import { exitOut, splitHighlights, unit } from "../lib";
import { Chip, lookKit, type LookProps } from "../looks";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps &
  LookProps & {
    lines: string[];
    position: string;
    size: number;
    stagger: number;
    tilt: boolean;
  };

const POSITION_Y: Record<string, number> = { top: 0.16, center: 0.5, lower: 0.68, bottom: 0.82 };

/**
 * A punchy phrase over the speaker, word by word, in the project's look: boxed and tilted (ink),
 * ransom-note scraps (paper), handwriting with a marker (notebook), terminal text (crt) or a pill.
 */
export function WordPop(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const kit = lookKit(props, u);
  const fontSize = (props.size / 100) * Math.min(width, height);
  const out = exitOut(frame, d, 8);
  // Each line starts once the words of the lines above are in.
  const starts = props.lines.map((_, i) =>
    props.lines.slice(0, i).reduce((sum, line) => sum + splitHighlights(line).length * props.stagger + 2, 0),
  );
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: "6%",
          right: "6%",
          top: `${(POSITION_Y[props.position] ?? 0.68) * 100}%`,
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: fontSize * 0.3,
        }}
      >
        {props.lines.map((line, i) => {
          const start = starts[i];
          const tilt = props.tilt && (kit.look === "ink" || kit.look === "paper") ? (i % 2 === 0 ? -2.5 : 2) : 0;
          return (
            <div key={i} style={{ transform: `rotate(${tilt}deg)` }}>
              <Chip kit={kit} line={line} fontSize={fontSize} frame={frame} fps={fps} start={start} stagger={props.stagger} seed={i + 1} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
