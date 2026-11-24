"use client";

// Community editing styles on the site: poster cards whose demo plays on hover, each linking to
// its own page.
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { communityFileUrl, type CommunityStyleEntry } from "@/lib/community-styles";

export function CommunityStyleCard({ style }: { style: CommunityStyleEntry }) {
  return (
    <Link
      href={`/templates/community/${style.id}`}
      className="group flex flex-col overflow-hidden rounded-[22px] border border-ink/10 bg-background focus-visible:outline-2 focus-visible:outline-brand"
      onMouseEnter={(event) => void event.currentTarget.querySelector("video")?.play().catch(() => {})}
      onMouseLeave={(event) => event.currentTarget.querySelector("video")?.pause()}
    >
      <div className="relative aspect-[9/16] bg-black">
        {style.demo ? (
          <video
            src={communityFileUrl(style.demo)}
            poster={communityFileUrl(style.poster)}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={communityFileUrl(style.poster)} alt="" loading="lazy" className="absolute inset-0 size-full object-contain" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl font-extrabold tracking-tight">{style.name}</h3>
        <p className="mt-1 text-xs text-ink/50">by {style.author.name}</p>
        <p className="mt-3 line-clamp-3 text-sm text-ink/60">{style.description}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-ink underline-offset-4 group-hover:underline">
          See the style <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );
}
