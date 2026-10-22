// Pain 5: stuck on what to post next (a blank sheet, a blinking cursor, a pencil tapping, question marks)
// Fix 5: ideas from your own data — a Search line chart + an Analytics bar chart, arrow into three idea cards.
import { useCurrentFrame } from "remotion";
import { SPRING, sp, type SceneProps } from "agentcut";
import { PainFix } from "./lib/painfix";
import { HAND, HandText, Hatch, PRINT, SCRIPT, Sk, SkArrow, SkLine, SkPoly, SkRect, Smudge, prog } from "./lib/sketch";

type Idea = { kind: string; title: string };
type Props = SceneProps & {
  tSwipe: number; tPainText: number; tFixText: number; painText: string; fixText: string;
  ideas: Idea[]; tSearch: number; tAnalytics: number; tIdeas: number;
};

export default function Ideas(p: Props) {
  return (
    <PainFix duration={p.clip.duration} tSwipe={p.tSwipe} tPainText={p.tPainText} tFixText={p.tFixText}
      painText={p.painText} fixText={p.fixText} fixPose="excited" fixAt={[1730, 1005, 330]}
      pain={(f) => <Pain f={f} />} fix={(f, fl) => <Fix fl={fl} {...p} />} />
  );
}

function Pain({ f }: { f: number }) {
  const g = useCurrentFrame();
  const blink = Math.floor(g / 8) % 2 === 0;
  const tap = Math.abs(Math.sin(g * 0.9)) * 18;
  return (
    <>
      <Smudge x={760} y={640} w={1000} h={720} o={0.18} />
      <Sk>
        <SkRect x={360} y={280} w={760} h={700} p={prog(f, 2, 12)} id={20} sw={4} fill="#F0EDE7" />
        {blink && f > 10 && <SkLine a={[440, 360]} b={[440, 430]} id={21} sw={5} />}
        {/* pencil, tapping */}
        <g transform={`rotate(-35 1260 ${560 - tap}) translate(0 ${-tap})`}>
          <SkRect x={1230} y={380} w={56} h={300} p={prog(f, 6, 10)} id={22} sw={3.4} fill="#E2DED6" />
          <SkPoly pts={[[1230, 680], [1258, 750], [1286, 680]]} p={prog(f, 10, 6)} id={23} sw={3.4} />
          <Hatch x={1234} y={384} w={48} h={50} p={prog(f, 10, 6)} id={24} gap={7} o={0.5} />
        </g>
      </Sk>
      {[[200, 330, 120, -10], [1300, 820, 140, 14], [560, 640, 96, 8], [880, 470, 80, -6]].map(([x, y, s, r], i) => (
        <HandText key={i} x={x} y={y} size={s} font={HAND} p={prog(f, 14 + i * 6, 4)} id={30 + i} rot={r} color={i % 2 ? "#4a4744" : "#2a2826"}>?</HandText>
      ))}
    </>
  );
}

function Fix({ fl, ideas, tSearch, tAnalytics, tIdeas }: Props & { fl: number }) {
  const line: [number, number][] = [[200, 560], [290, 540], [370, 550], [450, 500], [530, 470], [610, 420], [690, 380]];
  return (
    <>
      <Smudge x={460} y={620} w={720} h={760} o={0.16} />
      <Sk>
        {/* Search chart */}
        <SkRect x={170} y={290} w={560} h={320} p={prog(fl, tSearch - 4, 10)} id={200} sw={3.6} fill="#EFECE6" />
        <SkPoly pts={line} p={prog(fl, tSearch, 14)} id={201} sw={4.5} />
        <SkLine a={[190, 590]} b={[710, 590]} p={prog(fl, tSearch, 8)} id={202} sw={2} o={0.6} />
        {/* Analytics chart */}
        <SkRect x={170} y={650} w={560} h={320} p={prog(fl, tAnalytics - 4, 10)} id={210} sw={3.6} fill="#EFECE6" />
        {[120, 170, 140, 210, 250].map((h, i) => (
          <g key={i}>
            <SkRect x={220 + i * 96} y={950 - h} w={60} h={h} p={prog(fl, tAnalytics + i * 3, 8)} id={211 + i} sw={3} />
            <Hatch x={224 + i * 96} y={954 - h} w={52} h={h - 8} p={prog(fl, tAnalytics + i * 3, 8)} id={220 + i} gap={9} o={0.35} />
          </g>
        ))}
        <SkArrow a={[760, 630]} b={[900, 630]} p={prog(fl, tIdeas - 10, 8)} id={230} sw={5} head={34} />
        {ideas.map((_, i) => {
          const s = sp(fl, tIdeas + i * 7, SPRING.pop);
          if (fl < tIdeas + i * 7) return null;
          const y = 300 + i * 225 + (1 - s) * 40;
          return (
            <g key={i} opacity={Math.min(1, s * 1.5)}>
              <SkRect x={940} y={y} w={600} h={190} id={240 + i} sw={3.8} fill="#F3F1EC" />
              <SkRect x={962} y={y + 22} w={150} h={50} id={250 + i} sw={2.6} />
            </g>
          );
        })}
      </Sk>
      <HandText x={196} y={306} size={42} font={PRINT} weight={400} p={prog(fl, tSearch, 6)} id={260}>Search</HandText>
      <HandText x={196} y={666} size={42} font={PRINT} weight={400} p={prog(fl, tAnalytics, 6)} id={261}>Analytics</HandText>
      {ideas.map((d, i) => {
        if (fl < tIdeas + i * 7) return null;
        const s = sp(fl, tIdeas + i * 7, SPRING.pop);
        const y = 300 + i * 225 + (1 - s) * 40;
        return (
          <div key={i} style={{ opacity: Math.min(1, s * 1.5) }}>
            <HandText x={1037} y={y + 28} size={32} font={PRINT} weight={400} id={270 + i} align="center" width={150}>{d.kind}</HandText>
            <HandText x={966} y={y + 88} size={54} font={SCRIPT} id={280 + i} width={560}>{d.title}</HandText>
          </div>
        );
      })}
    </>
  );
}
