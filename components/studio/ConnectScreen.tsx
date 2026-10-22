"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Loader2,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import type { StudioBridgeStatus } from "@/lib/studio/bridge";
import { REPO_URL, STUDIO_ADD_DIR_EXAMPLE, STUDIO_COMMAND } from "@/lib/studio/commands";

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void copy()}
      className="mt-2 h-auto w-full justify-between gap-2 whitespace-normal break-words px-3 py-2.5 text-left font-mono text-[13px] font-normal"
    >
      <span>{command}</span>
      {copied ? (
        <Check className="text-emerald-500" />
      ) : (
        <Copy className="text-muted-foreground" />
      )}
    </Button>
  );
}

function Step({
  n,
  title,
  optional,
  children,
}: {
  n: number;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {title}
          {optional ? (
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              optional
            </span>
          ) : null}
        </p>
        {children}
      </div>
    </li>
  );
}

/**
 * Chrome's permission for public pages to reach this computer (the helper on 127.0.0.1).
 * "unknown" where the browser has no such permission.
 */
function useLocalNetworkPermission() {
  const [state, setState] = useState<PermissionState | "unknown">("unknown");
  useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => status && setState(status.state);
    navigator.permissions
      ?.query({ name: "local-network-access" as PermissionName })
      .then((result) => {
        status = result;
        update();
        result.addEventListener("change", update);
      })
      .catch(() => {});
    return () => status?.removeEventListener("change", update);
  }, []);
  return state;
}

export function ConnectScreen({
  status,
  onReconnect,
}: {
  status: StudioBridgeStatus;
  onReconnect(): void;
}) {
  const localNetwork = useLocalNetworkPermission();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Link href="/" className="text-[11px] font-bold uppercase tracking-wider hover:underline">
          Agentcut
        </Link>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:underline"
        >
          GitHub
        </a>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-12">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Agentcut
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Make videos with your coding agent, edit every layer.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Claude Code or Codex builds the video on your computer while you
            watch the preview and timeline here. You need one of them signed in
            and one small helper running.
          </p>
        </div>

        {status === "taken" ? (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold">
              Another Agentcut tab is using the connection.
            </p>
            <p className="mt-1 text-muted-foreground">
              Only one tab can talk to the agent at a time.
            </p>
            <Button type="button" onClick={onReconnect} className="mt-3">
              <RefreshCw /> Use it in this tab
            </Button>
          </div>
        ) : (
          <ol className="space-y-5 text-sm">
            <Step n={1} title="Install Claude Code or Codex and sign in once">
              <p className="text-muted-foreground">
                <a
                  className="underline"
                  href="https://claude.com/claude-code"
                  target="_blank"
                  rel="noreferrer"
                >
                  Claude Code
                </a>{" "}
                (run <code className="rounded bg-muted px-1">claude</code>) or{" "}
                <a
                  className="underline"
                  href="https://developers.openai.com/codex/cli"
                  target="_blank"
                  rel="noreferrer"
                >
                  Codex
                </a>{" "}
                (run <code className="rounded bg-muted px-1">codex</code>) in a
                terminal and sign in. Have both? Switch in the chat. You also
                need Node.js 20 or newer.
              </p>
            </Step>
            <Step n={2} title="Start the helper in a terminal">
              <CopyCommand command={STUDIO_COMMAND} />
              <p className="mt-2 text-xs text-muted-foreground">
                It makes an <code>Agentcut</code> folder in your home
                folder for your videos. Keep the terminal open while you work.
                When Chrome asks to let this page access devices on your local
                network, click <strong>Allow</strong>: that&apos;s how it reaches
                the helper.
              </p>
              {localNetwork === "denied" ? (
                <p className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  Local network access is blocked for this site. Click the icon
                  left of the address bar, allow <strong>Local network
                  access</strong>, then reload.
                </p>
              ) : null}
            </Step>
            <Step n={3} title="Let the agent read your app's code" optional>
              <p className="text-xs text-muted-foreground">
                Making a video about your own app? Point the helper at its
                folder once and the agent rebuilds your real screens, colors and
                copy instead of guessing. It only reads it, and the helper
                remembers it for next time.
              </p>
              <CopyCommand command={STUDIO_ADD_DIR_EXAMPLE} />
            </Step>
          </ol>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {status === "connecting" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Connecting…
            </>
          ) : status === "offline" ? (
            <>
              <PlugZap className="size-3.5" /> Waiting for the helper on this
              computer. This page connects by itself once it starts.
            </>
          ) : null}
        </p>
      </main>
    </div>
  );
}
