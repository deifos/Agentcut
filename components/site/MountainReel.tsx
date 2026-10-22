"use client";

import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/** A playable composition using the mountain image from the design brief. */
export function MountainReel() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.12]);
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#1d232b" }}>
      <Img
        src={staticFile("demo/launch-reel/assets/mountains-hd.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(10,18,25,.4), transparent 80%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 100,
          bottom: 150,
          color: "#fff8ef",
          fontFamily: "var(--font-bricolage), sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            fontStyle: "italic",
            lineHeight: 0.9,
            letterSpacing: -5,
          }}
        >
          EXPLORE
        </div>
        <div
          style={{
            fontSize: 160,
            fontWeight: 900,
            fontStyle: "italic",
            lineHeight: 1,
            letterSpacing: -7,
            color: "#ff512b",
          }}
        >
          FURTHER.
        </div>
        <div style={{ marginTop: 28, fontSize: 27, letterSpacing: 6 }}>
          NEW PLACES. BOLDER STORIES.
        </div>
      </div>
    </AbsoluteFill>
  );
}
