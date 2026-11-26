import Image from "next/image";
import {
  ArrowUp,
  AudioLines,
  Mic,
  Music,
  Scissors,
  Sparkles,
} from "lucide-react";
import { LoopVideo } from "@/components/site/LoopVideo";
import { COMPONENT_METAS } from "@/motion/components/catalog";
import { cn } from "@/lib/utils";

// Each feature is a small picture of itself, drawn with the page's own tokens.

const SHOT = (name: string) => `/landing/shot-${name}.jpg`;

function Shot({ name, className }: { name: string; className?: string }) {
  return (
    <Image
      src={SHOT(name)}
      alt=""
      fill
      sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
      className={className}
    />
  );
}

/** A steady, hand-shaped waveform: the same bars on the server and in the browser. */
const wave = (count: number, seed = 1) =>
  Array.from({ length: count }, (_, i) =>
    Math.round(
      18 + Math.abs(Math.sin(i * 1.7 * seed) * Math.cos(i * 0.37 + seed)) * 82,
    ),
  );

function Bars({
  heights,
  className,
  dim,
  live,
}: {
  heights: number[];
  className?: string;
  /** Bars inside this index range play quieter (music ducking under a voice). */
  dim?: [number, number];
  /** Bars bounce like a level meter. */
  live?: boolean;
}) {
  return (
    <div className={cn("flex h-full items-center gap-[2px]", className)}>
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn("w-full rounded-full bg-current", live && "landing-eq")}
          style={{
            height: `${dim && index >= dim[0] && index <= dim[1] ? height * 0.3 : height}%`,
            animationDelay: live ? `${-((index * 137) % 900)}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

const PHRASES = [
  ["No", "map."],
  ["No", "plan."],
  ["Just", "go."],
];

function CaptionsArt() {
  const words = PHRASES.flat();
  return (
    <>
      <LoopVideo
        src="/landing/clip-windshield.mp4"
        poster="/landing/clip-windshield.jpg"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
      {PHRASES.map(([first, second], index) => (
        <p
          key={index}
          className="landing-phrase absolute inset-x-0 bottom-[26%] text-center font-sans text-[clamp(2rem,4.4vw,3.75rem)] font-black tracking-tight text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.7)]"
          style={{ ["--i" as string]: index }}
        >
          {first} <span className="text-brand">{second}</span>
        </p>
      ))}
      {/* The word track: every word has its own start and end. */}
      <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/55 p-2.5 backdrop-blur">
        <div className="relative flex gap-1">
          {words.map((word, index) => (
            <span
              key={index}
              className="landing-track-word flex-1 truncate rounded-md px-1 py-1.5 text-center font-mono text-[10px] font-semibold"
              style={{ ["--i" as string]: index }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function BeatArt() {
  const heights = wave(44, 1.3);
  const clips = [
    { name: "aerial-sunset", span: 3 },
    { name: "windshield", span: 2 },
    { name: "golden-hour", span: 3 },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2.5 p-4">
      <div className="grid grid-cols-8 gap-1">
        {clips.map((clip) => (
          <div
            key={clip.name}
            className="landing-clip relative h-12 overflow-hidden rounded-md ring-1 ring-ink/15"
            style={{
              gridColumn: `span ${clip.span}`,
              ["--i" as string]: clips.indexOf(clip),
            }}
          >
            <Shot name={clip.name} />
          </div>
        ))}
      </div>
      <div className="relative h-14 rounded-md bg-ink/[0.06] px-1 text-ink/45">
        <Bars heights={heights} live />
        <span className="landing-sweep absolute inset-y-0 z-10 w-0.5 bg-ink shadow-[0_0_10px_var(--ink)]" />
        {/* A beat every eighth of the bar: the cuts above sit on beats 3 and 5. */}
        {Array.from({ length: 7 }, (_, index) => (
          <span
            key={index}
            className={cn(
              "absolute inset-y-0 w-px",
              index === 2 || index === 4 ? "bg-brand" : "bg-ink/15",
            )}
            style={{ left: `${((index + 1) / 8) * 100}%` }}
          />
        ))}
      </div>
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/50">
        <Music className="size-3 text-brand" /> 123 BPM · cuts on the beat
      </p>
    </div>
  );
}

function FillerArt() {
  const filler = (text: string, index: number) => (
    <span className="landing-filler" style={{ ["--i" as string]: index }}>
      {text}
    </span>
  );
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-3 p-5">
      <p className="text-[15px] font-medium leading-[1.9] text-ink/85">
        So {filler("um", 0)} we drove {filler("like", 1)} four hundred miles{" "}
        {filler("you know", 2)} before the sun came up.
      </p>
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/50">
        <Scissors className="size-3 text-brand" /> 3 cuts · 2.8s shorter
      </p>
    </div>
  );
}

function FormatsArt() {
  return (
    <>
      <Shot name="dusk-jump" className="opacity-45" />
      <div className="absolute inset-0 flex items-center justify-center gap-2.5">
        {[
          { label: "16:9", ratio: "16 / 9", height: "26%" },
          { label: "9:16", ratio: "9 / 16", height: "62%" },
          { label: "1:1", ratio: "1 / 1", height: "34%" },
          { label: "4:5", ratio: "4 / 5", height: "42%" },
        ].map((format, index) => (
          <span
            key={format.label}
            className="landing-format flex items-end justify-center rounded-lg border border-ink/30 bg-black/30 pb-1.5 font-mono text-[10px] font-semibold text-ink/70 backdrop-blur-[2px]"
            style={{
              aspectRatio: format.ratio,
              height: format.height,
              ["--i" as string]: index,
            }}
          >
            {format.label}
          </span>
        ))}
      </div>
    </>
  );
}

function StylesArt() {
  const looks = [
    {
      name: "Sketch",
      filter: "grayscale(1) contrast(1.5) brightness(1.1)",
      rotate: "-7deg",
      font: "font-serif italic",
    },
    {
      name: "PUNK",
      filter: "saturate(2.1) contrast(1.25) hue-rotate(-12deg)",
      rotate: "0deg",
      font: "font-display font-black",
    },
    {
      name: "film",
      filter: "sepia(0.75) saturate(1.2) brightness(0.95)",
      rotate: "7deg",
      font: "font-mono",
    },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {looks.map((look, index) => (
        <div
          key={look.name}
          className="landing-look relative -mx-3 aspect-[3/4] w-[36%] overflow-hidden rounded-xl ring-1 ring-ink/20 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.8)]"
          style={{ rotate: look.rotate, ["--i" as string]: index }}
        >
          <Shot name="golden-hour" />
          <div
            className="absolute inset-0"
            style={{ backdropFilter: look.filter }}
          />
          <span
            className={cn(
              "absolute inset-x-0 bottom-2 text-center text-sm text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]",
              look.font,
            )}
          >
            {look.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function DrawArt() {
  return (
    <>
      <Shot name="aerial-sunset" />
      <svg
        viewBox="0 0 400 300"
        className="absolute inset-0 size-full"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path
          className="landing-draw"
          style={{ ["--len" as string]: 420 }}
          d="M118 172c-8-34 22-58 62-58s70 20 66 54-36 52-72 50-50-20-56-46Z"
        />
        <path
          className="landing-draw"
          style={{ ["--len" as string]: 160 }}
          d="M318 88c-18 22-38 38-66 52m0 0 26-2m-26 2 8-24"
        />
      </svg>
    </>
  );
}

function GraphicsArt() {
  return (
    <>
      <Shot name="wheel-topdown" className="opacity-60" />
      <div className="landing-lower-third absolute left-4 top-4 border-l-[3px] border-brand bg-black/70 py-1.5 pl-2.5 pr-4 backdrop-blur">
        <p className="font-display text-base font-extrabold leading-tight text-ink">
          Day 3
        </p>
        <p className="text-[10px] text-ink/70">Past the last gas station</p>
      </div>
      <div className="landing-sticker absolute bottom-4 right-4 flex size-[92px] flex-col items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_10px_30px_-8px_var(--brand)]">
        <span
          className="landing-count-up font-display text-3xl font-black leading-none tracking-tight"
          aria-label="412"
        />
        <span className="text-[9px] font-bold uppercase tracking-wider">
          miles today
        </span>
      </div>
      <span className="absolute bottom-4 left-4 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink/70">
        <Sparkles className="size-3 text-brand" />{" "}
        {Object.keys(COMPONENT_METAS).length} components
      </span>
    </>
  );
}

function SoundArt() {
  const rows = [
    {
      icon: Mic,
      label: "Voice",
      tone: "text-ink/80",
      body: (
        <Bars
          heights={wave(30, 2.1)}
          live
          className="ml-[18%] w-[52%] text-ink/80"
        />
      ),
    },
    {
      icon: AudioLines,
      label: "SFX",
      tone: "text-brand",
      body: (
        <div className="relative size-full">
          {[
            ["whoosh", "12%"],
            ["pop", "46%"],
            ["riser", "70%"],
          ].map(([name, left]) => (
            <span
              key={name}
              className="landing-sfx absolute top-1/2 rounded bg-brand/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-brand ring-1 ring-brand/40"
              style={{ left, ["--at" as string]: parseFloat(left) / 100 }}
            >
              {name}
            </span>
          ))}
        </div>
      ),
    },
    {
      icon: Music,
      label: "Music",
      tone: "text-ink/40",
      // The bed dips while the voice is speaking.
      body: (
        <Bars
          heights={wave(44, 0.9)}
          dim={[8, 30]}
          live
          className="text-ink/40"
        />
      ),
    },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 p-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span
            className={cn(
              "flex w-[58px] shrink-0 items-center gap-1.5 font-mono text-[10px] font-semibold uppercase",
              row.tone,
            )}
          >
            <row.icon className="size-3" /> {row.label}
          </span>
          <div className="relative h-10 min-w-0 flex-1 overflow-hidden rounded-md bg-ink/[0.06] px-1">
            {row.body}
            <span className="landing-sweep absolute inset-y-0 w-px bg-brand" />
          </div>
        </div>
      ))}
    </div>
  );
}

const FEATURES = [
  {
    art: CaptionsArt,
    prompt: "Add captions",
    title: "Word-by-word captions",
    body: "Transcribed from your voice and timed to every word. They follow each cut you make.",
    span: "lg:col-span-6 lg:row-span-2",
  },
  {
    art: BeatArt,
    prompt: "Cut it to the beat",
    title: "Music on the beat",
    body: "Pick a track from the library and the agent lands your cuts on its beats.",
    span: "lg:col-span-6",
  },
  {
    art: FillerArt,
    prompt: "Remove the filler words",
    title: "Filler words, gone",
    body: "Cuts the ums and the dead air out of a talking clip.",
    span: "lg:col-span-3",
  },
  {
    art: FormatsArt,
    prompt: "Make it vertical",
    title: "Every shape",
    body: "Landscape, portrait, square and 4:5 from one edit.",
    span: "lg:col-span-3",
  },
  {
    art: DrawArt,
    prompt: "Zoom in right here",
    title: "Point at the frame",
    body: "Draw on the video and say what you want changed right there.",
    span: "lg:col-span-4",
  },
  {
    art: StylesArt,
    prompt: "Restyle it as Punk",
    title: "Styles you can swap",
    body: "One word restyles captions, graphics and color. Save your own for the next video.",
    span: "lg:col-span-4",
  },
  {
    art: GraphicsArt,
    prompt: "Add a lower third and a stat",
    title: "Motion graphics built in",
    body: "Titles, lower thirds, stickers and stats, placed by name and tuned by hand.",
    span: "lg:col-span-4",
  },
  {
    art: SoundArt,
    prompt: "Add a voice-over and a whoosh on every cut",
    title: "Voice-over and sound",
    body: "Generated voices, sound effects on the action and a music bed, each on its own track.",
    span: "lg:col-span-12",
    wide: true,
  },
];

/** Every feature is something you say: the sentence leads, the picture shows what comes back. */
export function FeatureGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
      {FEATURES.map((feature) => (
        <li
          key={feature.title}
          className={cn(
            "feature-card",
            feature.span,
            feature.wide && "sm:col-span-2 lg:!flex-row lg:items-stretch lg:gap-4",
          )}
        >
          <div
            className={cn(
              "flex flex-col",
              feature.wide ? "lg:w-[34%] lg:shrink-0 lg:justify-between" : "contents",
            )}
          >
            <p className="feature-prompt">
              <span>{feature.prompt}</span>
              <ArrowUp aria-hidden="true" />
            </p>
            {feature.wide ? <FeatureCopy feature={feature} /> : null}
          </div>
          <div
            className={cn("feature-art", feature.wide && "lg:min-h-[190px]")}
            aria-hidden="true"
          >
            <feature.art />
          </div>
          {feature.wide ? null : <FeatureCopy feature={feature} />}
        </li>
      ))}
    </ul>
  );
}

function FeatureCopy({ feature }: { feature: (typeof FEATURES)[number] }) {
  return (
    <div className="px-2.5 pb-3 pt-4">
      <h3 className="font-display text-lg font-bold tracking-tight">
        {feature.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/60">
        {feature.body}
      </p>
    </div>
  );
}
