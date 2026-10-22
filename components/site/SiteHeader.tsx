import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { REPO_URL } from "@/lib/studio/commands";
import { Wordmark } from "@/components/site/Wordmark";

const NAV = [
  { href: "/components", label: "Components" },
  { href: "/templates", label: "Templates" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 md:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-6 text-sm font-medium text-ink/60 sm:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-ink">
              {item.label}
            </Link>
          ))}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">
            GitHub
          </a>
        </nav>
        <Link
          href="/studio"
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-5 text-sm font-semibold text-paper transition-transform hover:-translate-y-0.5"
        >
          Open the studio <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </header>
  );
}
