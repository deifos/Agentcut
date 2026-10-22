"use client";

// A faithful mock of the studio (/studio): same header, chat, preview, inspector and timeline,
// drawn at the studio's real size and scaled to fit. The preview plays a real Remotion reel and
// the timeline playhead follows it.
import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowUp,
  AudioLines,
  Bot,
  Camera,
  Captions,
  ChevronDown,
  Clapperboard,
  Copy,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Lock,
  Magnet,
  Mic,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Plus,
  Redo2,
  Repeat,
  RotateCcw,
  Scissors,
  Search,
  Shapes,
  SkipBack,
  Smartphone,
  StepBack,
  StepForward,
  Trash2,
  Type,
  Undo2,
  Upload,
  Volume2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { REEL_FRAMES, REEL_SHOTS, ShowcaseReel } from "@/components/site/showcase-reel";
import { cn } from "@/lib/utils";

const W = 1440;
const H = 880;
const PANEL = "min-h-0 overflow-hidden rounded-2xl border border-border bg-background shadow-sm";

const STEPS = [
  { icon: FileText, text: "Read brief.md and the app's README" },
  { icon: FileText, text: "Wrote scenes/Hook.tsx" },
  { icon: Shapes, text: "Placed 6 library components" },
  { icon: Camera, text: "Captured 4 frames" },
  { icon: FileText, text: "Edited layers.json" },
];

const COMPONENTS: [string, string, boolean?][] = [
  ["Text Reveal", "Text & Titles"],
  ["Kinetic Punch", "Text & Titles", true],
  ["Lower Third", "Overlays"],
  ["Stat Counter", "Charts & Stats"],
  ["Prompt Box", "AI & Product"],
  ["Word Swap", "Text & Titles", true],
  ["Logo Sting", "Text & Titles", true],
  ["Light Leak", "Transitions"],
];

// Seconds on the ruler (the reel is 19 s at 30 fps).
const RULER = Array.from({ length: 10 }, (_, index) => index * 2);
const SECONDS = REEL_FRAMES / 30;
const pct = (frames: number) => `${(frames / REEL_FRAMES) * 100}%`;

const SCENE_STARTS = REEL_SHOTS.reduce<number[]>((starts, shot, index) => {
  starts.push(index === 0 ? 0 : starts[index - 1] + REEL_SHOTS[index - 1].durationInFrames);
  return starts;
}, []);

const TRACKS = [
  {
    icon: Type,
    name: "Text",
    color: "bg-amber-100 border-amber-200 text-amber-950",
    clips: [
      { from: 30, duration: 150, label: "Tagline" },
      { from: 300, duration: 140, label: "Kicker" },
    ],
  },
  {
    icon: Captions,
    name: "Captions",
    color: "bg-yellow-100 border-yellow-200 text-yellow-950",
    clips: [{ from: 90, duration: 300, label: "Voice-over captions" }],
  },
  {
    icon: Clapperboard,
    name: "Scenes",
    color: "bg-violet-100 border-violet-200 text-violet-950",
    clips: REEL_SHOTS.map((shot, index) => ({ from: SCENE_STARTS[index], duration: shot.durationInFrames, label: shot.label })),
  },
  {
    icon: AudioLines,
    name: "Music",
    color: "bg-emerald-100 border-emerald-200 text-emerald-950",
    clips: [{ from: 0, duration: REEL_FRAMES, label: "assets/music/launch-bed.mp3", wave: true }],
  },
  {
    icon: AudioLines,
    name: "SFX",
    color: "bg-emerald-100 border-emerald-200 text-emerald-950",
    clips: SCENE_STARTS.slice(1).map((from) => ({ from: from - 8, duration: 22, label: "" })),
  },
];

// Bar heights in whole percents, so the server and browser render the same markup.
const WAVE = Array.from({ length: 300 }, (_, index) =>
  Math.round(20 + 60 * Math.abs(Math.sin(index * 0.9) * Math.cos(index * 0.23))),
);

function Icon({ icon: IconComponent, className }: { icon: typeof Play; className?: string }) {
  return <IconComponent className={cn("size-4", className)} />;
}

function Header() {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 px-3">
      <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
        Agentcut <ChevronDown className="size-3" />
      </span>
      <span className="text-[15px] font-semibold">Launch video</span>
      <div className="ml-2 flex items-center rounded-full bg-background p-0.5 shadow-sm">
        <span className="flex h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-[11px] font-semibold">
          <Monitor className="size-3.5" /> wide
        </span>
        <span className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-muted-foreground">
          <Smartphone className="size-3.5" /> mobile
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-muted-foreground">
        <span className="flex size-9 items-center justify-center">
          <Undo2 className="size-4" />
        </span>
        <span className="flex size-9 items-center justify-center opacity-40">
          <Redo2 className="size-4" />
        </span>
        <span className="flex h-9 items-center gap-2 px-3 text-xs">
          <Mic className="size-4" /> Voices
        </span>
        <span className="flex size-9 items-center justify-center rounded-full border border-border text-foreground">
          <Moon className="size-4" />
        </span>
        <span className="flex h-9 items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Claude is working
        </span>
        <span className="flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background">
          <Download className="size-4" /> Export
        </span>
      </div>
    </header>
  );
}

function Chat() {
  return (
    <aside className={cn(PANEL, "flex w-[370px] shrink-0 flex-col")}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <Bot className="size-4" />
        <span className="text-xs font-bold">Claude</span>
        <span className="text-[11px] text-muted-foreground">2.1</span>
        <ChevronDown className="size-3 text-muted-foreground" />
        <span className="rounded-sm bg-primary px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white">NEW</span>
        <RotateCcw className="ml-auto size-3.5 text-muted-foreground" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3 text-[13px] leading-relaxed">
        <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2">
          Make a 20 second launch video for my app: hook, three beats, end card.
        </p>
        <ul className="space-y-1.5 text-[12px] text-muted-foreground">
          {STEPS.map((step, index) => (
            <li key={step.text} className="site-step flex items-center gap-2" style={{ ["--i" as string]: index }}>
              <step.icon className="size-3.5" /> {step.text}
            </li>
          ))}
        </ul>
        <div className="site-step space-y-2" style={{ ["--i" as string]: STEPS.length }}>
          <p>
            Done: a 19 s launch spot in six scenes, all from the library, cut to a 112 BPM bed with a whoosh on
            every scene change.
          </p>
          <p>
            I checked frames in <strong>wide</strong> and <strong>mobile</strong>: nothing clips. Want the stat to
            count up from zero?
          </p>
          <p className="text-[11px] text-muted-foreground">Claude · Worked for 42s · 3 files changed</p>
        </div>
      </div>
      <div className="m-2 mt-0 rounded-2xl border border-border p-3">
        <p className="h-12 text-[14px] text-muted-foreground">Describe a change… drop a file here to point at it</p>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1.5 text-[13px]">
            <Camera className="size-4" /> Attach frame
          </span>
          <span className="text-[11px]">Claude sees: playhead 0:08.12</span>
          <span className="ml-auto flex size-8 items-center justify-center rounded-full bg-muted-foreground/60 text-background">
            <ArrowUp className="size-4" />
          </span>
        </div>
      </div>
    </aside>
  );
}

function Preview({ playerRef }: { playerRef: React.RefObject<PlayerRef | null> }) {
  return (
    <main className={cn(PANEL, "flex min-w-0 flex-1 flex-col")}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2.5 text-[11px] text-muted-foreground">
        <PanelLeftClose className="size-3.5" />
        6 scenes · built in 74 ms
        <PanelRightClose className="ml-auto size-3.5" />
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-muted/70 p-5">
        <div className="w-full overflow-hidden rounded-xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.25)] ring-1 ring-black/5">
          <Player
            ref={playerRef}
            component={ShowcaseReel}
            durationInFrames={REEL_FRAMES}
            fps={30}
            compositionWidth={1920}
            compositionHeight={1080}
            autoPlay
            loop
            initiallyMuted
            clickToPlay={false}
            acknowledgeRemotionLicense
            style={{ width: "100%", aspectRatio: "16 / 9" }}
          />
        </div>
      </div>
      <div className="flex h-14 shrink-0 items-center gap-1 px-3 text-muted-foreground">
        <Icon icon={SkipBack} className="mx-1.5" />
        <Icon icon={StepBack} className="mx-1.5" />
        <span className="mx-1 flex size-10 items-center justify-center rounded-full bg-foreground text-background">
          <Play className="size-4 fill-current" />
        </span>
        <Icon icon={StepForward} className="mx-1.5" />
        <span className="ml-3 font-mono text-[13px] tabular-nums text-foreground">
          0:08.12 <span className="text-muted-foreground">/ 0:19.00</span>
        </span>
        <Icon icon={Repeat} className="ml-auto mx-1.5" />
        <Icon icon={Volume2} className="mx-1.5" />
      </div>
    </main>
  );
}

function Inspector() {
  return (
    <aside className={cn(PANEL, "flex w-[358px] shrink-0 flex-col")}>
      <div className="flex h-11 shrink-0 items-center gap-5 border-b border-border px-4 text-[11px] font-semibold uppercase tracking-wider">
        <span className="text-muted-foreground/60">Clip</span>
        <span className="relative py-3">
          Assets
          <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground" />
        </span>
        <span className="text-muted-foreground">Renders</span>
        <span className="text-muted-foreground">Project</span>
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Project assets
          <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">
            <Upload className="size-3" /> Upload
          </span>
        </div>
        <div className="flex rounded-full bg-muted p-0.5 text-[11px] text-muted-foreground">
          {[
            ["All", 3],
            ["Video", 0],
            ["Audio", 2],
            ["Images", 1],
            ["Motion", 49],
          ].map(([name, count], index) => (
            <span
              key={name}
              className={cn(
                "flex-1 rounded-full py-1.5 text-center",
                index === 0 && "bg-background font-semibold text-foreground shadow-sm",
              )}
            >
              {name} <span className="opacity-60">{count}</span>
            </span>
          ))}
        </div>
        <div className="flex h-8 items-center gap-2 rounded-full border border-border px-3 text-[12px] text-muted-foreground">
          <Search className="size-3.5" /> Search files and components
        </div>
        <div className="space-y-1 text-[12px]">
          {["launch-bed.mp3", "whoosh.wav", "logo.png"].map((name) => (
            <div key={name} className="flex items-center gap-2 rounded-lg px-1.5 py-1">
              <span className="size-5 rounded bg-muted" /> {name}
            </div>
          ))}
        </div>
        <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Motion components</p>
        <div className="space-y-0.5">
          {COMPONENTS.map(([name, category, isNew]) => (
            <div key={name} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[12px]">
              <Shapes className="size-3.5 text-violet-500" />
              {name}
              {isNew ? (
                <span className="ml-auto rounded-sm bg-primary px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white">
                  NEW
                </span>
              ) : null}
              <span className={cn("text-[11px] text-muted-foreground", !isNew && "ml-auto")}>{category}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function Timeline({ timelineRef }: { timelineRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <section className={cn(PANEL, "mx-2 mb-2 flex h-[262px] shrink-0 flex-col")}>
      <div className="flex h-10 shrink-0 items-center gap-1 px-3 text-muted-foreground">
        <Icon icon={Scissors} className="mx-1.5 size-3.5" />
        <Icon icon={Copy} className="mx-1.5 size-3.5" />
        <Icon icon={Trash2} className="mx-1.5 size-3.5" />
        <span className="mx-2 h-4 w-px bg-border" />
        <span className="flex items-center gap-1 text-[12px]">
          <Plus className="size-3.5" /> Track
        </span>
        <span className="ml-2 flex size-7 items-center justify-center rounded-full bg-muted">
          <Magnet className="size-3.5" />
        </span>
        <span className="ml-auto font-mono text-[12px] tabular-nums text-foreground">
          0:08.12 <span className="text-muted-foreground">/ 0:19.00</span>
        </span>
        <ZoomOut className="ml-3 size-3.5" />
        <span className="mx-2 h-1.5 w-24 rounded-full bg-muted">
          <span className="block h-full w-1/3 rounded-full bg-foreground/30" />
        </span>
        <ZoomIn className="size-3.5" />
        <span className="ml-3 text-[11px]">Fit</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-[176px] shrink-0 pt-6">
          {TRACKS.map((track) => (
            <div key={track.name} className="flex h-9 items-center gap-2 px-3 text-[12px] font-semibold">
              <track.icon className="size-3.5" />
              {track.name}
              <span className="ml-auto flex items-center gap-2 text-muted-foreground">
                <Eye className="size-3.5" />
                <Lock className="size-3.5" />
                <Ellipsis className="size-3.5" />
              </span>
            </div>
          ))}
        </div>
        <div ref={timelineRef} className="relative min-w-0 flex-1 pr-3" style={{ ["--p" as string]: 0 }}>
          <div className="relative flex h-6 border-b border-border font-mono text-[10px] tabular-nums text-muted-foreground">
            {RULER.map((second) => (
              <span
                key={second}
                className="absolute top-1.5 border-l border-border pl-1"
                style={{ left: `${(second / SECONDS) * 100}%` }}
              >
                0:{String(second).padStart(2, "0")}.00
              </span>
            ))}
          </div>
          {TRACKS.map((track) => (
            <div key={track.name} className="relative h-9">
              {track.clips.map((clip) => (
                <div
                  key={clip.from}
                  className={cn(
                    "absolute top-1 h-7 overflow-hidden truncate rounded-lg border px-2 text-[11px] font-semibold leading-[26px]",
                    track.color,
                  )}
                  style={{ left: pct(clip.from), width: pct(clip.duration) }}
                >
                  {"wave" in clip ? (
                    <span className="absolute inset-0 flex items-center justify-between px-1 opacity-40">
                      {WAVE.map((height, index) => (
                        <span key={index} className="w-[2px] shrink-0 rounded-full bg-current" style={{ height: `${height}%` }} />
                      ))}
                    </span>
                  ) : null}
                  <span className="relative">{clip.label}</span>
                </div>
              ))}
            </div>
          ))}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10"
            style={{ left: "calc(var(--p) * (100% - 12px))" }}
          >
            <div className="absolute -left-px top-[20px] bottom-0 w-[2px] bg-foreground" />
            <svg viewBox="0 0 18 22" className="absolute -left-[9px] -top-px h-[22px] w-[18px] drop-shadow">
              <path
                d="M9 21.5 C 9 21.5 1 13.2 1 8.4 A 8 7.6 0 0 1 17 8.4 C 17 13.2 9 21.5 9 21.5 Z"
                className="fill-foreground stroke-background"
                strokeWidth="1.25"
              />
              <circle cx="9" cy="8.2" r="2.4" className="fill-background" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroStudio() {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Scale the full-size studio to the frame's width.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      canvasRef.current?.style.setProperty("--s", String(entry.contentRect.width / W));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Follow the player's frame with a CSS variable, so the playhead moves without re-rendering.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onFrame = (event: { detail: { frame: number } }) => {
      timelineRef.current?.style.setProperty("--p", String(event.detail.frame / REEL_FRAMES));
    };
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, []);

  return (
    <div
      ref={frameRef}
      className="relative w-full overflow-hidden rounded-[20px] border border-ink/10 shadow-[0_40px_80px_-30px_rgba(40,20,10,0.35)]"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <div
        ref={canvasRef}
        aria-label="The Agentcut studio"
        role="img"
        className="absolute left-0 top-0 flex origin-top-left flex-col bg-muted font-sans text-foreground"
        style={{ width: W, height: H, transform: "scale(var(--s, 1))" }}
      >
        <Header />
        <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
          <Chat />
          <Preview playerRef={playerRef} />
          <Inspector />
        </div>
        <Timeline timelineRef={timelineRef} />
      </div>
    </div>
  );
}
