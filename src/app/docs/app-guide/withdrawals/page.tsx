import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsStepList } from "@/components/docs/DocsStepList";
import { DocsBadge } from "@/components/docs/DocsBadge";
import {
  WithdrawBalanceSnippet,
  WithdrawNoteSelectionSnippet,
  WithdrawDenomSnippet,
  WithdrawCooldownSnippet,
} from "@/components/docs/visuals/WithdrawFlowPreview";

export default function WithdrawalsPage() {
  return (
    <DocsPage
      currentHref="/docs/app-guide/withdrawals"
      title="Withdrawals"
      badge="APP GUIDE"
    >

      {/* Shielded Balance */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Shielded Balance
        </h2>
        <WithdrawBalanceSnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          Your shielded balance is the sum of all unspent UTXO notes held in DustPool V2. Each note
          is an encrypted commitment that only your spending key can unlock. The balance updates
          automatically as you deposit, withdraw, or receive transfers.
        </p>
      </section>

      {/* How Withdrawal Works */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          How Withdrawal Works
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Withdrawing from DustPool V2 consumes one or two of your shielded UTXO notes and produces an FFLONK
          zero-knowledge proof that you own them &mdash; without revealing which notes are yours. The proof is
          submitted to the relayer, which verifies it on-chain and transfers funds to your chosen recipient address.
        </p>
        <DocsStepList steps={[
          {
            title: "Select input notes",
            children: <>The app finds the smallest unspent note that covers your withdrawal amount.
              Any excess is returned as a new <strong>change note</strong> &mdash; similar to Bitcoin&apos;s UTXO model.</>,
          },
          {
            title: "Generate FFLONK proof in-browser",
            children: <>Your browser runs the 2-in-2-out transaction circuit (~12,400 constraints) via snarkjs + WASM.
              The proof takes roughly 2&ndash;3 seconds to generate. No trusted setup is required.</>,
          },
          {
            title: "Submit proof to relayer",
            children: <>The proof and public signals are sent to the same-origin relayer at <code>/api/v2/withdraw</code>.
              The relayer screens the recipient via the Chainalysis sanctions oracle, then submits the proof to
              <code> DustPoolV2.withdraw()</code> on-chain.</>,
          },
          {
            title: "On-chain verification and transfer",
            children: <>The contract verifies the FFLONK proof, checks nullifier freshness, validates chain ID binding,
              confirms pool solvency, marks nullifiers as spent, and transfers ETH to the recipient.</>,
          },
        ]} />
      </section>

      {/* Note Selection */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Note Selection
        </h2>
        <WithdrawNoteSelectionSnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The app automatically selects the smallest unspent note whose value is greater than or equal to the
          withdrawal amount. If the note is larger than the requested amount, the difference is returned as a
          new shielded change note that appears in your balance immediately.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          Pending notes (deposits still awaiting Merkle tree inclusion) are excluded from selection. Only
          confirmed notes with a valid leaf index are eligible.
        </p>
      </section>

      {/* The 2-in-2-out Circuit */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          The 2-in-2-out Circuit
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The transaction circuit consumes up to 2 input notes and produces up to 2 output notes (withdrawal + change).
          It enforces balance conservation: the sum of inputs equals the sum of outputs plus the public withdrawal amount.
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Property</th>
                <th className="text-left py-2 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {[
                ["Constraints", "~12,400"],
                ["Proof system", "FFLONK (no trusted setup)"],
                ["Proving time", "~2\u20133 seconds (in-browser)"],
                ["Public signals (9)", "merkleRoot, null0, null1, outC0, outC1, pubAmount, pubAsset, recipient, chainId"],
                ["Verification gas", "~220,000"],
              ].map(([k, v]) => (
                <tr key={k} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="py-2.5 pr-6 text-[rgba(255,255,255,0.5)]">{k}</td>
                  <td className="py-2.5 text-white">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          The chain ID is included as the 9th public signal to prevent cross-chain proof replay. A proof
          generated on Ethereum Sepolia cannot be submitted on Thanos Sepolia.
        </p>
      </section>

      {/* Denomination Privacy */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Denomination Privacy
        </h2>
        <WithdrawDenomSnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Withdrawing an unusual amount (e.g. 1.37 ETH) creates a unique fingerprint that can be correlated
          with deposits. The <strong className="text-white">split circuit</strong> (2-in-8-out, ~32,074 constraints,
          15 public signals) automatically decomposes your withdrawal into common denomination chunks. Each chunk
          is submitted as a separate transaction with randomized timing delays, making each one indistinguishable
          from other withdrawals of the same denomination.
        </p>

        <p className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] font-mono mb-2">
          ETH Denomination Table
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {["10", "5", "3", "2", "1", "0.5", "0.3", "0.2", "0.1", "0.05", "0.03", "0.02", "0.01"].map((d) => (
            <span
              key={d}
              className="px-2 py-0.5 rounded-sm bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.12)] text-[10px] font-mono text-[#00FF41]"
            >
              {d} ETH
            </span>
          ))}
        </div>

        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          For example, withdrawing 1.0 ETH splits into three chunks: 0.5 + 0.3 + 0.2 ETH. The relayer
          submits each chunk with a random delay between them, so an observer sees three standard-denomination
          withdrawals with no obvious timing pattern.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          If the number of chunks is high, the UI suggests nearby round amounts that decompose into fewer
          chunks &mdash; fewer on-chain transactions means less opportunity for correlation.
        </p>
      </section>

      {/* Compliance Cooldown */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Compliance Cooldown
        </h2>
        <WithdrawCooldownSnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Deposits exceeding <strong className="text-white">$10,000 USD</strong> (the BSA/AML reporting threshold)
          trigger a 1-hour compliance cooldown. During this period, withdrawal of the affected notes is
          restricted to the <strong className="text-white">original depositor&apos;s address</strong> only. This gives
          compliance systems time to screen the deposit via the Chainalysis sanctions oracle.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The UI displays an amber countdown timer when a selected note is in cooldown. You can either wait
          for the cooldown to expire or set the recipient to the original depositor address to proceed immediately.
        </p>
        <DocsCallout type="warning" title="Cooldown Enforcement">
          The cooldown only applies to withdrawals where the USD value meets the $10K threshold (priced via
          Chainlink ETH/USD oracle). Smaller withdrawals are unaffected regardless of the deposit&apos;s cooldown status.
        </DocsCallout>
      </section>

      {/* Recipient Address */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Recipient Address
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The recipient defaults to your currently connected wallet address. For maximum privacy, use a
          fresh address that has no on-chain history linking it to your identity. The ZK proof hides
          which notes you spent, but if the recipient address is already associated with you, the privacy
          benefit is reduced.
        </p>
      </section>

      {/* Tip callout */}
      <DocsCallout type="tip" title="Fewer Chunks">
        Use the &ldquo;Fewer chunks&rdquo; suggestions shown below the denomination split preview to minimize
        the number of split transactions. Fewer chunks means fewer on-chain events to correlate.
      </DocsCallout>

      {/* Badges */}
      <div className="mt-6 flex flex-wrap gap-2">
        <DocsBadge variant="green">FFLONK</DocsBadge>
        <DocsBadge variant="green">Split Circuit</DocsBadge>
        <DocsBadge variant="green">Denomination Privacy</DocsBadge>
        <DocsBadge variant="amber">Chainalysis</DocsBadge>
      </div>
    </DocsPage>
  );
}
