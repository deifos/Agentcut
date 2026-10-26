import Image from "next/image";
import Link from "next/link";
import { REPO_URL } from "@/lib/studio/commands";
import { Wordmark } from "@/components/site/Wordmark";

const AUTHOR_URL = "https://x.com/deifosv";
const SITE_URL = "https://vladpalacio.com";

const LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/components", label: "Components" },
  { href: "/loops", label: "Loops" },
  { href: "/sound-effects", label: "Sounds" },
  { href: "/templates", label: "Templates" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:px-8">
        <div>
          <Wordmark className="text-lg" />
          <p className="mt-3 max-w-xs text-ink/60">
            Edit video with a prompt. Open source, MIT. Your agent, your files
            and your keys stay on your computer.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="font-semibold">Product</p>
          <ul className="mt-3 space-y-2 text-ink/60">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-ink"
              >
                Open source on GitHub
              </a>
            </li>
          </ul>
        </nav>
        <div>
          <p className="font-semibold">Built by</p>
          <div className="mt-3 flex items-start gap-3">
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Vlad on X"
              className="shrink-0"
            >
              <Image
                src="/vlad-pfp.jpg"
                alt=""
                width={38}
                height={38}
                unoptimized
                className="size-[38px] rounded-full ring-1 ring-ink/10"
              />
            </a>
            <div>
              <a
                href={SITE_URL}
                target="_blank"
                rel="noreferrer"
                className="font-display font-extrabold tracking-tight hover:underline"
              >
                VLAD
              </a>
              <p className="text-xs text-ink/55">Building tools with AI.</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
                <a
                  href={AUTHOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink hover:text-brand"
                >
                  Follow me on X ↗
                </a>
                <a
                  href={SITE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink/60 hover:text-brand"
                >
                  vladpalacio.com ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
