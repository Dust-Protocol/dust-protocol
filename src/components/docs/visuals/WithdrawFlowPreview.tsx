const WRAP = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";
const BG = "bg-[#06080F] font-mono";

export function WithdrawBalanceSnippet() {
  return (
    <div className={WRAP}>
      <div className={`${BG} px-5 py-4`}>
        <p className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-1">
          Shielded Balance
        </p>
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-extrabold text-white">
            3.5000{" "}
            <span className="text-sm font-semibold text-[rgba(255,255,255,0.5)]">ETH</span>
          </p>
          <span className="text-[10px] text-[rgba(255,255,255,0.35)]">4 unspent notes</span>
        </div>
      </div>
    </div>
  );
}

export function WithdrawNoteSelectionSnippet() {
  return (
    <div className={WRAP}>
      <div className={`${BG} px-5 py-4`}>
        <p className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-2">
          Note Selection
        </p>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-[rgba(255,255,255,0.4)]">Input note</span>
          <span className="text-[11px] font-semibold text-white">2.000000 ETH</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] text-[rgba(255,255,255,0.4)]">Withdraw</span>
          <span className="text-[11px] font-semibold text-white">1.000000 ETH</span>
        </div>
        <div className="flex justify-between items-center pt-1.5 border-t border-[rgba(255,255,255,0.06)]">
          <span className="text-[11px] text-[rgba(255,255,255,0.4)]">Change returned</span>
          <span className="text-[11px] font-semibold text-[#00FF41]">1.000000 ETH</span>
        </div>
      </div>
    </div>
  );
}

const CHUNKS = ["0.5", "0.3", "0.2"];

export function WithdrawDenomSnippet() {
  return (
    <div className={WRAP}>
      <div className={`${BG} px-5 py-4`}>
        <p className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-2">
          Privacy Split &mdash; {CHUNKS.length} chunks
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CHUNKS.map((val, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-sm bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] text-[10px] text-[#00FF41]"
            >
              {val} ETH
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WithdrawCooldownSnippet() {
  return (
    <div className={WRAP}>
      <div className="bg-[#06080F] font-mono px-5 py-4">
        <div className="p-3 rounded-sm bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.15)]">
          <div className="flex items-start gap-2">
            <span className="text-[#FFB000] text-sm mt-px">&#9888;</span>
            <div className="flex flex-col gap-1">
              <p className="text-xs text-[#FFB000] font-semibold">
                Deposit in cooldown &mdash; 45:23 remaining
              </p>
              <p className="text-[11px] text-[rgba(255,255,255,0.4)] leading-relaxed">
                Withdrawal must go to original depositor during cooldown period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = ["proof", "verify", "submit", "confirm"];

export function WithdrawProcessingSnippet() {
  return (
    <div className={WRAP}>
      <div className={`${BG} px-5 py-3 flex items-center justify-between`}>
        <span className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
          Pipeline
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          {STEPS.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-[rgba(255,255,255,0.2)]">&rarr;</span>}
              <span className="text-[#00FF41]">{s}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
