import { useCurrentFrame } from "remotion";
import { unit } from "../lib";
import { CardStage, Label, enter, headWeight, lookKit, typed, type LookProps } from "../looks";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps &
  LookProps & {
    quote: string;
    name: string;
    role: string;
    footer: string;
    layout: string;
    size: number;
  };

/**
 * Someone else's words as proof: a quote with the name and role under it, on the look's card.
 * Full frame or over footage.
 */
export function QuoteCard(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const kit = lookKit(props, u);
  const fontSize = (props.size / 100) * Math.min(width, height);
  const q = enter(kit, frame, fps, 6, 0, 2);
  const by = enter(kit, frame, fps, 18, 0, 5);
  const marks = kit.look === "crt" ? ['"', '"'] : ["“", "”"];
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
      footerStart={26}
      title="~/quote.txt"
    >
      <div style={{ padding: `${fontSize * 0.9}px ${fontSize * 0.9}px ${fontSize * 0.8}px`, display: "flex", flexDirection: "column", gap: fontSize * 0.6 }}>
        <div
          style={{
            opacity: q.opacity,
            transform: q.transform,
            fontFamily: kit.look === "paper" ? kit.head : kit.head,
            fontWeight: headWeight(kit),
            fontSize,
            lineHeight: kit.look === "notebook" ? 1.05 : 1.08,
            letterSpacing: kit.look === "crt" || kit.look === "notebook" ? 0 : "-0.015em",
            textTransform: kit.look === "crt" ? "uppercase" : "none",
            color: kit.panelText,
          }}
        >
          <span style={{ color: kit.look === "clean" || kit.look === "crt" || kit.look === "neon" || kit.look === "line" ? kit.accent : kit.panelText }}>{marks[0]}</span>
          {typed(kit, props.quote, frame, 6, 2)}
          <span style={{ color: kit.look === "clean" || kit.look === "crt" || kit.look === "neon" || kit.look === "line" ? kit.accent : kit.panelText }}>{marks[1]}</span>
        </div>
        <div style={{ opacity: by.opacity, transform: by.transform, display: "flex", flexDirection: "column", gap: fontSize * 0.15 }}>
          <div style={{ fontFamily: kit.body, fontSize: fontSize * (kit.look === "notebook" || kit.look === "crt" ? 0.62 : 0.46), color: kit.panelText }}>{props.name}</div>
          {props.role ? (
            <Label kit={kit} fontSize={fontSize * 0.3}>
              {props.role}
            </Label>
          ) : null}
        </div>
      </div>
    </CardStage>
  );
}
