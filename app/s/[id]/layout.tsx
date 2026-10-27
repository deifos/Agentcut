import type { Metadata } from "next";

// Share links are private: keep them out of search results.
export const metadata: Metadata = {
  title: "A shared Agentcut project",
  robots: { index: false, follow: false },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
