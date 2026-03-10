"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSupportedChains, type ChainConfig } from "@/config/chains";
import { ChainIcon as ChainTokenIcon } from "@/components/stealth/icons";

const chains = getSupportedChains();

function ChainIcon({ chain, size = 16 }: { chain: ChainConfig; size?: number }) {
  return <ChainTokenIcon size={size} chainId={chain.id} />;
}

export function ChainSelector({ compact = false }: { compact?: boolean }) {
  const { activeChainId, setActiveChain } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeChain = chains.find(c => c.id === activeChainId) || chains[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerClass = compact
    ? "flex items-center gap-1.5 text-[10px] font-mono text-[rgba(255,255,255,0.7)] hover:text-white transition-all bg-transparent border-none outline-none"
    : "flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[10px] font-mono text-[rgba(255,255,255,0.7)] hover:border-[rgba(0,255,65,0.2)] transition-all";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClass}
      >
        <ChainIcon chain={activeChain} />
        <span>{activeChain.name}</span>
        <span
          className="text-[8px] transition-transform duration-150"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 bg-[#0a0d14] border border-[rgba(255,255,255,0.1)] rounded-sm min-w-[140px] z-50">
          {chains.map(chain => {
            const isActive = chain.id === activeChainId;
            return (
              <button
                key={chain.id}
                onClick={() => {
                  setActiveChain(chain.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[10px] font-mono transition-all flex items-center gap-2 ${
                  isActive
                    ? 'text-[#00FF41] bg-[rgba(0,255,65,0.05)]'
                    : 'text-[rgba(255,255,255,0.6)] hover:bg-[rgba(0,255,65,0.05)] hover:text-[#00FF41]'
                }`}
              >
                <ChainIcon chain={chain} />
                <span className="flex-1">{chain.name}</span>
                <span className="text-[rgba(255,255,255,0.3)]">{chain.nativeCurrency.symbol}</span>
                {isActive && (
                  <span className="text-[#00FF41] font-bold">•</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
