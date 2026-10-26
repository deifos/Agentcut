import { pageMetadata } from "@/lib/seo";
import { SoundEffectsGallery } from "@/components/sfx/SoundEffectsGallery";
import { SFX_LIBRARY } from "@/lib/sfx-library";

const recorded = SFX_LIBRARY.filter((e) => e.recorded).length;

export const metadata = pageMetadata(
  "Free sound effects for video",
  `${SFX_LIBRARY.length} free sound effects to download: clicks, pops, swooshes, whooshes, impacts, risers, logo stings, chimes, glitches and typing. Royalty free for personal and commercial videos, apps and games.`,
  "/sound-effects",
);

export default function SoundEffectsPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 pb-28 pt-14 md:px-8 md:pt-20">
      <p className="site-rise font-mono text-xs uppercase tracking-[0.22em] text-brand">
        {SFX_LIBRARY.length} free sound effects
      </p>
      <h1
        className="site-rise mt-4 max-w-4xl font-display text-[clamp(3rem,7vw,6.5rem)] font-extrabold leading-[0.9] tracking-[-0.05em]"
        style={{ ["--i" as string]: 1 }}
      >
        Sounds that <span className="site-cut">land on the cut.</span>
      </h1>
      <p className="site-rise mt-6 max-w-2xl text-lg text-ink/60" style={{ ["--i" as string]: 2 }}>
        Clicks, pops, whooshes, impacts, risers, logo stings, chimes and glitches. Press play to hear each one,
        download the ones you like, or let your agent pick and place them in Agentcut. Free for personal and
        commercial use.
      </p>
      <div className="mt-14">
        <SoundEffectsGallery />
      </div>
      <section className="mt-20 max-w-3xl text-sm leading-relaxed text-ink/60">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">Licence</h2>
        <p className="mt-3">
          Free to download and use in any project, personal or commercial: videos, apps, games, ads. No credit
          needed. Please don&rsquo;t resell them as a sound pack.
        </p>
        <p className="mt-3">
          The {recorded} recordings are original Agentcut sounds. The designed sounds are rendered from the sound bank
          of{" "}
          <a href="https://github.com/Leonxlnx/earshot" className="underline underline-offset-2 hover:text-ink" target="_blank" rel="noreferrer">
            earshot
          </a>{" "}
          by Leonxlnx (MIT licence,{" "}
          <a href="/sfx/earshot/LICENSE-earshot.txt" className="underline underline-offset-2 hover:text-ink">
            licence text
          </a>
          ).
        </p>
      </section>
    </main>
  );
}
