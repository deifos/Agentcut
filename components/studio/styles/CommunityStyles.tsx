"use client";

// The community library inside the Styles dialog: editing styles other people shared, each with a
// demo clip. Adding one copies its reviewed rules into this workspace's saved styles.
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, RefreshCw, Search, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  communityFileUrl,
  communityTags,
  COMMUNITY_STYLES_URL,
  fetchCommunityIndex,
  fetchCommunityPrompt,
  filterCommunityStyles,
  type CommunityStyleEntry,
} from "@/lib/community-styles";
import type { EditingStyle } from "@/lib/studio/editing-styles";
import type { SavedStylesState } from "@/components/studio/styles/use-saved-styles";

/** The catalog's address as the helper stores it (absolute, no trailing slash). */
export function catalogBase() {
  return new URL(COMMUNITY_STYLES_URL, window.location.href).href.replace(/\/+$/, "");
}

export interface CommunityInstall {
  entry: CommunityStyleEntry;
  prompt: string;
  catalog: string;
}

type Installed = { style: EditingStyle; current: boolean } | null;

function installedCopy(saved: EditingStyle[], entry: CommunityStyleEntry, catalog: string): Installed {
  const copies = saved.filter((style) => style.source?.id === entry.id && style.source.catalog === catalog);
  const current = copies.find((style) => style.source?.sha256 === entry.promptSha256);
  if (current) return { style: current, current: true };
  return copies[0] ? { style: copies[0], current: false } : null;
}

/** A poster that plays its demo while hovered or focused. */
function StyleReel({ entry, active, className }: { entry: CommunityStyleEntry; active: boolean; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (active) void element.play().catch(() => {});
    else {
      element.pause();
      element.currentTime = 0;
    }
  }, [active]);
  return (
    <div className={cn("relative aspect-[9/16] overflow-hidden rounded-lg bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={communityFileUrl(entry.poster)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      {entry.demo ? (
        <video
          ref={video}
          src={active ? communityFileUrl(entry.demo) : undefined}
          muted
          loop
          playsInline
          preload="none"
          className={cn("absolute inset-0 size-full object-cover transition-opacity", active ? "opacity-100" : "opacity-0")}
        />
      ) : null}
    </div>
  );
}

export function CommunityStyles({
  saved,
  focusId,
  onFocusHandled,
  canInstall,
  installHint,
  disabled,
  onInstall,
  onApply,
  onShowSaved,
}: {
  saved: SavedStylesState;
  /** A style to open right away (from an "Open in Agentcut" link). */
  focusId: string | null;
  onFocusHandled(): void;
  /** The helper is connected and can add community styles. */
  canInstall: boolean;
  /** Why adding isn't possible, when it isn't. */
  installHint: string | null;
  /** Applying sends a chat request: off while the agent is busy or read-only. */
  disabled: boolean;
  onInstall(install: CommunityInstall): Promise<{ id: string; existing: boolean }>;
  onApply(style: EditingStyle): Promise<void>;
  onShowSaved(): void;
}) {
  const [index, setIndex] = useState<{ styles: CommunityStyleEntry[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCommunityIndex(undefined, controller.signal)
      .then((value) => {
        setIndex(value);
        setLoadError(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Could not load the community library.");
      });
    return () => controller.abort();
  }, [attempt]);

  // Open the linked style once the catalog has it, then tell the studio the link is used.
  const focusReady = Boolean(focusId && index);
  const [openedFocus, setOpenedFocus] = useState<string | null>(null);
  if (focusId && index && openedFocus !== focusId) {
    setOpenedFocus(focusId);
    if (index.styles.some((style) => style.id === focusId)) setOpenId(focusId);
  }
  if (!focusId && openedFocus) setOpenedFocus(null);
  useEffect(() => {
    if (focusReady) onFocusHandled();
  }, [focusReady, onFocusHandled]);

  const catalog = useMemo(() => catalogBase(), []);
  const tags = useMemo(() => communityTags(index?.styles ?? []), [index]);
  const shown = useMemo(() => filterCommunityStyles(index?.styles ?? [], query, tag), [index, query, tag]);
  const open = index?.styles.find((style) => style.id === openId) ?? null;

  return (
    <>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="overscroll-contain">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search community styles"
                aria-label="Search community styles"
                className="h-8 pl-8 text-[13px]"
              />
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href="/templates#community" target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" /> Gallery on the website
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onShowSaved}>
              <Share2 data-icon="inline-start" /> Share yours
            </Button>
          </div>
          {tags.length ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
              {[null, ...tags].map((value) => (
                <button
                  key={value ?? "all"}
                  type="button"
                  aria-pressed={tag === value}
                  onClick={() => setTag(value)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[12px] transition-colors",
                    tag === value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value ?? "All"}
                </button>
              ))}
            </div>
          ) : null}

          {loadError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-6 text-sm">
              <span className="text-destructive">{loadError}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>
                <RefreshCw data-icon="inline-start" /> Try again
              </Button>
            </div>
          ) : !index ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading community styles…
            </p>
          ) : index.styles.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No community styles yet. Be the first: open Saved editing styles and choose Share publicly.
            </p>
          ) : shown.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No styles match that search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((entry) => {
                const installed = installedCopy(saved.styles, entry, catalog);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setOpenId(entry.id)}
                    onMouseEnter={() => setHovered(entry.id)}
                    onMouseLeave={() => setHovered((current) => (current === entry.id ? null : current))}
                    onFocus={() => setHovered(entry.id)}
                    onBlur={() => setHovered((current) => (current === entry.id ? null : current))}
                    className="group flex flex-col gap-2 rounded-xl border border-border p-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <div className="relative">
                      <StyleReel entry={entry} active={hovered === entry.id} />
                      {installed ? (
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium">
                          {installed.current ? <><Check className="size-3" /> In your styles</> : "Update available"}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm font-semibold">{entry.name}</span>
                    <span className="text-[11px] text-muted-foreground">by {entry.author.name}</span>
                    <span className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{entry.description}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Community styles are reviewed before they&apos;re listed. Adding one copies its editing rules into your saved
            styles; you can read every rule first.
          </p>
        </div>
      </ScrollArea>
      {open ? (
        <CommunityStyleDetail
          key={open.id}
          entry={open}
          catalog={catalog}
          installed={installedCopy(saved.styles, open, catalog)}
          canInstall={canInstall}
          installHint={installHint}
          disabled={disabled}
          onClose={() => setOpenId(null)}
          onInstall={onInstall}
          onApply={onApply}
          savedStyles={saved}
        />
      ) : null}
    </>
  );
}

function CommunityStyleDetail({
  entry,
  catalog,
  installed,
  canInstall,
  installHint,
  disabled,
  onClose,
  onInstall,
  onApply,
  savedStyles,
}: {
  entry: CommunityStyleEntry;
  catalog: string;
  installed: Installed;
  canInstall: boolean;
  installHint: string | null;
  disabled: boolean;
  onClose(): void;
  onInstall(install: CommunityInstall): Promise<{ id: string; existing: boolean }>;
  onApply(style: EditingStyle): Promise<void>;
  savedStyles: SavedStylesState;
}) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"add" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set after adding, until the saved list includes the new copy (then `installed` takes over).
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCommunityPrompt(entry, undefined, controller.signal)
      .then(setPrompt)
      .catch((cause) => {
        if (!controller.signal.aborted) setPromptError(cause instanceof Error ? cause.message : "Could not load the rules.");
      });
    return () => controller.abort();
  }, [entry]);

  const current = installed?.current ? installed.style : null;
  const add = async (apply: boolean) => {
    if (!prompt || busy) return;
    setBusy(apply ? "apply" : "add");
    setError(null);
    try {
      let style = current;
      if (!style) {
        const result = await onInstall({ entry, prompt, catalog });
        setAdded(result.id);
        savedStyles.reload();
        style = {
          id: result.id,
          name: entry.name,
          description: entry.description,
          prompt,
          author: entry.author,
          tags: entry.tags,
          source: { kind: "community", id: entry.id, catalog, revision: entry.revision, sha256: entry.promptSha256 },
        };
      }
      if (apply) {
        await onApply(style);
        onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const inStyles = Boolean(current || added);
  return (
    <Dialog open onOpenChange={(value) => { if (!value && !busy) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-[min(920px,96vw)] gap-0 overflow-hidden p-0 sm:max-w-[min(920px,96vw)]">
        <div className="grid max-h-[92vh] grid-cols-1 md:grid-cols-[minmax(0,300px)_1fr]">
          <div className="bg-black md:max-h-[92vh]">
            {entry.demo ? (
              <video
                src={communityFileUrl(entry.demo)}
                poster={communityFileUrl(entry.poster)}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="mx-auto aspect-[9/16] max-h-[50vh] w-auto md:max-h-[92vh] md:w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={communityFileUrl(entry.poster)} alt="" className="mx-auto aspect-[9/16] max-h-[50vh] object-cover md:max-h-[92vh] md:w-full" />
            )}
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5">
            <div>
              <DialogTitle className="text-lg">{entry.name}</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                by{" "}
                {entry.author.github ? (
                  <a className="underline underline-offset-2" href={`https://github.com/${entry.author.github}`} target="_blank" rel="noreferrer">
                    {entry.author.name}
                  </a>
                ) : (
                  entry.author.name
                )}
                {" · "}revision {entry.revision}
              </p>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">{entry.description}</DialogDescription>
            {entry.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {entry.tags.map((value) => (
                  <span key={value} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{value}</span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Editing rules the agent will follow</span>
              {promptError ? (
                <p role="alert" className="text-sm text-destructive">{promptError}</p>
              ) : prompt === null ? (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading the rules…
                </p>
              ) : (
                <pre className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-sans text-[13px] leading-relaxed">
                  {prompt}
                </pre>
              )}
            </div>
            {installed && !installed.current ? (
              <p className="text-xs text-muted-foreground">
                You have an older revision of this style. Adding this one keeps your copy as it is.
              </p>
            ) : null}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {!canInstall && installHint ? <p role="status" className="text-xs text-muted-foreground">{installHint}</p> : null}
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                disabled={!prompt || !canInstall || disabled || busy !== null}
                onClick={() => void add(true)}
              >
                {busy === "apply" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                {inStyles ? "Apply to this video" : "Add and apply to this video"}
              </Button>
              {inStyles ? (
                <span className="flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
                  <Check className="size-4" /> In your saved styles
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!prompt || !canInstall || busy !== null}
                  onClick={() => void add(false)}
                >
                  {busy === "add" ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                  Add to my styles
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
