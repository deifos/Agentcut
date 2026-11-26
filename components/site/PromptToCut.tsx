import Image from "next/image";
import { ArrowUp, Check, Mic, Plus } from "lucide-react";

// The landing's picture of an edit as a conversation: a chat thread on one side, the timeline it
// wrote on the other, and the follow-up that changes one clip.

const CLIPS = [
  { name: "aerial-sunset", grow: 32 },
  { name: "windshield", grow: 30 },
  { name: "wheel-topdown", grow: 24 },
  { name: "golden-hour", grow: 30 },
  { name: "dusk-jump", grow: 30 },
];
const TOTAL = CLIPS.reduce((sum, clip) => sum + clip.grow, 0) + 18;
const BARS = Array.from({ length: 96 }, (_, i) =>
  Math.round(20 + Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.23)) * 80),
);
const STEPS = [
  "Watched the 5 clips, picked the best moments",
  "Cut the montage on the beat",
  "Added the title, captions and a lower third",
  "Checked 6 frames, wide and mobile",
];
const ADDED = ["5 clips", "Title", "Captions", "Lower third", "Music"];

// The preview plays along with the playhead: each layer is visible while the playhead is over its
// clip. Spans are in the same units as the clips' widths, so the two stay in step.
const LOOP_SECONDS = 9;
const TITLE = { from: 0, to: 32 };
const CAPTIONS = { from: 54, to: 106 };
const CAPTION_WORDS = ["No map.", "No plan.", "Just go."];
const END = { from: TOTAL - 18, to: TOTAL };
const SHOTS = CLIPS.map((clip, index) => {
  const from = CLIPS.slice(0, index).reduce((sum, c) => sum + c.grow, 0);
  return { name: clip.name, from, to: from + clip.grow };
});

const percent = (units: number) => ((units / TOTAL) * 100).toFixed(2);

/** Keyframes that show a layer only between two points of the loop. */
function during(name: string, { from, to }: { from: number; to: number }) {
  const on = `${percent(from)}%, ${percent(to)}% { opacity: 1 }`;
  const before = from > 0 ? `0%, ${percent(from - 0.05)}% { opacity: 0 }` : "";
  const after = to < TOTAL ? `${percent(to + 0.05)}%, 100% { opacity: 0 }` : "";
  return `@keyframes ${name} { ${before} ${on} ${after} }`;
}

const PREVIEW_CSS = [
  ...SHOTS.map((shot, index) => during(`ptc-shot-${index}`, shot)),
  during("ptc-title", TITLE),
  during("ptc-end", END),
  ...CAPTION_WORDS.map((_, index) => {
    const step = (CAPTIONS.to - CAPTIONS.from) / CAPTION_WORDS.length;
    const from = CAPTIONS.from + step * index;
    return during(`ptc-word-${index}`, { from, to: from + step });
  }),
  `.ptc-layer { animation-duration: ${LOOP_SECONDS}s; animation-timing-function: linear; animation-iteration-count: infinite; }`,
  `.landing-playhead { animation-duration: ${LOOP_SECONDS}s; }`,
  "@media (prefers-reduced-motion: reduce) { .ptc-layer { animation: none !important; } }",
].join("\n");

/** A layer of the preview; without motion only the opening frame (shot 0 and the title) shows. */
const layer = (animation: string, opening = false) => ({
  animationName: animation,
  opacity: opening ? 1 : 0,
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-stretch gap-3">
      <span className="flex w-6 shrink-0 items-center font-mono text-[10px] font-semibold text-ink/40">
        {label}
      </span>
      <div className="relative flex min-w-0 flex-1 gap-1">{children}</div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <p className="ml-auto max-w-[88%] rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-[15px] font-medium leading-snug text-paper">
      {children}
    </p>
  );
}

export function PromptToCut() {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
      {/* The conversation */}
      <div className="flex flex-col gap-3.5 rounded-[28px] border border-ink/12 bg-card/70 p-4 sm:p-5">
        <UserBubble>
          Make a 16 second road trip montage from my clips. Cut to the beat,
          big title, captions, end on the logo.
        </UserBubble>
        <ul className="space-y-1.5">
          {STEPS.map((step) => (
            <li
              key={step}
              className="flex items-center gap-2.5 rounded-xl border border-ink/10 px-3 py-2 text-[13px] text-ink/65"
            >
              <Check className="size-3.5 shrink-0 text-emerald-400" />
              {step}
            </li>
          ))}
        </ul>
        <p className="text-[15px] leading-relaxed text-ink/85">
          Done: <strong>16 seconds, 5 shots, 6 tracks.</strong> Every cut lands
          on a beat.
        </p>
        <UserBubble>The title is too small. Make it huge.</UserBubble>
        <p className="text-[15px] leading-relaxed text-ink/85">
          Bumped <strong>ROAD TRIP.</strong> to fill the left half of the
          frame. Nothing else moved.
        </p>
        <div className="mt-1 flex items-center gap-2 rounded-full border border-ink/15 bg-paper/60 py-1.5 pl-1.5 pr-1.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand text-white">
            <Mic className="size-4" />
          </span>
          <span className="flex-1 truncate text-sm text-ink/70">
            Now make a vertical one
            <span className="landing-caret" />
          </span>
          <span className="flex size-9 items-center justify-center rounded-full bg-ink text-paper">
            <ArrowUp className="size-4" />
          </span>
        </div>
      </div>

      {/* What it wrote */}
      <div aria-hidden="true" className="lg:sticky lg:top-28">
        <div className="relative overflow-hidden rounded-[28px] border border-ink/12">
          <style>{PREVIEW_CSS}</style>
          <div className="relative aspect-video bg-black">
            {SHOTS.map((shot, index) => (
              <Image
                key={shot.name}
                src={`/landing/shot-${shot.name}.jpg`}
                alt=""
                fill
                sizes="(min-width: 1024px) 700px, 100vw"
                className="ptc-layer object-cover"
                style={layer(`ptc-shot-${index}`, index === 0)}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent" />
            <div
              className="ptc-layer absolute inset-0"
              style={layer("ptc-title", true)}
            >
              <p className="absolute bottom-[9%] left-[5%] font-sans text-[clamp(2.6rem,7.5vw,6rem)] font-black leading-[0.88] tracking-tight text-[#fff8ef]">
                ROAD
                <br />
                TRIP.
              </p>
              <span className="absolute left-[4%] top-[34%] rounded-md border border-dashed border-brand bg-brand/15 px-2 py-1 font-mono text-[10px] font-semibold text-brand">
                edited just now
              </span>
            </div>
            {CAPTION_WORDS.map((words, index) => (
              <p
                key={words}
                className="ptc-layer absolute inset-x-0 bottom-[10%] text-center font-sans text-[clamp(1.5rem,3.6vw,2.75rem)] font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
                style={layer(`ptc-word-${index}`)}
              >
                {words.split(" ")[0]}{" "}
                <span className="text-brand">{words.split(" ")[1]}</span>
              </p>
            ))}
            <div
              className="ptc-layer absolute inset-0 flex flex-col items-center justify-center bg-[#0b0a09]"
              style={layer("ptc-end")}
            >
              <p className="font-display text-[clamp(2rem,5vw,3.75rem)] font-extrabold tracking-[-0.04em]">
                agent<span className="text-brand">cut</span>
              </p>
              <p className="mt-1 text-sm text-ink/60">Edit video with a prompt</p>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-ink/10 bg-card/80 p-4">
            <div className="relative space-y-1.5">
              <Row label="T1">
                <span
                  className="h-7 truncate rounded-md bg-brand/25 px-2 text-[10px] font-bold leading-7 text-brand ring-2 ring-brand"
                  style={{ width: `${(32 / TOTAL) * 100}%` }}
                >
                  ROAD TRIP.
                </span>
                <span
                  className="h-7 truncate rounded-md bg-[oklch(0.7_0.13_155/0.2)] px-2 text-[10px] font-semibold leading-7 text-[oklch(0.82_0.13_155)] ring-1 ring-[oklch(0.7_0.13_155/0.4)]"
                  style={{
                    marginLeft: `${(22 / TOTAL) * 100}%`,
                    width: `${(52 / TOTAL) * 100}%`,
                  }}
                >
                  No map. No plan. Just go.
                </span>
              </Row>
              <Row label="V1">
                {CLIPS.map((clip) => (
                  <div
                    key={clip.name}
                    className="relative h-12 overflow-hidden rounded-md ring-1 ring-ink/15"
                    style={{ flexGrow: clip.grow, flexBasis: 0 }}
                  >
                    <Image
                      src={`/landing/shot-${clip.name}.jpg`}
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                ))}
                <div
                  className="flex h-12 items-center justify-center rounded-md bg-black font-display text-[10px] font-extrabold tracking-tight ring-1 ring-ink/15"
                  style={{ flexGrow: 18, flexBasis: 0 }}
                >
                  agent<span className="text-brand">cut</span>
                </div>
              </Row>
              <Row label="A1">
                <div className="flex h-8 w-full items-center gap-px rounded-md bg-ink/[0.06] px-1 text-ink/40">
                  {BARS.map((height, index) => (
                    <span
                      key={index}
                      className="w-full rounded-full bg-current"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
              </Row>
              <div className="pointer-events-none absolute inset-y-0 left-9 right-0">
                <span className="landing-playhead absolute inset-y-[-4px] w-px bg-brand shadow-[0_0_10px_var(--brand)]" />
              </div>
            </div>
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {ADDED.map((item) => (
            <li
              key={item}
              className="flex items-center gap-1 rounded-full border border-ink/12 px-3 py-1 text-xs font-medium text-ink/65"
            >
              <Plus className="size-3 text-brand" /> {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
