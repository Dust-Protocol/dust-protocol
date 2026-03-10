const MOCK = {
  recipient: "dust.bob",
  recipientKey: "0x1a2b3c...f9e8d7",
  inputNote: "1.0000 ETH",
  changeNote: "0.2500 ETH",
  outputNote: "0.7500 ETH",
};

const snippetWrap = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";
const snippetInner = "w-full bg-[#06080F] font-mono px-4 py-3";

export function TransferRecipientSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-1.5">
          Recipient
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
          <span className="text-xs text-[#00FF41]">@</span>
          <span className="text-xs text-white">{MOCK.recipient}</span>
          <span className="ml-auto text-[10px] text-[rgba(255,255,255,0.3)]">{MOCK.recipientKey}</span>
        </div>
        <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-1">
          Resolves via ERC-6538 stealth meta-address registry
        </p>
      </div>
    </div>
  );
}

export function TransferNoteSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-2">
          Note Consumption
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <div className="flex-1 p-2 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-center">
            <div className="text-[9px] text-[rgba(255,255,255,0.35)] mb-0.5">INPUT</div>
            <div className="text-white">{MOCK.inputNote}</div>
          </div>
          <Arrow />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="p-2 rounded-sm border border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.04)] text-center">
              <div className="text-[9px] text-[rgba(0,255,65,0.6)] mb-0.5">TO RECIPIENT</div>
              <div className="text-[#00FF41]">{MOCK.outputNote}</div>
            </div>
            <div className="p-2 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-center">
              <div className="text-[9px] text-[rgba(255,255,255,0.35)] mb-0.5">CHANGE</div>
              <div className="text-white">{MOCK.changeNote}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransferProcessingSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={`${snippetInner} flex items-center justify-between gap-2`}>
        <Step label="Resolve" done />
        <Arrow />
        <Step label="Prove" done />
        <Arrow />
        <Step label="Submit" done />
        <Arrow />
        <Step label="Confirm" active />
      </div>
    </div>
  );
}

export function TransferComparisonSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex items-center gap-4">
          {/* Transfer */}
          <div className="flex-1 p-2.5 rounded-sm border border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.04)] text-center">
            <div className="text-[9px] uppercase tracking-wider text-[rgba(0,255,65,0.6)] mb-1">Transfer</div>
            <div className="flex items-center justify-center gap-1.5 text-[11px]">
              <span className="text-[#00FF41]">Pool</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span className="text-[#00FF41]">Pool</span>
            </div>
            <div className="text-[9px] text-[rgba(0,255,65,0.5)] mt-1">Stays shielded</div>
          </div>
          {/* Withdraw */}
          <div className="flex-1 p-2.5 rounded-sm border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-center">
            <div className="text-[9px] uppercase tracking-wider text-[rgba(255,255,255,0.45)] mb-1">Withdraw</div>
            <div className="flex items-center justify-center gap-1.5 text-[11px]">
              <span className="text-white">Pool</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span className="text-white">Wallet</span>
            </div>
            <div className="text-[9px] text-[rgba(255,255,255,0.35)] mt-1">Exits to public</div>
          </div>
        </div>
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
