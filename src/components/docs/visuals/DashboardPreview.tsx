function CornerAccents() {
  return (
    <>
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[rgba(255,255,255,0.1)] rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[rgba(255,255,255,0.1)] rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[rgba(255,255,255,0.1)] rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[rgba(255,255,255,0.1)] rounded-br-sm" />
    </>
  );
}

function SnippetWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden">
      <div className="bg-[#06080F] px-4 py-4">
        <div className="max-w-[480px] mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full p-4 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] relative overflow-hidden ${className}`}>
      {children}
      <CornerAccents />
    </div>
  );
}

export function DashboardBalanceSnippet() {
  return (
    <SnippetWrapper>
      <Card>
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] shadow-[0_0_4px_#00FF41]" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">BALANCE_OVERVIEW</span>
          </div>
        </div>

        <div className="mb-3">
          <span className="text-2xl font-bold text-white font-mono tracking-tight">12.4500</span>
          <span className="text-sm text-[rgba(255,255,255,0.5)] font-mono ml-1.5">ETH</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-sm border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
            <div className="flex items-center gap-1.5 mb-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-[rgba(255,255,255,0.4)]"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Stealth</span>
            </div>
            <span className="text-xs font-bold text-white font-mono">2.2500 ETH</span>
          </div>
          <div className="p-2.5 rounded-sm border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]">
            <div className="flex items-center gap-1.5 mb-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-[rgba(255,255,255,0.4)]"><polyline points="20 6 9 17 4 12" /></svg>
              <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Claimed</span>
            </div>
            <span className="text-xs font-bold text-white font-mono">0.2000 ETH</span>
          </div>
        </div>
      </Card>
    </SnippetWrapper>
  );
}

export function DashboardPoolSnippet() {
  return (
    <SnippetWrapper>
      <Card className="border-[rgba(0,255,65,0.12)] bg-[rgba(0,255,65,0.02)]">
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">PRIVACY_POOL_V2</span>
            <span className="px-1.5 py-0.5 rounded-sm bg-[rgba(0,255,65,0.15)] text-[9px] text-[#00FF41] font-mono font-bold">V2</span>
          </div>
        </div>

        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-xl font-bold text-white font-mono tracking-tight">10.0000 ETH</span>
          <span className="text-[10px] text-[#00FF41] font-mono">4 notes</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["DEPOSIT", "WITHDRAW", "TRANSFER"].map((label) => (
            <div
              key={label}
              className="py-1.5 rounded-sm border border-[rgba(0,255,65,0.2)] text-center text-[10px] font-bold text-[#00FF41] font-mono"
            >
              [ {label} ]
            </div>
          ))}
        </div>
      </Card>
    </SnippetWrapper>
  );
}

export function DashboardActivitySnippet() {
  const activity = [
    { type: "deposit" as const, amount: "1.0000", label: "Deposit to V2 Pool", time: "2 min ago" },
    { type: "withdraw" as const, amount: "0.5000", label: "Withdraw (3 notes)", time: "18 min ago" },
    { type: "transfer" as const, amount: "0.2500", label: "Private transfer", time: "1 hr ago" },
  ];

  return (
    <SnippetWrapper>
      <Card>
        <div className="flex justify-between items-center mb-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">RECENT_ACTIVITY</span>
            <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono">12 total</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2.5">
          {["all", "incoming", "outgoing"].map((f, i) => (
            <div
              key={f}
              className={`px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wide border ${
                i === 0
                  ? "bg-[rgba(0,255,65,0.1)] border-[rgba(0,255,65,0.2)] text-[#00FF41]"
                  : "bg-transparent border-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.4)]"
              }`}
            >
              {f}
            </div>
          ))}
        </div>

        <div className="flex flex-col">
          {activity.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-[rgba(255,255,255,0.03)] last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1 rounded-full ${
                  item.type === "deposit"
                    ? "bg-[rgba(0,255,65,0.1)] text-[#00FF41]"
                    : item.type === "withdraw"
                    ? "bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.6)]"
                    : "bg-[rgba(100,160,255,0.1)] text-[rgba(100,160,255,0.8)]"
                }`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    {item.type === "deposit" ? (
                      <path d="M19 13l-7 7-7-7M12 20V4" />
                    ) : item.type === "withdraw" ? (
                      <path d="M5 11l7-7 7 7M12 4v16" />
                    ) : (
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    )}
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white font-mono">{item.amount} ETH</span>
                  <span className="text-[9px] text-[rgba(255,255,255,0.4)] font-mono">{item.label}</span>
                </div>
              </div>
              <span className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono">{item.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </SnippetWrapper>
  );
}

export function DashboardLinkSnippet() {
  return (
    <SnippetWrapper>
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" className="w-3.5 h-3.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">IDENTITY</span>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <h3 className="text-lg font-bold text-[#00FF41] font-mono mb-0.5">alice.dust</h3>
            <span className="text-[10px] text-[rgba(255,255,255,0.4)] font-mono">/pay/alice</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-[rgba(255,255,255,0.1)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" className="w-3 h-3"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            <span className="text-[10px] font-mono text-[rgba(255,255,255,0.6)]">Copy Link</span>
          </div>
        </div>
      </Card>
    </SnippetWrapper>
  );
}
