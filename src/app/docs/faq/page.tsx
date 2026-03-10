import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { docsMetadata } from "@/lib/seo/metadata";
import { faqPageJsonLd } from "@/lib/seo/jsonLd";

const faqs = [
  {
    q: "Is Dust Protocol fully private?",
    a: "Dust gives you strong on-chain privacy for payments and swaps, but it is not a silver bullet. Privacy depends on correct usage: using the Privacy Pool with a large anonymity set, waiting the recommended time before withdrawing, and not reusing claim addresses. Network-level metadata (IP address, timing) is outside what Dust can protect.",
  },
  {
    q: "Do I need ETH to use Dust?",
    a: "To receive and claim payments: no. Stealth claims are gasless — the DustPaymaster sponsors all claim transactions. To send a payment, you need a small amount of ETH in your regular wallet to cover the send transaction gas (~21,000–50,000 gas).",
  },
  {
    q: "What does a .dust name cost?",
    a: "During the testnet phase, .dust name registration is free. Mainnet pricing has not been announced yet.",
  },
  {
    q: "What happens to funds if I lose my PIN?",
    a: "Funds already claimed to your regular wallet are not affected — they are in your standard wallet, controlled by your seed phrase. Unclaimed stealth payments (sitting at stealth addresses) require your PIN to claim. Private pool and swap deposits require their locally-stored deposit notes to withdraw — neither the PIN nor the stealth keys alone are sufficient for ZK withdrawals.",
  },
  {
    q: "Can two people send to the same .dust name?",
    a: "Yes, and this is expected. Each payment produces a completely different one-time stealth address — the sender picks a fresh random ephemeral key every time. Two people paying alice.dust at the same time produce two entirely unrelated stealth addresses with no on-chain link.",
  },
  {
    q: "How long does ZK proof generation take?",
    a: "DustPool V2 proofs use FFLONK (no trusted setup) and take approximately 2–3 seconds for the standard 2-in-2-out circuit. Split circuit proofs (2-in-8-out for denomination privacy) take 4–5 seconds. DustSwap proofs use Groth16 and take ~1–2 seconds. The proving key files (~50MB) are downloaded once and cached by the browser.",
  },
  {
    q: "Is the ZK proof generated on my device?",
    a: "Yes. All proof generation happens entirely in your browser using WebAssembly. The proving key and circuit WASM are public files hosted alongside the app. No private inputs (nullifier, secret, stealth key) are ever sent to any server.",
  },
  {
    q: "What is the anonymity set for DustPool withdrawals?",
    a: "In DustPool V2, the anonymity set is the number of notes in the off-chain Merkle tree at the time you generate your proof. V2 uses a UTXO model — each deposit creates a note, and the proof references a specific Merkle root. The set includes all notes inserted before that root. Because V2 supports arbitrary amounts (unlike fixed-denomination mixers), the anonymity set grows with every deposit regardless of amount.",
  },
  {
    q: "Can I use Dust on mobile?",
    a: "Yes. The app is fully responsive. ZK proof generation works on mobile browsers (Chrome/Safari on iOS and Android). Proof generation may take 3–5 seconds on lower-end devices due to the WASM computation.",
  },
  {
    q: "Why are privacy swaps only available on Ethereum Sepolia?",
    a: "DustSwap requires Uniswap V4, which is currently only deployed on Ethereum Sepolia in our configuration. Thanos Sepolia has stealth transfers and the Privacy Pool. DustSwap support for Thanos will be added when a V4 deployment is available.",
  },
  {
    q: "What is ERC-5564?",
    a: "ERC-5564 is an Ethereum standard that defines the format for announcing stealth address payments on-chain. It specifies how the ephemeral public key and the stealth address are published so any recipient scanner can try to detect payments meant for them.",
  },
  {
    q: "What is ERC-6538?",
    a: "ERC-6538 is a registry standard that maps wallet addresses to stealth meta-addresses. It allows anyone to look up whether a given wallet address has a registered stealth meta-address, enabling payments without requiring a .dust name.",
  },
  {
    q: "Are there audits?",
    a: "Dust Protocol has undergone an internal security audit covering circuits, contracts, relayer, and frontend. 16 findings were identified and resolved across critical, high, medium, and low severity levels. The contracts include security hardening: Pausable, Ownable2Step, chainId binding, solvency tracking, and compliance screening. A formal third-party audit is planned before mainnet deployment. Do not use mainnet funds on testnet.",
  },
  {
    q: "What is the difference between DustPool V1 and V2?",
    a: "V1 uses a simple mixer model with Groth16 proofs and a fixed commitment structure (Poseidon of nullifier, secret, and amount). V2 uses a ZK-UTXO model with FFLONK proofs (no trusted setup), arbitrary-amount deposits, a 2-in-2-out transaction circuit, and a 2-in-8-out split circuit for denomination privacy. V2 also adds compliance screening (Chainalysis oracle), deposit cooldowns, and encrypted note storage.",
  },
  {
    q: "What is FFLONK?",
    a: "FFLONK is a zero-knowledge proof system that requires no trusted setup ceremony (unlike Groth16). It is 22% cheaper to verify on-chain than Groth16 when there are 8+ public signals. DustPool V2 uses FFLONK for all pool proofs. DustSwap still uses Groth16.",
  },
  {
    q: "What is the deposit cooldown?",
    a: "After depositing to DustPoolV2, there is a 1-hour cooldown period during which withdrawals can only go to the original depositor's address. After the cooldown expires, funds can be withdrawn to any address. This gives compliance systems time to flag suspicious deposits before funds can be mixed.",
  },
  {
    q: "What are view keys?",
    a: "A view key is a pair of values (ownerPubKey + nullifierKey) derived from your stealth keys that allows a third party to verify your transaction history without gaining spending authority. You can generate a disclosure report from Settings that lists all your notes with Poseidon commitment verification. Useful for tax reporting, audits, or regulatory compliance.",
  },
  {
    q: "Can a view key holder spend my funds?",
    a: "No. The view key contains the ownerPubKey and nullifierKey but not the spending key. The holder can see all your deposits, transfers, and which notes are spent, but cannot generate valid withdrawal proofs. Only the spending key (derived from wallet signature + PIN) can authorize fund movement.",
  },
  {
    q: "What is denomination privacy?",
    a: "When you withdraw a specific amount (e.g., 7.3 ETH), the amount itself can be used to correlate your deposit and withdrawal. The split circuit breaks withdrawals into common denomination chunks (10, 5, 3, 2, 1, 0.5, etc.) submitted as separate transactions with randomized timing. An observer sees only standard-looking amounts with no obvious pattern linking them to your original deposit.",
  },
  {
    q: "Are deposits screened for sanctions compliance?",
    a: "Yes. DustPoolV2 integrates with the Chainalysis sanctions oracle. Every deposit checks the depositor's address against the sanctions list. If the address is flagged, the transaction reverts. This prevents sanctioned funds from entering the privacy pool while preserving privacy for legitimate users.",
  },
  {
    q: "What happens if I deposit during a chain reorganization?",
    a: "The contract maintains a root history (100 past roots). Your proof can reference any recent valid root. If a reorg invalidates the latest root, older roots remain valid. The relayer also maintains tree checkpoints for recovery.",
  },
  {
    q: "Is the code open source?",
    a: "The contract code is available in the project repository. The full source for the circuits, contracts, and app is accessible for review. See the Smart Contracts page for source file paths.",
  },
  {
    q: "How do I back up my deposit notes?",
    a: "V2 deposit notes are encrypted with AES-256-GCM and stored in your browser's IndexedDB (not plaintext localStorage like V1). Go to Settings to export your notes. Store the exported data in a password manager or encrypted storage. Notes are bearer instruments — anyone with the decrypted note data can generate a withdrawal proof.",
  },
];

export const metadata = docsMetadata("FAQ — Stealth Addresses, Privacy Pools & ZK Proofs", "Frequently asked questions about Dust Protocol privacy, V2 ZK-UTXO pools, FFLONK proofs, compliance screening, view keys, gas costs, and security.", "/docs/faq");

export default function FaqPage() {
  const faqJsonLd = faqPageJsonLd(faqs.map(f => ({ question: f.q, answer: f.a })));

  return (
    <>
      {/* All values are hardcoded string literals from jsonLd.ts — safeJsonLd escapes < as \u003c */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      <DocsPage
        currentHref="/docs/faq"
        title="FAQ"
        subtitle="Frequently asked questions about privacy, gas, supported tokens, and how Dust Protocol works."
        badge="TECHNICAL REFERENCE"
      >
        <DocsCallout type="info" title="Can't find your answer?">
          If your question isn't covered here, check the other docs pages or reach out via the community channels.
        </DocsCallout>

        <div className="mt-8 space-y-1">
          {faqs.map((item, i) => (
            <details
              key={i}
              className="group border border-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden open:border-[rgba(0,255,65,0.1)]"
            >
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                <span className="text-[13px] font-mono text-white">{item.q}</span>
                <span className="shrink-0 text-[rgba(255,255,255,0.3)] group-open:text-[#00FF41] font-mono text-lg leading-none transition-colors select-none">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </DocsPage>
    </>
  );
}
