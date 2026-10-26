"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BROLL_AVAILABLE, brollUrl, type BrollQuery, type BrollResult } from "@/lib/broll";
import { onBrollModelProgress, onBrollModelReady, searchBroll, type BrollSearchResult } from "@/lib/studio/broll/search";

const PAGE = 48;
type Color = "" | "black-and-white" | "color";

const fileName = (s: BrollResult) => `${s.id}.mp4`;

/** Cross-origin files ignore <a download>: fetch the file and save it under a readable name. */
async function save(shot: BrollResult) {
  const response = await fetch(brollUrl(shot.full));
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName(shot) });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function ShotCard({ shot }: { shot: BrollResult }) {
  const [hover, setHover] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div
        className="relative aspect-[4/3] w-full bg-ink"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brollUrl(shot.thumb)} alt={shot.description} loading="lazy" className="absolute inset-0 size-full object-contain" />
        {hover && (
          <video
            src={brollUrl(shot.preview)}
            muted
            autoPlay
            loop
            playsInline
            className="absolute inset-0 size-full object-contain"
          />
        )}
        <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {shot.seconds.toFixed(1)}s
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="line-clamp-3 text-sm leading-snug">{shot.description}</p>
        <a
          href={shot.film.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 line-clamp-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {shot.film.title}
          {shot.film.year ? ` (${shot.film.year})` : ""}
        </a>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            save(shot)
              .catch((error) => window.alert(error instanceof Error ? error.message : String(error)))
              .finally(() => setSaving(false));
          }}
          className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
        >
          <Download className="size-3.5" /> {saving ? "Downloading…" : `Download MP4 · ${shot.width}×${shot.height}`}
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
        on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Search the archival b-roll catalog by meaning; runs in the browser (lib/studio/broll). */
export function BrollGallery() {
  const [query, setQuery] = useState("");
  const [color, setColor] = useState<Color>("");
  const [backgroundOk, setBackgroundOk] = useState(false);
  const [noPeople, setNoPeople] = useState(false);
  const [calm, setCalm] = useState(false);
  const [data, setData] = useState<BrollSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelLoad, setModelLoad] = useState<number | null>(null);
  const [modelReadyTick, setModelReadyTick] = useState(0);
  const request = useRef(0);

  useEffect(() => {
    const offReady = onBrollModelReady(() => {
      setModelLoad(null);
      setModelReadyTick((n) => n + 1);
    });
    const offProgress = onBrollModelProgress((info) => {
      if (info.file?.endsWith(".onnx") && typeof info.progress === "number") setModelLoad(Math.round(info.progress));
    });
    return () => {
      offReady();
      offProgress();
    };
  }, []);

  const run = (offset: number) => {
    const id = ++request.current;
    const q: BrollQuery = { query, color: color || undefined, backgroundOk, noPeople, calm, limit: PAGE, offset };
    searchBroll(q)
      .then((result) => {
        if (id !== request.current) return;
        setError(null);
        setData((prev) => (offset && prev ? { ...result, results: [...prev.results, ...result.results] } : result));
      })
      .catch((e) => id === request.current && setError(e instanceof Error ? e.message : String(e)));
  };

  // Debounced search; runs again when the meaning model finishes loading.
  useEffect(() => {
    if (!BROLL_AVAILABLE) return;
    const timer = setTimeout(() => run(0), query ? 300 : 0);
    return () => clearTimeout(timer);
    // run reads the current filters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, color, backgroundOk, noPeople, calm, modelReadyTick]);

  if (!BROLL_AVAILABLE) return <p className="py-20 text-center text-muted-foreground">The b-roll catalog isn&rsquo;t set up here.</p>;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm sm:max-w-md">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe a shot: lonely city at night, crowd celebrating…"
            className="w-full bg-transparent outline-none"
            aria-label="Search b-roll"
          />
        </label>
        <div className="inline-flex rounded-full border border-border bg-card p-1" role="radiogroup" aria-label="Colour">
          {(
            [
              ["", "All"],
              ["black-and-white", "Black & white"],
              ["color", "Colour"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={color === value}
              onClick={() => setColor(value)}
              className={cn(
                "h-8 rounded-full px-3.5 text-sm font-semibold transition-colors",
                color === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Toggle on={backgroundOk} onChange={setBackgroundOk}>
          Room for text
        </Toggle>
        <Toggle on={noPeople} onChange={setNoPeople}>
          No people
        </Toggle>
        <Toggle on={calm} onChange={setCalm}>
          Calm
        </Toggle>
      </div>
      <p className="mb-6 font-mono text-xs text-muted-foreground">
        {data
          ? data.closest
            ? `${data.total.toLocaleString()} shots`
            : `${data.matches.toLocaleString()} of ${data.total.toLocaleString()} shots`
          : "Loading the catalog…"}
        {data?.closest && " · nothing matches that closely yet, these are the nearest shots"}
        {data?.mode === "keywords" &&
          ` · matching words for now, search by meaning is loading${modelLoad !== null ? ` (${modelLoad}%)` : ""}`}
      </p>
      {error ? (
        <p className="py-20 text-center text-muted-foreground">{error}</p>
      ) : data && data.results.length === 0 ? (
        <p className="py-20 text-center text-muted-foreground">No shot matches that search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.results.map((shot) => <ShotCard key={shot.id} shot={shot} />)}
        </div>
      )}
      {data && data.results.length < data.matches && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => run(data.results.length)}
            className="h-10 rounded-full border border-border bg-card px-6 text-sm font-semibold hover:border-foreground"
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
