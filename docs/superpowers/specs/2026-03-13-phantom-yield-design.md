# Phantom Yield — Multi-Protocol Delta-Neutral Vault with MEV-Aware Rebalancing

**Date**: 2026-03-13
**Hackathon**: Ranger Finance Build-a-Bear (Mar 9 – Apr 6, 2026)
**Tracks**: Main Track (up to $500k seed) + Drift Side Track (up to $100k seed)
**Deployment**: Solana devnet

---

## 1. Thesis

USDC-denominated vault on Ranger Earn that combines multi-protocol lending optimization with a Drift basis trade (long SOL spot + short SOL-PERP) for funding rate capture. Delta-neutral by construction — no directional exposure.

**Differentiators**:

1. **Multi-protocol composition** — Dynamic allocation across Kamino, Jupiter Lend, Drift Spot based on real-time rate scoring. Most hackathon entries will use a single protocol.
2. **Basis trade with funding rate carry** — Long spot + short perp captures funding payments while maintaining market neutrality. Not just lending.
3. **MEV-aware rebalancing** — Jito bundles for Drift position adjustments (the one operation where front-running protection has real value). Encrypted strategy parameters prevent copy-trading.
4. **Comprehensive risk management** — Drawdown circuit breakers, delta enforcement, collateral health monitoring, oracle safety checks.

---

## 2. Architecture

```
Total Vault Capital (100%)
├── Idle Buffer (5%)             — Always liquid for withdrawals
├── Lending Leg (55-75%)         — USDC lent across protocols
│   ├── Kamino Lending           — Up to 40% of lending leg
│   ├── Jupiter Lend             — Up to 40% of lending leg
│   └── Drift Spot Lending       — Up to 40% of lending leg
└── Basis Trade Leg (20-40%)     — Drift delta-neutral position
    ├── Long SOL Spot (Drift)    — Buy SOL with USDC
    └── Short SOL-PERP (Drift)   — Equal notional, opposite direction
    Net delta ≈ 0, earns funding rate when longs pay shorts
```

### Why Delta-Neutral Works

The basis trade is: long $X of SOL spot + short $X of SOL-PERP.

- SOL goes up 10%: spot gains +10%, perp loses -10% → net 0
- SOL goes down 10%: spot loses -10%, perp gains +10% → net 0
- Meanwhile: funding rate flows from longs to shorts (typically positive in bull markets)

The vault earns: lending APY + funding rate carry, with zero directional exposure.

### Vault Configuration

- **Asset**: USDC (SPL token)
- **Adaptors**: Drift (perps + spot), Jupiter Lend, Kamino Lending
- **Fees**: 2% management + 20% performance (above HWM)
- **Withdrawal waiting period**: 60 seconds (devnet) / 48 hours (production)
- **Locked profit degradation**: 24 hours (anti-sandwich)
- **Max cap**: Unlimited (hackathon; would cap in production)

---

## 3. Project Structure

```
phantom-yield/
├── src/
│   ├── client/           # VoltrClient wrapper, vault creation helpers
│   ├── strategy/
│   │   ├── lending.ts    # Multi-protocol rate comparison + allocation
│   │   ├── basis.ts      # Drift basis trade (long spot + short perp)
│   │   └── allocator.ts  # Combined allocation engine
│   ├── execution/
│   │   ├── jito.ts       # Jito bundle submission for Drift adjustments
│   │   └── params.ts     # Encrypted off-chain parameter store
│   ├── risk/
│   │   ├── drawdown.ts   # HWM drawdown monitor + emergency unwind
│   │   ├── delta.ts      # Net delta exposure calculator + enforcer
│   │   └── health.ts     # Drift collateral ratio + liquidation buffer
│   ├── bot/
│   │   ├── loops.ts      # 3 async loops (rebalance, refresh, harvest)
│   │   └── index.ts      # Entry point, config, graceful shutdown
│   └── utils/
│       ├── oracle.ts     # Pyth price feeds
│       └── logger.ts     # Structured JSON logging
├── scripts/
│   ├── init-vault.ts     # One-time vault creation
│   ├── init-strategies.ts # Add adaptors + initialize strategies
│   └── backtest.ts       # Historical backtest (Drift funding + lending rates)
├── config/
│   └── vault.config.ts   # All tunable parameters
├── docs/
│   ├── strategy.md       # Strategy documentation (submission requirement)
│   └── architecture.md   # Technical architecture doc
├── package.json
├── tsconfig.json
└── README.md
```

### Tech Stack

- TypeScript + pnpm
- `@voltr/vault-sdk` — vault creation + management
- `@drift-labs/sdk` — spot + perp positions
- `@kamino-finance/klend-sdk` — Kamino lending
- `@jup-ag/api` — Jupiter lending
- `jito-ts` — bundle submission for Drift position adjustments
- `@pythnetwork/client` — price feeds

---

## 4. Strategy Engine

### 4.1 Lending Optimizer (`strategy/lending.ts`)

Every rebalance cycle:

1. Fetch current APY from Kamino, Jupiter Lend, Drift Spot
2. Score each: `score = apy * protocolSafetyWeight` (configurable: Kamino=1.0, Jupiter=0.95, Drift=0.9)
3. Compute target allocation proportional to scores
4. Only rebalance if deviation from target exceeds 2% (avoids churn)
5. Execute: withdraw from overweight → deposit to underweight

Lending deposits/withdrawals are 1:1 (no slippage), so no MEV protection needed here. Standard RPC submission.

### 4.2 Basis Trade Engine (`strategy/basis.ts`)

Maintains delta-neutral position on Drift:

1. Read SOL price from Pyth
2. Compute target basis trade size based on allocator's hedge allocation %
3. **Open/adjust**: Buy SOL spot on Drift + open equal-notional SOL-PERP short
4. Calculate net delta: `(spot_SOL_value - perp_short_notional) / vault_NAV`
5. Target: net delta = 0 ± 2%
6. If delta drifts beyond ±2% → adjust both legs proportionally
7. Monitor funding rate: if annualized funding < -5% → close entire basis trade (carry is negative)

**Why Jito matters here**: Drift position adjustments (opening/closing perps, buying/selling spot) are the one operation where front-running has real value. A searcher seeing "vault is about to buy $50k SOL spot" can front-run the purchase. Jito bundles keep these transactions out of the public mempool.

### 4.3 Allocator (`strategy/allocator.ts`)

Decides capital split between lending and basis trade:

- **Base split**: 65% lending / 30% basis trade / 5% idle
- **Dynamic adjustment**: If Drift funding rate > 30% annualized → shift up to 40% to basis trade. If funding near zero or negative → shift up to 75% to lending
- **Emergency mode**: Drawdown > 3% from HWM → reduce basis trade. At 5% → close basis trade entirely, lending + idle only

### 4.4 Rebalance Decision Flow

```
Every cycle:
  1. Fetch prices, rates, positions from Pyth + protocols
  2. Calculate current allocation vs target
  3. If deviation < threshold → skip (save compute)
  4. If deviation >= threshold → compute moves
  5. Lending moves → standard RPC submission
  6. Drift position moves → Jito bundle submission
  7. Verify execution
```

---

## 5. MEV-Aware Execution Layer

### 5.1 Jito Bundle Submission (`execution/jito.ts`)

Used specifically for Drift position adjustments (spot buys/sells, perp opens/closes):

- Build Drift instruction(s) for the position change
- Package into a Jito bundle with validator tip
- Submit via `jito-ts` searcher client to Jito block engine
- Bundle is atomic — all instructions succeed or all fail
- **Fallback**: If Jito submission fails 3x, submit directly to RPC with priority fee
- **Not used for**: Lending deposits/withdrawals (no MEV vector on 1:1 operations)

### 5.2 Encrypted Parameters (`execution/params.ts`)

Strategy parameters stored in encrypted JSON file, never on-chain:

- Delta thresholds, allocation weights, protocol safety scores, rebalance thresholds
- Encrypted at rest with key derived from manager keypair (AES-256-GCM)
- Bot loads and decrypts at startup
- On-chain observers see execution but can't reverse-engineer the decision logic (why this size, why this split, why this protocol)
- Prevents copy-trading of the strategy's allocation model

### 5.3 Execution Flow

```
Allocator computes moves:
  │
  ├── Lending moves (deposit/withdraw USDC 1:1)
  │   → Standard RPC submission (no MEV risk)
  │
  └── Drift moves (spot buy/sell, perp open/close/adjust)
      → Jito bundle with tip (front-running protection)
      → Fallback to priority-fee RPC after 3 failures
```

---

## 6. Risk Management

### 6.1 Drawdown Monitor (`risk/drawdown.ts`)

Tracks vault share price (asset-per-LP) against high water mark:

| Drawdown Level | Action |
|---|---|
| < 2% | Normal operation |
| 2-3% | Log warning, increase rebalance check frequency |
| 3-5% | Reduce basis trade to 50% of target size |
| > 5% | Emergency unwind — close all Drift positions, lending + idle only |

After emergency unwind, bot enters safe mode (lending only) until share price recovers above -2% from HWM. Manual re-enable required for basis trade leg.

### 6.2 Delta Exposure (`risk/delta.ts`)

- Net delta = `(spot_SOL_value - perp_short_notional) / vault_NAV`
- Perfectly hedged = 0. Drift from price moves or partial fills creates non-zero delta.
- **Hard cap**: ±2% of vault NAV
- Breach → immediately adjust the smaller leg to match the larger
- Checked every rebalance cycle and after every position change

### 6.3 Drift Health (`risk/health.ts`)

Drift perp positions use cross-margin. Monitor:

| Metric | Threshold | Action |
|---|---|---|
| Free collateral | < 20% of account value | Reduce basis trade by 25% |
| Free collateral | < 10% of account value | Reduce basis trade by 50% |
| Funding rate (annualized) | < -5% | Close basis trade entirely |
| Unrealized PnL (combined spot+perp) | < -2% of position | Log warning (delta drift, not loss — basis trade PnL should be ~0) |
| Leverage | > 3x | Reduce position to bring under 3x |

Note: Because the basis trade is delta-neutral, unrealized PnL should stay near zero. Large PnL deviation signals delta drift, not market loss — trigger a delta rebalance, not a panic close.

### 6.4 Concentration Limits

- No single lending protocol > 40% of lending leg
- Idle buffer never < 5% of total vault
- If protocol utilization > 90%, begin withdrawing (locked capital risk)

### 6.5 Oracle Safety

- Pyth price feeds for SOL price
- **Staleness**: Price older than 120 seconds → skip rebalance cycle (relaxed for devnet compatibility)
- **Deviation**: Price moves >10% between cycles → close basis trade first, then reassess

---

## 7. Bot Architecture

### 7.1 Startup Sequence

```
1. Load encrypted params → decrypt with manager key
2. Initialize VoltrClient + DriftClient + Pyth connection
3. Fetch current vault state (positions, share price, HWM)
4. Start loops
5. Register graceful shutdown (SIGINT/SIGTERM → stop loops, log final state)
```

### 7.2 Async Loops

| Loop | Interval | Purpose |
|---|---|---|
| Rebalance | 5 min | Run allocator → compute moves → execute via RPC/Jito |
| Refresh | 10 min | Update on-chain position values (required by Voltr for LP pricing) |
| Harvest | 30 min | Collect accrued vault fees |

Loops use async scheduling: wait for current cycle to complete before scheduling next. Prevents overlapping execution if a cycle runs long (e.g., Jito retries).

```typescript
async function runLoop(name: string, fn: () => Promise<void>, intervalMs: number) {
  while (!shutdown) {
    try { await fn() } catch (e) { logger.error({ loop: name, error: e }) }
    await sleep(intervalMs)
  }
}
```

### 7.3 Crash Recovery

Bot is stateless — all state is read from on-chain (vault positions, Drift account, protocol balances). If bot crashes mid-rebalance:
- Partial lending moves: allocator sees current state on restart, computes remaining moves
- Partial Drift moves: Jito bundle is atomic (all-or-nothing), so either both legs executed or neither did
- No intent journaling needed — on-chain state is the source of truth

### 7.4 Logging

Structured JSON to stdout: `timestamp`, `loop`, `action`, `amounts`, `txHash`, `error`, `delta`, `drawdown`.

---

## 8. Configuration

```typescript
export const VAULT_CONFIG = {
  // Allocation
  idleBufferPct: 5,
  baseLendingPct: 65,
  baseBasisTradePct: 30,
  maxSingleProtocolPct: 40,
  rebalanceThresholdPct: 2,

  // Basis Trade
  maxLeverage: 3,
  targetDelta: 0,
  deltaCapPct: 2,
  minFundingRateAnnualized: -5,
  minFreeCollateralPct: 20,

  // Risk
  drawdownWarningPct: 2,
  drawdownReducePct: 3,
  drawdownEmergencyPct: 5,
  oracleStalenessSec: 120,
  oracleDeviationPct: 10,

  // Execution
  jitoTipLamports: 1_000_000,  // 0.001 SOL per bundle
  jitoMaxRetries: 3,

  // Fees (basis points)
  managementFeeBps: 200,       // 2% annual
  performanceFeeBps: 2000,     // 20% of profit above HWM

  // Devnet overrides
  withdrawalWaitingSec: 60,    // 48h in production
  lockedProfitDegradationSec: 86400,
} as const
```

---

## 9. Hackathon Deliverables

### Submission Package

1. **Demo video** (max 3 min) — Strategy thesis, devnet demo, risk management walkthrough
2. **Strategy documentation** — `docs/strategy.md`
3. **Code repository** — Clean GitHub repo with README
4. **On-chain verification** — Devnet vault address + transaction hashes

### Two Submissions, One Codebase

| | Main Track | Drift Side Track |
|---|---|---|
| Narrative | Multi-protocol delta-neutral vault with MEV-aware rebalancing | Drift basis trade with funding rate capture |
| Emphasis | Multi-protocol composition, risk management, encrypted strategy | Drift-native strategy, funding rate carry |
| Demo video | Full architecture: lending + basis trade + risk | Zoom into Drift basis trade mechanics |

### Timeline

**Week 1 (Mar 14-20)**: Working vault — repo setup, vault creation on devnet, 3 adaptors initialized, lending optimizer running, basic rebalance bot

**Week 2 (Mar 21-27)**: Basis trade + risk — Drift spot + perp integration, delta calculator, risk management (drawdown, delta, health), Jito bundle integration

**Week 3 (Mar 28 - Apr 5)**: Polish + submit — encrypted params, backtest script, strategy docs, architecture docs, demo videos, README, code cleanup

---

## 10. Patterns From Dust Protocol

Architectural patterns ported from the Dust Protocol codebase, adapted for Solana:

| Source Pattern | Target | Adaptation |
|---|---|---|
| Batch execution with shuffle (`batch-withdraw/route.ts`) | `bot/loops.ts` | Fisher-Yates shuffle on multi-move rebalances — randomize execution order of independent moves |
| Layered validation (`compliance-gate.ts`) | `risk/` modules | Check local state → check on-chain → execute pattern applied to risk checks |
| Retry with fallback (`relayer-client.ts`) | `execution/jito.ts` | Jito submission with 3 retries → fallback to priority-fee RPC |
| Cooldown rate limiting (`persistent-cooldown.ts`) | `risk/drawdown.ts` | Cooldown after emergency unwind prevents oscillation between safe/normal mode |
| Encrypted storage (`storage-crypto.ts`) | `execution/params.ts` | AES-256-GCM encryption of strategy parameters at rest |

---

## 11. Expected Returns

| Source | APY Range | Notes |
|---|---|---|
| Multi-protocol lending | 8-15% | USDC lending across Kamino/Jupiter/Drift |
| Drift funding rate carry | 10-25% | Highly variable, depends on market sentiment |
| **Gross total** | **18-40%** | Sum of both legs |
| Less: management fee (2%) | -2% | Annual, on total AUM |
| Less: performance fee (20%) | -3.2% to -7.6% | 20% of gross yield |
| Less: Jito tips + gas | ~-0.5% | Estimate: ~3 Jito bundles/day × 0.001 SOL |
| **Net to depositors** | **~12-30%** | Market-dependent, no guarantee |

Note: These are estimates based on current Solana lending rates and historical Drift funding rates. Actual returns depend on market conditions, funding rate direction, and protocol risk.

---

## 12. Known Limitations

1. **No real privacy** — Jito protects against front-running on Drift operations, but all transactions are fully visible on-chain once included. This is not a privacy vault — it is an MEV-aware vault.
2. **Funding rate risk** — Basis trade carry can go negative. The vault closes positions when this happens, but may still take a small loss from entry/exit slippage.
3. **Smart contract risk** — Vault holds capital across 3+ external protocols. Any protocol exploit affects the vault.
4. **Devnet only** — No real capital at risk. Devnet conditions (liquidity, rates) differ from mainnet.
5. **Single operator** — Bot requires a running process. No redundancy in hackathon version.
