import Link from "next/link";
import { REPO_URL } from "@/lib/studio/commands";
import { Wordmark } from "@/components/site/Wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-10 text-sm text-ink/60 md:px-8">
        <Wordmark className="text-lg" />
        <span>Open source, MIT. Your agent, your files and your keys stay on your computer.</span>
        <nav className="flex gap-6 sm:ml-auto">
          <Link href="/components" className="hover:text-ink">
            Components
          </Link>
          <Link href="/templates" className="hover:text-ink">
            Templates
          </Link>
          <Link href="/studio" className="hover:text-ink">
            Studio
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
