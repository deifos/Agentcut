"use client";

// The style gallery: every style playing live on a real talking-head clip (ours, or one the user
// drops in), so people see the graphics, captions, camera and texture before they pick.
import { TooltipHint } from "@/components/ui/tooltip";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Player, Thumbnail, type PlayerRef } from "@remotion/player";
import {
  Check,
  Clapperboard,
  Loader2,
  Sparkles,
  Upload,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoStyles } from "@/components/studio/styles/VideoStyles";
import type { AssetEntry } from "@/lib/studio/types";
import { useAgentName } from "@/components/studio/StudioAgent";
import { cn } from "@/lib/utils";
import {
  loadMotionFonts,
  MOTION_STYLES,
  type MotionStyle,
} from "@/motion/components";
import {
  StyleDemo,
  type StyleDemoProps,
} from "@/components/studio/styles/StyleDemo";
import {
  DEMO_CLIP,
  DEMO_FRAMES,
  DEMO_WORDS,
  type DemoWord,
} from "@/components/studio/styles/demo-script";

const W = 720;
const H = 1280;
/** Where the card stills sit: the hook is fully in by then in every style. */
const STILL_FRAME = 62;
const CAMERA_LABEL: Record<string, string> = {
  punch: "Punch-in cuts",
  snap: "Stop-motion snaps",
  drift: "Slow drift",
  glitch: "Glitch jumps",
  tape: "Tape wobble & color grade",
  still: "Still camera",
};

function DemoPlayer({
  inputProps,
  playerRef,
  className,
}: {
  inputProps: StyleDemoProps;
  playerRef?: React.Ref<PlayerRef>;
  className?: string;
}) {
  return (
    <Player
      ref={playerRef}
      component={StyleDemo}
      inputProps={inputProps}
      durationInFrames={DEMO_FRAMES}
      fps={30}
      compositionWidth={W}
      compositionHeight={H}
      autoPlay
      loop
      initiallyMuted
      clickToPlay={false}
      acknowledgeRemotionLicense
      className={className}
      style={{ width: "100%", aspectRatio: `${W} / ${H}` }}
    />
  );
}

/** A still of a reel (cards that aren't hovered): a frame inside the style's hook. */
function DemoStill({ inputProps }: { inputProps: StyleDemoProps }) {
  return (
    <Thumbnail
      component={StyleDemo}
      inputProps={inputProps}
      durationInFrames={DEMO_FRAMES}
      fps={30}
      compositionWidth={W}
      compositionHeight={H}
      frameToDisplay={STILL_FRAME}
      style={{ width: "100%", aspectRatio: `${W} / ${H}` }}
    />
  );
}

/** The same paused gallery frame, reused for the composer's selected style. */
export function StylePoster({ styleId }: { styleId: string }) {
  return <DemoStill inputProps={{ styleId, src: DEMO_CLIP, words: DEMO_WORDS }} />;
}

/** A user clip: an object URL plus its words once the browser has transcribed it. */
interface OwnClip {
  url: string;
  name: string;
  words: DemoWord[] | null;
  status: "captioning" | "ready" | "no-captions";
}

export function StylesGallery({
  open,
  onOpenChange,
  currentStyle,
  supported,
  readOnly,
  chatDisabled,
  onUse,
  onRestyle,
  slug,
  library,
  assets,
  onSend,
  onSelect,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  currentStyle: string | undefined;
  /** The helper accepts a style in project.json. */
  supported: boolean;
  readOnly: boolean;
  chatDisabled: boolean;
  onUse(styleId: string): void;
  onRestyle(style: MotionStyle): void;
  /** For the video styles tab: the open project, the library listing and the project's files. */
  slug: string;
  library: AssetEntry[];
  assets: AssetEntry[];
  /** Send a chat message to the agent (video styles hand it their recipe). */
  onSend(text: string): void;
  /** Stage a style in the composer. Selection does not edit or send. */
  onSelect?(style: MotionStyle): void;
}) {
  const agentName = useAgentName();
  const styles = Object.values(MOTION_STYLES);
  const [tab, setTab] = useState<"talking" | "video">("talking");
  const [selected, setSelected] = useState(currentStyle ?? styles[0]?.id);
  const [muted, setMuted] = useState(true);
  // Only the hovered card plays (plus the big preview): seven live players at once is too much.
  const [hovered, setHovered] = useState<string | null>(null);
  const [clip, setClip] = useState<OwnClip | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bigPlayer = useRef<PlayerRef>(null);
  const style = MOTION_STYLES[selected ?? ""] ?? styles[0];

  useEffect(() => {
    void loadMotionFonts();
  }, []);

  // The object URL lives as long as the clip is in use.
  useEffect(() => {
    if (!clip) return;
    const url = clip.url;
    return () => URL.revokeObjectURL(url);
  }, [clip?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Pick a video file (a 5–10 s talking-head clip works best).");
      return;
    }
    const url = URL.createObjectURL(file);
    setClip({ url, name: file.name, words: null, status: "captioning" });
    try {
      // Caption it in the browser so the demos show real captions on it.
      const { transcribeUrl } = await import("@/lib/studio/audio/transcribe");
      const language =
        typeof navigator !== "undefined"
          ? navigator.language.slice(0, 2) || "en"
          : "en";
      const result = await transcribeUrl(url, {
        fps: 30,
        language,
        model: "base",
      });
      const words = result.words
        .filter((w) => w.fromFrame < DEMO_FRAMES)
        .map((w) => ({ text: w.text, from: w.fromFrame, to: w.toFrame }));
      setClip((current) =>
        current?.url === url ? { ...current, words, status: "ready" } : current,
      );
    } catch (error) {
      console.warn("[styles] captioning the clip failed", error);
      setClip((current) =>
        current?.url === url
          ? { ...current, words: [], status: "no-captions" }
          : current,
      );
    }
  };

  const demo = (styleId: string): StyleDemoProps => ({
    styleId,
    src: clip?.url ?? DEMO_CLIP,
    words: clip ? (clip.words ?? []) : DEMO_WORDS,
  });

  if (onSelect) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(820px,88dvh)] flex-col overflow-hidden sm:max-w-4xl">
        <DialogTitle>Choose a style</DialogTitle>
        <DialogDescription>Choose a look for your video. Review the request, then press Send.</DialogDescription>
        <ScrollArea className="min-h-0 flex-1" viewportClassName="overscroll-contain">
        <div className="grid grid-cols-2 gap-4 p-1 pr-3 sm:grid-cols-3 lg:grid-cols-4">
          {styles.map((item) => (
            <button key={item.id} type="button" onClick={() => { onSelect(item); onOpenChange(false); }} className="group flex flex-col gap-2 rounded-xl border border-border p-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <div className="aspect-[9/16] overflow-hidden rounded-lg"><DemoStill inputProps={demo(item.id)} /></div>
              <span className="text-sm font-semibold">{item.name}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{item.description}</span>
            </button>
          ))}
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(860px,92vh)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[96vw]"
        // Everything is sized from the height: two rows of 9:16 cards, the big preview and the
        // details column. The width follows (a centered fixed box can't shrink-wrap its content).
        style={{
          ["--body" as string]: "calc(min(860px, 92vh) - 57px)",
          ["--big" as string]: "calc((var(--body) - 32px) * 0.8)",
          // Card height: two rows in the height, four columns in what's left of the width.
          ["--thumb" as string]:
            "min(calc((var(--body) - 32px - 12px - 64px) / 2), calc((96vw - 402px - var(--big) * 0.5625) / 4 / 0.5625))",
          width:
            "min(96vw, calc(4 * var(--thumb) * 0.5625 + var(--big) * 0.5625 + 402px))",
        }}
      >
        <div className="flex h-[57px] shrink-0 items-center gap-3 border-b border-border/60 px-5">
          <div className="min-w-0">
            <DialogTitle className="text-[15px]">Styles</DialogTitle>
            <DialogDescription className="text-[12px]">
              {tab === "talking"
                ? "One click restyles a talking-head video: graphics, captions, camera moves and texture."
                : "Recipes for whole videos: music and lyric videos, explainers. Fill the blanks and the agent builds it."}
            </DialogDescription>
          </div>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "talking" | "video")}
            className="ml-4"
          >
            <TabsList>
              <TabsTrigger value="talking" className="gap-1.5 text-[12px]">
                <UserRound className="size-3.5" />
                Talking head
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-1.5 text-[12px]">
                <Clapperboard className="size-3.5" />
                Video styles
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="ml-auto flex items-center gap-2">
            {tab === "talking" && clip ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {clip.status === "captioning" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : null}
                {clip.status === "captioning"
                  ? "Captioning your clip…"
                  : clip.status === "no-captions"
                    ? "Your clip (no captions)"
                    : "Your clip"}
                <TooltipHint content="Back to the sample clip">
                  <button
                    type="button"
                    onClick={() => setClip(null)}
                    className="rounded p-0.5 hover:bg-muted"
                    aria-label="Back to the sample clip"
                  >
                    <X className="size-3" />
                  </button>
                </TooltipHint>
              </span>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(event) => void pickFile(event)}
            />
            {tab === "talking" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="h-8 gap-1.5 text-[12px]"
              >
                <Upload className="size-3.5" />
                Try with my clip
              </Button>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {tab === "video" ? (
          <VideoStyles
            slug={slug}
            library={library}
            assets={assets}
            readOnly={readOnly}
            chatDisabled={chatDisabled}
            onSend={(text) => {
              onSend(text);
              onOpenChange(false);
            }}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <ScrollArea className="min-h-0 shrink-0" viewportClassName="overscroll-contain">
            <div className="grid grid-cols-4 content-start gap-3 p-4">
              {styles.map((s) => {
                const active = s.id === style.id;
                const current = s.id === currentStyle;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelected(s.id);
                      setMuted(true);
                    }}
                    onPointerEnter={() => setHovered(s.id)}
                    onPointerLeave={() =>
                      setHovered((h) => (h === s.id ? null : h))
                    }
                    onFocus={() => setHovered(s.id)}
                    onBlur={() => setHovered((h) => (h === s.id ? null : h))}
                    className={cn(
                      "group flex flex-col overflow-hidden rounded-xl border bg-muted/30 text-left transition",
                      active
                        ? "border-foreground ring-2 ring-foreground/70"
                        : "border-border/60 hover:-translate-y-0.5 hover:border-foreground/40",
                    )}
                  >
                    <div
                      className="pointer-events-none overflow-hidden bg-black"
                      style={{ height: "var(--thumb)", aspectRatio: "9 / 16" }}
                    >
                      {hovered === s.id ? (
                        <DemoPlayer inputProps={demo(s.id)} />
                      ) : (
                        <DemoStill inputProps={demo(s.id)} />
                      )}
                    </div>
                    <div className="flex h-8 items-center gap-1.5 px-2.5">
                      <span className="truncate text-[12px] font-bold">
                        {s.name}
                      </span>
                      {current ? (
                        <span className="ml-auto rounded bg-primary px-1 py-px text-[9px] font-bold tracking-wide text-primary-foreground uppercase">
                          In use
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            </ScrollArea>

            {style ? (
              <>
                <div className="flex shrink-0 items-center border-l border-border/60 bg-muted/20 p-4">
                  <div
                    className="relative overflow-hidden rounded-xl border border-border/60 bg-black shadow-lg"
                    style={{ height: "var(--big)", aspectRatio: "9 / 16" }}
                  >
                    <DemoPlayer
                      key={`${style.id}:${clip?.url ?? "demo"}`}
                      inputProps={demo(style.id)}
                      playerRef={bigPlayer}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (muted) bigPlayer.current?.unmute();
                        else bigPlayer.current?.mute();
                        setMuted(!muted);
                      }}
                      className="absolute right-2 bottom-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                      aria-label={muted ? "Sound on" : "Sound off"}
                    >
                      {muted ? (
                        <VolumeX className="size-3.5" />
                      ) : (
                        <Volume2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex w-[290px] shrink-0 flex-col border-l border-border/60">
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-3 p-4">
                      <div>
                        <h3 className="text-[18px] font-bold">{style.name}</h3>
                        <p className="text-[12px] leading-snug text-muted-foreground">
                          {style.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[
                          style.tokens.backdrop,
                          style.tokens.accent,
                          style.tokens.line,
                          style.tokens.panel,
                        ].map((color, i) => (
                          <span
                            key={i}
                            className="size-6 rounded-full border border-border shadow-sm"
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[
                          CAMERA_LABEL[style.camera.mode],
                          `Captions: ${style.captions.position}`,
                          style.overlay.kind !== "none"
                            ? `Texture: ${style.overlay.kind}`
                            : null,
                        ]
                          .filter(Boolean)
                          .map((chip) => (
                            <span
                              key={chip}
                              className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {chip}
                            </span>
                          ))}
                      </div>
                      <ul className="list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-muted-foreground">
                        {style.guide.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </ScrollArea>
                  <div className="space-y-2 border-t border-border/60 p-4">
                    {supported ? null : (
                      <p className="text-[11px] text-amber-500">
                        Update the Agentcut helper to use styles in your
                        projects.
                      </p>
                    )}
                    <Button
                      type="button"
                      disabled={!supported || readOnly || chatDisabled}
                      onClick={() => {
                        onRestyle(style);
                        onOpenChange(false);
                      }}
                      className="h-9 w-full gap-1.5"
                    >
                      <Sparkles className="size-4" />
                      Restyle my video as {style.name}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !supported || readOnly || style.id === currentStyle
                      }
                      onClick={() => {
                        onUse(style.id);
                        toast.success(
                          `${style.name} applied: captions, camera and texture switched. Ask ${agentName} to restyle the graphics.`,
                        );
                      }}
                      className="h-8 w-full gap-1.5 text-[12px]"
                    >
                      {style.id === currentStyle ? (
                        <Check className="size-3.5" />
                      ) : null}
                      {style.id === currentStyle
                        ? "In use"
                        : "Just switch the look"}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
