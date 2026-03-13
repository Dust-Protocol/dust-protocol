# Phantom Yield Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-protocol delta-neutral USDC vault on Ranger Earn (Solana) with MEV-aware rebalancing for the Build-a-Bear hackathon.

**Architecture:** Ranger/Voltr vault accepting USDC, deploying capital across Kamino/Jupiter/Drift lending for base yield, plus a Drift basis trade (long SOL spot + short SOL-PERP) for funding rate carry. Rebalance bot runs 3 async loops. Drift position adjustments go through Jito bundles for front-running protection. Encrypted strategy parameters prevent copy-trading.

**Tech Stack:** TypeScript, pnpm, @voltr/vault-sdk, @drift-labs/sdk, @kamino-finance/klend-sdk, @jup-ag/api, jito-ts, @pythnetwork/client

**Spec:** `docs/superpowers/specs/2026-03-13-phantom-yield-design.md`

---

## File Structure

```
phantom-yield/                          # New repo at ~/work/current/phantom-yield/
├── src/
│   ├── client/
│   │   └── voltr.ts                    # VoltrClient wrapper — init, deposit, withdraw, strategy ops
│   ├── strategy/
│   │   ├── lending.ts                  # Fetch APYs from 3 protocols, compute weighted allocation
│   │   ├── basis.ts                    # Drift basis trade: open/close/adjust spot+perp pair
│   │   └── allocator.ts               # Brain: decides lending vs basis split based on funding rate
│   ├── execution/
│   │   ├── jito.ts                     # Jito bundle build + submit + retry + fallback
│   │   └── params.ts                   # AES-256-GCM encrypted config file load/save
│   ├── risk/
│   │   ├── drawdown.ts                 # Track share price vs HWM, trigger circuit breakers
│   │   ├── delta.ts                    # Compute net delta, enforce ±2% cap
│   │   └── health.ts                   # Drift free collateral, leverage, funding rate checks
│   ├── bot/
│   │   ├── loops.ts                    # 3 async loops: rebalance, refresh, harvest
│   │   └── index.ts                    # Entry point: load config, init clients, start loops
│   └── utils/
│       ├── oracle.ts                   # Pyth SOL price feed: fetch, staleness check
│       └── logger.ts                   # Structured JSON logger to stdout
├── tests/
│   ├── strategy/
│   │   ├── lending.test.ts             # Lending rate scoring + allocation math
│   │   ├── basis.test.ts               # Basis trade delta calculation
│   │   └── allocator.test.ts           # Allocation decisions given various inputs
│   ├── execution/
│   │   └── params.test.ts              # Encrypt/decrypt roundtrip
│   ├── risk/
│   │   ├── drawdown.test.ts            # Circuit breaker thresholds
│   │   ├── delta.test.ts               # Delta cap enforcement
│   │   └── health.test.ts              # Health check decisions
│   └── utils/
│       └── oracle.test.ts              # Staleness + deviation checks
├── scripts/
│   ├── init-vault.ts                   # One-time: create vault on devnet
│   ├── init-strategies.ts              # One-time: add adaptors + init strategies
│   └── backtest.ts                     # Historical backtest with Drift/lending data
├── config/
│   └── vault.config.ts                 # All tunable parameters (from spec Section 8)
├── docs/
│   ├── strategy.md                     # Hackathon submission: strategy documentation
│   └── architecture.md                 # Hackathon submission: technical architecture
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example                        # RPC_URL, ADMIN_KEYPAIR_PATH, MANAGER_KEYPAIR_PATH, VAULT_ADDRESS
├── .gitignore
└── README.md
```

---

## Chunk 1: Project Scaffolding + Config + Utils

### Task 1: Initialize Project

**Files:**
- Create: `~/work/current/phantom-yield/package.json`
- Create: `~/work/current/phantom-yield/tsconfig.json`
- Create: `~/work/current/phantom-yield/vitest.config.ts`
- Create: `~/work/current/phantom-yield/.env.example`
- Create: `~/work/current/phantom-yield/.gitignore`

- [ ] **Step 1: Create project directory and initialize**

```bash
mkdir -p ~/work/current/phantom-yield
cd ~/work/current/phantom-yield
pnpm init
git init
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm add @voltr/vault-sdk @drift-labs/sdk @kamino-finance/klend-sdk @jup-ag/api @pythnetwork/client @solana/web3.js @coral-xyz/anchor jito-ts dotenv
pnpm add -D typescript vitest @types/node tsx
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "scripts/**/*", "tests/**/*", "config/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
```

- [ ] **Step 5: Create .env.example**

```
SOLANA_RPC_URL=https://api.devnet.solana.com
ADMIN_KEYPAIR_PATH=./keys/admin.json
MANAGER_KEYPAIR_PATH=./keys/manager.json
VAULT_ADDRESS=
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.env
keys/
*.json.enc
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize phantom-yield project with deps and config"
```

---

### Task 2: Vault Configuration

**Files:**
- Create: `config/vault.config.ts`

- [ ] **Step 1: Write vault config**

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
  jitoTipLamports: 1_000_000,
  jitoMaxRetries: 3,

  // Fees (basis points)
  managementFeeBps: 200,
  performanceFeeBps: 2000,

  // Devnet overrides
  withdrawalWaitingSec: 60,
  lockedProfitDegradationSec: 86400,

  // Protocol safety weights (for lending score)
  protocolWeights: {
    kamino: 1.0,
    jupiter: 0.95,
    driftSpot: 0.9,
  },
} as const

export type VaultConfig = typeof VAULT_CONFIG
```

- [ ] **Step 2: Commit**

```bash
git add config/vault.config.ts
git commit -m "feat: add vault configuration with allocation, risk, and fee params"
```

---

### Task 3: Logger Utility

**Files:**
- Create: `src/utils/logger.ts`

- [ ] **Step 1: Write logger**

```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  timestamp: string
  level: LogLevel
  loop?: string
  action: string
  [key: string]: unknown
}

function log(level: LogLevel, action: string, data: Record<string, unknown> = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    ...data,
  }
  const output = JSON.stringify(entry)
  if (level === 'error') {
    console.error(output)
  } else {
    console.log(output)
  }
}

export const logger = {
  info: (action: string, data?: Record<string, unknown>) => log('info', action, data),
  warn: (action: string, data?: Record<string, unknown>) => log('warn', action, data),
  error: (action: string, data?: Record<string, unknown>) => log('error', action, data),
  debug: (action: string, data?: Record<string, unknown>) => log('debug', action, data),
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/logger.ts
git commit -m "feat: add structured JSON logger"
```

---

### Task 4: Oracle Utility (Pyth Price Feed)

**Files:**
- Create: `src/utils/oracle.ts`
- Create: `tests/utils/oracle.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/utils/oracle.test.ts
import { describe, it, expect } from 'vitest'
import { checkStaleness, checkDeviation } from '@/utils/oracle'

describe('oracle', () => {
  describe('checkStaleness', () => {
    it('returns fresh when price is recent', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(checkStaleness(now - 10, 120)).toBe(true)
    })

    it('returns stale when price is old', () => {
      const now = Math.floor(Date.now() / 1000)
      expect(checkStaleness(now - 200, 120)).toBe(false)
    })
  })

  describe('checkDeviation', () => {
    it('returns safe when price change is small', () => {
      expect(checkDeviation(100, 105, 10)).toBe(true)
    })

    it('returns unsafe when price change exceeds threshold', () => {
      expect(checkDeviation(100, 115, 10)).toBe(false)
    })

    it('handles price decrease', () => {
      expect(checkDeviation(100, 85, 10)).toBe(false)
    })

    it('handles zero previous price', () => {
      expect(checkDeviation(0, 100, 10)).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/utils/oracle.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Write oracle implementation**

```typescript
// src/utils/oracle.ts
import { logger } from './logger'

export function checkStaleness(priceTimestamp: number, maxAgeSec: number): boolean {
  const now = Math.floor(Date.now() / 1000)
  const age = now - priceTimestamp
  if (age > maxAgeSec) {
    logger.warn('oracle-stale', { age, maxAgeSec })
    return false
  }
  return true
}

export function checkDeviation(
  previousPrice: number,
  currentPrice: number,
  maxDeviationPct: number,
): boolean {
  if (previousPrice <= 0) return false
  const changePct = Math.abs((currentPrice - previousPrice) / previousPrice) * 100
  if (changePct > maxDeviationPct) {
    logger.warn('oracle-deviation', { previousPrice, currentPrice, changePct, maxDeviationPct })
    return false
  }
  return true
}

export interface PriceData {
  price: number
  timestamp: number
  confidence: number
}

export async function fetchSolPrice(pythConnection: unknown): Promise<PriceData> {
  // TODO: Implement with @pythnetwork/client in integration phase
  // For now, return a placeholder that tests can mock
  throw new Error('fetchSolPrice requires Pyth connection — use mock in tests')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/utils/oracle.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/oracle.ts tests/utils/oracle.test.ts
git commit -m "feat: add oracle staleness and deviation checks with tests"
```

---

## Chunk 2: Risk Management Module

### Task 5: Drawdown Monitor

**Files:**
- Create: `src/risk/drawdown.ts`
- Create: `tests/risk/drawdown.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/risk/drawdown.test.ts
import { describe, it, expect } from 'vitest'
import { DrawdownMonitor } from '@/risk/drawdown'
import { VAULT_CONFIG } from '../../config/vault.config'

describe('DrawdownMonitor', () => {
  it('returns normal when no drawdown', () => {
    const monitor = new DrawdownMonitor(VAULT_CONFIG)
    const action = monitor.evaluate(100, 100)
    expect(action).toBe('normal')
  })

  it('returns warning at 2.5% drawdown', () => {
    const monitor = new DrawdownMonitor(VAULT_CONFIG)
    const action = monitor.evaluate(97.5, 100)
    expect(action).toBe('warning')
  })

  it('returns reduce at 4% drawdown', () => {
    const monitor = new DrawdownMonitor(VAULT_CONFIG)
    const action = monitor.evaluate(96, 100)
    expect(action).toBe('reduce')
  })

  it('returns emergency at 6% drawdown', () => {
    const monitor = new DrawdownMonitor(VAULT_CONFIG)
    const action = monitor.evaluate(94, 100)
    expect(action).toBe('emergency')
  })

  it('stays in safe mode after emergency until recovery', () => {
    const monitor = new DrawdownMonitor(VAULT_CONFIG)
    monitor.evaluate(94, 100) // triggers emergency
    expect(monitor.isInSafeMode()).toBe(true)

    // Still in drawdown — stays safe
    const action = monitor.evaluate(97, 100)
    expect(action).toBe('safe_mode')
    expect(monitor.isInSafeMode()).toBe(true)
  })

  it('exits safe mode when recovered above threshold', () => {
    const monitor = new DrawdownMonitor(VAULT_CONFIG)
    monitor.evaluate(94, 100) // triggers emergency
    expect(monitor.isInSafeMode()).toBe(true)

    // Recovered to within 2% of HWM
    const action = monitor.evaluate(98.5, 100)
    expect(action).toBe('safe_mode') // still safe until manually re-enabled
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/risk/drawdown.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/risk/drawdown.ts
import { logger } from '@/utils/logger'
import type { VaultConfig } from '../../config/vault.config'

export type DrawdownAction = 'normal' | 'warning' | 'reduce' | 'emergency' | 'safe_mode'

export class DrawdownMonitor {
  private safeMode = false

  constructor(private config: VaultConfig) {}

  evaluate(currentSharePrice: number, highWaterMark: number): DrawdownAction {
    if (this.safeMode) {
      return 'safe_mode'
    }

    if (highWaterMark <= 0) return 'normal'

    const drawdownPct = ((highWaterMark - currentSharePrice) / highWaterMark) * 100

    if (drawdownPct > this.config.drawdownEmergencyPct) {
      this.safeMode = true
      logger.error('drawdown-emergency', { drawdownPct, currentSharePrice, highWaterMark })
      return 'emergency'
    }

    if (drawdownPct > this.config.drawdownReducePct) {
      logger.warn('drawdown-reduce', { drawdownPct })
      return 'reduce'
    }

    if (drawdownPct > this.config.drawdownWarningPct) {
      logger.warn('drawdown-warning', { drawdownPct })
      return 'warning'
    }

    return 'normal'
  }

  isInSafeMode(): boolean {
    return this.safeMode
  }

  resetSafeMode(): void {
    this.safeMode = false
    logger.info('safe-mode-reset')
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/risk/drawdown.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/risk/drawdown.ts tests/risk/drawdown.test.ts
git commit -m "feat: add drawdown monitor with circuit breaker thresholds"
```

---

### Task 6: Delta Exposure Enforcer

**Files:**
- Create: `src/risk/delta.ts`
- Create: `tests/risk/delta.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/risk/delta.test.ts
import { describe, it, expect } from 'vitest'
import { computeNetDelta, isDeltaBreached } from '@/risk/delta'

describe('delta', () => {
  describe('computeNetDelta', () => {
    it('returns 0 for perfectly hedged position', () => {
      const delta = computeNetDelta(50_000, 50_000, 200_000)
      expect(delta).toBeCloseTo(0)
    })

    it('returns positive when spot exceeds short', () => {
      const delta = computeNetDelta(55_000, 50_000, 200_000)
      expect(delta).toBeCloseTo(2.5)
    })

    it('returns negative when short exceeds spot', () => {
      const delta = computeNetDelta(45_000, 50_000, 200_000)
      expect(delta).toBeCloseTo(-2.5)
    })

    it('returns 0 when no basis trade', () => {
      const delta = computeNetDelta(0, 0, 200_000)
      expect(delta).toBeCloseTo(0)
    })
  })

  describe('isDeltaBreached', () => {
    it('returns false when within cap', () => {
      expect(isDeltaBreached(1.5, 2)).toBe(false)
    })

    it('returns true when exceeds positive cap', () => {
      expect(isDeltaBreached(2.5, 2)).toBe(true)
    })

    it('returns true when exceeds negative cap', () => {
      expect(isDeltaBreached(-2.5, 2)).toBe(true)
    })

    it('returns false at exact boundary', () => {
      expect(isDeltaBreached(2.0, 2)).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/risk/delta.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/risk/delta.ts
import { logger } from '@/utils/logger'

/**
 * Net delta as a percentage of vault NAV.
 * spotValue = USD value of long SOL spot on Drift
 * perpNotional = USD notional of short SOL-PERP on Drift
 * vaultNAV = total vault value in USD
 *
 * Perfectly hedged: spotValue == perpNotional → delta = 0%
 */
export function computeNetDelta(
  spotValue: number,
  perpNotional: number,
  vaultNAV: number,
): number {
  if (vaultNAV <= 0) return 0
  return ((spotValue - perpNotional) / vaultNAV) * 100
}

export function isDeltaBreached(deltaPct: number, capPct: number): boolean {
  const breached = Math.abs(deltaPct) > capPct
  if (breached) {
    logger.warn('delta-breach', { deltaPct, capPct })
  }
  return breached
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/risk/delta.test.ts
```
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/risk/delta.ts tests/risk/delta.test.ts
git commit -m "feat: add delta exposure calculator and breach detection"
```

---

### Task 7: Drift Health Monitor

**Files:**
- Create: `src/risk/health.ts`
- Create: `tests/risk/health.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/risk/health.test.ts
import { describe, it, expect } from 'vitest'
import { evaluateHealth, type DriftAccountState } from '@/risk/health'
import { VAULT_CONFIG } from '../../config/vault.config'

describe('health', () => {
  const baseState: DriftAccountState = {
    freeCollateralPct: 50,
    leverage: 1.5,
    fundingRateAnnualized: 15,
    unrealizedPnlPct: 0,
  }

  it('returns hold when everything is healthy', () => {
    const action = evaluateHealth(baseState, VAULT_CONFIG)
    expect(action).toBe('hold')
  })

  it('returns reduce_25 when free collateral drops below 20%', () => {
    const action = evaluateHealth({ ...baseState, freeCollateralPct: 15 }, VAULT_CONFIG)
    expect(action).toBe('reduce_25')
  })

  it('returns reduce_50 when free collateral drops below 10%', () => {
    const action = evaluateHealth({ ...baseState, freeCollateralPct: 8 }, VAULT_CONFIG)
    expect(action).toBe('reduce_50')
  })

  it('returns close when funding rate goes deeply negative', () => {
    const action = evaluateHealth({ ...baseState, fundingRateAnnualized: -10 }, VAULT_CONFIG)
    expect(action).toBe('close')
  })

  it('returns reduce_50 when leverage exceeds max', () => {
    const action = evaluateHealth({ ...baseState, leverage: 4 }, VAULT_CONFIG)
    expect(action).toBe('reduce_50')
  })

  it('returns the most severe action when multiple triggers fire', () => {
    const action = evaluateHealth({
      freeCollateralPct: 8,
      leverage: 4,
      fundingRateAnnualized: -10,
      unrealizedPnlPct: -5,
    }, VAULT_CONFIG)
    expect(action).toBe('close')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/risk/health.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/risk/health.ts
import { logger } from '@/utils/logger'
import type { VaultConfig } from '../../config/vault.config'

export interface DriftAccountState {
  freeCollateralPct: number
  leverage: number
  fundingRateAnnualized: number
  unrealizedPnlPct: number
}

export type HealthAction = 'hold' | 'reduce_25' | 'reduce_50' | 'close'

const ACTION_SEVERITY: Record<HealthAction, number> = {
  hold: 0,
  reduce_25: 1,
  reduce_50: 2,
  close: 3,
}

export function evaluateHealth(state: DriftAccountState, config: VaultConfig): HealthAction {
  let worst: HealthAction = 'hold'

  function escalate(action: HealthAction, reason: string): void {
    if (ACTION_SEVERITY[action] > ACTION_SEVERITY[worst]) {
      worst = action
      logger.warn('health-escalation', { action, reason, state })
    }
  }

  if (state.fundingRateAnnualized < config.minFundingRateAnnualized) {
    escalate('close', 'funding_rate_negative')
  }

  if (state.freeCollateralPct < 10) {
    escalate('reduce_50', 'free_collateral_critical')
  } else if (state.freeCollateralPct < config.minFreeCollateralPct) {
    escalate('reduce_25', 'free_collateral_low')
  }

  if (state.leverage > config.maxLeverage) {
    escalate('reduce_50', 'leverage_exceeded')
  }

  // Spec §6.3: large PnL deviation signals delta drift, not market loss — log warning only
  if (state.unrealizedPnlPct < -2) {
    logger.warn('health-warning', { reason: 'unrealized_pnl_drift', state })
  }

  return worst
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/risk/health.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/risk/health.ts tests/risk/health.test.ts
git commit -m "feat: add Drift health monitor with escalation logic"
```

---

## Chunk 3: Strategy Engine

### Task 8: Lending Optimizer

**Files:**
- Create: `src/strategy/lending.ts`
- Create: `tests/strategy/lending.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/strategy/lending.test.ts
import { describe, it, expect } from 'vitest'
import { computeLendingAllocation, shouldRebalanceLending, type ProtocolRate } from '@/strategy/lending'
import { VAULT_CONFIG } from '../../config/vault.config'

describe('lending', () => {
  describe('computeLendingAllocation', () => {
    it('allocates proportional to weighted APY', () => {
      const rates: ProtocolRate[] = [
        { protocol: 'kamino', apy: 10 },
        { protocol: 'jupiter', apy: 10 },
        { protocol: 'driftSpot', apy: 10 },
      ]
      const alloc = computeLendingAllocation(rates, VAULT_CONFIG, 100_000)
      // Equal rates × equal-ish weights → roughly equal allocation
      expect(alloc.kamino).toBeGreaterThan(30_000)
      expect(alloc.jupiter).toBeGreaterThan(28_000)
      expect(alloc.driftSpot).toBeGreaterThan(26_000)
    })

    it('favors higher APY protocol', () => {
      const rates: ProtocolRate[] = [
        { protocol: 'kamino', apy: 20 },
        { protocol: 'jupiter', apy: 5 },
        { protocol: 'driftSpot', apy: 5 },
      ]
      const alloc = computeLendingAllocation(rates, VAULT_CONFIG, 100_000)
      expect(alloc.kamino).toBeGreaterThan(alloc.jupiter)
      expect(alloc.kamino).toBeGreaterThan(alloc.driftSpot)
    })

    it('caps any single protocol at maxSingleProtocolPct', () => {
      const rates: ProtocolRate[] = [
        { protocol: 'kamino', apy: 100 },
        { protocol: 'jupiter', apy: 1 },
        { protocol: 'driftSpot', apy: 1 },
      ]
      const alloc = computeLendingAllocation(rates, VAULT_CONFIG, 100_000)
      expect(alloc.kamino).toBeLessThanOrEqual(40_000)
    })

    it('handles zero APY on all protocols', () => {
      const rates: ProtocolRate[] = [
        { protocol: 'kamino', apy: 0 },
        { protocol: 'jupiter', apy: 0 },
        { protocol: 'driftSpot', apy: 0 },
      ]
      const alloc = computeLendingAllocation(rates, VAULT_CONFIG, 100_000)
      // Equal split when no signal
      const total = alloc.kamino + alloc.jupiter + alloc.driftSpot
      expect(total).toBeCloseTo(100_000, -2)
    })
  })

  describe('shouldRebalanceLending', () => {
    it('returns false when deviation is below threshold', () => {
      const current = { kamino: 34_000, jupiter: 33_000, driftSpot: 33_000 }
      const target = { kamino: 34_500, jupiter: 32_500, driftSpot: 33_000 }
      expect(shouldRebalanceLending(current, target, 100_000, VAULT_CONFIG)).toBe(false)
    })

    it('returns true when deviation exceeds threshold', () => {
      const current = { kamino: 40_000, jupiter: 30_000, driftSpot: 30_000 }
      const target = { kamino: 30_000, jupiter: 35_000, driftSpot: 35_000 }
      expect(shouldRebalanceLending(current, target, 100_000, VAULT_CONFIG)).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/strategy/lending.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/strategy/lending.ts
import type { VaultConfig } from '../../config/vault.config'

export interface ProtocolRate {
  protocol: 'kamino' | 'jupiter' | 'driftSpot'
  apy: number
}

export interface LendingAllocation {
  kamino: number
  jupiter: number
  driftSpot: number
}

export function computeLendingAllocation(
  rates: ProtocolRate[],
  config: VaultConfig,
  totalLendingCapital: number,
): LendingAllocation {
  const weights = rates.map(r => ({
    protocol: r.protocol,
    score: Math.max(r.apy, 0) * config.protocolWeights[r.protocol],
  }))

  const totalScore = weights.reduce((sum, w) => sum + w.score, 0)
  const maxPerProtocol = totalLendingCapital * (config.maxSingleProtocolPct / 100)

  const allocation: LendingAllocation = { kamino: 0, jupiter: 0, driftSpot: 0 }

  if (totalScore === 0) {
    // Equal split when no APY signal
    const equal = totalLendingCapital / rates.length
    for (const r of rates) {
      allocation[r.protocol] = equal
    }
    return allocation
  }

  let remaining = totalLendingCapital
  const capped: string[] = []

  // First pass: proportional allocation with cap
  for (const w of weights) {
    const raw = (w.score / totalScore) * totalLendingCapital
    const clamped = Math.min(raw, maxPerProtocol)
    allocation[w.protocol] = clamped
    if (clamped < raw) capped.push(w.protocol)
    remaining -= clamped
  }

  // Second pass: redistribute excess to uncapped protocols
  if (remaining > 0 && capped.length < rates.length) {
    const uncapped = weights.filter(w => !capped.includes(w.protocol))
    const uncappedScore = uncapped.reduce((s, w) => s + w.score, 0)
    for (const w of uncapped) {
      const extra = uncappedScore > 0 ? (w.score / uncappedScore) * remaining : remaining / uncapped.length
      allocation[w.protocol] = Math.min(allocation[w.protocol] + extra, maxPerProtocol)
    }
  }

  return allocation
}

export function shouldRebalanceLending(
  current: LendingAllocation,
  target: LendingAllocation,
  totalCapital: number,
  config: VaultConfig,
): boolean {
  const protocols: Array<keyof LendingAllocation> = ['kamino', 'jupiter', 'driftSpot']
  for (const p of protocols) {
    const deviationPct = Math.abs(current[p] - target[p]) / totalCapital * 100
    if (deviationPct > config.rebalanceThresholdPct) return true
  }
  return false
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/strategy/lending.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/strategy/lending.ts tests/strategy/lending.test.ts
git commit -m "feat: add lending optimizer with rate scoring and protocol cap"
```

---

### Task 9: Basis Trade Logic

**Files:**
- Create: `src/strategy/basis.ts`
- Create: `tests/strategy/basis.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/strategy/basis.test.ts
import { describe, it, expect } from 'vitest'
import { computeBasisTradeTarget, type BasisTradeState, type BasisTradeAction } from '@/strategy/basis'
import { VAULT_CONFIG } from '../../config/vault.config'

describe('basis', () => {
  describe('computeBasisTradeTarget', () => {
    it('returns open when no existing position and funding is positive', () => {
      const state: BasisTradeState = {
        spotValue: 0,
        perpNotional: 0,
        fundingRateAnnualized: 20,
        solPrice: 150,
      }
      const action = computeBasisTradeTarget(state, 100_000, 30, VAULT_CONFIG)
      expect(action.type).toBe('open')
      expect(action.targetNotional).toBeCloseTo(30_000)
    })

    it('returns close when funding rate is deeply negative', () => {
      const state: BasisTradeState = {
        spotValue: 30_000,
        perpNotional: 30_000,
        fundingRateAnnualized: -10,
        solPrice: 150,
      }
      const action = computeBasisTradeTarget(state, 100_000, 30, VAULT_CONFIG)
      expect(action.type).toBe('close')
    })

    it('returns adjust when position drifts from target', () => {
      const state: BasisTradeState = {
        spotValue: 25_000,
        perpNotional: 25_000,
        fundingRateAnnualized: 15,
        solPrice: 150,
      }
      const action = computeBasisTradeTarget(state, 100_000, 30, VAULT_CONFIG)
      expect(action.type).toBe('adjust')
      expect(action.targetNotional).toBeCloseTo(30_000)
    })

    it('returns hold when position is close to target', () => {
      const state: BasisTradeState = {
        spotValue: 29_500,
        perpNotional: 29_500,
        fundingRateAnnualized: 15,
        solPrice: 150,
      }
      const action = computeBasisTradeTarget(state, 100_000, 30, VAULT_CONFIG)
      expect(action.type).toBe('hold')
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/strategy/basis.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/strategy/basis.ts
import type { VaultConfig } from '../../config/vault.config'

export interface BasisTradeState {
  spotValue: number     // USD value of long SOL spot
  perpNotional: number  // USD notional of short SOL-PERP
  fundingRateAnnualized: number
  solPrice: number
}

export interface BasisTradeAction {
  type: 'open' | 'close' | 'adjust' | 'hold'
  targetNotional: number  // target USD notional for each leg
  deltaFromTarget: number // how much to change
}

export function computeBasisTradeTarget(
  state: BasisTradeState,
  vaultNAV: number,
  basisTradePct: number,
  config: VaultConfig,
): BasisTradeAction {
  const targetNotional = (basisTradePct / 100) * vaultNAV

  // Close if funding rate is negative beyond threshold
  if (state.fundingRateAnnualized < config.minFundingRateAnnualized) {
    return { type: 'close', targetNotional: 0, deltaFromTarget: -(state.spotValue) }
  }

  const currentAvg = (state.spotValue + state.perpNotional) / 2
  const deviation = Math.abs(currentAvg - targetNotional) / vaultNAV * 100

  // No existing position — open
  if (state.spotValue === 0 && state.perpNotional === 0) {
    return { type: 'open', targetNotional, deltaFromTarget: targetNotional }
  }

  // Close to target — hold
  if (deviation < config.rebalanceThresholdPct) {
    return { type: 'hold', targetNotional, deltaFromTarget: 0 }
  }

  // Position exists but off target — adjust
  return { type: 'adjust', targetNotional, deltaFromTarget: targetNotional - currentAvg }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/strategy/basis.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/strategy/basis.ts tests/strategy/basis.test.ts
git commit -m "feat: add basis trade target calculator"
```

---

### Task 10: Allocator (Strategy Brain)

**Files:**
- Create: `src/strategy/allocator.ts`
- Create: `tests/strategy/allocator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/strategy/allocator.test.ts
import { describe, it, expect } from 'vitest'
import { computeAllocation, type AllocationInput } from '@/strategy/allocator'
import { VAULT_CONFIG } from '../../config/vault.config'

describe('allocator', () => {
  it('uses base split at moderate funding rate', () => {
    const input: AllocationInput = {
      vaultNAV: 100_000,
      fundingRateAnnualized: 15,
      drawdownAction: 'normal',
    }
    const alloc = computeAllocation(input, VAULT_CONFIG)
    expect(alloc.idlePct).toBe(5)
    expect(alloc.lendingPct).toBe(65)
    expect(alloc.basisTradePct).toBe(30)
  })

  it('shifts to basis trade when funding rate is very high', () => {
    const input: AllocationInput = {
      vaultNAV: 100_000,
      fundingRateAnnualized: 40,
      drawdownAction: 'normal',
    }
    const alloc = computeAllocation(input, VAULT_CONFIG)
    expect(alloc.basisTradePct).toBe(40)
    expect(alloc.lendingPct).toBe(55)
  })

  it('shifts to lending when funding rate is near zero', () => {
    const input: AllocationInput = {
      vaultNAV: 100_000,
      fundingRateAnnualized: 0,
      drawdownAction: 'normal',
    }
    const alloc = computeAllocation(input, VAULT_CONFIG)
    expect(alloc.basisTradePct).toBe(20)
    expect(alloc.lendingPct).toBe(75)
  })

  it('reduces basis trade on drawdown reduce action', () => {
    const input: AllocationInput = {
      vaultNAV: 100_000,
      fundingRateAnnualized: 15,
      drawdownAction: 'reduce',
    }
    const alloc = computeAllocation(input, VAULT_CONFIG)
    expect(alloc.basisTradePct).toBe(15) // 50% of base 30
    expect(alloc.lendingPct).toBe(80)
  })

  it('closes basis trade on emergency', () => {
    const input: AllocationInput = {
      vaultNAV: 100_000,
      fundingRateAnnualized: 15,
      drawdownAction: 'emergency',
    }
    const alloc = computeAllocation(input, VAULT_CONFIG)
    expect(alloc.basisTradePct).toBe(0)
    expect(alloc.lendingPct).toBe(95)
  })

  it('all percentages sum to 100', () => {
    const inputs: AllocationInput[] = [
      { vaultNAV: 100_000, fundingRateAnnualized: 15, drawdownAction: 'normal' },
      { vaultNAV: 100_000, fundingRateAnnualized: 40, drawdownAction: 'normal' },
      { vaultNAV: 100_000, fundingRateAnnualized: -3, drawdownAction: 'normal' },
      { vaultNAV: 100_000, fundingRateAnnualized: 15, drawdownAction: 'emergency' },
    ]
    for (const input of inputs) {
      const alloc = computeAllocation(input, VAULT_CONFIG)
      expect(alloc.idlePct + alloc.lendingPct + alloc.basisTradePct).toBe(100)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/strategy/allocator.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/strategy/allocator.ts
import type { VaultConfig } from '../../config/vault.config'
import type { DrawdownAction } from '@/risk/drawdown'

export interface AllocationInput {
  vaultNAV: number
  fundingRateAnnualized: number
  drawdownAction: DrawdownAction
}

export interface Allocation {
  idlePct: number
  lendingPct: number
  basisTradePct: number
}

export function computeAllocation(input: AllocationInput, config: VaultConfig): Allocation {
  const idle = config.idleBufferPct

  // Emergency or safe mode — no basis trade
  if (input.drawdownAction === 'emergency' || input.drawdownAction === 'safe_mode') {
    return { idlePct: idle, lendingPct: 100 - idle, basisTradePct: 0 }
  }

  // Compute basis trade percentage based on funding rate
  let basisPct: number
  if (input.fundingRateAnnualized >= 30) {
    basisPct = 40 // max basis trade
  } else if (input.fundingRateAnnualized <= 0) {
    basisPct = 20 // min basis trade
  } else {
    // Linear interpolation: 0% funding → 20%, 30% funding → 40%
    basisPct = 20 + (input.fundingRateAnnualized / 30) * 20
  }

  // Reduce on drawdown warning
  if (input.drawdownAction === 'reduce') {
    basisPct = Math.floor(basisPct / 2)
  }

  const lendingPct = 100 - idle - basisPct

  return { idlePct: idle, lendingPct, basisTradePct: basisPct }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/strategy/allocator.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/strategy/allocator.ts tests/strategy/allocator.test.ts
git commit -m "feat: add allocator with dynamic lending/basis split"
```

---

## Chunk 4: Execution Layer

### Task 11: Encrypted Parameter Store

**Files:**
- Create: `src/execution/params.ts`
- Create: `tests/execution/params.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/execution/params.test.ts
import { describe, it, expect } from 'vitest'
import { encryptParams, decryptParams } from '@/execution/params'

describe('params', () => {
  const testKey = Buffer.alloc(32, 'test-key-phantom-yield-vault-xx')
  const testParams = {
    customWeights: { kamino: 1.0, jupiter: 0.8, driftSpot: 0.95 },
    customThreshold: 3,
  }

  it('encrypts and decrypts roundtrip', () => {
    const encrypted = encryptParams(testParams, testKey)
    expect(encrypted).toContain(':') // iv:ciphertext:tag format
    const decrypted = decryptParams(encrypted, testKey)
    expect(decrypted).toEqual(testParams)
  })

  it('produces different ciphertext each time (random IV)', () => {
    const a = encryptParams(testParams, testKey)
    const b = encryptParams(testParams, testKey)
    expect(a).not.toBe(b)
  })

  it('throws on wrong key', () => {
    const encrypted = encryptParams(testParams, testKey)
    const wrongKey = Buffer.alloc(32, 'wrong-key-wrong-key-wrong-key-xx')
    expect(() => decryptParams(encrypted, wrongKey)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run tests/execution/params.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// src/execution/params.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export function encryptParams(params: Record<string, unknown>, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = JSON.stringify(params)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
}

export function decryptParams(encryptedStr: string, key: Buffer): Record<string, unknown> {
  const [ivHex, dataHex, tagHex] = encryptedStr.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return JSON.parse(decrypted.toString('utf8'))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run tests/execution/params.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/execution/params.ts tests/execution/params.test.ts
git commit -m "feat: add AES-256-GCM encrypted parameter store"
```

---

### Task 12: Jito Bundle Submission

**Files:**
- Create: `src/execution/jito.ts`

- [ ] **Step 1: Write Jito bundle wrapper**

This integrates with the Jito block engine. No unit test — integration-tested on devnet.

```typescript
// src/execution/jito.ts
import { Connection, VersionedTransaction, TransactionMessage, type Keypair } from '@solana/web3.js'
import { logger } from '@/utils/logger'

export interface JitoConfig {
  blockEngineUrl: string
  tipLamports: number
  maxRetries: number
}

/**
 * Submit a transaction via Jito bundle for front-running protection.
 * Falls back to standard RPC submission after maxRetries failures.
 */
export async function submitViaJito(
  transaction: VersionedTransaction,
  connection: Connection,
  signers: Keypair[],
  config: JitoConfig,
): Promise<string> {
  // Sign the transaction
  transaction.sign(signers)
  const serialized = transaction.serialize()

  // Attempt Jito bundle submission
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(`${config.blockEngineUrl}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [[Buffer.from(serialized).toString('base64')]],
        }),
      })

      if (!response.ok) {
        throw new Error(`Jito HTTP ${response.status}: ${await response.text()}`)
      }

      const result = await response.json() as { result?: string; error?: { message: string } }
      if (result.error) {
        throw new Error(`Jito RPC error: ${result.error.message}`)
      }

      logger.info('jito-bundle-sent', { bundleId: result.result, attempt })
      return result.result ?? ''
    } catch (err) {
      logger.warn('jito-attempt-failed', {
        attempt,
        maxRetries: config.maxRetries,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Fallback: standard RPC submission with priority fee
  logger.warn('jito-fallback-rpc', { reason: 'all Jito attempts failed' })
  const sig = await connection.sendRawTransaction(serialized, {
    skipPreflight: false,
    maxRetries: 3,
  })
  await connection.confirmTransaction(sig, 'confirmed')
  logger.info('rpc-fallback-confirmed', { signature: sig })
  return sig
}
```

- [ ] **Step 2: Commit**

```bash
git add src/execution/jito.ts
git commit -m "feat: add Jito bundle submission with RPC fallback"
```

---

## Chunk 5: Voltr Client + Vault Scripts

### Task 13: Voltr Client Wrapper

**Files:**
- Create: `src/client/voltr.ts`

- [ ] **Step 1: Write Voltr client wrapper**

```typescript
// src/client/voltr.ts
import { VoltrClient, VAULT_PROGRAM_ID, LENDING_ADAPTOR_PROGRAM_ID, DRIFT_ADAPTOR_PROGRAM_ID } from '@voltr/vault-sdk'
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { logger } from '@/utils/logger'

export interface VaultInfo {
  address: PublicKey
  lpMint: PublicKey
  totalValue: number
  sharePrice: number
  strategies: Array<{ address: PublicKey; value: number }>
}

export async function createVoltrClient(rpcUrl: string): Promise<VoltrClient> {
  const connection = new Connection(rpcUrl)
  return new VoltrClient(connection)
}

export async function getVaultInfo(
  client: VoltrClient,
  vault: PublicKey,
): Promise<VaultInfo> {
  const vaultAccount = await client.fetchVaultAccount(vault)
  const positions = await client.getPositionAndTotalValuesForVault(vault)
  const sharePrice = await client.getCurrentAssetPerLpForVault(vault)
  const lpMint = client.findVaultLpMint(vault)

  const strategies = positions.strategyPositions.map(sp => ({
    address: sp.strategy,
    value: sp.value.toNumber(),
  }))

  return {
    address: vault,
    lpMint,
    totalValue: positions.totalValue.toNumber(),
    sharePrice: sharePrice.toNumber(),
    strategies,
  }
}

export async function depositToStrategy(
  client: VoltrClient,
  vault: PublicKey,
  strategy: PublicKey,
  amount: BN,
  manager: Keypair,
  connection: Connection,
): Promise<string> {
  const ix = await client.createDepositStrategyIx(
    amount,
    {
      vault,
      manager: manager.publicKey,
      strategy,
    },
  )
  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(connection, tx, [manager])
  logger.info('strategy-deposit', { vault: vault.toBase58(), strategy: strategy.toBase58(), amount: amount.toString(), sig })
  return sig
}

export async function withdrawFromStrategy(
  client: VoltrClient,
  vault: PublicKey,
  strategy: PublicKey,
  amount: BN,
  manager: Keypair,
  connection: Connection,
): Promise<string> {
  const ix = await client.createWithdrawStrategyIx(
    amount,
    {
      vault,
      manager: manager.publicKey,
      strategy,
    },
  )
  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(connection, tx, [manager])
  logger.info('strategy-withdraw', { vault: vault.toBase58(), strategy: strategy.toBase58(), amount: amount.toString(), sig })
  return sig
}
```

- [ ] **Step 2: Commit**

```bash
git add src/client/voltr.ts
git commit -m "feat: add Voltr client wrapper for vault operations"
```

---

### Task 14: Vault Initialization Script

**Files:**
- Create: `scripts/init-vault.ts`

- [ ] **Step 1: Write vault creation script**

```typescript
// scripts/init-vault.ts
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { VoltrClient } from '@voltr/vault-sdk'
import { BN } from '@coral-xyz/anchor'
import { readFileSync } from 'fs'
import dotenv from 'dotenv'
import { VAULT_CONFIG } from '../config/vault.config'

dotenv.config()

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL!
  const adminKpPath = process.env.ADMIN_KEYPAIR_PATH!
  const managerKpPath = process.env.MANAGER_KEYPAIR_PATH!

  const connection = new Connection(rpcUrl, 'confirmed')
  const adminKp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(adminKpPath, 'utf-8')))
  )
  const managerKp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(managerKpPath, 'utf-8')))
  )
  const vaultKp = Keypair.generate()

  const client = new VoltrClient(connection)

  // USDC devnet mint
  const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')

  const vaultConfig = {
    maxCap: new BN('18446744073709551615'), // u64 max
    startAtTs: new BN(0),
    lockedProfitDegradationDuration: new BN(VAULT_CONFIG.lockedProfitDegradationSec),
    managerPerformanceFee: VAULT_CONFIG.performanceFeeBps,
    adminPerformanceFee: 0,
    managerManagementFee: VAULT_CONFIG.managementFeeBps,
    adminManagementFee: 0,
    redemptionFee: 0,
    issuanceFee: 0,
    withdrawalWaitingPeriod: new BN(VAULT_CONFIG.withdrawalWaitingSec),
  }

  const vaultParams = {
    config: vaultConfig,
    name: 'Phantom Yield',
    description: 'Delta-neutral vault with MEV-aware rebalancing',
  }

  console.log('Creating vault...')
  console.log('Admin:', adminKp.publicKey.toBase58())
  console.log('Manager:', managerKp.publicKey.toBase58())
  console.log('Vault:', vaultKp.publicKey.toBase58())

  const ix = await client.createInitializeVaultIx(vaultParams, {
    vault: vaultKp,
    vaultAssetMint: USDC_DEVNET,
    admin: adminKp.publicKey,
    manager: managerKp.publicKey,
    payer: adminKp.publicKey,
  })

  const tx = new Transaction().add(ix)
  const sig = await sendAndConfirmTransaction(connection, tx, [adminKp, vaultKp])

  console.log('Vault created!')
  console.log('Signature:', sig)
  console.log('Vault address:', vaultKp.publicKey.toBase58())
  console.log('\nSave this vault address in your .env as VAULT_ADDRESS')
}

main().catch(console.error)
```

- [ ] **Step 2: Commit**

```bash
git add scripts/init-vault.ts
git commit -m "feat: add vault initialization script for devnet"
```

---

### Task 15: Strategy Initialization Script

**Files:**
- Create: `scripts/init-strategies.ts`

- [ ] **Step 1: Write strategy init script**

This adds the Drift, Jupiter, and Kamino adaptors to the vault and initializes strategies. Uses the reference scripts from `voltrxyz/drift-scripts`, `voltrxyz/spot-scripts`, `voltrxyz/kamino-scripts` as guidance.

```typescript
// scripts/init-strategies.ts
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { VoltrClient, LENDING_ADAPTOR_PROGRAM_ID, DRIFT_ADAPTOR_PROGRAM_ID } from '@voltr/vault-sdk'
import { readFileSync } from 'fs'
import dotenv from 'dotenv'

dotenv.config()

// Kamino adaptor program ID
const KAMINO_ADAPTOR = new PublicKey('to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR')
// Jupiter adaptor program ID
const JUPITER_ADAPTOR = new PublicKey('EW35URAx3LiM13fFK3QxAXfGemHso9HWPixrv7YDY4AM')

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL!
  const adminKpPath = process.env.ADMIN_KEYPAIR_PATH!
  const vaultAddress = new PublicKey(process.env.VAULT_ADDRESS!)

  const connection = new Connection(rpcUrl, 'confirmed')
  const adminKp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(adminKpPath, 'utf-8')))
  )

  const client = new VoltrClient(connection)

  // Add adaptors
  const adaptors = [
    { name: 'Drift', programId: DRIFT_ADAPTOR_PROGRAM_ID },
    { name: 'Jupiter', programId: JUPITER_ADAPTOR },
    { name: 'Kamino', programId: KAMINO_ADAPTOR },
  ]

  for (const adaptor of adaptors) {
    console.log(`Adding ${adaptor.name} adaptor...`)
    try {
      const ix = await client.createAddAdaptorIx({
        vault: vaultAddress,
        payer: adminKp.publicKey,
        admin: adminKp.publicKey,
        adaptorProgram: adaptor.programId,
      })
      const tx = new Transaction().add(ix)
      const sig = await sendAndConfirmTransaction(connection, tx, [adminKp])
      console.log(`  ${adaptor.name} added: ${sig}`)
    } catch (err) {
      console.log(`  ${adaptor.name} already added or error:`, (err as Error).message)
    }
  }

  console.log('\nAdaptors registered. Strategy initialization requires protocol-specific')
  console.log('account setup — see voltrxyz/drift-scripts and voltrxyz/kamino-scripts.')
  console.log('Run those scripts next to initialize individual strategies.')
}

main().catch(console.error)
```

- [ ] **Step 2: Commit**

```bash
git add scripts/init-strategies.ts
git commit -m "feat: add strategy initialization script for adaptors"
```

---

## Chunk 6: Bot + Integration

### Task 16: Bot Loop Architecture

**Files:**
- Create: `src/bot/loops.ts`

- [ ] **Step 1: Write async loop runner**

```typescript
// src/bot/loops.ts
import { logger } from '@/utils/logger'

export interface LoopConfig {
  name: string
  intervalMs: number
  fn: () => Promise<void>
}

export function createLoopRunner(configs: LoopConfig[]): { start: () => void; stop: () => void } {
  let running = false
  const abortControllers: AbortController[] = []

  async function runLoop(config: LoopConfig, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const start = Date.now()
      try {
        await config.fn()
        logger.debug('loop-complete', { loop: config.name, durationMs: Date.now() - start })
      } catch (err) {
        logger.error('loop-error', {
          loop: config.name,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        })
      }
      // Wait for interval, but check abort signal
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, config.intervalMs)
        signal.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
      })
    }
  }

  return {
    start() {
      if (running) return
      running = true
      for (const config of configs) {
        const controller = new AbortController()
        abortControllers.push(controller)
        runLoop(config, controller.signal)
        logger.info('loop-started', { loop: config.name, intervalMs: config.intervalMs })
      }
    },
    stop() {
      running = false
      for (const controller of abortControllers) {
        controller.abort()
      }
      abortControllers.length = 0
      logger.info('all-loops-stopped')
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bot/loops.ts
git commit -m "feat: add async loop runner with graceful shutdown"
```

---

### Task 17: Bot Entry Point

**Files:**
- Create: `src/bot/index.ts`

- [ ] **Step 1: Write bot entry point**

```typescript
// src/bot/index.ts
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { VoltrClient } from '@voltr/vault-sdk'
import { readFileSync } from 'fs'
import dotenv from 'dotenv'
import { VAULT_CONFIG } from '../../config/vault.config'
import { createLoopRunner } from './loops'
import { getVaultInfo } from '@/client/voltr'
import { computeAllocation } from '@/strategy/allocator'
import { computeLendingAllocation, shouldRebalanceLending } from '@/strategy/lending'
import { computeBasisTradeTarget } from '@/strategy/basis'
import { DrawdownMonitor } from '@/risk/drawdown'
import { computeNetDelta, isDeltaBreached } from '@/risk/delta'
import { logger } from '@/utils/logger'

dotenv.config()

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL!
  const managerKpPath = process.env.MANAGER_KEYPAIR_PATH!
  const vaultAddress = new PublicKey(process.env.VAULT_ADDRESS!)

  const connection = new Connection(rpcUrl, 'confirmed')
  const managerKp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(managerKpPath, 'utf-8')))
  )
  const client = new VoltrClient(connection)

  const drawdownMonitor = new DrawdownMonitor(VAULT_CONFIG)
  let highWaterMark = 0
  let lastSolPrice = 0

  async function rebalanceLoop(): Promise<void> {
    const vaultInfo = await getVaultInfo(client, vaultAddress)
    const sharePrice = vaultInfo.sharePrice

    // Update HWM
    if (sharePrice > highWaterMark) highWaterMark = sharePrice

    // Check drawdown
    const drawdownAction = drawdownMonitor.evaluate(sharePrice, highWaterMark)
    logger.info('rebalance-check', { sharePrice, highWaterMark, drawdownAction, nav: vaultInfo.totalValue })

    // TODO: Fetch real funding rate from Drift SDK
    const fundingRateAnnualized = 15 // placeholder

    // Compute target allocation
    const allocation = computeAllocation({
      vaultNAV: vaultInfo.totalValue,
      fundingRateAnnualized,
      drawdownAction,
    }, VAULT_CONFIG)

    logger.info('target-allocation', allocation)

    // TODO: Fetch real lending rates from protocols
    // TODO: Execute rebalance moves via Voltr SDK + Jito
    // TODO: Adjust Drift basis trade position
  }

  async function refreshLoop(): Promise<void> {
    // TODO: Call Voltr SDK to refresh on-chain position values
    logger.debug('refresh-positions', { vault: vaultAddress.toBase58() })
  }

  async function harvestLoop(): Promise<void> {
    // TODO: Call client.createHarvestFeeIx() and submit
    logger.debug('harvest-fees', { vault: vaultAddress.toBase58() })
  }

  const runner = createLoopRunner([
    { name: 'rebalance', intervalMs: 5 * 60 * 1000, fn: rebalanceLoop },
    { name: 'refresh', intervalMs: 10 * 60 * 1000, fn: refreshLoop },
    { name: 'harvest', intervalMs: 30 * 60 * 1000, fn: harvestLoop },
  ])

  // Graceful shutdown
  process.on('SIGINT', () => { logger.info('shutdown-signal', { signal: 'SIGINT' }); runner.stop(); process.exit(0) })
  process.on('SIGTERM', () => { logger.info('shutdown-signal', { signal: 'SIGTERM' }); runner.stop(); process.exit(0) })

  logger.info('bot-starting', { vault: vaultAddress.toBase58(), rpc: rpcUrl })
  runner.start()
}

main().catch(err => {
  logger.error('bot-fatal', { error: err instanceof Error ? err.message : String(err) })
  process.exit(1)
})
```

- [ ] **Step 2: Add run script to package.json**

Add to `scripts` in `package.json`:
```json
{
  "bot": "tsx src/bot/index.ts",
  "init-vault": "tsx scripts/init-vault.ts",
  "init-strategies": "tsx scripts/init-strategies.ts",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Commit**

```bash
git add src/bot/index.ts package.json
git commit -m "feat: add bot entry point with rebalance/refresh/harvest loops"
```

---

## Chunk 7: Documentation + Submission

### Task 18: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README**

Cover: what it is, strategy thesis, architecture diagram, how to run, how to deploy vault, configuration, risks. Target audience: hackathon judges.

Key sections:
- Strategy overview (thesis + architecture diagram from spec Section 2)
- Setup (install, create keypairs, fund devnet wallet, configure .env)
- Deploy vault (`pnpm run init-vault` → `pnpm run init-strategies`)
- Run bot (`pnpm run bot`)
- Configuration reference (link to `config/vault.config.ts`)
- Risk management (table from spec Section 6)
- Dust Protocol heritage (patterns ported, Section 10)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README for hackathon submission"
```

---

### Task 19: Strategy Documentation

**Files:**
- Create: `docs/strategy.md`

- [ ] **Step 1: Write strategy doc** (hackathon submission requirement)

Cover:
- Strategy thesis and edge
- How the basis trade works (long spot + short perp = delta-neutral)
- Multi-protocol lending optimization scoring model
- MEV-aware execution (Jito on Drift operations)
- Risk management framework (drawdown, delta, health)
- Expected returns with honest caveats
- Known limitations (from spec Section 12)

- [ ] **Step 2: Commit**

```bash
git add docs/strategy.md
git commit -m "docs: add strategy documentation for hackathon submission"
```

---

### Task 20: Architecture Documentation

**Files:**
- Create: `docs/architecture.md`

- [ ] **Step 1: Write architecture doc** (hackathon submission requirement)

Cover:
- System diagram (vault → adaptors → protocols)
- Bot loop architecture
- Execution flow (standard RPC vs Jito)
- Risk management module interactions
- Configuration system
- Patterns ported from Dust Protocol

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture documentation for hackathon submission"
```

---

### Task 21: Backtest Script

**Files:**
- Create: `scripts/backtest.ts`

- [ ] **Step 1: Write backtest skeleton**

Fetch historical Drift funding rates + lending APYs. Simulate the allocator + basis trade over the period. Output: estimated APY, max drawdown, Sharpe ratio.

Data sources:
- Drift historical funding: `@drift-labs/sdk` or Drift API
- Lending rates: Kamino/Jupiter historical APIs (if available) or constant assumption

- [ ] **Step 2: Commit**

```bash
git add scripts/backtest.ts
git commit -m "feat: add historical backtest script"
```

---

## Chunk 8: Integration Testing + Final Polish

### Task 22: Devnet Integration Test

- [ ] **Step 1: Generate devnet keypairs**

```bash
mkdir -p keys
solana-keygen new --outfile keys/admin.json --no-bip39-passphrase
solana-keygen new --outfile keys/manager.json --no-bip39-passphrase
```

- [ ] **Step 2: Fund devnet wallets**

```bash
solana airdrop 2 $(solana-keygen pubkey keys/admin.json) --url devnet
solana airdrop 2 $(solana-keygen pubkey keys/manager.json) --url devnet
```

- [ ] **Step 3: Create .env from .env.example**

```bash
cp .env.example .env
# Edit .env with keypair paths and devnet RPC
```

- [ ] **Step 4: Create vault on devnet**

```bash
pnpm run init-vault
```
Expected: Vault address printed. Save to .env as VAULT_ADDRESS.

- [ ] **Step 5: Initialize adaptors**

```bash
pnpm run init-strategies
```
Expected: 3 adaptors registered.

- [ ] **Step 6: Start bot and verify logs**

```bash
pnpm run bot
```
Expected: Structured JSON logs showing rebalance-check, target-allocation. Bot runs loops.

- [ ] **Step 7: Commit any fixes from integration testing**

```bash
git add -A
git commit -m "fix: integration test fixes from devnet deployment"
```

---

### Task 23: Demo Video Recording

- [ ] **Step 1: Record Main Track demo (max 3 min)**

Script:
1. (0:00-0:30) Strategy thesis — multi-protocol delta-neutral with MEV-aware rebalancing
2. (0:30-1:30) Architecture walkthrough — vault diagram, lending + basis trade legs
3. (1:30-2:15) Live devnet demo — show bot running, logs, vault state
4. (2:15-2:45) Risk management — drawdown circuit breakers, delta enforcement
5. (2:45-3:00) Dust Protocol heritage — patterns ported, team background

- [ ] **Step 2: Record Drift Side Track demo (max 3 min)**

Script:
1. (0:00-0:30) Funding rate carry thesis
2. (0:30-1:30) Basis trade mechanics — long spot + short perp on Drift
3. (1:30-2:15) Jito bundle integration — why front-running protection matters for Drift ops
4. (2:15-2:45) Risk management — funding rate monitoring, delta enforcement
5. (2:45-3:00) Live devnet demo

---

### Task 24: Final Submission

- [ ] **Step 1: Verify all tests pass**

```bash
pnpm test
```
Expected: All tests pass.

- [ ] **Step 2: Push to GitHub**

```bash
git remote add origin <github-repo-url>
git push -u origin main
```

- [ ] **Step 3: Submit via hackathon bounty page**

Checklist:
- [ ] Demo video (Main Track) uploaded
- [ ] Demo video (Drift Side Track) uploaded
- [ ] Strategy documentation linked (docs/strategy.md)
- [ ] Code repository linked (GitHub URL)
- [ ] On-chain verification (devnet vault address + tx hashes)

---

## Summary

| Chunk | Tasks | Focus |
|---|---|---|
| 1 | 1-4 | Project scaffolding, config, utils |
| 2 | 5-7 | Risk management (drawdown, delta, health) |
| 3 | 8-10 | Strategy engine (lending, basis, allocator) |
| 4 | 11-12 | Execution layer (encrypted params, Jito) |
| 5 | 13-15 | Voltr client + vault scripts |
| 6 | 16-17 | Bot loops + entry point |
| 7 | 18-21 | Documentation + backtest |
| 8 | 22-24 | Integration testing + submission |

**Total**: 24 tasks, ~33 unit tests, estimated build time ~2.5 weeks.
