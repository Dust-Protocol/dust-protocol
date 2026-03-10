'use client'

import { ETHIcon, USDCIcon } from '@/components/stealth/icons'

interface PoolCompositionProps {
  ethReserve: number
  usdcReserve: number
  shieldedEth: number
  shieldedUsdc: number
  currentPrice: number | null
}

export function formatReserve(value: number, isUsdc: boolean): string {
  if (!isFinite(value) || isNaN(value)) return '\u2014'
  if (isUsdc) {
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
    return value.toFixed(0)
  }
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  if (value < 0.01 && value > 0) return value.toFixed(4)
  return value.toFixed(2)
}

export function PoolComposition({ ethReserve, usdcReserve, shieldedEth, shieldedUsdc, currentPrice }: PoolCompositionProps) {
  const totalEth = Math.max(0, ethReserve) + Math.max(0, shieldedEth)
  const totalUsdc = Math.max(0, usdcReserve) + Math.max(0, shieldedUsdc)

  const ethUsdValue = currentPrice !== null ? totalEth * currentPrice : 0
  const totalUsd = currentPrice !== null ? ethUsdValue + totalUsdc : 0
  const ethPct = totalUsd > 0 ? Math.round((ethUsdValue / totalUsd) * 100) : 50
  const usdcPct = 100 - ethPct

  return (
    <div className="w-full md:w-[180px] md:h-full">
      <div className="p-3 rounded-sm border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm flex flex-col md:h-full">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
          <span className="text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider font-mono">
            Pool
          </span>
        </div>

        <div className="hidden md:flex flex-1 flex-col items-center gap-2">
          <div className="relative w-7 flex-1 min-h-[100px] rounded-full overflow-hidden bg-[rgba(255,255,255,0.05)] flex flex-col-reverse">
            <div
              className="w-full bg-[#00FF41] opacity-60 transition-all duration-700 ease-out"
              style={{ height: `${ethPct}%` }}
            />
            <div className="w-full h-[2px] bg-[#06080F] z-10 shrink-0" />
            <div
              className="w-full bg-[rgba(255,255,255,0.2)] transition-all duration-700 ease-out"
              style={{ height: `${usdcPct}%` }}
            />
          </div>
        </div>

        <div className="md:hidden flex flex-col gap-2 w-full">
          <div className="flex gap-0.5 h-2.5 w-full rounded-full overflow-hidden bg-[rgba(255,255,255,0.05)]">
            <div
              className="bg-[#00FF41] opacity-60 transition-all duration-700 ease-out rounded-l-full"
              style={{ width: `${ethPct}%` }}
            />
            <div
              className="bg-[rgba(255,255,255,0.2)] transition-all duration-700 ease-out rounded-r-full"
              style={{ width: `${usdcPct}%` }}
            />
          </div>
        </div>

        <div className="flex md:flex-col gap-3 md:gap-2 mt-3 font-mono w-full">
          <div className="flex items-center gap-1.5 w-full">
            <span className="w-3 h-2 rounded-[2px] bg-[#00FF41] opacity-60 shrink-0" />
            <ETHIcon size={14} />
            <span className="text-[13px] text-white font-bold">
              {formatReserve(totalEth, false)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <span className="w-3 h-2 rounded-[2px] bg-[rgba(255,255,255,0.2)] shrink-0" />
            <USDCIcon size={14} />
            <span className="text-[13px] text-white font-bold">
              {formatReserve(totalUsdc, true)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
