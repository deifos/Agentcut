// Hook: a comic page sketches itself, one panel per phrase ("Ten clients. Ten calendars. One very tired team.").
// All charcoal. At the drop the colour mascot jumps up through the gutter and the page blows away.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SPRING, ease, mix, sp, type SceneProps } from "agentcut";
import {
  HAND, Hatch, HandText, INK, Mascot, MascotShadow, PRINT, Sk, SkEllipse, SkLine, SkPoly, SkRect, prog, rng, boil,
} from "./lib/sketch";

type Props = SceneProps & {
  t1: number; t2: number; t3: number; tShake: number; tMascot: number; tDrop: number;
  l1: string; l2: string; l3: string; clients: string[];
};

const PANELS = [
  { x: 70, y: 90, w: 570, h: 900 },
  { x: 675, y: 90, w: 570, h: 900 },
  { x: 1280, y: 90, w: 570, h: 900 },
];

export default function Hook({ t1, t2, t3, tShake, tMascot, tDrop, l1, l2, l3, clients, clip }: Props) {
  const f = useCurrentFrame();
  const shake = f >= tShake && f < tDrop ? (rng(boil(f, 2) + 3)() - 0.5) * mix(2, 10, ease(f, tShake, tDrop)) : 0;
  const blow = ease(f, tDrop - 2, tDrop + 12);
  const pageStyle = {
    transform: `translate(${shake}px, ${shake * 0.6}px) scale(${1 + blow * 0.35}) rotate(${blow * -4}deg)`,
    opacity: 1 - blow,
  };
  const out = ease(f, clip.duration - 8, clip.duration);

  // mascot: rises in the centre gutter, then jumps on the drop
  const rise = sp(f, tMascot, SPRING.pop);
  const jump = sp(f, tDrop - 4, SPRING.snappy);
  const my = mix(1180, 1030, rise) - jump * 120 + ease(f, tDrop + 6, tDrop + 18) * 120;
  const pose = f < tDrop - 4 ? "confused" : "excited";

  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <AbsoluteFill style={pageStyle}>
        <Sk>
          {PANELS.map((p, i) => (
            <SkRect key={i} x={p.x} y={p.y} w={p.w} h={p.h} p={prog(f, [t1, t2, t3][i] - 14, 12)} id={10 + i} sw={5} />
          ))}
          {/* panel 1: ten client folders */}
          {clients.map((_, i) => {
            const c = i % 2, r = Math.floor(i / 2);
            const x = 120 + c * 270, y = 270 + r * 140;
            const pp = prog(f, t1 + i * 2, 10);
            return (
              <g key={i}>
                <SkPoly pts={[[x, y + 18], [x + 60, y + 18], [x + 78, y], [x + 140, y], [x + 150, y + 18], [x + 220, y + 18], [x + 220, y + 110], [x, y + 110]]} closed p={pp} id={40 + i} sw={3} />
                <Hatch x={x + 6} y={y + 74} w={208} h={30} p={pp} id={60 + i} gap={12} o={0.25} />
              </g>
            );
          })}
          {/* panel 2: ten calendars, fanned */}
          {Array.from({ length: 10 }, (_, i) => {
            const pp = prog(f, t2 + i * 2, 10);
            const ox = 712 + i * 10, oy = 262 + i * 44;
            return (
              <g key={i} transform={`rotate(${(i - 5) * 1.6} ${ox + 190} ${oy + 120})`}>
                <SkRect x={ox} y={oy} w={380} h={240} p={pp} id={80 + i} sw={2.8} fill="#ECE9E2" />
                <SkLine a={[ox, oy + 50]} b={[ox + 380, oy + 50]} p={pp} id={95 + i} sw={2.4} />
                {i === 9 && [1, 2, 3, 4, 5, 6].map((k) => (
                  <SkLine key={k} a={[ox + k * 54, oy + 50]} b={[ox + k * 54, oy + 240]} p={pp} id={110 + k} sw={1.8} o={0.6} />
                ))}
                {i === 9 && [1, 2, 3].map((k) => (
                  <SkLine key={k} a={[ox, oy + 50 + k * 47]} b={[ox + 380, oy + 50 + k * 47]} p={pp} id={120 + k} sw={1.8} o={0.6} />
                ))}
              </g>
            );
          })}
          {/* panel 3: tired team — coffee, clock, buzzing laptop (props only) */}
          {(() => {
            const pp = (d: number) => prog(f, t3 + d, 10);
            return (
              <g>
                {/* clock */}
                <SkEllipse cx={1565} cy={330} rx={110} ry={110} p={pp(0)} id={140} sw={4} />
                <SkLine a={[1565, 330]} b={[1565, 255]} p={pp(4)} id={141} sw={5} />
                <SkLine a={[1565, 330]} b={[1620, 360]} p={pp(4)} id={142} sw={5} />
                {[0, 1, 2, 3].map((k) => (
                  <SkLine key={k} a={[1565 + Math.cos((k * Math.PI) / 2) * 92, 330 + Math.sin((k * Math.PI) / 2) * 92]} b={[1565 + Math.cos((k * Math.PI) / 2) * 104, 330 + Math.sin((k * Math.PI) / 2) * 104]} p={pp(2)} id={143 + k} sw={3} />
                ))}
                {/* laptop */}
                <SkPoly pts={[[1370, 760], [1410, 560], [1720, 560], [1760, 760]]} closed p={pp(6)} id={150} sw={3.5} />
                <SkRect x={1340} y={760} w={450} h={26} p={pp(8)} id={151} sw={3} />
                <Hatch x={1425} y={578} w={280} h={160} p={pp(8)} id={152} gap={16} o={0.22} />
                {/* notification badge 99+ */}
                <SkEllipse cx={1712} cy={560} rx={52} ry={40} p={pp(10)} id={153} sw={4} />
                {/* mug + steam */}
                <SkPoly pts={[[1400, 850], [1412, 960], [1500, 960], [1512, 850]]} p={pp(12)} id={154} sw={3.5} />
                <SkEllipse cx={1534} cy={895} rx={26} ry={30} p={pp(12)} id={155} sw={3} />
                <SkPoly pts={[[1430, 830], [1440, 800], [1428, 770], [1440, 740]]} p={pp(16)} id={156} sw={2.2} o={0.55} />
                <SkPoly pts={[[1470, 830], [1482, 800], [1468, 770], [1480, 740]]} p={pp(18)} id={157} sw={2.2} o={0.55} />
                {/* stress lines */}
                {f >= tShake && [0, 1, 2].map((k) => (
                  <SkLine key={k} a={[1700 + k * 30, 250 - k * 10]} b={[1730 + k * 34, 200 - k * 14]} id={160 + k} sw={3} />
                ))}
              </g>
            );
          })()}
        </Sk>
        {/* caption boxes (comic style) */}
        {[l1, l2, l3].map((t, i) => {
          const p = PANELS[i];
          const pp = prog(f, [t1, t2, t3][i], 8);
          return (
            <div key={i} style={{ position: "absolute", left: p.x + 24, top: p.y + 24, opacity: pp > 0 ? 1 : 0 }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: p.w - 48, height: 120, background: "#F1EEE8", border: `4px solid ${INK}`, transform: `rotate(${i === 1 ? 0.8 : -0.6}deg)` }} />
              <HandText x={18} y={14} size={i === 2 ? 62 : i === 1 ? 74 : 92} p={prog(f, [t1, t2, t3][i], 8)} id={200 + i} width={p.w - 84}>{t}</HandText>
            </div>
          );
        })}
        {/* client names on the folders */}
        {clients.map((n, i) => {
          const c = i % 2, r = Math.floor(i / 2);
          return <HandText key={n} x={136 + c * 270} y={302 + r * 140} size={30} font={PRINT} weight={400} p={prog(f, t1 + i * 2 + 4, 6)} id={220 + i}>{n}</HandText>;
        })}
        <HandText x={1712} y={536} size={40} font={HAND} p={prog(f, t3 + 12, 6)} id={240} align="center" width={110}>99+</HandText>
      </AbsoluteFill>

      {f >= tMascot && f < tDrop && (
        <>
          {f < tDrop + 4 && <MascotShadow x={960} y={1030} w={220} o={0.45 * (1 - jump)} />}
          <Mascot pose={pose} x={960} y={my} h={300} rot={mix(0, -6, jump)} squash={f >= tDrop - 6 && f < tDrop - 3 ? 0.08 : 0} />
        </>
      )}
    </AbsoluteFill>
  );
}
