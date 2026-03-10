import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsBadge } from "@/components/docs/DocsBadge";
import {
  SettingsAccountSnippet,
  SettingsSecuritySnippet,
  SettingsViewKeySnippet,
  SettingsClaimSnippet,
  SettingsDangerSnippet,
} from "@/components/docs/visuals/SettingsPreview";
import { docsMetadata } from "@/lib/seo/metadata";
import { techArticleJsonLd } from "@/lib/seo/jsonLd";

const articleLd = techArticleJsonLd("Settings — Dust Protocol App Guide", "Configure your account, security, view key disclosure, claim address method, and manage local data in the Dust Protocol settings panel.", "/docs/app-guide/settings");

export const metadata = docsMetadata("Settings — Dust Protocol App Guide", "Configure your account, security, view key disclosure, claim address method, and manage local data in the Dust Protocol settings panel.", "/docs/app-guide/settings");

export default function SettingsPage() {
  return (
    <>
    {/* Safe: hardcoded string literals only — see articleLd declaration above */}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
    <DocsPage
      currentHref="/docs/app-guide/settings"
      title="Settings"
      badge="APP GUIDE"
    >

      {/* Account */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Account</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          The account section displays your connected wallet address (truncated), your registered
          <strong className="text-white"> .dust username</strong> (if any), and the active network. Registration status shows
          whether your stealth meta-address has been published on-chain via ERC-6538 — required before anyone can send
          you stealth payments.
        </p>
        <SettingsAccountSnippet />
      </section>

      {/* Security */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Security</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Your 6-digit PIN is combined with a wallet signature via <strong className="text-white">PBKDF2</strong> (100,000
          iterations) to derive your spending key and nullifier key. Changing the PIN re-derives entirely different keys —
          any stealth addresses or pool notes tied to the old PIN become inaccessible unless you switch back.
        </p>
        <SettingsSecuritySnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          <strong className="text-white">Export Notes</strong> creates a JSON backup of all UTXO notes stored in
          IndexedDB. These notes are normally encrypted at rest with AES-256-GCM, but the export produces an unencrypted
          file so it can be imported into another browser session.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          <strong className="text-white">Import Notes</strong> restores a previously exported backup. Imported notes are
          re-encrypted with your current session key and merged into IndexedDB. Duplicates are detected by commitment
          hash and skipped.
        </p>
      </section>

      {/* View Key Disclosure */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">View Key Disclosure</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          A view key is a <code>dvk1:</code>-prefixed bundle containing two pieces of data:
          your <strong className="text-white">ownerPubKey</strong> (= Poseidon hash of your spending key) and
          your <strong className="text-white">nullifierKey</strong>. Together they allow an auditor to compute nullifiers
          and verify which commitments belong to you — without being able to spend any funds.
        </p>
        <SettingsViewKeySnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          This is designed for <strong className="text-white">tax compliance</strong> and
          <strong className="text-white"> regulatory disclosure</strong>. An auditor with your view key can independently
          verify every deposit, withdrawal, and transfer you made, confirm note ownership via Poseidon preimage checks,
          and compute nullifiers to detect spent notes. They cannot generate proofs, move funds, or access your
          spending key.
        </p>
      </section>

      {/* Claim Address Configuration */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Claim Address Configuration</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          When claiming stealth payments, Dust supports three wallet deployment strategies:
        </p>
        <SettingsClaimSnippet />
        <ul className="space-y-3 text-sm text-[rgba(255,255,255,0.6)] leading-relaxed list-none pl-0">
          <li>
            <strong className="text-[#00FF41]">ERC-4337 (Recommended)</strong> — Account Abstraction with DustPaymaster.
            The paymaster sponsors gas, so you can claim without holding ETH on the stealth address. Best for most users.
          </li>
          <li>
            <strong className="text-white">CREATE2</strong> — Deterministic wallet deployment. The stealth address is derived
            from a CREATE2 salt, allowing the recipient to predict the address before deployment. Useful when you need a
            known address ahead of time.
          </li>
          <li>
            <strong className="text-white">EIP-7702</strong> — Delegation-based claiming. The stealth EOA delegates execution
            to a smart contract via EIP-7702, enabling batch operations and custom logic without deploying a separate wallet.
            Newest option — requires chain support.
          </li>
        </ul>
      </section>

      {/* Danger Zone */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Danger Zone</h2>
        <SettingsDangerSnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          Resetting clears all local data: IndexedDB notes, derived keys, PIN state, and settings. It does
          <strong className="text-white"> not</strong> affect on-chain state — your deposits, commitments, and registrations
          remain on the blockchain. If you sign back in with the same wallet and enter the same PIN, your keys are
          re-derived identically and you regain access to all previous funds. A double-click confirmation prevents
          accidental resets.
        </p>
      </section>

      {/* Callouts */}
      <DocsCallout type="warning" title="Note Backup">
        Exporting notes creates an unencrypted backup. Store it securely — anyone with this file can see your
        transaction history.
      </DocsCallout>

      <DocsCallout type="info" title="View Keys">
        View keys allow read-only access. An auditor with your view key can verify deposits and withdrawals
        but cannot move funds.
      </DocsCallout>

      {/* Badges */}
      <div className="mt-6 flex flex-wrap gap-2">
        <DocsBadge variant="amber">AES-256-GCM</DocsBadge>
        <DocsBadge variant="green">View Keys</DocsBadge>
        <DocsBadge variant="blue">ERC-4337</DocsBadge>
        <DocsBadge variant="blue">EIP-7702</DocsBadge>
      </div>
    </DocsPage>
    </>
  );
}
