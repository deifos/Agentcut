"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, Loader2, PlugZap, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { StudioBridge } from "@/lib/studio/bridge";
import { STUDIO_COMMAND } from "@/lib/studio/commands";
import { formatBytes } from "@/lib/studio/format";
import {
  formatTimeLeft,
  readShare,
  SHARE_API_URL,
  SHARE_AVAILABLE,
  SHARE_HELPER_VERSION,
  shareLink,
  type ShareManifest,
  type ShareProgress,
  type ShareRef,
} from "@/lib/studio/share";
import { isOlderVersion } from "@/lib/version";

const UPDATE_COMMAND = `${STUDIO_COMMAND}@latest`;

/** Follow the helper's studio.share events for one job while `run` is going. */
async function withProgress<T>(
  bridge: StudioBridge,
  onProgress: (progress: ShareProgress) => void,
  run: (job: string) => Promise<T>,
) {
  const job = crypto.randomUUID();
  const off = bridge.on("studio.share", (data) => {
    const progress = data as ShareProgress;
    if (progress.job === job) onProgress(progress);
  });
  try {
    return await run(job);
  } finally {
    off();
  }
}

function ProgressBar({ progress, label }: { progress: ShareProgress | null; label: string }) {
  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        <Loader2 className="size-3.5 animate-spin" />
        {progress?.stage === "preparing" || !progress?.total
          ? "Preparing…"
          : `${label} ${percent}% · ${formatBytes(progress.done)} of ${formatBytes(progress.total)}`}
      </p>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void copy()}
      className="h-auto w-full justify-between gap-2 px-3 py-2.5 text-left font-mono text-xs font-normal"
    >
      <span className="min-w-0 truncate">{value}</span>
      {copied ? <Check className="text-emerald-500" /> : <Copy className="text-muted-foreground" />}
    </Button>
  );
}

function helperProblem(helperVersion: string | null, supported: boolean) {
  if (!SHARE_AVAILABLE) return "Sharing isn't set up on this Agentcut (NEXT_PUBLIC_SHARE_API_URL).";
  if (!supported) {
    return `Share links need helper ${SHARE_HELPER_VERSION} or newer${helperVersion ? ` (yours is ${helperVersion})` : ""}. Stop it (Ctrl+C) and run: ${UPDATE_COMMAND}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sender

interface Shared {
  link: string;
  expiresAt: number;
  bytes: number;
}

export function ShareDialog({
  open,
  onOpenChange,
  slug,
  name,
  helperVersion,
  supported,
  getBridge,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  slug: string;
  name: string;
  helperVersion: string | null;
  /** The helper says it can share (info.features). */
  supported: boolean;
  getBridge(): StudioBridge | null;
}) {
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [working, setWorking] = useState(false);
  const [shared, setShared] = useState<Shared | null>(null);
  const problem = helperProblem(helperVersion, supported);

  const share = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    setWorking(true);
    setProgress(null);
    setShared(null);
    try {
      const result = await withProgress(bridge, setProgress, (job) =>
        bridge.request<{ id: string; key: string; expiresAt: number; bytes: number }>(
          "studio.share.create",
          { slug, api: SHARE_API_URL, job },
          2 * 60 * 60 * 1000,
        ),
      );
      const link = shareLink(result);
      setShared({ link, expiresAt: result.expiresAt, bytes: result.bytes });
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Share link copied.");
      } catch {}
    } catch (error) {
      toast.error(`Couldn't share the project: ${error instanceof Error ? error.message : String(error)}`, { duration: 12000 });
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share “{name}”</DialogTitle>
          <DialogDescription>
            Anyone with the link can open this project in their own Agentcut for 3 days: its scenes, timeline, notes and
            assets. Renders and the chat stay on this computer. Files are encrypted here first; the key is part of the
            link, so only people you send it to can read them.
          </DialogDescription>
        </DialogHeader>
        {problem ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">{problem}</p>
        ) : working ? (
          <ProgressBar progress={progress} label="Encrypting and uploading" />
        ) : shared ? (
          <div className="space-y-2">
            <CopyField value={shared.link} />
            <p className="text-xs text-muted-foreground">
              {formatBytes(shared.bytes)} · expires in {formatTimeLeft(shared.expiresAt)}. Changes you make from now on
              aren&apos;t in this link; share again to send them.
            </p>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {working ? "Hide" : "Close"}
          </Button>
          <Button type="button" onClick={() => void share()} disabled={Boolean(problem) || working}>
            {working ? <Loader2 className="animate-spin" /> : <Link2 />}
            {shared ? "Make a new link" : "Create link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Recipient

type Incoming =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; manifest: ShareManifest; expiresAt: number | null };

export function IncomingShareDialog({
  share,
  connected,
  helperVersion,
  supported,
  getBridge,
  open,
  onHide,
  onOpen,
  onClose,
}: {
  share: ShareRef;
  connected: boolean;
  helperVersion: string | null;
  supported: boolean;
  getBridge(): StudioBridge | null;
  /** Hidden (not dismissed) so the setup steps behind it can be read; the share stays pending. */
  open: boolean;
  onHide(): void;
  onOpen(slug: string): Promise<void>;
  /** Done with it: imported, or "Not now". */
  onClose(): void;
}) {
  const [incoming, setIncoming] = useState<Incoming>({ state: "loading" });
  const [progress, setProgress] = useState<ShareProgress | null>(null);
  const [importing, setImporting] = useState(false);
  // Clicked "Open" before the helper was running: start as soon as it connects.
  const [armed, setArmed] = useState(false);
  const stopWaiting = useRef<(() => void) | null>(null);
  useEffect(() => () => stopWaiting.current?.(), []);

  useEffect(() => {
    let live = true;
    readShare(share).then(
      (result) => live && setIncoming({ state: "ready", ...result }),
      (error: unknown) => live && setIncoming({ state: "error", message: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      live = false;
    };
  }, [share]);

  const problem = connected ? helperProblem(helperVersion, supported) : null;
  const ready = incoming.state === "ready";
  const canImport = ready && connected && !problem && !importing;

  const runImport = async () => {
    const bridge = getBridge();
    if (!bridge) return;
    stopWaiting.current?.();
    stopWaiting.current = null;
    setArmed(false);
    setImporting(true);
    setProgress(null);
    try {
      const result = await withProgress(bridge, setProgress, (job) =>
        bridge.request<{ slug: string; name: string }>(
          "studio.share.import",
          { api: SHARE_API_URL, id: share.id, key: share.key, job },
          2 * 60 * 60 * 1000,
        ),
      );
      await onOpen(result.slug);
      toast.success(`Opened “${result.name}”. It's in your projects now.`);
      onClose();
    } catch (error) {
      toast.error(`Couldn't open the shared project: ${error instanceof Error ? error.message : String(error)}`, {
        duration: 12000,
      });
    } finally {
      setImporting(false);
    }
  };

  /** Open as soon as the helper connects, without another click. */
  const openWhenConnected = () => {
    const bridge = getBridge();
    if (!bridge) return;
    setArmed(true);
    stopWaiting.current = bridge.onStatus((status) => {
      if (status === "connected") void runImport();
    });
  };

  const manifest = incoming.state === "ready" ? incoming.manifest : null;
  const seconds =
    manifest?.project.durationInFrames && manifest.project.fps
      ? `${(manifest.project.durationInFrames / manifest.project.fps).toFixed(1)} s`
      : null;
  const newer = manifest && helperVersion && isOlderVersion(helperVersion, manifest.agentcutVersion);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !importing) onHide();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{manifest ? `“${manifest.name}” was shared with you` : "A shared project"}</DialogTitle>
          <DialogDescription>
            {incoming.state === "loading"
              ? "Reading the share…"
              : incoming.state === "error"
                ? incoming.message
                : [
                    seconds,
                    formatBytes(incoming.manifest.bytes),
                    `${incoming.manifest.files.length} files`,
                    incoming.expiresAt ? `expires in ${formatTimeLeft(incoming.expiresAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        {manifest ? (
          <div className="space-y-3 text-xs">
            <p className="flex gap-2 rounded-xl border border-border bg-muted/50 p-3 text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Projects include scene code that runs in your preview and renders, with the same access as this page,
                including your agent. Only open links from people you trust. It&apos;s copied into your projects; nothing is shared back.
              </span>
            </p>
            {newer ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                Made with Agentcut {manifest.agentcutVersion}, newer than your helper ({helperVersion}). If something looks
                off, update it: {UPDATE_COMMAND}
              </p>
            ) : null}
            {problem ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">{problem}</p>
            ) : !connected ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 font-semibold">
                  <PlugZap className="size-3.5" /> Start Agentcut on this computer to open it
                </p>
                <CopyField value={UPDATE_COMMAND} />
                <p className="text-muted-foreground">
                  {armed
                    ? "Waiting for the helper. The project opens by itself once it starts."
                    : "Run this in a terminal. New to Agentcut? Hide this box for the full setup steps."}
                </p>
              </div>
            ) : null}
            {importing ? <ProgressBar progress={progress} label="Downloading" /> : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={importing}>
            {manifest ? "Not now" : "Close"}
          </Button>
          {manifest ? (
            connected ? (
              <Button type="button" onClick={() => void runImport()} disabled={!canImport}>
                {importing ? <Loader2 className="animate-spin" /> : null}
                Open in Agentcut
              </Button>
            ) : (
              <Button type="button" onClick={openWhenConnected} disabled={armed}>
                {armed ? <Loader2 className="animate-spin" /> : null}
                {armed ? "Waiting for the helper…" : "Open when it's running"}
              </Button>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
