"use client";

import { useSwitchChain } from "wagmi";
import { DEFAULT_CHAIN_ID, getChainConfig } from "@/config/chains";
import { AlertCircleIcon } from "@/components/stealth/icons";

interface UnsupportedChainNoticeProps {
  feature: string;
  supportedChainIds?: number[];
}

export function UnsupportedChainNotice({ feature, supportedChainIds }: UnsupportedChainNoticeProps) {
  const { switchChain } = useSwitchChain();
  const targetChainId = supportedChainIds?.[0] ?? DEFAULT_CHAIN_ID;
  const targetName = getChainConfig(targetChainId).name;

  return (
    <div className="mb-4 p-3 rounded-sm bg-[rgba(255,176,0,0.06)] border border-[rgba(255,176,0,0.2)]">
      <div className="flex items-start gap-2 mb-3">
        <AlertCircleIcon size={14} color="#FFB000" />
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-[#FFB000] font-mono">
            CHAIN_UNSUPPORTED
          </span>
          <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono leading-relaxed">
            {feature} is not deployed on this chain.
          </span>
        </div>
      </div>
      <button
        onClick={() => switchChain?.({ chainId: targetChainId })}
        className="w-full py-2 rounded-sm text-xs font-bold font-mono text-[#FFB000] bg-[rgba(255,176,0,0.08)] border border-[rgba(255,176,0,0.25)] hover:bg-[rgba(255,176,0,0.14)] hover:border-[#FFB000] transition-all tracking-wider"
      >
        SWITCH TO {targetName.toUpperCase()}
      </button>
    </div>
  );
}
