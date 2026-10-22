// Pain 3: copy-pasting from your AI into five tools (chat sheet, arrows to five tool boxes, Ctrl+C / Ctrl+V scribbles)
// Fix 3: Rolino in the middle, your AI agents wired in, a padlock + check on every line (access you approve).
import { SPRING, sp, type SceneProps } from "agentcut";
import { PainFix } from "./lib/painfix";
import { HAND, HandText, Hatch, PRINT, SCRIPT, Sk, SkArrow, SkCheck, SkLine, SkPoly, SkRect, Smudge, prog } from "./lib/sketch";

type Props = SceneProps & {
  tSwipe: number; tPainText: number; tFixText: number; painText: string; fixText: string;
  tools: string[]; agents: string[]; footnote: string; tLocks: number;
};

export default function Agents(p: Props) {
  return (
    <PainFix duration={p.clip.duration} tSwipe={p.tSwipe} tPainText={p.tPainText} tFixText={p.tFixText}
      painText={p.painText} fixText={p.fixText} fixPose="working" fixAt={[1700, 1005, 300]} painSize={88}
      pain={(f) => <Pain f={f} {...p} />} fix={(f, fl) => <Fix fl={fl} {...p} />} />
  );
}

const TOOLS_Y = (i: number) => 290 + i * 140;

function Pain({ f, tools }: Props & { f: number }) {
  return (
    <>
      <Smudge x={420} y={640} w={700} h={760} o={0.18} />
      <Sk>
        {/* AI chat sheet */}
        <SkRect x={170} y={300} w={480} h={660} p={prog(f, 2, 12)} id={20} sw={4} fill="#EEEBE5" />
        {[0, 1, 2, 3].map((k) => {
          const y = 400 + k * 135, left = k % 2 === 0;
          return (
            <g key={k}>
              <SkRect x={left ? 200 : 300} y={y} w={320} h={96} p={prog(f, 8 + k * 4, 8)} id={30 + k} sw={2.6} />
              {[0, 1].map((j) => <SkLine key={j} a={[(left ? 220 : 320), y + 32 + j * 30]} b={[(left ? 480 : 590) - j * 60, y + 32 + j * 30]} p={prog(f, 10 + k * 4, 8)} id={40 + k * 2 + j} sw={2} o={0.55} />)}
            </g>
          );
        })}
        {/* five tool boxes */}
        {tools.map((_, i) => (
          <g key={i}>
            <SkRect x={1080} y={TOOLS_Y(i)} w={330} h={104} p={prog(f, 14 + i * 4, 8)} id={60 + i} sw={3.4} />
            <Hatch x={1086} y={TOOLS_Y(i) + 6} w={60} h={92} p={prog(f, 14 + i * 4, 8)} id={70 + i} gap={8} o={0.4} />
          </g>
        ))}
        {/* copy/paste arrows, drawn one after another, again and again */}
        {tools.map((_, i) => {
          const t0 = 34 + i * 14;
          return <SkArrow key={i} a={[660, 620]} b={[1070, TOOLS_Y(i) + 52]} p={prog(f, t0, 8)} id={80 + i} sw={3} />;
        })}
      </Sk>
      {tools.map((t, i) => (
        <HandText key={t} x={1166} y={TOOLS_Y(i) + 24} size={50} font={SCRIPT} p={prog(f, 18 + i * 4, 6)} id={100 + i}>{t}</HandText>
      ))}
      <HandText x={210} y={312} size={38} font={PRINT} weight={400} p={prog(f, 6, 6)} id={110}>AI chat</HandText>
      {[0, 1, 2, 3, 4].map((i) => (
        <HandText key={i} x={760 + (i % 2) * 40} y={330 + i * 130} size={40} font={SCRIPT} p={prog(f, 40 + i * 14, 6)} id={120 + i} rot={-8 + i * 4} color="#4a4744">
          {i % 2 === 0 ? "Ctrl+C" : "Ctrl+V"}
        </HandText>
      ))}
    </>
  );
}

const HUB = { x: 690, y: 500, w: 420, h: 220 };
const SPOTS: [number, number][] = [[200, 300], [1210, 300], [200, 790], [1210, 790]];

function Fix({ fl, agents, footnote, tLocks }: Props & { fl: number }) {
  const cx = HUB.x + HUB.w / 2, cy = HUB.y + HUB.h / 2;
  return (
    <>
      <Smudge x={cx} y={cy + 30} w={900} h={520} o={0.2} />
      <Sk>
        <SkRect x={HUB.x} y={HUB.y} w={HUB.w} h={HUB.h} p={prog(fl, -2, 10)} id={200} sw={6} fill="#EFECE6" />
        {SPOTS.map(([x, y], i) => {
          const bx = x + 150, by = y + 50;
          const lx = (bx + cx) / 2, ly = (by + cy) / 2;
          const lock = sp(fl, tLocks + i * 6, SPRING.pop);
          return (
            <g key={i}>
              <SkRect x={x} y={y} w={300} h={100} p={prog(fl, 6 + i * 4, 8)} id={210 + i} sw={3.6} />
              <SkLine a={[x < cx ? x + 300 : x, by]} b={[x < cx ? HUB.x : HUB.x + HUB.w, cy + (y < cy ? -50 : 50)]} p={prog(fl, 12 + i * 4, 10)} id={220 + i} sw={3} />
              {fl >= tLocks + i * 6 && (
                <g transform={`translate(${lx - 30} ${ly - 30}) scale(${lock * 1.7})`} >
                  <SkRect x={-22} y={-4} w={44} h={36} id={230 + i} sw={3.4} fill="#EFECE6" />
                  <SkPoly pts={[[-13, -4], [-13, -20], [0, -30], [13, -20], [13, -4]]} id={240 + i} sw={3} />
                  <SkCheck x={22} y={10} s={0.8} id={250 + i} sw={4} />
                </g>
              )}
            </g>
          );
        })}
      </Sk>
      <HandText x={cx} y={HUB.y + 58} size={92} font={HAND} p={prog(fl, 2, 8)} id={260} align="center" width={HUB.w}>Rolino</HandText>
      {SPOTS.map(([x, y], i) => (
        <HandText key={i} x={x + 150} y={y + 22} size={50} font={SCRIPT} p={prog(fl, 10 + i * 4, 6)} id={270 + i} align="center" width={300}>{agents[i]}</HandText>
      ))}
      <HandText x={200} y={950} size={28} font={PRINT} weight={400} p={prog(fl, 40, 10)} id={280} color="#55524e">{footnote}</HandText>
    </>
  );
}
