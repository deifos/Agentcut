import { AbsoluteFill, useCurrentFrame } from "remotion";
import { exitOut, unit } from "../lib";
import { Sticker, Tag, lookKit, type LookProps } from "../looks";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps &
  LookProps & {
    text: string;
    label: string;
    position: string;
    size: number;
  };

/**
 * A badge slapped in a corner over the speaker (a number, a price, one word), with an optional
 * small tag: starburst (ink), paper rosette, hand-drawn circle, terminal bracket or a disc.
 */
export function StickerBadge(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const kit = lookKit(props, u);
  const size = (props.size / 100) * Math.min(width, height);
  const out = exitOut(frame, d, 8);
  const [vertical, horizontal] = props.position === "center" ? ["center", "center"] : props.position.split("-");
  const margin = Math.min(width, height) * 0.07;
  return (
    <AbsoluteFill
      style={{
        opacity: out,
        padding: margin,
        alignItems: horizontal === "left" ? "flex-start" : horizontal === "right" ? "flex-end" : "center",
        justifyContent: vertical === "top" ? "flex-start" : vertical === "bottom" ? "flex-end" : "center",
      }}
    >
      {/* column-reverse: the tag sits above the badge but comes later in the DOM, so it paints on top
          where they overlap (the export renderer has no z-index). */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column-reverse", alignItems: horizontal === "right" ? "flex-end" : "flex-start" }}>
        <Sticker kit={kit} text={props.text} size={size} frame={frame} fps={fps} start={props.label ? 6 : 0} />
        {props.label ? (
          <div style={{ position: "relative", marginBottom: -size * 0.12, marginRight: horizontal === "right" ? size * 0.55 : 0 }}>
            <Tag kit={kit} text={props.label} fontSize={size * 0.17} frame={frame} fps={fps} start={0} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
