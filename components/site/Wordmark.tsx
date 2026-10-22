import Link from "next/link";
import { cn } from "@/lib/utils";

/** "agentcut", with the cut in the brand color. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Agentcut home"
      className={cn("font-display text-xl font-extrabold tracking-[-0.04em] text-ink", className)}
    >
      agent<span className="text-brand">cut</span>
    </Link>
  );
}
