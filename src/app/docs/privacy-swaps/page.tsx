import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsStepList } from "@/components/docs/DocsStepList";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { docsMetadata } from "@/lib/seo/metadata";
import { techArticleJsonLd } from "@/lib/seo/jsonLd";

/*
 * XSS-safe: all values below are hardcoded string literals defined in this file.
 * safeJsonLd() in jsonLd.ts escapes '<' as \u003c. No user input flows into this data.
 */
const articleLd = techArticleJsonLd("Privacy Swaps — Atomic Private Token Exchange via DustSwapAdapterV2", "Swap any amount of tokens privately. DustSwapAdapterV2 withdraws from DustPoolV2, swaps on a vanilla Uniswap V4 pool, and re-deposits the output — all in one atomic transaction via relayer.", "/docs/privacy-swaps");

export const metadata = docsMetadata("Privacy Swaps — Atomic Private Token Exchange via DustSwapAdapterV2", "Swap any amount of tokens privately. DustSwapAdapterV2 withdraws from DustPoolV2, swaps on a vanilla Uniswap V4 pool, and re-deposits the output — all in one atomic transaction via relayer.", "/docs/privacy-swaps");

export default function PrivacySwapsPage() {
  return (
    <>
    {/* Safe: hardcoded string literals only — see articleLd declaration above */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
    <DocsPage
      currentHref="/docs/privacy-swaps"
      title="Privacy Swaps"
      subtitle="Swap any amount of tokens privately. The adapter withdraws from DustPoolV2, swaps on a vanilla Uniswap V4 pool, and re-deposits the output as a new UTXO note — all in one atomic transaction."
      badge="CORE FEATURE"
    >

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">DEX Fingerprinting</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Even after privately receiving ETH through stealth transfers, swapping reveals a pattern. The amount
          you send to a DEX and the timing form a unique fingerprint. An on-chain analyst can cluster
          multiple stealth wallets as belonging to the same user just by watching who swaps similar amounts
          at similar times.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          Privacy Swaps V2 (<code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">DustSwapAdapterV2</code>)
          solve this with an <strong>adapter pattern</strong>. The adapter contract atomically withdraws from DustPoolV2
          (proving UTXO ownership via ZK proof), executes a swap on a standard Uniswap V4 pool with no custom hooks,
          and re-deposits the swap output back into DustPoolV2 as a new UTXO note. The on-chain record never
          links a specific depositor to a specific swap output.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">How Privacy Swaps Work</h2>

        <DocsStepList steps={[
          {
            title: "Prove ownership of UTXO notes in DustPoolV2",
            children: <>Your browser generates a <strong>FFLONK proof</strong> using the standard DustV2Transaction
              circuit (~12,400 constraints). The proof demonstrates you own valid notes in the pool without revealing
              which ones. Public signals: <code>merkleRoot, null0, null1, outC0, outC1, pubAmount, pubAsset,
              recipient, chainId</code>. The <code>recipient</code> is set to the adapter contract address, not
              a user wallet — the adapter receives the withdrawn funds to execute the swap.</>,
          },
          {
            title: "Choose swap parameters",
            children: <>Select the token pair (e.g., ETH to USDC), the amount to swap, and a minimum output amount
              for slippage protection. Unlike V1&apos;s fixed denominations, you can swap <strong>any arbitrary
              amount</strong>. The adapter will use a vanilla Uniswap V4 pool — no custom hooks or special pool
              contracts needed.</>,
          },
          {
            title: "Submit to relayer",
            children: <>The proof and swap parameters are sent to the relayer (same-origin Next.js API at{" "}
              <code>/api/v2/swap</code>). The relayer validates the proof format, verifies the chain ID matches,
              confirms the proof recipient is the adapter contract, and checks nullifier freshness. It then submits
              the transaction to <code>DustSwapAdapterV2.executeSwap()</code>.</>,
          },
          {
            title: "Atomic execution: withdraw \u2192 swap \u2192 re-deposit",
            children: <>The adapter contract performs three operations in a single transaction:
              <strong> (1)</strong> calls <code>DustPoolV2.withdraw()</code> with the ZK proof to release funds,
              <strong> (2)</strong> swaps the withdrawn tokens on the vanilla Uniswap V4 pool via the V4 PoolManager,
              <strong> (3)</strong> computes a Poseidon commitment for the swap output and deposits it back into
              DustPoolV2. If any step fails, the entire transaction reverts — there is no intermediate state.</>,
          },
          {
            title: "Receive new UTXO note",
            children: <>The swap output is a fresh UTXO note in DustPoolV2 with a new Poseidon commitment. Your
              browser stores this note (encrypted with AES-256-GCM in IndexedDB). You can later withdraw, transfer,
              or swap this note again — it is indistinguishable from any other note in the pool.</>,
          },
        ]} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Architecture</h2>
        <div className="font-mono text-xs leading-relaxed text-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm p-5 overflow-x-auto whitespace-pre">
          {`User browser
  \u2514\u2500 generates FFLONK proof \u2500\u2500\u25BA Relayer (/api/v2/swap)
       (9 public signals:            \u2514\u2500 validates proof + chainId
        merkleRoot, null0,           \u2514\u2500 DustSwapAdapterV2.executeSwap()
        null1, outC0, outC1,              \u2502
        pubAmount, pubAsset,              \u251C\u2500 (1) DustPoolV2.withdraw(proof)
        recipient=adapter,                \u2502     \u2514\u2500 verifies FFLONK proof
        chainId)                          \u2502     \u2514\u2500 marks nullifiers spent
                                          \u2502     \u2514\u2500 releases funds to adapter
                                          \u2502
                                          \u251C\u2500 (2) Uniswap V4 PoolManager.swap()
                                          \u2502     \u2514\u2500 vanilla pool (no hooks)
                                          \u2502     \u2514\u2500 ETH \u2194 USDC at market rate
                                          \u2502
                                          \u2514\u2500 (3) DustPoolV2.deposit(newCommitment)
                                                \u2514\u2500 Poseidon commitment for output
                                                \u2514\u2500 new UTXO note in pool`}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">V2 vs V1 Architecture</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Property</th>
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">V1</th>
                <th className="text-left py-2 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">V2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {[
                ["Swap amounts", "Fixed denominations only", "Arbitrary amounts"],
                ["Pool type", "Custom DustSwapPool contracts", "Vanilla Uniswap V4 pool"],
                ["Hook", "DustSwapHook (beforeSwap/afterSwap)", "No hooks \u2014 standalone adapter"],
                ["Proof system", "Groth16 (PrivateSwap.circom)", "FFLONK (reuses DustV2Transaction)"],
                ["Deposit step", "Separate deposit into DustSwapPool", "Uses existing DustPoolV2 notes"],
                ["Output", "Tokens to stealth address", "New UTXO note in DustPoolV2"],
                ["Contracts", "DustSwapPool + DustSwapHook + DustSwapRouter", "DustSwapAdapterV2 (single contract)"],
                ["Wait period", "50-block minimum wait", "None required"],
              ].map(([k, v1, v2]) => (
                <tr key={k} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="py-2.5 pr-6 text-[rgba(255,255,255,0.5)]">{k}</td>
                  <td className="py-2.5 pr-6 text-[rgba(255,255,255,0.35)]">{v1}</td>
                  <td className="py-2.5 text-white">{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Key Properties</h2>
        <div className="space-y-3">
          {[
            {
              label: "Arbitrary amounts",
              desc: "No fixed denominations. Swap any amount from your DustPoolV2 notes. The UTXO model handles change automatically via the 2-in-2-out circuit.",
            },
            {
              label: "Atomic three-step execution",
              desc: "Withdraw, swap, and re-deposit happen in a single transaction. There is no intermediate state where funds are exposed or linkable.",
            },
            {
              label: "Vanilla Uniswap V4 pool",
              desc: "Swaps execute on a standard Uniswap V4 pool with no custom hooks. This means better liquidity, no hook-specific attack surface, and compatibility with any V4 pool.",
            },
            {
              label: "Reuses DustV2Transaction circuit",
              desc: "No separate swap-specific circuit. The adapter reuses the same FFLONK proof from DustPoolV2 withdrawals, reducing proving complexity and audit surface.",
            },
            {
              label: "Output stays in the pool",
              desc: "Swap output is re-deposited as a new UTXO note in DustPoolV2. Funds never touch an external address during the swap, maximizing privacy.",
            },
            {
              label: "Slippage protection",
              desc: "The adapter enforces a minimum output amount (minAmountOut). If the Uniswap V4 swap returns less than this threshold, the entire transaction reverts.",
            },
            {
              label: "Chain ID binding",
              desc: "The chain ID is a public signal in the FFLONK proof. A proof generated on Ethereum Sepolia cannot be replayed on Thanos Sepolia or any other chain.",
            },
            {
              label: "Relayer-based submission",
              desc: "A same-origin relayer submits the transaction, paying gas on behalf of the user. The relayer fee is capped at 500 bps and validated before submission.",
            },
          ].map(({ label, desc }) => (
            <div key={label} className="flex gap-4 p-3 border border-[rgba(255,255,255,0.05)] rounded-sm">
              <div className="shrink-0 w-1 rounded-full bg-[rgba(0,255,65,0.3)]" />
              <div>
                <p className="text-xs font-mono font-semibold text-white mb-1">{label}</p>
                <p className="text-xs text-[rgba(255,255,255,0.5)] leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <DocsCallout type="warning" title="UTXO notes are local">
        Your deposit notes are encrypted and stored in IndexedDB. If you clear browser data or switch devices,
        you lose the ability to generate withdrawal proofs. Export and back up your notes from the Settings page.
      </DocsCallout>

      <DocsCallout type="info" title="Gas cost">
        A privacy swap costs approximately 580,000 to 900,000 gas — covering FFLONK proof verification,
        the Uniswap V4 swap, Poseidon commitment computation, and the re-deposit into DustPoolV2.
      </DocsCallout>

      <section className="mt-8">
        <div className="flex flex-wrap gap-2">
          <DocsBadge variant="green">FFLONK</DocsBadge>
          <DocsBadge variant="green">DustV2Transaction</DocsBadge>
          <DocsBadge variant="green">Uniswap V4</DocsBadge>
          <DocsBadge variant="muted">BN254</DocsBadge>
          <DocsBadge variant="muted">Adapter Pattern</DocsBadge>
          <DocsBadge variant="muted">Arbitrary Amounts</DocsBadge>
          <DocsBadge variant="amber">Chain ID Binding</DocsBadge>
          <DocsBadge variant="amber">Slippage Protection</DocsBadge>
        </div>
      </section>
    </DocsPage>
    </>
  );
}
