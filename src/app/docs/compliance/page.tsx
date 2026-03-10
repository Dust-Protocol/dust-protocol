import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsStepList } from "@/components/docs/DocsStepList";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { docsMetadata } from "@/lib/seo/metadata";
import { techArticleJsonLd } from "@/lib/seo/jsonLd";

/**
 * XSS-safe: all values below are hardcoded string literals defined in this file.
 * safeJsonLd() in jsonLd.ts escapes any '<' characters as \u003c to prevent injection.
 * No user input flows into this JSON-LD — only compile-time constants.
 */
const articleLd = techArticleJsonLd("Compliance & Disclosure — Privacy with Accountability", "Built-in deposit screening via Chainalysis oracle, deposit cooldown periods, and voluntary view keys for selective disclosure reports. Privacy does not mean impunity.", "/docs/compliance");

export const metadata = docsMetadata("Compliance & Disclosure — Privacy with Accountability", "Built-in deposit screening via Chainalysis oracle, deposit cooldown periods, and voluntary view keys for selective disclosure reports.", "/docs/compliance");

export default function CompliancePage() {
  return (
    <>
    {/* Safe: hardcoded string literals only — see articleLd declaration above */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
    <DocsPage
      currentHref="/docs/compliance"
      title="Compliance & Disclosure"
      subtitle="Privacy with accountability. Built-in screening, cooldown periods, and voluntary disclosure — without compromising the privacy of legitimate users."
      badge="ACCOUNT & SECURITY"
    >

      {/* Philosophy */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Privacy &ne; Impunity</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Dust V2 is designed to provide privacy for legitimate users while maintaining compliance hooks.
          Unlike fully anonymous systems, Dust includes mechanisms that deter illicit use without weakening
          privacy guarantees for everyone else.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 border border-[rgba(255,255,255,0.06)] rounded-sm">
            <p className="text-[12px] font-mono font-semibold text-white mb-1.5">On-chain Screening</p>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              Sanctioned addresses are blocked at deposit time via the Chainalysis oracle. Tainted funds never enter the pool.
            </p>
          </div>
          <div className="p-4 border border-[rgba(255,255,255,0.06)] rounded-sm">
            <p className="text-[12px] font-mono font-semibold text-white mb-1.5">Time-locked Cooldowns</p>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              A 1-hour cooldown after deposit gives authorities time to flag suspicious activity before funds can be fully mixed.
            </p>
          </div>
          <div className="p-4 border border-[rgba(255,255,255,0.06)] rounded-sm">
            <p className="text-[12px] font-mono font-semibold text-white mb-1.5">Voluntary Disclosure</p>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              Users can prove their transaction history to auditors via view keys — without revealing spending keys or compromising future privacy.
            </p>
          </div>
        </div>
      </section>

      {/* Deposit screening */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Deposit Screening (Chainalysis Oracle)</h2>
        <DocsStepList steps={[
          {
            title: "User initiates deposit",
            children: <>When calling <code>DustPoolV2.deposit()</code> or <code>depositERC20()</code>, the contract
              queries the Chainalysis sanctions oracle at <code>0x40C57923924B5c5c5455c48D93317139ADDaC8fb</code> via the
              <code> ChainalysisScreener</code> wrapper.</>,
          },
          {
            title: "Oracle check",
            children: <><code>IComplianceOracle.isBlocked(msg.sender)</code> returns true if the address is on the
              OFAC sanctions list. If blocked, the transaction reverts with <code>DepositBlocked()</code>.</>,
          },
          {
            title: "Deposit proceeds",
            children: <>If the address passes screening, the deposit continues normally. An event
              <code> DepositScreened(depositor, commitment, blocked=false)</code> is emitted for audit trails.</>,
          },
        ]} />
        <DocsCallout type="info" title="Updateable oracle">
          The compliance oracle is updateable. The pool owner can call <code>setComplianceOracle(newOracle)</code> to
          switch screening providers without redeploying the contract.
        </DocsCallout>
      </section>

      {/* Deposit cooldown */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Deposit Cooldown (1 Hour)</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          After depositing, a <strong className="text-white">1-hour cooldown period</strong> begins. During cooldown,
          withdrawals from that note can <strong className="text-white">only</strong> go to the original depositor&apos;s
          address. After cooldown expires, withdrawals can go to any address. This gives compliance systems time
          to flag suspicious deposits before funds can be fully mixed.
        </p>
        <div className="font-mono text-xs leading-relaxed text-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm p-5 overflow-x-auto whitespace-pre mb-6">
          {`depositTimestamp[commitment]  = block.timestamp
depositOriginator[commitment] = msg.sender

// During withdrawal:
if (block.timestamp < depositTimestamp[C] + 1 hour) {
  require(recipient == depositOriginator[C], "CooldownActive()")
}`}
        </div>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          On-chain, the contract stores <code>depositTimestamp</code> and <code>depositOriginator</code> mappings
          for each commitment. If a user tries to withdraw to a different address during cooldown, the transaction
          reverts with <code>CooldownActive()</code>. The frontend shows a countdown timer with the remaining time.
        </p>
        <DocsCallout type="tip" title="Why 1 hour?">
          One hour balances usability against compliance needs. It is long enough for off-chain monitoring systems
          to flag suspicious deposits and short enough that legitimate users experience minimal friction. The pool
          owner can adjust this parameter if regulations change.
        </DocsCallout>
      </section>

      {/* View keys */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">View Keys</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          A <strong className="text-white">view key</strong> allows a third party to verify your full transaction
          history without gaining the ability to spend your funds. It contains two components:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="p-4 border border-[rgba(0,255,65,0.12)] rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-mono font-semibold text-white">ownerPubKey</p>
              <DocsBadge variant="muted">PUBLIC</DocsBadge>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              <code>Poseidon(spendingKey)</code> — appears in every UTXO commitment. Allows the holder to
              verify which commitments belong to you by recomputing the Poseidon hash with known note parameters.
            </p>
          </div>
          <div className="p-4 border border-[rgba(255,176,0,0.15)] rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-mono font-semibold text-white">nullifierKey</p>
              <DocsBadge variant="amber">SENSITIVE</DocsBadge>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              Computes nullifiers: <code>N = Poseidon(nullifierKey, leafIndex)</code>. Allows the holder to
              determine which notes have been spent by matching against on-chain nullifier records.
            </p>
          </div>
        </div>
        <div className="font-mono text-xs leading-relaxed text-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm p-5 overflow-x-auto whitespace-pre mb-6">
          {`Serialized format:  dvk1:<hex(ownerPubKey)><hex(nullifierKey)>

CAN do:
  - Verify all note commitments (recompute Poseidon hash)
  - Compute nullifiers (track which notes are spent)
  - Generate a complete transaction history

CANNOT do:
  - Spend funds
  - Create new notes
  - Modify balances`}
        </div>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Unlike Zcash&apos;s incoming viewing key model, Dust view keys include nullifier tracking, meaning the
          holder can see both deposits <em>and</em> spending activity. A Zcash-style ivk only reveals incoming notes.
        </p>
        <DocsCallout type="warning" title="View key security">
          A view key reveals your <strong>full transaction history</strong> — every deposit, transfer, and
          withdrawal amount. Share only with trusted parties (auditor, tax authority, compliance officer).
          Once shared, the holder can track all past and future activity until you rotate keys.
        </DocsCallout>
      </section>

      {/* Disclosure reports */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Disclosure Reports</h2>
        <DocsStepList steps={[
          {
            title: "Derive view key",
            children: <>Go to <strong>Settings &rarr; Disclosure</strong>. Click &ldquo;Derive View Key&rdquo;. This
              computes <code>ownerPubKey = Poseidon(spendingKey)</code> and extracts the <code>nullifierKey</code> from
              your V2 key material.</>,
          },
          {
            title: "Generate report",
            children: <>Click &ldquo;Generate Report&rdquo;. The browser scans all your notes and verifies each
              commitment: <code>Poseidon(ownerPubKey, amount, asset, chainId, blinding) == commitment</code>. The report
              includes total notes, total deposited, total spent, and unspent balance.</>,
          },
          {
            title: "Export",
            children: <>Export as <strong>CSV</strong> or <strong>JSON</strong>. The report is self-authenticating — an
              auditor can independently verify each commitment using only the view key and the on-chain Merkle tree data.
              No cooperation from you or the protocol is required after export.</>,
          },
        ]} />
      </section>

      {/* Relayer screening */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Relayer Screening</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The relayer performs an additional screening layer on the withdrawal side. Every recipient address
          is checked against the Chainalysis sanctions oracle before the relayer submits the withdrawal transaction.
        </p>
        <div className="space-y-3 text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          <p>
            <strong className="text-white">Recipient screening.</strong> If the recipient address is sanctioned,
            the relayer returns HTTP 403 with &ldquo;Recipient address is sanctioned&rdquo;. The withdrawal is not submitted.
          </p>
          <p>
            <strong className="text-white">All endpoints covered.</strong> Screening applies to every relayer
            endpoint: <code>/api/v2/withdraw</code>, <code>/api/v2/split-withdraw</code>,
            <code> /api/v2/transfer</code>, and <code>/api/v2/batch-withdraw</code>.
          </p>
          <p>
            <strong className="text-white">Fail-closed.</strong> If the compliance screening service is unavailable,
            the relayer rejects the request rather than allowing it through. No withdrawal proceeds without a successful
            sanctions check.
          </p>
        </div>
      </section>

      {/* Summary table */}
      <section>
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Feature</th>
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Mechanism</th>
                <th className="text-left py-2 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {[
                ["Deposit screening", "Chainalysis oracle on-chain", "Every deposit"],
                ["Cooldown period", "1-hour time lock", "After deposit"],
                ["Recipient screening", "Chainalysis oracle via relayer", "Every withdrawal"],
                ["View keys", "Poseidon-based disclosure", "On-demand (user generates)"],
                ["Disclosure reports", "CSV/JSON export with commitment verification", "On-demand"],
              ].map(([feature, mechanism, when]) => (
                <tr key={feature} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="py-2.5 pr-6 text-[rgba(255,255,255,0.7)]">{feature}</td>
                  <td className="py-2.5 pr-6 text-[rgba(255,255,255,0.5)]">{mechanism}</td>
                  <td className="py-2.5 text-white">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <DocsBadge variant="amber">Chainalysis Oracle</DocsBadge>
          <DocsBadge variant="amber">Deposit Cooldown</DocsBadge>
          <DocsBadge variant="green">View Keys</DocsBadge>
          <DocsBadge variant="green">Poseidon Verification</DocsBadge>
          <DocsBadge variant="muted">Self-Authenticating Reports</DocsBadge>
        </div>
      </section>
    </DocsPage>
    </>
  );
}
