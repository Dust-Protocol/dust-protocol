import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { DocsStepList } from "@/components/docs/DocsStepList";
import {
  TransferNoteSnippet,
  TransferComparisonSnippet,
  TransferProcessingSnippet,
  TransferRecipientSnippet,
} from "@/components/docs/visuals/TransferFlowPreview";

export const metadata = {
  title: "Transfers | Dust Protocol",
  description: "Send shielded funds to another user without leaving the privacy pool.",
};

export default function TransfersPage() {
  return (
    <DocsPage
      currentHref="/docs/app-guide/transfers"
      title="Transfers"
      badge="APP GUIDE"
    >
      {/* What is a Shielded Transfer? */}
      <h2 className="text-base font-mono font-semibold text-white mt-10 mb-3">
        What is a Shielded Transfer?
      </h2>
      <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
        A shielded transfer moves funds from your note to a new note owned by the
        recipient&apos;s public key &mdash; all without leaving the privacy pool. Your
        input note is consumed (nullified), and two new commitments are created: one
        for the recipient&apos;s amount and one for your change.
      </p>
      <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
        On-chain, only nullifiers and new commitments are visible. No amounts,
        no sender identity, no recipient identity. The entire operation is proven
        valid by an FFLONK zero-knowledge proof.
      </p>

      <TransferNoteSnippet />

      {/* Transfer vs Withdraw */}
      <h2 className="text-base font-mono font-semibold text-white mt-10 mb-3">
        Transfer vs Withdraw
      </h2>

      <TransferComparisonSnippet />

      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm font-mono border-collapse">
          <thead>
            <tr className="border-b border-[rgba(255,255,255,0.08)]">
              <th className="text-left text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] py-2 pr-4" />
              <th className="text-left text-[10px] uppercase tracking-wider text-[#00FF41] py-2 pr-4">
                Transfer
              </th>
              <th className="text-left text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] py-2">
                Withdraw
              </th>
            </tr>
          </thead>
          <tbody className="text-[rgba(255,255,255,0.6)]">
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <td className="py-2.5 pr-4 text-[rgba(255,255,255,0.45)]">Funds destination</td>
              <td className="py-2.5 pr-4">Stay in pool (new V2 note)</td>
              <td className="py-2.5">Leave pool (ETH on-chain)</td>
            </tr>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <td className="py-2.5 pr-4 text-[rgba(255,255,255,0.45)]">Recipient gets</td>
              <td className="py-2.5 pr-4">Shielded note in their wallet</td>
              <td className="py-2.5">ETH at a public address</td>
            </tr>
            <tr className="border-b border-[rgba(255,255,255,0.06)]">
              <td className="py-2.5 pr-4 text-[rgba(255,255,255,0.45)]">On-chain visibility</td>
              <td className="py-2.5 pr-4">Nullifiers + commitments only</td>
              <td className="py-2.5">Nullifiers + withdrawal amount</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 text-[rgba(255,255,255,0.45)]">Privacy</td>
              <td className="py-2.5 pr-4 text-[#00FF41]">Maximum &mdash; never leaves privacy set</td>
              <td className="py-2.5">Reduced &mdash; funds exit to public address</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Step by Step */}
      <h2 className="text-base font-mono font-semibold text-white mt-10 mb-3">
        Step by Step
      </h2>
      <DocsStepList
        steps={[
          {
            title: "Enter amount and recipient",
            children: (
              <p>
                Type the ETH amount and the recipient&apos;s stealth username
                (e.g. <code>dust.bob</code>) or their V2 owner public key directly.
              </p>
            ),
          },
          {
            title: "Resolve recipient public key",
            children: (
              <p>
                The browser looks up the recipient&apos;s <code>ownerPubKey</code> from
                the ERC-6538 stealth meta-address registry on-chain. This is
                the Poseidon hash of their spending key.
              </p>
            ),
          },
          {
            title: "Generate FFLONK proof",
            children: (
              <p>
                A 2-in-2-out circuit proof is generated locally in the browser,
                consuming your input note and producing two output commitments:
                one for the recipient and one for your change.
              </p>
            ),
          },
          {
            title: "Create recipient output note",
            children: (
              <p>
                The output note is encrypted with the recipient&apos;s public key.
                Only the recipient can derive the blinding factor and detect
                the note when scanning the pool.
              </p>
            ),
          },
          {
            title: "Relayer submits and recipient scans",
            children: (
              <p>
                The relayer submits the proof on-chain. The recipient&apos;s
                scanner detects the new commitment and adds the note to their
                local encrypted store.
              </p>
            ),
          },
        ]}
      />

      <TransferProcessingSnippet />

      {/* Recipient Resolution */}
      <h2 className="text-base font-mono font-semibold text-white mt-10 mb-3">
        Recipient Resolution
      </h2>
      <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
        Stealth usernames (like <code>dust.bob</code>) resolve to public keys
        through the on-chain ERC-6538 registry. When a user completes
        onboarding, their stealth meta-address is registered &mdash; mapping
        their chosen username to the cryptographic keys needed to receive
        shielded transfers.
      </p>
      <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
        You can also paste a raw V2 owner public key (hex) directly into the
        recipient field, bypassing username resolution entirely.
      </p>

      <TransferRecipientSnippet />

      <DocsCallout type="info" title="Recipient must be onboarded">
        The recipient must have completed onboarding (registered their
        meta-address) to receive transfers. If the username doesn&apos;t resolve,
        ask the recipient to finish their Dust setup first.
      </DocsCallout>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mt-8">
        <DocsBadge variant="green">FFLONK</DocsBadge>
        <DocsBadge variant="green">Shielded</DocsBadge>
        <DocsBadge variant="amber">UTXO</DocsBadge>
        <DocsBadge variant="blue">ERC-6538</DocsBadge>
      </div>
    </DocsPage>
  );
}
