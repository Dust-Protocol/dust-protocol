import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsStepList } from "@/components/docs/DocsStepList";
import { PaymentLinkCard } from "@/components/docs/visuals/PaymentLinkCard";
import { docsMetadata } from "@/lib/seo/metadata";

export const metadata = docsMetadata("Payment Links — Pay Anyone by .dust Username", "Create shareable payment URLs for your .dust name. Each link tracks analytics while all ETH lands at unique stealth addresses only you can claim.", "/docs/payment-links");

export default function PaymentLinksPage() {
  return (
    <DocsPage
      currentHref="/docs/payment-links"
      title="Payment Links"
      subtitle="Shareable URLs that receive private payments. Each link tracks its own analytics while all ETH lands at your stealth address."
      badge="CORE FEATURE"
    >

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">What Are Payment Links?</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Every <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">.dust</code> name gets a public
          pay page at <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">dustprotocol.app/pay/yourname</code>.
          You can create sub-links like{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">/pay/alice/freelance</code> to
          segment your income — one for a client, one for invoices, one for tips — while everything routes to the
          same stealth wallet.
        </p>

        <div className="mb-6">
          <PaymentLinkCard />
        </div>

        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          Each link tracks payment count and total volume independently. The analytics come from on-chain
          announcement metadata — each payment includes the link slug so scanning can attribute it.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">Creating a Payment Link</h2>
        <DocsStepList steps={[
          {
            title: "Go to the Links page",
            children: <>Navigate to <strong>LINKS</strong> in the navbar to see existing links and create new ones.</>,
          },
          {
            title: "Set a slug",
            children: <>The slug is the URL segment after your name — e.g. <code>freelance</code> in
              <code> /pay/alice/freelance</code>. You can add an internal label to help identify links on your dashboard.</>,
          },
          {
            title: "Share anywhere",
            children: <>Copy the full URL and share it on Twitter, email, invoices.
              Anyone clicking it can send ETH to your stealth address — they don&apos;t need a Dust account.</>,
          },
        ]} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">The Pay Page</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          The page at <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">dustprotocol.app/pay/[name]</code>{" "}
          is fully public. Senders only need to connect their wallet to send. They see:
        </p>
        <ul className="space-y-2">
          {[
            "Your .dust name and description",
            "An ETH amount field",
            "An optional message (stored in announcement metadata — only you can decrypt it)",
            "A Send button that generates the stealth address client-side and sends ETH",
          ].map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-[rgba(255,255,255,0.6)]">
              <span className="shrink-0 text-[#00FF41] mt-0.5">—</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <DocsCallout type="info" title="Privacy for senders">
        Senders don&apos;t need a Dust account. The pay page handles all cryptography client-side. The only on-chain
        record is the ETH transfer and announcement event — neither reveals the sender&apos;s relationship to the recipient.
      </DocsCallout>

      <section className="mt-8">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Fallback: No .dust Name</h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          If someone has registered a stealth meta-address on the{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">ERC-6538</code> registry but has no
          .dust name, Dust can still route payments to them. The pay page falls back to the ERC-6538 lookup, so any
          ERC-5564-compatible stealth address works.
        </p>
      </section>
    </DocsPage>
  );
}
