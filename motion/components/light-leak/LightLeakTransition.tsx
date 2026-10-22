import { LightLeak } from "@remotion/light-leaks";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { MotionBaseProps } from "../types";

type Props = MotionBaseProps & {
  seed: number;
  hueShift: number;
  strength: number;
  flash: boolean;
};

/**
 * A film light leak that blooms over the frame and retracts (Remotion's WebGL light leak).
 * Center the clip on a cut: it covers most of the frame at its midpoint, hiding the change.
 */
export function LightLeakTransition(props: Props) {
  const frame = useCurrentFrame();
  const mid = props.durationInFrames / 2;
  // An optional soft white bloom right at the cut.
  const flash = props.flash
    ? interpolate(frame, [mid - 6, mid, mid + 8], [0, 0.55, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  return (
    <AbsoluteFill style={{ opacity: props.strength }}>
      <LightLeak
        durationInFrames={props.durationInFrames}
        seed={Math.round(props.seed)}
        hueShift={props.hueShift}
      />
      {flash > 0 ? (
        <AbsoluteFill
          style={{
            background: "radial-gradient(80% 70% at 50% 45%, #fff6e6 0%, rgba(255,246,230,0) 70%)",
            opacity: flash,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}
