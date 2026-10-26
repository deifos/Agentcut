import { pageMetadata } from "@/lib/seo";
import { BrollGallery } from "@/components/broll/BrollGallery";

export const metadata = pageMetadata(
  "Free archival b-roll footage",
  "Thousands of free public-domain film shots from the 1900s to the 1970s: cities, factories, space, crowds, nature, newsreels and home movies. Search by meaning and download for personal and commercial videos.",
  "/b-roll",
);

export default function BrollPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-28 pt-14 md:px-8 md:pt-20">
      <p className="site-rise font-mono text-xs uppercase tracking-[0.22em] text-brand">Free archival b-roll</p>
      <h1
        className="site-rise mt-4 max-w-4xl font-display text-[clamp(3rem,7vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.05em]"
        style={{ ["--i" as string]: 1 }}
      >
        Old films, <span className="site-cut">new edits.</span>
      </h1>
      <p className="site-rise mt-6 max-w-2xl text-lg text-ink/60" style={{ ["--i" as string]: 2 }}>
        Public-domain shots cut from industrial films, newsreels and home movies. Describe what you need, like
        &ldquo;crowd celebrating&rdquo; or &ldquo;lonely city at night&rdquo;, hover to play, download the ones
        you like, or let your agent match a shot to every line in Agentcut.
      </p>
      <div className="mt-14">
        <BrollGallery />
      </div>
      <section className="mt-20 max-w-3xl text-sm leading-relaxed text-ink/60">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Licence</h2>
        <p className="mt-3">
          Every shot comes from a film marked public domain on the{" "}
          <a href="https://archive.org" className="underline underline-offset-2 hover:text-ink" target="_blank" rel="noreferrer">
            Internet Archive
          </a>{" "}
          (Prelinger Archives, FedFlix, NASA and others): free for personal and commercial use, no credit needed.
          Each card links to its source film. Logos and brand names that appear in a shot can still be
          trademarks, and the descriptions are written by a vision model, so check a shot before you rely on it.
        </p>
      </section>
    </main>
  );
}
