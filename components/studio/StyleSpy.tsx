"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StudioBridge } from "@/lib/studio/bridge";
import { studioFileUrl } from "@/lib/studio/bundle";
import { uploadToProject } from "@/lib/studio/export";
import type { AssetEntry } from "@/lib/studio/types";

// Mirrors ReferenceJob in packages/agentcut/src/studio/references.ts.
interface ReferenceJob {
  id: string;
  slug: string;
  url: string | null;
  browser: string | null;
  stage: "setup" | "downloading" | "frames" | "ready" | "failed";
  progress: number | null;
  detail?: string;
  path?: string;
  dir?: string;
  error?: { code: string; message: string };
}

const BROWSERS: Record<string, string> = {
  chrome: "Chrome",
  brave: "Brave",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
};

const DOMAINS = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be", "x.com", "twitter.com"];

function referenceUrl(raw: string) {
  try {
    const url = new URL(raw.trim());
    const ok =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      DOMAINS.some(
        (d) => url.hostname === d || url.hostname.endsWith(`.${d}`),
      );
    return ok ? url.href : null;
  } catch {
    return null;
  }
}

function stageLabel(job: ReferenceJob) {
  if (job.stage === "setup") return job.detail ?? "Getting ready…";
  if (job.stage === "downloading")
    return `Downloading… ${Math.round((job.progress ?? 0) * 100)}%`;
  if (job.stage === "frames") return "Preparing frames for your agent…";
  return "";
}

export function StyleSpyTab({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Style Spy"
      title="Style Spy"
      className="flex w-7 flex-col items-center gap-2 rounded-r-lg border border-l-0 border-brand/70 bg-background py-2.5 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
    >
      <ScanEye className="size-3.5 text-brand" />
      <span className="text-[10px] font-black tracking-wider uppercase [writing-mode:vertical-rl]">
        Style Spy
      </span>
    </button>
  );
}

export function StyleSpy({
  open,
  onOpenChange,
  slug,
  assets,
  disabled,
  running,
  getBridge,
  onSend,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  slug: string;
  assets: AssetEntry[];
  disabled: boolean;
  running: boolean;
  getBridge(): StudioBridge | null;
  onSend(text: string): Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState("");
  const [job, setJob] = useState<ReferenceJob | null>(null);
  const [browsers, setBrowsers] = useState<string[]>([]);
  const [browser, setBrowser] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // "Copy this style" pressed while the reference is still coming in: send it once it's ready.
  const applyOnReady = useRef(false);
  const references = assets
    .filter(
      (a) => a.kind === "video" && a.path.startsWith("assets/references/"),
    )
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const preview =
    references.find((a) => a.path === selected) ??
    (selected ? undefined : references.at(-1));
  const working =
    job !== null && job.stage !== "ready" && job.stage !== "failed";
  const locked = disabled || busy || working;
  const pendingUrl = referenceUrl(url);
  const newLink = pendingUrl !== null && pendingUrl !== job?.url;
  const canRetryWithLogin =
    job?.stage === "failed" &&
    job.url !== null &&
    (job.error?.code === "login_required" || job.error?.code === "cookies");
  const browserChoices = browsers.length ? browsers : Object.keys(BROWSERS);
  const chosenBrowser = browserChoices.includes(browser)
    ? browser
    : browserChoices[0];

  const onReference = useEffectEvent((next: ReferenceJob) => {
    if (next.slug !== slug || next.id !== job?.id) return;
    setJob(next);
    if (next.stage === "failed") applyOnReady.current = false;
    if (next.stage !== "ready" || !next.path) return;
    setSelected(next.path);
    if (applyOnReady.current) {
      applyOnReady.current = false;
      void apply(next.path);
    }
  });

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    const off = bridge.on("studio.reference", (data) =>
      onReference(data as ReferenceJob),
    );
    return () => {
      off();
    };
  }, [getBridge]);

  // Which browsers have a login to offer, and any import still running (after a page reload).
  useEffect(() => {
    const bridge = getBridge();
    if (!bridge || disabled) return;
    let cancelled = false;
    bridge
      .request<{ jobs?: ReferenceJob[]; browsers?: string[] }>(
        "studio.reference.jobs",
        { slug },
      )
      .then((result) => {
        if (cancelled) return;
        setBrowsers(result.browsers ?? []);
        const active = result.jobs?.find(
          (j) => j.stage !== "ready" && j.stage !== "failed",
        );
        if (active) setJob((current) => current ?? active);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [getBridge, slug, disabled]);

  async function start(method: string, params: Record<string, unknown>) {
    const bridge = getBridge();
    if (!bridge) throw new Error("The studio helper isn't connected.");
    setJob(await bridge.request<ReferenceJob>(method, { slug, ...params }));
  }

  async function importUrl(raw: string, thenApply = false) {
    setError("");
    setNotice("");
    const source = referenceUrl(raw);
    if (!source) {
      setError("Paste an HTTPS video link from Instagram, TikTok, YouTube, or X.");
      return;
    }
    setBusy(true);
    try {
      applyOnReady.current = thenApply;
      await start("studio.reference.import", { url: source });
    } catch (e) {
      applyOnReady.current = false;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function retry(withLogin: boolean) {
    if (!job) return;
    setError("");
    setBusy(true);
    try {
      await start("studio.reference.import", {
        id: job.id,
        ...(withLogin ? { browser: chosenBrowser } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setError("");
    setNotice("");
    if (
      !/\.(mp4|webm|mov|m4v)$/i.test(file.name) ||
      file.size > 200 * 1024 * 1024
    ) {
      setError("Use an MP4, WebM, MOV, or M4V video under 200 MB.");
      return;
    }
    setBusy(true);
    try {
      const path = await uploadToProject(
        slug,
        `assets/references/${crypto.randomUUID()}/video.${file.name.split(".").pop()!.toLowerCase()}`,
        file,
      );
      setSelected(path);
      // Frames for the agent, like an imported link.
      await start("studio.reference.prepare", { path });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function apply(path: string) {
    setBusy(true);
    setError("");
    try {
      const dir = path.slice(0, path.lastIndexOf("/"));
      const extra = notes.trim();
      await onSend(
        `Style Spy: copy the editing style of the reference video ${JSON.stringify(path)} onto my video. Follow references/style-spy.md: analyze ${dir} (reference.json, the frames and a transcript; if reference.json is missing or has no shots, call agentcut_import_reference with this path first), write the recipe, back up my edit, then apply it. Copy its layouts and when they switch (split screens, full-screen cards, what fills each part), cut rhythm, captions and how they animate, every motion graphic and how it enters, transitions, zooms, color and effects, using my own footage, words and brand. Tell me what you couldn't match with my material.${extra ? ` Also: ${extra}` : ""}`,
      );
      setNotice("Sent to your agent. Follow along in chat.");
    } catch {
      setError("Could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyStyle() {
    if (newLink) void importUrl(url, true);
    else if (working) {
      applyOnReady.current = true;
      setNotice("Will start as soon as the reference is ready.");
    } else if (preview) void apply(preview.path);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Style Spy</DialogTitle>
          <DialogDescription>
            Copy the look of a video you like: its cuts, captions, motion and
            transitions.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newLink) void importUrl(url);
          }}
        >
          <Input
            aria-label="Reference video URL"
            placeholder="Paste an Instagram, TikTok, YouTube, or X link"
            value={url}
            disabled={disabled}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (!locked && referenceUrl(pasted)) void importUrl(pasted);
            }}
          />
        </form>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file && !locked) void upload(file);
          }}
          className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground hover:bg-muted/50 ${dragging ? "border-brand bg-brand/10 text-foreground" : ""} ${locked ? "pointer-events-none opacity-60" : ""}`}
        >
          or drop a video here,&nbsp;
          <span className="underline underline-offset-2">browse</span>
          <input
            type="file"
            className="sr-only"
            accept="video/mp4,video/webm,video/quicktime,.m4v"
            disabled={locked}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        {working && job && (
          <div role="status" className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{stageLabel(job)}</span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() =>
                  void getBridge()
                    ?.request("studio.reference.cancel", { id: job.id })
                    .catch(() => undefined)
                }
              >
                Cancel
              </button>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={
                  job.stage === "downloading"
                    ? "h-full bg-brand transition-[width]"
                    : "h-full w-1/3 animate-pulse bg-brand/60"
                }
                style={
                  job.stage === "downloading"
                    ? { width: `${Math.round((job.progress ?? 0) * 100)}%` }
                    : undefined
                }
              />
            </div>
          </div>
        )}
        {job?.stage === "failed" && job.error?.code !== "cancelled" && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
          >
            <p className="text-destructive">{job.error?.message}</p>
            {canRetryWithLogin ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Sign in to the site in your browser and check you can watch
                  the video there, then retry. Agentcut uses that login once,
                  for this video only, and never saves it. Your computer may
                  ask to let it read the browser’s saved logins: click Allow.
                </p>
                <div className="flex gap-2">
                  <select
                    aria-label="Browser to use"
                    className="rounded-md border bg-background px-2 text-sm"
                    value={chosenBrowser}
                    onChange={(e) => setBrowser(e.target.value)}
                  >
                    {browserChoices.map((b) => (
                      <option key={b} value={b}>
                        {BROWSERS[b] ?? b}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={locked}
                    onClick={() => void retry(true)}
                  >
                    Retry with my browser login
                  </Button>
                </div>
              </>
            ) : job.url &&
              (job.error?.code === "network" ||
                job.error?.code === "failed" ||
                job.error?.code === "setup") ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={locked}
                onClick={() => void retry(false)}
              >
                Try again
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Or drop the video file above.
            </p>
          </div>
        )}
        {preview && (
          <video
            key={preview.path}
            src={studioFileUrl(slug, preview.path)}
            controls
            playsInline
            preload="metadata"
            aria-label="Style reference preview"
            className="max-h-56 w-full rounded-lg bg-black"
            onError={() =>
              setError(
                "This video could not play in the browser. Try uploading an MP4 with H.264 video.",
              )
            }
          />
        )}
        {references.length > 1 && (
          <select
            aria-label="Saved references"
            className="w-full rounded-md border bg-background p-1.5 text-xs"
            value={preview?.path ?? ""}
            onChange={(e) => {
              setSelected(e.target.value);
              setNotice("");
            }}
          >
            {references.map((a, i) => (
              <option key={a.path} value={a.path}>
                Reference {i + 1} · {new Date(a.updatedAt).toLocaleString()}
              </option>
            ))}
          </select>
        )}
        <Textarea
          aria-label="Anything to change"
          placeholder="Anything to keep or change? (optional)"
          rows={2}
          className="min-h-0 resize-none text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
          disabled={
            disabled ||
            busy ||
            running ||
            (!newLink && !working && !preview)
          }
          onClick={copyStyle}
        >
          Copy this style
        </Button>
      </DialogContent>
    </Dialog>
  );
}
