export function OnboardingPinSnippet() {
  return (
    <div className="my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden">
      <div className="bg-[#06080F] px-5 py-4 font-mono flex items-center gap-5">
        <div className="flex flex-col gap-0.5 shrink-0">
          <p className="text-[13px] font-semibold text-white tracking-tight">[ CREATE PIN ]</p>
          <p className="text-[10px] text-[rgba(255,255,255,0.35)]">
            PIN + wallet signature → stealth keys
          </p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-7 h-9 rounded-sm border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] flex items-center justify-center text-[15px] font-mono font-semibold text-white"
            >
              {"\u2022"}
            </div>
          ))}
        </div>
        <span className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono ml-auto hidden sm:block">
          PBKDF2 · 100K iter
        </span>
      </div>
    </div>
  );
}

export function OnboardingUsernameSnippet() {
  return (
    <div className="my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden">
      <div className="bg-[#06080F] px-5 py-4 font-mono flex items-center gap-4">
        <div className="flex flex-col gap-0.5 shrink-0">
          <p className="text-[13px] font-semibold text-white tracking-tight">[ USERNAME ]</p>
          <p className="text-[10px] text-[rgba(255,255,255,0.35)]">
            Human-readable stealth name
          </p>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0 relative">
            <div className="w-full px-2.5 py-1.5 rounded-sm bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] text-white font-mono text-xs">
              alice
            </div>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[rgba(255,255,255,0.3)] font-mono pointer-events-none">
              .dust
            </span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="text-[10px] text-[rgba(34,197,94,0.8)] font-mono hidden sm:block">available</span>
          </div>
          <button className="h-7 px-3 rounded-sm text-[10px] font-bold font-mono tracking-wider bg-[rgba(0,255,65,0.1)] border border-[rgba(0,255,65,0.2)] text-[#00FF41] shrink-0">
            Register
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingActivateSnippet() {
  return (
    <div className="my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden">
      <div className="bg-[#06080F] px-5 py-4 font-mono flex items-center gap-5">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-[12px] text-[#22C55E] font-mono font-medium">Keys registered on-chain</span>
        </div>
        <div className="h-4 w-px bg-[rgba(255,255,255,0.08)]" />
        <div className="flex gap-4 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[rgba(255,255,255,0.4)] uppercase tracking-wider">User</span>
            <span className="text-[rgba(0,255,65,0.9)]">alice.dust</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[rgba(255,255,255,0.4)] uppercase tracking-wider">PIN</span>
            <span className="text-[rgba(255,255,255,0.6)] tracking-[2px]">{"\u2022\u2022\u2022\u2022\u2022\u2022"}</span>
          </div>
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <span className="text-[rgba(255,255,255,0.4)] uppercase tracking-wider">Registry</span>
            <span className="text-[rgba(255,255,255,0.5)]">ERC-6538</span>
          </div>
        </div>
      </div>
    </div>
  );
}
