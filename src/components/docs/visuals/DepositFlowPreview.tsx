const MOCK_COMMITMENT = "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890";
const MOCK_TX = "0x7f3e...a1b2";

const snippetWrap = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";
const snippetInner = "w-full bg-[#06080F] font-mono px-4 py-3";

export function DepositAmountSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
            Amount (ETH)
          </span>
          <span className="text-[10px] text-[#00FF41]">
            BAL: 4.2500 ETH
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 p-2.5 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-white text-sm">
            1.5
          </div>
          <button className="px-3 py-2.5 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] text-xs font-bold text-[#00FF41] tracking-wider cursor-default">
            MAX
          </button>
        </div>
      </div>
    </div>
  );
}

export function DepositCommitmentSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-1.5">
          Poseidon Commitment
        </div>
        <p className="text-[11px] text-[#00FF41] break-all leading-relaxed">
          {MOCK_COMMITMENT.slice(0, 22)}...{MOCK_COMMITMENT.slice(-8)}
        </p>
        <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-1">
          C = Poseidon(ownerPubKey, amount, asset, chainId, blinding)
        </p>
      </div>
    </div>
  );
}

export function DepositProcessingSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={`${snippetInner} flex items-center justify-between gap-2`}>
        <Step label="Commitment" done />
        <Arrow />
        <Step label="Submit tx" done />
        <Arrow />
        <Step label="Save note" active />
      </div>
    </div>
  );
}

export function DepositSuccessSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={`${snippetInner} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-xs text-white font-semibold">Deposit Successful</span>
          <span className="text-[10px] text-[rgba(255,255,255,0.4)]">1.5 ETH</span>
        </div>
        <span className="text-[11px] text-[#00FF41]">{MOCK_TX}</span>
      </div>
    </div>
  );
}

function Step({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {done && (
        <div className="w-3.5 h-3.5 rounded-full border border-[#00FF41] flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
      {active && (
        <div className="w-3.5 h-3.5 rounded-full border border-[#00FF41] bg-[rgba(0,255,65,0.15)]" />
      )}
      <span className={`text-[11px] ${done ? "text-[#00FF41]" : active ? "text-white" : "text-[rgba(255,255,255,0.3)]"}`}>
        {label}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
