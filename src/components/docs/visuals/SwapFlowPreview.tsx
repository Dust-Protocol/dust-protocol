"use client";

const SNIPPET_WRAP = "my-6 rounded-sm border border-[rgba(255,255,255,0.08)] overflow-hidden";

const ETH_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="rgba(255,255,255,0.08)" />
    <path d="M12 3L6 12.5L12 10V3Z" fill="rgba(255,255,255,0.6)" />
    <path d="M12 3L18 12.5L12 10V3Z" fill="rgba(255,255,255,0.35)" />
    <path d="M12 21L6 13.5L12 16V21Z" fill="rgba(255,255,255,0.6)" />
    <path d="M12 21L18 13.5L12 16V21Z" fill="rgba(255,255,255,0.35)" />
  </svg>
);

const USDC_ICON = (
  <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="14" fill="rgba(38,118,255,0.15)" />
    <text x="14" y="18" textAnchor="middle" fill="#2775CA" fontSize="12" fontFamily="monospace" fontWeight="bold">$</text>
  </svg>
);

const SHIELD_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00FF41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

/** FROM (ETH 2.0) → arrow → TO (USDC 5,012.00) compact token pair */
export function SwapTokenPairSnippet() {
  return (
    <div className={SNIPPET_WRAP}>
      <div className="bg-[#06080F] px-4 py-3 font-mono">
        <div className="flex items-center justify-between gap-3">
          {/* FROM */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[rgba(255,255,255,0.35)] uppercase tracking-widest">FROM</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
              {ETH_ICON}
              <span className="text-xs font-bold text-white">ETH</span>
            </div>
            <span className="text-sm font-bold text-white">2.0</span>
          </div>

          {/* Arrow */}
          <div className="px-2">
            <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
              <path d="M0 6H18M18 6L13 1M18 6L13 11" stroke="#00FF41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* TO */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[rgba(255,255,255,0.35)] uppercase tracking-widest">TO</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
              {USDC_ICON}
              <span className="text-xs font-bold text-white">USDC</span>
            </div>
            <span className="text-sm font-bold text-[#00FF41]">5,012.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** DENOM_PRIVACY toggle ON with chunk badges */
export function SwapDenomSnippet() {
  return (
    <div className={SNIPPET_WRAP}>
      <div className="bg-[#06080F] px-4 py-3 font-mono">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {SHIELD_ICON}
            <span className="text-[10px] text-[rgba(255,255,255,0.5)] uppercase tracking-widest">
              DENOM_PRIVACY
            </span>
          </div>
          <div className="relative w-8 h-4 rounded-full bg-[rgba(0,255,65,0.25)] border border-[rgba(0,255,65,0.4)]">
            <div className="absolute top-0.5 w-3 h-3 rounded-full bg-[#00FF41] left-[calc(100%-14px)]" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["1", "0.5", "0.3", "0.2"].map((chunk) => (
            <span
              key={chunk}
              className="px-2 py-0.5 rounded-sm bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.12)] text-[10px] text-[#00FF41]"
            >
              {chunk} ETH
            </span>
          ))}
          <span className="text-[10px] text-[rgba(255,255,255,0.3)] self-center ml-1">
            4 chunks &middot; random delays
          </span>
        </div>
      </div>
    </div>
  );
}

/** Compact 4-row price info table */
export function SwapPriceInfoSnippet() {
  const rows = [
    { label: "RATE", value: "1 ETH \u2248 2,506.00 USDC" },
    { label: "SLIPPAGE", value: "0.5%" },
    { label: "MIN_RECEIVED", value: "4,901.76 USDC" },
    { label: "RELAYER_FEE", value: "2%" },
  ];

  return (
    <div className={SNIPPET_WRAP}>
      <div className="bg-[#06080F] px-4 py-3 font-mono">
        <div className="grid grid-cols-2 gap-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <span className="text-[10px] text-[rgba(255,255,255,0.35)]">{r.label}</span>
              <span className="text-[10px] text-[rgba(255,255,255,0.7)] text-right">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Atomic flow diagram: DustPoolV2 → withdraw → Uniswap V4 swap → deposit → new UTXO */
export function SwapFlowDiagramSnippet() {
  const steps = [
    { label: "DustPoolV2", sub: "withdraw" },
    { label: "Uniswap V4", sub: "swap" },
    { label: "DustPoolV2", sub: "deposit" },
    { label: "New UTXO", sub: "note" },
  ];

  return (
    <div className={SNIPPET_WRAP}>
      <div className="bg-[#06080F] px-4 py-4 font-mono">
        <div className="flex items-center justify-between gap-1">
          {steps.map((s, i) => (
            <div key={s.label} className="contents">
              <div className="flex flex-col items-center gap-0.5 min-w-0">
                <div className="px-2 py-1.5 rounded-sm border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-center whitespace-nowrap">
                  <span className="text-[10px] text-white font-bold block leading-tight">{s.label}</span>
                  <span className="text-[8px] text-[#00FF41] uppercase tracking-wider">{s.sub}</span>
                </div>
              </div>
              {i < steps.length - 1 && (
                <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="shrink-0 mx-0.5">
                  <path d="M0 5H14M14 5L10 1M14 5L10 9" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-center text-[9px] text-[rgba(255,255,255,0.3)] tracking-wider">
          ATOMIC &mdash; all steps succeed or entire transaction reverts
        </div>
      </div>
    </div>
  );
}

/** Processing steps as compact horizontal pipeline */
export function SwapProcessingSnippet() {
  const stages = ["Prove", "Submit", "Withdraw", "Swap", "Deposit"];

  return (
    <div className={SNIPPET_WRAP}>
      <div className="bg-[#06080F] px-4 py-3 font-mono">
        <div className="flex items-center gap-1.5">
          {stages.map((s, i) => (
            <div key={s} className="contents">
              <div className="px-2 py-1 rounded-sm bg-[rgba(0,255,65,0.06)] border border-[rgba(0,255,65,0.12)] text-[10px] text-[#00FF41] whitespace-nowrap">
                {s}
              </div>
              {i < stages.length - 1 && (
                <span className="text-[rgba(255,255,255,0.2)] text-[10px]">&rarr;</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
