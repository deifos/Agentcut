import { AbsoluteFill, useCurrentFrame } from "remotion";
import { RadialGlow, SPRING, ease, mix, sp, type SceneProps } from "agentcut";

type Props = SceneProps & { title: string; accent: string };

export default function Title({ title, accent, width, height }: Props) {
  const f = useCurrentFrame();
  const vertical = height > width;
  const words = title.split(" ");
  const glow = ease(f, 0, 40);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #0b0b14 0%, #050507 100%)" }}>
      <RadialGlow x={0.5} y={0.45} radius={0.55} color={accent} opacity={0.22 * glow} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: vertical ? "column" : "row", gap: vertical ? 0 : 28 }}>
        {words.map((word, i) => {
          const s = sp(f, 8 + i * 7, SPRING.pop);
          return (
            <div
              key={word}
              style={{
                fontFamily: "Inter",
                fontWeight: 900,
                fontSize: vertical ? 150 : 132,
                lineHeight: 1,
                letterSpacing: -4,
                color: i === words.length - 1 ? accent : "#ffffff",
                opacity: Math.min(1, s * 1.4),
                transform: `translateY(${mix(60, 0, s)}px) scale(${mix(0.8, 1, s)})`,
              }}
            >
              {word}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
