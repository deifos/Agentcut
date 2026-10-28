// The built-in talking-head clip for style demos (9.7 s at 30 fps) and its words, in frames from
// the clip start (transcribed, then checked by ear). It's the launch reel's footage: one URL, so
// the landing page downloads it once (public/studio/style-demo.mp4 is the same file, kept for
// older links).
export const DEMO_CLIP = "/demo/launch-reel/assets/footage.mp4";

export interface DemoWord {
  text: string;
  from: number;
  to: number;
}

const STARTS: [string, number][] = [
  ["I'm", 3],
  ["going", 21],
  ["to", 24],
  ["be", 26],
  ["sharing", 29],
  ["the", 38],
  ["process", 51],
  ["how", 60],
  ["I'm", 79],
  ["building", 84],
  ["it.", 90],
  ["It's", 99],
  ["going", 101],
  ["to", 104],
  ["be", 105],
  ["100%", 111],
  ["open", 133],
  ["source,", 142],
  ["so", 158],
  ["if", 165],
  ["you", 174],
  ["are", 178],
  ["into", 183],
  ["coding", 190],
  ["or", 207],
  ["vibe", 217],
  ["coding", 236],
  ["or", 246],
  ["whatever,", 250],
  ["you", 261],
  ["can", 262],
  ["clone", 267],
  ["the", 274],
  ["repo", 278],
];

export const DEMO_WORDS: DemoWord[] = STARTS.map(([text, from], i) => ({
  text,
  from,
  to: (STARTS[i + 1]?.[1] ?? from + 12) - 1,
}));

/** Reel length in frames (the clip's length). */
export const DEMO_FRAMES = 291;
