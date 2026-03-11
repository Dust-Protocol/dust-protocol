'use client'

import { DollarSignIcon, ShieldIcon, BarChart3Icon, DatabaseIcon, LayersIcon, ActivityIcon, GlobeIcon } from 'lucide-react'
import { TokenIcon, USDCIcon } from '@/components/stealth/icons'
import { getChainConfig } from '@/config/chains'

interface PoolStatsProps {
  currentPrice: number | null
  shieldedEth: number
  shieldedUsdc: number
  noteCount: number
  combinedTvl: number
  isLoading: boolean
  poolTick?: number
  priceSource?: 'chainlink' | 'pool'
  liquidity?: bigint
  isGenericAdapter?: boolean
  chainId?: number
}

export function formatNumber(num: number, decimals: number = 2): string {
  if (!isFinite(num) || isNaN(num)) return '\u2014'
  if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`
  if (num < 0.01 && num > 0) return num.toFixed(6)
  return num.toFixed(decimals)
}

export function PoolStats({
  currentPrice,
  shieldedEth,
  shieldedUsdc,
  noteCount,
  combinedTvl,
  isLoading,
  poolTick,
  priceSource,
  liquidity,
  isGenericAdapter,
  chainId,
}: PoolStatsProps) {
  const nativeSymbol = getChainConfig(chainId).nativeCurrency.symbol
  const shieldedEthValue = currentPrice !== null ? shieldedEth * currentPrice : 0
  const shieldedTotal = currentPrice !== null ? shieldedEthValue + shieldedUsdc : 0
  const ethPercent = shieldedTotal > 0 ? (shieldedEthValue / shieldedTotal) * 100 : 50

  if (isLoading) {
    return (
      <div className="w-full md:w-[180px] md:h-full">
        <div className="p-3 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="h-2 w-12 bg-[rgba(255,255,255,0.06)] rounded animate-pulse" />
                <div className="h-3 w-16 bg-[rgba(255,255,255,0.04)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full md:w-[180px] md:h-full" style={{ minHeight: 'inherit' }}>
      <div className="p-3 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm flex flex-col gap-3 md:h-full">
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-1.5">
            <DollarSignIcon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.35)] group-hover:text-[#00FF41] transition-colors" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">TVL</span>
          </div>
          <span className="text-sm font-bold text-white font-mono tracking-tight">
            ${formatNumber(combinedTvl)}
          </span>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)]" />

        <div className="flex flex-col gap-1.5 group">
          <div className="flex items-center gap-1.5">
            <ShieldIcon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.35)] group-hover:text-[#00FF41] transition-colors" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Shielded</span>
          </div>
          <div className="flex gap-0.5 h-1.5 w-full rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)]">
            <div
              className="bg-[#00FF41] opacity-60 transition-all duration-500"
              style={{ width: `${ethPercent.toFixed(1)}%` }}
            />
            <div
              className="bg-[rgba(255,255,255,0.2)] transition-all duration-500"
              style={{ width: `${(100 - ethPercent).toFixed(1)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[rgba(255,255,255,0.4)]">
            <span className="flex items-center gap-0.5"><TokenIcon symbol={nativeSymbol} size={11} /> {formatNumber(shieldedEth, 4)}</span>
            <span className="flex items-center gap-0.5"><USDCIcon size={11} /> {formatNumber(shieldedUsdc, 0)}</span>
          </div>
          <span className="text-[9px] font-mono text-[rgba(255,255,255,0.25)]">
            {noteCount} note{noteCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)]" />

        <div className="flex flex-col gap-1 group">
          <div className="flex items-center gap-1.5">
            <BarChart3Icon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.35)] group-hover:text-[#00FF41] transition-colors" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Oracle</span>
            {isGenericAdapter ? (
              <span className="text-[8px] font-mono px-1 py-px rounded-sm leading-tight text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.04)]">
                DEX
              </span>
            ) : priceSource ? (
              <span className={`text-[8px] font-mono px-1 py-px rounded-sm leading-tight ${priceSource === 'chainlink' ? 'text-[#00FF41] bg-[rgba(0,255,65,0.08)]' : 'text-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.04)]'}`}>
                {priceSource === 'chainlink' ? 'CHAINLINK' : 'POOL'}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 text-xs font-mono font-bold text-white">
            <span className="text-[rgba(255,255,255,0.5)]">1</span>
            <TokenIcon symbol={nativeSymbol} size={12} />
            <span className="text-[rgba(255,255,255,0.35)]">=</span>
            <span>{currentPrice != null ? formatNumber(currentPrice, 2) : '\u2014'}</span>
            <USDCIcon size={12} />
          </div>
          {isGenericAdapter ? (
            <span className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono">
              via PunchSwap V2
            </span>
          ) : poolTick !== undefined ? (
            <span className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono">
              tick {poolTick}
            </span>
          ) : null}
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)]" />

        <div className="flex flex-col gap-1.5 group">
          <div className="flex items-center gap-1.5">
            <DatabaseIcon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.35)] group-hover:text-[#00FF41] transition-colors" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Pool Info</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {isGenericAdapter ? (
              <>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-[rgba(255,255,255,0.35)]">DEX</span>
                  <span className="text-[rgba(255,255,255,0.6)]">PunchSwap V2</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-[rgba(255,255,255,0.35)]">Pair</span>
                  <span className="text-[rgba(255,255,255,0.6)]">{nativeSymbol}/USDC</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-[rgba(255,255,255,0.35)]">Fee tier</span>
                <span className="text-[rgba(255,255,255,0.6)]">0.05%</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-[rgba(255,255,255,0.35)]">Relayer</span>
              <span className="text-[rgba(255,255,255,0.6)]">2%</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-[rgba(255,255,255,0.35)]">Proof</span>
              <span className="text-[rgba(255,255,255,0.6)]">FFLONK</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-[rgba(255,255,255,0.35)]">Tree</span>
              <span className="text-[rgba(255,255,255,0.6)]">depth 20</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)]" />

        <div className="flex flex-col gap-1.5 group">
          <div className="flex items-center gap-1.5">
            <LayersIcon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.35)] group-hover:text-[#00FF41] transition-colors" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Capacity</span>
          </div>
          <div className="flex gap-0.5 h-1 w-full rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)]">
            <div
              className="bg-[#00FF41] opacity-60 transition-all duration-500"
              style={{ width: `${Math.max((noteCount / 1_048_576) * 100, 0.1)}%` }}
            />
          </div>
          <span className="text-[9px] text-[rgba(255,255,255,0.25)] font-mono">
            {noteCount.toLocaleString()} / 1.05M slots
          </span>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)]" />

        <div className="flex flex-col gap-1 group">
          <div className="flex items-center gap-1.5">
            <ActivityIcon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.35)] group-hover:text-[#00FF41] transition-colors" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Liquidity</span>
          </div>
          <span className="text-xs font-bold text-white font-mono">
            {isGenericAdapter
              ? (combinedTvl > 0 ? `$${formatNumber(combinedTvl, 0)}` : 'PunchSwap V2')
              : (liquidity != null && liquidity > 0n ? formatNumber(Number(liquidity)) : '\u2014')}
          </span>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.04)]" />

        <div className="flex flex-col gap-1.5 group">
          <div className="flex items-center gap-1.5">
            <GlobeIcon className="w-3.5 h-3.5 text-[rgba(255,255,255,0.35)] group-hover:text-[#00FF41] transition-colors" />
            <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">Networks</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
              <span className="text-[10px] text-[rgba(255,255,255,0.6)] font-mono">Flow EVM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41]" />
              <span className="text-[10px] text-[rgba(255,255,255,0.6)] font-mono">Eth Sepolia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.2)]" />
              <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono">Thanos Sepolia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
