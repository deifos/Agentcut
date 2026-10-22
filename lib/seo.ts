import type { Metadata } from "next";

// Keep canonical URLs independent of the request host (including preview hosts).
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_APP_URL || "https://agentcut.synteq.app",
).origin;
export const SITE_TITLE = "Agentcut - Edit video with a prompt";
export const SITE_DESCRIPTION =
  "Create and edit videos with Claude Code or Codex. An open-source video studio with Remotion scenes, motion graphics, a live timeline, and MP4 export.";
export const SHARE_IMAGE = {
  url: "/og/agentcut.jpg",
  width: 1200,
  height: 630,
  alt: "Agentcut: Edit video with a prompt. Open source, with Claude Code and Codex.",
};

export function pageMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  const shareTitle = title === SITE_TITLE ? title : `${title} | Agentcut`;
  return {
    title: title === SITE_TITLE ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Agentcut",
      url: path,
      title: shareTitle,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [SHARE_IMAGE],
    },
  };
}
