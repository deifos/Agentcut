// End card: one big comic panel; the colour mascot waves, ROLINO is lettered in charcoal, the line and URL follow
// the voice; a burst of pencil rays on the final hit.
import { useCurrentFrame } from "remotion";
import { SPRING, mix, sp, type SceneProps } from "agentcut";
import { HAND, HandText, Mascot, MascotShadow, SCRIPT, Sk, SkLine, SkRect, Smudge, prog } from "./lib/sketch";

type Props = SceneProps & {
  title: string; line: string; url: string; tTitle: number; tLine: number; tUrl: number; tHit: number;
};

export default function EndCard({ title, line, url, tTitle, tLine, tUrl, tHit }: Props) {
  const f = useCurrentFrame();
  const land = sp(f, 4, SPRING.land);
  const hit = f >= tHit ? Math.max(0, 1 - (f - tHit) / 10) : 0;
  const mx = 520, my = mix(-200, 930, land);
  const urlP = sp(f, tUrl, SPRING.pop);
  return (
    <>
      <Smudge x={mx} y={900} w={700} h={260} o={0.25} />
      <Sk>
        <SkRect x={56} y={44} w={1808} h={992} p={prog(f, 0, 10)} id={7} sw={7} />
        <SkRect x={72} y={60} w={1776} h={960} p={prog(f, 4, 10)} id={8} sw={2.4} o={0.6} />
        {/* pencil rays behind the mascot on the final hit (and faintly before) */}
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const r0 = 280 + hit * 30, r1 = 360 + hit * 120;
          return <SkLine key={i} a={[mx + Math.cos(a) * r0, 700 + Math.sin(a) * r0 * 0.8]} b={[mx + Math.cos(a) * r1, 700 + Math.sin(a) * r1 * 0.8]}
            p={prog(f, 20 + i, 6)} id={20 + i} sw={3 + hit * 3} o={0.45 + hit * 0.5} />;
        })}
        <SkLine a={[900, 560]} b={[1720, 552]} p={prog(f, tTitle + 14, 10)} id={40} sw={6} />
        {urlP > 0 && <SkRect x={940} y={800} w={720} h={130} id={41} sw={4.5} p={prog(f, tUrl, 8)} />}
      </Sk>
      {land > 0.05 && <MascotShadow x={mx} y={930} w={300} o={0.5} />}
      <Mascot pose="wave" x={mx} y={my} h={500} rot={mix(-10, 0, land)} squash={hit * 0.05} />
      <HandText x={1300} y={300} size={250} font={HAND} p={prog(f, tTitle, 14)} id={50} align="center" width={900}
        style={{ letterSpacing: 10, transform: `scale(${1 + hit * 0.04})` }}>{title}</HandText>
      <HandText x={1300} y={610} size={72} font={SCRIPT} p={prog(f, tLine, 20)} id={51} align="center" width={980}>{line}</HandText>
      <HandText x={1300} y={822} size={84} font={HAND} p={prog(f, tUrl + 2, 10)} id={52} align="center" width={720}>{url}</HandText>
    </>
  );
}
