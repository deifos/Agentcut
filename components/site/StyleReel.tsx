"use client";

// A style's demo reel on the built-in talking-head clip (9:16): playing, or a still from its hook.
import { Player, Thumbnail } from "@remotion/player";
import {
  StyleDemo,
  type StyleDemoProps,
} from "@/components/studio/styles/StyleDemo";
import {
  DEMO_CLIP,
  DEMO_FRAMES,
  DEMO_WORDS,
} from "@/components/studio/styles/demo-script";

const WIDTH = 720;
const HEIGHT = 1280;
const STILL_FRAME = 62;

export function styleDemoProps(styleId: string): StyleDemoProps {
  return { styleId, src: DEMO_CLIP, words: DEMO_WORDS };
}

export function StyleReel({
  styleId,
  playing,
  muted = true,
}: {
  styleId: string;
  playing: boolean;
  muted?: boolean;
}) {
  const style = { width: "100%", aspectRatio: `${WIDTH} / ${HEIGHT}` };
  if (!playing) {
    return (
      <Thumbnail
        component={StyleDemo}
        inputProps={styleDemoProps(styleId)}
        durationInFrames={DEMO_FRAMES}
        fps={30}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        frameToDisplay={STILL_FRAME}
        style={style}
      />
    );
  }
  return (
    <Player
      key={styleId}
      component={StyleDemo}
      inputProps={styleDemoProps(styleId)}
      durationInFrames={DEMO_FRAMES}
      fps={30}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      controls
      loop
      initiallyMuted={muted}
      clickToPlay
      acknowledgeRemotionLicense
      style={style}
    />
  );
}
