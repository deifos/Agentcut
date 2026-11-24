import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { readCommunityCatalog, readCommunityPrompt } from "@/lib/community-styles-read";
import { communityFileUrl, communityStudioHash } from "@/lib/community-styles";

// Only catalog styles exist: any other id 404s instead of rendering on demand.
export const dynamicParams = false;

function find(id: string) {
  return readCommunityCatalog().styles.find((style) => style.id === id) ?? null;
}

export function generateStaticParams() {
  return readCommunityCatalog().styles.map((style) => ({ id: style.id }));
}

export async function generateMetadata({ params }: PageProps<"/templates/community/[id]">): Promise<Metadata> {
  const { id } = await params;
  const style = find(id);
  if (!style) notFound();
  return pageMetadata(
    `${style.name} · community editing style`,
    `${style.description} A free editing style for Agentcut by ${style.author.name}.`,
    `/templates/community/${id}`,
  );
}

export default async function CommunityStylePage({ params }: PageProps<"/templates/community/[id]">) {
  const { id } = await params;
  const style = find(id);
  if (!style) notFound();
  const prompt = readCommunityPrompt(style.id);
  return (
    <main className="mx-auto max-w-7xl px-5 pb-28 pt-10 md:px-8">
      <Link
        href="/templates#community"
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 underline-offset-4 hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" /> Community styles
      </Link>
      <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex items-center justify-center overflow-hidden rounded-[28px] bg-black md:sticky md:top-24 md:self-start">
          {style.demo ? (
            <video
              src={communityFileUrl(style.demo)}
              poster={communityFileUrl(style.poster)}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="block max-h-[80vh] w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={communityFileUrl(style.poster)} alt="" className="block max-h-[80vh] w-full object-contain" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Community editing style</p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[0.9] tracking-[-0.05em]">
            {style.name}
          </h1>
          <p className="mt-4 text-sm text-ink/50">
            by{" "}
            {style.author.github ? (
              <a className="underline underline-offset-4 hover:text-ink" href={`https://github.com/${style.author.github}`}>
                {style.author.name}
              </a>
            ) : (
              style.author.name
            )}
            {" · "}revision {style.revision}
          </p>
          <p className="mt-6 max-w-2xl text-lg text-ink/70">{style.description}</p>
          {style.tags.length ? (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tags">
              {style.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/60">{tag}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={`/studio${communityStudioHash(style.id)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-background hover:bg-ink/85"
            >
              Open in Agentcut <ArrowUpRight className="size-4" />
            </a>
            <span className="text-sm text-ink/50">Opens Styles → Community in the studio, with this style ready to add.</span>
          </div>
          <section className="mt-14" aria-labelledby="rules-title">
            <h2 id="rules-title" className="font-display text-2xl font-extrabold tracking-tight">
              The editing rules
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/60">
              This is everything the agent is told. It works on your own footage and picks fresh text, B-roll and sound
              for it.
            </p>
            <pre className="mt-6 max-h-[70vh] overflow-y-auto whitespace-pre-wrap break-words rounded-[22px] border border-ink/10 bg-ink/[0.03] p-6 font-sans text-sm leading-relaxed text-ink/80">
              {prompt}
            </pre>
          </section>
        </div>
      </div>
    </main>
  );
}
