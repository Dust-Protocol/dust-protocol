"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePaymentLinks } from "@/hooks/stealth/usePaymentLinks";
import { useStealthScanner } from "@/hooks/stealth";
import { cardAccents } from "@/lib/design/tokens";
import { LinkCard } from "@/components/links/LinkCard";
import { PlusIcon } from "@/components/stealth/icons";

export default function LinksPage() {
  const router = useRouter();
  const { ownedNames, stealthKeys, activeChainId } = useAuth();
  const { links } = usePaymentLinks();
  const { payments, scanInBackground, stopBackgroundScan } = useStealthScanner(stealthKeys, { chainId: activeChainId });
  const username = ownedNames[0]?.name || "";

  useEffect(() => {
    if (stealthKeys) {
      scanInBackground();
      return () => stopBackgroundScan();
    }
  }, [stealthKeys, scanInBackground, stopBackgroundScan]);

  // Compute per-link payment counts — only payments tagged with that link's slug
  const linkStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    for (const p of payments) {
      const slug = p.announcement.linkSlug;
      if (!slug) continue;
      const amount = parseFloat(p.originalAmount || p.balance || "0");
      if (!stats[slug]) stats[slug] = { count: 0, total: 0 };
      stats[slug].count++;
      stats[slug].total += amount;
    }
    return stats;
  }, [payments]);

  return (
    <div className="px-4 md:px-10 py-5 md:py-10 max-w-[780px] mx-auto">
      <div className="flex flex-col gap-7">
        {/* Page heading */}
        <h1 className="text-2xl font-bold tracking-widest text-white font-mono text-center">Links</h1>

        {/* Grid: Create New Link + Existing Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Create New Link card */}
          <button
            className="p-6 rounded-sm border-2 border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.01)] hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.03)] transition-all flex items-center justify-center min-h-[200px] cursor-pointer"
            onClick={() => router.push("/links/create")}
          >
            <div className="flex flex-col items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.05)] flex items-center justify-center">
                <PlusIcon size={24} color="rgba(255,255,255,0.4)" />
              </div>
              <p className="text-sm font-medium text-[rgba(255,255,255,0.5)]">Create New Link</p>
            </div>
          </button>

          {/* Personal link (from owned names) */}
          {ownedNames.map((name, i) => (
            <LinkCard key={name.name} name={name} type="personal" accentColor={cardAccents[i % cardAccents.length]} />
          ))}

          {/* Custom links — override payments count with real scanned data */}
          {links.map((link, i) => {
            const stats = linkStats[link.slug];
            const enrichedLink = stats
              ? { ...link, payments: stats.count }
              : link;
            return (
              <LinkCard key={link.id} link={enrichedLink} username={username} type="custom"
                accentColor={cardAccents[(ownedNames.length + i) % cardAccents.length]} />
            );
          })}
        </div>
      </div>
    </div>
  );
}
