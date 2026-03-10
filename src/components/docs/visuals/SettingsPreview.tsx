"use client";

const snippetWrap = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-4 ${last ? "" : "border-b border-[rgba(255,255,255,0.06)]"}`}>
      <span className="text-[11px] text-[rgba(255,255,255,0.45)] font-mono">{label}</span>
      {children}
    </div>
  );
}

function SettingsButton({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "green" | "red" }) {
  const styles = {
    default: "bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.6)]",
    green: "bg-[rgba(0,255,65,0.06)] text-[#00FF41] border-[rgba(0,255,65,0.15)]",
    red: "bg-[rgba(239,68,68,0.06)] text-[#ef4444]",
  };
  return (
    <div className={`px-3 py-1.5 rounded-full text-[10px] font-mono font-medium ${styles[variant]}`}>
      {children}
    </div>
  );
}

export function SettingsAccountSnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F]">
        <Row label="Wallet">
          <span className="text-[11px] text-[rgba(255,255,255,0.35)] font-mono">0x1234...5678</span>
        </Row>
        <Row label="Username">
          <span className="text-[12px] font-semibold text-[#7C3AED] font-mono">dust.alice</span>
        </Row>
        <Row label="Network" last>
          <span className="text-[11px] text-[rgba(255,255,255,0.6)] font-mono">Ethereum Sepolia</span>
        </Row>
      </div>
    </div>
  );
}

export function SettingsSecuritySnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F] px-4 py-3 flex flex-wrap items-center gap-2">
        <SettingsButton>Change PIN</SettingsButton>
        <SettingsButton>Export Notes</SettingsButton>
        <SettingsButton>Import Notes</SettingsButton>
        <div className="flex items-center gap-1.5 ml-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFB000" strokeWidth="2" className="w-3 h-3 flex-shrink-0">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span className="text-[9px] text-[#FFB000] font-mono">Back up notes before changing PIN</span>
        </div>
      </div>
    </div>
  );
}

export function SettingsViewKeySnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono">View Key</span>
            <code className="text-[10px] text-[rgba(255,255,255,0.25)] font-mono bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 rounded">dvk1:…</code>
          </div>
          <SettingsButton variant="green">Generate Disclosure Report</SettingsButton>
        </div>
        <p className="text-[9px] text-[rgba(255,255,255,0.3)] font-mono mt-2 leading-relaxed">
          Read-only bundle for auditors — verifies deposits and withdrawals, cannot move funds.
        </p>
      </div>
    </div>
  );
}

export function SettingsClaimSnippet() {
  return (
    <div className={snippetWrap}>
      <div className="bg-[#06080F] px-4 py-3 flex flex-col gap-1.5">
        {[
          { label: "ERC-4337", desc: "Recommended", active: true },
          { label: "CREATE2", desc: "Deterministic", active: false },
          { label: "EIP-7702", desc: "Delegation", active: false },
        ].map((opt) => (
          <div
            key={opt.label}
            className={`flex items-center justify-between px-3 py-1.5 rounded-sm border ${
              opt.active
                ? "border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.04)]"
                : "border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.01)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${opt.active ? "bg-[#00FF41] shadow-[0_0_4px_#00FF41]" : "bg-[rgba(255,255,255,0.1)]"}`} />
              <span className={`text-[11px] font-mono font-medium ${opt.active ? "text-[#00FF41]" : "text-[rgba(255,255,255,0.5)]"}`}>
                {opt.label}
              </span>
            </div>
            <span className={`text-[9px] font-mono ${opt.active ? "text-[rgba(0,255,65,0.6)]" : "text-[rgba(255,255,255,0.3)]"}`}>
              {opt.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsDangerSnippet() {
  return (
    <div className="my-6 rounded-sm border border-[rgba(239,68,68,0.25)] overflow-hidden">
      <div className="bg-[#06080F] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="w-3.5 h-3.5">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span className="text-[10px] uppercase tracking-wider text-[#ef4444] font-mono">Danger Zone</span>
        </div>
        <SettingsButton variant="red">Reset All Data</SettingsButton>
      </div>
    </div>
  );
}
