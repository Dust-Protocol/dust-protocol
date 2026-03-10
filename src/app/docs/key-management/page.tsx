import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { KeyManagement } from "@/components/docs/visuals/KeyManagement";
import { docsMetadata } from "@/lib/seo/metadata";

export const metadata = docsMetadata("Key Management — Stealth Key Derivation & Security", "How Dust derives stealth keys using PBKDF2 with 100K iterations — including V2 BN254 keys, view keys for selective disclosure, and AES-256-GCM note encryption. Keys stay in browser memory, never persisted to localStorage or sent to servers.", "/docs/key-management");

export default function KeyManagementPage() {
  return (
    <DocsPage
      currentHref="/docs/key-management"
      title="Key Management"
      subtitle="How Dust derives, stores, and protects your stealth keys — and what you should back up."
      badge="ACCOUNT & SECURITY"
    >

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Key Derivation</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Dust derives two secp256k1 private keys — a <strong>spend key</strong> and a{" "}
          <strong>view key</strong> — purely in the browser. They are never sent to any server.
        </p>

        <div className="mb-8">
          <KeyManagement />
        </div>

        <div className="font-mono text-xs leading-relaxed text-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm p-5 overflow-x-auto whitespace-pre mb-6">
          {`walletSignature  =  sign("Dust Protocol stealth keys", wallet)
salt             =  "dust-stealth-v1"
ikm              =  PBKDF2-SHA512(
                      password = walletSignature + PIN,
                      salt     = salt,
                      iters    = 100_000,
                      dkLen    = 64 bytes
                    )
spendKey         =  ikm[0:32]  (mod secp256k1 order)
viewKey          =  ikm[32:64] (mod secp256k1 order)`}
        </div>

        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          Because the derivation uses <strong>both</strong> the wallet signature and the PIN, neither alone is
          sufficient to reproduce the keys. An attacker who compromises your wallet cannot derive stealth keys
          without knowing your PIN, and vice versa.
        </p>
      </section>

      {/* Key roles */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">The Two Keys</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 border border-[rgba(0,255,65,0.12)] rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-mono font-semibold text-white">Spend Key</p>
              <DocsBadge variant="green">HIGH SENSITIVITY</DocsBadge>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              Controls the ability to <strong>claim funds</strong> from stealth addresses. Used to derive the
              per-payment stealth private key when a payment is detected. Never leaves the browser. The public
              part (<code>spendKey × G</code>) is registered on-chain as half of your meta-address.
            </p>
          </div>
          <div className="p-4 border border-[rgba(255,255,255,0.07)] rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-mono font-semibold text-white">View Key</p>
              <DocsBadge variant="muted">MEDIUM SENSITIVITY</DocsBadge>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              Used to <strong>detect</strong> incoming payments by scanning announcements. Cannot spend funds.
              The public part is registered on-chain. The private part is used only in the scanner and never
              leaves the browser.
            </p>
          </div>
        </div>
      </section>

      {/* V2 Keys */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">V2 Key Derivation (Privacy Pool)</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          DustPool V2 uses a separate key derivation for its ZK-UTXO model. V2 keys operate on the
          <strong> BN254 curve</strong> (required for FFLONK proofs) rather than secp256k1.
        </p>

        <div className="font-mono text-xs leading-relaxed text-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm p-5 overflow-x-auto whitespace-pre mb-6">
          {`walletSignature  =  sign("Dust Protocol stealth keys", wallet)
salt             =  "dust-stealth-v2"
ikm              =  PBKDF2-SHA512(
                      password = walletSignature + PIN,
                      salt     = salt,
                      iters    = 100_000,
                      dkLen    = 64 bytes
                    )
spendingSeed     =  ikm[0:32]
viewingSeed      =  ikm[32:64]
spendingKey      =  SHA-256(spendingSeed) mod BN254_ORDER
nullifierKey     =  SHA-256(viewingSeed) mod BN254_ORDER
ownerPubKey      =  Poseidon(spendingKey)`}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 border border-[rgba(0,255,65,0.12)] rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-mono font-semibold text-white">Spending Key</p>
              <DocsBadge variant="green">HIGH SENSITIVITY</DocsBadge>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              Derives the <code>ownerPubKey</code> (via Poseidon hash) that appears in UTXO commitments.
              Required to spend notes. The <code>ownerPubKey</code> is public; the spending key is secret.
            </p>
          </div>
          <div className="p-4 border border-[rgba(255,255,255,0.07)] rounded-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-mono font-semibold text-white">Nullifier Key</p>
              <DocsBadge variant="amber">MEDIUM SENSITIVITY</DocsBadge>
            </div>
            <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">
              Used to compute nullifiers: <code>N = Poseidon(nullifierKey, leafIndex)</code>. Knowing
              this key allows an auditor to track which notes have been spent — used in view keys for
              voluntary disclosure.
            </p>
          </div>
        </div>
      </section>

      {/* View Keys */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">View Keys & Selective Disclosure</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          A <strong>view key</strong> allows a third party (auditor, tax authority, compliance officer) to verify
          your transaction history without gaining spending authority. It contains the <code>ownerPubKey</code>
          and <code>nullifierKey</code> — enough to verify commitments and track spent notes, but not enough
          to move funds.
        </p>

        <div className="font-mono text-xs leading-relaxed text-[rgba(255,255,255,0.5)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm p-5 overflow-x-auto whitespace-pre mb-6">
          {`ViewKey = {
  ownerPubKey:   Poseidon(spendingKey)    // public — in commitments
  nullifierKey:  SHA-256(viewingSeed) mod BN254_ORDER
}

Serialized as:  dvk1:<hex(ownerPubKey)><hex(nullifierKey)>

Verification:
  For each note (amount, asset, chainId, blinding):
    recompute C = Poseidon(ownerPubKey, amount, asset, chainId, blinding)
    check C == on-chain commitment  ✓`}
        </div>

        <DocsCallout type="warning" title="View key security">
          A view key holder can see all your deposits, transfers, and spending patterns. They can compute
          nullifiers (track which notes are spent). They <strong>cannot</strong> spend your funds — the
          spending key is not included. Share view keys only with parties you trust to see your full
          transaction history.
        </DocsCallout>
      </section>

      {/* Storage */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">What Is Stored Locally</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Item</th>
                <th className="text-left py-2 pr-6 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Where</th>
                <th className="text-left py-2 text-[rgba(255,255,255,0.3)] font-normal tracking-wider uppercase text-[10px]">Sensitivity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {[
                ["PIN hash (bcrypt)", "localStorage", "Medium — reveals PIN if brute-forced"],
                ["Scan cursor (last scanned block)", "localStorage", "Low — public information"],
                ["Detected stealth addresses + balances cache", "localStorage", "Low — public information"],
                ["DustPool deposit notes (nullifier + secret)", "localStorage", "HIGH — losing this = losing funds"],
                ["DustSwap deposit notes (nullifier + secret)", "localStorage", "HIGH — losing this = losing funds"],
                ["Payment link definitions", "localStorage", "Low"],
                ["Claim addresses (HD-derived)", "localStorage", "Low — derivable from keys"],
                ["V2 deposit notes (encrypted)", "IndexedDB", "HIGH — AES-256-GCM encrypted, key from spendingKey"],
                ["V2 note encryption key", "Derived on-demand", "Never stored — SHA-256(spendingKey bytes)"],
              ].map(([item, where, sens]) => (
                <tr key={item} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <td className="py-2.5 pr-6 text-[rgba(255,255,255,0.7)]">{item}</td>
                  <td className="py-2.5 pr-6 text-[rgba(255,255,255,0.35)]">{where}</td>
                  <td className={`py-2.5 text-xs ${sens.startsWith("HIGH") ? "text-[#FFB000]" : "text-[rgba(255,255,255,0.4)]"}`}>{sens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DocsCallout type="warning" title="Back up your deposit notes">
          Pool and swap deposit notes (nullifier + secret) are the only way to generate a withdrawal proof.
          They exist <strong>only in your browser's localStorage</strong>. Export them from the Wallet page
          and store them securely. If you lose them, your deposited funds cannot be recovered.
        </DocsCallout>
      </section>

      {/* What happens if */}
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">What If I Lose Something?</h2>
        <div className="space-y-3">
          {[
            {
              scenario: "I forget my PIN",
              outcome: "You cannot re-derive your stealth keys. However, your wallet address still holds any funds you've claimed to it. You can re-register by creating a new PIN and a new .dust name — you'll lose the old name and any unclaimed stealth payments.",
              severity: "warning",
            },
            {
              scenario: "I lose access to my wallet (seed phrase)",
              outcome: "You cannot re-derive your stealth keys (wallet signature required). Same outcome as forgetting your PIN. Claimed funds are whatever your seed phrase controls — they are not in the stealth system.",
              severity: "warning",
            },
            {
              scenario: "I clear my browser localStorage",
              outcome: "Stealth keys can be re-derived (log in again with wallet + PIN). Your .dust name is on-chain — it persists. Deposit notes are lost — DustPool / DustSwap deposits become unrecoverable if not backed up.",
              severity: "warning",
            },
            {
              scenario: "Someone sees my localStorage",
              outcome: "They see deposit notes and cached scan data. They cannot derive stealth keys from localStorage alone (keys are never stored — only re-derived on demand). Deposit notes are bearer instruments — treat localStorage like a physical notepad.",
              severity: "info",
            },
            {
              scenario: "I want to share my transaction history with an auditor",
              outcome: "Generate a view key from Settings → Disclosure. The view key contains your ownerPubKey and nullifierKey — enough for the auditor to verify all your notes and spending, but not enough to move funds. The auditor can independently verify commitments using Poseidon hash checks.",
              severity: "info",
            },
          ].map(({ scenario, outcome, severity }) => (
            <div key={scenario} className="border border-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)]">
                <p className="text-[11px] font-mono text-white">{scenario}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-[rgba(255,255,255,0.55)] leading-relaxed">{outcome}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Security Best Practices</h2>
        <ul className="space-y-2">
          {[
            "Use a strong, unique PIN — it is the second factor protecting your stealth keys.",
            "Export deposit notes from the Wallet page and store them offline or in a password manager.",
            "Do not share the private view key — it allows others to see all your incoming payments.",
            "The spend key is never stored — it is re-derived each session. This is a feature, not a bug.",
            "Settings → Danger Zone lets you clear all keys and start fresh if your PIN is compromised.",
            "V2 deposit notes are encrypted with AES-256-GCM in IndexedDB — even browser access doesn't expose note data without your keys.",
            "View keys allow selective disclosure. Share them only with trusted parties — they reveal your full transaction graph.",
          ].map((tip, i) => (
            <li key={i} className="flex gap-3 text-sm text-[rgba(255,255,255,0.6)]">
              <span className="shrink-0 text-[#00FF41] font-mono text-xs mt-1">→</span>
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </DocsPage>
  );
}
