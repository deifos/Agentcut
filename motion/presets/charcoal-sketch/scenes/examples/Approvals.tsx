// Pain 2: approvals lost in email threads (scattered envelopes, Re: Re: Fwd subjects, one tangled thread line)
// Fix 2: one review panel — post preview, the client's comment, Approve pressed, APPROVED stamp.
import { SPRING, mix, sp, type SceneProps } from "agentcut";
import { PainFix } from "./lib/painfix";
import { HAND, HandText, Hatch, PRINT, SCRIPT, Sk, SkEllipse, SkLine, SkPoly, SkRect, Smudge, clamp, prog, rng } from "./lib/sketch";

type Props = SceneProps & {
  tSwipe: number; tPainText: number; tFixText: number; painText: string; fixText: string;
  subjects: string[]; client: string; comment: string; tPress: number; tStamp: number;
};

const ENV = [
  { x: 150, y: 300, r: -6 }, { x: 560, y: 270, r: 4 }, { x: 980, y: 320, r: -3 },
  { x: 260, y: 640, r: 5 }, { x: 700, y: 610, r: -4 }, { x: 1120, y: 660, r: 3 },
];

export default function Approvals(p: Props) {
  return (
    <PainFix duration={p.clip.duration} tSwipe={p.tSwipe} tPainText={p.tPainText} tFixText={p.tFixText}
      painText={p.painText} fixText={p.fixText} fixPose="celebration" fixAt={[1720, 1005, 320]}
      pain={(f) => <Pain f={f} {...p} />} fix={(f, fl) => <Fix fl={fl} {...p} />} />
  );
}

function Pain({ f, subjects }: Props & { f: number }) {
  // the tangled thread: a long wandering line through every envelope
  const r = rng(42);
  const thread: [number, number][] = [];
  for (let i = 0; i < 14; i++) thread.push([180 + r() * 1200, 300 + r() * 620]);
  return (
    <>
      <Smudge x={760} y={620} w={1400} h={700} o={0.18} />
      <Sk>
        {ENV.map((e, i) => {
          const pp = prog(f, 4 + i * 5, 10);
          return (
            <g key={i} transform={`rotate(${e.r} ${e.x + 190} ${e.y + 110})`}>
              <SkRect x={e.x} y={e.y} w={380} h={220} p={pp} id={20 + i} sw={3.4} fill="#EEEBE5" />
              <SkPoly pts={[[e.x, e.y], [e.x + 190, e.y + 110], [e.x + 380, e.y]]} p={pp} id={30 + i} sw={3} />
              <Hatch x={e.x + 300} y={e.y + 16} w={60} h={40} p={pp} id={40 + i} gap={7} o={0.5} />
            </g>
          );
        })}
        <SkPoly pts={thread} p={prog(f, 36, 70)} id={60} sw={2.4} o={0.5} rough={1.5} />
        {/* question marks */}
        {[[1430, 420], [1300, 800]].map(([x, y], i) => (
          <SkEllipse key={i} cx={x} cy={y} rx={10} ry={10} p={prog(f, 70 + i * 8, 6)} id={70 + i} sw={6} />
        ))}
      </Sk>
      {ENV.map((e, i) => (
        <HandText key={i} x={e.x + 20} y={e.y + 150} size={34} font={PRINT} weight={400} p={prog(f, 10 + i * 5, 8)} id={80 + i}
          rot={e.r} width={360}>{subjects[i % subjects.length]}</HandText>
      ))}
      <HandText x={1390} y={300} size={160} font={HAND} p={prog(f, 70, 6)} id={90}>?</HandText>
      <HandText x={1260} y={680} size={120} font={HAND} p={prog(f, 78, 6)} id={91} rot={12}>?</HandText>
    </>
  );
}

function Fix({ fl, client, comment, tPress, tStamp }: Props & { fl: number }) {
  const pg = (d: number, l = 10) => prog(fl, d, l);
  const pressed = fl >= tPress;
  const stamp = sp(fl, tStamp, SPRING.land);
  return (
    <>
      <Smudge x={820} y={640} w={1500} h={760} o={0.14} />
      <Sk>
        <SkRect x={170} y={270} w={1330} h={720} p={pg(-2, 12)} id={200} sw={4.5} fill="#EFECE6" />
        {/* post preview */}
        <SkRect x={220} y={330} w={560} h={600} p={pg(4)} id={201} sw={3.2} />
        <SkEllipse cx={270} cy={380} rx={26} ry={26} p={pg(6)} id={202} sw={3} />
        <SkRect x={240} y={430} w={520} h={300} p={pg(8)} id={203} sw={3} />
        <Hatch x={246} y={436} w={508} h={288} p={pg(8)} id={204} gap={14} o={0.25} />
        {[0, 1, 2].map((k) => <SkLine key={k} a={[240, 770 + k * 40]} b={[740 - k * 120, 770 + k * 40]} p={pg(12 + k * 2)} id={205 + k} sw={2.4} o={0.6} />)}
        {/* comment bubble */}
        <SkPoly pts={[[840, 340], [1450, 340], [1450, 560], [920, 560], [880, 610], [890, 560], [840, 560]]} closed p={pg(14, 12)} id={210} sw={3.4} />
        {/* buttons */}
        <SkRect x={840} y={800} w={290} h={110} p={pg(20)} id={220} sw={3.4} />
        <SkRect x={1160} y={800 + (pressed ? 4 : 0)} w={290} h={110} p={pg(22)} id={221} sw={5} fill={pressed ? "#3a3734" : "#d9d5ce"} />
        {pressed && fl < tPress + 8 && [0, 1, 2, 3, 4].map((k) => {
          const a = (k / 5) * Math.PI * 2;
          return <SkLine key={k} a={[1305 + Math.cos(a) * 170, 855 + Math.sin(a) * 80]} b={[1305 + Math.cos(a) * 205, 855 + Math.sin(a) * 100]} id={225 + k} sw={3} />;
        })}
        {/* pointer that presses Approve */}
        {fl >= tPress - 14 && (() => {
          const t = clamp((fl - (tPress - 14)) / 14, 0, 1);
          const x = mix(1500, 1330, t), y = mix(1000, 870, t);
          return <SkPoly pts={[[x, y], [x + 18, y + 52], [x + 28, y + 34], [x + 52, y + 46], [x, y]]} closed id={230} sw={3.4} />;
        })()}
        {/* APPROVED stamp */}
        {fl >= tStamp && (
          <g transform={`rotate(-9 500 580) translate(${500 * (1 - mix(1.4, 1, stamp))} ${580 * (1 - mix(1.4, 1, stamp))}) scale(${mix(1.4, 1, stamp)})`} opacity={Math.min(1, stamp * 2)}>
            <SkRect x={230} y={495} w={540} h={170} id={240} sw={7} fill="#EFECE6" />
            <SkRect x={246} y={511} w={508} h={138} id={241} sw={3} o={0.7} />
          </g>
        )}
      </Sk>
      <HandText x={312} y={360} size={34} font={SCRIPT} p={pg(8, 6)} id={250}>{client}</HandText>
      <HandText x={870} y={360} size={30} font={PRINT} weight={400} p={pg(18, 6)} id={251} color="#4a4744">Client · {client}</HandText>
      <HandText x={870} y={410} size={58} font={SCRIPT} p={pg(22, 12)} id={252} width={560}>{comment}</HandText>
      <HandText x={985} y={828} size={38} font={PRINT} weight={400} p={pg(24, 6)} id={253} align="center" width={290}>Request changes</HandText>
      <HandText x={1305} y={824} size={46} font={HAND} p={pg(26, 6)} id={254} align="center" width={290} color={pressed ? "#F1EEE8" : "#2a2826"}>Approve</HandText>
      {fl >= tStamp && (
        <div style={{ position: "absolute", left: 0, top: 0, opacity: Math.min(1, stamp * 2), transform: `rotate(-9deg) scale(${mix(1.4, 1, stamp)})`, transformOrigin: "500px 580px", width: 1920, height: 1080 }}>
          <HandText x={500} y={517} size={118} font={HAND} id={260} align="center" width={540} style={{ letterSpacing: 6 }}>APPROVED</HandText>
        </div>
      )}
    </>
  );
}
