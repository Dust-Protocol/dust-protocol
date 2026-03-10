"use client";

import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { useV2Balance, useV2Keys } from "@/hooks/dustpool/v2";
import { getDustPoolV2Config } from "@/lib/dustpool/v2/contracts";
import { computeOwnerPubKey } from "@/lib/dustpool/v2/commitment";
import { V2DepositModal } from "@/components/dustpool/V2DepositModal";
import { V2WithdrawModal } from "@/components/dustpool/V2WithdrawModal";
import { V2TransferModal } from "@/components/dustpool/V2TransferModal";
import {
  ShieldIcon,
  LockIcon,
  AlertCircleIcon,
  TokenIcon,
} from "@/components/stealth/icons";
import { getChainConfig } from "@/config/chains";

interface V2SwapCardProps {
  chainId: number;
}

type ModalType = "deposit" | "withdraw" | "transfer" | null;

export function V2SwapCard({ chainId }: V2SwapCardProps) {
  const { isConnected } = useAccount();
  const { keysRef, hasKeys, hasPin, isDeriving, error: keyError, deriveKeys } = useV2Keys();
  const { balances, totalEthBalance, notes, isLoading, refreshBalances } = useV2Balance(keysRef, chainId);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [pinInput, setPinInput] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [v2PubKey, setV2PubKey] = useState<string | null>(null);
  const [pubKeyCopied, setPubKeyCopied] = useState(false);

  useEffect(() => {
    if (!hasKeys || !keysRef.current) {
      setV2PubKey(null);
      return;
    }
    const spendingKey = keysRef.current.spendingKey;
    computeOwnerPubKey(spendingKey).then(pk => {
      setV2PubKey(`0x${pk.toString(16)}`);
    }).catch((e) => {
      console.error('[V2SwapCard] Failed to derive pubkey:', e);
      setV2PubKey(null);
    });
  }, [hasKeys]);

  const v2Config = getDustPoolV2Config(chainId);
  const nativeSymbol = getChainConfig(chainId).nativeCurrency.symbol;
  const unspentCount = notes.filter(n => !n.spent).length;
  const formattedBalance = formatEther(totalEthBalance);
  const displayBalance = parseFloat(formattedBalance).toFixed(4);

  const handleModalClose = () => {
    setActiveModal(null);
    refreshBalances();
  };

  const handlePinSubmit = async () => {
    const ok = await deriveKeys(pinInput);
    if (ok) {
      setPinInput("");
      setShowPinInput(false);
      refreshBalances();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && pinInput.length === 6) {
      handlePinSubmit();
    }
  };

  if (!isConnected) {
    return (
      <div className="w-full">
        <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm backdrop-blur-sm relative overflow-hidden">
          <CornerAccents />
          <div className="p-6 sm:p-8">
            <V2Header />
            <div className="py-8 text-center">
              <p className="text-sm text-[rgba(255,255,255,0.3)] font-mono">
                Connect wallet to access V2 privacy pool
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!v2Config) {
    return (
      <div className="w-full">
        <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-sm backdrop-blur-sm relative overflow-hidden">
          <CornerAccents />
          <div className="p-6 sm:p-8">
            <V2Header />
            <div className="p-4 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
              <div className="flex items-start gap-2">
                <AlertCircleIcon size={14} color="#f59e0b" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    V2_POOL: NOT_DEPLOYED
                  </span>
                  <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono leading-relaxed">
                    DustPool V2 is not yet deployed on this chain. Use the Legacy swap tab for V1 swaps.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full" data-testid="v2-pool-card">
        <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(0,239,139,0.08)] rounded-sm backdrop-blur-sm relative overflow-hidden">
          <CornerAccents />
          <div className="p-6 sm:p-8">
            <V2Header isLoading={isLoading} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* Left Column: Balance & Actions */}
              <div className="flex flex-col justify-between">
                <div>
                  {/* Shielded Balance */}
                  <div className="mb-5 p-4 rounded-sm bg-[rgba(0,239,139,0.03)] border border-[rgba(0,239,139,0.1)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">
                        Shielded Balance
                      </span>
                      {unspentCount > 0 && (
                        <span className="text-[10px] text-[#00EF8B] font-mono">
                          {unspentCount} note{unspentCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white font-mono tracking-tight">
                        {isLoading ? "-.----" : displayBalance}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <TokenIcon symbol={nativeSymbol} size={16} />
                        <span className="text-sm text-[rgba(255,255,255,0.4)] font-mono">{nativeSymbol}</span>
                      </div>
                    </div>
                  </div>

                  {/* PIN verification */}
                  {!hasKeys && !showPinInput && (
                    <button
                      data-testid="pin-unlock-button"
                      onClick={() => setShowPinInput(true)}
                      className="mb-5 w-full p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)] hover:border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.1)] transition-all cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2">
                        <LockIcon size={12} color="#f59e0b" />
                        <span className="text-[11px] text-amber-400 font-mono">
                          {hasPin ? "Enter PIN to unlock V2 pool" : "Set up PIN to use V2 pool"}
                        </span>
                      </div>
                    </button>
                  )}

                  {!hasKeys && showPinInput && (
                    <div className="mb-5 p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
                      <div className="flex items-center gap-2 mb-2.5">
                        <LockIcon size={12} color="#f59e0b" />
                        <span className="text-[11px] text-amber-400 font-mono font-bold">Enter 6-digit PIN</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          data-testid="pin-input"
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          onKeyDown={handlePinKeyDown}
                          placeholder="------"
                          autoFocus
                          className="flex-1 px-3 py-2 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-sm text-center tracking-[0.3em] focus:outline-none focus:border-amber-400/50 transition-all placeholder-[rgba(255,255,255,0.15)]"
                        />
                        <button
                          data-testid="pin-submit"
                          onClick={handlePinSubmit}
                          disabled={pinInput.length !== 6 || isDeriving}
                          className="px-4 py-2 rounded-sm bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.2)] text-xs font-bold text-amber-400 font-mono disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          {isDeriving ? (
                            <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            "UNLOCK"
                          )}
                        </button>
                      </div>
                      {keyError && (
                        <p className="mt-2 text-[10px] text-red-400 font-mono">{keyError}</p>
                      )}
                    </div>
                  )}

                  {/* Unlocked indicator + V2 public key */}
                  {hasKeys && (
                    <div className="mb-5 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00EF8B]" />
                        <span className="text-[10px] text-[#00EF8B] font-mono">V2 keys active</span>
                      </div>
                      {v2PubKey && (
                        <div className="flex items-center gap-2 p-2 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]">
                          <span className="text-[9px] text-[rgba(255,255,255,0.4)] font-mono shrink-0">YOUR V2 KEY</span>
                          <span className="text-[10px] text-[rgba(255,255,255,0.6)] font-mono truncate">
                            {v2PubKey.slice(0, 10)}...{v2PubKey.slice(-6)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(v2PubKey).then(() => {
                                setPubKeyCopied(true);
                                setTimeout(() => setPubKeyCopied(false), 2000);
                              }).catch(() => { });
                            }}
                            className="shrink-0 px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold transition-all bg-[rgba(0,239,139,0.08)] border border-[rgba(0,239,139,0.15)] hover:bg-[rgba(0,239,139,0.15)] text-[#00EF8B] cursor-pointer"
                          >
                            {pubKeyCopied ? "COPIED" : "COPY"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    data-testid="v2-deposit-btn"
                    onClick={() => setActiveModal("deposit")}
                    disabled={!hasKeys}
                    className="py-3 px-3 rounded-sm bg-[rgba(0,239,139,0.08)] border border-[rgba(0,239,139,0.2)] hover:bg-[rgba(0,239,139,0.14)] hover:border-[#00EF8B] hover:shadow-[0_0_15px_rgba(0,239,139,0.12)] transition-all text-sm font-bold text-[#00EF8B] font-mono tracking-wider disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    DEPOSIT
                  </button>
                  <button
                    data-testid="v2-withdraw-btn"
                    onClick={() => setActiveModal("withdraw")}
                    disabled={!hasKeys || totalEthBalance === 0n}
                    className="py-3 px-3 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00EF8B] hover:bg-[rgba(0,239,139,0.06)] hover:shadow-[0_0_15px_rgba(0,239,139,0.08)] transition-all text-sm font-bold text-white hover:text-[#00EF8B] font-mono tracking-wider disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    WITHDRAW
                  </button>
                  <button
                    data-testid="v2-transfer-btn"
                    onClick={() => setActiveModal("transfer")}
                    disabled={!hasKeys || totalEthBalance === 0n}
                    className="py-3 px-3 rounded-sm border border-[rgba(255,255,255,0.1)] hover:border-[#00EF8B] hover:bg-[rgba(0,239,139,0.06)] hover:shadow-[0_0_15px_rgba(0,239,139,0.08)] transition-all text-sm font-bold text-white hover:text-[#00EF8B] font-mono tracking-wider disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    TRANSFER
                  </button>
                </div>
              </div>

              {/* Right Column: Information */}
              <div className="flex flex-col">
                {/* V2 feature highlight */}
                <div className="mb-5 text-[10px] text-[rgba(255,255,255,0.4)] font-mono border-l-2 border-[#00EF8B] pl-2">
                  Arbitrary amounts &middot; UTXO model &middot; FFLONK proofs
                </div>

                {/* How it works */}
                <div className="p-4 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] flex-1 h-full flex flex-col justify-center">
                  <p className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono mb-3">
                    How V2 Works
                  </p>
                  <div className="flex flex-col gap-3 text-[11px] text-[rgba(255,255,255,0.4)] font-mono leading-relaxed">
                    <div className="flex items-start gap-2">
                      <span className="text-[#00EF8B] font-bold">1</span>
                      <p>Deposit any amount of {nativeSymbol} into the shielded pool quietly</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#00EF8B] font-bold">2</span>
                      <p>Withdraw any amount to a fresh address — no link to depositor</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-[#00EF8B] font-bold">3</span>
                      <p>Transfer shielded funds to another user fully privately</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <V2DepositModal
        isOpen={activeModal === "deposit"}
        onClose={handleModalClose}
        keysRef={keysRef}
        chainId={chainId}
        hasKeys={hasKeys}
        hasPin={hasPin}
        onDeriveKeys={deriveKeys}
        isDeriving={isDeriving}
        keyError={keyError}
      />
      <V2WithdrawModal
        isOpen={activeModal === "withdraw"}
        onClose={handleModalClose}
        keysRef={keysRef}
        chainId={chainId}
        balances={balances}
      />
      <V2TransferModal
        isOpen={activeModal === "transfer"}
        onClose={handleModalClose}
        keysRef={keysRef}
        chainId={chainId}
        shieldedBalance={totalEthBalance}
      />
    </>
  );
}

function V2Header({ isLoading }: { isLoading?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <ShieldIcon size={14} color="#00EF8B" />
        <span className="text-xs font-bold font-mono text-white tracking-widest uppercase">
          PRIVACY_POOL
        </span>
        <span className="px-1.5 py-0.5 rounded-sm bg-[rgba(0,239,139,0.15)] text-[9px] text-[#00EF8B] font-mono font-bold">
          V2
        </span>
      </div>
      {isLoading && (
        <div className="w-3 h-3 border-2 border-[#00EF8B] border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
}

function CornerAccents() {
  return (
    <>
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)]" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)]" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)]" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)]" />
    </>
  );
}
