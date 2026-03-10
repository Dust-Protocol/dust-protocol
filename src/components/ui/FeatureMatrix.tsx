"use client";

import { getChainFeatures, FEATURE_LABELS, type ChainFeatures } from "@/lib/chain-features";

interface FeatureMatrixProps {
  chainId: number;
}

export function FeatureMatrix({ chainId }: FeatureMatrixProps) {
  const features = getChainFeatures(chainId);
  const entries = Object.entries(features) as [keyof ChainFeatures, boolean][];

  return (
    <div className="px-4 py-2.5 flex flex-col gap-1">
      {entries.map(([key, available]) => (
        <div
          key={key}
          className={`text-[10px] font-mono tracking-wide flex items-center gap-2 ${
            available ? 'text-[#00EF8B]/70' : 'text-white/20'
          }`}
        >
          <span>{available ? '>' : '—'}</span>
          <span>{FEATURE_LABELS[key]}</span>
        </div>
      ))}
    </div>
  );
}
