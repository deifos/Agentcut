"use client";

// The hero's demo video: a short launch spot cut entirely from library components, the same
// pieces the agent places in a real project.
import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import { MOTION_COMPONENTS, resolveComponentProps } from "@/motion/components";

const ACCENT = "#ff5a36";
const BACKDROP = "#14110f";

export interface ReelShot {
  id: string;
  /** Label on the hero's mini timeline. */
  label: string;
  durationInFrames: number;
  props: Record<string, unknown>;
}

export const REEL_SHOTS: ReelShot[] = [
  {
    id: "text-reveal",
    label: "Hook",
    durationInFrames: 90,
    props: { kicker: "Agentcut", lines: ["Say it.", "It *cuts* it."], accent: ACCENT },
  },
  {
    id: "prompt-box",
    label: "Prompt",
    durationInFrames: 110,
    props: { text: "Make a 20s launch video for my app", label: "you → agent", accent: ACCENT, theme: "dark" },
  },
  {
    id: "kinetic-punch",
    label: "Beats",
    durationInFrames: 80,
    props: { words: ["Write", "Render", "Ship"], accent: ACCENT, flashBackground: ACCENT, background: BACKDROP },
  },
  {
    id: "stat-counter",
    label: "Stat",
    durationInFrames: 90,
    props: { value: 49, suffix: "", label: "motion components", accent: ACCENT },
  },
  {
    id: "word-swap",
    label: "Agents",
    durationInFrames: 110,
    props: { prefix: "Edited by", words: ["Claude Code", "Codex", "you"], accent: ACCENT },
  },
  {
    id: "logo-sting",
    label: "End card",
    durationInFrames: 90,
    props: { name: "agentcut", tagline: "npx agentcut", accent: ACCENT, background: BACKDROP },
  },
];

export const REEL_FRAMES = REEL_SHOTS.reduce((sum, shot) => sum + shot.durationInFrames, 0);

function Shot({ shot }: { shot: ReelShot }) {
  const { width, height, fps } = useVideoConfig();
  const entry = MOTION_COMPONENTS[shot.id];
  if (!entry) return null;
  return (
    <entry.Component
      {...resolveComponentProps(shot.id, shot.props)}
      width={width}
      height={height}
      fps={fps}
      durationInFrames={shot.durationInFrames}
      variant={height > width ? "mobile" : "wide"}
    />
  );
}

export function ShowcaseReel() {
  return (
    <AbsoluteFill style={{ background: BACKDROP }}>
      <Series>
        {REEL_SHOTS.map((shot) => (
          <Series.Sequence key={shot.id} durationInFrames={shot.durationInFrames}>
            <Shot shot={shot} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}
