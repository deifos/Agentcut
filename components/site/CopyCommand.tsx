"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** A shell command as a chip; click copies it. */
export function CopyCommand({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${command}`}
      className={cn(
        "group inline-flex h-12 items-center gap-3 rounded-full border border-ink/10 bg-background/70 pl-5 pr-2 font-mono text-sm text-ink transition-colors hover:border-ink/25",
        className,
      )}
    >
      <span className="text-brand">$</span>
      {command}
      <span className="flex size-8 items-center justify-center rounded-full bg-ink/5 text-ink/60 transition-colors group-hover:bg-ink group-hover:text-paper">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </span>
    </button>
  );
}
