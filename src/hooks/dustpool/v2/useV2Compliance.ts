import { useState, useCallback, useMemo } from 'react'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { type Address } from 'viem'
import {
  checkDepositorCompliance,
  checkCooldownStatus,
  type ComplianceStatus,
  type CooldownStatus,
} from '@/lib/dustpool/v2/compliance'
import {
  checkSanctionsStatus,
  clearSanctionsCache,
} from '@/lib/dustpool/v2/chainalysis-api'

export type ScreeningSource = 'chainalysis' | 'onchain' | null

export type OverallComplianceStatus = 'compliant' | 'sanctioned' | 'checking' | 'error'

export function useV2Compliance(chainIdOverride?: number) {
  const { address } = useAccount()
  const wagmiChainId = useChainId()
  const chainId = chainIdOverride ?? wagmiChainId
  const publicClient = usePublicClient()

  const [screeningResult, setScreeningResult] = useState<ComplianceStatus | null>(null)
  const [isScreening, setIsScreening] = useState(false)
  const [cooldown, setCooldown] = useState<CooldownStatus | null>(null)
  const [screeningSource, setScreeningSource] = useState<ScreeningSource>(null)
  const [complianceStatus, setComplianceStatus] = useState<OverallComplianceStatus>('compliant')

  const screenAddress = useCallback(async (addr?: Address) => {
    const target = addr ?? address
    if (!target || !publicClient) {
      setScreeningResult({ status: 'error', reason: 'Wallet not connected' })
      setComplianceStatus('error')
      setScreeningSource(null)
      return
    }

    setIsScreening(true)
    setScreeningResult(null)
    setScreeningSource(null)
    setComplianceStatus('checking')

    try {
      // Layer 1: Chainalysis off-chain screening
      const sanctionsResult = await checkSanctionsStatus(target)
      if (sanctionsResult.sanctioned) {
        setScreeningResult({ status: 'blocked', reason: 'Address flagged by Chainalysis sanctions screening' })
        setScreeningSource('chainalysis')
        setComplianceStatus('sanctioned')
        return
      }

      // Layer 2: On-chain compliance oracle
      const result = await checkDepositorCompliance(publicClient, target, chainId)
      setScreeningResult(result)

      if (result.status === 'blocked') {
        setScreeningSource('onchain')
        setComplianceStatus('sanctioned')
      } else if (result.status === 'error') {
        setScreeningSource(null)
        setComplianceStatus('error')
      } else {
        setScreeningSource(null)
        setComplianceStatus('compliant')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Screening failed'
      setScreeningResult({ status: 'error', reason: msg })
      setScreeningSource(null)
      setComplianceStatus('error')
    } finally {
      setIsScreening(false)
    }
  }, [address, publicClient, chainId])

  const checkCooldown = useCallback(async (commitment: `0x${string}`) => {
    if (!publicClient) return
    const result = await checkCooldownStatus(publicClient, commitment, chainId)
    setCooldown(result)
  }, [publicClient, chainId])

  const clearScreening = useCallback(() => {
    setScreeningResult(null)
    setCooldown(null)
    setScreeningSource(null)
    setComplianceStatus('compliant')
  }, [])

  const recheckCompliance = useCallback(async (addr?: Address) => {
    clearSanctionsCache()
    await screenAddress(addr)
  }, [screenAddress])

  return useMemo(() => ({
    screenAddress,
    screeningResult,
    isScreening,
    checkCooldown,
    cooldown,
    clearScreening,
    screeningSource,
    complianceStatus,
    recheckCompliance,
  }), [screenAddress, screeningResult, isScreening, checkCooldown, cooldown, clearScreening, screeningSource, complianceStatus, recheckCompliance])
}
