import { AbsoluteFill, spring, useCurrentFrame } from "remotion";
import { FONTS, exitOut, fill, mix, onColor } from "../lib";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  messages: string[];
  accent: string;
  theme: string;
  background: string;
  size: number;
  typing: boolean;
};

/**
 * A chat conversation building up: incoming bubbles (left) are preceded by a typing indicator,
 * outgoing ones (lines starting with ">") pop in on the right. The thread grows from the bottom,
 * gliding up as each new bubble arrives.
 */
export function ChatThread(props: Props) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames: d } = props;
  const vertical = height > width;
  const out = exitOut(frame, d, 12);
  const dark = props.theme === "dark";
  const fontSize = (props.size / 100) * Math.min(width, height) * (vertical ? 1.15 : 1);
  const columnWidth = Math.min(width * (vertical ? 0.88 : 0.5), fontSize * 22);
  const messages = props.messages.map((raw) => {
    const mine = raw.startsWith(">");
    return { mine, text: raw.replace(/^>\s*/, "") };
  });
  // Messages share the clip, leaving a moment at the end to read the last one.
  const step = Math.max(10, Math.min(36, (d - 30) / Math.max(1, messages.length)));
  const typingLead = props.typing ? Math.min(14, step * 0.5) : 0;
  const shownAt = messages.map((m, i) => 6 + i * step + (m.mine ? 0 : typingLead));
  const theirBg = dark ? "#2a2b31" : "#e9e9ee";
  const theirFg = dark ? "#f4f4f5" : "#111114";
  const gap = fontSize * 0.45;
  const bubbleHeight = fontSize * 2.1;

  // The column is anchored at the bottom: a new bubble pushes the others up at once, so offset
  // the column down by the part of that push the bubble hasn't grown into yet.
  const rowHeight = bubbleHeight + gap;
  const pending = shownAt.reduce((sum, at, i) => {
    const start = props.typing && !messages[i].mine ? at - typingLead : at;
    if (frame < start) return sum;
    return sum + (1 - spring({ frame: frame - start, fps, config: { damping: 20, stiffness: 160 } })) * rowHeight;
  }, 0);

  return (
    <AbsoluteFill
      style={{
        background: fill(props.background),
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: height * (vertical ? 0.22 : 0.16),
        overflow: "hidden",
        opacity: out,
      }}
    >
      <div
        style={{
          width: columnWidth,
          display: "flex",
          flexDirection: "column",
          gap,
          fontFamily: FONTS.sans,
          fontSize,
          lineHeight: 1.3,
          transform: `translateY(${pending}px)`,
        }}
      >
        {messages.map((m, i) => {
          const at = shownAt[i];
          const pop = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 190, mass: 0.7 } });
          const typingFrom = at - typingLead;
          const isTyping = !m.mine && props.typing && frame >= typingFrom && frame < at;
          if (!isTyping && frame < at) return null;
          const bg = m.mine ? props.accent : theirBg;
          const fg = m.mine ? onColor(props.accent) : theirFg;
          return (
            <div key={i} style={{ display: "flex", justifyContent: m.mine ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  maxWidth: "78%",
                  padding: `${fontSize * 0.5}px ${fontSize * 0.8}px`,
                  borderRadius: fontSize * 1.05,
                  [m.mine ? "borderBottomRightRadius" : "borderBottomLeftRadius"]: fontSize * 0.3,
                  background: bg,
                  color: fg,
                  transformOrigin: m.mine ? "100% 100%" : "0% 100%",
                  transform: isTyping
                    ? `scale(${mix(0.6, 1, Math.min(1, (frame - typingFrom) / 5))})`
                    : `scale(${mix(0.4, 1, pop)}) translateY(${(1 - pop) * fontSize}px)`,
                  opacity: isTyping ? 1 : Math.min(1, pop * 2),
                }}
              >
                {isTyping ? <TypingDots frame={frame - typingFrom} color={theirFg} size={fontSize} /> : m.text}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function TypingDots({ frame, color, size }: { frame: number; color: string; size: number }) {
  return (
    <div style={{ display: "flex", gap: size * 0.22, padding: `${size * 0.32}px ${size * 0.05}px`, height: size * 1.3, alignItems: "center" }}>
      {[0, 1, 2].map((i) => {
        const bounce = Math.max(0, Math.sin((frame - i * 3) * 0.45));
        return (
          <div
            key={i}
            style={{
              width: size * 0.36,
              height: size * 0.36,
              borderRadius: "50%",
              background: color,
              opacity: 0.35 + bounce * 0.5,
              transform: `translateY(${-bounce * size * 0.18}px)`,
            }}
          />
        );
      })}
    </div>
  );
}
