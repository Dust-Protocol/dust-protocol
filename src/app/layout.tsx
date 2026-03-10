import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { AuthLayoutWrapper } from "./auth-layout-wrapper";
import { ROOT_METADATA } from "@/lib/seo/metadata";
import {
  organizationJsonLd,
  webApplicationJsonLd,
  webSiteJsonLd,
  definedTermSetJsonLd,
  softwareSourceCodeJsonLd,
} from "@/lib/seo/jsonLd";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#06080F" },
    { media: "(prefers-color-scheme: light)", color: "#06080F" },
  ],
};

export const metadata: Metadata = {
  ...ROOT_METADATA,
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://sepolia.etherscan.io" />
        <link rel="dns-prefetch" href="https://auth.privy.io" />
        <link rel="preconnect" href="https://auth.privy.io" crossOrigin="anonymous" />
        <link rel="search" type="application/opensearchdescription+xml" title="Dust Protocol" href="/opensearch.xml" />
        <link rel="alternate" type="application/rss+xml" title="Dust Protocol Docs" href="/docs/feed.xml" />
      </head>
      <body className="bg-[#06080F] text-white font-mono selection:bg-[#00FF41] selection:text-black">
        {/* XSS-safe: all values are hardcoded string literals from jsonLd.ts. safeJsonLd() escapes '<' as \u003c. No user input. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: organizationJsonLd() }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: webApplicationJsonLd() }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: webSiteJsonLd() }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: definedTermSetJsonLd() }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: softwareSourceCodeJsonLd() }}
        />
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,255,65,0.04),transparent_60%)]" />
        <div className="relative z-10">
          <Providers>
            <AuthLayoutWrapper>{children}</AuthLayoutWrapper>
          </Providers>
          <Analytics />
        </div>
      </body>
    </html>
  );
}
