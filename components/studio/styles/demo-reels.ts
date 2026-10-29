// Each style's demo choreography on the sample clip: which components land on which words, where
// the text sits and how it transitions. Speech beats (frames): "I'm going to be sharing the process
// how I'm building it" 0–96 · "100%" 111 · "open source" 133–155 · "vibe" 217 · "coding" 236 ·
// "whatever" 250 · "clone the repo" 267–290. Styles without a reel here get one built from their shots.
import type { MotionStyle } from "@/motion/components";

export interface ReelPart {
  id: string;
  from: number;
  to: number;
  props?: Record<string, unknown>;
}

export interface Reel {
  /** Hook-card props on top of the style's own hook shot. */
  hook: Record<string, unknown>;
  hookEnd: number;
  /** Windows (frames) where the captions show. */
  captions: [number, number][];
  captionPosition?: string;
  parts: ReelPart[];
}

export const REELS: Record<string, Reel> = {
  signal: {
    hook: { kicker: "The useful part", lines: ["Build it.", "*Share* *it.*"], tagline: "One clear next step", size: 15 }, hookEnd: 86,
    captions: [[86,106],[178,250]],
    parts: [
      { id: "stat-counter", from: 106, to: 178, props: { value: 100, suffix: "%", label: "open source", countFrames: 18 } },
      { id: "word-pop", from: 256, to: 291, props: { lines: ["clone the *repo*"], position: "lower", tilt: false, size: 8 } },
    ],
  },
  studyroom: {
    hook: { kicker: "A small lesson", lines: ["Learn by", "*building*"], tagline: "Notes from the process", size: 18 }, hookEnd: 104,
    captions: [[104,176],[246,291]],
    parts: [
      { id: "list-card", from: 178, to: 246, props: { layout: "card", kicker: "Lesson 01", title: "Build together", subtitle: "", rows: ["Read | the code", "Try | an idea", "Share | what works"], footer: "Keep learning" } },
    ],
  },
  afterglow: {
    hook: { kicker: "A closer look", lines: ["Made to", "be *shared*"], tagline: "From idea to release", size: 17 }, hookEnd: 106,
    captions: [[116,176],[202,252]],
    parts: [
      { id: "light-leak", from: 96, to: 122, props: { strength: 0.35, hueShift: 20 } },
      { id: "word-pop", from: 178, to: 202, props: { lines: ["The *details*"], position: "center", tilt: false, size: 7 } },
      { id: "word-pop", from: 256, to: 291, props: { lines: ["Make it *yours*"], position: "center", tilt: false, size: 8 } },
    ],
  },
  fieldnote: {
    hook: { kicker: "Field notes / 001", lines: ["Why build", "in *public?*"], tagline: "A story in progress", size: 18 }, hookEnd: 100,
    captions: [[100,178],[248,291]],
    parts: [
      { id: "list-card", from: 178, to: 248, props: { layout: "full", kicker: "The evidence", title: "An open process", subtitle: "", rows: ["Source | public repo", "Method | build together", "Next | clone and try"], footer: "Notes from the speaker" } },
    ],
  },

  voltrox: {
    hook: { kicker: "", lines: ["Building", "in *public*"], tagline: "every step, *open*", size: 21 },
    hookEnd: 84,
    captions: [
      [100, 158],
      [176, 212],
    ],
    parts: [
      { id: "panel-sweep", from: 76, to: 100, props: { color1: "#ffe14d", color2: "#ff3d8b", color3: "#111111", direction: "up" } },
      { id: "sticker-badge", from: 106, to: 160, props: { text: "100%", label: "open source", position: "top-left" } },
      {
        id: "kinetic-punch",
        from: 210,
        to: 258,
        props: { words: ["Vibe", "coding", "whatever"], beat: 15, color: "#111111", accent: "#ff3d8b", background: "#ffe14d", flashBackground: "#ff3d8b", font: "archivo", size: 26 },
      },
      { id: "word-pop", from: 258, to: 291, props: { lines: ["clone the *repo*"], position: "top", size: 8.5 } },
      { id: "confetti", from: 266, to: 291, props: { mode: "cannons", palette: ["#ffe14d", "#ff3d8b", "#ffffff", "#111111"], count: 120 } },
    ],
  },
  snipwork: {
    hook: { kicker: "a new series", lines: ["Build", "in public"], tagline: "the *whole* process", size: 22 },
    hookEnd: 96,
    captions: [[178, 250]],
    captionPosition: "bottom",
    parts: [
      { id: "light-leak", from: 88, to: 118, props: { hueShift: 10, strength: 0.8 } },
      {
        id: "cut-and-paste",
        from: 104,
        to: 178,
        props: { headline: ["100%", "*OPEN*"], kicker: "source code · free", bubble: "free!", paper: "#f4ecda", ink: "#1b1714", accent: "#e2402b", accent2: "#c9a878", rate: 10 },
      },
      { id: "sticker-badge", from: 180, to: 240, props: { text: "FREE", label: "", position: "top-right", size: 22 } },
      { id: "word-pop", from: 255, to: 291, props: { lines: ["clone", "the *repo*"], position: "center", size: 9, stagger: 4 } },
    ],
  },
  doodlepad: {
    hook: { kicker: "Episode 1", lines: ["Building", "in *public*"], tagline: "the whole process, *live*", size: 22 },
    hookEnd: 92,
    captions: [
      [92, 104],
      [160, 176],
    ],
    captionPosition: "bottom",
    parts: [
      { id: "highlighter", from: 104, to: 162, props: { lines: ["*100%*", "open source"], size: 11 } },
      { id: "tile-wipe", from: 164, to: 186, props: { color: "#fffdf6", accent: "#ffd60a", shape: "rounded", origin: "left", columns: 8 } },
      { id: "list-card", from: 176, to: 248, props: { layout: "full", kicker: "Episode 1", title: "Open source", subtitle: "Everything, in the open.", rows: ["Code | *public*", "License | MIT", "Price | free"], footer: "" } },
      { id: "word-pop", from: 256, to: 291, props: { lines: ["clone the *repo*"], position: "top", size: 9, tilt: false } },
    ],
  },
  phosphor: {
    hook: { kicker: "$ ./build --public", lines: ["Build log", "day *01*"], tagline: "build_log.mp4", size: 20 },
    hookEnd: 100,
    captions: [
      [156, 176],
      [246, 256],
    ],
    parts: [
      { id: "decode-text", from: 104, to: 158, props: { lines: ["100% open source"], glyphs: "binary", color: "#b6ffcf", accent: "#39ff88", font: "mono", size: 8 } },
      { id: "iris-wipe", from: 168, to: 190, props: { color: "#03110a", accent: "#39ff88", shape: "diamond" } },
      { id: "list-card", from: 178, to: 246, props: { layout: "full", kicker: "cat plan.txt", title: "Open source", subtitle: "", rows: ["code | *public*", "license | MIT", "price | free"], footer: "" } },
      { id: "prompt-box", from: 254, to: 291, props: { text: "npx agentcut", label: "terminal", theme: "dark", accent: "#39ff88", speed: 40, delay: 2 } },
    ],
  },
  hexwire: {
    hook: { kicker: "// transmission", lines: ["Build", "*public*"], tagline: "every step *streamed*", size: 22 },
    hookEnd: 88,
    captions: [
      [88, 102],
      [246, 256],
    ],
    parts: [
      {
        id: "glitch-title",
        from: 102,
        to: 152,
        props: { lines: ["100% *open*", "source"], color: "#f4f0ff", accent: "#ff2bd6", splitLeft: "#ff2bd6", splitRight: "#22e8ff", font: "wide", size: 12, scanlines: true },
      },
      { id: "panel-sweep", from: 148, to: 170, props: { color1: "#ff2bd6", color2: "#22e8ff", color3: "#0a0418", direction: "left", streaks: true } },
      {
        id: "target-lock",
        from: 162,
        to: 246,
        props: { title: "VIBE CODER DETECTED", label: "DEV-01", stats: ["OPEN SOURCE: 100%", "REPO: PUBLIC", "STATUS: SHIPPING"], color: "#22e8ff", secondary: "#ff2bd6", targetX: 62, targetY: 34, lockSize: 30 },
      },
      { id: "word-pop", from: 256, to: 291, props: { lines: ["clone the *repo*"], position: "center", size: 8.5 } },
    ],
  },
  visualshot: {
    hook: { kicker: "", lines: ["Build in", "*public*"], tagline: "", size: 15 },
    hookEnd: 90,
    captions: [
      [90, 104],
      [176, 200],
      [250, 291],
    ],
    captionPosition: "center",
    parts: [
      { id: "line-diagram", from: 104, to: 176, props: { kind: "network", title: "100% open source", labels: ["1 repo", "everyone"], background: "#000000", speed: 12 } },
      { id: "line-diagram", from: 200, to: 250, props: { kind: "venn", title: "Whatever you build", labels: ["code", "vibes", "you"], background: "#000000", speed: 10 } },
    ],
  },
  rewind: {
    hook: { kicker: "Tape 01", lines: ["Build in", "*public*"], tagline: "ch 03", size: 17 },
    hookEnd: 92,
    captions: [
      [92, 106],
      [176, 178],
      [246, 256],
    ],
    captionPosition: "lower",
    parts: [
      { id: "sticker-badge", from: 106, to: 172, props: { text: "100%", label: "open source", position: "center", size: 30 } },
      { id: "panel-sweep", from: 166, to: 190, props: { color1: "#2ec4b6", color2: "#ff3ea5", color3: "#ffd23f", direction: "right" } },
      { id: "list-card", from: 178, to: 246, props: { layout: "full", kicker: "▶ Menu", title: "Setup", subtitle: "", rows: ["Code | *public*", "License | MIT", "Price | free"], footer: "" } },
      { id: "word-pop", from: 256, to: 291, props: { lines: ["clone the *repo*"], position: "center", size: 7, tilt: false } },
    ],
  },
  lumen: {
    hook: { kicker: "New series", lines: ["Building", "in *public*"], tagline: "", size: 20 },
    hookEnd: 96,
    captions: [[100, 178]],
    captionPosition: "bottom",
    parts: [
      { id: "light-leak", from: 86, to: 120, props: { strength: 0.7, hueShift: 200 } },
      { id: "stat-counter", from: 106, to: 176, props: { value: 100, suffix: "%", label: "open source", countFrames: 30 } },
      { id: "list-card", from: 180, to: 248, props: { layout: "card", kicker: "", title: "Open source", subtitle: "", rows: ["Code | *public*", "License | MIT", "Price | free"], footer: "" } },
      { id: "word-pop", from: 256, to: 291, props: { lines: ["clone the *repo*"], position: "bottom", size: 7.5, tilt: false } },
    ],
  },
};

/** A reel for a style without a hand-made one, from its "reach for" shots. */
export function reelFor(style: MotionStyle): Reel {
  const known = REELS[style.id];
  if (known) return known;
  const shot = (component: string) => style.shots.find((s) => s.component === component)?.props ?? {};
  return {
    hook: { kicker: "New series", lines: ["Build in", "*public*"], tagline: "sharing *every* step", size: 20 },
    hookEnd: 96,
    captions: [[96, 176]],
    parts: [
      { id: "sticker-badge", from: 106, to: 176, props: { ...shot("sticker-badge"), text: "100%", label: "open source" } },
      { id: "list-card", from: 176, to: 246, props: { ...shot("list-card"), kicker: "The plan", title: "Open source", subtitle: "", rows: ["Code | *public*", "License | MIT", "Price | free"], footer: "" } },
      { id: "word-pop", from: 250, to: 291, props: { ...shot("word-pop"), lines: ["clone the *repo*"] } },
    ],
  };
}
