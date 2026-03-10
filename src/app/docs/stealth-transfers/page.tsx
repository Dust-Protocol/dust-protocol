import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsStepList } from "@/components/docs/DocsStepList";
import { DocsBadge } from "@/components/docs/DocsBadge";
import Link from "next/link";
import { ECDHKeyDerivation } from "@/components/docs/visuals/ECDHKeyDerivation";
import { docsMetadata } from "@/lib/seo/metadata";
import { techArticleJsonLd } from "@/lib/seo/jsonLd";

/* XSS-safe: all values below are hardcoded string literals; safeJsonLd() escapes < as \u003c */
const articleLd = techArticleJsonLd("Stealth Transfers — Private Payments with ERC-5564", "Send ETH privately to any .dust name. Each payment lands at a unique one-time stealth address derived via ECDH that only the recipient can detect.", "/docs/stealth-transfers");

export const metadata = docsMetadata("Stealth Transfers — Private Payments with ERC-5564", "Send ETH privately to any .dust name. Each payment lands at a unique one-time stealth address derived via ECDH that only the recipient can detect.", "/docs/stealth-transfers");

export default function StealthTransfersPage() {
  return (
    <>
    {/* XSS-safe: articleLd is built from hardcoded string literals; safeJsonLd escapes < as \u003c */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
    <DocsPage
      currentHref="/docs/stealth-transfers"
      title="Stealth Transfers"
      subtitle="Send ETH privately to any .dust name. Each payment lands at a unique one-time address that only the recipient can detect."
      badge="CORE FEATURE"
    >

      {/* The problem */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">The Problem</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          On any public EVM chain, every transaction is permanently visible. When someone pays you at your regular
          wallet address, anyone can: see your total balance, trace every prior payment, learn your income, and
          profile your spending habits. Sharing your address is a privacy risk.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          Stealth transfers solve this by making each payment land at a fresh, unlinkable, one-time address — while
          still being discoverable by the recipient through a secret only they hold.
        </p>
      </section>

      {/* How it works */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">How Stealth Transfers Work</h2>

        <div className="mb-8">
          <ECDHKeyDerivation />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="p-4 border border-[rgba(255,255,255,0.06)] rounded-sm">
            <p className="text-[10px] font-mono tracking-widest text-[rgba(255,255,255,0.25)] uppercase mb-2">Sender has</p>
            <p className="text-xs text-[rgba(255,255,255,0.6)]">Recipient's <strong className="text-white">stealth meta-address</strong> — their two public keys (spendKey, viewKey) fetched from <code className="text-[10px] bg-[rgba(255,255,255,0.06)] px-1 rounded-sm">StealthNameRegistry</code>.</p>
          </div>
          <div className="p-4 border border-[rgba(255,255,255,0.06)] rounded-sm">
            <p className="text-[10px] font-mono tracking-widest text-[rgba(255,255,255,0.25)] uppercase mb-2">Recipient has</p>
            <p className="text-xs text-[rgba(255,255,255,0.6)]">Their <strong className="text-white">stealth private keys</strong> — derived from their wallet signature + PIN via PBKDF2. Never stored, always recomputed locally.</p>
          </div>
        </div>

        <DocsStepList steps={[
          {
            title: "Sender picks a random scalar r",
            children: <>A fresh random number <code>r</code> is generated in the browser for every payment.
              This is the <strong>ephemeral private key</strong> — it produces a unique payment every time,
              even if the same sender pays the same recipient repeatedly.</>,
          },
          {
            title: "Compute shared secret via ECDH",
            children: <>Using elliptic curve Diffie-Hellman on secp256k1:
              <code> sharedSecret = r × viewKey</code>. Only someone who knows either <code>r</code> (the
              sender's ephemeral secret) or <code>viewKey</code> (the recipient's private view key) can
              compute this value.</>,
          },
          {
            title: "Derive the stealth address",
            children: <><code>stealthAddress = spendKey + hash(sharedSecret) × G</code>. This is a normal
              Ethereum address. Nothing on-chain identifies it as belonging to any particular person.
              The sender computes <code>R = r × G</code> (the ephemeral public key) to publish as a hint.</>,
          },
          {
            title: "Send ETH + publish announcement",
            children: <>ETH is transferred directly to <code>stealthAddress</code>. Simultaneously, the sender
              calls <code>ERC5564Announcer.announce(schemeId, stealthAddress, R, metadata)</code>. This emits
              a public event — it's the broadcast hint that all recipient scanners read.</>,
          },
          {
            title: "Recipient's scanner detects the payment",
            children: <>The recipient's browser scanner fetches all recent announcements. For each one, it computes
              <code> sharedSecret = viewKey × R</code> and checks if the derived stealth address matches.
              When it does, the payment is detected and shown in Activities.</>,
          },
          {
            title: "Gasless claim via ERC-4337",
            children: <>The recipient clicks Claim. The browser derives the stealth private key
              <code> (spendKey + hash(sharedSecret))</code> and signs a UserOperation. A DustPaymaster-sponsored
              relayer submits it — a <code>StealthAccount</code> is deployed at the stealth address and immediately
              drains its balance to the recipient's chosen claim address. Gas is zero for the recipient.</>,
          },
        ]} />
      </section>

      {/* .dust names */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">.dust Names</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Instead of sharing two raw public keys, users register a readable name on the{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">StealthNameRegistry</code> contract.
          Names are up to 32 characters and end with <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">.dust</code>.
        </p>

        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Name type</th>
                <th className="text-left py-2 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Example</th>
                <th className="text-left py-2 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Use case</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              <tr><td className="py-2.5 pr-6 text-white">Primary name</td><td className="py-2.5 pr-6 text-[#00FF41]">alice.dust</td><td className="py-2.5 text-[rgba(255,255,255,0.5)]">Main identity</td></tr>
              <tr><td className="py-2.5 pr-6 text-white">Sub-account</td><td className="py-2.5 pr-6 text-[#00FF41]">work.alice.dust</td><td className="py-2.5 text-[rgba(255,255,255,0.5)]">Segment payment streams</td></tr>
              <tr><td className="py-2.5 pr-6 text-white">Custom link</td><td className="py-2.5 pr-6 text-[#00FF41]">/pay/alice/freelance</td><td className="py-2.5 text-[rgba(255,255,255,0.5)]">Track per-campaign analytics</td></tr>
            </tbody>
          </table>
        </div>

        <DocsCallout type="tip" title="Sub-accounts">
          Sub-accounts (e.g. <code>work.alice.dust</code>) use the same stealth key pair but register separately
          — allowing different payment streams to flow to the same recipient without any on-chain connection.
        </DocsCallout>
      </section>

      {/* Security model */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Security Model</h2>
        <div className="space-y-3">
          {[
            { label: "spendKey", desc: "The private key that controls stealth funds. Derived from wallet signature + PIN. Never leaves the browser." },
            { label: "viewKey", desc: "Used only for scanning. Allows detecting incoming payments without spending authority. The public part (viewKey × G) is on-chain." },
            { label: "Ephemeral key r", desc: "Generated fresh per payment by the sender. Discarded after the announcement. Creates unlinkability." },
            { label: "Announcements", desc: "Published on-chain but contain no decryptable private information. Only viewKey holders can match them to stealth addresses." },
            { label: "V2 Keys (BN254)", desc: "DustPool V2 uses separate keys on the BN254 curve for FFLONK proofs. The spending key and nullifier key are derived from the same wallet signature + PIN but reduced modulo the BN254 field order." },
          ].map(({ label, desc }) => (
            <div key={label} className="flex gap-4 p-3 border border-[rgba(255,255,255,0.05)] rounded-sm">
              <code className="shrink-0 text-[11px] text-[#00FF41] mt-0.5">{label}</code>
              <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <DocsCallout type="tip" title="Works with DustPool V2">
        Stealth transfers are the first step in the Dust privacy pipeline. After claiming stealth payments,
        deposit them into <strong>DustPool V2</strong> to break the fan-in correlation. V2 supports arbitrary
        amounts — no need to split claims into fixed denominations before depositing.
      </DocsCallout>

      {/* Standards */}
      <section>
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Standards</h2>
        <div className="flex flex-wrap gap-2">
          <DocsBadge variant="green">ERC-5564</DocsBadge>
          <DocsBadge variant="green">ERC-6538</DocsBadge>
          <DocsBadge variant="amber">ERC-4337</DocsBadge>
          <DocsBadge variant="muted">secp256k1 ECDH</DocsBadge>
          <DocsBadge variant="muted">PBKDF2-SHA512</DocsBadge>
          <DocsBadge variant="green">BN254 (V2)</DocsBadge>
          <DocsBadge variant="muted">Poseidon (V2)</DocsBadge>
        </div>
        <p className="mt-3 text-xs text-[rgba(255,255,255,0.35)] leading-relaxed">
          <Link href="/docs/contracts" className="text-[rgba(0,255,65,0.7)] hover:text-[#00FF41]">View contract addresses →</Link>
        </p>
      </section>
    </DocsPage>
    </>
  );
}
