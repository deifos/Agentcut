"use client";

import { useId, useState } from "react";
import { Check, Clapperboard, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { safeFileName } from "@/components/studio/ChatReferences";
import { studioFileUrl } from "@/lib/studio/bundle";
import { uploadToProject } from "@/lib/studio/export";
import { fileName } from "@/lib/studio/format";
import type { AssetEntry } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

// The dice the studio rolls for every take, so two takes never come out the same.
// The agent builds the film around them (skills/agentcut/references/cinematic.md).
const DIRECTION = {
  mood: [
    "calm luxury",
    "hype launch",
    "playful pop",
    "dark tech noir",
    "warm editorial",
    "futuristic glass",
    "minimal keynote",
    "energetic startup",
  ],
  camera: [
    "slow, floating glides",
    "confident sweeps",
    "punchy snaps on the beat",
    "whip pans between details",
    "orbits around the device",
    "macro push-ins",
  ],
  signature: [
    "UI pieces lifting off the screen",
    "rack focus between details",
    "exploded view of the UI layers",
    "fly-over across the page",
    "device orbit with reflections",
    "light sweeping across the glass",
    "dolly zoom",
    "titles floating in depth in front of the screen",
    "devices dropping in and landing",
    "desktop and phone side by side in depth",
    "real 3D iPhone turning in studio light",
    "a 3D MacBook opening to reveal the product",
  ],
  backdrop: [
    "Apple white",
    "midnight with a brand-color glow",
    "brand-color mesh",
    "spotlight on black",
    "motion loops in brand colours",
    "a different motion loop every shot",
    "solid brand colour with shape loops",
    "paper with ink shapes",
  ],
  shapes: [
    "none, let the product breathe",
    "one shape loop as a section opener",
    "floating brand shapes in depth",
    "kinetic shapes around the titles",
    "a shape loop on the end card",
  ],
  palette: [
    "brand colours only",
    "brand + a complementary accent",
    "monochrome brand tints",
    "brand on paper and ink",
    "brand on deep dark",
  ],
  type: [
    "huge, tight sans",
    "elegant serif",
    "mono tech labels",
    "wide display",
    "minimal small caps",
  ],
  transitions: [
    "hard cuts on the beat",
    "whip pans",
    "one continuous camera move",
    "blur dissolves",
    "push-through zooms",
  ],
} as const;

type Direction = { [K in keyof typeof DIRECTION]: string };

const LABELS: Record<keyof Direction, string> = {
  mood: "Mood",
  camera: "Camera",
  signature: "Signature",
  backdrop: "Backdrop",
  shapes: "Shapes",
  palette: "Palette",
  type: "Type",
  transitions: "Cuts",
};

const LENGTHS = [15, 30, 45] as const;

const pick = (list: readonly string[], not?: string) => {
  const pool = list.length > 1 ? list.filter((v) => v !== not) : list;
  return pool[Math.floor(Math.random() * pool.length)];
};

function roll(previous?: Direction): Direction {
  return Object.fromEntries(
    Object.entries(DIRECTION).map(([key, list]) => [
      key,
      pick(list, previous?.[key as keyof Direction]),
    ]),
  ) as Direction;
}

export function CinematicTab({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Cinematic Mode"
      title="Cinematic Mode"
      className="flex w-7 flex-col items-center gap-2 rounded-r-lg border border-l-0 border-brand/70 bg-background py-2.5 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
    >
      <Clapperboard className="size-3.5 text-brand" />
      <span className="text-[10px] font-black tracking-wider uppercase [writing-mode:vertical-rl]">
        Cinematic
      </span>
    </button>
  );
}

export function Cinematic({
  open,
  onOpenChange,
  slug,
  assets,
  hasTake,
  disabled,
  running,
  helperUpdate,
  onSend,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  slug: string;
  assets: AssetEntry[];
  /** The project already has a cinematic cut: the button makes another take. */
  hasTake: boolean;
  disabled: boolean;
  running: boolean;
  /** Set when the helper is too old for Cinematic Mode: how to update it. */
  helperUpdate?: string | null;
  onSend(text: string): Promise<void>;
}) {
  const [direction, setDirection] = useState<Direction>(() => roll());
  const [picked, setPicked] = useState<string[] | null>(null);
  const [about, setAbout] = useState("");
  const [length, setLength] = useState<(typeof LENGTHS)[number]>(15);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const blockedId = useId();
  // Reopening starts clean: last time's "Sent" or error is about another request.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError("");
      setNotice("");
    }
  }

  const media = assets
    .filter(
      (a) =>
        (a.kind === "image" || a.kind === "video") &&
        !a.path.startsWith("assets/references/"),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  // Until the user picks, every screenshot and recording in the project is in, but not the
  // project's own exports (renders/ and their covers): those are films, not product shots.
  const preselected = media
    .filter((a) => !a.path.startsWith("renders/"))
    .map((a) => a.path);
  const selected = (picked ?? preselected).filter((p) =>
    media.some((a) => a.path === p),
  );

  function toggle(path: string) {
    setPicked(
      selected.includes(path)
        ? selected.filter((p) => p !== path)
        : [...selected, path],
    );
  }

  async function upload(files: FileList | File[]) {
    setError("");
    const list = [...files].filter((f) =>
      /\.(png|jpe?g|webp|mp4|webm|mov|m4v)$/i.test(f.name),
    );
    if (!list.length) {
      setError("Drop screenshots (PNG, JPG, WebP) or recordings (MP4, WebM, MOV).");
      return;
    }
    if (list.some((f) => f.size > 300 * 1024 * 1024)) {
      setError("Keep each file under 300 MB.");
      return;
    }
    setBusy(true);
    try {
      const added: string[] = [];
      for (const file of list) {
        const safe = safeFileName(file.name.toLowerCase(), "shot");
        added.push(await uploadToProject(slug, `assets/cinematic/${safe}`, file));
      }
      // Functional: picks toggled while the files uploaded stay as the user left them.
      setPicked((current) => [
        ...(current ?? preselected).filter((p) => !added.includes(p)),
        ...added,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const files = selected.map((p) => JSON.stringify(p)).join(", ");
      const dir = (Object.keys(LABELS) as (keyof Direction)[])
        .map((k) => `${LABELS[k].toLowerCase()}: ${direction[k]}`)
        .join("; ");
      const topic = about.trim().replace(/[.!\s]+$/, "");
      const common = `Direction for this take: ${dir}. Length about ${length} s, wide and mobile.${topic ? ` It's about: ${topic}.` : ""} Follow references/cinematic.md and references/loops.md: find the brand colours, look at every file and find the hero regions, write the shot list, build each shot with the Stage toolkit from agentcut/components (real 3D devices with Device3D for every phone and laptop, never the flat device frames), add music cut to the beats, and pass the quality gate in both variants before you hand off.`;
      await onSend(
        hasTake
          ? `Cinematic, another take: make a new product film from ${files}. Back up the current cut to .studio/cinematic-takes/ first, then replace the Cinematic track with a completely different film. ${common}`
          : `Cinematic: make a premium product film from ${files}. ${common}`,
      );
      // The next take gets fresh dice.
      setDirection((d) => roll(d));
      setNotice("Sent to your agent. Follow along in chat.");
    } catch (e) {
      setError(
        `Could not send your request${e instanceof Error ? `: ${e.message}` : "."} Please try again.`,
      );
    } finally {
      setBusy(false);
    }
  }

  const locked = disabled || busy;
  // Why the button is off, shown under it (a disabled button gets no hover tooltip everywhere).
  const blocked = helperUpdate
    ? helperUpdate
    : disabled
    ? "Connect the studio helper to send."
    : running
      ? "Your agent is busy. Send this when it's done, or stop it in chat."
      : selected.length === 0
        ? "Pick at least one screenshot or recording."
        : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cinematic Mode</DialogTitle>
          <DialogDescription>
            Turn screenshots and recordings into a product film: 3D camera
            moves, lens blur, UI lifting off the screen, devices and light.
            Every take is directed differently.
          </DialogDescription>
        </DialogHeader>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!locked) void upload(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground hover:bg-muted/50 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
            dragging && "border-brand bg-brand/10 text-foreground",
            locked && "pointer-events-none opacity-60",
          )}
        >
          Drop screenshots or recordings here,&nbsp;
          <span className="underline underline-offset-2">browse</span>
          <input
            type="file"
            multiple
            className="sr-only"
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,.m4v"
            disabled={locked}
            onChange={(e) => {
              const files = e.target.files;
              if (files) void upload([...files]);
              e.target.value = "";
            }}
          />
        </label>

        {media.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {media.map((a) => {
              const on = selected.includes(a.path);
              const src = studioFileUrl(slug, a.path);
              return (
                <button
                  key={a.path}
                  type="button"
                  title={a.path}
                  aria-label={fileName(a.path)}
                  aria-pressed={on}
                  onClick={() => toggle(a.path)}
                  className={cn(
                    "relative aspect-video overflow-hidden rounded-md border bg-muted",
                    on ? "border-brand ring-2 ring-brand/40" : "opacity-60",
                  )}
                >
                  {a.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="size-full object-cover object-top" />
                  ) : (
                    <video src={src} muted preload="metadata" className="size-full object-cover" />
                  )}
                  {on ? (
                    <span className="absolute top-1 right-1 rounded-full bg-brand p-0.5 text-white">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">This take&rsquo;s direction</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setDirection((d) => roll(d))}
            >
              <Dices className="size-3.5" /> Roll again
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(LABELS) as (keyof Direction)[]).map((k) => (
              <button
                key={k}
                type="button"
                title={`Roll a new ${LABELS[k].toLowerCase()}`}
                onClick={() =>
                  setDirection((d) => ({ ...d, [k]: pick(DIRECTION[k], d[k]) }))
                }
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] hover:bg-muted/70"
              >
                <span className="text-muted-foreground">{LABELS[k]}:</span>{" "}
                {direction[k]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Length
          {LENGTHS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={length === l}
              onClick={() => setLength(l)}
              className={cn(
                "rounded-md border px-2 py-1",
                length === l && "border-brand bg-brand/10 text-foreground",
              )}
            >
              {l}s
            </button>
          ))}
        </div>

        <Textarea
          aria-label="What's it about?"
          placeholder="What's it about? (optional) e.g. Jolt, ordering for coffee shops: show the live orders, the sign-up chart, the domain offer"
          rows={2}
          className="min-h-0 resize-none text-sm"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
        />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-xs text-muted-foreground">
            {notice}
          </p>
        )}
        <Button
          disabled={locked || Boolean(blocked)}
          onClick={() => void send()}
          aria-describedby={blocked && !busy ? blockedId : undefined}
          className="gap-2"
        >
          {hasTake ? <Dices className="size-4" /> : <Clapperboard className="size-4" />}
          {hasTake ? "Another take" : "Make it cinematic"}
        </Button>
        {blocked && !busy ? (
          <p id={blockedId} className="-mt-1 text-center text-xs text-muted-foreground">
            {blocked}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
