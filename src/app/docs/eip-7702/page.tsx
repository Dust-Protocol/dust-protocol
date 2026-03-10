import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { AccountTypeSwitcher } from "@/components/docs/visuals/AccountTypeSwitcher";
import { docsMetadata } from "@/lib/seo/metadata";

export const metadata = docsMetadata("Account Types & EIP-7702 — Gasless Stealth Claims", "How Dust works with EOA, CREATE2, ERC-4337, and EIP-7702 account types. Each claim mechanism adapts to your wallet type for gasless stealth fund recovery.", "/docs/eip-7702");

export default function Eip7702Page() {
  return (
    <DocsPage
      currentHref="/docs/eip-7702"
      title="Account Types & EIP-7702"
      subtitle="Dust works with multiple EVM account models. Understand which type your wallet uses and how each claims stealth funds."
      badge="ACCOUNT & SECURITY"
    >

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">EVM Account Types</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-6">
          Ethereum supports several account models. Dust abstracts over all of them — the claim mechanism
          adapts to whichever type your wallet is, or whichever type the stealth address is deployed as.
        </p>

        <div className="mb-8">
          <AccountTypeSwitcher />
        </div>

        <div className="space-y-4">
          {/* EOA */}
          <div className="border border-[rgba(255,255,255,0.07)] rounded-sm overflow-hidden">
            <div className="px-4 py-3 bg-[rgba(255,255,255,0.02)] flex items-center justify-between">
              <p className="text-[12px] font-mono font-semibold text-white">Standard EOA</p>
              <DocsBadge variant="muted">Externally Owned Account</DocsBadge>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed mb-3">
                A regular Ethereum private key account. Dust derives a per-stealth-address private key and uses
                it directly to sign and broadcast a transfer transaction. Requires ETH for gas — typically
                handled by the DustPaymaster sponsorship.
              </p>
              <div className="flex gap-3 text-xs font-mono">
                <span className="text-[rgba(0,255,65,0.7)]">✓ Universally compatible</span>
                <span className="text-[rgba(255,255,255,0.3)]">· Needs relayer for gas</span>
              </div>
            </div>
          </div>

          {/* ERC-4337 */}
          <div className="border border-[rgba(0,255,65,0.12)] rounded-sm overflow-hidden">
            <div className="px-4 py-3 bg-[rgba(0,255,65,0.03)] flex items-center justify-between">
              <p className="text-[12px] font-mono font-semibold text-white">ERC-4337 Smart Account</p>
              <DocsBadge variant="green">Account Abstraction</DocsBadge>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed mb-3">
                Default for stealth claims in Dust. A <code>StealthAccount</code> contract is deployed at the
                stealth address via CREATE2. The stealth private key signs a{" "}
                <strong>UserOperation</strong> — the EntryPoint contract deploys and drains the account atomically.
                Gas is covered by the <code>DustPaymaster</code>, so the claim is completely free for the
                recipient.
              </p>
              <div className="flex flex-wrap gap-3 text-xs font-mono">
                <span className="text-[rgba(0,255,65,0.7)]">✓ Gasless</span>
                <span className="text-[rgba(0,255,65,0.7)]">✓ Atomic deploy + drain</span>
                <span className="text-[rgba(0,255,65,0.7)]">✓ Default for Dust</span>
              </div>
            </div>
          </div>

          {/* CREATE2 */}
          <div className="border border-[rgba(255,255,255,0.07)] rounded-sm overflow-hidden">
            <div className="px-4 py-3 bg-[rgba(255,255,255,0.02)] flex items-center justify-between">
              <p className="text-[12px] font-mono font-semibold text-white">CREATE2 Wallet</p>
              <DocsBadge variant="muted">Counterfactual</DocsBadge>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed mb-3">
                A minimal smart wallet deployed at a deterministic address using CREATE2. The address is
                pre-computable from the stealth key without deploying first — funds can be sent before the
                wallet exists on-chain, and deployment + drain happen in one sponsored transaction.
              </p>
              <div className="flex gap-3 text-xs font-mono">
                <span className="text-[rgba(0,255,65,0.7)]">✓ Deterministic address</span>
                <span className="text-[rgba(255,255,255,0.3)]">· Requires sponsor</span>
              </div>
            </div>
          </div>

          {/* EIP-7702 */}
          <div className="border border-[rgba(255,176,0,0.15)] rounded-sm overflow-hidden">
            <div className="px-4 py-3 bg-[rgba(255,176,0,0.03)] flex items-center justify-between">
              <p className="text-[12px] font-mono font-semibold text-white">EIP-7702 — EOA as Smart Account</p>
              <DocsBadge variant="amber">EIP-7702</DocsBadge>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed mb-3">
                EIP-7702 (included in Ethereum's Pectra upgrade) allows an EOA to temporarily adopt the
                bytecode of a smart contract within a single transaction. This means a regular wallet can
                execute smart-account logic (like ERC-4337 UserOps or batch calls) without being permanently
                converted to a contract.
              </p>
              <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed mb-3">
                In Dust, EIP-7702 allows stealth addresses that are plain EOAs to claim funds with
                smart-account capabilities in one transaction — enabling advanced features like:
              </p>
              <ul className="space-y-1.5 mb-3">
                {[
                  "Batch claims from multiple stealth addresses in one tx",
                  "Social recovery of a stealth key (sign with guardian)",
                  "Auto-routing output to Privacy Pool deposit in one step",
                ].map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[rgba(255,255,255,0.5)]">
                    <span className="text-[#FFB000] shrink-0">—</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 text-xs font-mono">
                <span className="text-[rgba(255,176,0,0.8)]">✓ No permanent migration</span>
                <span className="text-[rgba(255,176,0,0.8)]">✓ Pectra upgrade</span>
                <span className="text-[rgba(255,255,255,0.3)]">· Requires Pectra-enabled network</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DocsCallout type="info" title="Which type does Dust use by default?">
        Dust uses <strong>ERC-4337 smart accounts</strong> for all stealth claims by default.
        EIP-7702 support is integrated for wallets and networks that support it, enabling additional
        capabilities without any action from the user.
      </DocsCallout>

      <section className="mt-8">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                {["Account Type", "Gasless", "Smart Logic", "Deploy Needed", "EIP"].map((h) => (
                  <th key={h} className="text-left py-2 pr-4 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {[
                ["EOA", "Via relayer", "✗", "✗", "—"],
                ["ERC-4337", "✓ Paymaster", "✓", "✓ (atomic)", "ERC-4337"],
                ["CREATE2", "Via sponsor", "Limited", "✓ (atomic)", "—"],
                ["EIP-7702", "✓ Paymaster", "✓ (ephemeral)", "✗", "EIP-7702"],
              ].map(([type, ...rest]) => (
                <tr key={type} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="py-2.5 pr-4 text-white">{type}</td>
                  {rest.map((v, i) => (
                    <td key={i} className={`py-2.5 pr-4 ${v.startsWith("✓") ? "text-[#00FF41]" : v === "✗" ? "text-[rgba(255,255,255,0.25)]" : "text-[rgba(255,255,255,0.5)]"}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DocsPage>
  );
}
