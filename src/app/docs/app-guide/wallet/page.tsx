import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { DocsStepList } from "@/components/docs/DocsStepList";
import {
  WalletAddressListSnippet,
  WalletSendSnippet,
  WalletReceiveSnippet,
  WalletV1V2ComparisonSnippet,
} from "@/components/docs/visuals/WalletPreview";
import { docsMetadata } from "@/lib/seo/metadata";

export const metadata = docsMetadata(
  "Wallet — V1 Stealth Address Management",
  "Send and receive ETH through one-time stealth addresses derived via ECDH. Scan, claim, and manage your V1 stealth payments.",
  "/docs/app-guide/wallet",
);

export default function WalletGuidePage() {
  return (
    <DocsPage
      currentHref="/docs/app-guide/wallet"
      title="Wallet"
      subtitle="Manage V1 stealth addresses — send private payments, scan for incoming funds, and claim to your wallet."
      badge="APP GUIDE"
    >
      {/* V1 Stealth Addresses */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">V1 Stealth Addresses</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The Wallet page manages V1-style stealth addresses — one-time addresses generated via
          Elliptic Curve Diffie-Hellman (ECDH) key exchange on secp256k1. Each incoming payment
          creates a unique address that only you can detect and spend from.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          These are separate from V2 UTXO notes managed on the Pools page. V1 stealth addresses
          live on-chain as standard Ethereum addresses, while V2 notes exist as commitments inside
          the DustPoolV2 contract.
        </p>
        <WalletAddressListSnippet />
      </section>

      {/* How Stealth Addresses Work */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">How Stealth Addresses Work</h2>
        <DocsStepList
          steps={[
            {
              title: "Sender looks up your meta-address",
              children: (
                <p>
                  The sender resolves your <code>.dust</code> name or looks up your stealth
                  meta-address from the ERC-6538 registry contract.
                </p>
              ),
            },
            {
              title: "Ephemeral key generation",
              children: (
                <p>
                  The sender generates a random ephemeral keypair and computes a shared secret
                  with your public spending key via ECDH on the secp256k1 curve.
                </p>
              ),
            },
            {
              title: "One-time address derivation",
              children: (
                <p>
                  The shared secret is used to derive a one-time stealth address. Only the sender
                  and recipient can compute this address — no third party can link it to your
                  identity.
                </p>
              ),
            },
            {
              title: "On-chain announcement",
              children: (
                <p>
                  The sender publishes the ephemeral public key via an ERC-5564 announcement event
                  and sends ETH to the stealth address in the same transaction.
                </p>
              ),
            },
            {
              title: "Scanner detects payment",
              children: (
                <p>
                  Your wallet scans announcement events, recomputes the shared secret for each
                  ephemeral key, and checks if the derived address holds funds. Matching addresses
                  appear in your Inbox with the corresponding private key.
                </p>
              ),
            },
          ]}
        />
      </section>

      {/* Sending */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Sending</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Navigate to the Send tab to create a private payment. Enter the recipient&apos;s{" "}
          <code>.dust</code> name (e.g. <code>alice.dust</code>) or their full stealth
          meta-address (<code>st:thanos:0x...</code>), then specify an amount.
        </p>
        <WalletSendSnippet />
        <ul className="space-y-2">
          {[
            "The recipient's meta-address is resolved from the name registry (300ms debounce).",
            "An ephemeral key is generated to compute the one-time stealth address via ECDH.",
            "Preview shows the amount, recipient, and network before confirmation.",
            "On confirmation, ETH is sent to the stealth address and an ERC-5564 announcement is emitted.",
          ].map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-[rgba(255,255,255,0.6)]">
              <span className="shrink-0 text-[#00FF41] mt-0.5">—</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Receiving */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Receiving</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Share your <code>.dust</code> username or stealth meta-address with anyone who wants to
          pay you. The scanner automatically detects incoming payments by monitoring ERC-5564
          announcement events on-chain.
        </p>
        <WalletReceiveSnippet />
        <ul className="space-y-2">
          {[
            "The Inbox tab lists all detected payments with balance, block number, and claim status.",
            "Unclaimed payments with sufficient balance show a Claim button to sweep funds to your wallet.",
            "Claim destination can be changed in the claim address selector (CREATE2, ERC-4337, or EOA).",
            "Dust-amount payments (below gas threshold for EOA claims) are flagged but can still be claimed via sponsored wallet types.",
          ].map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-[rgba(255,255,255,0.6)]">
              <span className="shrink-0 text-[#00FF41] mt-0.5">—</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* V1 vs V2 */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">V1 vs V2</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Both systems provide payment privacy, but they work differently and have distinct trade-offs.
        </p>
        <WalletV1V2ComparisonSnippet />
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)]">
                <th className="text-left py-2.5 pr-4 text-[10px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.45)]" />
                <th className="text-left py-2.5 pr-4 text-[10px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.45)]">V1 (Stealth Addresses)</th>
                <th className="text-left py-2.5 text-[10px] uppercase tracking-wider font-mono text-[rgba(255,255,255,0.45)]">V2 (UTXO Pool)</th>
              </tr>
            </thead>
            <tbody className="text-[rgba(255,255,255,0.6)]">
              {[
                ["Model", "One address per payment", "UTXO notes in shared pool"],
                ["Privacy", "Unlinkable addresses", "Hidden amounts + ZK proofs"],
                ["Claiming", "Individual claim per address", "Withdraw with FFLONK proof"],
                ["Fan-in", "Each address claimed separately", "Notes merged in-pool (no fan-in)"],
                ["Amounts", "Visible on-chain", "Hidden via Pedersen commitments"],
                ["Gas", "One tx per claim", "Batched via relayer"],
              ].map(([label, v1, v2]) => (
                <tr key={label} className="border-b border-[rgba(255,255,255,0.04)]">
                  <td className="py-2.5 pr-4 font-mono text-white text-xs font-semibold">{label}</td>
                  <td className="py-2.5 pr-4 text-xs">{v1}</td>
                  <td className="py-2.5 text-xs">{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mt-4">
          V1 stealth addresses are still fully supported, but V2 is recommended for stronger
          privacy — hidden amounts, no fan-in problem, and denomination-private withdrawals via
          auto-split.
        </p>
      </section>

      <DocsCallout type="tip" title="V2 recommended">
        Use the Pools page for V2 UTXO operations (deposit, withdraw, transfer). The Wallet page
        is for V1 stealth address management — scanning for payments, claiming funds, and
        registering your identity on-chain.
      </DocsCallout>

      <div className="mt-8 flex flex-wrap gap-2">
        <DocsBadge variant="green">ECDH</DocsBadge>
        <DocsBadge variant="muted">ERC-5564</DocsBadge>
        <DocsBadge variant="muted">ERC-6538</DocsBadge>
        <DocsBadge variant="blue">secp256k1</DocsBadge>
      </div>
    </DocsPage>
  );
}
