// Agentcut's sound effects library. Two sources:
// - "agentcut": 55 original recordings (made by the Agentcut author), measured and described with earshot.
// - "earshot": sounds rendered from the earshot bank (github.com/Leonxlnx/earshot, MIT; see public/sfx/earshot/ATTRIBUTION.md),
//   synthesized in code and rendered once, so nobody needs earshot installed.
// Generated from the files in public/sfx; keep the two in sync.

export const SFX_CATEGORIES = ["click", "pop", "swoosh", "whoosh", "impact", "riser", "sting", "notify", "shimmer", "glitch", "typing", "foley", "divider"] as const;
export type SfxCategory = (typeof SFX_CATEGORIES)[number];

export interface SfxEntry {
  id: string;
  /** "agentcut": a real recording. "earshot": synthesized in code. Prefer recordings when both fit. */
  source: "agentcut" | "earshot";
  /** Path under /sfx. */
  file: string;
  category: SfxCategory;
  /** What it sounds like. */
  description: string;
  /** What it is good for in a video. */
  useFor: string;
  seconds: number;
  /** When the sound starts (s): place the clip this much before the cue. */
  onsetS: number;
  /** When it peaks (s): for whooshes and risers, put the peak on the cut. */
  peakS: number;
  /** Integrated loudness; null for sounds too short to measure it (tiny ticks). */
  lufs: number | null;
  /** Clip volume that brings it to about -18 LUFS, so effects sit at an even level before mixing. */
  volume: number;
  recorded: boolean;
  /** earshot readings of recordings: what it is most like and how strongly (z >= 3 strong). */
  readings: { sound: string; z: number }[];
}

export const SFX_LIBRARY: SfxEntry[] = [
 {
  "id": "click-keyboard-01",
  "source": "agentcut",
  "file": "click-keyboard-01.mp3",
  "category": "click",
  "description": "A burst of quiet mechanical keyboard taps, about 8 a second",
  "useFor": "typing on screen, a search field filling in, a prompt being written",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.034,
  "lufs": -34.4,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a scroll wheel tick",
    "z": 3.25
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 3.23
   },
   {
    "sound": "a clicky mechanical keyboard",
    "z": 3.08
   }
  ]
 },
 {
  "id": "click-keyboard-02",
  "source": "agentcut",
  "file": "click-keyboard-02.mp3",
  "category": "click",
  "description": "Quiet mechanical key taps with a typewriter edge, about 6 a second",
  "useFor": "typing, form filling, code appearing",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.561,
  "lufs": -30.5,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a scroll wheel tick",
    "z": 3.03
   },
   {
    "sound": "an old typewriter",
    "z": 3.03
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.57
   }
  ]
 },
 {
  "id": "click-keyboard-03",
  "source": "agentcut",
  "file": "click-keyboard-03.mp3",
  "category": "click",
  "description": "Quiet typewriter-like key taps, about 7 a second",
  "useFor": "typing with a retro or editorial feel",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.033,
  "lufs": -33.7,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "an old typewriter",
    "z": 3.51
   },
   {
    "sound": "a scroll wheel tick",
    "z": 3.0
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.81
   }
  ]
 },
 {
  "id": "click-laser-01",
  "source": "agentcut",
  "file": "click-laser-01.mp3",
  "category": "click",
  "description": "A bright key-press click that swells in over ~0.2 s, a run of quick ticks",
  "useFor": "a playful press, selecting a tool, a sci-fi UI tap",
  "seconds": 0.6,
  "onsetS": 0.081,
  "peakS": 0.446,
  "lufs": -23.1,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "an enter key press",
    "z": 2.81
   },
   {
    "sound": "a spacebar press",
    "z": 2.77
   },
   {
    "sound": "an old typewriter",
    "z": 2.74
   }
  ]
 },
 {
  "id": "click-mouse-01",
  "source": "agentcut",
  "file": "click-mouse-01.mp3",
  "category": "click",
  "description": "A single soft mouse or enter-key click",
  "useFor": "a cursor click, pressing a button, confirming",
  "seconds": 0.6,
  "onsetS": 0.139,
  "peakS": 0.154,
  "lufs": -29.0,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "an enter key press",
    "z": 3.28
   },
   {
    "sound": "a soft key release click",
    "z": 2.93
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.83
   }
  ]
 },
 {
  "id": "click-mouse-02",
  "source": "agentcut",
  "file": "click-mouse-02.mp3",
  "category": "click",
  "description": "A crisp single mouse click",
  "useFor": "a cursor click on a button or link",
  "seconds": 0.6,
  "onsetS": 0.081,
  "peakS": 0.15,
  "lufs": -24.1,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "an enter key press",
    "z": 2.93
   },
   {
    "sound": "a scroll wheel tick",
    "z": 2.91
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.48
   }
  ]
 },
 {
  "id": "click-snap-01",
  "source": "agentcut",
  "file": "click-snap-01.mp3",
  "category": "click",
  "description": "A very short dry tick, like a scroll wheel notch",
  "useFor": "a toggle, a checkbox, a tight UI tick",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.023,
  "lufs": -19.5,
  "volume": 1.19,
  "recorded": true,
  "readings": [
   {
    "sound": "a scroll wheel tick",
    "z": 2.78
   },
   {
    "sound": "a clock ticking",
    "z": 2.47
   },
   {
    "sound": "a digital glitch",
    "z": 2.37
   }
  ]
 },
 {
  "id": "click-tap-01",
  "source": "agentcut",
  "file": "click-tap-01.mp3",
  "category": "click",
  "description": "A bright metallic tap that rings like a small triangle; loud",
  "useFor": "a sparkle on a highlight, a premium tap, a reveal accent",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.136,
  "lufs": -9.9,
  "volume": 0.39,
  "recorded": true,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 4.11
   },
   {
    "sound": "a metal scrape",
    "z": 3.43
   },
   {
    "sound": "a wine glass ring",
    "z": 2.98
   }
  ]
 },
 {
  "id": "click-tap-screen-01",
  "source": "agentcut",
  "file": "click-tap-screen-01.mp3",
  "category": "click",
  "description": "A short punchy tap on a hard surface",
  "useFor": "tapping a phone screen, pressing a card",
  "seconds": 0.6,
  "onsetS": 0.128,
  "peakS": 0.149,
  "lufs": -20.5,
  "volume": 1.33,
  "recorded": true,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.21
   },
   {
    "sound": "a box lid closing",
    "z": 3.03
   },
   {
    "sound": "a knife chopping on a board",
    "z": 2.92
   }
  ]
 },
 {
  "id": "click-tap-water-01",
  "source": "agentcut",
  "file": "click-tap-water-01.mp3",
  "category": "click",
  "description": "A round, wet, low pop like a cork or droplet",
  "useFor": "a soft tap, a bubble UI, a playful press",
  "seconds": 0.6,
  "onsetS": 0.046,
  "peakS": 0.06,
  "lufs": -21.6,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a cork pop",
    "z": 3.95
   },
   {
    "sound": "a bubble pop",
    "z": 3.61
   },
   {
    "sound": "a mouth pop",
    "z": 3.55
   }
  ]
 },
 {
  "id": "click-tech-01",
  "source": "agentcut",
  "file": "click-tech-01.mp3",
  "category": "click",
  "description": "A short tonal blip at C4, like a soft success chime",
  "useFor": "a success state, a completed step, a gentle confirm",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.16,
  "lufs": -12.4,
  "volume": 0.52,
  "recorded": true,
  "readings": [
   {
    "sound": "a success chime",
    "z": 2.96
   },
   {
    "sound": "a kalimba note",
    "z": 2.52
   },
   {
    "sound": "a glockenspiel run",
    "z": 2.2
   }
  ]
 },
 {
  "id": "click-tech-02",
  "source": "agentcut",
  "file": "click-tech-02.mp3",
  "category": "click",
  "description": "A short plucked tonal blip, like a kalimba or message pop",
  "useFor": "a chat message, a notification, a list item landing",
  "seconds": 1.0,
  "onsetS": 0.07,
  "peakS": 0.0,
  "lufs": -11.3,
  "volume": 0.46,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 2.74
   },
   {
    "sound": "a chat message pop",
    "z": 2.66
   },
   {
    "sound": "a success chime",
    "z": 2.53
   }
  ]
 },
 {
  "id": "click-tech-03",
  "source": "agentcut",
  "file": "click-tech-03.mp3",
  "category": "click",
  "description": "A short tonal blip around C5, chime-like",
  "useFor": "a confirm, a tick on a checklist, a step done",
  "seconds": 1.0,
  "onsetS": 0.081,
  "peakS": 0.104,
  "lufs": -12.3,
  "volume": 0.52,
  "recorded": true,
  "readings": [
   {
    "sound": "a success chime",
    "z": 2.98
   },
   {
    "sound": "a kalimba note",
    "z": 2.55
   },
   {
    "sound": "a glockenspiel run",
    "z": 2.49
   }
  ]
 },
 {
  "id": "click-tech-04",
  "source": "agentcut",
  "file": "click-tech-04.mp3",
  "category": "click",
  "description": "A low plucked tonal note around C3",
  "useFor": "a heavier confirm, a menu opening, a soft select",
  "seconds": 1.0,
  "onsetS": 0.07,
  "peakS": 0.092,
  "lufs": -15.6,
  "volume": 0.76,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.23
   },
   {
    "sound": "a success chime",
    "z": 2.74
   },
   {
    "sound": "an alarm clock beeping",
    "z": 2.49
   }
  ]
 },
 {
  "id": "click-tech-05",
  "source": "agentcut",
  "file": "click-tech-05.mp3",
  "category": "click",
  "description": "A quick run of beeping tonal ticks",
  "useFor": "a counter ticking, loading, a timer, scanning",
  "seconds": 1.0,
  "onsetS": 0.081,
  "peakS": 0.0,
  "lufs": -17.5,
  "volume": 0.94,
  "recorded": true,
  "readings": [
   {
    "sound": "an alarm clock beeping",
    "z": 2.83
   },
   {
    "sound": "a wooden block hit",
    "z": 2.4
   },
   {
    "sound": "a clock ticking",
    "z": 2.37
   }
  ]
 },
 {
  "id": "click-tech-06",
  "source": "agentcut",
  "file": "click-tech-06.mp3",
  "category": "click",
  "description": "A short bright chime-like pop",
  "useFor": "a success chime, a message arriving, a like",
  "seconds": 1.0,
  "onsetS": 0.07,
  "peakS": 0.0,
  "lufs": -12.3,
  "volume": 0.52,
  "recorded": true,
  "readings": [
   {
    "sound": "a success chime",
    "z": 3.33
   },
   {
    "sound": "a chat message pop",
    "z": 3.04
   },
   {
    "sound": "a kalimba note",
    "z": 2.65
   }
  ]
 },
 {
  "id": "click-tech-07",
  "source": "agentcut",
  "file": "click-tech-07.mp3",
  "category": "click",
  "description": "A short plucked kalimba-like note",
  "useFor": "a soft select, a hover, a light UI note",
  "seconds": 1.0,
  "onsetS": 0.116,
  "peakS": 0.0,
  "lufs": -17.1,
  "volume": 0.9,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.42
   },
   {
    "sound": "a chat message pop",
    "z": 2.48
   },
   {
    "sound": "an alarm clock beeping",
    "z": 2.2
   }
  ]
 },
 {
  "id": "click-tech-long",
  "source": "agentcut",
  "file": "click-tech-long.mp3",
  "category": "click",
  "description": "A 2 s run of low plucked tonal notes",
  "useFor": "a sequence building up, several items landing in turn",
  "seconds": 2.0,
  "onsetS": 0.07,
  "peakS": 0.134,
  "lufs": -17.1,
  "volume": 0.9,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.15
   },
   {
    "sound": "a success chime",
    "z": 2.92
   },
   {
    "sound": "a notification ding",
    "z": 2.29
   }
  ]
 },
 {
  "id": "click-tick-01",
  "source": "agentcut",
  "file": "click-tick-01.mp3",
  "category": "click",
  "description": "A tiny bright tick, like a key release",
  "useFor": "a hover, a subtle toggle, a cursor moving between items",
  "seconds": 1.0,
  "onsetS": 0.081,
  "peakS": 0.096,
  "lufs": -28.0,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 2.62
   },
   {
    "sound": "coins dropping",
    "z": 2.61
   },
   {
    "sound": "an enter key press",
    "z": 2.43
   }
  ]
 },
 {
  "id": "click-type-fast-01",
  "source": "agentcut",
  "file": "click-type-fast-01.mp3",
  "category": "click",
  "description": "Fast typewriter-style typing, about 12 keys a second",
  "useFor": "fast typing, text appearing quickly, a terminal",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.487,
  "lufs": -21.5,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "an old typewriter",
    "z": 3.93
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 3.57
   },
   {
    "sound": "slow typing with separate key presses",
    "z": 3.28
   }
  ]
 },
 {
  "id": "click-ui-01",
  "source": "agentcut",
  "file": "click-ui-01.mp3",
  "category": "click",
  "description": "A quick run of wooden, kalimba-like UI clicks",
  "useFor": "several buttons or tiles popping in, a playful UI burst",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.001,
  "lufs": -18.8,
  "volume": 1.1,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.46
   },
   {
    "sound": "a wooden block hit",
    "z": 3.34
   },
   {
    "sound": "a triangle hit",
    "z": 3.24
   }
  ]
 },
 {
  "id": "divider-crt-01",
  "source": "agentcut",
  "file": "divider-crt-01.mp3",
  "category": "divider",
  "description": "A short electric buzz-glitch with a high tone, like an old CRT switching",
  "useFor": "a glitch cut, a retro tech transition, an error flash",
  "seconds": 0.6,
  "onsetS": 0.081,
  "peakS": 0.244,
  "lufs": -18.3,
  "volume": 1.04,
  "recorded": true,
  "readings": [
   {
    "sound": "an enter key press",
    "z": 2.74
   },
   {
    "sound": "an error buzz",
    "z": 2.69
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.63
   }
  ]
 },
 {
  "id": "divider-deep-01",
  "source": "agentcut",
  "file": "divider-deep-01.mp3",
  "category": "divider",
  "description": "A sub-bass drop with low thumps around 50 Hz",
  "useFor": "a section break, a dramatic transition, a drop before a reveal",
  "seconds": 1.0,
  "onsetS": 0.174,
  "peakS": 0.767,
  "lufs": -13.2,
  "volume": 0.58,
  "recorded": true,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 2.79
   },
   {
    "sound": "a kick drum",
    "z": 2.55
   },
   {
    "sound": "a low rumble",
    "z": 2.35
   }
  ]
 },
 {
  "id": "divider-scramble-01",
  "source": "agentcut",
  "file": "divider-scramble-01.mp3",
  "category": "divider",
  "description": "A fast bright run of beeping digital notes",
  "useFor": "a data scramble, a decode effect, numbers changing",
  "seconds": 1.0,
  "onsetS": 0.07,
  "peakS": 0.0,
  "lufs": -9.1,
  "volume": 0.36,
  "recorded": true,
  "readings": [
   {
    "sound": "an alarm clock beeping",
    "z": 3.65
   },
   {
    "sound": "a glockenspiel run",
    "z": 2.62
   },
   {
    "sound": "a doorbell",
    "z": 2.56
   }
  ]
 },
 {
  "id": "divider-scramble-02",
  "source": "agentcut",
  "file": "divider-scramble-02.mp3",
  "category": "divider",
  "description": "A glassy, bubbly digital rattle",
  "useFor": "a scramble or shuffle transition, things rearranging",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.1,
  "lufs": -16.4,
  "volume": 0.83,
  "recorded": true,
  "readings": [
   {
    "sound": "ice cubes in a glass",
    "z": 3.23
   },
   {
    "sound": "bubbles underwater",
    "z": 3.12
   },
   {
    "sound": "a digital glitch",
    "z": 2.98
   }
  ]
 },
 {
  "id": "divider-scramble-03",
  "source": "agentcut",
  "file": "divider-scramble-03.mp3",
  "category": "divider",
  "description": "A very fast glassy clinking rattle",
  "useFor": "a quick shuffle, a glitchy text scramble",
  "seconds": 0.6,
  "onsetS": 0.046,
  "peakS": 0.074,
  "lufs": -18.4,
  "volume": 1.05,
  "recorded": true,
  "readings": [
   {
    "sound": "ice cubes in a glass",
    "z": 3.17
   },
   {
    "sound": "an alarm clock beeping",
    "z": 2.8
   },
   {
    "sound": "glass clinking",
    "z": 2.59
   }
  ]
 },
 {
  "id": "divider-scramble-04",
  "source": "agentcut",
  "file": "divider-scramble-04.mp3",
  "category": "divider",
  "description": "A glassy rattle, like ice cubes in a glass",
  "useFor": "a playful shuffle, a reshuffle of cards or items",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.328,
  "lufs": -12.7,
  "volume": 0.54,
  "recorded": true,
  "readings": [
   {
    "sound": "ice cubes in a glass",
    "z": 4.19
   },
   {
    "sound": "a finger squeaking on glass",
    "z": 2.89
   },
   {
    "sound": "a kalimba note",
    "z": 2.46
   }
  ]
 },
 {
  "id": "impact-crash-01",
  "source": "agentcut",
  "file": "impact-crash-01.mp3",
  "category": "impact",
  "description": "A short punchy low hit with a kick-drum body",
  "useFor": "a logo slam, a big title landing, a strong beat accent",
  "seconds": 0.6,
  "onsetS": 0.046,
  "peakS": 0.061,
  "lufs": -12.2,
  "volume": 0.51,
  "recorded": true,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.6
   },
   {
    "sound": "a kick drum",
    "z": 3.43
   },
   {
    "sound": "a heavy thud",
    "z": 2.91
   }
  ]
 },
 {
  "id": "impact-doom-01",
  "source": "agentcut",
  "file": "impact-doom-01.mp3",
  "category": "impact",
  "description": "A heavy low boom with a kick-drum thump",
  "useFor": "a dramatic drop, a dark title, the end card hit",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.058,
  "lufs": -13.0,
  "volume": 0.56,
  "recorded": true,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.46
   },
   {
    "sound": "a heavy thud",
    "z": 3.12
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.88
   }
  ]
 },
 {
  "id": "impact-thud-01",
  "source": "agentcut",
  "file": "impact-thud-01.mp3",
  "category": "impact",
  "description": "A soft, quiet wooden thud",
  "useFor": "a card or panel landing, a subtle drop",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.043,
  "lufs": -26.5,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 3.11
   },
   {
    "sound": "a sub bass drop",
    "z": 2.37
   },
   {
    "sound": "an error buzz",
    "z": 2.25
   }
  ]
 },
 {
  "id": "impact-thunk-01",
  "source": "agentcut",
  "file": "impact-thunk-01.mp3",
  "category": "impact",
  "description": "A low hollow wooden thunk with a tonal knock",
  "useFor": "a block falling into place, a stamp, a satisfying lock-in",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.044,
  "lufs": -17.2,
  "volume": 0.91,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.36
   },
   {
    "sound": "a wooden block hit",
    "z": 3.03
   },
   {
    "sound": "a cow mooing",
    "z": 2.74
   }
  ]
 },
 {
  "id": "pop-bubble-01",
  "source": "agentcut",
  "file": "pop-bubble-01.mp3",
  "category": "pop",
  "description": "A clean round bubble pop",
  "useFor": "an element popping in, a badge appearing, a tooltip",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.024,
  "lufs": -16.6,
  "volume": 0.85,
  "recorded": true,
  "readings": [
   {
    "sound": "a mouth pop",
    "z": 4.28
   },
   {
    "sound": "a bubble pop",
    "z": 3.87
   },
   {
    "sound": "a cork pop",
    "z": 3.6
   }
  ]
 },
 {
  "id": "pop-cute-01",
  "source": "agentcut",
  "file": "pop-cute-01.mp3",
  "category": "pop",
  "description": "A soft low tonal pop, kalimba-like",
  "useFor": "a cute pop-in, an avatar or sticker appearing",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.055,
  "lufs": -15.2,
  "volume": 0.72,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.94
   },
   {
    "sound": "a success chime",
    "z": 2.45
   },
   {
    "sound": "a glass ting",
    "z": 2.15
   }
  ]
 },
 {
  "id": "pop-cute-02",
  "source": "agentcut",
  "file": "pop-cute-02.mp3",
  "category": "pop",
  "description": "A bright mouth-pop",
  "useFor": "a playful pop-in, an emoji or reaction",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.03,
  "lufs": -11.9,
  "volume": 0.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a mouth pop",
    "z": 3.05
   },
   {
    "sound": "a cork pop",
    "z": 2.71
   },
   {
    "sound": "a bubble pop",
    "z": 2.71
   }
  ]
 },
 {
  "id": "pop-cute-03",
  "source": "agentcut",
  "file": "pop-cute-03.mp3",
  "category": "pop",
  "description": "A liquid bloop, like a bubble underwater",
  "useFor": "a bubbly pop-in, a drop appearing, a fluid UI",
  "seconds": 1.0,
  "onsetS": 0.081,
  "peakS": 0.11,
  "lufs": -11.9,
  "volume": 0.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a liquid bloop",
    "z": 2.99
   },
   {
    "sound": "a bubble pop",
    "z": 2.94
   },
   {
    "sound": "bubbles underwater",
    "z": 2.68
   }
  ]
 },
 {
  "id": "pop-icon-01",
  "source": "agentcut",
  "file": "pop-icon-01.mp3",
  "category": "pop",
  "description": "A crisp clean mouth-pop",
  "useFor": "an icon or button popping in, a notification badge",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.017,
  "lufs": -15.3,
  "volume": 0.73,
  "recorded": true,
  "readings": [
   {
    "sound": "a mouth pop",
    "z": 4.12
   },
   {
    "sound": "a bubble pop",
    "z": 3.9
   },
   {
    "sound": "a cork pop",
    "z": 3.32
   }
  ]
 },
 {
  "id": "pop-jump-01",
  "source": "agentcut",
  "file": "pop-jump-01.mp3",
  "category": "pop",
  "description": "A wooden tonal pop, like a kalimba or wood block",
  "useFor": "an element bouncing in, a playful jump",
  "seconds": 1.0,
  "onsetS": 0.081,
  "peakS": 0.073,
  "lufs": -15.6,
  "volume": 0.76,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.72
   },
   {
    "sound": "a wooden block hit",
    "z": 3.45
   },
   {
    "sound": "an alarm clock beeping",
    "z": 2.81
   }
  ]
 },
 {
  "id": "pop-jump-02",
  "source": "agentcut",
  "file": "pop-jump-02.mp3",
  "category": "pop",
  "description": "A bouncy tonal pop, kalimba-like, with a few quick repeats",
  "useFor": "something jumping or bouncing into place",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.015,
  "lufs": -17.7,
  "volume": 0.97,
  "recorded": true,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 4.39
   },
   {
    "sound": "a success chime",
    "z": 2.88
   },
   {
    "sound": "a doorbell",
    "z": 2.73
   }
  ]
 },
 {
  "id": "pop-jump-03",
  "source": "agentcut",
  "file": "pop-jump-03.mp3",
  "category": "pop",
  "description": "A very quiet bright tonal bounce, glassy",
  "useFor": "a tiny bounce, a light accent under other sounds",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.037,
  "lufs": -33.4,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 2.77
   },
   {
    "sound": "a sustained glass harp tone",
    "z": 2.64
   },
   {
    "sound": "a basketball bouncing",
    "z": 2.38
   }
  ]
 },
 {
  "id": "swoosh-air-01",
  "source": "agentcut",
  "file": "swoosh-air-01.mp3",
  "category": "swoosh",
  "description": "A fast airy whoosh",
  "useFor": "a card or panel sliding in, a quick move",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.225,
  "lufs": -21.1,
  "volume": 1.43,
  "recorded": true,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.51
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.21
   },
   {
    "sound": "a whip pan transition",
    "z": 2.95
   }
  ]
 },
 {
  "id": "swoosh-soft-01",
  "source": "agentcut",
  "file": "swoosh-soft-01.mp3",
  "category": "swoosh",
  "description": "A soft, low, fast whoosh",
  "useFor": "a gentle slide, a camera move, a soft transition",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.194,
  "lufs": -19.9,
  "volume": 1.24,
  "recorded": true,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.89
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.21
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.18
   }
  ]
 },
 {
  "id": "swoosh-soft-02",
  "source": "agentcut",
  "file": "swoosh-soft-02.mp3",
  "category": "swoosh",
  "description": "A soft quick swipe",
  "useFor": "a swipe gesture, a carousel moving, a menu sliding",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.259,
  "lufs": -16.4,
  "volume": 0.83,
  "recorded": true,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.46
   },
   {
    "sound": "a quick swipe",
    "z": 2.8
   },
   {
    "sound": "a short swish",
    "z": 2.64
   }
  ]
 },
 {
  "id": "swoosh-soft-03",
  "source": "agentcut",
  "file": "swoosh-soft-03.mp3",
  "category": "swoosh",
  "description": "A clean fast whoosh that passes by",
  "useFor": "a whip pan, a fast camera move, an element flying past",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.393,
  "lufs": -18.3,
  "volume": 1.04,
  "recorded": true,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 5.11
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.71
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.62
   }
  ]
 },
 {
  "id": "swoosh-soft-04",
  "source": "agentcut",
  "file": "swoosh-soft-04.mp3",
  "category": "swoosh",
  "description": "A soft, round fast whoosh",
  "useFor": "a smooth transition, a panel sliding, a zoom",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.257,
  "lufs": -16.9,
  "volume": 0.88,
  "recorded": true,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.36
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.52
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.06
   }
  ]
 },
 {
  "id": "swoosh-swish-01",
  "source": "agentcut",
  "file": "swoosh-swish-01.mp3",
  "category": "swoosh",
  "description": "A short low swish that ends in a soft punch",
  "useFor": "a quick element arriving with a hit, a snap into place",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.051,
  "lufs": -24.9,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.41
   },
   {
    "sound": "a suction cup pop",
    "z": 2.7
   },
   {
    "sound": "a knife chopping on a board",
    "z": 2.57
   }
  ]
 },
 {
  "id": "swoosh-swish-02",
  "source": "agentcut",
  "file": "swoosh-swish-02.mp3",
  "category": "swoosh",
  "description": "A fast stick-through-the-air swish",
  "useFor": "a quick swipe, a slash, a fast reveal",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.098,
  "lufs": -24.4,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a stick swung fast through the air",
    "z": 3.95
   },
   {
    "sound": "a fast whoosh",
    "z": 3.43
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.09
   }
  ]
 },
 {
  "id": "swoosh-tech-01",
  "source": "agentcut",
  "file": "swoosh-tech-01.mp3",
  "category": "swoosh",
  "description": "A bright metallic swish with a ring",
  "useFor": "a shiny reveal, a premium sweep, a highlight passing",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.099,
  "lufs": -14.0,
  "volume": 0.63,
  "recorded": true,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 2.88
   },
   {
    "sound": "a sword being drawn",
    "z": 2.87
   },
   {
    "sound": "coins dropping",
    "z": 2.52
   }
  ]
 },
 {
  "id": "swoosh-tech-02",
  "source": "agentcut",
  "file": "swoosh-tech-02.mp3",
  "category": "swoosh",
  "description": "A bright metallic sweep, like a blade being drawn",
  "useFor": "a sharp reveal, a title sliding in, a sleek tech move",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.28,
  "lufs": -15.0,
  "volume": 0.71,
  "recorded": true,
  "readings": [
   {
    "sound": "a sword being drawn",
    "z": 3.31
   },
   {
    "sound": "a spray can hissing",
    "z": 2.4
   },
   {
    "sound": "a metal scrape",
    "z": 2.24
   }
  ]
 },
 {
  "id": "swoosh-tech-03",
  "source": "agentcut",
  "file": "swoosh-tech-03.mp3",
  "category": "swoosh",
  "description": "A bright swelling swoosh, like a reverse cymbal",
  "useFor": "a build into a reveal, a rise before a cut",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.282,
  "lufs": -10.5,
  "volume": 0.42,
  "recorded": true,
  "readings": [
   {
    "sound": "a squishy wet squelch",
    "z": 2.64
   },
   {
    "sound": "a fast whoosh",
    "z": 2.56
   },
   {
    "sound": "a reverse cymbal swell",
    "z": 2.5
   }
  ]
 },
 {
  "id": "swoosh-tech-04",
  "source": "agentcut",
  "file": "swoosh-tech-04.mp3",
  "category": "swoosh",
  "description": "A bright buzzy digital glitch swoosh",
  "useFor": "a glitch transition, a tech cut, a screen switch",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.114,
  "lufs": -11.0,
  "volume": 0.45,
  "recorded": true,
  "readings": [
   {
    "sound": "a digital glitch",
    "z": 2.54
   },
   {
    "sound": "an error buzz",
    "z": 2.49
   },
   {
    "sound": "a phone vibration buzz",
    "z": 2.45
   }
  ]
 },
 {
  "id": "whoosh-deep-01",
  "source": "agentcut",
  "file": "whoosh-deep-01.mp3",
  "category": "whoosh",
  "description": "A deep low whoosh with a thumping body",
  "useFor": "a heavy transition, a big camera move, a dramatic pass",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.23,
  "lufs": -20.2,
  "volume": 1.29,
  "recorded": true,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 2.76
   },
   {
    "sound": "a heavy thud",
    "z": 2.52
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.26
   }
  ]
 },
 {
  "id": "whoosh-deep-02",
  "source": "agentcut",
  "file": "whoosh-deep-02.mp3",
  "category": "whoosh",
  "description": "A deep cinematic whoosh",
  "useFor": "a cinematic transition, a whip pan to a hero shot, a big move",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.288,
  "lufs": -15.1,
  "volume": 0.72,
  "recorded": true,
  "readings": [
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.15
   },
   {
    "sound": "a fast whoosh",
    "z": 3.12
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.89
   }
  ]
 },
 {
  "id": "whoosh-long-01",
  "source": "agentcut",
  "file": "whoosh-long-01.mp3",
  "category": "whoosh",
  "description": "A long 2 s air whoosh with a slow build",
  "useFor": "a long camera move, an orbit, a slow reveal",
  "seconds": 2.0,
  "onsetS": 0.081,
  "peakS": 0.486,
  "lufs": -22.2,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.53
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.68
   },
   {
    "sound": "a soft air whoosh",
    "z": 3.31
   }
  ]
 },
 {
  "id": "whoosh-soft-01",
  "source": "agentcut",
  "file": "whoosh-soft-01.mp3",
  "category": "whoosh",
  "description": "A quiet low soft whoosh",
  "useFor": "a subtle move under music, a gentle transition",
  "seconds": 1.0,
  "onsetS": 0.07,
  "peakS": 0.258,
  "lufs": -23.8,
  "volume": 1.5,
  "recorded": true,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.8
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.35
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.15
   }
  ]
 },
 {
  "id": "whoosh-soft-02",
  "source": "agentcut",
  "file": "whoosh-soft-02.mp3",
  "category": "whoosh",
  "description": "A low soft whoosh that starts late (~0.3 s) with a heartbeat-like pulse",
  "useFor": "a slow dramatic move, a tension beat",
  "seconds": 1.0,
  "onsetS": 0.313,
  "peakS": 0.35,
  "lufs": -18.0,
  "volume": 1.0,
  "recorded": true,
  "readings": [
   {
    "sound": "a stick swung fast through the air",
    "z": 2.91
   },
   {
    "sound": "a heartbeat",
    "z": 2.74
   },
   {
    "sound": "a fast whoosh",
    "z": 2.71
   }
  ]
 },
 {
  "id": "es-click-double",
  "source": "earshot",
  "file": "earshot/click-double.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a wooden block hit. Cursor presses and buttons: a short modal tick with a small body (earshot click/double)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.103,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.5
   },
   {
    "sound": "a wooden block hit",
    "z": 2.9
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.49
   }
  ]
 },
 {
  "id": "es-click-snap",
  "source": "earshot",
  "file": "earshot/click-snap.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a soft key release click. Cursor presses and buttons: a short modal tick with a small body (earshot click/snap)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.062,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.18
   },
   {
    "sound": "a soft key release click",
    "z": 2.71
   },
   {
    "sound": "a can opening",
    "z": 2.54
   }
  ]
 },
 {
  "id": "es-click-soft",
  "source": "earshot",
  "file": "earshot/click-soft.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a plastic case snapping shut. Cursor presses and buttons: a short modal tick with a small body (earshot click/soft)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.094,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.83
   },
   {
    "sound": "a plastic case snapping shut",
    "z": 2.93
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.91
   }
  ]
 },
 {
  "id": "es-click-thock",
  "source": "earshot",
  "file": "earshot/click-thock.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a kick drum. Cursor presses and buttons: a short modal tick with a small body (earshot click/thock)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.103,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 4.58
   },
   {
    "sound": "a kick drum",
    "z": 3.39
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.98
   }
  ]
 },
 {
  "id": "es-click-tink",
  "source": "earshot",
  "file": "earshot/click-tink.mp3",
  "category": "click",
  "description": "Sounds most like a soft key release click / a toggle switch click. Cursor presses and buttons: a short modal tick with a small body (earshot click/tink)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.069,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 2.96
   },
   {
    "sound": "a toggle switch click",
    "z": 2.67
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.65
   }
  ]
 },
 {
  "id": "es-cut-hit-air",
  "source": "earshot",
  "file": "earshot/cut-hit-air.mp3",
  "category": "impact",
  "description": "Sounds most like a kick drum / a heartbeat. A fast wide sub hit under a sustained bright air band (earshot cut_hit/air)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 0.549,
  "onsetS": 0.046,
  "peakS": 0.04,
  "lufs": -19.4,
  "volume": 1.17,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.42
   },
   {
    "sound": "a heartbeat",
    "z": 2.56
   },
   {
    "sound": "a sub bass drop",
    "z": 2.49
   }
  ]
 },
 {
  "id": "es-cut-hit-kick",
  "source": "earshot",
  "file": "earshot/cut-hit-kick.mp3",
  "category": "impact",
  "description": "Sounds most like a snare hit / a kick drum. A kick-led sub hit: the beater lifts it to ~275 Hz (earshot cut_hit/kick)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 0.325,
  "onsetS": 0.046,
  "peakS": 0.013,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 4.55
   },
   {
    "sound": "a kick drum",
    "z": 3.4
   },
   {
    "sound": "a wooden block hit",
    "z": 3.38
   }
  ]
 },
 {
  "id": "es-cut-hit-punch",
  "source": "earshot",
  "file": "earshot/cut-hit-punch.mp3",
  "category": "impact",
  "description": "Sounds most like a kick drum / a snare hit. A short punchy cut hit (0.28 s), two thirds under 150 Hz (earshot cut_hit/punch)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 0.282,
  "onsetS": 0.046,
  "peakS": 0.059,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.87
   },
   {
    "sound": "a snare hit",
    "z": 3.78
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.37
   }
  ]
 },
 {
  "id": "es-cut-hit-rumble",
  "source": "earshot",
  "file": "earshot/cut-hit-rumble.mp3",
  "category": "impact",
  "description": "Sounds most like a stutter glitch transition / a kick drum. A kick on a slow sub drop into a wide granular rumble (1.4 s) (earshot cut_hit/rumble)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.4,
  "onsetS": 0.046,
  "peakS": 0.075,
  "lufs": -20.0,
  "volume": 1.26,
  "recorded": false,
  "readings": [
   {
    "sound": "a stutter glitch transition",
    "z": 2.9
   },
   {
    "sound": "a kick drum",
    "z": 2.87
   },
   {
    "sound": "a record scratch",
    "z": 2.57
   }
  ]
 },
 {
  "id": "es-cut-hit-sub",
  "source": "earshot",
  "file": "earshot/cut-hit-sub.mp3",
  "category": "impact",
  "description": "Sounds most like a snare hit / a kick drum. A short sub hit, 225 -> 46 Hz, with a kick and a low punch (earshot cut_hit/sub)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 0.286,
  "onsetS": 0.046,
  "peakS": 0.018,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 4.25
   },
   {
    "sound": "a kick drum",
    "z": 3.44
   },
   {
    "sound": "a wooden block hit",
    "z": 2.62
   }
  ]
 },
 {
  "id": "es-downlifter-air-fall",
  "source": "earshot",
  "file": "earshot/downlifter-air-fall.mp3",
  "category": "riser",
  "description": "Sounds most like a fast whoosh / a downlifter falling sweep. Energy falling away after a hit, scene exits (earshot downlifter/air_fall)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 2.06,
  "onsetS": 0.046,
  "peakS": 0.146,
  "lufs": -14.1,
  "volume": 0.64,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.57
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 3.38
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.96
   }
  ]
 },
 {
  "id": "es-downlifter-flange-air",
  "source": "earshot",
  "file": "earshot/downlifter-flange-air.mp3",
  "category": "riser",
  "description": "Sounds most like a fast whoosh / a downlifter falling sweep. Energy falling away after a hit, scene exits (earshot downlifter/flange_air)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 2.954,
  "onsetS": 0.046,
  "peakS": 0.218,
  "lufs": -14.6,
  "volume": 0.68,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.7
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 3.42
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.96
   }
  ]
 },
 {
  "id": "es-downlifter-shepard-fall",
  "source": "earshot",
  "file": "earshot/downlifter-shepard-fall.mp3",
  "category": "riser",
  "description": "Sounds most like a downlifter falling sweep / a fast whoosh. Energy falling away after a hit, scene exits (earshot downlifter/shepard_fall)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 4.019,
  "onsetS": 0.046,
  "peakS": 0.281,
  "lufs": -14.9,
  "volume": 0.7,
  "recorded": false,
  "readings": [
   {
    "sound": "a downlifter falling sweep",
    "z": 4.19
   },
   {
    "sound": "a fast whoosh",
    "z": 3.21
   },
   {
    "sound": "an uplifter sweep",
    "z": 2.99
   }
  ]
 },
 {
  "id": "es-downlifter-sub-sink",
  "source": "earshot",
  "file": "earshot/downlifter-sub-sink.mp3",
  "category": "riser",
  "description": "Sounds most like a sub bass drop / a cinematic hit with a long tail. Energy falling away after a hit, scene exits (earshot downlifter/sub_sink)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.787,
  "onsetS": 0.046,
  "peakS": 0.064,
  "lufs": -13.0,
  "volume": 0.56,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 3.41
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 3.33
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.91
   }
  ]
 },
 {
  "id": "es-downlifter-synth-fall",
  "source": "earshot",
  "file": "earshot/downlifter-synth-fall.mp3",
  "category": "riser",
  "description": "Sounds most like a downlifter falling sweep / a fast whoosh. Energy falling away after a hit, scene exits (earshot downlifter/synth_fall)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 4.039,
  "onsetS": 0.046,
  "peakS": 0.326,
  "lufs": -12.6,
  "volume": 0.54,
  "recorded": false,
  "readings": [
   {
    "sound": "a downlifter falling sweep",
    "z": 4.22
   },
   {
    "sound": "a fast whoosh",
    "z": 2.88
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.69
   }
  ]
 },
 {
  "id": "es-downlifter-tape",
  "source": "earshot",
  "file": "earshot/downlifter-tape.mp3",
  "category": "riser",
  "description": "Sounds most like a downlifter falling sweep / a cinematic hit with a long tail. Energy falling away after a hit, scene exits (earshot downlifter/tape)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.63,
  "onsetS": 0.046,
  "peakS": 0.1,
  "lufs": -13.5,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a downlifter falling sweep",
    "z": 3.22
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.79
   },
   {
    "sound": "a sub bass drop",
    "z": 2.53
   }
  ]
 },
 {
  "id": "es-drip-bloop",
  "source": "earshot",
  "file": "earshot/drip-bloop.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit / a fast whoosh. A big drop's slow bloop: ~5 st over 0.1-0.15 s (earshot drip/bloop)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.373,
  "onsetS": 0.046,
  "peakS": 0.027,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.33
   },
   {
    "sound": "a fast whoosh",
    "z": 2.55
   },
   {
    "sound": "a wooden block hit",
    "z": 2.44
   }
  ]
 },
 {
  "id": "es-drip-bubble",
  "source": "earshot",
  "file": "earshot/drip-bubble.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit / a wooden block hit. A lower bubble rising 10 st with a daughter bubble (earshot drip/bubble)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.289,
  "onsetS": 0.046,
  "peakS": 0.016,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.32
   },
   {
    "sound": "a wooden block hit",
    "z": 3.26
   },
   {
    "sound": "a cork pop",
    "z": 2.59
   }
  ]
 },
 {
  "id": "es-drip-drop",
  "source": "earshot",
  "file": "earshot/drip-drop.mp3",
  "category": "pop",
  "description": "Sounds most like a wooden block hit / a cork pop. A water drop: a 306 Hz bubble rising 8 st within 40 ms, soft onset (earshot drip/drop)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.334,
  "onsetS": 0.046,
  "peakS": 0.025,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 3.04
   },
   {
    "sound": "a cork pop",
    "z": 2.84
   },
   {
    "sound": "a snare hit",
    "z": 2.84
   }
  ]
 },
 {
  "id": "es-drip-plink",
  "source": "earshot",
  "file": "earshot/drip-plink.mp3",
  "category": "pop",
  "description": "Sounds most like a success chime / a snare hit. A small high plink rising 3 st (earshot drip/plink)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.257,
  "onsetS": 0.046,
  "peakS": 0.03,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 2.79
   },
   {
    "sound": "a snare hit",
    "z": 2.72
   },
   {
    "sound": "a chat message pop",
    "z": 2.71
   }
  ]
 },
 {
  "id": "es-drip-tiny",
  "source": "earshot",
  "file": "earshot/drip-tiny.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit / a wooden block hit. A tiny fast droplet at 1.15 kHz, 0.1 s (earshot drip/tiny)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.142,
  "onsetS": 0.046,
  "peakS": 0.008,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 5.15
   },
   {
    "sound": "a wooden block hit",
    "z": 4.05
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.08
   }
  ]
 },
 {
  "id": "es-glitch-burst",
  "source": "earshot",
  "file": "earshot/glitch-burst.mp3",
  "category": "glitch",
  "description": "Sounds most like coins dropping / a ratchet clicking. Crackle, then bright bursts that hit first and speed up (earshot glitch/burst)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.868,
  "onsetS": 0.313,
  "peakS": 0.361,
  "lufs": -23.7,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "coins dropping",
    "z": 2.96
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.82
   },
   {
    "sound": "an error buzz",
    "z": 2.78
   }
  ]
 },
 {
  "id": "es-glitch-chirp",
  "source": "earshot",
  "file": "earshot/glitch-chirp.mp3",
  "category": "glitch",
  "description": "Sounds most like a wooden block hit / a snare hit. A pitched data-chirp stutter that hits first (earshot glitch/chirp)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.407,
  "onsetS": 0.07,
  "peakS": 0.078,
  "lufs": -18.2,
  "volume": 1.02,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 3.57
   },
   {
    "sound": "a snare hit",
    "z": 3.28
   },
   {
    "sound": "an error buzz",
    "z": 2.45
   }
  ]
 },
 {
  "id": "es-glitch-crush",
  "source": "earshot",
  "file": "earshot/glitch-crush.mp3",
  "category": "glitch",
  "description": "Sounds most like a rubber stretch / a digital glitch. Glitch transitions, error states (earshot glitch/crush)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.54,
  "onsetS": 0.046,
  "peakS": 0.398,
  "lufs": -17.5,
  "volume": 0.94,
  "recorded": false,
  "readings": [
   {
    "sound": "a rubber stretch",
    "z": 3.23
   },
   {
    "sound": "a digital glitch",
    "z": 3.11
   },
   {
    "sound": "a record scratch",
    "z": 3.1
   }
  ]
 },
 {
  "id": "es-glitch-data",
  "source": "earshot",
  "file": "earshot/glitch-data.mp3",
  "category": "glitch",
  "description": "Sounds most like ice cubes in a glass / a record scratch. Glitch transitions, error states (earshot glitch/data)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.49,
  "onsetS": 0.046,
  "peakS": 0.387,
  "lufs": -11.7,
  "volume": 0.48,
  "recorded": false,
  "readings": [
   {
    "sound": "ice cubes in a glass",
    "z": 3.03
   },
   {
    "sound": "a record scratch",
    "z": 2.94
   },
   {
    "sound": "a squishy wet squelch",
    "z": 2.85
   }
  ]
 },
 {
  "id": "es-glitch-hit",
  "source": "earshot",
  "file": "earshot/glitch-hit.mp3",
  "category": "glitch",
  "description": "Sounds most like a record scratch / a digital glitch. Glitch transitions, error states (earshot glitch/hit)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.34,
  "onsetS": 0.046,
  "peakS": 0.254,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 3.31
   },
   {
    "sound": "a digital glitch",
    "z": 2.95
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.88
   }
  ]
 },
 {
  "id": "es-glitch-mid",
  "source": "earshot",
  "file": "earshot/glitch-mid.mp3",
  "category": "glitch",
  "description": "Sounds most like a snare hit / an error buzz. A short mid glitch that hits first (earshot glitch/mid)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.245,
  "onsetS": 0.046,
  "peakS": 0.036,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.32
   },
   {
    "sound": "an error buzz",
    "z": 3.02
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.53
   }
  ]
 },
 {
  "id": "es-glitch-scramble",
  "source": "earshot",
  "file": "earshot/glitch-scramble.mp3",
  "category": "glitch",
  "description": "Sounds most like a digital glitch / a record scratch. Glitch transitions, error states (earshot glitch/scramble)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.59,
  "onsetS": 0.046,
  "peakS": 0.299,
  "lufs": -13.9,
  "volume": 0.62,
  "recorded": false,
  "readings": [
   {
    "sound": "a digital glitch",
    "z": 3.46
   },
   {
    "sound": "a record scratch",
    "z": 3.26
   },
   {
    "sound": "a rubber stretch",
    "z": 2.85
   }
  ]
 },
 {
  "id": "es-glitch-stutter",
  "source": "earshot",
  "file": "earshot/glitch-stutter.mp3",
  "category": "glitch",
  "description": "Sounds most like a digital glitch / a stutter glitch transition. Glitch transitions, error states (earshot glitch/stutter)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.64,
  "onsetS": 0.046,
  "peakS": 0.379,
  "lufs": -13.7,
  "volume": 0.61,
  "recorded": false,
  "readings": [
   {
    "sound": "a digital glitch",
    "z": 3.41
   },
   {
    "sound": "a stutter glitch transition",
    "z": 3.31
   },
   {
    "sound": "a record scratch",
    "z": 2.69
   }
  ]
 },
 {
  "id": "es-hover-tick-air",
  "source": "earshot",
  "file": "earshot/hover-tick-air.mp3",
  "category": "click",
  "description": "Sounds most like a ratchet clicking / lego bricks clicking. Hover, list rows passing, tiny ticks (earshot hover_tick/air)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.074,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 3.51
   },
   {
    "sound": "lego bricks clicking",
    "z": 2.71
   },
   {
    "sound": "a soft key release click",
    "z": 2.47
   }
  ]
 },
 {
  "id": "es-hover-tick-high",
  "source": "earshot",
  "file": "earshot/hover-tick-high.mp3",
  "category": "click",
  "description": "Sounds most like a soft key release click / a ratchet clicking. Hover, list rows passing, tiny ticks (earshot hover_tick/high)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.047,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 3.03
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.87
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.78
   }
  ]
 },
 {
  "id": "es-hover-tick-mid",
  "source": "earshot",
  "file": "earshot/hover-tick-mid.mp3",
  "category": "click",
  "description": "Sounds most like a ratchet clicking / a single mechanical keyboard key press. Hover, list rows passing, tiny ticks (earshot hover_tick/mid)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.089,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 3.01
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.58
   },
   {
    "sound": "a soft key release click",
    "z": 2.47
   }
  ]
 },
 {
  "id": "es-hover-tick-ping",
  "source": "earshot",
  "file": "earshot/hover-tick-ping.mp3",
  "category": "click",
  "description": "Sounds most like a triangle hit / an error buzz. Hover, list rows passing, tiny ticks (earshot hover_tick/ping)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.05,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 2.88
   },
   {
    "sound": "an error buzz",
    "z": 2.85
   },
   {
    "sound": "a soft key release click",
    "z": 2.72
   }
  ]
 },
 {
  "id": "es-impact-blast",
  "source": "earshot",
  "file": "earshot/impact-blast.mp3",
  "category": "impact",
  "description": "Sounds most like an explosion / a cinematic hit with a long tail. A cinematic hit: reveal, title slam (earshot impact/blast)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 5.759,
  "onsetS": 0.046,
  "peakS": 0.018,
  "lufs": -21.2,
  "volume": 1.45,
  "recorded": false,
  "readings": [
   {
    "sound": "an explosion",
    "z": 4.27
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 4.15
   },
   {
    "sound": "a big drum hit",
    "z": 3.78
   }
  ]
 },
 {
  "id": "es-impact-classic",
  "source": "earshot",
  "file": "earshot/impact-classic.mp3",
  "category": "impact",
  "description": "Sounds most like a cinematic hit with a long tail / a big drum hit. A cinematic hit: reveal, title slam (earshot impact/classic)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 4.797,
  "onsetS": 0.046,
  "peakS": 0.112,
  "lufs": -19.3,
  "volume": 1.16,
  "recorded": false,
  "readings": [
   {
    "sound": "a cinematic hit with a long tail",
    "z": 4.01
   },
   {
    "sound": "a big drum hit",
    "z": 3.51
   },
   {
    "sound": "a deep cinematic boom",
    "z": 3.1
   }
  ]
 },
 {
  "id": "es-impact-deep",
  "source": "earshot",
  "file": "earshot/impact-deep.mp3",
  "category": "impact",
  "description": "Sounds most like a big drum hit / a cinematic hit with a long tail. A cinematic hit: reveal, title slam (earshot impact/deep)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 6.205,
  "onsetS": 0.046,
  "peakS": 0.08,
  "lufs": -20.2,
  "volume": 1.29,
  "recorded": false,
  "readings": [
   {
    "sound": "a big drum hit",
    "z": 3.89
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 3.83
   },
   {
    "sound": "a deep cinematic boom",
    "z": 3.26
   }
  ]
 },
 {
  "id": "es-impact-metal",
  "source": "earshot",
  "file": "earshot/impact-metal.mp3",
  "category": "impact",
  "description": "Sounds most like a cinematic hit with a long tail / a big drum hit. A cinematic hit: reveal, title slam (earshot impact/metal)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 5.022,
  "onsetS": 0.046,
  "peakS": 0.119,
  "lufs": -18.7,
  "volume": 1.08,
  "recorded": false,
  "readings": [
   {
    "sound": "a cinematic hit with a long tail",
    "z": 4.04
   },
   {
    "sound": "a big drum hit",
    "z": 2.98
   },
   {
    "sound": "a snare hit",
    "z": 2.79
   }
  ]
 },
 {
  "id": "es-impact-punch",
  "source": "earshot",
  "file": "earshot/impact-punch.mp3",
  "category": "impact",
  "description": "Sounds most like a big drum hit / a cinematic hit with a long tail. A cinematic hit: reveal, title slam (earshot impact/punch)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 2.845,
  "onsetS": 0.046,
  "peakS": 0.061,
  "lufs": -19.0,
  "volume": 1.12,
  "recorded": false,
  "readings": [
   {
    "sound": "a big drum hit",
    "z": 3.63
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 3.58
   },
   {
    "sound": "a kick drum",
    "z": 3.07
   }
  ]
 },
 {
  "id": "es-impact-swell",
  "source": "earshot",
  "file": "earshot/impact-swell.mp3",
  "category": "impact",
  "description": "Sounds most like a cinematic hit with a long tail / a deep cinematic boom. A cinematic hit: reveal, title slam (earshot impact/swell)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 6.232,
  "onsetS": 0.348,
  "peakS": 0.562,
  "lufs": -17.6,
  "volume": 0.95,
  "recorded": false,
  "readings": [
   {
    "sound": "a cinematic hit with a long tail",
    "z": 4.22
   },
   {
    "sound": "a deep cinematic boom",
    "z": 3.4
   },
   {
    "sound": "a big drum hit",
    "z": 3.18
   }
  ]
 },
 {
  "id": "es-knock-desk",
  "source": "earshot",
  "file": "earshot/knock-desk.mp3",
  "category": "foley",
  "description": "Sounds most like a snare hit / a punchy impact hit. A knuckle on a desk: a low wooden knock with the table under it (earshot knock/desk)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.224,
  "onsetS": 0.046,
  "peakS": 0.024,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.39
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.21
   },
   {
    "sound": "a kick drum",
    "z": 2.66
   }
  ]
 },
 {
  "id": "es-knock-double",
  "source": "earshot",
  "file": "earshot/knock-double.mp3",
  "category": "foley",
  "description": "Sounds most like a snare hit / a wooden block hit. A knock-knock: two wooden taps 55 ms apart (earshot knock/double)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.156,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.01
   },
   {
    "sound": "a wooden block hit",
    "z": 2.72
   },
   {
    "sound": "a bubble pop",
    "z": 2.62
   }
  ]
 },
 {
  "id": "es-knock-plastic",
  "source": "earshot",
  "file": "earshot/knock-plastic.mp3",
  "category": "foley",
  "description": "Sounds most like a soft key release click / an error buzz. A plastic click that bounces back 18 ms later (2.4 kHz) (earshot knock/plastic)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.153,
  "onsetS": 0.046,
  "peakS": 0.054,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 2.69
   },
   {
    "sound": "an error buzz",
    "z": 2.67
   },
   {
    "sound": "a digital glitch",
    "z": 2.41
   }
  ]
 },
 {
  "id": "es-knock-snap",
  "source": "earshot",
  "file": "earshot/knock-snap.mp3",
  "category": "foley",
  "description": "Sounds most like a single mechanical keyboard key press / a soft key release click. A soft contact, then a bright plastic snap with a bounce (3 kHz) (earshot knock/snap)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.134,
  "onsetS": 0.046,
  "peakS": 0.044,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a single mechanical keyboard key press",
    "z": 3.69
   },
   {
    "sound": "a soft key release click",
    "z": 2.94
   },
   {
    "sound": "an enter key press",
    "z": 2.74
   }
  ]
 },
 {
  "id": "es-knock-wood",
  "source": "earshot",
  "file": "earshot/knock-wood.mp3",
  "category": "foley",
  "description": "Sounds most like a wooden block hit / a punchy impact hit. A mid-band wooden knock: a 400 Hz block and its faint rattle (earshot knock/wood)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.154,
  "onsetS": 0.046,
  "peakS": 0.017,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 3.87
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.87
   },
   {
    "sound": "a snare hit",
    "z": 3.74
   }
  ]
 },
 {
  "id": "es-logo-sting-soft-bloom",
  "source": "earshot",
  "file": "earshot/logo-sting-soft-bloom.mp3",
  "category": "sting",
  "description": "Sounds most like a triangle hit. A composite logo reveal (lead-in + hit + chime) (earshot logo_sting/soft_bloom)",
  "useFor": "logo reveals and end cards",
  "seconds": 1.85,
  "onsetS": 0.046,
  "peakS": 0.301,
  "lufs": -12.4,
  "volume": 0.52,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 3.25
   },
   {
    "sound": "a success chime",
    "z": 2.47
   },
   {
    "sound": "a reverse cymbal swell",
    "z": 2.38
   }
  ]
 },
 {
  "id": "es-logo-sting-spark",
  "source": "earshot",
  "file": "earshot/logo-sting-spark.mp3",
  "category": "sting",
  "description": "Sounds most like a triangle hit / a bicycle bell. A composite logo reveal (lead-in + hit + chime) (earshot logo_sting/spark)",
  "useFor": "logo reveals and end cards",
  "seconds": 1.84,
  "onsetS": 0.046,
  "peakS": 0.012,
  "lufs": -17.4,
  "volume": 0.93,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 3.34
   },
   {
    "sound": "a bicycle bell",
    "z": 2.73
   },
   {
    "sound": "a success chime",
    "z": 2.62
   }
  ]
 },
 {
  "id": "es-logo-sting-whoosh-glass",
  "source": "earshot",
  "file": "earshot/logo-sting-whoosh-glass.mp3",
  "category": "sting",
  "description": "Sounds most like a success chime / a triangle hit. A composite logo reveal (lead-in + hit + chime) (earshot logo_sting/whoosh_glass)",
  "useFor": "logo reveals and end cards",
  "seconds": 1.912,
  "onsetS": 0.046,
  "peakS": 0.202,
  "lufs": -12.8,
  "volume": 0.55,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 3.15
   },
   {
    "sound": "a triangle hit",
    "z": 2.94
   },
   {
    "sound": "a notification ding",
    "z": 2.5
   }
  ]
 },
 {
  "id": "es-mallet-celesta",
  "source": "earshot",
  "file": "earshot/mallet-celesta.mp3",
  "category": "notify",
  "description": "Sounds most like a triangle hit / a success chime. A wide celesta note (G5, L / R correlation ~0.5), gated (earshot mallet/celesta)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.414,
  "onsetS": 0.046,
  "peakS": 0.026,
  "lufs": -13.3,
  "volume": 0.58,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 2.89
   },
   {
    "sound": "a success chime",
    "z": 2.85
   },
   {
    "sound": "a glass ting",
    "z": 2.76
   }
  ]
 },
 {
  "id": "es-mallet-flourish",
  "source": "earshot",
  "file": "earshot/mallet-flourish.mp3",
  "category": "notify",
  "description": "Sounds most like a success chime / a notification ding. A quick three-note chime flourish in an arc, near mono (earshot mallet/flourish)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.505,
  "onsetS": 0.046,
  "peakS": 0.053,
  "lufs": -15.5,
  "volume": 0.75,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 3.66
   },
   {
    "sound": "a notification ding",
    "z": 2.79
   },
   {
    "sound": "a kalimba note",
    "z": 2.78
   }
  ]
 },
 {
  "id": "es-mallet-glock",
  "source": "earshot",
  "file": "earshot/mallet-glock.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a success chime. A gated glockenspiel note doubled an octave under (0.35 s) (earshot mallet/glock)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.412,
  "onsetS": 0.046,
  "peakS": 0.011,
  "lufs": -13.7,
  "volume": 0.61,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.4
   },
   {
    "sound": "a success chime",
    "z": 3.11
   },
   {
    "sound": "a glass ting",
    "z": 3.06
   }
  ]
 },
 {
  "id": "es-mallet-marimba",
  "source": "earshot",
  "file": "earshot/mallet-marimba.mp3",
  "category": "notify",
  "description": "Sounds most like a glass ting / a kalimba note. A short dry wooden marimba note (G4) (earshot mallet/marimba)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.564,
  "onsetS": 0.046,
  "peakS": 0.01,
  "lufs": -13.5,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a glass ting",
    "z": 3.24
   },
   {
    "sound": "a kalimba note",
    "z": 2.63
   },
   {
    "sound": "a wooden block hit",
    "z": 2.61
   }
  ]
 },
 {
  "id": "es-mallet-pluck",
  "source": "earshot",
  "file": "earshot/mallet-pluck.mp3",
  "category": "notify",
  "description": "Sounds most like a success chime / a car horn honking. A soft, felt-like low pluck (earshot mallet/pluck)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.494,
  "onsetS": 0.046,
  "peakS": 0.054,
  "lufs": -11.9,
  "volume": 0.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 2.8
   },
   {
    "sound": "a car horn honking",
    "z": 2.65
   },
   {
    "sound": "an error buzz",
    "z": 2.41
   }
  ]
 },
 {
  "id": "es-mallet-up4",
  "source": "earshot",
  "file": "earshot/mallet-up4.mp3",
  "category": "notify",
  "description": "Sounds most like a success chime / a magic sparkle chime. Four gated chime notes up a pentatonic scale in skips, 110 ms apart, panned note by note (earshot mallet/up4)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.749,
  "onsetS": 0.093,
  "peakS": 0.337,
  "lufs": -8.2,
  "volume": 0.32,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 4.19
   },
   {
    "sound": "a magic sparkle chime",
    "z": 2.95
   },
   {
    "sound": "a notification ding",
    "z": 2.49
   }
  ]
 },
 {
  "id": "es-notify-m0",
  "source": "earshot",
  "file": "earshot/notify-m0.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a glass ting. Struck bell chimes (A4-E6): success, a message, a soft lockup (earshot notify/m0)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 2.3,
  "onsetS": 0.046,
  "peakS": 0.007,
  "lufs": -18.3,
  "volume": 1.04,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 4.55
   },
   {
    "sound": "a glass ting",
    "z": 2.95
   },
   {
    "sound": "a wine glass ring",
    "z": 2.61
   }
  ]
 },
 {
  "id": "es-notify-m1",
  "source": "earshot",
  "file": "earshot/notify-m1.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a glass ting. Struck bell chimes (A4-E6): success, a message, a soft lockup (earshot notify/m1)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 2.0,
  "onsetS": 0.046,
  "peakS": 0.006,
  "lufs": -19.6,
  "volume": 1.2,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 4.07
   },
   {
    "sound": "a glass ting",
    "z": 3.62
   },
   {
    "sound": "a triangle hit",
    "z": 3.22
   }
  ]
 },
 {
  "id": "es-notify-m2",
  "source": "earshot",
  "file": "earshot/notify-m2.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a glass ting. Struck bell chimes (A4-E6): success, a message, a soft lockup (earshot notify/m2)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 1.8,
  "onsetS": 0.046,
  "peakS": 0.006,
  "lufs": -18.5,
  "volume": 1.06,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 4.78
   },
   {
    "sound": "a glass ting",
    "z": 3.53
   },
   {
    "sound": "a wine glass ring",
    "z": 2.92
   }
  ]
 },
 {
  "id": "es-notify-m3",
  "source": "earshot",
  "file": "earshot/notify-m3.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a singing bowl. Struck bell chimes (A4-E6): success, a message, a soft lockup (earshot notify/m3)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 2.5,
  "onsetS": 0.046,
  "peakS": 0.006,
  "lufs": -20.8,
  "volume": 1.38,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 3.34
   },
   {
    "sound": "a singing bowl",
    "z": 2.9
   },
   {
    "sound": "a wine glass ring",
    "z": 2.63
   }
  ]
 },
 {
  "id": "es-notify-m4",
  "source": "earshot",
  "file": "earshot/notify-m4.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a glass ting. Struck bell chimes (A4-E6): success, a message, a soft lockup (earshot notify/m4)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 1.8,
  "onsetS": 0.046,
  "peakS": 0.009,
  "lufs": -16.3,
  "volume": 0.82,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 4.68
   },
   {
    "sound": "a glass ting",
    "z": 2.76
   },
   {
    "sound": "a wine glass ring",
    "z": 2.33
   }
  ]
 },
 {
  "id": "es-notify-m5",
  "source": "earshot",
  "file": "earshot/notify-m5.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a glass ting. Struck bell chimes (A4-E6): success, a message, a soft lockup (earshot notify/m5)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 1.7,
  "onsetS": 0.046,
  "peakS": 0.006,
  "lufs": -17.0,
  "volume": 0.89,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 4.31
   },
   {
    "sound": "a glass ting",
    "z": 3.34
   },
   {
    "sound": "a wine glass ring",
    "z": 2.92
   }
  ]
 },
 {
  "id": "es-notify-mid-tine",
  "source": "earshot",
  "file": "earshot/notify-mid-tine.mp3",
  "category": "notify",
  "description": "Sounds most like a wooden block hit / a triangle hit. A rounded mid ding: a felt-struck tine over its octave (690 Hz, 32 ms onset) (earshot notify/mid_tine)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.425,
  "onsetS": 0.046,
  "peakS": 0.038,
  "lufs": -14.7,
  "volume": 0.68,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 2.85
   },
   {
    "sound": "a triangle hit",
    "z": 2.54
   },
   {
    "sound": "a glass ting",
    "z": 2.39
   }
  ]
 },
 {
  "id": "es-notify-mid-wood",
  "source": "earshot",
  "file": "earshot/notify-mid-wood.mp3",
  "category": "notify",
  "description": "Sounds most like a success chime / a triangle hit. A soft wooden bar with its octave body, a step higher (earshot notify/mid_wood)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.317,
  "onsetS": 0.046,
  "peakS": 0.036,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 2.99
   },
   {
    "sound": "a triangle hit",
    "z": 2.85
   },
   {
    "sound": "an error buzz",
    "z": 2.58
   }
  ]
 },
 {
  "id": "es-pluck-kalimba",
  "source": "earshot",
  "file": "earshot/pluck-kalimba.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a glass ting. The launch film kalimba: a bright steel tine over a small wooden box (earshot pluck/kalimba)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 3.0,
  "onsetS": 0.046,
  "peakS": 0.017,
  "lufs": -18.6,
  "volume": 1.07,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 5.53
   },
   {
    "sound": "a glass ting",
    "z": 3.62
   },
   {
    "sound": "a sustained glass harp tone",
    "z": 3.62
   }
  ]
 },
 {
  "id": "es-pluck-kalimba-ring",
  "source": "earshot",
  "file": "earshot/pluck-kalimba-ring.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a sustained glass harp tone. A longer ring (the film's chord tones): end cards, a tonal lockup (earshot pluck/kalimba_ring)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 3.0,
  "onsetS": 0.046,
  "peakS": 0.017,
  "lufs": -16.1,
  "volume": 0.8,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 5.65
   },
   {
    "sound": "a sustained glass harp tone",
    "z": 3.63
   },
   {
    "sound": "a glass ting",
    "z": 3.61
   }
  ]
 },
 {
  "id": "es-pluck-kalimba-soft",
  "source": "earshot",
  "file": "earshot/pluck-kalimba-soft.mp3",
  "category": "notify",
  "description": "Sounds most like a kalimba note / a glass ting. A fleshy-thumb pluck: darker and softer at the attack (the film's soft notes) (earshot pluck/kalimba_soft)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 3.0,
  "onsetS": 0.046,
  "peakS": 0.046,
  "lufs": -14.2,
  "volume": 0.65,
  "recorded": false,
  "readings": [
   {
    "sound": "a kalimba note",
    "z": 5.61
   },
   {
    "sound": "a glass ting",
    "z": 3.76
   },
   {
    "sound": "a sustained glass harp tone",
    "z": 3.64
   }
  ]
 },
 {
  "id": "es-pop-0",
  "source": "earshot",
  "file": "earshot/pop-0.mp3",
  "category": "pop",
  "description": "Sounds most like a cork pop / a bubble pop. Bubble and cork pops (the bubble rises in pitch) (earshot pop/0)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.2,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a cork pop",
    "z": 4.46
   },
   {
    "sound": "a bubble pop",
    "z": 4.2
   },
   {
    "sound": "a mouth pop",
    "z": 4.11
   }
  ]
 },
 {
  "id": "es-pop-1",
  "source": "earshot",
  "file": "earshot/pop-1.mp3",
  "category": "pop",
  "description": "Sounds most like a liquid bloop / a water drop. Bubble and cork pops (the bubble rises in pitch) (earshot pop/1)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.15,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a liquid bloop",
    "z": 3.35
   },
   {
    "sound": "a water drop",
    "z": 2.96
   },
   {
    "sound": "a cork pop",
    "z": 2.96
   }
  ]
 },
 {
  "id": "es-pop-3",
  "source": "earshot",
  "file": "earshot/pop-3.mp3",
  "category": "pop",
  "description": "Sounds most like a mouth pop / a cork pop. Bubble and cork pops (the bubble rises in pitch) (earshot pop/3)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.16,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a mouth pop",
    "z": 4.31
   },
   {
    "sound": "a cork pop",
    "z": 3.95
   },
   {
    "sound": "a bubble pop",
    "z": 3.9
   }
  ]
 },
 {
  "id": "es-pop-4",
  "source": "earshot",
  "file": "earshot/pop-4.mp3",
  "category": "pop",
  "description": "Sounds most like a wooden block hit / a cork pop. Bubble and cork pops (the bubble rises in pitch) (earshot pop/4)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.22,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 4.24
   },
   {
    "sound": "a cork pop",
    "z": 3.18
   },
   {
    "sound": "a mouth pop",
    "z": 2.99
   }
  ]
 },
 {
  "id": "es-pro-click-glass",
  "source": "earshot",
  "file": "earshot/pro-click-glass.mp3",
  "category": "click",
  "description": "Sounds most like a triangle hit / a soft key release click. Bright designed UI ticks (earshot pro_click/glass)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.062,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 3.45
   },
   {
    "sound": "a soft key release click",
    "z": 3.04
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.53
   }
  ]
 },
 {
  "id": "es-pro-click-mouse",
  "source": "earshot",
  "file": "earshot/pro-click-mouse.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a wooden block hit. Bright designed UI ticks (earshot pro_click/mouse)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.054,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 4.17
   },
   {
    "sound": "a wooden block hit",
    "z": 3.21
   },
   {
    "sound": "a box lid closing",
    "z": 2.71
   }
  ]
 },
 {
  "id": "es-pro-click-snap",
  "source": "earshot",
  "file": "earshot/pro-click-snap.mp3",
  "category": "click",
  "description": "Sounds most like a soft key release click / an error buzz. Bright designed UI ticks (earshot pro_click/snap)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.047,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 3.4
   },
   {
    "sound": "an error buzz",
    "z": 2.92
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.74
   }
  ]
 },
 {
  "id": "es-pro-click-soft",
  "source": "earshot",
  "file": "earshot/pro-click-soft.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a wooden block hit. Bright designed UI ticks (earshot pro_click/soft)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.053,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.27
   },
   {
    "sound": "a wooden block hit",
    "z": 2.93
   },
   {
    "sound": "a soft key release click",
    "z": 2.8
   }
  ]
 },
 {
  "id": "es-pro-click-tink",
  "source": "earshot",
  "file": "earshot/pro-click-tink.mp3",
  "category": "click",
  "description": "Sounds most like an error buzz / a triangle hit. Bright designed UI ticks (earshot pro_click/tink)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.037,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "an error buzz",
    "z": 2.97
   },
   {
    "sound": "a triangle hit",
    "z": 2.74
   },
   {
    "sound": "ice cubes in a glass",
    "z": 2.57
   }
  ]
 },
 {
  "id": "es-pro-glitch-crunchy",
  "source": "earshot",
  "file": "earshot/pro-glitch-crunchy.mp3",
  "category": "glitch",
  "description": "Sounds most like a record scratch / a ratchet clicking. A designed stutter ending on the cut (earshot pro_glitch/crunchy)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.71,
  "onsetS": 0.046,
  "peakS": 0.655,
  "lufs": -21.7,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 2.97
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.71
   },
   {
    "sound": "a rubber stretch",
    "z": 2.6
   }
  ]
 },
 {
  "id": "es-pro-glitch-data",
  "source": "earshot",
  "file": "earshot/pro-glitch-data.mp3",
  "category": "glitch",
  "description": "Sounds most like a stutter glitch transition / a record scratch. A designed stutter ending on the cut (earshot pro_glitch/data)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.67,
  "onsetS": 0.046,
  "peakS": 0.621,
  "lufs": -21.7,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a stutter glitch transition",
    "z": 3.08
   },
   {
    "sound": "a record scratch",
    "z": 3.04
   },
   {
    "sound": "a quick swipe",
    "z": 2.69
   }
  ]
 },
 {
  "id": "es-pro-glitch-fastroll",
  "source": "earshot",
  "file": "earshot/pro-glitch-fastroll.mp3",
  "category": "glitch",
  "description": "Sounds most like a ratchet clicking / a quick swipe. A designed stutter ending on the cut (earshot pro_glitch/fastroll)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.55,
  "onsetS": 0.046,
  "peakS": 0.507,
  "lufs": -21.2,
  "volume": 1.45,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 2.93
   },
   {
    "sound": "a quick swipe",
    "z": 2.81
   },
   {
    "sound": "a record scratch",
    "z": 2.78
   }
  ]
 },
 {
  "id": "es-pro-glitch-framelock",
  "source": "earshot",
  "file": "earshot/pro-glitch-framelock.mp3",
  "category": "glitch",
  "description": "Sounds most like a record scratch / a stutter glitch transition. A designed stutter ending on the cut (earshot pro_glitch/framelock)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.73,
  "onsetS": 0.046,
  "peakS": 0.665,
  "lufs": -21.3,
  "volume": 1.46,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 3.19
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.6
   },
   {
    "sound": "a zipper",
    "z": 2.57
   }
  ]
 },
 {
  "id": "es-pro-glitch-sparse",
  "source": "earshot",
  "file": "earshot/pro-glitch-sparse.mp3",
  "category": "glitch",
  "description": "Sounds most like a ratchet clicking / a stutter glitch transition. A designed stutter ending on the cut (earshot pro_glitch/sparse)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.75,
  "onsetS": 0.046,
  "peakS": 0.705,
  "lufs": -24.2,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 2.89
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.78
   },
   {
    "sound": "keys jingling",
    "z": 2.67
   }
  ]
 },
 {
  "id": "es-pro-glitch-standard",
  "source": "earshot",
  "file": "earshot/pro-glitch-standard.mp3",
  "category": "glitch",
  "description": "Sounds most like a digital glitch / a stutter glitch transition. A designed stutter ending on the cut (earshot pro_glitch/standard)",
  "useFor": "glitch cuts, tech transitions",
  "seconds": 0.71,
  "onsetS": 0.046,
  "peakS": 0.662,
  "lufs": -18.2,
  "volume": 1.02,
  "recorded": false,
  "readings": [
   {
    "sound": "a digital glitch",
    "z": 2.96
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.67
   },
   {
    "sound": "an error buzz",
    "z": 2.61
   }
  ]
 },
 {
  "id": "es-pro-hover-tick-detent",
  "source": "earshot",
  "file": "earshot/pro-hover-tick-detent.mp3",
  "category": "click",
  "description": "Sounds most like an error buzz / a soft key release click. Airy digital ticks: cursor blinks, counters (earshot pro_hover_tick/detent)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.036,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "an error buzz",
    "z": 3.31
   },
   {
    "sound": "a soft key release click",
    "z": 2.9
   },
   {
    "sound": "coins dropping",
    "z": 2.83
   }
  ]
 },
 {
  "id": "es-pro-hover-tick-ping",
  "source": "earshot",
  "file": "earshot/pro-hover-tick-ping.mp3",
  "category": "click",
  "description": "Sounds most like an error buzz / a digital glitch. Airy digital ticks: cursor blinks, counters (earshot pro_hover_tick/ping)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.039,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "an error buzz",
    "z": 3.72
   },
   {
    "sound": "a digital glitch",
    "z": 3.1
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.57
   }
  ]
 },
 {
  "id": "es-pro-hover-tick-soft",
  "source": "earshot",
  "file": "earshot/pro-hover-tick-soft.mp3",
  "category": "click",
  "description": "Sounds most like a soft key release click / a single mechanical keyboard key press. Airy digital ticks: cursor blinks, counters (earshot pro_hover_tick/soft)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.032,
  "onsetS": 0.0012,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 3.7
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.87
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.83
   }
  ]
 },
 {
  "id": "es-pro-impact-air",
  "source": "earshot",
  "file": "earshot/pro-impact-air.mp3",
  "category": "impact",
  "description": "Sounds most like a kick drum / a record scratch. A designed gated sub impact (earshot pro_impact/air)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 0.848,
  "onsetS": 0.081,
  "peakS": 0.17,
  "lufs": -14.4,
  "volume": 0.66,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.03
   },
   {
    "sound": "a record scratch",
    "z": 2.67
   },
   {
    "sound": "a sub bass drop",
    "z": 2.28
   }
  ]
 },
 {
  "id": "es-pro-impact-deep",
  "source": "earshot",
  "file": "earshot/pro-impact-deep.mp3",
  "category": "impact",
  "description": "Sounds most like a kick drum / a punchy impact hit. A designed gated sub impact (earshot pro_impact/deep)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.315,
  "onsetS": 0.046,
  "peakS": 0.213,
  "lufs": -19.3,
  "volume": 1.16,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.21
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.57
   },
   {
    "sound": "a heavy thud",
    "z": 2.47
   }
  ]
 },
 {
  "id": "es-pro-impact-rumble",
  "source": "earshot",
  "file": "earshot/pro-impact-rumble.mp3",
  "category": "impact",
  "description": "Sounds most like a kick drum / a record scratch. A designed gated sub impact (earshot pro_impact/rumble)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 0.993,
  "onsetS": 0.174,
  "peakS": 0.621,
  "lufs": -18.9,
  "volume": 1.11,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.57
   },
   {
    "sound": "a record scratch",
    "z": 2.74
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.57
   }
  ]
 },
 {
  "id": "es-pro-impact-short",
  "source": "earshot",
  "file": "earshot/pro-impact-short.mp3",
  "category": "impact",
  "description": "Sounds most like a kick drum / a record scratch. A designed gated sub impact (earshot pro_impact/short)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 0.667,
  "onsetS": 0.046,
  "peakS": 0.177,
  "lufs": -16.1,
  "volume": 0.8,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.31
   },
   {
    "sound": "a record scratch",
    "z": 2.94
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.19
   }
  ]
 },
 {
  "id": "es-pro-impact-swell",
  "source": "earshot",
  "file": "earshot/pro-impact-swell.mp3",
  "category": "impact",
  "description": "Sounds most like a record scratch / a squishy wet squelch. A designed gated sub impact (earshot pro_impact/swell)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.118,
  "onsetS": 0.07,
  "peakS": 0.389,
  "lufs": -15.7,
  "volume": 0.77,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 3.65
   },
   {
    "sound": "a squishy wet squelch",
    "z": 2.52
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.47
   }
  ]
 },
 {
  "id": "es-pro-logo-sting-chirp-hum",
  "source": "earshot",
  "file": "earshot/pro-logo-sting-chirp-hum.mp3",
  "category": "sting",
  "description": "Sounds most like a snare hit. Designed launch gestures onto a tone (earshot pro_logo_sting/chirp_hum)",
  "useFor": "logo reveals and end cards",
  "seconds": 0.985,
  "onsetS": 0.046,
  "peakS": 0.084,
  "lufs": -19.2,
  "volume": 1.15,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 2.66
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.38
   },
   {
    "sound": "a deep cinematic boom",
    "z": 2.35
   }
  ]
 },
 {
  "id": "es-pro-logo-sting-swell-sting",
  "source": "earshot",
  "file": "earshot/pro-logo-sting-swell-sting.mp3",
  "category": "sting",
  "description": "Sounds most like a reverse cymbal swell / an uplifter sweep. Designed launch gestures onto a tone (earshot pro_logo_sting/swell_sting)",
  "useFor": "logo reveals and end cards",
  "seconds": 1.3,
  "onsetS": 0.104,
  "peakS": 0.468,
  "lufs": -14.2,
  "volume": 0.65,
  "recorded": false,
  "readings": [
   {
    "sound": "a reverse cymbal swell",
    "z": 2.95
   },
   {
    "sound": "an uplifter sweep",
    "z": 2.72
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 2.56
   }
  ]
 },
 {
  "id": "es-pro-logo-sting-taps-tone",
  "source": "earshot",
  "file": "earshot/pro-logo-sting-taps-tone.mp3",
  "category": "sting",
  "description": "Sounds most like a chat message pop / a success chime. Designed launch gestures onto a tone (earshot pro_logo_sting/taps_tone)",
  "useFor": "logo reveals and end cards",
  "seconds": 0.95,
  "onsetS": 0.081,
  "peakS": 0.158,
  "lufs": -13.3,
  "volume": 0.58,
  "recorded": false,
  "readings": [
   {
    "sound": "a chat message pop",
    "z": 3.08
   },
   {
    "sound": "a success chime",
    "z": 2.85
   },
   {
    "sound": "a kalimba note",
    "z": 2.81
   }
  ]
 },
 {
  "id": "es-pro-logo-sting-zap-bloom",
  "source": "earshot",
  "file": "earshot/pro-logo-sting-zap-bloom.mp3",
  "category": "sting",
  "description": "Sounds most like a snare hit / an error buzz. Designed launch gestures onto a tone (earshot pro_logo_sting/zap_bloom)",
  "useFor": "logo reveals and end cards",
  "seconds": 0.96,
  "onsetS": 0.046,
  "peakS": 0.073,
  "lufs": -15.1,
  "volume": 0.72,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 4.32
   },
   {
    "sound": "an error buzz",
    "z": 3.05
   },
   {
    "sound": "a chat message pop",
    "z": 2.22
   }
  ]
 },
 {
  "id": "es-pro-notify-ding-1822",
  "source": "earshot",
  "file": "earshot/pro-notify-ding-1822.mp3",
  "category": "notify",
  "description": "Sounds most like a triangle hit / a success chime. Short clean dings a semitone apart (earshot pro_notify/ding_1822)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.26,
  "onsetS": 0.046,
  "peakS": 0.006,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 2.98
   },
   {
    "sound": "a success chime",
    "z": 2.8
   },
   {
    "sound": "a chat message pop",
    "z": 2.63
   }
  ]
 },
 {
  "id": "es-pro-notify-ding-1930",
  "source": "earshot",
  "file": "earshot/pro-notify-ding-1930.mp3",
  "category": "notify",
  "description": "Sounds most like a triangle hit / a chat message pop. Short clean dings a semitone apart (earshot pro_notify/ding_1930)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.27,
  "onsetS": 0.046,
  "peakS": 0.014,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 2.79
   },
   {
    "sound": "a chat message pop",
    "z": 2.67
   },
   {
    "sound": "a success chime",
    "z": 2.61
   }
  ]
 },
 {
  "id": "es-pro-notify-ding-2045",
  "source": "earshot",
  "file": "earshot/pro-notify-ding-2045.mp3",
  "category": "notify",
  "description": "Sounds most like a triangle hit / a glass ting. Short clean dings a semitone apart (earshot pro_notify/ding_2045)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.36,
  "onsetS": 0.046,
  "peakS": 0.007,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 3.06
   },
   {
    "sound": "a glass ting",
    "z": 2.78
   },
   {
    "sound": "a success chime",
    "z": 2.77
   }
  ]
 },
 {
  "id": "es-pro-notify-ding-2167",
  "source": "earshot",
  "file": "earshot/pro-notify-ding-2167.mp3",
  "category": "notify",
  "description": "Sounds most like a triangle hit / a glass ting. Short clean dings a semitone apart (earshot pro_notify/ding_2167)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.3,
  "onsetS": 0.046,
  "peakS": 0.013,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 3.24
   },
   {
    "sound": "a glass ting",
    "z": 2.66
   },
   {
    "sound": "a success chime",
    "z": 2.54
   }
  ]
 },
 {
  "id": "es-pro-notify-ding-2296",
  "source": "earshot",
  "file": "earshot/pro-notify-ding-2296.mp3",
  "category": "notify",
  "description": "Sounds most like a triangle hit / a glass ting. Short clean dings a semitone apart (earshot pro_notify/ding_2296)",
  "useFor": "success, messages, notifications, soft confirms",
  "seconds": 0.26,
  "onsetS": 0.046,
  "peakS": 0.008,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a triangle hit",
    "z": 2.92
   },
   {
    "sound": "a glass ting",
    "z": 2.68
   },
   {
    "sound": "a chat message pop",
    "z": 2.53
   }
  ]
 },
 {
  "id": "es-pro-pop-boop",
  "source": "earshot",
  "file": "earshot/pro-pop-boop.mp3",
  "category": "pop",
  "description": "Sounds most like a kick drum / a punchy impact hit. Tonal pops for a word or badge appearing (earshot pro_pop/boop)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.114,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 4.03
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.31
   },
   {
    "sound": "a snare hit",
    "z": 3.17
   }
  ]
 },
 {
  "id": "es-pro-pop-chirp",
  "source": "earshot",
  "file": "earshot/pro-pop-chirp.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit. Tonal pops for a word or badge appearing (earshot pro_pop/chirp)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.162,
  "onsetS": 0.046,
  "peakS": 0.038,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 2.57
   },
   {
    "sound": "a crisp interface click",
    "z": 2.33
   },
   {
    "sound": "a whip pan transition",
    "z": 2.19
   }
  ]
 },
 {
  "id": "es-pro-pop-double",
  "source": "earshot",
  "file": "earshot/pro-pop-double.mp3",
  "category": "pop",
  "description": "Sounds most like bubbles underwater / a wooden block hit. Tonal pops for a word or badge appearing (earshot pro_pop/double)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.157,
  "onsetS": 0.07,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "bubbles underwater",
    "z": 3.27
   },
   {
    "sound": "a wooden block hit",
    "z": 3.01
   },
   {
    "sound": "a bubble pop",
    "z": 2.81
   }
  ]
 },
 {
  "id": "es-pro-pop-thup",
  "source": "earshot",
  "file": "earshot/pro-pop-thup.mp3",
  "category": "pop",
  "description": "Sounds most like a punchy impact hit / a kick drum. Tonal pops for a word or badge appearing (earshot pro_pop/thup)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.099,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.81
   },
   {
    "sound": "a kick drum",
    "z": 3.39
   },
   {
    "sound": "a wooden block hit",
    "z": 3.33
   }
  ]
 },
 {
  "id": "es-pro-pop-tink",
  "source": "earshot",
  "file": "earshot/pro-pop-tink.mp3",
  "category": "pop",
  "description": "Sounds most like a wooden block hit / a kalimba note. Tonal pops for a word or badge appearing (earshot pro_pop/tink)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.093,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 2.98
   },
   {
    "sound": "a kalimba note",
    "z": 2.75
   },
   {
    "sound": "a triangle hit",
    "z": 2.71
   }
  ]
 },
 {
  "id": "es-pro-pop-in-airy",
  "source": "earshot",
  "file": "earshot/pro-pop-in-airy.mp3",
  "category": "pop",
  "description": "Sounds most like a punchy impact hit / a kick drum. An icon or element popping in: a round low thump (earshot pro_pop_in/airy)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.17,
  "onsetS": 0.046,
  "peakS": 0.016,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 4.49
   },
   {
    "sound": "a kick drum",
    "z": 4.1
   },
   {
    "sound": "a snare hit",
    "z": 3.81
   }
  ]
 },
 {
  "id": "es-pro-pop-in-deep",
  "source": "earshot",
  "file": "earshot/pro-pop-in-deep.mp3",
  "category": "pop",
  "description": "Sounds most like a punchy impact hit / a kick drum. An icon or element popping in: a round low thump (earshot pro_pop_in/deep)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.176,
  "onsetS": 0.046,
  "peakS": 0.017,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 4.43
   },
   {
    "sound": "a kick drum",
    "z": 3.91
   },
   {
    "sound": "a heavy thud",
    "z": 2.89
   }
  ]
 },
 {
  "id": "es-pro-pop-in-double",
  "source": "earshot",
  "file": "earshot/pro-pop-in-double.mp3",
  "category": "pop",
  "description": "Sounds most like a kick drum / a punchy impact hit. An icon or element popping in: a round low thump (earshot pro_pop_in/double)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.165,
  "onsetS": 0.081,
  "peakS": 0.016,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 4.63
   },
   {
    "sound": "a punchy impact hit",
    "z": 4.22
   },
   {
    "sound": "a snare hit",
    "z": 2.93
   }
  ]
 },
 {
  "id": "es-pro-pop-in-knock",
  "source": "earshot",
  "file": "earshot/pro-pop-in-knock.mp3",
  "category": "pop",
  "description": "Sounds most like a kick drum / a punchy impact hit. An icon or element popping in: a round low thump (earshot pro_pop_in/knock)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.152,
  "onsetS": 0.046,
  "peakS": 0.013,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 4.13
   },
   {
    "sound": "a punchy impact hit",
    "z": 4.08
   },
   {
    "sound": "a snare hit",
    "z": 3.37
   }
  ]
 },
 {
  "id": "es-pro-pop-in-round",
  "source": "earshot",
  "file": "earshot/pro-pop-in-round.mp3",
  "category": "pop",
  "description": "Sounds most like a punchy impact hit / a kick drum. An icon or element popping in: a round low thump (earshot pro_pop_in/round)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.172,
  "onsetS": 0.046,
  "peakS": 0.021,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.73
   },
   {
    "sound": "a kick drum",
    "z": 3.44
   },
   {
    "sound": "a snare hit",
    "z": 2.52
   }
  ]
 },
 {
  "id": "es-pro-riser-air-gate",
  "source": "earshot",
  "file": "earshot/pro-riser-air-gate.mp3",
  "category": "riser",
  "description": "Sounds most like a downlifter falling sweep / a record scratch. A short stutter riser into a cut (earshot pro_riser/air_gate)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.2,
  "onsetS": 0.046,
  "peakS": 1.192,
  "lufs": -13.4,
  "volume": 0.59,
  "recorded": false,
  "readings": [
   {
    "sound": "a downlifter falling sweep",
    "z": 3.45
   },
   {
    "sound": "a record scratch",
    "z": 2.95
   },
   {
    "sound": "a reverse cymbal swell",
    "z": 2.78
   }
  ]
 },
 {
  "id": "es-pro-riser-chop",
  "source": "earshot",
  "file": "earshot/pro-riser-chop.mp3",
  "category": "riser",
  "description": "Sounds most like a record scratch / a stutter glitch transition. A short stutter riser into a cut (earshot pro_riser/chop)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.992,
  "lufs": -15.2,
  "volume": 0.72,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 2.77
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.55
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 2.37
   }
  ]
 },
 {
  "id": "es-pro-riser-nblips",
  "source": "earshot",
  "file": "earshot/pro-riser-nblips.mp3",
  "category": "riser",
  "description": "Sounds most like a record scratch / a balloon squeak. A short stutter riser into a cut (earshot pro_riser/nblips)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.991,
  "lufs": -14.9,
  "volume": 0.7,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 2.74
   },
   {
    "sound": "a balloon squeak",
    "z": 2.7
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 2.63
   }
  ]
 },
 {
  "id": "es-pro-riser-nblips-hi",
  "source": "earshot",
  "file": "earshot/pro-riser-nblips-hi.mp3",
  "category": "riser",
  "description": "Sounds most like a record scratch / a stutter glitch transition. A short stutter riser into a cut (earshot pro_riser/nblips_hi)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 0.85,
  "onsetS": 0.046,
  "peakS": 0.842,
  "lufs": -17.8,
  "volume": 0.98,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 2.86
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.78
   },
   {
    "sound": "a balloon squeak",
    "z": 2.75
   }
  ]
 },
 {
  "id": "es-pro-riser-roll",
  "source": "earshot",
  "file": "earshot/pro-riser-roll.mp3",
  "category": "riser",
  "description": "Sounds most like a stutter glitch transition / a snare hit. A short stutter riser into a cut (earshot pro_riser/roll)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.3,
  "onsetS": 0.046,
  "peakS": 1.278,
  "lufs": -15.4,
  "volume": 0.74,
  "recorded": false,
  "readings": [
   {
    "sound": "a stutter glitch transition",
    "z": 2.91
   },
   {
    "sound": "a snare hit",
    "z": 2.6
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 2.32
   }
  ]
 },
 {
  "id": "es-pro-shimmer-m0",
  "source": "earshot",
  "file": "earshot/pro-shimmer-m0.mp3",
  "category": "shimmer",
  "description": "Sounds most like a magic sparkle chime / a glissando on bar chimes. Granular sparkle (earshot pro_shimmer/m0)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 1.95,
  "onsetS": 0.046,
  "peakS": 0.854,
  "lufs": -16.0,
  "volume": 0.79,
  "recorded": false,
  "readings": [
   {
    "sound": "a magic sparkle chime",
    "z": 4.16
   },
   {
    "sound": "a glissando on bar chimes",
    "z": 3.59
   },
   {
    "sound": "ice cubes in a glass",
    "z": 3.14
   }
  ]
 },
 {
  "id": "es-pro-shimmer-m1",
  "source": "earshot",
  "file": "earshot/pro-shimmer-m1.mp3",
  "category": "shimmer",
  "description": "Sounds most like ice cubes in a glass / pouring water. Granular sparkle (earshot pro_shimmer/m1)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 1.4,
  "onsetS": 0.046,
  "peakS": 0.364,
  "lufs": -19.7,
  "volume": 1.22,
  "recorded": false,
  "readings": [
   {
    "sound": "ice cubes in a glass",
    "z": 4.98
   },
   {
    "sound": "pouring water",
    "z": 3.26
   },
   {
    "sound": "bubbles underwater",
    "z": 2.95
   }
  ]
 },
 {
  "id": "es-pro-shimmer-m2",
  "source": "earshot",
  "file": "earshot/pro-shimmer-m2.mp3",
  "category": "shimmer",
  "description": "Sounds most like a success chime / a magic sparkle chime. Granular sparkle (earshot pro_shimmer/m2)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 1.65,
  "onsetS": 0.174,
  "peakS": 1.066,
  "lufs": -10.5,
  "volume": 0.42,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 3.52
   },
   {
    "sound": "a magic sparkle chime",
    "z": 3.32
   },
   {
    "sound": "a glissando on bar chimes",
    "z": 3.23
   }
  ]
 },
 {
  "id": "es-pro-shimmer-m4",
  "source": "earshot",
  "file": "earshot/pro-shimmer-m4.mp3",
  "category": "shimmer",
  "description": "Sounds most like bubbles underwater / ice cubes in a glass. Granular sparkle (earshot pro_shimmer/m4)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 2.4,
  "onsetS": 0.081,
  "peakS": 1.161,
  "lufs": -18.0,
  "volume": 1.0,
  "recorded": false,
  "readings": [
   {
    "sound": "bubbles underwater",
    "z": 3.05
   },
   {
    "sound": "ice cubes in a glass",
    "z": 2.78
   },
   {
    "sound": "a wooden block hit",
    "z": 2.78
   }
  ]
 },
 {
  "id": "es-pro-sub-drop-bright",
  "source": "earshot",
  "file": "earshot/pro-sub-drop-bright.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop / a deep cinematic whoosh. The designed low drop that blooms after the cut (earshot pro_sub_drop/bright)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.25,
  "onsetS": 0.046,
  "peakS": 0.33,
  "lufs": -10.9,
  "volume": 0.44,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 2.8
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.51
   },
   {
    "sound": "a reverse cymbal swell",
    "z": 2.43
   }
  ]
 },
 {
  "id": "es-pro-sub-drop-low",
  "source": "earshot",
  "file": "earshot/pro-sub-drop-low.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop. The designed low drop that blooms after the cut (earshot pro_sub_drop/low)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.139,
  "onsetS": 0.046,
  "peakS": 0.442,
  "lufs": -11.4,
  "volume": 0.47,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 3.64
   },
   {
    "sound": "an error buzz",
    "z": 2.48
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.43
   }
  ]
 },
 {
  "id": "es-pro-sub-drop-quick",
  "source": "earshot",
  "file": "earshot/pro-sub-drop-quick.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop / a deep cinematic whoosh. The designed low drop that blooms after the cut (earshot pro_sub_drop/quick)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.0,
  "onsetS": 0.046,
  "peakS": 0.245,
  "lufs": -10.5,
  "volume": 0.42,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 3.63
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.8
   },
   {
    "sound": "a kick drum",
    "z": 2.75
   }
  ]
 },
 {
  "id": "es-pro-sub-drop-ref",
  "source": "earshot",
  "file": "earshot/pro-sub-drop-ref.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop. The designed low drop that blooms after the cut (earshot pro_sub_drop/ref)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.445,
  "onsetS": 0.046,
  "peakS": 0.412,
  "lufs": -11.6,
  "volume": 0.48,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 3.39
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.37
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.13
   }
  ]
 },
 {
  "id": "es-pro-sub-drop-soft",
  "source": "earshot",
  "file": "earshot/pro-sub-drop-soft.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop / a deep cinematic whoosh. The designed low drop that blooms after the cut (earshot pro_sub_drop/soft)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.482,
  "onsetS": 0.046,
  "peakS": 0.431,
  "lufs": -9.2,
  "volume": 0.36,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 4.39
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.83
   },
   {
    "sound": "a deep cinematic boom",
    "z": 2.37
   }
  ]
 },
 {
  "id": "es-pro-tap-double",
  "source": "earshot",
  "file": "earshot/pro-tap-double.mp3",
  "category": "click",
  "description": "Sounds most like a kick drum / a punchy impact hit. The soft low thump of a touch (earshot pro_tap/double)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.118,
  "onsetS": 0.046,
  "peakS": 0.01,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 4.42
   },
   {
    "sound": "a punchy impact hit",
    "z": 4.24
   },
   {
    "sound": "a snare hit",
    "z": 3.31
   }
  ]
 },
 {
  "id": "es-pro-tap-finger",
  "source": "earshot",
  "file": "earshot/pro-tap-finger.mp3",
  "category": "click",
  "description": "Sounds most like a kick drum / a punchy impact hit. The soft low thump of a touch (earshot pro_tap/finger)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.09,
  "onsetS": 0.046,
  "peakS": 0.011,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 4.49
   },
   {
    "sound": "a punchy impact hit",
    "z": 4.1
   },
   {
    "sound": "a snare hit",
    "z": 3.94
   }
  ]
 },
 {
  "id": "es-pro-tap-glass",
  "source": "earshot",
  "file": "earshot/pro-tap-glass.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a kick drum. The soft low thump of a touch (earshot pro_tap/glass)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.098,
  "onsetS": 0.046,
  "peakS": 0.011,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 4.15
   },
   {
    "sound": "a kick drum",
    "z": 3.97
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.76
   }
  ]
 },
 {
  "id": "es-pro-tap-knock",
  "source": "earshot",
  "file": "earshot/pro-tap-knock.mp3",
  "category": "click",
  "description": "Sounds most like a kick drum / a punchy impact hit. The soft low thump of a touch (earshot pro_tap/knock)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.086,
  "onsetS": 0.046,
  "peakS": 0.009,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 4.47
   },
   {
    "sound": "a punchy impact hit",
    "z": 4.08
   },
   {
    "sound": "a snare hit",
    "z": 3.72
   }
  ]
 },
 {
  "id": "es-pro-tap-soft",
  "source": "earshot",
  "file": "earshot/pro-tap-soft.mp3",
  "category": "click",
  "description": "Sounds most like a kick drum / a punchy impact hit. The soft low thump of a touch (earshot pro_tap/soft)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.098,
  "onsetS": 0.046,
  "peakS": 0.016,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 4.01
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.99
   },
   {
    "sound": "a snare hit",
    "z": 3.52
   }
  ]
 },
 {
  "id": "es-pro-typing-key-blip",
  "source": "earshot",
  "file": "earshot/pro-typing-key-blip.mp3",
  "category": "typing",
  "description": "Sounds most like a soft key release click / a scroll wheel tick. High-passed designed ticks for kinetic type (earshot pro_typing_key/blip)",
  "useFor": "typing and kinetic type",
  "seconds": 0.081,
  "onsetS": 0.046,
  "peakS": 0.009,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 3.21
   },
   {
    "sound": "a scroll wheel tick",
    "z": 2.83
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.81
   }
  ]
 },
 {
  "id": "es-pro-typing-key-crackle",
  "source": "earshot",
  "file": "earshot/pro-typing-key-crackle.mp3",
  "category": "typing",
  "description": "Sounds most like an error buzz / a snare hit. High-passed designed ticks for kinetic type (earshot pro_typing_key/crackle)",
  "useFor": "typing and kinetic type",
  "seconds": 0.073,
  "onsetS": 0.046,
  "peakS": 0.005,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "an error buzz",
    "z": 3.38
   },
   {
    "sound": "a snare hit",
    "z": 2.8
   },
   {
    "sound": "coins dropping",
    "z": 2.61
   }
  ]
 },
 {
  "id": "es-pro-typing-key-double",
  "source": "earshot",
  "file": "earshot/pro-typing-key-double.mp3",
  "category": "typing",
  "description": "Sounds most like a soft key release click / a ratchet clicking. High-passed designed ticks for kinetic type (earshot pro_typing_key/double)",
  "useFor": "typing and kinetic type",
  "seconds": 0.092,
  "onsetS": 0.046,
  "peakS": 0.003,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a soft key release click",
    "z": 3.27
   },
   {
    "sound": "a ratchet clicking",
    "z": 3.11
   },
   {
    "sound": "a pen click",
    "z": 2.98
   }
  ]
 },
 {
  "id": "es-pro-typing-key-glass",
  "source": "earshot",
  "file": "earshot/pro-typing-key-glass.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / a soft key release click. High-passed designed ticks for kinetic type (earshot pro_typing_key/glass)",
  "useFor": "typing and kinetic type",
  "seconds": 0.065,
  "onsetS": 0.046,
  "peakS": 0.003,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 4.1
   },
   {
    "sound": "a soft key release click",
    "z": 3.77
   },
   {
    "sound": "a scroll wheel tick",
    "z": 3.41
   }
  ]
 },
 {
  "id": "es-pro-typing-key-tick",
  "source": "earshot",
  "file": "earshot/pro-typing-key-tick.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / a soft key release click. High-passed designed ticks for kinetic type (earshot pro_typing_key/tick)",
  "useFor": "typing and kinetic type",
  "seconds": 0.061,
  "onsetS": 0.046,
  "peakS": 0.001,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 3.34
   },
   {
    "sound": "a soft key release click",
    "z": 2.76
   },
   {
    "sound": "a quick swipe",
    "z": 2.59
   }
  ]
 },
 {
  "id": "es-pro-typing-run-blip",
  "source": "earshot",
  "file": "earshot/pro-typing-run-blip.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / a scroll wheel tick. A whole typed run as one file (earshot pro_typing_run/blip)",
  "useFor": "typing and kinetic type",
  "seconds": 1.507,
  "onsetS": 0.081,
  "peakS": 0.38,
  "lufs": -20.4,
  "volume": 1.32,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 3.2
   },
   {
    "sound": "a scroll wheel tick",
    "z": 2.98
   },
   {
    "sound": "ice cubes in a glass",
    "z": 2.98
   }
  ]
 },
 {
  "id": "es-pro-typing-run-double",
  "source": "earshot",
  "file": "earshot/pro-typing-run-double.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / a scroll wheel tick. A whole typed run as one file (earshot pro_typing_run/double)",
  "useFor": "typing and kinetic type",
  "seconds": 1.593,
  "onsetS": 0.128,
  "peakS": 0.006,
  "lufs": -21.8,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 3.83
   },
   {
    "sound": "a scroll wheel tick",
    "z": 3.03
   },
   {
    "sound": "a fidget toy clicking",
    "z": 2.39
   }
  ]
 },
 {
  "id": "es-pro-typing-run-glass",
  "source": "earshot",
  "file": "earshot/pro-typing-run-glass.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / ice cubes in a glass. A whole typed run as one file (earshot pro_typing_run/glass)",
  "useFor": "typing and kinetic type",
  "seconds": 1.474,
  "onsetS": 0.081,
  "peakS": 0.687,
  "lufs": -20.6,
  "volume": 1.35,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 3.93
   },
   {
    "sound": "ice cubes in a glass",
    "z": 3.54
   },
   {
    "sound": "lego bricks clicking",
    "z": 3.37
   }
  ]
 },
 {
  "id": "es-pro-typing-run-soft",
  "source": "earshot",
  "file": "earshot/pro-typing-run-soft.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / a scroll wheel tick. A whole typed run as one file (earshot pro_typing_run/soft)",
  "useFor": "typing and kinetic type",
  "seconds": 1.755,
  "onsetS": 0.093,
  "peakS": 0.53,
  "lufs": -19.0,
  "volume": 1.12,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 3.36
   },
   {
    "sound": "a scroll wheel tick",
    "z": 2.76
   },
   {
    "sound": "a fidget toy clicking",
    "z": 2.67
   }
  ]
 },
 {
  "id": "es-pro-typing-run-standard",
  "source": "earshot",
  "file": "earshot/pro-typing-run-standard.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / a scroll wheel tick. A whole typed run as one file (earshot pro_typing_run/standard)",
  "useFor": "typing and kinetic type",
  "seconds": 1.444,
  "onsetS": 0.093,
  "peakS": 0.977,
  "lufs": -22.6,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 4.32
   },
   {
    "sound": "a scroll wheel tick",
    "z": 3.47
   },
   {
    "sound": "lego bricks clicking",
    "z": 3.35
   }
  ]
 },
 {
  "id": "es-pro-typing-run-tick",
  "source": "earshot",
  "file": "earshot/pro-typing-run-tick.mp3",
  "category": "typing",
  "description": "Sounds most like a ratchet clicking / a scroll wheel tick. A whole typed run as one file (earshot pro_typing_run/tick)",
  "useFor": "typing and kinetic type",
  "seconds": 1.266,
  "onsetS": 0.081,
  "peakS": 0.95,
  "lufs": -23.4,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a ratchet clicking",
    "z": 4.24
   },
   {
    "sound": "a scroll wheel tick",
    "z": 3.06
   },
   {
    "sound": "lego bricks clicking",
    "z": 2.89
   }
  ]
 },
 {
  "id": "es-pro-whoosh-big-gritty",
  "source": "earshot",
  "file": "earshot/pro-whoosh-big-gritty.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. A designed low sub swell into a cut (earshot pro_whoosh_big/gritty)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.931,
  "onsetS": 0.046,
  "peakS": 0.336,
  "lufs": -17.2,
  "volume": 0.91,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.38
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.12
   },
   {
    "sound": "a kick drum",
    "z": 2.54
   }
  ]
 },
 {
  "id": "es-pro-whoosh-big-long",
  "source": "earshot",
  "file": "earshot/pro-whoosh-big-long.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. A designed low sub swell into a cut (earshot pro_whoosh_big/long)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.12,
  "onsetS": 0.046,
  "peakS": 0.516,
  "lufs": -14.7,
  "volume": 0.68,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.38
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.55
   },
   {
    "sound": "cloth whipping through the air",
    "z": 2.93
   }
  ]
 },
 {
  "id": "es-pro-whoosh-big-reverse",
  "source": "earshot",
  "file": "earshot/pro-whoosh-big-reverse.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. A designed low sub swell into a cut (earshot pro_whoosh_big/reverse)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.055,
  "onsetS": 0.348,
  "peakS": 0.7,
  "lufs": -17.1,
  "volume": 0.9,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.48
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.67
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.13
   }
  ]
 },
 {
  "id": "es-pro-whoosh-big-swell",
  "source": "earshot",
  "file": "earshot/pro-whoosh-big-swell.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. A designed low sub swell into a cut (earshot pro_whoosh_big/swell)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.805,
  "onsetS": 0.081,
  "peakS": 0.357,
  "lufs": -15.2,
  "volume": 0.72,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.73
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.71
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.35
   }
  ]
 },
 {
  "id": "es-pro-whoosh-big-tonal",
  "source": "earshot",
  "file": "earshot/pro-whoosh-big-tonal.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. A designed low sub swell into a cut (earshot pro_whoosh_big/tonal)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.806,
  "onsetS": 0.081,
  "peakS": 0.347,
  "lufs": -15.6,
  "volume": 0.76,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.5
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.4
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.23
   }
  ]
 },
 {
  "id": "es-pro-whoosh-big-windy",
  "source": "earshot",
  "file": "earshot/pro-whoosh-big-windy.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. A designed low sub swell into a cut (earshot pro_whoosh_big/windy)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.77,
  "onsetS": 0.07,
  "peakS": 0.288,
  "lufs": -16.4,
  "volume": 0.83,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.7
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.09
   },
   {
    "sound": "cloth whipping through the air",
    "z": 3.04
   }
  ]
 },
 {
  "id": "es-pro-zip-down",
  "source": "earshot",
  "file": "earshot/pro-zip-down.mp3",
  "category": "swoosh",
  "description": "Sounds most like an error buzz. Tonal sweeps across a cut (up / arc members rise in pitch) (earshot pro_zip/down)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.287,
  "onsetS": 0.046,
  "peakS": 0.057,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "an error buzz",
    "z": 2.59
   },
   {
    "sound": "a balloon squeak",
    "z": 2.42
   },
   {
    "sound": "a digital glitch",
    "z": 2.14
   }
  ]
 },
 {
  "id": "es-pro-zip-down-warm",
  "source": "earshot",
  "file": "earshot/pro-zip-down-warm.mp3",
  "category": "swoosh",
  "description": "Tonal sweeps across a cut (up / arc members rise in pitch) (earshot pro_zip/down_warm)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.372,
  "onsetS": 0.046,
  "peakS": 0.034,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "an error buzz",
    "z": 2.49
   },
   {
    "sound": "a balloon squeak",
    "z": 2.41
   },
   {
    "sound": "a cat meowing",
    "z": 2.13
   }
  ]
 },
 {
  "id": "es-reverse-swell-breath",
  "source": "earshot",
  "file": "earshot/reverse-swell-breath.mp3",
  "category": "riser",
  "description": "Sounds most like a fast whoosh / a swoosh passing by. A mid-band reverse breath, half wide (1.3 kHz) (earshot reverse_swell/breath)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.235,
  "onsetS": 0.046,
  "peakS": 0.729,
  "lufs": -16.8,
  "volume": 0.87,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.34
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.32
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.23
   }
  ]
 },
 {
  "id": "es-reverse-swell-cymbal",
  "source": "earshot",
  "file": "earshot/reverse-swell-cymbal.mp3",
  "category": "riser",
  "description": "Sounds most like a record scratch / coins dropping. A bright wide reverse cymbal: a plateau after the peak, then a stop (earshot reverse_swell/cymbal)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 0.895,
  "onsetS": 0.046,
  "peakS": 0.521,
  "lufs": -15.5,
  "volume": 0.75,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 2.9
   },
   {
    "sound": "coins dropping",
    "z": 2.78
   },
   {
    "sound": "dominoes falling",
    "z": 2.52
   }
  ]
 },
 {
  "id": "es-reverse-swell-dark",
  "source": "earshot",
  "file": "earshot/reverse-swell-dark.mp3",
  "category": "riser",
  "description": "Sounds most like a fast whoosh / a swoosh passing by. A darker, near-mono reverse swell with a low body (earshot reverse_swell/dark)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 0.919,
  "onsetS": 0.046,
  "peakS": 0.572,
  "lufs": -16.2,
  "volume": 0.81,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.78
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.39
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 3.25
   }
  ]
 },
 {
  "id": "es-reverse-swell-ring",
  "source": "earshot",
  "file": "earshot/reverse-swell-ring.mp3",
  "category": "riser",
  "description": "Sounds most like a metal scrape / a reverse cymbal swell. A reverse cymbal that swells harder and rings out (earshot reverse_swell/ring)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.68,
  "onsetS": 0.046,
  "peakS": 0.617,
  "lufs": -18.6,
  "volume": 1.07,
  "recorded": false,
  "readings": [
   {
    "sound": "a metal scrape",
    "z": 2.84
   },
   {
    "sound": "a reverse cymbal swell",
    "z": 2.7
   },
   {
    "sound": "a stutter glitch transition",
    "z": 2.51
   }
  ]
 },
 {
  "id": "es-reverse-swell-short",
  "source": "earshot",
  "file": "earshot/reverse-swell-short.mp3",
  "category": "riser",
  "description": "Sounds most like dominoes falling / coins dropping. A short bright reverse cymbal for a quick cut (0.33 s to the peak) (earshot reverse_swell/short)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 0.651,
  "onsetS": 0.046,
  "peakS": 0.332,
  "lufs": -19.6,
  "volume": 1.2,
  "recorded": false,
  "readings": [
   {
    "sound": "dominoes falling",
    "z": 3.36
   },
   {
    "sound": "coins dropping",
    "z": 3.33
   },
   {
    "sound": "a snare hit",
    "z": 2.84
   }
  ]
 },
 {
  "id": "es-riser-air",
  "source": "earshot",
  "file": "earshot/riser-air.mp3",
  "category": "riser",
  "description": "Sounds most like a reverse cymbal swell / a downlifter falling sweep. A build into a reveal; it stops on its loudest sample (earshot riser/air)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 2.4,
  "onsetS": 0.046,
  "peakS": 2.384,
  "lufs": -12.0,
  "volume": 0.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a reverse cymbal swell",
    "z": 3.81
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 3.57
   },
   {
    "sound": "an uplifter sweep",
    "z": 3.25
   }
  ]
 },
 {
  "id": "es-riser-build",
  "source": "earshot",
  "file": "earshot/riser-build.mp3",
  "category": "riser",
  "description": "Sounds most like an old typewriter / a spacebar press. A sub-heavy build with crackle and a speeding gate (1.1 s) (earshot riser/build)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.758,
  "onsetS": 0.313,
  "peakS": 1.213,
  "lufs": -18.4,
  "volume": 1.05,
  "recorded": false,
  "readings": [
   {
    "sound": "an old typewriter",
    "z": 2.77
   },
   {
    "sound": "a spacebar press",
    "z": 2.55
   },
   {
    "sound": "a fast whoosh",
    "z": 2.37
   }
  ]
 },
 {
  "id": "es-riser-dark",
  "source": "earshot",
  "file": "earshot/riser-dark.mp3",
  "category": "riser",
  "description": "Sounds most like a fast whoosh / cloth whipping through the air. A short dark riser (noise, sub, a speeding stutter), no synth sweep (earshot riser/dark)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 0.951,
  "onsetS": 0.046,
  "peakS": 0.694,
  "lufs": -18.8,
  "volume": 1.1,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.33
   },
   {
    "sound": "cloth whipping through the air",
    "z": 3.25
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.07
   }
  ]
 },
 {
  "id": "es-riser-rush",
  "source": "earshot",
  "file": "earshot/riser-rush.mp3",
  "category": "riser",
  "description": "Sounds most like a reverse cymbal swell / a downlifter falling sweep. A build into a reveal; it stops on its loudest sample (earshot riser/rush)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 1.756,
  "onsetS": 0.046,
  "peakS": 1.744,
  "lufs": -17.4,
  "volume": 0.93,
  "recorded": false,
  "readings": [
   {
    "sound": "a reverse cymbal swell",
    "z": 3.59
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 3.31
   },
   {
    "sound": "a fast whoosh",
    "z": 3.0
   }
  ]
 },
 {
  "id": "es-riser-shepard",
  "source": "earshot",
  "file": "earshot/riser-shepard.mp3",
  "category": "riser",
  "description": "Sounds most like a downlifter falling sweep / an uplifter sweep. A build into a reveal; it stops on its loudest sample (earshot riser/shepard)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 3.708,
  "onsetS": 0.046,
  "peakS": 3.655,
  "lufs": -12.3,
  "volume": 0.52,
  "recorded": false,
  "readings": [
   {
    "sound": "a downlifter falling sweep",
    "z": 3.91
   },
   {
    "sound": "an uplifter sweep",
    "z": 3.67
   },
   {
    "sound": "a reverse cymbal swell",
    "z": 3.41
   }
  ]
 },
 {
  "id": "es-riser-snatch",
  "source": "earshot",
  "file": "earshot/riser-snatch.mp3",
  "category": "riser",
  "description": "Sounds most like a fast whoosh / an enter key press. A half-second stutter snatch into a cut (earshot riser/snatch)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 0.635,
  "onsetS": 0.046,
  "peakS": 0.387,
  "lufs": -12.6,
  "volume": 0.54,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 2.94
   },
   {
    "sound": "an enter key press",
    "z": 2.53
   },
   {
    "sound": "a swoosh passing by",
    "z": 2.5
   }
  ]
 },
 {
  "id": "es-riser-swell",
  "source": "earshot",
  "file": "earshot/riser-swell.mp3",
  "category": "riser",
  "description": "Sounds most like a reverse cymbal swell / a cinematic hit with a long tail. A build into a reveal; it stops on its loudest sample (earshot riser/swell)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 2.2,
  "onsetS": 0.046,
  "peakS": 2.191,
  "lufs": -15.6,
  "volume": 0.76,
  "recorded": false,
  "readings": [
   {
    "sound": "a reverse cymbal swell",
    "z": 4.64
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.89
   },
   {
    "sound": "a metal scrape",
    "z": 2.62
   }
  ]
 },
 {
  "id": "es-riser-tension",
  "source": "earshot",
  "file": "earshot/riser-tension.mp3",
  "category": "riser",
  "description": "Sounds most like a downlifter falling sweep / a reverse cymbal swell. A build into a reveal; it stops on its loudest sample (earshot riser/tension)",
  "useFor": "builds into a reveal or cut; downlifters after a hit",
  "seconds": 2.8,
  "onsetS": 0.046,
  "peakS": 2.768,
  "lufs": -11.4,
  "volume": 0.47,
  "recorded": false,
  "readings": [
   {
    "sound": "a downlifter falling sweep",
    "z": 3.5
   },
   {
    "sound": "a reverse cymbal swell",
    "z": 3.46
   },
   {
    "sound": "a rising riser building tension",
    "z": 3.11
   }
  ]
 },
 {
  "id": "es-shimmer-m0",
  "source": "earshot",
  "file": "earshot/shimmer-m0.mp3",
  "category": "shimmer",
  "description": "Sounds most like a magic sparkle chime / a success chime. Chimes ringing out (end-card sparkle) (earshot shimmer/m0)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 4.2,
  "onsetS": 0.07,
  "peakS": 0.744,
  "lufs": -9.6,
  "volume": 0.38,
  "recorded": false,
  "readings": [
   {
    "sound": "a magic sparkle chime",
    "z": 4.31
   },
   {
    "sound": "a success chime",
    "z": 4.11
   },
   {
    "sound": "a glissando on bar chimes",
    "z": 3.65
   }
  ]
 },
 {
  "id": "es-shimmer-m1",
  "source": "earshot",
  "file": "earshot/shimmer-m1.mp3",
  "category": "shimmer",
  "description": "Sounds most like a magic sparkle chime / a success chime. Chimes ringing out (end-card sparkle) (earshot shimmer/m1)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 4.0,
  "onsetS": 0.046,
  "peakS": 0.513,
  "lufs": -10.5,
  "volume": 0.42,
  "recorded": false,
  "readings": [
   {
    "sound": "a magic sparkle chime",
    "z": 4.04
   },
   {
    "sound": "a success chime",
    "z": 3.99
   },
   {
    "sound": "a glockenspiel run",
    "z": 3.48
   }
  ]
 },
 {
  "id": "es-shimmer-m2",
  "source": "earshot",
  "file": "earshot/shimmer-m2.mp3",
  "category": "shimmer",
  "description": "Sounds most like a magic sparkle chime / a glockenspiel run. Chimes ringing out (end-card sparkle) (earshot shimmer/m2)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 4.2,
  "onsetS": 0.046,
  "peakS": 0.032,
  "lufs": -16.9,
  "volume": 0.88,
  "recorded": false,
  "readings": [
   {
    "sound": "a magic sparkle chime",
    "z": 4.28
   },
   {
    "sound": "a glockenspiel run",
    "z": 3.73
   },
   {
    "sound": "a success chime",
    "z": 3.38
   }
  ]
 },
 {
  "id": "es-shimmer-m3",
  "source": "earshot",
  "file": "earshot/shimmer-m3.mp3",
  "category": "shimmer",
  "description": "Sounds most like a success chime / a magic sparkle chime. Chimes ringing out (end-card sparkle) (earshot shimmer/m3)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 3.6,
  "onsetS": 0.081,
  "peakS": 0.612,
  "lufs": -11.0,
  "volume": 0.45,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 4.27
   },
   {
    "sound": "a magic sparkle chime",
    "z": 4.24
   },
   {
    "sound": "a glissando on bar chimes",
    "z": 3.4
   }
  ]
 },
 {
  "id": "es-shimmer-m4",
  "source": "earshot",
  "file": "earshot/shimmer-m4.mp3",
  "category": "shimmer",
  "description": "Sounds most like a magic sparkle chime / a glissando on bar chimes. Chimes ringing out (end-card sparkle) (earshot shimmer/m4)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 4.2,
  "onsetS": 0.046,
  "peakS": 0.788,
  "lufs": -14.1,
  "volume": 0.64,
  "recorded": false,
  "readings": [
   {
    "sound": "a magic sparkle chime",
    "z": 4.27
   },
   {
    "sound": "a glissando on bar chimes",
    "z": 4.0
   },
   {
    "sound": "a glockenspiel run",
    "z": 3.28
   }
  ]
 },
 {
  "id": "es-shimmer-m5",
  "source": "earshot",
  "file": "earshot/shimmer-m5.mp3",
  "category": "shimmer",
  "description": "Sounds most like a success chime / a magic sparkle chime. Chimes ringing out (end-card sparkle) (earshot shimmer/m5)",
  "useFor": "sparkle on an end card or a premium reveal",
  "seconds": 4.4,
  "onsetS": 0.07,
  "peakS": 0.681,
  "lufs": -9.5,
  "volume": 0.38,
  "recorded": false,
  "readings": [
   {
    "sound": "a success chime",
    "z": 4.26
   },
   {
    "sound": "a magic sparkle chime",
    "z": 3.76
   },
   {
    "sound": "a glockenspiel run",
    "z": 3.16
   }
  ]
 },
 {
  "id": "es-shutter-dslr",
  "source": "earshot",
  "file": "earshot/shutter-dslr.mp3",
  "category": "foley",
  "description": "Sounds most like a snare hit / a box lid closing. A camera shutter: latch, 39 ms of curtain travel, the landing on a 1.4 kHz box (earshot shutter/dslr)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.242,
  "onsetS": 0.046,
  "peakS": 0.044,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.81
   },
   {
    "sound": "a box lid closing",
    "z": 3.46
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.16
   }
  ]
 },
 {
  "id": "es-shutter-film",
  "source": "earshot",
  "file": "earshot/shutter-film.mp3",
  "category": "foley",
  "description": "Sounds most like a wooden block hit / a snare hit. A heavier film camera: a dark box after 95 ms of travel, the body's thump, a spring rattle (earshot shutter/film)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.284,
  "onsetS": 0.046,
  "peakS": 0.101,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 3.93
   },
   {
    "sound": "a snare hit",
    "z": 3.79
   },
   {
    "sound": "a box lid closing",
    "z": 2.37
   }
  ]
 },
 {
  "id": "es-shutter-mirror",
  "source": "earshot",
  "file": "earshot/shutter-mirror.mp3",
  "category": "foley",
  "description": "Sounds most like a box lid closing / a snare hit. A slower mirror-box shutter with an audible travel (earshot shutter/mirror)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.331,
  "onsetS": 0.046,
  "peakS": 0.07,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a box lid closing",
    "z": 3.49
   },
   {
    "sound": "a snare hit",
    "z": 3.29
   },
   {
    "sound": "a wooden block hit",
    "z": 3.04
   }
  ]
 },
 {
  "id": "es-shutter-quick",
  "source": "earshot",
  "file": "earshot/shutter-quick.mp3",
  "category": "foley",
  "description": "Sounds most like a wooden block hit / a snare hit. A quick double click: release and curtain 21 ms apart (earshot shutter/quick)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.16,
  "onsetS": 0.046,
  "peakS": 0.026,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 3.83
   },
   {
    "sound": "a snare hit",
    "z": 2.62
   },
   {
    "sound": "a box lid closing",
    "z": 2.36
   }
  ]
 },
 {
  "id": "es-shutter-snap",
  "source": "earshot",
  "file": "earshot/shutter-snap.mp3",
  "category": "foley",
  "description": "Sounds most like a snare hit / a can opening. A dry, bright 2 kHz snap-zoom shutter (earshot shutter/snap)",
  "useFor": "camera shutters, knocks, physical touches",
  "seconds": 0.137,
  "onsetS": 0.046,
  "peakS": 0.063,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.32
   },
   {
    "sound": "a can opening",
    "z": 3.06
   },
   {
    "sound": "a wooden block hit",
    "z": 2.69
   }
  ]
 },
 {
  "id": "es-sub-drop-808",
  "source": "earshot",
  "file": "earshot/sub-drop-808.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop / a kick drum. Weight under a hit, a music drop (earshot sub_drop/808)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 2.054,
  "onsetS": 0.046,
  "peakS": 0.048,
  "lufs": -15.5,
  "volume": 0.75,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 4.68
   },
   {
    "sound": "a kick drum",
    "z": 3.36
   },
   {
    "sound": "a big drum hit",
    "z": 3.19
   }
  ]
 },
 {
  "id": "es-sub-drop-gritty",
  "source": "earshot",
  "file": "earshot/sub-drop-gritty.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop / a big drum hit. Weight under a hit, a music drop (earshot sub_drop/gritty)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 2.15,
  "onsetS": 0.046,
  "peakS": 0.133,
  "lufs": -12.1,
  "volume": 0.51,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 4.53
   },
   {
    "sound": "a big drum hit",
    "z": 3.23
   },
   {
    "sound": "a deep cinematic boom",
    "z": 3.16
   }
  ]
 },
 {
  "id": "es-sub-drop-long",
  "source": "earshot",
  "file": "earshot/sub-drop-long.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop / a deep cinematic boom. Weight under a hit, a music drop (earshot sub_drop/long)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 2.088,
  "onsetS": 0.046,
  "peakS": 0.34,
  "lufs": -8.4,
  "volume": 0.33,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 4.94
   },
   {
    "sound": "a deep cinematic boom",
    "z": 2.96
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.65
   }
  ]
 },
 {
  "id": "es-sub-drop-pro",
  "source": "earshot",
  "file": "earshot/sub-drop-pro.mp3",
  "category": "impact",
  "description": "Sounds most like a sub bass drop / a deep cinematic whoosh. Weight under a hit, a music drop (earshot sub_drop/pro)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 2.097,
  "onsetS": 0.046,
  "peakS": 0.374,
  "lufs": -9.3,
  "volume": 0.37,
  "recorded": false,
  "readings": [
   {
    "sound": "a sub bass drop",
    "z": 3.77
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 2.88
   },
   {
    "sound": "a cinematic hit with a long tail",
    "z": 2.69
   }
  ]
 },
 {
  "id": "es-sub-drop-punch",
  "source": "earshot",
  "file": "earshot/sub-drop-punch.mp3",
  "category": "impact",
  "description": "Sounds most like a kick drum / a sub bass drop. Weight under a hit, a music drop (earshot sub_drop/punch)",
  "useFor": "title slams, reveals, logo hits, drops",
  "seconds": 1.004,
  "onsetS": 0.046,
  "peakS": 0.008,
  "lufs": -18.0,
  "volume": 1.0,
  "recorded": false,
  "readings": [
   {
    "sound": "a kick drum",
    "z": 3.97
   },
   {
    "sound": "a sub bass drop",
    "z": 3.03
   },
   {
    "sound": "a big drum hit",
    "z": 2.96
   }
  ]
 },
 {
  "id": "es-swipe-cloth",
  "source": "earshot",
  "file": "earshot/swipe-cloth.mp3",
  "category": "swoosh",
  "description": "Sounds most like a punchy impact hit / a fast whoosh. Card and panel swipes, page turns (cloth, paper) (earshot swipe/cloth)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.676,
  "onsetS": 0.046,
  "peakS": 0.175,
  "lufs": -17.0,
  "volume": 0.89,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.52
   },
   {
    "sound": "a fast whoosh",
    "z": 3.45
   },
   {
    "sound": "cloth whipping through the air",
    "z": 3.08
   }
  ]
 },
 {
  "id": "es-swipe-flick",
  "source": "earshot",
  "file": "earshot/swipe-flick.mp3",
  "category": "swoosh",
  "description": "Sounds most like a punchy impact hit / a body falling on the ground. Card and panel swipes, page turns (cloth, paper) (earshot swipe/flick)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.568,
  "onsetS": 0.046,
  "peakS": 0.13,
  "lufs": -19.2,
  "volume": 1.15,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.6
   },
   {
    "sound": "a body falling on the ground",
    "z": 2.92
   },
   {
    "sound": "a fast whoosh",
    "z": 2.86
   }
  ]
 },
 {
  "id": "es-swipe-glide",
  "source": "earshot",
  "file": "earshot/swipe-glide.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / cloth whipping through the air. Card and panel swipes, page turns (cloth, paper) (earshot swipe/glide)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.736,
  "onsetS": 0.046,
  "peakS": 0.257,
  "lufs": -16.1,
  "volume": 0.8,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.88
   },
   {
    "sound": "cloth whipping through the air",
    "z": 3.04
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.65
   }
  ]
 },
 {
  "id": "es-swipe-paper",
  "source": "earshot",
  "file": "earshot/swipe-paper.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / a punchy impact hit. Card and panel swipes, page turns (cloth, paper) (earshot swipe/paper)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.77,
  "onsetS": 0.046,
  "peakS": 0.142,
  "lufs": -19.7,
  "volume": 1.22,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.35
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.29
   },
   {
    "sound": "cloth whipping through the air",
    "z": 3.19
   }
  ]
 },
 {
  "id": "es-swipe-velvet",
  "source": "earshot",
  "file": "earshot/swipe-velvet.mp3",
  "category": "swoosh",
  "description": "Sounds most like a punchy impact hit / a heavy thud. Card and panel swipes, page turns (cloth, paper) (earshot swipe/velvet)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 1.15,
  "onsetS": 0.046,
  "peakS": 0.261,
  "lufs": -17.3,
  "volume": 0.92,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.66
   },
   {
    "sound": "a heavy thud",
    "z": 3.14
   },
   {
    "sound": "a kick drum",
    "z": 2.94
   }
  ]
 },
 {
  "id": "es-swish-blade",
  "source": "earshot",
  "file": "earshot/swish-blade.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / a stick swung fast through the air. Thin quick flicks, text slides, small UI moves (earshot swish/blade)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.369,
  "onsetS": 0.046,
  "peakS": 0.062,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.22
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.61
   },
   {
    "sound": "a whip pan transition",
    "z": 3.18
   }
  ]
 },
 {
  "id": "es-swish-bright",
  "source": "earshot",
  "file": "earshot/swish-bright.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / a quick swipe. A bright (~2.4 kHz) quick swish (earshot swish/bright)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.345,
  "onsetS": 0.046,
  "peakS": 0.153,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.6
   },
   {
    "sound": "a quick swipe",
    "z": 3.5
   },
   {
    "sound": "a whip pan transition",
    "z": 3.11
   }
  ]
 },
 {
  "id": "es-swish-cane",
  "source": "earshot",
  "file": "earshot/swish-cane.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / a stick swung fast through the air. Thin quick flicks, text slides, small UI moves (earshot swish/cane)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.7,
  "onsetS": 0.046,
  "peakS": 0.089,
  "lufs": -20.0,
  "volume": 1.26,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.96
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.57
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.35
   }
  ]
 },
 {
  "id": "es-swish-flick",
  "source": "earshot",
  "file": "earshot/swish-flick.mp3",
  "category": "swoosh",
  "description": "Sounds most like a box lid closing / a plastic case snapping shut. A high flick that rises and stops dead, wide (earshot swish/flick)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.32,
  "onsetS": 0.07,
  "peakS": 0.112,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a box lid closing",
    "z": 3.56
   },
   {
    "sound": "a plastic case snapping shut",
    "z": 2.85
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.61
   }
  ]
 },
 {
  "id": "es-swish-soft",
  "source": "earshot",
  "file": "earshot/swish-soft.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / a snare hit. Thin quick flicks, text slides, small UI moves (earshot swish/soft)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.883,
  "onsetS": 0.046,
  "peakS": 0.107,
  "lufs": -22.0,
  "volume": 1.5,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.53
   },
   {
    "sound": "a snare hit",
    "z": 2.81
   },
   {
    "sound": "a kick drum",
    "z": 2.72
   }
  ]
 },
 {
  "id": "es-swish-stick",
  "source": "earshot",
  "file": "earshot/swish-stick.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / a stick swung fast through the air. Thin quick flicks, text slides, small UI moves (earshot swish/stick)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.527,
  "onsetS": 0.046,
  "peakS": 0.094,
  "lufs": -20.1,
  "volume": 1.27,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 5.04
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.67
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.35
   }
  ]
 },
 {
  "id": "es-swish-zing",
  "source": "earshot",
  "file": "earshot/swish-zing.mp3",
  "category": "swoosh",
  "description": "Sounds most like a fast whoosh / a whip pan transition. Thin quick flicks, text slides, small UI moves (earshot swish/zing)",
  "useFor": "small moves: cards, panels, text sliding, swipes",
  "seconds": 0.535,
  "onsetS": 0.046,
  "peakS": 0.068,
  "lufs": -18.2,
  "volume": 1.02,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.3
   },
   {
    "sound": "a whip pan transition",
    "z": 3.01
   },
   {
    "sound": "a short swish",
    "z": 2.94
   }
  ]
 },
 {
  "id": "es-tap-finger",
  "source": "earshot",
  "file": "earshot/tap-finger.mp3",
  "category": "click",
  "description": "Sounds most like a punchy impact hit / a kick drum. Screen taps and light touches on a surface (earshot tap/finger)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.121,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 4.33
   },
   {
    "sound": "a kick drum",
    "z": 3.71
   },
   {
    "sound": "a heavy thud",
    "z": 2.54
   }
  ]
 },
 {
  "id": "es-tap-glass",
  "source": "earshot",
  "file": "earshot/tap-glass.mp3",
  "category": "click",
  "description": "Sounds most like a punchy impact hit / a kick drum. Screen taps and light touches on a surface (earshot tap/glass)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.152,
  "onsetS": 0.046,
  "peakS": 0.001,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 4.17
   },
   {
    "sound": "a kick drum",
    "z": 3.91
   },
   {
    "sound": "a wooden block hit",
    "z": 3.5
   }
  ]
 },
 {
  "id": "es-tap-knuckle",
  "source": "earshot",
  "file": "earshot/tap-knuckle.mp3",
  "category": "click",
  "description": "Sounds most like a punchy impact hit / a kick drum. Screen taps and light touches on a surface (earshot tap/knuckle)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.152,
  "onsetS": 0.046,
  "peakS": 0.006,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 3.82
   },
   {
    "sound": "a kick drum",
    "z": 3.6
   },
   {
    "sound": "a snare hit",
    "z": 2.83
   }
  ]
 },
 {
  "id": "es-tap-soft",
  "source": "earshot",
  "file": "earshot/tap-soft.mp3",
  "category": "click",
  "description": "Sounds most like a punchy impact hit / a kick drum. Screen taps and light touches on a surface (earshot tap/soft)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.13,
  "onsetS": 0.046,
  "peakS": 0.002,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 4.89
   },
   {
    "sound": "a kick drum",
    "z": 4.09
   },
   {
    "sound": "a heavy thud",
    "z": 2.78
   }
  ]
 },
 {
  "id": "es-tap-table",
  "source": "earshot",
  "file": "earshot/tap-table.mp3",
  "category": "click",
  "description": "Sounds most like a punchy impact hit / a kick drum. Screen taps and light touches on a surface (earshot tap/table)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.135,
  "onsetS": 0.046,
  "peakS": 0.003,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a punchy impact hit",
    "z": 4.26
   },
   {
    "sound": "a kick drum",
    "z": 3.96
   },
   {
    "sound": "a snare hit",
    "z": 3.48
   }
  ]
 },
 {
  "id": "es-toggle-latch",
  "source": "earshot",
  "file": "earshot/toggle-latch.mp3",
  "category": "click",
  "description": "Sounds most like a quick swipe / a snare hit. Switches, settings toggles, lock-ins (press + latch) (earshot toggle/latch)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.217,
  "onsetS": 0.081,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a quick swipe",
    "z": 2.7
   },
   {
    "sound": "a snare hit",
    "z": 2.62
   },
   {
    "sound": "a camera shutter click",
    "z": 2.37
   }
  ]
 },
 {
  "id": "es-toggle-micro",
  "source": "earshot",
  "file": "earshot/toggle-micro.mp3",
  "category": "click",
  "description": "Sounds most like a single mechanical keyboard key press / a scroll wheel tick. Switches, settings toggles, lock-ins (press + latch) (earshot toggle/micro)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.123,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.91
   },
   {
    "sound": "a scroll wheel tick",
    "z": 2.84
   },
   {
    "sound": "a ratchet clicking",
    "z": 2.65
   }
  ]
 },
 {
  "id": "es-toggle-off",
  "source": "earshot",
  "file": "earshot/toggle-off.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a camera shutter click. Switches, settings toggles, lock-ins (press + latch) (earshot toggle/off)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.136,
  "onsetS": 0.07,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.05
   },
   {
    "sound": "a camera shutter click",
    "z": 2.62
   },
   {
    "sound": "a single mechanical keyboard key press",
    "z": 2.5
   }
  ]
 },
 {
  "id": "es-toggle-on",
  "source": "earshot",
  "file": "earshot/toggle-on.mp3",
  "category": "click",
  "description": "Sounds most like a snare hit / a crisp interface click. Switches, settings toggles, lock-ins (press + latch) (earshot toggle/on)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.167,
  "onsetS": 0.046,
  "peakS": 0.0,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 2.74
   },
   {
    "sound": "a crisp interface click",
    "z": 2.58
   },
   {
    "sound": "a toggle switch click",
    "z": 2.45
   }
  ]
 },
 {
  "id": "es-toggle-rocker",
  "source": "earshot",
  "file": "earshot/toggle-rocker.mp3",
  "category": "click",
  "description": "Sounds most like a box lid closing / a crisp interface click. Switches, settings toggles, lock-ins (press + latch) (earshot toggle/rocker)",
  "useFor": "cursor clicks, button presses, toggles, taps",
  "seconds": 0.235,
  "onsetS": 0.081,
  "peakS": 0.085,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a box lid closing",
    "z": 2.74
   },
   {
    "sound": "a crisp interface click",
    "z": 2.67
   },
   {
    "sound": "a snare hit",
    "z": 2.58
   }
  ]
 },
 {
  "id": "es-typing-key-clicky",
  "source": "earshot",
  "file": "earshot/typing-key-clicky.mp3",
  "category": "typing",
  "description": "Sounds most like a single mechanical keyboard key press / a soft key release click. Realistic mechanical keys, one take per character (earshot typing_key/clicky)",
  "useFor": "typing and kinetic type",
  "seconds": 0.194,
  "onsetS": 0.046,
  "peakS": 0.024,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a single mechanical keyboard key press",
    "z": 3.33
   },
   {
    "sound": "a soft key release click",
    "z": 3.21
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.76
   }
  ]
 },
 {
  "id": "es-typing-key-crisp",
  "source": "earshot",
  "file": "earshot/typing-key-crisp.mp3",
  "category": "typing",
  "description": "Sounds most like a single mechanical keyboard key press / a soft key release click. Realistic mechanical keys, one take per character (earshot typing_key/crisp)",
  "useFor": "typing and kinetic type",
  "seconds": 0.223,
  "onsetS": 0.046,
  "peakS": 0.014,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a single mechanical keyboard key press",
    "z": 4.41
   },
   {
    "sound": "a soft key release click",
    "z": 3.47
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.8
   }
  ]
 },
 {
  "id": "es-typing-key-deep",
  "source": "earshot",
  "file": "earshot/typing-key-deep.mp3",
  "category": "typing",
  "description": "Sounds most like a single mechanical keyboard key press / ice cubes in a glass. Realistic mechanical keys, one take per character (earshot typing_key/deep)",
  "useFor": "typing and kinetic type",
  "seconds": 0.319,
  "onsetS": 0.046,
  "peakS": 0.015,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a single mechanical keyboard key press",
    "z": 3.67
   },
   {
    "sound": "ice cubes in a glass",
    "z": 3.14
   },
   {
    "sound": "a scroll wheel tick",
    "z": 2.99
   }
  ]
 },
 {
  "id": "es-typing-key-thock",
  "source": "earshot",
  "file": "earshot/typing-key-thock.mp3",
  "category": "typing",
  "description": "Sounds most like a single mechanical keyboard key press / a soft key release click. Realistic mechanical keys, one take per character (earshot typing_key/thock)",
  "useFor": "typing and kinetic type",
  "seconds": 0.337,
  "onsetS": 0.046,
  "peakS": 0.015,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a single mechanical keyboard key press",
    "z": 5.67
   },
   {
    "sound": "a soft key release click",
    "z": 3.76
   },
   {
    "sound": "an enter key press",
    "z": 3.62
   }
  ]
 },
 {
  "id": "es-ui-pop-blip",
  "source": "earshot",
  "file": "earshot/ui-pop-blip.mp3",
  "category": "pop",
  "description": "Sounds most like a wooden block hit / a snare hit. A bright 890 Hz blip, fully decorrelated (L / R correlation ~0.1) (earshot ui_pop/blip)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.118,
  "onsetS": 0.046,
  "peakS": 0.018,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a wooden block hit",
    "z": 3.01
   },
   {
    "sound": "a snare hit",
    "z": 2.58
   },
   {
    "sound": "an error buzz",
    "z": 2.56
   }
  ]
 },
 {
  "id": "es-ui-pop-boop",
  "source": "earshot",
  "file": "earshot/ui-pop-boop.mp3",
  "category": "pop",
  "description": "Sounds most like a fast whoosh / a cork pop. A rounder boop falling 9 st (earshot ui_pop/boop)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.195,
  "onsetS": 0.046,
  "peakS": 0.027,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 2.95
   },
   {
    "sound": "a cork pop",
    "z": 2.81
   },
   {
    "sound": "a balloon squeak",
    "z": 2.76
   }
  ]
 },
 {
  "id": "es-ui-pop-fall",
  "source": "earshot",
  "file": "earshot/ui-pop-fall.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit / a punchy impact hit. An eased 7 st fall with a faint second pop (earshot ui_pop/fall)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.204,
  "onsetS": 0.046,
  "peakS": 0.023,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 2.92
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.61
   },
   {
    "sound": "a kick drum",
    "z": 2.29
   }
  ]
 },
 {
  "id": "es-ui-pop-soft",
  "source": "earshot",
  "file": "earshot/ui-pop-soft.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit / an error buzz. A soft rounded mid pop: 550 Hz, 22 ms onset, t20 75 ms (earshot ui_pop/soft)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.18,
  "onsetS": 0.046,
  "peakS": 0.027,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.2
   },
   {
    "sound": "an error buzz",
    "z": 3.17
   },
   {
    "sound": "a digital glitch",
    "z": 2.25
   }
  ]
 },
 {
  "id": "es-ui-pop-step",
  "source": "earshot",
  "file": "earshot/ui-pop-step.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit / an error buzz. The soft pop a step higher, falling 3 st (earshot ui_pop/step)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.187,
  "onsetS": 0.046,
  "peakS": 0.046,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.51
   },
   {
    "sound": "an error buzz",
    "z": 2.87
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.47
   }
  ]
 },
 {
  "id": "es-ui-pop-wide",
  "source": "earshot",
  "file": "earshot/ui-pop-wide.mp3",
  "category": "pop",
  "description": "Sounds most like a snare hit / a cork pop. A wide 620 Hz pop with a lip click (correlation ~0.5) (earshot ui_pop/wide)",
  "useFor": "elements, icons, badges and words popping in",
  "seconds": 0.19,
  "onsetS": 0.046,
  "peakS": 0.043,
  "lufs": null,
  "volume": 0.6,
  "recorded": false,
  "readings": [
   {
    "sound": "a snare hit",
    "z": 3.62
   },
   {
    "sound": "a cork pop",
    "z": 2.52
   },
   {
    "sound": "a wooden block hit",
    "z": 2.29
   }
  ]
 },
 {
  "id": "es-whoosh-big-cape",
  "source": "earshot",
  "file": "earshot/whoosh-big-cape.mp3",
  "category": "whoosh",
  "description": "Sounds most like a big drum hit / a body falling on the ground. Big scene transitions, large objects passing (earshot whoosh_big/cape)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.327,
  "onsetS": 0.046,
  "peakS": 0.457,
  "lufs": -16.7,
  "volume": 0.86,
  "recorded": false,
  "readings": [
   {
    "sound": "a big drum hit",
    "z": 3.18
   },
   {
    "sound": "a body falling on the ground",
    "z": 2.88
   },
   {
    "sound": "a heavy thud",
    "z": 2.87
   }
  ]
 },
 {
  "id": "es-whoosh-big-deep",
  "source": "earshot",
  "file": "earshot/whoosh-big-deep.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. Big scene transitions, large objects passing (earshot whoosh_big/deep)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 2.038,
  "onsetS": 0.046,
  "peakS": 0.735,
  "lufs": -17.4,
  "volume": 0.93,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.99
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.21
   },
   {
    "sound": "cloth whipping through the air",
    "z": 2.9
   }
  ]
 },
 {
  "id": "es-whoosh-big-gust",
  "source": "earshot",
  "file": "earshot/whoosh-big-gust.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / cloth whipping through the air. Big scene transitions, large objects passing (earshot whoosh_big/gust)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.886,
  "onsetS": 0.046,
  "peakS": 0.601,
  "lufs": -16.5,
  "volume": 0.84,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.43
   },
   {
    "sound": "cloth whipping through the air",
    "z": 3.26
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.04
   }
  ]
 },
 {
  "id": "es-whoosh-big-jet",
  "source": "earshot",
  "file": "earshot/whoosh-big-jet.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a swoosh passing by. Big scene transitions, large objects passing (earshot whoosh_big/jet)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.649,
  "onsetS": 0.046,
  "peakS": 0.555,
  "lufs": -14.6,
  "volume": 0.68,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 5.1
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.66
   },
   {
    "sound": "a short swish",
    "z": 3.01
   }
  ]
 },
 {
  "id": "es-whoosh-big-reverse",
  "source": "earshot",
  "file": "earshot/whoosh-big-reverse.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. Big scene transitions, large objects passing (earshot whoosh_big/reverse)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.505,
  "onsetS": 0.046,
  "peakS": 0.854,
  "lufs": -15.3,
  "volume": 0.73,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.44
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.09
   },
   {
    "sound": "a downlifter falling sweep",
    "z": 2.97
   }
  ]
 },
 {
  "id": "es-whoosh-big-swell",
  "source": "earshot",
  "file": "earshot/whoosh-big-swell.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a swoosh passing by. Big scene transitions, large objects passing (earshot whoosh_big/swell)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.355,
  "onsetS": 0.046,
  "peakS": 0.438,
  "lufs": -16.4,
  "volume": 0.83,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.63
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.43
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.37
   }
  ]
 },
 {
  "id": "es-whoosh-big-thump",
  "source": "earshot",
  "file": "earshot/whoosh-big-thump.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. A big low whoosh that lands with a thump (~80 ms in, rings ~0.35 s) (earshot whoosh_big/thump)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.03,
  "onsetS": 0.046,
  "peakS": 0.137,
  "lufs": -16.6,
  "volume": 0.85,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.09
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.1
   },
   {
    "sound": "cloth whipping through the air",
    "z": 3.0
   }
  ]
 },
 {
  "id": "es-whoosh-big-thump-airy",
  "source": "earshot",
  "file": "earshot/whoosh-big-thump-airy.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a stick swung fast through the air. The thump-whoosh, airier (earshot whoosh_big/thump_airy)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.915,
  "onsetS": 0.081,
  "peakS": 0.153,
  "lufs": -14.5,
  "volume": 0.67,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.29
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.05
   },
   {
    "sound": "a whip pan transition",
    "z": 2.96
   }
  ]
 },
 {
  "id": "es-whoosh-big-thump-deep",
  "source": "earshot",
  "file": "earshot/whoosh-big-thump-deep.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a deep cinematic whoosh. The thump-whoosh, deeper and longer (earshot whoosh_big/thump_deep)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.36,
  "onsetS": 0.046,
  "peakS": 0.254,
  "lufs": -14.1,
  "volume": 0.64,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.09
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.24
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.09
   }
  ]
 },
 {
  "id": "es-whoosh-fast-crisp",
  "source": "earshot",
  "file": "earshot/whoosh-fast-crisp.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a punchy impact hit. Whip pans, fast fly-ins, element moves (earshot whoosh_fast/crisp)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.057,
  "onsetS": 0.046,
  "peakS": 0.133,
  "lufs": -17.0,
  "volume": 0.89,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.08
   },
   {
    "sound": "a punchy impact hit",
    "z": 2.74
   },
   {
    "sound": "a swoosh passing by",
    "z": 2.7
   }
  ]
 },
 {
  "id": "es-whoosh-fast-heavy",
  "source": "earshot",
  "file": "earshot/whoosh-fast-heavy.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a swoosh passing by. Whip pans, fast fly-ins, element moves (earshot whoosh_fast/heavy)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.765,
  "onsetS": 0.046,
  "peakS": 0.134,
  "lufs": -18.5,
  "volume": 1.06,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.74
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.2
   },
   {
    "sound": "a deep cinematic whoosh",
    "z": 3.18
   }
  ]
 },
 {
  "id": "es-whoosh-fast-reverse",
  "source": "earshot",
  "file": "earshot/whoosh-fast-reverse.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a whip pan transition. Whip pans, fast fly-ins, element moves (earshot whoosh_fast/reverse)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.769,
  "onsetS": 0.046,
  "peakS": 0.298,
  "lufs": -17.7,
  "volume": 0.97,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.57
   },
   {
    "sound": "a whip pan transition",
    "z": 3.25
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.08
   }
  ]
 },
 {
  "id": "es-whoosh-fast-sleeve",
  "source": "earshot",
  "file": "earshot/whoosh-fast-sleeve.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a punchy impact hit. Whip pans, fast fly-ins, element moves (earshot whoosh_fast/sleeve)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 1.09,
  "onsetS": 0.046,
  "peakS": 0.156,
  "lufs": -20.6,
  "volume": 1.35,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 3.69
   },
   {
    "sound": "a punchy impact hit",
    "z": 3.24
   },
   {
    "sound": "an explosion",
    "z": 2.99
   }
  ]
 },
 {
  "id": "es-whoosh-fast-tight",
  "source": "earshot",
  "file": "earshot/whoosh-fast-tight.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a stick swung fast through the air. Whip pans, fast fly-ins, element moves (earshot whoosh_fast/tight)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.536,
  "onsetS": 0.046,
  "peakS": 0.161,
  "lufs": -17.0,
  "volume": 0.89,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.8
   },
   {
    "sound": "a stick swung fast through the air",
    "z": 3.29
   },
   {
    "sound": "a whip pan transition",
    "z": 3.05
   }
  ]
 },
 {
  "id": "es-whoosh-fast-whip",
  "source": "earshot",
  "file": "earshot/whoosh-fast-whip.mp3",
  "category": "whoosh",
  "description": "Sounds most like a record scratch / a snare hit. A designed bright whip: a wide ring that falls (earshot whoosh_fast/whip)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.91,
  "onsetS": 0.046,
  "peakS": 0.113,
  "lufs": -18.2,
  "volume": 1.02,
  "recorded": false,
  "readings": [
   {
    "sound": "a record scratch",
    "z": 2.97
   },
   {
    "sound": "a snare hit",
    "z": 2.54
   },
   {
    "sound": "an error buzz",
    "z": 2.53
   }
  ]
 },
 {
  "id": "es-whoosh-fast-whistle",
  "source": "earshot",
  "file": "earshot/whoosh-fast-whistle.mp3",
  "category": "whoosh",
  "description": "Sounds most like a fast whoosh / a swoosh passing by. Whip pans, fast fly-ins, element moves (earshot whoosh_fast/whistle)",
  "useFor": "camera moves, whip pans, scene transitions",
  "seconds": 0.997,
  "onsetS": 0.046,
  "peakS": 0.189,
  "lufs": -16.9,
  "volume": 0.88,
  "recorded": false,
  "readings": [
   {
    "sound": "a fast whoosh",
    "z": 4.84
   },
   {
    "sound": "a swoosh passing by",
    "z": 3.48
   },
   {
    "sound": "a short swish",
    "z": 3.09
   }
  ]
 }
];

/** Where the site serves a library sound. */
export const sfxUrl = (file: string) => `/sfx/${file.split("/").map(encodeURIComponent).join("/")}`;
