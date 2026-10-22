import { useCurrentFrame } from "remotion";
import { ramp, unit } from "../lib";
import { CardStage, CardTitle, Label, Words, enter, headWeight, lookKit, type LookProps } from "../looks";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps &
  LookProps & {
    kicker: string;
    title: string;
    beforeLabel: string;
    before: string;
    afterLabel: string;
    after: string;
    footer: string;
    layout: string;
    size: number;
  };

/**
 * A number that changes: the old value gets struck out, then the new one lands in the accent.
 * "$240 → $0 per month", "3 hours → 4 minutes". Full frame or over footage.
 */
export function BeforeAfter(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const kit = lookKit(props, u);
  const titleSize = (props.size / 100) * Math.min(width, height);
  const valueSize = titleSize * 0.95;
  const beforeIn = enter(kit, frame, fps, 12, 0, 3);
  const strike = ramp(frame, 24, 8);
  const afterIn = enter(kit, frame, fps, 32, kit.look === "ink" || kit.look === "paper" ? -3 : 0, 8);
  const value = {
    fontFamily: kit.head,
    fontWeight: headWeight(kit),
    fontSize: valueSize,
    lineHeight: 1,
    color: kit.panelText,
  } as const;
  return (
    <CardStage
      kit={kit}
      width={width}
      height={height}
      layout={props.layout}
      frame={frame}
      fps={fps}
      durationInFrames={d}
      footer={props.footer}
      footerStart={42}
      title="~/cost.txt"
    >
      <div style={{ padding: `${titleSize * 0.5}px ${titleSize * 0.55}px ${titleSize * 0.6}px`, display: "flex", flexDirection: "column", gap: titleSize * 0.18 }}>
        {props.kicker ? (
          <Label kit={kit} fontSize={titleSize * 0.17}>
            {props.kicker}
          </Label>
        ) : null}
        <CardTitle kit={kit} text={props.title} fontSize={titleSize} frame={frame} fps={fps} start={4} />
        <div style={{ display: "flex", flexDirection: "column", gap: titleSize * 0.08, marginTop: titleSize * 0.2 }}>
          <Label kit={kit} fontSize={titleSize * 0.15}>
            {props.beforeLabel}
          </Label>
          <div style={{ position: "relative", alignSelf: "flex-start", opacity: beforeIn.opacity * (1 - strike * 0.45), transform: beforeIn.transform }}>
            <div style={value}>{props.before}</div>
            <div
              style={{
                position: "absolute",
                left: "-4%",
                top: "50%",
                height: Math.max(4, valueSize * 0.09),
                width: `${strike * 108}%`,
                background: kit.look === "clean" || kit.look === "crt" || kit.look === "neon" || kit.look === "line" ? kit.accent : kit.line,
                transform: "rotate(-4deg)",
                borderRadius: kit.look === "notebook" ? valueSize : 0,
              }}
            />
          </div>
          <Label kit={kit} fontSize={titleSize * 0.15} style={{ marginTop: titleSize * 0.12 }}>
            {props.afterLabel}
          </Label>
          <div style={{ ...value, alignSelf: "flex-start", opacity: afterIn.opacity, transform: afterIn.transform, transformOrigin: "0% 60%" }}>
            <Words kit={kit} line={`*${props.after.replace(/\*/g, "")}*`} fontSize={valueSize} frame={frame} start={32} />
          </div>
        </div>
      </div>
    </CardStage>
  );
}
