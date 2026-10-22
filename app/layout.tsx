import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, Figtree, Geist_Mono, Noto_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agentcut.synteq.app";
const DESCRIPTION =
  "Open-source video studio you edit with a prompt. Claude Code or Codex writes the scenes, motion graphics and music while you watch the preview and timeline update live.";

export const metadata: Metadata = {
  title: {
    default: "Agentcut - Edit video with a prompt",
    template: "%s | Agentcut",
  },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Agentcut",
    title: "Agentcut - Edit video with a prompt",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentcut - Edit video with a prompt",
    description: DESCRIPTION,
  },
  applicationName: "Agentcut",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${figtree.variable} ${bricolage.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();",
          }}
        />
      </head>
      <body className="antialiased">
        <TooltipProvider>
          {children}
          <Toaster style={{ zIndex: 9999 }} />
        </TooltipProvider>
      </body>
    </html>
  );
}
