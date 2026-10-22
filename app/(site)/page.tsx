import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ComponentShowcase } from "@/components/site/ComponentShowcase";
import { CopyCommand } from "@/components/site/CopyCommand";
import { HeroStudio } from "@/components/site/HeroStudio";
import { StyleShowcase } from "@/components/site/StyleShowcase";
import { REPO_URL, STUDIO_COMMAND } from "@/lib/studio/commands";

const MARQUEE = [
  "Kinetic titles",
  "Lower thirds",
  "Word-by-word captions",
  "Voice-over",
  "Music on the beat",
  "Sound effects",
  "Stat counters",
  "Transitions",
  "16:9 and 9:16",
  "MP4 export in the browser",
];

const STEPS = [
  {
    time: "00:00",
    title: "Start the helper",
    body: "One command on your computer. It uses the Claude Code or Codex you already signed in to, and keeps your projects in a folder you own.",
    command: true,
  },
  {
    time: "00:05",
    title: "Say what you want",
    body: "Describe the video in the chat. The agent writes real Remotion scenes, places library components and lays out the timeline while the preview rebuilds live.",
  },
  {
    time: "00:20",
    title: "Tweak it and export",
    body: "Drag clips, change any prop in the inspector, or point at a frame and ask for a fix. Export an MP4 right in the browser, wide and mobile.",
  },
];

const LAYERS_SNIPPET = [
  ["{", ""],
  ['  "tracks": [', ""],
  ['    { "kind": "scene", "clips": [', ""],
  ['      { "component": ', '"text-reveal"', ', "from": 0, "duration": 90,'],
  ['        "props": { "lines": [', '"Say it."', ', "It *cuts* it."] } },'],
  ['      { "component": ', '"stat-counter"', ', "from": 90, "duration": 90,'],
  ['        "props": { "value": ', "49", ', "label": "components" } }'],
  ["    ] },", ""],
  ['    { "kind": "audio", "clips": [{ "src": ', '"assets/music.mp3"', " }] }"],
  ["  ]", ""],
  ["}", ""],
] as const;

const FACTS = [
  ["Your machine, your keys", "The page has no backend. The agent, your files and any API keys stay on your computer."],
  ["Real code, not a black box", "Every scene is a React component in your workspace. Open it in your editor any time."],
  ["Claude Code or Codex", "Use whichever you have, switch in the chat. Both get the same tools and skill."],
  ["Open source, MIT", "The studio, the helper and all 49 components. Fork it, extend it, ship it."],
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 md:px-8 md:pt-24">
          <p className="site-rise font-mono text-xs uppercase tracking-[0.22em] text-ink/50" style={{ ["--i" as string]: 0 }}>
            Open source · Claude Code + Codex · Remotion
          </p>
          <h1 className="mt-6 font-display text-[clamp(3.4rem,10vw,9.5rem)] font-extrabold leading-[0.86] tracking-[-0.055em]">
            <span className="site-rise inline-block" style={{ ["--i" as string]: 1 }}>
              Cut video
            </span>
            <br />
            <span className="site-rise inline-block" style={{ ["--i" as string]: 2 }}>
              by{" "}
            </span>{" "}
            <span className="site-rise inline-block" style={{ ["--i" as string]: 3 }}>
              <span className="site-cut">talking.</span>
            </span>
          </h1>
          <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <p className="site-rise max-w-xl text-lg leading-relaxed text-ink/65 md:text-xl" style={{ ["--i" as string]: 5 }}>
              Agentcut is a video studio you edit by chatting with your coding agent. It writes the scenes,
              places the motion graphics and syncs the music. You watch every layer land on the timeline and
              change anything by hand.
            </p>
            <div className="site-rise flex flex-wrap items-center gap-3" style={{ ["--i" as string]: 6 }}>
              <Link
                href="/studio"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-base font-semibold text-brand-foreground shadow-[0_10px_30px_-10px_var(--brand)] transition-transform hover:-translate-y-0.5"
              >
                Open the studio <ArrowUpRight className="size-4" />
              </Link>
              <CopyCommand command={STUDIO_COMMAND} />
            </div>
          </div>
          <div className="site-rise mt-16" style={{ ["--i" as string]: 7 }}>
            <HeroStudio />
          </div>
        </div>
      </section>

      {/* Capabilities band */}
      <section aria-label="What it can do" className="overflow-hidden border-y border-ink/10 bg-ink py-5 text-paper">
        <div className="site-marquee flex w-max gap-10 whitespace-nowrap font-display text-2xl font-bold tracking-tight md:text-3xl">
          {[...MARQUEE, ...MARQUEE].map((item, index) => (
            <span key={index} className="flex items-center gap-10" aria-hidden={index >= MARQUEE.length}>
              {item}
              <span className="text-brand">✂</span>
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <div className="site-reveal grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="md:sticky md:top-28 md:self-start">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">How it works</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] md:text-6xl">
              Three cuts to a finished video.
            </h2>
          </div>
          <ol className="divide-y divide-ink/10 border-y border-ink/10">
            {STEPS.map((step) => (
              <li key={step.time} className="grid gap-4 py-8 sm:grid-cols-[88px_minmax(0,1fr)]">
                <span className="font-mono text-sm tabular-nums text-ink/40">{step.time}</span>
                <div>
                  <h3 className="font-display text-2xl font-bold tracking-tight">{step.title}</h3>
                  <p className="mt-2 max-w-lg text-ink/60">{step.body}</p>
                  {"command" in step ? <CopyCommand command={STUDIO_COMMAND} className="mt-5" /> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Components */}
      <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8 md:pb-32">
        <div className="site-reveal">
          <ComponentShowcase />
        </div>
      </section>

      {/* Styles */}
      <section className="bg-ink py-24 text-paper md:py-32">
        <div className="site-reveal mx-auto max-w-7xl px-5 md:px-8">
          <StyleShowcase />
        </div>
      </section>

      {/* Real code */}
      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <div className="site-reveal grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Under the hood</p>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] md:text-6xl">
              The timeline is a file. The video is code.
            </h2>
            <dl className="mt-10 grid gap-8 sm:grid-cols-2">
              {FACTS.map(([title, body]) => (
                <div key={title}>
                  <dt className="font-display text-lg font-bold">{title}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-ink/60">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="-rotate-1 overflow-hidden rounded-3xl bg-ink text-paper shadow-[0_30px_60px_-25px_rgba(40,20,10,0.5)]">
            <figcaption className="flex items-center gap-2 border-b border-paper/10 px-5 py-3 font-mono text-xs text-paper/50">
              projects/launch-video/layers.json
            </figcaption>
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-7">
              {LAYERS_SNIPPET.map(([code, value, rest = ""], index) => (
                <div key={index}>
                  <span className="text-paper/70">{code}</span>
                  <span className="text-brand">{value}</span>
                  <span className="text-paper/70">{rest}</span>
                </div>
              ))}
            </pre>
          </figure>
        </div>
      </section>

      {/* Final call */}
      <section className="relative overflow-hidden border-t border-ink/10">
        <div className="mx-auto max-w-7xl px-5 py-28 md:px-8 md:py-40">
          <h2 className="site-reveal max-w-5xl font-display text-[clamp(3rem,8vw,7.5rem)] font-extrabold leading-[0.88] tracking-[-0.05em]">
            Your next video is <span className="site-cut">one message</span> away.
          </h2>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link
              href="/studio"
              className="inline-flex h-14 items-center gap-2 rounded-full bg-brand px-8 text-lg font-semibold text-brand-foreground shadow-[0_10px_30px_-10px_var(--brand)] transition-transform hover:-translate-y-0.5"
            >
              Open the studio <ArrowUpRight className="size-5" />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-14 items-center rounded-full border border-ink/15 px-8 text-lg font-semibold transition-colors hover:border-ink"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
