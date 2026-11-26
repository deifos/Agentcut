import Link from "next/link";
import { ArrowUpRight, Download, MessageSquare, Terminal } from "lucide-react";
import { ComponentShowcase } from "@/components/site/ComponentShowcase";
import { CopyCommand } from "@/components/site/CopyCommand";
import { FeatureGrid } from "@/components/site/FeatureGrid";
import { HeroDemo } from "@/components/site/HeroDemo";
import { PromptToCut } from "@/components/site/PromptToCut";
import { StyleShowcase } from "@/components/site/StyleShowcase";
import { COMPONENT_METAS } from "@/motion/components/catalog";
import { REPO_URL, STUDIO_COMMAND } from "@/lib/studio/commands";
import {
  pageMetadata,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/seo";

export const metadata = pageMetadata(SITE_TITLE, SITE_DESCRIPTION, "/");

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Agentcut",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#application`,
      name: "Agentcut",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      image: `${SITE_URL}/og/agentcut.jpg`,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Windows, macOS, Linux",
      license: "https://opensource.org/license/mit",
      sameAs: REPO_URL,
    },
  ],
};

const COMPONENT_COUNT = Object.keys(COMPONENT_METAS).length;

// Things people type, for the ticker under the hero.
const ASKS = [
  ["Add captions", "Make it shorter", "Cut it to the beat", "Remove the filler words", "Make a vertical version", "Add a lower third", "Zoom in on the product", "End on the logo"],
  ["Make the title huge", "Add a whoosh on every cut", "Restyle it as Punk", "Use my brand colors", "Add a voice-over", "Swap the music", "Tighten the intro", "Export it for Reels"],
];

const STEPS = [
  {
    time: "00:00",
    icon: Terminal,
    clip: "oklch(0.7 0.19 35)",
    title: "Start the helper",
    body: "One command on your computer. It uses the Claude Code or Codex you already signed in to, and keeps your projects in a folder you own.",
    command: true,
  },
  {
    time: "00:05",
    icon: MessageSquare,
    clip: "oklch(0.72 0.13 155)",
    title: "Say what you want",
    body: "Describe the video in the chat. The agent writes real Remotion scenes, places library components and lays out the timeline while the preview rebuilds live.",
  },
  {
    time: "00:20",
    icon: Download,
    clip: "oklch(0.72 0.12 250)",
    title: "Tweak it and export",
    body: "Drag clips, change any prop in the inspector, or point at a frame and ask for a fix. Export an MP4 right in the browser, wide and mobile.",
  },
];

const LAYERS_SNIPPET = [
  ["{", ""],
  ['  "tracks": [', ""],
  ['    { "kind": "scene", "clips": [', ""],
  ['      { "component": ', '"text-reveal"', ', "from": 0, "duration": 90,'],
  [
    '        "props": { "lines": [',
    '"Edit video"',
    ', "with a *prompt*."] } },',
  ],
  ['      { "component": ', '"stat-counter"', ', "from": 90, "duration": 90,'],
  [
    '        "props": { "value": ',
    String(COMPONENT_COUNT),
    ', "label": "components" } }',
  ],
  ["    ] },", ""],
  ['    { "kind": "audio", "clips": [{ "src": ', '"assets/music.mp3"', " }] }"],
  ["  ]", ""],
  ["}", ""],
] as const;

const FACTS = [
  [
    "Your machine, your keys",
    "The page has no backend. The agent, your files and any API keys stay on your computer.",
  ],
  [
    "Real code, not a black box",
    "Every scene is a React component in your workspace. Open it in your editor any time.",
  ],
  [
    "Claude Code or Codex",
    "Use whichever you have, switch in the chat. Both get the same tools and skill.",
  ],
  [
    "Open source, MIT",
    `The studio, the helper and all ${COMPONENT_COUNT} components. Fork it, extend it, ship it.`,
  ],
];

export default function LandingPage() {
  return (
    <main className="landing dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      {/* Hero */}
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-16 text-center md:px-8 md:pt-24">
          <p className="site-rise font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Open source · Claude Code + Codex · Remotion
          </p>
          <h1
            id="hero-title"
            className="site-rise landing-title mx-auto mt-6 max-w-4xl font-display"
            style={{ ["--i" as string]: 1 }}
          >
            Edit video with a <span className="text-brand">prompt.</span>
          </h1>
          <p
            className="site-rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink/65 md:text-xl"
            style={{ ["--i" as string]: 2 }}
          >
            Say what you want. Your coding agent cuts the clips, adds captions,
            graphics and music, and you export. Free, open source, and on your
            own computer.
          </p>
          <div
            className="site-rise mt-8 flex flex-wrap items-center justify-center gap-3"
            style={{ ["--i" as string]: 3 }}
          >
            <Link href="/studio" className="landing-cta">
              Open the studio <ArrowUpRight className="size-5" />
            </Link>
            <CopyCommand command={STUDIO_COMMAND} />
          </div>
          <p
            className="site-rise mx-auto mt-4 max-w-md text-sm text-ink/50"
            style={{ ["--i" as string]: 4 }}
          >
            Needs{" "}
            <a
              className="underline underline-offset-2 hover:text-ink"
              href="https://nodejs.org/en/download"
              target="_blank"
              rel="noreferrer"
            >
              Node.js LTS
            </a>{" "}
            (20.10 or newer). The command downloads and starts Agentcut.
          </p>
          <div
            className="site-rise mx-auto mt-12 max-w-6xl md:mt-16"
            style={{ ["--i" as string]: 5 }}
          >
            <HeroDemo />
          </div>
        </div>

        {/* Things you can say */}
        <div
          className="prompt-ticker space-y-3 overflow-hidden pb-20 pt-4 md:pb-28"
          aria-label="Examples of what you can ask for"
        >
          {ASKS.map((row, rowIndex) => (
            <ul
              key={rowIndex}
              className="site-marquee flex w-max gap-3"
              data-reverse={rowIndex === 1 ? "" : undefined}
            >
              {[...row, ...row].map((ask, index) => (
                <li
                  key={index}
                  aria-hidden={index >= row.length}
                  className="whitespace-nowrap rounded-full border border-ink/12 bg-ink/[0.04] px-5 py-2.5 text-[15px] font-medium text-ink/75"
                >
                  <span className="mr-2 text-brand">›</span>
                  {ask}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* Features */}
      <section
        className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28"
        aria-labelledby="features-title"
      >
        <div className="site-reveal flex flex-wrap items-end gap-x-8 gap-y-4">
          <span
            aria-hidden="true"
            className="landing-count font-display"
          >
            8
          </span>
          <div className="min-w-0 flex-1 basis-80 pb-1">
            <h2 id="features-title" className="landing-h2 max-w-2xl font-display">
              things you can just say.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-ink/60">
              Each one is an afternoon in a normal timeline. Here it is a
              sentence, and the result stays editable by hand.
            </p>
          </div>
        </div>
        <div className="site-reveal mt-12 md:mt-16">
          <FeatureGrid />
        </div>
      </section>

      {/* Prompt to timeline */}
      <section
        className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28"
        aria-labelledby="prompt-title"
      >
        <div className="site-reveal md:flex md:items-end md:justify-between md:gap-10">
          <h2 id="prompt-title" className="landing-h2 max-w-xl font-display">
            Ask. Look. <span className="text-brand">Ask again.</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-ink/60 md:mt-0">
            It is a conversation, not a render queue. Every reply lands as real
            layers on a real timeline, and a follow-up changes only what you
            point at.
          </p>
        </div>
        <div className="site-reveal mt-12 md:mt-16">
          <PromptToCut />
        </div>
      </section>

      {/* How it works */}
      <section
        className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28"
        aria-labelledby="steps-title"
      >
        <h2 id="steps-title" className="site-reveal landing-h2 max-w-2xl font-display">
          From zero to export in three clips.
        </h2>
        <div className="site-reveal mt-12 md:mt-16">
          <div className="steps-ruler hidden md:block" aria-hidden="true" />
          <ol className="grid gap-4 md:grid-cols-12 md:gap-x-3 md:gap-y-3 md:pt-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={
                  [
                    "md:col-span-5 md:col-start-1",
                    "md:col-span-6 md:col-start-3",
                    "md:col-span-7 md:col-start-6",
                  ][index]
                }
              >
                <div
                  className="step-clip"
                  style={{ ["--clip" as string]: step.clip }}
                >
                  <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-ink/55">
                    <step.icon
                      className="size-4"
                      style={{ color: step.clip }}
                    />
                    {step.time}
                    <span className="ml-auto">V{index + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-lg text-ink/65">{step.body}</p>
                  {"command" in step ? (
                    <CopyCommand command={STUDIO_COMMAND} className="mt-5" />
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Components */}
      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
        <div className="site-reveal">
          <ComponentShowcase />
        </div>
      </section>

      {/* Styles */}
      <section className="px-3 md:px-6">
        <div className="landing-panel overflow-hidden rounded-[32px] border border-paper/10 bg-ink py-20 text-paper md:py-28">
          <div className="site-reveal mx-auto max-w-7xl px-5 md:px-8">
            <StyleShowcase />
          </div>
        </div>
      </section>

      {/* Real code */}
      <section className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
        <div className="site-reveal grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
              Under the hood
            </p>
            <h2 className="landing-h2 mt-4 font-display">
              The timeline is a file. The video is code.
            </h2>
            <dl className="mt-10 grid gap-8 sm:grid-cols-2">
              {FACTS.map(([title, body]) => (
                <div key={title}>
                  <dt className="font-display text-lg font-bold">{title}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-ink/60">
                    {body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="feature-card overflow-hidden !p-0">
            <figcaption className="flex items-center gap-2 border-b border-ink/10 px-5 py-3 font-mono text-xs text-ink/50">
              projects/launch-video/layers.json
            </figcaption>
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-7">
              {LAYERS_SNIPPET.map(([code, value, rest = ""], index) => (
                <div key={index}>
                  <span className="text-ink/70">{code}</span>
                  <span className="text-brand">{value}</span>
                  <span className="text-ink/70">{rest}</span>
                </div>
              ))}
            </pre>
          </figure>
        </div>
      </section>

      {/* Final call */}
      <section className="landing-hero border-t border-ink/10">
        <div className="mx-auto max-w-7xl px-5 py-28 text-center md:px-8 md:py-40">
          <h2 className="site-reveal landing-title mx-auto max-w-4xl font-display">
            Your next video is <span className="text-brand">one message</span>{" "}
            away.
          </h2>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Link href="/studio" className="landing-cta">
              Open the studio <ArrowUpRight className="size-5" />
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center rounded-full border border-ink/20 px-6 text-[15px] font-semibold transition-colors hover:border-ink"
            >
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
