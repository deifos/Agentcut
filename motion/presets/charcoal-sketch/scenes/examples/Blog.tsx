// Pain 4: a blog that hasn't moved in months (browser sketch, "Last post: March", cobweb, month pages crossed out)
// Fix 4: a blog plan — Tue/Thu articles planned and drafted, then "You approve" ticked before anything goes live.
import { type SceneProps } from "agentcut";
import { PainFix } from "./lib/painfix";
import { HAND, HandText, Hatch, PRINT, SCRIPT, Sk, SkCheck, SkEllipse, SkLine, SkPoly, SkRect, Smudge, prog } from "./lib/sketch";

type Row = { day: string; title: string; status: string };
type Props = SceneProps & {
  tSwipe: number; tPainText: number; tFixText: number; painText: string; fixText: string;
  months: string[]; rows: Row[]; tApprove: number; approveText: string;
};

export default function Blog(p: Props) {
  return (
    <PainFix duration={p.clip.duration} tSwipe={p.tSwipe} tPainText={p.tPainText} tFixText={p.tFixText}
      painText={p.painText} fixText={p.fixText} fixPose="idea" fixAt={[1715, 1005, 330]}
      pain={(f) => <Pain f={f} {...p} />} fix={(f, fl) => <Fix fl={fl} {...p} />} />
  );
}

function Pain({ f, months }: Props & { f: number }) {
  const W = { x: 170, y: 280, w: 980, h: 700 };
  return (
    <>
      <Smudge x={660} y={640} w={1200} h={760} o={0.2} />
      <Sk>
        <SkRect x={W.x} y={W.y} w={W.w} h={W.h} p={prog(f, 2, 12)} id={20} sw={4} fill="#EEEBE5" />
        <SkLine a={[W.x, W.y + 60]} b={[W.x + W.w, W.y + 60]} p={prog(f, 6, 8)} id={21} sw={3} />
        {[0, 1, 2].map((k) => <SkEllipse key={k} cx={W.x + 34 + k * 36} cy={W.y + 30} rx={10} ry={10} p={prog(f, 8, 6)} id={22 + k} sw={2.6} />)}
        <SkRect x={W.x + 60} y={W.y + 220} w={860} h={360} p={prog(f, 14, 10)} id={30} sw={3} />
        <Hatch x={W.x + 66} y={W.y + 226} w={300} h={348} p={prog(f, 16, 10)} id={31} gap={12} o={0.3} />
        {[0, 1, 2].map((k) => <SkLine key={k} a={[W.x + 400, W.y + 380 + k * 44]} b={[W.x + 860 - k * 90, W.y + 380 + k * 44]} p={prog(f, 20 + k * 2, 8)} id={32 + k} sw={2.4} o={0.55} />)}
        {/* cobweb in the top-right corner of the window */}
        {[0, 1, 2, 3, 4].map((k) => {
          const a = (Math.PI / 2) * (k / 4);
          return <SkLine key={k} a={[W.x + W.w, W.y + 60]} b={[W.x + W.w - Math.sin(a) * 230, W.y + 60 + Math.cos(a) * 230]} p={prog(f, 30 + k * 2, 8)} id={40 + k} sw={1.8} o={0.6} />;
        })}
        {[70, 130, 190].map((r, k) => {
          const pts: [number, number][] = [0, 1, 2, 3, 4].map((j) => {
            const a = (Math.PI / 2) * (j / 4);
            return [W.x + W.w - Math.sin(a) * r, W.y + 60 + Math.cos(a) * r];
          });
          return <SkPoly key={k} pts={pts} p={prog(f, 38 + k * 3, 8)} id={50 + k} sw={1.6} o={0.55} />;
        })}
        {/* month pages, each crossed out */}
        {months.map((_, i) => {
          const x = 1220 + (i % 2) * 150, y = 300 + i * 120;
          const pp = prog(f, 40 + i * 8, 8);
          return (
            <g key={i} transform={`rotate(${(i % 2 ? 6 : -5)} ${x + 90} ${y + 50})`}>
              <SkRect x={x} y={y} w={190} h={100} p={pp} id={60 + i} sw={3} fill="#EEEBE5" />
              <SkLine a={[x - 10, y + 70]} b={[x + 200, y + 30]} p={prog(f, 46 + i * 8, 4)} id={70 + i} sw={4} />
            </g>
          );
        })}
      </Sk>
      <HandText x={W.x + 60} y={W.y + 100} size={84} font={HAND} p={prog(f, 10, 8)} id={80}>BLOG</HandText>
      <HandText x={W.x + 400} y={W.y + 250} size={56} font={SCRIPT} p={prog(f, 22, 10)} id={81}>Last post: March</HandText>
      {months.map((m, i) => (
        <HandText key={m} x={1220 + (i % 2) * 150 + 95} y={300 + i * 120 + 24} size={46} font={SCRIPT} p={prog(f, 42 + i * 8, 6)} id={90 + i}
          align="center" width={190} rot={i % 2 ? 6 : -5}>{m}</HandText>
      ))}
    </>
  );
}

function Fix({ fl, rows, tApprove, approveText }: Props & { fl: number }) {
  const X = 170, Y = 280, W = 1330;
  return (
    <>
      <Smudge x={X + W / 2} y={640} w={1500} h={760} o={0.14} />
      <Sk>
        <SkRect x={X} y={Y} w={W} h={560} p={prog(fl, -2, 12)} id={200} sw={4.5} fill="#EFECE6" />
        <SkLine a={[X, Y + 90]} b={[X + W, Y + 90]} p={prog(fl, 4, 8)} id={201} sw={3} />
        {rows.map((_, i) => {
          const y = Y + 90 + i * 156;
          return (
            <g key={i}>
              {i > 0 && <SkLine a={[X + 20, y]} b={[X + W - 20, y]} p={prog(fl, 8 + i * 6, 8)} id={210 + i} sw={2} o={0.55} />}
              <SkRect x={X + 30} y={y + 30} w={110} h={96} p={prog(fl, 10 + i * 6, 8)} id={220 + i} sw={3} />
              <Hatch x={X + 34} y={y + 34} w={102} h={88} p={prog(fl, 12 + i * 6, 8)} id={230 + i} gap={10} o={0.3} />
              <SkRect x={X + W - 330} y={y + 46} w={290} h={64} p={prog(fl, 14 + i * 6, 8)} id={240 + i} sw={i === 0 ? 4 : 2.6} />
            </g>
          );
        })}
        {/* approval gate */}
        <SkRect x={X} y={Y + 600} w={84} h={84} p={prog(fl, tApprove - 20, 8)} id={260} sw={4.5} />
        <SkCheck x={X + 14} y={Y + 640} s={1.4} p={prog(fl, tApprove, 6)} id={261} sw={7} />
      </Sk>
      <HandText x={X + 40} y={Y + 18} size={56} font={HAND} p={prog(fl, 2, 8)} id={270}>Blog plan</HandText>
      <HandText x={X + 380} y={Y + 30} size={40} font={PRINT} weight={400} p={prog(fl, 6, 8)} id={271} color="#4a4744">Tue + Thu · next article prepared</HandText>
      {rows.map((r, i) => {
        const y = Y + 90 + i * 156;
        return (
          <div key={i}>
            <HandText x={X + 170} y={y + 26} size={34} font={PRINT} weight={400} p={prog(fl, 12 + i * 6, 6)} id={280 + i} color="#4a4744">{r.day}</HandText>
            <HandText x={X + 170} y={y + 66} size={54} font={SCRIPT} p={prog(fl, 14 + i * 6, 10)} id={290 + i}>{r.title}</HandText>
            <HandText x={X + W - 185} y={y + 58} size={38} font={PRINT} weight={400} p={prog(fl, 18 + i * 6, 6)} id={300 + i} align="center" width={290}>{r.status}</HandText>
          </div>
        );
      })}
      <HandText x={X + 120} y={Y + 608} size={64} font={HAND} p={prog(fl, tApprove - 16, 12)} id={310}>{approveText}</HandText>
    </>
  );
}
