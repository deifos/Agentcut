import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";
import { unit } from "../lib";
import { CardStage, CardTitle, Label, Words, enter, lookKit, type LookKit, type LookProps } from "../looks";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps &
  LookProps & {
    kicker: string;
    title: string;
    subtitle: string;
    rows: string[];
    footer: string;
    layout: string;
    size: number;
  };

/** One label | value row, drawn the look's way. */
function Row({ kit, label, value, fontSize, frame, fps, start, index }: { kit: LookKit; label: string; value: string; fontSize: number; frame: number; fps: number; start: number; index: number }) {
  const u = kit.u;
  const e = enter(kit, frame, fps, start, kit.look === "paper" ? (index % 2 ? 1.2 : -1.2) : 0, index + 20);
  const box: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: fontSize,
    padding: `${fontSize * 0.45}px ${fontSize * 0.6}px`,
    fontFamily: kit.body,
    fontSize,
    opacity: e.opacity,
    transform: e.transform,
  };
  const skin: CSSProperties =
    kit.look === "ink"
      ? { background: kit.panel, border: `${Math.max(2, 3 * u)}px solid ${kit.line}`, boxShadow: `${5 * u}px ${5 * u}px 0 ${kit.line}`, borderRadius: 6 * u }
      : kit.look === "paper"
        ? { background: "#f3ead6", boxShadow: `${4 * u}px ${6 * u}px 0 rgba(20,12,4,0.3)` }
        : kit.look === "notebook"
          ? { borderBottom: `${Math.max(2, 2.5 * u)}px solid ${kit.line}`, padding: `${fontSize * 0.3}px ${fontSize * 0.1}px`, fontSize: fontSize * 1.3 }
          : kit.look === "crt"
            ? { borderBottom: `${Math.max(1, 2 * u)}px dashed ${kit.line}`, padding: `${fontSize * 0.3}px 0`, fontSize: fontSize * 1.3 }
            : kit.look === "line"
              ? { borderBottom: `${Math.max(2, 2.5 * u)}px solid ${kit.line}`, padding: `${fontSize * 0.4}px 0`, textTransform: "uppercase", letterSpacing: "0.06em" }
              : kit.look === "neon"
              ? { background: "rgba(34,232,255,0.06)", border: `${Math.max(1, 1.5 * u)}px solid ${kit.line}`, borderLeft: `${Math.max(3, 6 * u)}px solid ${kit.accent}`, textTransform: "uppercase" }
            : { borderBottom: `${Math.max(1, 1.5 * u)}px solid rgba(255,255,255,0.1)`, padding: `${fontSize * 0.5}px 0` };
  return (
    <div style={{ ...box, ...skin }}>
      <span style={{ opacity: 0.75, textTransform: kit.look === "ink" || kit.look === "paper" || kit.look === "neon" ? "uppercase" : "none", letterSpacing: kit.look === "ink" ? "0.08em" : 0, fontSize: "0.8em" }}>
        {label}
      </span>
      <span style={{ fontWeight: 700, fontFamily: kit.look === "ink" ? kit.head : kit.body }}>
        <Words kit={kit} line={value} fontSize={fontSize} frame={frame} start={start + 4} />
      </span>
    </div>
  );
}

/**
 * A titled card of label / value rows (a feature, a ledger, specs): an ink card of boxed rows, a
 * torn paper card, a notebook page, a terminal window or a soft card. Full frame or over footage.
 */
export function ListCard(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const u = unit(width, height);
  const kit = lookKit(props, u);
  const base = Math.min(width, height);
  const titleSize = (props.size / 100) * base;
  const rowSize = titleSize * 0.4;
  const rowsStart = 14;
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
      footerStart={rowsStart + props.rows.length * 6 + 6}
      title={`~/${props.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
    >
      <div style={{ padding: `${titleSize * 0.5}px ${titleSize * 0.5}px ${titleSize * 0.55}px`, display: "flex", flexDirection: "column", gap: titleSize * 0.14 }}>
        {props.kicker ? (
          <Label kit={kit} fontSize={titleSize * 0.17}>
            {props.kicker}
          </Label>
        ) : null}
        <CardTitle kit={kit} text={props.title} fontSize={titleSize} frame={frame} fps={fps} start={4} />
        {props.subtitle ? (
          <div style={{ fontFamily: kit.body, fontSize: titleSize * (kit.look === "notebook" || kit.look === "crt" ? 0.32 : 0.24), opacity: 0.75, color: kit.panelText }}>{props.subtitle}</div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: kit.look === "ink" || kit.look === "paper" ? rowSize * 0.55 : 0, marginTop: titleSize * 0.2 }}>
          {props.rows.map((row, i) => {
            const [label, ...rest] = row.split("|");
            return <Row key={i} kit={kit} label={label.trim()} value={rest.join("|").trim()} fontSize={rowSize} frame={frame} fps={fps} start={rowsStart + i * 6} index={i} />;
          })}
        </div>
      </div>
    </CardStage>
  );
}
