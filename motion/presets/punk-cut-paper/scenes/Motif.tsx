// Cut-paper illustrations for the lyrics. Each motif is a few paper pieces (SVG, rough-cut edges + drop shadow)
// that slap onto the wall one after another, then move in stop-motion steps (12 fps).
// kind: garden pot wheel cheer sun dumbbell calendar medal house palm glasses sprout crown maple hearts hearts2
//       notes bolt bolt2 food camera vinyl clock badge53 heartbeat cake chain
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { SceneProps } from "agentcut";
import { P, areas, easeIn, hash, jit, q12, slap, st, beatPulse, type Side } from "./lib/punk";

type Props = SceneProps & { kind: string; side?: Side; seed?: number; x?: number; y?: number; scale?: number;
  mobile?: { x?: number; y?: number; scale?: number };
  ox?: number; oy?: number; // offset from the picture-area center, in picture sizes (stickers on a photo corner)
}; // placement override for vertical variants

// ---------- shape helpers (600×600 box) ----------
const star = (cx: number, cy: number, n: number, r1: number, r2: number, rot = 0) => {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n + rot - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    d += `${i ? "L" : "M"}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} `;
  }
  return d + "Z";
};
const heart = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy + s * 0.9} C${cx - s * 1.4} ${cy - s * 0.1} ${cx - s * 0.9} ${cy - s * 1.1} ${cx} ${cy - s * 0.45} C${cx + s * 0.9} ${cy - s * 1.1} ${cx + s * 1.4} ${cy - s * 0.1} ${cx} ${cy + s * 0.9} Z`;
const leaf = (len: number, w: number) => `M0 0 C${len * 0.3} ${-w} ${len * 0.7} ${-w} ${len} 0 C${len * 0.7} ${w} ${len * 0.3} ${w} 0 0 Z`;
const note = (x: number, y: number, c: string) => (
  <g>
    <ellipse cx={x} cy={y} rx={30} ry={22} transform={`rotate(-20 ${x} ${y})`} fill={c} />
    <rect x={x + 22} y={y - 120} width={12} height={122} fill={c} />
    <path d={`M${x + 22} ${y - 120} q 50 20 40 70 q -10 -30 -40 -35 Z`} fill={c} />
  </g>
);

type Pc = { node: React.ReactNode; at: number; cx: number; cy: number; tf?: string; stroke?: boolean };

function pieces(kind: string, f: number, abs: number, seed: number): { list: Pc[]; html?: React.ReactNode } {
  const t = q12(f); // stepped time
  const pulse = beatPulse(abs, 8);
  const sway = (amp: number, per = 40, ph = 0) => Math.sin(((t + ph) / per) * Math.PI * 2) * amp;
  const W = P.white;
  switch (kind) {
    case "garden":
      return { list: [
        { at: 2, cx: 300, cy: 520, node: <path d="M40 480 L560 470 L575 570 L30 580 Z" fill={P.kraft} /> },
        { at: 5, cx: 300, cy: 470, tf: `rotate(${sway(3)} 300 470)`, node: <rect x={290} y={200} width={20} height={280} fill={P.green} /> },
        { at: 7, cx: 300, cy: 380, tf: `rotate(${sway(6, 30)} 300 380)`, node: <path d={leaf(170, 45)} transform="translate(300 380) rotate(-30)" fill={P.green} /> },
        { at: 9, cx: 300, cy: 330, tf: `rotate(${sway(-6, 30)} 300 330)`, node: <path d={leaf(150, 40)} transform="translate(300 330) rotate(-150)" fill="#2E7D32" /> },
        { at: 12, cx: 300, cy: 190, tf: `rotate(${t * 1.5} 300 190)`, node: <g>{Array.from({ length: 8 }).map((_, i) => <circle key={i} cx={300 + Math.cos((i * Math.PI) / 4) * 70} cy={190 + Math.sin((i * Math.PI) / 4) * 70} r={48} fill={P.pink} />)}</g> },
        { at: 14, cx: 300, cy: 190, node: <circle cx={300} cy={190} r={50} fill={P.yellow} /> },
        { at: 17, cx: 130, cy: 450, tf: `rotate(${-30 + sway(4, 24)} 130 450)`, node: <g><path d="M130 330 L175 430 L130 470 L85 430 Z" fill="#9AA3A8" /><rect x={122} y={470} width={16} height={90} fill={P.red} /></g> },
      ] };
    case "pot":
      return { list: [
        ...[0, 1, 2].map((i) => ({ at: 12 + i * 2, cx: 220 + i * 80, cy: 150, tf: `translate(0 ${-((t * 3 + i * 25) % 70)})`,
          node: <path d={`M${220 + i * 80} 250 q -30 -40 0 -80 q 30 -40 0 -80`} stroke={W} strokeWidth={22} fill="none" strokeLinecap="round" /> })),
        { at: 2, cx: 300, cy: 400, node: <path d="M140 300 L460 300 L440 470 Q300 520 160 470 Z" fill={P.red} /> },
        { at: 4, cx: 300, cy: 290, node: <rect x={110} y={270} width={380} height={42} fill={P.ink} /> },
        { at: 6, cx: 300, cy: 360, node: <g><rect x={80} y={330} width={70} height={30} fill={P.ink} /><rect x={450} y={330} width={70} height={30} fill={P.ink} /></g> },
        ...[[110, 120], [480, 140], [420, 60], [170, 50]].map(([x, y], i) => ({ at: 16 + i * 3, cx: x, cy: y,
          tf: `rotate(${t * 4} ${x} ${y}) scale(1)`, node: <path d={star(x, y, 4, 45 * (0.7 + 0.5 * pulse), 12)} fill={P.yellow} /> })),
      ] };
    case "wheel":
      return { list: [
        ...[0, 1, 2].map((i) => ({ at: 2 + i, cx: 120, cy: 220 + i * 80, node: <rect x={20 + i * 30} y={200 + i * 80} width={200} height={26} fill={i === 1 ? P.yellow : P.red} /> })),
        { at: 5, cx: 330, cy: 300, tf: `rotate(${t * 9} 330 300)`, node: <g>
          <circle cx={330} cy={300} r={200} fill={P.ink} /><circle cx={330} cy={300} r={140} fill={P.yellow} />
          {Array.from({ length: 6 }).map((_, i) => <rect key={i} x={322} y={170} width={16} height={260} fill={P.ink} transform={`rotate(${i * 30} 330 300)`} />)}
          <circle cx={330} cy={300} r={40} fill={P.red} /></g> },
        { at: 9, cx: 300, cy: 530, node: <path d="M20 520 L580 510 L585 545 L15 555 Z" fill={P.ink} /> },
      ] };
    case "bowling": {
      // ball rolls in from the left and scatters the pins
      const roll = Math.min(1, Math.max(0, (t - 8) / 70)); // strike lands on "roll" (~f94 of the clip)
      const hit = Math.min(1, Math.max(0, (t - 78) / 10));
      const bx = -60 + roll * 250;
      const pin = (x: number, y: number) => (
        <g><path d={`M${x} ${y - 95} C${x + 26} ${y - 95} ${x + 26} ${y - 55} ${x + 14} ${y - 40} C${x + 40} ${y - 10} ${x + 40} ${y + 50} ${x + 22} ${y + 70} L${x - 22} ${y + 70} C${x - 40} ${y + 50} ${x - 40} ${y - 10} ${x - 14} ${y - 40} C${x - 26} ${y - 55} ${x - 26} ${y - 95} ${x} ${y - 95} Z`} fill={W} />
          <rect x={x - 17} y={y - 42} width={34} height={10} fill={P.red} /><rect x={x - 19} y={y - 26} width={38} height={10} fill={P.red} /></g>
      );
      const pins: [number, number][] = [[350, 300], [420, 270], [420, 340], [490, 240], [490, 310], [490, 380]];
      return { list: [
        { at: 2, cx: 300, cy: 520, node: <path d="M0 470 L600 455 L600 560 L0 575 Z" fill={P.kraft} /> },
        ...pins.map(([x, y], i) => {
          const a = hash(seed + i, 21) * 2 - 1;
          return { at: 4 + i, cx: x, cy: y, tf: `translate(${hit * (30 + i * 12)} ${-Math.sin(hit * Math.PI) * 70 + hit * 40}) rotate(${hit * (a > 0 ? 75 : -75)} ${x} ${y + 70})`, node: pin(x, y) };
        }),
        { at: 3, cx: 220, cy: 380, tf: `translate(${bx - 220} 0) rotate(${roll * 540} 220 380)`, node: <g>
          <circle cx={220} cy={380} r={110} fill={P.ink} />
          <circle cx={190} cy={340} r={16} fill={P.paper} /><circle cx={232} cy={330} r={16} fill={P.paper} /><circle cx={215} cy={375} r={16} fill={P.paper} /></g> },
        ...(hit > 0 && t < 100 ? [{ at: 16, cx: 450, cy: 300, node: <path d={star(400, 300, 12, 230 * Math.min(1, hit * 1.5), 90)} fill={P.yellow} /> }] : []),
      ] };
    }
    case "cheer":
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `rotate(${t * 0.8} 300 300) scale(${1 + pulse * 0.05})`, node: <path d={star(300, 300, 14, 280, 190)} fill={P.yellow} /> },
        { at: 5, cx: 300, cy: 300, tf: `rotate(${-t * 1.2} 300 300)`, node: <path d={star(300, 300, 12, 190, 130)} fill={P.red} /> },
        ...[-1, 0, 1].map((i) => ({ at: 9 + (i + 1) * 3, cx: 300 + i * 90, cy: 300, tf: `rotate(${i * 12} ${300 + i * 90} 300)`,
          node: <g><rect x={278 + i * 90} y={180} width={44} height={150} fill={P.ink} /><rect x={278 + i * 90} y={350} width={44} height={44} fill={P.ink} /></g> })),
        ...Array.from({ length: 12 }).map((_, i) => {
          const x = 30 + hash(seed + i, 1) * 540, y0 = hash(seed + i, 2) * 300;
          const y = (y0 + t * (4 + hash(seed + i, 3) * 4)) % 620 - 20;
          return { at: 12, cx: x, cy: y, node: <rect x={x} y={y} width={26} height={14} transform={`rotate(${t * 10 + i * 40} ${x} ${y})`} fill={[P.pink, P.teal, P.blue, P.orange][i % 4]} /> };
        }),
      ] };
    case "sun":
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `rotate(${t * 1.5} 300 300)`, node: <g>{Array.from({ length: 12 }).map((_, i) => <path key={i} d="M300 10 L335 120 L265 120 Z" fill={P.orange} transform={`rotate(${i * 30} 300 300)`} />)}</g> },
        { at: 5, cx: 300, cy: 300, tf: `scale(${1 + pulse * 0.04})`, node: <circle cx={300} cy={300} r={160} fill={P.yellow} /> },
        { at: 8, cx: 300, cy: 300, node: <circle cx={300} cy={300} r={105} fill="none" stroke={P.orange} strokeWidth={18} strokeDasharray="40 22" /> },
      ] };
    case "dumbbell": {
      const lift = -Math.abs(Math.sin((t / 22) * Math.PI)) * 60;
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `scale(${1 + pulse * 0.06})`, node: <path d={heart(300, 330, 230)} fill={P.pink} /> },
        { at: 6, cx: 300, cy: 300, tf: `translate(0 ${lift}) rotate(${sway(4, 22)} 300 300)`, node: <g>
          <rect x={100} y={285} width={400} height={30} fill={P.ink} />
          <rect x={80} y={190} width={60} height={220} fill={P.red} /><rect x={140} y={220} width={36} height={160} fill={P.yellow} />
          <rect x={460} y={190} width={60} height={220} fill={P.red} /><rect x={424} y={220} width={36} height={160} fill={P.yellow} /></g> },
      ] };
    }
    case "calendar":
      return { list: [
        { at: 2, cx: 300, cy: 320, node: <g><rect x={140} y={130} width={330} height={400} fill="#D8D0C0" /><rect x={125} y={115} width={340} height={405} fill={W} /></g> },
        { at: 4, cx: 300, cy: 160, node: <rect x={125} y={115} width={340} height={95} fill={P.red} /> },
        { at: 6, cx: 300, cy: 115, node: <g>{[190, 300, 410].map((x) => <rect key={x} x={x - 9} y={85} width={18} height={60} rx={9} fill={P.ink} />)}</g> },
        // a page tearing off every step
        { at: 6, cx: 300, cy: 360, tf: `translate(${(t % 5) * 40} ${-(t % 5) * 50}) rotate(${(t % 5) * 14} 300 360)`, node: <rect x={125} y={210} width={340} height={310} fill="#FFF6E0" opacity={0.9} /> },
      ], html: { calendar: true } as any };
    case "medal":
      return { list: [
        { at: 2, cx: 300, cy: 100, node: <g><path d="M190 0 L280 0 L330 250 L250 250 Z" fill={P.blue} /><path d="M410 0 L320 0 L270 250 L350 250 Z" fill={P.red} /></g> },
        { at: 5, cx: 300, cy: 360, tf: `rotate(${sway(8, 26)} 300 0)`, node: <g>
          <path d={star(300, 370, 16, 175, 150)} fill={P.yellow} /><circle cx={300} cy={370} r={120} fill={P.orange} />
          <path d={star(300, 370, 5, 85, 36)} fill={P.ink} /></g> },
      ] };
    case "house":
      return { list: [
        { at: 2, cx: 300, cy: 540, node: <path d="M0 520 L600 510 L600 600 L0 600 Z" fill={P.green} /> },
        ...[0, 1, 2].map((i) => ({ at: 12 + i * 2, cx: 400, cy: 120, tf: `translate(${(t * 2 + i * 30) % 60} ${-((t * 4 + i * 45) % 130)})`, node: <circle cx={410} cy={130} r={24 + i * 6} fill={W} /> })),
        { at: 4, cx: 410, cy: 190, node: <rect x={385} y={130} width={50} height={110} fill={P.ink} /> },
        { at: 5, cx: 300, cy: 400, node: <rect x={150} y={290} width={300} height={240} fill={P.kraft} /> },
        { at: 7, cx: 300, cy: 220, node: <path d="M110 300 L300 120 L490 300 Z" fill={P.red} /> },
        { at: 9, cx: 300, cy: 460, node: <g><rect x={265} y={400} width={70} height={130} fill={P.ink} /><rect x={180} y={340} width={60} height={60} fill={P.yellow} /><rect x={360} y={340} width={60} height={60} fill={P.yellow} /></g> },
        { at: 11, cx: 100, cy: 200, tf: `translate(0 ${-Math.abs(Math.sin(t / 6)) * 30}) rotate(${sway(15, 12)} 100 200)`, node: note(80, 230, P.ink) },
        { at: 13, cx: 520, cy: 260, tf: `translate(0 ${-Math.abs(Math.cos(t / 6)) * 30}) rotate(${sway(-15, 12)} 520 260)`, node: note(500, 300, P.pink) },
      ] };
    case "palm":
      return { list: [
        { at: 2, cx: 400, cy: 220, tf: `scale(${1 + pulse * 0.04})`, node: <circle cx={410} cy={230} r={140} fill={P.orange} /> },
        { at: 4, cx: 300, cy: 540, node: <path d="M0 500 Q75 470 150 500 T300 500 T450 500 T600 500 L600 600 L0 600 Z" fill={P.teal} transform={`translate(${-(t * 3) % 150} 0)`} /> },
        { at: 6, cx: 290, cy: 400, node: <g>{Array.from({ length: 7 }).map((_, i) => <path key={i} d={`M${282 - i * 6} ${540 - i * 45} L${318 - i * 6} ${540 - i * 45} L${312 - (i + 1) * 6} ${495 - i * 45} L${288 - (i + 1) * 6} ${495 - i * 45} Z`} fill={i % 2 ? P.kraft : "#A87B4F"} />)}</g> },
        ...Array.from({ length: 6 }).map((_, i) => ({ at: 9 + i, cx: 255, cy: 225, tf: `rotate(${sway(5, 34, i * 6)} 255 225)`,
          node: <path d={leaf(200, 38)} transform={`translate(255 225) rotate(${-170 + i * 36 + (i > 2 ? 20 : 0)})`} fill={i % 2 ? P.green : "#2E7D32"} /> })),
        { at: 15, cx: 255, cy: 240, node: <g><circle cx={240} cy={245} r={18} fill={P.ink} /><circle cx={272} cy={250} r={18} fill={P.ink} /></g> },
      ] };
    case "glasses": {
      const clink = Math.min(1, Math.max(0, (t - 10) / 8));
      const g = (x: number, rot: number, c: string) => (
        <g transform={`rotate(${rot} ${x} 300)`}>
          <path d={`M${x - 110} 160 L${x + 110} 160 Q${x + 100} 300 ${x} 310 Q${x - 100} 300 ${x - 110} 160 Z`} fill={c} />
          <rect x={x - 10} y={305} width={20} height={160} fill={W} /><path d={`M${x - 80} 480 L${x + 80} 480 L${x + 60} 460 L${x - 60} 460 Z`} fill={W} />
        </g>
      );
      return { list: [
        { at: 2, cx: 170, cy: 300, tf: `translate(${clink * 60} 0)`, node: g(170, 14 - clink * 6, P.yellow) },
        { at: 4, cx: 430, cy: 300, tf: `translate(${-clink * 60} 0)`, node: g(430, -14 + clink * 6, P.orange) },
        ...(clink >= 1 ? [{ at: 18, cx: 300, cy: 150, tf: `rotate(${t * 3} 300 150)`, node: <path d={star(300, 140, 10, 110, 50)} fill={P.pink} /> }] : []),
        ...Array.from({ length: 8 }).map((_, i) => {
          const x = 140 + hash(seed + i, 4) * 320, y = 240 - ((t * 5 + i * 37) % 240);
          return { at: 8, cx: x, cy: y, node: <circle cx={x} cy={y} r={8 + (i % 3) * 5} fill={W} /> };
        }),
      ] };
    }
    case "sprout":
      return { list: [
        ...[[120, 140], [480, 120], [500, 380], [100, 400]].map(([x, y], i) => ({ at: 12 + i * 2, cx: x, cy: y, tf: `rotate(${t * 5} ${x} ${y})`, node: <path d={star(x, y, 4, 50 * (0.7 + 0.5 * pulse), 13)} fill={P.yellow} /> })),
        { at: 2, cx: 300, cy: 500, node: <path d="M190 430 L410 430 L380 580 L220 580 Z" fill={P.orange} /> },
        { at: 4, cx: 300, cy: 430, node: <rect x={170} y={410} width={260} height={40} fill={P.red} /> },
        { at: 6, cx: 300, cy: 420, tf: `scale(1 ${Math.min(1, 0.4 + t / 30)})`, node: <rect x={290} y={170} width={20} height={250} fill={P.green} /> },
        { at: 9, cx: 300, cy: 200, tf: `rotate(${sway(8, 26)} 300 200)`, node: <g><path d={leaf(190, 60)} transform="translate(300 200) rotate(-25)" fill={P.green} /><path d={leaf(170, 55)} transform="translate(300 230) rotate(-160)" fill="#2E7D32" /></g> },
      ] };
    case "crown":
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `rotate(${t} 300 300)`, node: <path d={star(300, 300, 18, 290, 230)} fill={P.pink} /> },
        { at: 5, cx: 300, cy: 300, tf: `translate(0 ${sway(10, 20)}) rotate(${sway(5, 30)} 300 300)`, node: <g>
          <path d="M120 400 L100 170 L200 280 L300 130 L400 280 L500 170 L480 400 Z" fill={P.yellow} />
          <rect x={115} y={380} width={370} height={60} fill={P.red} />
          {[180, 300, 420].map((x, i) => <circle key={x} cx={x} cy={410} r={20} fill={[P.teal, P.blue, P.teal][i]} />)}
          {[100, 300, 500].map((x, i) => <circle key={x} cx={x} cy={[165, 125, 165][i]} r={22} fill={P.pink} />)}</g> },
      ] };
    case "maple":
      return { list: [
        { at: 2, cx: 300, cy: 320, tf: `rotate(${sway(6, 30)} 300 520)`, node: <g>
          <path d="M300 60 L335 160 L390 130 L375 240 L470 180 L450 250 L540 270 L470 330 L500 380 L380 370 L395 450 L310 410 L310 540 L290 540 L290 410 L205 450 L220 370 L100 380 L130 330 L60 270 L150 250 L130 180 L225 240 L210 130 L265 160 Z" fill={P.red} /></g> },
        ...Array.from({ length: 10 }).map((_, i) => {
          const x = 30 + hash(seed + i, 7) * 540, y = ((hash(seed + i, 8) * 600 + t * 14) % 660) - 40;
          return { at: 10, cx: x, cy: y, node: <path d={`M${x} ${y} q 18 30 0 44 q -18 -14 0 -44 Z`} fill={P.blue} /> };
        }),
      ] };
    case "hearts":
    case "hearts2": {
      const a = kind === "hearts" ? [P.red, P.pink] : [P.orange, P.teal];
      const b1 = 1 + 0.08 * beatPulse(abs, 10), b2 = 1 + 0.08 * beatPulse(abs - 6, 10);
      return { list: [
        { at: 2, cx: 230, cy: 290, tf: `rotate(-12 230 290) scale(${b1})`, node: <path d={heart(230, 290, 170)} fill={a[0]} /> },
        { at: 6, cx: 380, cy: 320, tf: `rotate(14 380 320) scale(${b2})`, node: <path d={heart(380, 320, 150)} fill={a[1]} /> },
        { at: 10, cx: 300, cy: 300, node: <path d="M120 470 L180 440 L240 480 L300 440 L360 480 L420 440 L480 470" stroke={P.ink} strokeWidth={12} fill="none" strokeDasharray="22 16" /> },
        ...[[90, 120], [520, 140], [500, 500]].map(([x, y], i) => ({ at: 12 + i * 2, cx: x, cy: y, tf: `rotate(${t * 4} ${x} ${y})`, node: <path d={star(x, y, 5, 36, 15)} fill={P.yellow} /> })),
      ] };
    }
    case "notes":
      return { list: [
        { at: 2, cx: 460, cy: 130, node: <path d="M460 40 A100 100 0 1 0 540 200 A80 80 0 1 1 460 40 Z" fill={P.yellow} /> },
        ...[[140, 360, P.ink], [300, 300, P.red], [460, 400, P.teal]].map(([x, y, c], i) => ({ at: 5 + i * 3, cx: x as number, cy: y as number,
          tf: `translate(0 ${-beatPulse(abs - i * 4, 10) * 40}) rotate(${sway(10, 18, i * 5)} ${x} ${y})`, node: note(x as number, y as number, c as string) })),
      ], html: { haha: true } as any };
    case "bolt":
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `scale(${1 + pulse * 0.06})`, node: <path d={star(300, 300, 9, 290, 180, 0.2)} fill={P.red} /> },
        { at: 5, cx: 300, cy: 300, tf: `rotate(${sway(4, 10)} 300 300)`, node: <path d="M350 40 L170 330 L290 330 L230 560 L440 250 L320 250 L400 40 Z" fill={P.yellow} /> },
      ] };
    case "bolt2":
      return { list: [
        { at: 2, cx: 300, cy: 300, node: <rect x={60} y={200} width={480} height={200} fill={P.ink} transform="rotate(-6 300 300)" /> },
        { at: 14, cx: 300, cy: 300, node: <g><rect x={40} y={285} width={520} height={34} fill={P.red} transform="rotate(25 300 300)" /><rect x={40} y={285} width={520} height={34} fill={P.red} transform="rotate(-25 300 300)" /></g> },
      ], html: { cant: true } as any };
    case "food":
      return { list: [
        { at: 2, cx: 300, cy: 520, node: <path d="M0 440 L600 430 L600 600 L0 600 Z" fill={P.kraft} /> },
        { at: 4, cx: 300, cy: 380, node: <g><ellipse cx={300} cy={390} rx={210} ry={120} fill={W} /><ellipse cx={300} cy={385} rx={150} ry={82} fill="#E9E1CF" /></g> },
        { at: 7, cx: 300, cy: 360, node: <path d="M220 400 L380 400 L320 300 Z" fill={P.orange} /> },
        { at: 9, cx: 300, cy: 380, node: <g><circle cx={240} cy={350} r={20} fill={P.green} /><circle cx={370} cy={360} r={18} fill={P.green} /><circle cx={350} cy={410} r={16} fill={P.red} /></g> },
        { at: 11, cx: 60, cy: 400, node: <g><rect x={40} y={260} width={20} height={250} fill="#9AA3A8" /><rect x={540} y={260} width={20} height={250} fill="#9AA3A8" /><rect x={530} y={250} width={40} height={80} fill="#9AA3A8" /></g> },
        ...[0, 1, 2].map((i) => ({ at: 13 + i, cx: 240 + i * 60, cy: 200, tf: `translate(0 ${-((t * 3 + i * 20) % 50)})`, node: <path d={`M${240 + i * 60} 270 q -20 -30 0 -60 q 20 -30 0 -60`} stroke={P.ink} strokeWidth={12} fill="none" strokeLinecap="round" /> })),
      ] };
    case "camera": {
      const flash = Math.max(0, 1 - Math.abs(t - 8) / 5);
      return { list: [
        { at: 2, cx: 300, cy: 320, node: <g><rect x={90} y={200} width={420} height={260} rx={30} fill={P.ink} /><rect x={150} y={160} width={140} height={60} fill={P.ink} /><rect x={400} y={170} width={70} height={40} fill={P.yellow} /></g> },
        { at: 5, cx: 300, cy: 330, tf: `rotate(${t * 3} 300 330)`, node: <g><circle cx={300} cy={330} r={110} fill={W} /><circle cx={300} cy={330} r={82} fill={P.teal} /><circle cx={300} cy={330} r={38} fill={P.ink} /><rect x={270} y={262} width={24} height={24} fill={W} opacity={0.8} /></g> },
        { at: 7, cx: 135, cy: 245, node: <circle cx={135} cy={245} r={16} fill={P.red} opacity={Math.floor(t / 8) % 2 ? 1 : 0.25} /> },
        ...(flash > 0 ? [{ at: 6, cx: 435, cy: 140, node: <path d={star(435, 150, 12, 150 * flash, 50 * flash)} fill={P.yellow} /> }] : []),
      ] };
    }
    case "vinyl":
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `rotate(${t * 6} 300 300)`, node: <g>
          <circle cx={300} cy={300} r={240} fill={P.ink} />
          {[200, 170, 140].map((r) => <circle key={r} cx={300} cy={300} r={r} fill="none" stroke="#3a3836" strokeWidth={4} />)}
          <circle cx={300} cy={300} r={85} fill={P.red} /><rect x={240} y={270} width={70} height={16} fill={P.yellow} /><circle cx={300} cy={300} r={10} fill={P.paper} /></g> },
        { at: 8, cx: 500, cy: 120, tf: `rotate(${sway(8, 16)} 500 120)`, node: note(470, 160, P.pink) },
      ] };
    case "clock":
      return { list: [
        { at: 2, cx: 300, cy: 300, node: <g><circle cx={300} cy={300} r={230} fill={P.ink} /><circle cx={300} cy={300} r={200} fill={W} />
          {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={294} y={110} width={12} height={i % 3 ? 22 : 40} fill={P.ink} transform={`rotate(${i * 30} 300 300)`} />)}</g> },
        { at: 6, cx: 300, cy: 300, tf: `rotate(${-t * 6} 300 300)`, node: <rect x={290} y={170} width={20} height={140} fill={P.red} /> },
        { at: 7, cx: 300, cy: 300, tf: `rotate(${-t * 30} 300 300)`, node: <rect x={295} y={120} width={10} height={190} fill={P.ink} /> },
        { at: 8, cx: 300, cy: 300, node: <circle cx={300} cy={300} r={18} fill={P.yellow} /> },
      ] };
    case "badge53":
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `rotate(${t * 1.2} 300 300) scale(${1 + pulse * 0.05})`, node: <path d={star(300, 300, 20, 290, 240)} fill={P.yellow} /> },
        { at: 4, cx: 300, cy: 300, node: <circle cx={300} cy={300} r={210} fill={P.red} /> },
        { at: 5, cx: 300, cy: 300, node: <circle cx={300} cy={300} r={185} fill="none" stroke={W} strokeWidth={8} strokeDasharray="18 12" /> },
      ], html: { big: "53", small: "YEARS YOUNG" } as any };
    case "heartbeat": {
      const draw = Math.min(1, t / 20);
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `scale(${1 + pulse * 0.07})`, node: <path d={heart(300, 320, 240)} fill={P.red} /> },
        { at: 5, cx: 300, cy: 300, node: <path d="M20 310 L200 310 L240 200 L290 420 L340 150 L380 310 L580 310" stroke={W} strokeWidth={22} fill="none" strokeLinejoin="round" strokeDasharray="1200" strokeDashoffset={1200 * (1 - draw)} /> },
      ] };
    }
    case "cake": {
      const flick = (i: number) => 1 + (hash(Math.floor(t / 2.5) + i * 9, 3) - 0.5) * 0.3;
      return { list: [
        { at: 2, cx: 300, cy: 510, node: <rect x={80} y={470} width={440} height={90} fill={P.pink} /> },
        { at: 4, cx: 300, cy: 420, node: <rect x={120} y={380} width={360} height={95} fill={P.cream} /> },
        { at: 6, cx: 300, cy: 340, node: <g><rect x={160} y={300} width={280} height={85} fill={P.red} /><path d="M160 300 L440 300 L440 325 Q420 350 400 325 Q380 350 360 325 Q340 350 320 325 Q300 350 280 325 Q260 350 240 325 Q220 350 200 325 Q180 350 160 325 Z" fill={W} /></g> },
        ...[240, 360].map((x, i) => ({ at: 9 + i * 2, cx: x, cy: 120, tf: `scale(1 ${flick(i)})`, node: <g><path d={`M${x} 40 Q${x + 30} 90 ${x} 115 Q${x - 30} 90 ${x} 40 Z`} fill={P.orange} /><path d={`M${x} 70 Q${x + 14} 95 ${x} 110 Q${x - 14} 95 ${x} 70 Z`} fill={P.yellow} /></g> })),
      ], html: { candles: true } as any };
    }
    case "chain": {
      const apart = Math.min(1, Math.max(0, (t - 8) / 10));
      const link = (x: number, y: number, r: number, c: string) => <rect x={x - 60} y={y - 35} width={120} height={70} rx={35} fill="none" stroke={c} strokeWidth={22} transform={`rotate(${r} ${x} ${y})`} />;
      return { list: [
        { at: 2, cx: 300, cy: 300, tf: `scale(${apart})`, node: <path d={star(300, 300, 12, 260, 120)} fill={P.yellow} /> },
        { at: 3, cx: 180, cy: 300, tf: `translate(${-apart * 90} ${apart * 30}) rotate(${-apart * 20} 180 300)`, node: <g>{link(60, 300, 0, P.ink)}{link(170, 300, 90, P.ink)}</g> },
        { at: 4, cx: 420, cy: 300, tf: `translate(${apart * 90} ${-apart * 30}) rotate(${apart * 20} 420 300)`, node: <g>{link(430, 300, 90, P.ink)}{link(540, 300, 0, P.ink)}</g> },
      ] };
    }
    default:
      return { list: [{ at: 2, cx: 300, cy: 300, node: <path d={star(300, 300, 5, 240, 100)} fill={P.yellow} /> }] };
  }
}

export default function Motif(props: Props) {
  const { kind = "sun", side = "right", seed = 1, width, height, clip } = props;
  const mob = height > width && props.mobile ? props.mobile : {};
  const x = mob.x ?? props.x, y = mob.y ?? props.y, scale = mob.scale ?? props.scale ?? 1;
  const f = useCurrentFrame();
  const abs = clip.from + f;
  const D = clip.duration;
  const pic = areas(width, height, side).pic;
  const S = pic.size * scale * 0.92;
  const cx = x != null ? x * width : pic.cx + (props.ox ?? 0) * pic.size;
  const cy = y != null ? y * height : pic.cy + (props.oy ?? 0) * pic.size;
  const { list, html } = pieces(kind, f, abs, seed);
  const out = st(f, D - 9, 8, easeIn);
  const dir = hash(seed, 2) > 0.5 ? 1 : -1;
  const j = jit(seed, f, 2.5);
  const fid = `cut-${clip.id}`;
  const h: any = html ?? {};
  const tq = q12(f);

  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: cx - S / 2, top: cy - S / 2, width: S, height: S, opacity: 1 - out,
        transform: `translate(${j.x + out * dir * 300}px, ${j.y + out * 400}px) rotate(${j.r + out * dir * 40}deg)`,
      }}>
        <svg viewBox="0 0 600 600" width={S} height={S} style={{ overflow: "visible", position: "absolute", left: 0, top: 0 }}>
          <defs>
            <filter id={fid} x="-25%" y="-25%" width="150%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={9} xChannelSelector="R" yChannelSelector="G" result="rough" />
              <feOffset in="rough" dx={8} dy={11} result="off" />
              <feFlood floodColor="#140c04" floodOpacity={0.42} />
              <feComposite in2="off" operator="in" result="sh" />
              <feMerge><feMergeNode in="sh" /><feMergeNode in="rough" /></feMerge>
            </filter>
          </defs>
          {list.map((p, i) => {
            const s = slap(f, p.at, 1.7);
            if (s.o === 0) return null;
            const r = (hash(seed + i, 11) - 0.5) * 6;
            return (
              <g key={i} filter={`url(#${fid})`}>
                <g transform={`translate(${p.cx} ${p.cy}) scale(${s.s}) rotate(${r}) translate(${-p.cx} ${-p.cy})`}>
                  <g transform={p.tf ?? ""}>{p.node}</g>
                </g>
              </g>
            );
          })}
        </svg>
        {/* paper text pieces drawn in HTML so they get the project fonts */}
        {h.big ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: slap(f, 7).o, transform: `scale(${slap(f, 7, 2).s}) rotate(-6deg)` }}>
            <div style={{ fontFamily: "Anton", fontSize: S * 0.42, lineHeight: 0.9, color: P.white, textShadow: `${S * 0.012}px ${S * 0.016}px 0 ${P.ink}` }}>{h.big}</div>
            <div style={{ fontFamily: "Rubik Mono One", fontSize: S * 0.05, color: P.yellow, marginTop: S * 0.02 }}>{h.small}</div>
          </div>
        ) : null}
        {h.calendar ? (
          <div style={{ position: "absolute", left: S * (125 / 600), top: S * (210 / 600), width: S * (340 / 600), height: S * (310 / 600), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Anton", fontSize: S * 0.32, color: P.ink, opacity: slap(f, 6).o }}>
            {Math.min(53, 1 + Math.floor(Math.max(0, tq - 6) * 1.6))}
          </div>
        ) : null}
        {h.haha ? (["HA!", "HA!", "HA!"]).map((w, i) => {
          const s2 = slap(f, 10 + i * 5, 2);
          return <div key={i} style={{ position: "absolute", left: S * (0.05 + i * 0.3), top: S * (0.72 - (i % 2) * 0.1), opacity: s2.o, transform: `scale(${s2.s}) rotate(${(i - 1) * 12}deg)`, background: [P.pink, P.yellow, P.white][i], padding: `0 ${S * 0.02}px`, fontFamily: ["Anton", "Permanent Marker", "Abril Fatface"][i], fontSize: S * 0.11, color: P.ink, boxShadow: `6px 8px 0 rgba(20,12,4,0.4)` }}>{w}</div>;
        }) : null}
        {h.cant ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: slap(f, 5).o, transform: `rotate(-6deg) scale(${slap(f, 5, 1.8).s})` }}>
            <div style={{ fontFamily: "Anton", fontSize: S * 0.2, color: P.white, letterSpacing: "0.02em" }}>CAN'T</div>
          </div>
        ) : null}
        {h.candles ? [["5", P.yellow, 240], ["3", P.teal, 360]].map(([n, c, xx], i) => {
          const s2 = slap(f, 8 + i * 2, 1.8);
          return <div key={i} style={{ position: "absolute", left: S * ((xx as number) - 55) / 600, top: S * 0.19, width: S * 110 / 600, height: S * 0.31, display: "flex", alignItems: "center", justifyContent: "center", background: c as string, opacity: s2.o, transform: `scale(${s2.s})`, fontFamily: "Anton", fontSize: S * 0.2, color: P.ink, boxShadow: `6px 9px 0 rgba(20,12,4,0.4)` }}>{n}</div>;
        }) : null}
      </div>
    </AbsoluteFill>
  );
}
