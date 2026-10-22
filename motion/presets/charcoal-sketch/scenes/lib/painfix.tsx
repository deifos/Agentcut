// Pain -> fix beat. A comic panel holds a messy charcoal sketch of the pain; on the bar line the colour mascot
// dashes across left->right, and everything behind it is redrawn as the neat fix (eraser smear on the seam).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SPRING, ease, mix, sp } from "agentcut";
import { HAND, HandText, Mascot, MascotShadow, Sk, SkCheck, SkLine, SkPoly, SkRect, Smudge, clamp, prog } from "./sketch";

export type PainFixProps = {
  duration: number;
  tSwipe: number; // local frame the mascot crosses the centre (the bar line)
  tPainText: number; // pain caption writes on (first spoken word)
  tFixText: number;
  painText: string;
  fixText: string;
  fixPose: string;
  fixAt?: [number, number, number]; // mascot x, feet y, height after the swipe
  enterFrom?: [number, number] | null; // mascot start (feet) for a hop-in from the previous beat; null = pop in
  pain: (f: number) => React.ReactNode;
  fix: (f: number, fl: number) => React.ReactNode; // fl = frames since the swipe
  painSize?: number;
  fixSize?: number;
};

const SWIPE = 22; // frames for the dash across the frame

export function PainFix(props: PainFixProps) {
  const f = useCurrentFrame();
  const { duration, tSwipe, tPainText, tFixText, painText, fixText, fixPose, pain, fix } = props;
  const [fx, fy, fh] = props.fixAt ?? [1715, 1010, 330];
  const out = ease(f, duration - 8, duration);
  const s0 = tSwipe - SWIPE / 2;
  const k = clamp((f - s0) / SWIPE, 0, 1);
  const kk = ease(f, s0, s0 + SWIPE); // eased dash
  const seam = mix(-260, 2180, kk); // x of the mascot during the dash
  const swiping = f >= s0 && f < s0 + SWIPE;
  const after = f >= s0 + SWIPE;

  // pre-swipe mascot: confused, peeking from the bottom-right corner
  const pop = props.enterFrom ? sp(f, 0, SPRING.snappy) : sp(f, 8, SPRING.pop);
  let mx = 1745, my = 1060, mh = 270, pose = "confused", rot = 0;
  if (props.enterFrom && f < 16) {
    const t = ease(f, 0, 16);
    mx = mix(props.enterFrom[0], 1745, t);
    my = mix(props.enterFrom[1], 1060, t) - Math.sin(Math.PI * t) * 160;
    pose = "excited";
    rot = mix(-8, 0, t);
  } else if (!props.enterFrom) {
    my = mix(1400, 1060, pop);
  }
  // wind-up right before the dash: the mascot ducks off the right edge
  const exitR = ease(f, s0 - 10, s0 - 2);
  mx += exitR * 360;
  if (swiping) {
    mx = seam;
    my = 1000 - Math.abs(Math.sin(k * Math.PI * 3)) * 40;
    mh = 300;
    pose = "excited";
    rot = 12;
  }
  if (after) {
    const land = sp(f, s0 + SWIPE, SPRING.land);
    mx = mix(2250, fx, land);
    my = fy;
    mh = fh;
    pose = fixPose;
    rot = mix(10, 0, land);
  }

  const fl = f - tSwipe;
  const painClip = swiping ? `inset(0px 0px 0px ${seam}px)` : undefined;
  const fixClip = swiping ? `inset(0px ${1920 - seam}px 0px 0px)` : undefined;

  const panelP = prog(f, 0, 10);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: out > 0 ? `blur(${out * 5}px)` : undefined }}>
      <Sk>
        <SkRect x={56} y={44} w={1808} h={992} p={panelP} id={7} sw={5} />
      </Sk>
      {!after && (
        <AbsoluteFill style={{ clipPath: painClip }}>
          {pain(f)}
          <Caption text={painText} p={prog(f, tPainText, 12)} id={11} size={props.painSize ?? 96} question />
        </AbsoluteFill>
      )}
      {(swiping || after) && (
        <AbsoluteFill style={{ clipPath: fixClip }}>
          {fix(f, fl)}
          <Caption text={fixText} p={prog(f, tFixText, 12)} id={12} size={props.fixSize ?? 96} />
        </AbsoluteFill>
      )}
      {swiping && <Smudge x={seam - 120} y={560} w={340} h={1100} o={0.35} rot={4} />}
      {(after || (!swiping && exitR < 1)) && <MascotShadow x={mx} y={my - 4} w={mh * 0.62} o={0.4} />}
      <Mascot pose={pose} x={mx} y={my} h={mh} rot={rot} />
    </AbsoluteFill>
  );
}

function Caption({ text, p, id, size, question }: { text: string; p: number; id: number; size: number; question?: boolean }) {
  if (p <= 0) return null;
  const u = clamp(p * 1.4 - 0.4, 0, 1);
  return (
    <>
      <HandText x={110} y={78} size={size} p={p} id={id} font={HAND}>{text}</HandText>
      <Sk>
        {question ? (
          <>
            <SkLine a={[112, 78 + size * 1.12]} b={[112 + text.length * size * 0.42, 78 + size * 1.1]} p={u} id={id + 3} sw={4} />
            <SkLine a={[130, 78 + size * 1.24]} b={[112 + text.length * size * 0.36, 78 + size * 1.22]} p={clamp(u * 1.5 - 0.5, 0, 1)} id={id + 4} sw={3} o={0.7} />
          </>
        ) : (
          <>
            <SkPoly pts={[[112, 78 + size * 1.14], [112 + text.length * size * 0.42, 78 + size * 1.1]]} p={u} id={id + 3} sw={5} />
            <SkCheck x={130 + text.length * size * 0.44} y={78 + size * 0.55} s={1.3} p={clamp(u * 2 - 1, 0, 1)} id={id + 5} sw={6} />
          </>
        )}
      </Sk>
    </>
  );
}
