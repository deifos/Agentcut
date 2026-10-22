import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata(
    "Video studio",
    "Edit your videos with a coding agent in the Agentcut studio.",
    "/studio",
  ),
  robots: { index: false, follow: true },
};

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
