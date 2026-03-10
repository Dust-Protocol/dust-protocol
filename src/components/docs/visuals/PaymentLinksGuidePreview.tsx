"use client";

const snippetWrap = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";

export function LinksCreateSnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F] px-4 py-3 font-mono flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-1.5">Amount</div>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
            <span className="text-sm text-white">0.1</span>
            <span className="text-[10px] text-[rgba(255,255,255,0.4)]">ETH</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-1.5">Memo</div>
          <div className="px-2.5 py-1.5 rounded-sm bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
            <span className="text-xs text-[rgba(255,255,255,0.5)]">Coffee payment</span>
          </div>
        </div>
        <button className="shrink-0 self-end px-4 py-1.5 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] text-[11px] font-bold text-[#00FF41] tracking-wider cursor-default">
          Create Link
        </button>
      </div>
    </div>
  );
}

export function LinksGeneratedSnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F] px-4 py-3 font-mono flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-sm border border-[rgba(255,255,255,0.1)] flex items-center justify-center">
          <span className="text-[9px] text-[rgba(255,255,255,0.3)]">QR</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.4)] mb-1">Generated Link</div>
          <span className="text-[11px] text-[#00FF41] truncate block">dust.app/pay/alice/abc123</span>
        </div>
        <button className="shrink-0 p-1.5 rounded-sm border border-[rgba(255,255,255,0.1)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" className="w-3.5 h-3.5">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function LinksClaimSnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F] px-4 py-3 font-mono">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-[10px] uppercase tracking-wider text-[rgba(255,255,255,0.45)]">PAY dust.alice</span>
          </div>
          <span className="text-xs text-[rgba(255,255,255,0.5)]">Coffee payment</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">0.1 ETH</span>
          <button className="ml-auto px-4 py-1.5 rounded-sm bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] text-[11px] font-bold text-[#00FF41] tracking-wider cursor-default">
            Pay 0.1 ETH
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  paid: "text-[#00FF41] border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.06)]",
  pending: "text-[rgba(255,255,255,0.5)] border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]",
};

function LinkRow({ name, amount, status }: { name: string; amount: string; status: "paid" | "pending" }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[rgba(255,255,255,0.04)] last:border-b-0">
      <span className="text-[11px] text-[rgba(255,255,255,0.6)] flex-1 min-w-0 truncate font-mono">{name}</span>
      <span className="text-[11px] text-white font-mono">{amount}</span>
      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${STATUS_COLORS[status]}`}>
        {status}
      </span>
    </div>
  );
}

export function LinksListSnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F] font-mono">
        <LinkRow name="pay/alice/coffee" amount="0.1 ETH" status="paid" />
        <LinkRow name="pay/alice/invoice-042" amount="0.5 ETH" status="pending" />
        <LinkRow name="pay/alice/tips" amount="0.05 ETH" status="paid" />
      </div>
    </div>
  );
}
