"use client";

// The studio on the landing page, built from the real editor: the same preview (with its
// transport), timeline (with film strips) and component grid the studio uses, playing a real
// project (components/site/launch-reel). The header and chat are drawn to match. It renders at
// the studio's size and scales to fit.
import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowUp,
  Bot,
  Camera,
  Captions,
  ChevronDown,
  ChevronsUpDown,
  Download,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Mic,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Shapes,
  Smartphone,
  Undo2,
  Upload,
} from "lucide-react";
import { ComponentsSection } from "@/components/studio/ComponentsSection";
import { StudioPreview } from "@/components/studio/StudioPreview";
import { StudioTimeline } from "@/components/studio/StudioTimeline";
import { TimelineThumbs } from "@/components/studio/timeline-thumbs";
import {
  LAUNCH_REEL_ASSETS,
  LAUNCH_REEL_DOC,
  LAUNCH_REEL_LAYERS,
  LAUNCH_REEL_MODULE,
  LAUNCH_REEL_PROJECT,
  LAUNCH_REEL_SLUG,
} from "@/components/site/launch-reel";
import { buildInputProps } from "@/lib/studio/composition-props";
import { createFrameStore } from "@/lib/studio/frame-store";
import { cn } from "@/lib/utils";

const W = 1440;
const H = 960;
const PANEL = "min-h-0 overflow-hidden rounded-2xl border border-border bg-background shadow-sm";
const VARIANT = "wide";
const noop = () => {};
const noopAsync = async () => {};

const STEPS = [
  { icon: FileText, text: "Read brief.md and the clip's transcript" },
  { icon: ImageIcon, text: "Opened on mountains.png with a title" },
  { icon: Captions, text: "Captioned the talking head word by word" },
  { icon: Shapes, text: "Placed lower third, sticker and end card" },
  { icon: Camera, text: "Checked 6 frames, wide and mobile" },
];

const PROJECT_FILES = [
  { icon: Film, name: "footage.mp4", size: "1.4 MB" },
  { icon: ImageIcon, name: "mountains.png", size: "837 KB" },
  { icon: Play, name: "music.mp3", size: "145 KB" },
];

function Header() {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 px-3">
      <span className="mr-1 px-1 font-display text-lg font-extrabold tracking-[-0.04em]">
        agent<span className="text-brand">cut</span>
      </span>
      <span className="flex h-8 items-center gap-2 rounded-full border border-border bg-background pl-3 pr-2.5 text-sm font-semibold shadow-xs">
        <FolderOpen className="size-4 text-muted-foreground" />
        {LAUNCH_REEL_PROJECT.name}
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </span>
      <span className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground">
        <Plus className="size-4" /> New project
      </span>
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
        <span className="flex size-9 items-center justify-center rounded-full text-foreground">
          <Moon className="size-4" />
        </span>
        <span className="flex h-9 items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800">
          <span className="size-2.5 rounded-full bg-emerald-500" /> Connected
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
    <aside className={cn(PANEL, "relative flex w-[330px] shrink-0 flex-col overflow-visible")}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <Bot className="size-4" />
        <span className="text-xs font-bold">Claude</span>
        <span className="text-[11px] text-muted-foreground">2.1</span>
        <ChevronDown className="size-3 text-muted-foreground" />
        <RotateCcw className="ml-auto size-3.5 text-muted-foreground" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3 text-[13px] leading-relaxed">
        <p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2">
          Make a 17 second launch reel: a cinematic opener on the mountains, my talking-head clip with
          captions, end on the logo. LFG.
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
            Done: 17 seconds, 7 tracks. The captions follow your voice word by word, and the
            &ldquo;100% open source&rdquo; sticker lands on the line.
          </p>
          <p className="text-[11px] text-muted-foreground">Claude · Worked for 48s · 2 files changed</p>
        </div>
      </div>
      <div className="m-2 mt-0 rounded-2xl border border-border p-3">
        <p className="h-12 text-[14px] text-muted-foreground">Describe a change… drop a file here to point at it</p>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1.5 text-[13px]">
            <Camera className="size-4" /> Attach frame
          </span>
          <span className="ml-auto flex size-8 items-center justify-center rounded-full bg-muted-foreground/60 text-background">
            <ArrowUp className="size-4" />
          </span>
        </div>
      </div>
      {/* The styles tab on the chat's edge, as in the studio. */}
      <span className="absolute -right-[29px] top-12 flex w-7 flex-col items-center gap-2 rounded-r-lg border border-l-0 border-brand/70 bg-background py-2.5 text-muted-foreground shadow-sm">
        <Shapes className="size-3.5 text-brand" />
        <span className="text-[10px] font-black uppercase tracking-wider [writing-mode:vertical-rl]">Styles</span>
      </span>
    </aside>
  );
}

function Inspector({ frameStore }: { frameStore: ReturnType<typeof createFrameStore> }) {
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
      <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-3">
        <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Project assets
          <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">
            <Upload className="size-3" /> Upload
          </span>
        </div>
        <div className="flex h-7 items-center gap-2 rounded-full border border-border px-3 text-[12px] text-muted-foreground">
          <Search className="size-3.5" /> Search files and components
        </div>
        <div className="space-y-0.5">
          {PROJECT_FILES.map((file) => (
            <div key={file.name} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12px]">
              <file.icon className="size-3.5 text-muted-foreground" />
              <span className="flex-1">{file.name}</span>
              <span className="text-[10px] text-muted-foreground">{file.size}</span>
            </div>
          ))}
        </div>
        <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Motion components
        </p>
        <ComponentsSection
          doc={LAUNCH_REEL_DOC}
          frameStore={frameStore}
          readOnly
          chatBusy={false}
          chatDisabled
          query=""
          onCommit={noop}
          onSelect={noop}
          onAsk={noopAsync}
        />
      </div>
    </aside>
  );
}

export function HeroStudio() {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [frameStore] = useState(() => createFrameStore());
  const [playing, setPlaying] = useState(false);

  const thumbSource = useMemo(
    () => ({
      loaded: LAUNCH_REEL_MODULE,
      project: LAUNCH_REEL_PROJECT,
      variant: VARIANT,
      slug: LAUNCH_REEL_SLUG,
      assetBase: LAUNCH_REEL_ASSETS,
    }),
    [],
  );

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

  // Start the reel playing, muted (browsers only autoplay silent media).
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      tries += 1;
      if (player || tries > 40) window.clearInterval(timer);
      if (!player) return;
      player.mute();
      player.play();
    }, 150);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-black shadow-xl min-[801px]:hidden">
        <MobileReel />
      </div>
      <div
        ref={frameRef}
        className="relative hidden w-full overflow-hidden rounded-[20px] border border-ink/10 shadow-[0_40px_80px_-30px_rgba(40,20,10,0.35)] [container-type:inline-size] min-[801px]:block"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        <div
          ref={canvasRef}
          aria-label="The Agentcut studio playing a launch reel"
          role="group"
          className="studio-app absolute left-0 top-0 flex origin-top-left flex-col bg-muted font-sans text-foreground"
          style={{ width: W, height: H, transform: "scale(var(--s, calc(100cqw / 1440px)))" }}
        >
          <Header />
          <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
            <Chat />
            <main className={cn(PANEL, "ml-[30px] flex min-w-0 flex-1 flex-col")}>
              <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border/60 px-2 text-[11px] text-muted-foreground">
                <PanelLeftClose className="mx-1 size-3.5" />
                7 tracks · built in 92 ms
                <PanelRightClose className="ml-auto mr-1 size-3.5" />
              </div>
              <div className="min-h-0 flex-1">
                <StudioPreview
                  doc={LAUNCH_REEL_DOC}
                  loaded={LAUNCH_REEL_MODULE}
                  bundle={null}
                  moduleError={null}
                  variant={VARIANT}
                  frameStore={frameStore}
                  playerRef={playerRef}
                  selection={[]}
                  playing={playing}
                  onPlayingChange={setPlaying}
                  assetBase={LAUNCH_REEL_ASSETS}
                />
              </div>
            </main>
            <Inspector frameStore={frameStore} />
          </div>
          {/* The real timeline, read-only (the scaled frame would throw off dragging). */}
          <div className={cn(PANEL, "pointer-events-none mx-2 mb-2 h-[352px] shrink-0")}>
            <TimelineThumbs.Provider value={thumbSource}>
              <StudioTimeline
                layers={LAUNCH_REEL_LAYERS}
                slug={LAUNCH_REEL_SLUG}
                fps={LAUNCH_REEL_PROJECT.fps}
                durationInFrames={LAUNCH_REEL_PROJECT.durationInFrames}
                frameStore={frameStore}
                selection={[]}
                onSelect={noop}
                onSeek={noop}
                onPreview={noop}
                onCommit={noop}
                onSplit={noop}
                onDelete={noop}
                onDuplicate={noop}
                readOnly
              />
            </TimelineThumbs.Provider>
          </div>
        </div>
      </div>
    </>
  );
}

/** Phones get just the reel. */
function MobileReel() {
  const inputProps = useMemo(
    () => ({
      ...buildInputProps(LAUNCH_REEL_SLUG, LAUNCH_REEL_PROJECT, LAUNCH_REEL_LAYERS, VARIANT),
      assetBase: LAUNCH_REEL_ASSETS,
    }),
    [],
  );
  return (
    <Player
      component={LAUNCH_REEL_MODULE.module.StudioComposition}
      inputProps={inputProps}
      durationInFrames={LAUNCH_REEL_PROJECT.durationInFrames}
      fps={LAUNCH_REEL_PROJECT.fps}
      compositionWidth={1920}
      compositionHeight={1080}
      controls
      loop
      initiallyMuted
      acknowledgeRemotionLicense
      style={{ width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}
