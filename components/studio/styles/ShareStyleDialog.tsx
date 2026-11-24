"use client";

// Share a saved editing style with the community library: make a short demo from one of this
// project's renders, add an author and tags, then download a submission bundle and open the
// submission form. A maintainer reviews it before it's listed; nothing is published from here.
import { useEffect, useState } from "react";
import { Download, ExternalLink, Film, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { studioFileUrl } from "@/lib/studio/file-url";
import type { EditingStyle } from "@/lib/studio/editing-styles";
import type { AssetEntry } from "@/lib/studio/types";
import {
  COMMUNITY_STYLE_FILES,
  DEMO_MAX_SECONDS,
  fetchCommunityIndex,
  GITHUB_USER,
  normalizePrompt,
  parseCommunityStyleMeta,
  parseTags,
  submissionIssueUrl,
  type CommunityStyleMeta,
} from "@/lib/community-styles";
import { zipStore, type ZipFile } from "@/lib/zip-store";

const AUTHOR_KEY = "agentcut.communityAuthor";
const SUBMITTED_KEY = "agentcut.communitySubmitted";

export function submittedStyles(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(SUBMITTED_KEY) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function markSubmitted(id: string) {
  try {
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify({ ...submittedStyles(), [id]: Date.now() }));
  } catch {}
}

function savedAuthor(): { name: string; github: string } {
  try {
    const value = JSON.parse(localStorage.getItem(AUTHOR_KEY) ?? "{}");
    return { name: String(value.name ?? ""), github: String(value.github ?? "") };
  } catch {
    return { name: "", github: "" };
  }
}

export interface StyleMedia {
  demo: { path: string; version: number } | null;
  poster: { path: string; version: number } | null;
}

const fileUrl = (file: { path: string; version: number }) => `${studioFileUrl("", file.path)}?v=${Math.round(file.version)}`;

export function ShareStyleDialog({
  open,
  onOpenChange,
  style,
  media,
  renders,
  canMakeDemo,
  helperHint,
  onMakeDemo,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  style: EditingStyle;
  media: StyleMedia;
  /** This project's rendered MP4s (renders/…), newest first. */
  renders: AssetEntry[];
  canMakeDemo: boolean;
  helperHint: string | null;
  onMakeDemo(input: { path: string; start: number; duration: number }): Promise<void>;
  onSubmitted(): void;
}) {
  const [render, setRender] = useState(renders[0]?.path ?? "");
  const [start, setStart] = useState("0");
  const [length, setLength] = useState(String(Math.min(8, DEMO_MAX_SECONDS)));
  const [making, setMaking] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [author, setAuthor] = useState(() => savedAuthor().name);
  const [github, setGithub] = useState(() => savedAuthor().github);
  const [description, setDescription] = useState(style.description);
  const [tagText, setTagText] = useState((style.tags ?? []).join(", "));
  const [checks, setChecks] = useState([false, false, false]);
  const [bundling, setBundling] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  // An update to a listed style must be its next revision (the maintainer script refuses anything
  // else). If the catalog can't be read, submit as revision 1 and let review sort it out.
  const [listed, setListed] = useState<{ name: string; author: string; revision: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetchCommunityIndex(undefined, controller.signal)
      .then((index) => {
        const entry = index.styles.find((item) => item.id === style.id);
        setListed(entry ? { name: entry.name, author: entry.author.name, revision: entry.revision } : null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [open, style.id]);
  const revision = listed ? listed.revision + 1 : 1;

  const tags = parseTags(tagText);
  let meta: CommunityStyleMeta | null = null;
  let metaError: string | null = null;
  try {
    meta = parseCommunityStyleMeta({
      version: 1,
      name: style.name,
      description,
      author: { name: author, ...(github.trim() ? { github: github.trim().replace(/^@/, "") } : {}) },
      tags,
      revision,
    });
  } catch (error) {
    metaError = !author.trim()
      ? "Add your name as it should appear on the style."
      : github.trim() && !GITHUB_USER.test(github.trim().replace(/^@/, ""))
        ? "That isn't a GitHub username."
        : error instanceof Error ? error.message : "Check the details.";
  }
  const hasDemo = Boolean(media.demo && media.poster);
  const ready = Boolean(meta && hasDemo && checks.every(Boolean));

  const makeDemo = async () => {
    const startValue = Number(start);
    const lengthValue = Number(length);
    if (!render) return setDemoError("Choose a rendered video.");
    if (!Number.isFinite(startValue) || startValue < 0) return setDemoError("Start must be 0 or more seconds.");
    if (!Number.isFinite(lengthValue) || lengthValue < 2 || lengthValue > DEMO_MAX_SECONDS)
      return setDemoError(`Length must be 2–${DEMO_MAX_SECONDS} seconds.`);
    setMaking(true);
    setDemoError(null);
    try {
      await onMakeDemo({ path: render, start: startValue, duration: lengthValue });
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Could not make the demo.");
    } finally {
      setMaking(false);
    }
  };

  const download = async () => {
    if (!meta || !media.demo || !media.poster) return;
    setBundling(true);
    setBundleError(null);
    try {
      const read = async (file: { path: string; version: number }) => {
        const response = await fetch(fileUrl(file), { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not read ${file.path.split("/").pop()} (${response.status}).`);
        return new Uint8Array(await response.arrayBuffer());
      };
      const encoder = new TextEncoder();
      const files: ZipFile[] = [
        { name: `${style.id}/style.json`, data: encoder.encode(`${JSON.stringify(meta, null, 2)}\n`) },
        { name: `${style.id}/PROMPT.md`, data: encoder.encode(`${normalizePrompt(style.prompt)}\n`) },
        { name: `${style.id}/poster.jpg`, data: await read(media.poster) },
        { name: `${style.id}/demo.mp4`, data: await read(media.demo) },
      ];
      for (const file of files) {
        const name = file.name.split("/")[1] as keyof typeof COMMUNITY_STYLE_FILES;
        if (file.data.length > COMMUNITY_STYLE_FILES[name]) throw new Error(`${name} is too large for the library. Make a shorter demo.`);
      }
      const blob = new Blob([zipStore(files) as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${style.id}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      try {
        localStorage.setItem(AUTHOR_KEY, JSON.stringify({ name: author.trim(), github: github.trim().replace(/^@/, "") }));
      } catch {}
      setDownloaded(true);
    } catch (error) {
      setBundleError(error instanceof Error ? error.message : "Could not build the submission.");
    } finally {
      setBundling(false);
    }
  };

  const CHECKS = [
    "I made this style and the demo, and I'm happy for both to be public. The demo may show my face and voice.",
    "The demo's footage and music are mine or licensed for this use.",
    "I read the editing rules: they contain no personal details and only describe how to edit.",
  ];

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!making && !bundling) onOpenChange(value); }}>
      <DialogContent className="max-h-[92vh] max-w-[min(760px,96vw)] overflow-y-auto sm:max-w-[min(760px,96vw)]">
        <DialogTitle>Share “{style.name}” publicly</DialogTitle>
        <DialogDescription>
          Submit this style to the community library. It&apos;s reviewed before it&apos;s listed, then anyone can add it to
          their Agentcut.
        </DialogDescription>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">1. Demo clip</h3>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="aspect-[9/16] overflow-hidden rounded-lg bg-muted">
              {media.demo ? (
                <video key={fileUrl(media.demo)} src={fileUrl(media.demo)} poster={media.poster ? fileUrl(media.poster) : undefined} muted loop autoPlay playsInline controls className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted-foreground">
                  <Film className="size-5" /> No demo yet
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {renders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This project has no rendered videos. Export a video edited in this style (or open the project you made it
                  on), then come back to make the demo.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="share-render">Rendered video</Label>
                    <select
                      id="share-render"
                      value={render}
                      onChange={(event) => setRender(event.target.value)}
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                    >
                      {renders.map((entry) => (
                        <option key={entry.path} value={entry.path}>{entry.path.replace(/^renders\//, "")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor="share-start">Start (seconds)</Label>
                      <Input id="share-start" inputMode="decimal" value={start} onChange={(event) => setStart(event.target.value)} />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      <Label htmlFor="share-length">Length (2–{DEMO_MAX_SECONDS} s)</Label>
                      <Input id="share-length" inputMode="decimal" value={length} onChange={(event) => setLength(event.target.value)} />
                    </div>
                  </div>
                  <Button type="button" variant="outline" className="self-start" disabled={!canMakeDemo || making} onClick={() => void makeDemo()}>
                    {making ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Film data-icon="inline-start" />}
                    {making ? "Making the demo…" : hasDemo ? "Remake demo" : "Make demo"}
                  </Button>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                The demo is a small copy of part of your render, saved with the style. The render isn&apos;t changed.
                Pick the stretch that shows the style best: the hook usually does.
              </p>
              {!canMakeDemo && helperHint ? <p role="status" className="text-xs text-muted-foreground">{helperHint}</p> : null}
              {demoError ? <p role="alert" className="text-sm text-destructive">{demoError}</p> : null}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">2. Details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-author">Your name</Label>
              <Input id="share-author" value={author} maxLength={60} onChange={(event) => setAuthor(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-github">GitHub username (optional)</Label>
              <Input id="share-github" value={github} maxLength={40} onChange={(event) => setGithub(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-description">Description</Label>
            <Textarea id="share-description" value={description} maxLength={500} rows={3} onChange={(event) => setDescription(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-tags">Tags (comma separated, up to 6)</Label>
            <Input id="share-tags" value={tagText} placeholder="vertical, talking-head, captions" onChange={(event) => setTagText(event.target.value)} />
            {tags.length ? <p className="text-xs text-muted-foreground">{tags.join(" · ")}</p> : null}
          </div>
          {listed ? (
            <p className="text-xs text-muted-foreground">
              “{listed.name}” by {listed.author} is already in the library under this name, so this is sent as revision{" "}
              {revision}. If it isn&apos;t yours, say so in the submission and it will be listed under a new name.
            </p>
          ) : null}
          {metaError ? <p className="text-xs text-muted-foreground">{metaError}</p> : null}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">3. Before you share</h3>
          {CHECKS.map((label, index) => (
            <label key={label} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={checks[index]}
                onCheckedChange={(value) => setChecks((current) => current.map((item, i) => (i === index ? value === true : item)))}
                className="mt-0.5"
              />
              <span>{label}</span>
            </label>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">4. Submit</h3>
          <p className="text-xs text-muted-foreground">
            Download the submission, then open the form on GitHub and drag the zip into it. You need a GitHub account.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!ready || bundling} onClick={() => void download()}>
              {bundling ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
              Download {style.id}.zip
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!ready || !downloaded || !meta}
              onClick={() => {
                if (!meta) return;
                window.open(submissionIssueUrl(meta, style.id), "_blank", "noopener,noreferrer");
                markSubmitted(style.id);
                onSubmitted();
              }}
            >
              <ExternalLink data-icon="inline-start" /> Open submission form
            </Button>
          </div>
          {!hasDemo ? <p className="text-xs text-muted-foreground">Make a demo first.</p> : null}
          {bundleError ? <p role="alert" className="text-sm text-destructive">{bundleError}</p> : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
