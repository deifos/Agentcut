// Pain 1: posting by hand, brand by brand (five phones, a pointer tapping POST on each, times scribbled under them)
// Fix 1: one calendar, every client — client tabs, a month grid, post cards landing in their cells.
import { SPRING, sp, type SceneProps } from "agentcut";
import { PainFix } from "./lib/painfix";
import { HandText, Hatch, PRINT, SCRIPT, Sk, SkLine, SkPoly, SkRect, prog } from "./lib/sketch";

type Card = { r: number; c: number; brand: string };
type Props = SceneProps & {
  tSwipe: number; tPainText: number; tFixText: number; painText: string; fixText: string;
  brands: string[]; times: string[]; tabs: string[]; cards: Card[]; tTaps: number; tapEvery: number; tCards: number; cardEvery: number;
  enterFrom?: [number, number] | null;
};

export default function Posting(p: Props) {
  return (
    <PainFix
      duration={p.clip.duration} tSwipe={p.tSwipe} tPainText={p.tPainText} tFixText={p.tFixText}
      painText={p.painText} fixText={p.fixText} fixPose="scheduled" fixAt={[1720, 1005, 330]} enterFrom={p.enterFrom ?? null}
      pain={(f) => <Pain f={f} {...p} />}
      fix={(f, fl) => <Fix f={f} fl={fl} {...p} />}
    />
  );
}

function Pain({ f, brands, times, tTaps, tapEvery }: Props & { f: number }) {
  return (
    <>
      <Sk>
        {brands.map((_, i) => {
          const x = 150 + i * 280, y = 300 + (i % 2) * 30;
          const pp = prog(f, 4 + i * 4, 10);
          const rot = [-3, 2, -1.5, 3, -2][i % 5];
          const tapped = f >= tTaps + i * tapEvery;
          return (
            <g key={i} transform={`rotate(${rot} ${x + 110} ${y + 220})`}>
              <SkRect x={x} y={y} w={220} h={430} p={pp} id={20 + i} sw={3.4} fill="#EEEBE5" />
              <SkLine a={[x + 80, y + 22]} b={[x + 140, y + 22]} p={pp} id={30 + i} sw={3} />
              <SkRect x={x + 22} y={y + 90} w={176} h={150} p={pp} id={40 + i} sw={2.4} />
              <Hatch x={x + 26} y={y + 94} w={168} h={142} p={pp} id={50 + i} gap={13} o={0.22} />
              <SkLine a={[x + 22, y + 262]} b={[x + 190, y + 262]} p={pp} id={60 + i} sw={2} o={0.6} />
              <SkLine a={[x + 22, y + 286]} b={[x + 150, y + 286]} p={pp} id={65 + i} sw={2} o={0.6} />
              <SkRect x={x + 40} y={y + 320} w={140} h={58} p={pp} id={70 + i} sw={3.4} fill={tapped ? "#cfcac2" : undefined} />
              {tapped && f < tTaps + i * tapEvery + 8 && [0, 1, 2, 3].map((k) => {
                const a = (k / 4) * Math.PI * 2 + 0.4;
                return <SkLine key={k} a={[x + 110 + Math.cos(a) * 80, y + 349 + Math.sin(a) * 50]} b={[x + 110 + Math.cos(a) * 110, y + 349 + Math.sin(a) * 70]} id={80 + k + i * 4} sw={3} />;
              })}
            </g>
          );
        })}
        {/* the pointer that taps every POST button, one after another */}
        {(() => {
          const i = Math.min(brands.length - 1, Math.max(0, Math.floor((f - tTaps + tapEvery) / tapEvery)));
          if (f < tTaps - 10) return null;
          const tx = 150 + i * 280 + 140, ty = 300 + (i % 2) * 30 + 380;
          const local = (f - tTaps) - i * tapEvery;
          const lift = local < 0 ? Math.min(1, -local / 6) : Math.max(0, 1 - Math.abs(local) / 3) * 0;
          return <SkPoly pts={[[tx, ty - lift * 40], [tx + 18, ty + 52 - lift * 40], [tx + 28, ty + 34 - lift * 40], [tx + 52, ty + 46 - lift * 40], [tx, ty - lift * 40]]} closed id={99} sw={3.4} />;
        })()}
      </Sk>
      {brands.map((b, i) => {
        const x = 150 + i * 280, y = 300 + (i % 2) * 30;
        return (
          <div key={b}>
            <HandText x={x + 110} y={y + 334} size={36} font={PRINT} weight={400} p={prog(f, 10 + i * 4, 6)} id={110 + i} align="center" width={140}>POST</HandText>
            <HandText x={x + 110} y={y + 448} size={40} font={SCRIPT} p={prog(f, 12 + i * 4, 6)} id={120 + i} align="center" width={220}>{b}</HandText>
            <HandText x={x + 110} y={y + 500} size={44} font={SCRIPT} p={prog(f, tTapsFor(i), 6)} id={130 + i} align="center" width={220} color="#4a4744">{times[i]}</HandText>
          </div>
        );
      })}
    </>
  );
  function tTapsFor(i: number) { return tTaps + i * tapEvery; }
}

const GX = 170, GY = 360, GW = 1330, GH = 610, COLS = 7, ROWS = 4;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Fix({ fl, tabs, cards, tCards, cardEvery }: Props & { f: number; fl: number }) {
  const cw = GW / COLS, rh = (GH - 56) / ROWS;
  const pg = prog(fl, -2, 12);
  return (
    <>
      <Sk>
        {tabs.map((_, i) => (
          <SkPoly key={i} pts={[[GX + i * 250, GY], [GX + i * 250 + 18, GY - 62], [GX + i * 250 + 222, GY - 62], [GX + i * 250 + 240, GY]]} p={prog(fl, i * 3, 8)} id={300 + i} sw={i === 0 ? 4.5 : 3} />
        ))}
        <SkRect x={GX} y={GY} w={GW} h={GH} p={pg} id={310} sw={4.5} fill="#EFECE6" />
        <SkLine a={[GX, GY + 56]} b={[GX + GW, GY + 56]} p={pg} id={311} sw={3} />
        {Array.from({ length: COLS - 1 }, (_, i) => (
          <SkLine key={i} a={[GX + (i + 1) * cw, GY + 56]} b={[GX + (i + 1) * cw, GY + GH]} p={prog(fl, 4 + i, 8)} id={320 + i} sw={2} o={0.6} />
        ))}
        {Array.from({ length: ROWS - 1 }, (_, i) => (
          <SkLine key={i} a={[GX, GY + 56 + (i + 1) * rh]} b={[GX + GW, GY + 56 + (i + 1) * rh]} p={prog(fl, 6 + i, 8)} id={330 + i} sw={2} o={0.6} />
        ))}
        {cards.map((c, i) => {
          const t0 = tCards + i * cardEvery;
          if (fl < t0) return null;
          const land = sp(fl, t0, SPRING.pop);
          const x = GX + c.c * cw + 10, y = GY + 56 + c.r * rh + 10 - (1 - land) * 60;
          return (
            <g key={i} opacity={Math.min(1, land * 1.5)}>
              <SkRect x={x} y={y} w={cw - 20} h={rh - 20} id={340 + i} sw={3} fill="#F4F2EE" />
              <Hatch x={x + 8} y={y + 8} w={44} h={rh - 36} id={360 + i} gap={8} o={0.4} />
            </g>
          );
        })}
      </Sk>
      {tabs.map((t, i) => (
        <HandText key={t} x={GX + i * 250 + 120} y={GY - 56} size={40} font={SCRIPT} p={prog(fl, 2 + i * 3, 6)} id={380 + i} align="center" width={220}>{t}</HandText>
      ))}
      {DAYS.map((d, i) => (
        <HandText key={d} x={GX + i * cw + cw / 2} y={GY + 6} size={36} font={PRINT} weight={400} p={prog(fl, 6 + i, 4)} id={390 + i} align="center" width={cw}>{d}</HandText>
      ))}
      {cards.map((c, i) => {
        const t0 = tCards + i * cardEvery;
        if (fl < t0) return null;
        const land = sp(fl, t0, SPRING.pop);
        const x = GX + c.c * cw + 10, y = GY + 56 + c.r * rh + 10 - (1 - land) * 60;
        return (
          <div key={i} style={{ opacity: Math.min(1, land * 1.5) }}>
            <HandText x={x + 60} y={y + 12} size={28} font={SCRIPT} id={400 + i}>{c.brand}</HandText>
            <HandText x={x + 60} y={y + 52} size={22} font={PRINT} weight={400} id={420 + i} color="#4a4744">Scheduled</HandText>
          </div>
        );
      })}
    </>
  );
}
