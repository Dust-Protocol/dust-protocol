"use client";

const SNIPPET_WRAPPER = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";
const BG = "bg-[#06080F]";
const ACCENT = "#00FF41";

const MOCK_ADDRESSES = [
  { addr: "0x1a2b...3c4d", balance: "0.5000", status: "unclaimed" as const },
  { addr: "0x5e6f...7g8h", balance: "1.2000", status: "claimed" as const },
  { addr: "0x9i0j...1k2l", balance: "0.0000", status: "empty" as const },
] as const;

function StatusBadge({ status }: { status: "unclaimed" | "claimed" | "empty" }) {
  if (status === "claimed") {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.15)]">
        <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
        <span className="text-[10px] font-mono font-bold text-[#00FF41]">CLAIMED</span>
      </div>
    );
  }
  if (status === "unclaimed") {
    return (
      <div className="flex items-center justify-center px-3 py-1.5 rounded-sm bg-[#00FF41] text-[10px] font-mono font-bold text-black">
        CLAIM
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
      <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)]">EMPTY</span>
    </div>
  );
}

export function WalletAddressListSnippet() {
  return (
    <div className={SNIPPET_WRAPPER}>
      <div className={`${BG} px-4 py-4`}>
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" className="w-3.5 h-3.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">STEALTH_ADDRESSES</span>
          <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono">{MOCK_ADDRESSES.length} found</span>
        </div>
        <div className="flex flex-col">
          {MOCK_ADDRESSES.map((entry, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-full ${
                  entry.status === "claimed"
                    ? "bg-[rgba(0,255,65,0.1)]"
                    : entry.status === "unclaimed"
                    ? "bg-[rgba(0,255,65,0.06)]"
                    : "bg-[rgba(255,255,255,0.03)]"
                }`}>
                  {entry.status === "claimed" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : entry.status === "unclaimed" ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" className="w-3 h-3"><line x1="17" y1="7" x2="7" y2="17" /><polyline points="17 17 7 17 7 7" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" className="w-3 h-3"><circle cx="12" cy="12" r="10" /></svg>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-white">{entry.addr}</span>
                  <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)]">{entry.balance} ETH</span>
                </div>
              </div>
              <StatusBadge status={entry.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WalletSendSnippet() {
  return (
    <div className={SNIPPET_WRAPPER}>
      <div className={`${BG} px-4 py-4`}>
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" className="w-3.5 h-3.5"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">SEND</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
              <span className="text-xs font-mono text-[rgba(255,255,255,0.5)]">dust.bob</span>
            </div>
            <div className="px-3 py-2 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] w-28">
              <span className="text-xs font-mono text-white">0.5 ETH</span>
            </div>
          </div>
          <div className="flex items-center justify-center py-2 rounded-sm bg-[#00FF41] font-mono font-bold text-xs text-black">
            Send
          </div>
        </div>
      </div>
    </div>
  );
}

export function WalletReceiveSnippet() {
  return (
    <div className={SNIPPET_WRAPPER}>
      <div className={`${BG} px-4 py-4`}>
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" className="w-3.5 h-3.5"><line x1="17" y1="7" x2="7" y2="17" /><polyline points="17 17 7 17 7 7" /></svg>
          <span className="text-[9px] text-[rgba(255,255,255,0.5)] uppercase tracking-wider font-mono">RECEIVE</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-mono font-bold text-[#00FF41]">dust.alice</span>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.4)]">st:thanos:0x04a1b2...c3d4e5</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" className="w-3 h-3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.5)]">Copy</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WalletV1V2ComparisonSnippet() {
  return (
    <div className={SNIPPET_WRAPPER}>
      <div className={`${BG} px-4 py-4`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3">
            <div className="text-[10px] font-mono font-bold text-white tracking-wider mb-2">V1: STEALTH ADDRESSES</div>
            <div className="flex flex-col gap-1.5 text-[10px] font-mono text-[rgba(255,255,255,0.5)]">
              <span>Individual claim per address</span>
              <span>Visible amounts on-chain</span>
              <span>Fan-in: each claimed separately</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" className="w-3 h-3"><polyline points="7 7 12 12 7 17" /></svg>
              <span className="text-[9px] font-mono text-[rgba(255,255,255,0.3)]">ECDH + ERC-5564</span>
            </div>
          </div>
          <div className="rounded-sm border border-[rgba(0,255,65,0.15)] bg-[rgba(0,255,65,0.03)] p-3">
            <div className="text-[10px] font-mono font-bold text-[#00FF41] tracking-wider mb-2">V2: UTXO POOL</div>
            <div className="flex flex-col gap-1.5 text-[10px] font-mono text-[rgba(255,255,255,0.5)]">
              <span>ZK proof withdrawal</span>
              <span>Hidden amounts (Pedersen)</span>
              <span>No fan-in problem</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" className="w-3 h-3"><polyline points="7 7 12 12 7 17" /></svg>
              <span className="text-[9px] font-mono text-[rgba(0,255,65,0.5)]">FFLONK + Poseidon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
