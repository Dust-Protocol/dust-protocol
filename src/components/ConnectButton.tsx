"use client";

import React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-3.5 py-2 bg-[rgba(255,255,255,0.04)] rounded-sm border border-[rgba(255,255,255,0.06)]">
          <span className="text-[13px] text-[rgba(255,255,255,0.5)] font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <button
          className="px-4 py-2 bg-[rgba(255,255,255,0.06)] rounded-sm border border-[rgba(255,255,255,0.06)] cursor-pointer hover:bg-[rgba(255,80,80,0.1)] hover:border-[rgba(255,80,80,0.4)] transition-all duration-150 text-[13px] text-[#ff6b6b] font-medium"
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="px-5 py-2.5 bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] rounded-sm cursor-pointer hover:bg-[rgba(0,255,65,0.15)] hover:border-[#00FF41] hover:-translate-y-px active:translate-y-0 transition-all duration-150 text-sm font-bold text-[#00FF41] font-mono"
      onClick={() => connect({ connector: injected() })}
    >
      Connect Wallet
    </button>
  );
}
