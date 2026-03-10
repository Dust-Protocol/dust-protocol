"use client";

const snippetWrap = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";
const snippetInner = "bg-[#06080F] px-4 py-3 font-mono";

const EthIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 3L6 12.5L12 10V3Z" fill="rgba(255,255,255,0.6)" />
    <path d="M12 3L18 12.5L12 10V3Z" fill="rgba(255,255,255,0.35)" />
    <path d="M12 21L6 13.5L12 16V21Z" fill="rgba(255,255,255,0.6)" />
    <path d="M12 21L18 13.5L12 16V21Z" fill="rgba(255,255,255,0.35)" />
  </svg>
);

const UsdcIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="7" fill="rgba(38,118,255,0.15)" />
    <text x="7" y="10" textAnchor="middle" fill="#2775CA" fontSize="8" fontFamily="monospace" fontWeight="bold">$</text>
  </svg>
);

export function PoolTvlSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider">TVL</span>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">$125.50K</span>
        </div>
      </div>
    </div>
  );
}

export function PoolShieldedSnippet() {
  const ethPercent = 60;

  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider">Shielded</span>
        </div>
        <div className="flex gap-0.5 h-1.5 w-full rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)]">
          <div className="bg-[#00FF41] opacity-60" style={{ width: `${ethPercent}%` }} />
          <div className="bg-[rgba(255,255,255,0.2)]" style={{ width: `${100 - ethPercent}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-[rgba(255,255,255,0.4)] mt-1.5">
          <span className="flex items-center gap-0.5">
            <EthIcon /> 45.2000
          </span>
          <span className="flex items-center gap-0.5">
            <UsdcIcon /> 12,500
          </span>
        </div>
      </div>
    </div>
  );
}

export function PoolOracleSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider">Oracle</span>
          <span className="text-[8px] px-1 py-px rounded-sm leading-tight text-[#00FF41] bg-[rgba(0,255,65,0.08)]">CHAINLINK</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-white">
          <span className="text-[rgba(255,255,255,0.5)]">1</span>
          <EthIcon size={12} />
          <span className="text-[rgba(255,255,255,0.35)]">=</span>
          <span>2,506.00</span>
          <UsdcIcon size={12} />
        </div>
        <span className="text-[9px] text-[rgba(255,255,255,0.25)] mt-0.5 block">tick -198234</span>
      </div>
    </div>
  );
}

export function PoolInfoSnippet() {
  const rows: [string, string][] = [
    ["Fee tier", "0.05%"],
    ["Relayer", "2%"],
    ["Proof", "FFLONK"],
    ["Tree", "depth 20"],
  ];

  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider">Pool Info</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between text-[10px]">
              <span className="text-[rgba(255,255,255,0.35)]">{label}</span>
              <span className="text-[rgba(255,255,255,0.6)]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PoolCapacitySnippet() {
  const capacityPercent = Math.max((47 / 1_048_576) * 100, 0.3);

  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
          </svg>
          <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider">Capacity</span>
        </div>
        <div className="flex gap-0.5 h-1 w-full rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)]">
          <div className="bg-[#00FF41] opacity-60" style={{ width: `${capacityPercent}%` }} />
        </div>
        <span className="text-[9px] text-[rgba(255,255,255,0.25)] mt-1 block">47 / 1.05M slots</span>
      </div>
    </div>
  );
}

export function PoolNetworksSnippet() {
  return (
    <div className={snippetWrap}>
      <div className={snippetInner}>
        <div className="flex items-center gap-1.5 mb-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider">Networks</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
            <span className="text-[10px] text-[rgba(255,255,255,0.6)]">Eth Sepolia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.2)]" />
            <span className="text-[10px] text-[rgba(255,255,255,0.3)]">Thanos Sepolia</span>
          </div>
        </div>
        <span className="text-[9px] text-[rgba(255,255,255,0.2)] italic mt-1.5 block">More L2s coming</span>
      </div>
    </div>
  );
}
