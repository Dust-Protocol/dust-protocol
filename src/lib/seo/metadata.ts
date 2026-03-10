import type { Metadata } from "next";

export const SITE_URL = "https://dustprotocol.app";
export const SITE_NAME = "Dust Protocol";
export const TWITTER_HANDLE = "@DustProtocolApp";


export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dust Protocol — Private Transfers on Flow",
    template: "%s | Dust Protocol",
  },
  description:
    "Send and receive crypto privately on Flow using stealth addresses (ERC-5564) and zero-knowledge proofs. Non-custodial privacy for Flow EVM payments, swaps, and DeFi. Gasless claims, .dust usernames, and private token swaps.",
  keywords: [
    "stealth address",
    "stealth address Ethereum",
    "private crypto transfer",
    "send crypto privately",
    "anonymous crypto payments",
    "ERC-5564",
    "ERC-6538",
    "zero knowledge proof",
    "ZK proof Ethereum",
    "privacy pool",
    "privacy pool crypto",
    "private token swap",
    "anonymous token swap",
    "private DEX swap",
    "Flow",
    "Flow EVM",
    "Flow blockchain",
    "Flow privacy",
    "Flow privacy protocol",
    "private DeFi",
    "ZK-UTXO",
    "Dust Protocol",
    "stealth wallet",
    "gasless crypto claim",
    "ERC-4337 stealth",
    "Uniswap V4 privacy",
    "Poseidon hash",
    "Groth16 proof",
    "FFLONK proof",
    "private Flow payment",
    "untraceable crypto transfer",
    "blockchain privacy tool",
    "non-custodial privacy",
    "EIP-7702",
    ".dust name",
    "crypto payment link",
    "stealth meta-address",
  ],
  authors: [{ name: "Dust Protocol", url: SITE_URL }],
  creator: "Dust Protocol",
  publisher: "Dust Protocol",
  category: "Cryptocurrency",
  classification: "Privacy Protocol",
  openGraph: {
    type: "website",
    title: "Dust Protocol — Private Transfers on Flow",
    description:
      "Send and receive crypto privately on Flow with stealth addresses and zero-knowledge proofs. Non-custodial privacy for Flow EVM payments, swaps, and DeFi.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    images: [
      {
        url: `${SITE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Dust Protocol — Private Transfers on Flow",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dust Protocol — Private Transfers on Flow",
    description:
      "Send and receive crypto privately on Flow with stealth addresses and zero-knowledge proofs. Non-custodial privacy for Flow EVM payments, swaps, and DeFi.",
    images: [`${SITE_URL}/opengraph-image`],
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/docs/feed.xml",
    },
  },
  other: {
    "google-site-verification": "REPLACE_WITH_VERIFICATION_CODE",
  },
};

export function docsMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: path,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  };
}
