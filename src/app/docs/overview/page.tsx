import { DocsPage } from "@/components/docs/DocsPage";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { DocsCallout } from "@/components/docs/DocsCallout";
import Link from "next/link";
import { PrivacyFlow } from "@/components/docs/visuals/PrivacyFlow";
import { docsMetadata } from "@/lib/seo/metadata";
import { techArticleJsonLd } from "@/lib/seo/jsonLd";

/*
 * XSS-safe: all values below are hardcoded string literals defined in this file.
 * safeJsonLd() in jsonLd.ts escapes '<' as \u003c. No user input flows into this data.
 */
const articleLd = techArticleJsonLd("Overview — Privacy Protocol for EVM Chains", "Dust Protocol provides stealth addresses (ERC-5564), ZK-UTXO privacy pools with FFLONK proofs, private token swaps, OFAC and FHE compliance, denomination privacy, and IPFS backup. Non-custodial privacy across Flow EVM, Ethereum, Arbitrum, Optimism, and Base.", "/docs/overview");

const features = [
  {
    badge: "ERC-5564 / ERC-6538",
    title: "Stealth Transfers",
    desc: "Send ETH to any .dust name. Funds land in a one-time stealth address that only the recipient can detect and claim — completely invisible on-chain.",
    href: "/docs/stealth-transfers",
    color: "green",
  },
  {
    badge: "ZK-UTXO / FFLONK",
    title: "Privacy Pool",
    desc: "Deposit arbitrary amounts into a global UTXO pool. Withdraw with a FFLONK zero-knowledge proof — no fixed denominations, no on-chain link between deposit and withdrawal.",
    href: "/docs/privacy-pool",
    color: "green",
  },
  {
    badge: "Uniswap V4 / PunchSwap",
    title: "Private Swaps",
    desc: "Swap tokens without revealing which deposit you're spending. On chains with Uniswap V4, the ZK proof is passed as hookData for atomic verification. On Flow EVM, swaps route through PunchSwap V2 via a generic adapter.",
    href: "/docs/privacy-swaps",
    color: "green",
  },
  {
    badge: "OFAC + Zama FHE",
    title: "Compliance",
    desc: "OFAC deposit screening via Chainalysis oracle and on-chain sanctions registry. On Ethereum Sepolia, Zama fhEVM enables confidential compliance — encrypted pool statistics and compliance checks that run entirely on-chain without exposing user data.",
    href: "/docs/compliance",
    color: "amber",
  },
  {
    badge: "2-in-8-out Split",
    title: "Denomination Privacy",
    desc: "Split withdrawals break amount fingerprinting by decomposing outputs into common denomination chunks. The 2-in-8-out split circuit produces up to 8 output UTXOs in a single proof, with batch processing and jittered timing.",
    href: "/docs/privacy-pool",
    color: "amber",
  },
  {
    badge: "Storacha / Filecoin",
    title: "IPFS Backup",
    desc: "ZK circuit artifacts and compliance tree snapshots are pinned to IPFS via Storacha with Filecoin persistence. Proof generation works offline using content-addressed fallbacks — no single point of failure for critical protocol data.",
    href: "/docs/privacy-pool",
    color: "amber",
  },
  {
    badge: "ERC-4337",
    title: "Gasless Claims",
    desc: "Stealth wallets are claimed gas-free. Your stealth key signs a user operation locally; a sponsored paymaster covers the fee so you never expose the key.",
    href: "/docs/stealth-transfers",
    color: "muted",
  },
  {
    badge: ".dust names",
    title: "Payment Links",
    desc: "Register a human-readable name like alice.dust and share custom payment links. Track per-link volume and payment count in your dashboard.",
    href: "/docs/payment-links",
    color: "muted",
  },
  {
    badge: "EIP-7702",
    title: "Flexible Account Types",
    desc: "Works with standard EOAs, ERC-4337 smart accounts, CREATE2 wallets, and EOA-as-smart-account via EIP-7702 — no wallet migration required.",
    href: "/docs/eip-7702",
    color: "muted",
  },
] as const;

export const metadata = docsMetadata("Overview — Privacy Protocol for EVM Chains", "Dust Protocol provides stealth addresses (ERC-5564), ZK-UTXO privacy pools with FFLONK proofs, private token swaps, OFAC and FHE compliance, denomination privacy, and IPFS backup. Non-custodial privacy across Flow EVM, Ethereum, Arbitrum, Optimism, and Base.", "/docs/overview");

export default function OverviewPage() {
  /* articleLd contains only hardcoded string literals from this file, escaped by safeJsonLd */
  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
    <DocsPage
      currentHref="/docs/overview"
      title="Dust Protocol"
      subtitle="Private payments and private swaps across Flow EVM, Ethereum, Arbitrum, Optimism, and Base. Funds dissolve into the blockchain — no on-chain link between sender and recipient."
      badge="OVERVIEW"
    >
      {/* What it is */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">What is Dust?</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-6">
          Dust Protocol is a multi-chain privacy layer deployed across Flow EVM, Ethereum Sepolia, Arbitrum Sepolia,
          OP Sepolia, and Base Sepolia. It lets users send, receive, and swap tokens without creating a public ledger
          trail — the fundamental privacy problem that affects every public blockchain today. Flow EVM serves as the
          primary chain, with full stealth, privacy pool, swap, and compliance infrastructure.
        </p>

        <div className="mb-8">
          <PrivacyFlow />
        </div>

        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          When you receive ETH normally, the entire world can see your address balance, income history, and spending
          patterns. Dust eliminates this by routing all payments through{" "}
          <strong className="text-white">one-time stealth addresses</strong> — each payment lands at a fresh address
          that only the recipient can derive.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          The <strong className="text-white">Privacy Pool</strong> and{" "}
          <strong className="text-white">Privacy Swaps</strong> layers go further: even the act of consolidating
          multiple stealth payments or swapping tokens leaves no traceable fingerprint, thanks to in-browser{" "}
          <strong className="text-white">zero-knowledge proofs</strong>.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mt-4">
          <strong className="text-white">Dust V2</strong> introduces a ZK-UTXO model with arbitrary-amount deposits,
          FFLONK proofs (no trusted setup), split withdrawals for denomination privacy, and a layered compliance
          stack — OFAC sanctions screening via Chainalysis oracle, and confidential compliance via{" "}
          <strong className="text-white">Zama fhEVM</strong> on Ethereum Sepolia where encrypted pool statistics
          and compliance checks run entirely on-chain without exposing user data. ZK circuit artifacts are pinned
          to IPFS via Storacha with Filecoin persistence for censorship-resistant availability.
        </p>
      </section>

      {/* Supported networks */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Supported Networks</h2>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-[rgba(0,255,65,0.2)] rounded-sm text-[rgba(255,255,255,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
            Flow EVM Testnet
            <span className="text-[rgba(255,255,255,0.25)] ml-1">primary</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-[rgba(255,255,255,0.08)] rounded-sm text-[rgba(255,255,255,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFB000]" />
            Ethereum Sepolia
            <span className="text-[rgba(255,255,255,0.25)] ml-1">+ Zama FHE</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-[rgba(255,255,255,0.08)] rounded-sm text-[rgba(255,255,255,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#627EEA]" />
            Arbitrum Sepolia
            <span className="text-[rgba(255,255,255,0.25)] ml-1">testnet</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-[rgba(255,255,255,0.08)] rounded-sm text-[rgba(255,255,255,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF0420]" />
            OP Sepolia
            <span className="text-[rgba(255,255,255,0.25)] ml-1">testnet</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-[rgba(255,255,255,0.08)] rounded-sm text-[rgba(255,255,255,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
            Base Sepolia
            <span className="text-[rgba(255,255,255,0.25)] ml-1">testnet</span>
          </span>
        </div>
        <DocsCallout type="warning" title="Testnet Only">
          Dust Protocol is currently deployed on testnets across all five chains. Do not send mainnet funds.
          Contract addresses may change during the testing phase.
        </DocsCallout>
      </section>

      {/* Feature cards */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Core Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f) => (
            <Link
              key={f.href + f.title}
              href={f.href}
              className="group flex flex-col gap-2 p-4 border border-[rgba(255,255,255,0.06)] rounded-sm hover:border-[rgba(0,255,65,0.15)] hover:bg-[rgba(0,255,65,0.02)] transition-all"
            >
              <div className="flex items-center justify-between">
                <DocsBadge variant={f.color as never}>{f.badge}</DocsBadge>
              </div>
              <p className="text-[13px] font-mono font-semibold text-white group-hover:text-[#00FF41] transition-colors">
                {f.title}
              </p>
              <p className="text-xs text-[rgba(255,255,255,0.45)] leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick start */}
      <section>
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Quick Start</h2>
        <ol className="space-y-2 text-sm text-[rgba(255,255,255,0.6)] leading-relaxed list-none">
          {[
            "Connect your wallet and complete onboarding (takes ~1 minute).",
            "Register a .dust name — this is your private payment address.",
            "Share your /pay/yourname link. Anyone can send you ETH without knowing your real address.",
            "When payments arrive, claim them gas-free from your Activities page.",
            "Optionally deposit claimed funds to the Privacy Pool to consolidate without creating a traceable link.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-5 h-5 rounded-sm bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.15)] flex items-center justify-center text-[9px] font-mono text-[#00FF41] mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Link
            href="/docs/how-it-works"
            className="inline-flex items-center gap-2 text-[12px] font-mono text-[#00FF41] hover:text-white transition-colors"
          >
            Read: How It Works →
          </Link>
        </div>
      </section>
    </DocsPage>
    </>
  );
}
