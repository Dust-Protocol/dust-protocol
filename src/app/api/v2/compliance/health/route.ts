import { ethers } from 'ethers'
import { NextResponse } from 'next/server'
import { DEFAULT_CHAIN_ID, getChainConfig, isChainSupported } from '@/config/chains'
import { getServerProvider } from '@/lib/server-provider'
import { getDustPoolV2Address } from '@/lib/dustpool/v2/contracts'
import { checkSanctionsStatus, ChainalysisApiError } from '@/lib/dustpool/v2/chainalysis-api'
import { getExclusionRoot, getFlaggedCount } from '@/lib/dustpool/v2/exclusion-tree'

type CheckStatus = 'up' | 'down'
type OverallStatus = 'healthy' | 'degraded' | 'unhealthy'

interface ChainalysisCheck {
  status: CheckStatus
  latencyMs: number
  lastCheck: string
}

interface OnChainOracleCheck {
  status: CheckStatus
  address: string
  type: 'OFACSanctionsRegistry' | 'TestnetComplianceOracle' | 'ChainalysisScreener' | 'none'
}

interface ExclusionTreeCheck {
  status: CheckStatus
  rootHash: string
  sanctionedCount: number
}

interface ComplianceVerifierCheck {
  status: CheckStatus
  address: string
}

interface HealthResponse {
  status: OverallStatus
  checks: {
    chainalysisApi: ChainalysisCheck
    onChainOracle: OnChainOracleCheck
    exclusionTree: ExclusionTreeCheck
    complianceVerifier: ComplianceVerifierCheck
  }
  chainId: number
  timestamp: string
}

const COMPLIANCE_ORACLE_ABI = [
  'function isBlocked(address account) view returns (bool)',
  'function complianceOracle() view returns (address)',
]

const CACHE_TTL_MS = 30_000
const KNOWN_CLEAN_ADDRESS = '0x0000000000000000000000000000000000000001'

let cachedResponse: { data: HealthResponse; expiresAt: number } | null = null

function deriveOverallStatus(chainalysisUp: boolean, oracleUp: boolean): OverallStatus {
  if (chainalysisUp && oracleUp) return 'healthy'
  if (chainalysisUp || oracleUp) return 'degraded'
  return 'unhealthy'
}

async function checkChainalysisApi(): Promise<ChainalysisCheck> {
  const start = Date.now()
  try {
    await checkSanctionsStatus(KNOWN_CLEAN_ADDRESS)
    return {
      status: 'up',
      latencyMs: Date.now() - start,
      lastCheck: new Date().toISOString(),
    }
  } catch (e) {
    const latency = Date.now() - start
    if (e instanceof ChainalysisApiError) {
      console.warn(`[compliance/health] Chainalysis API returned ${e.status}`)
    }
    return {
      status: 'down',
      latencyMs: latency,
      lastCheck: new Date().toISOString(),
    }
  }
}

async function checkOnChainOracle(chainId: number): Promise<OnChainOracleCheck> {
  const poolAddress = getDustPoolV2Address(chainId)
  if (!poolAddress) {
    return { status: 'down', address: ethers.constants.AddressZero, type: 'none' }
  }

  const provider = getServerProvider(chainId)
  const pool = new ethers.Contract(poolAddress, COMPLIANCE_ORACLE_ABI, provider)

  try {
    const oracleAddress: string = await pool.complianceOracle()

    if (oracleAddress === ethers.constants.AddressZero) {
      return { status: 'up', address: oracleAddress, type: 'none' }
    }

    const oracleAbi = ['function isBlocked(address account) view returns (bool)']
    const oracle = new ethers.Contract(oracleAddress, oracleAbi, provider)
    await oracle.isBlocked(ethers.constants.AddressZero)

    const config = getChainConfig(chainId)
    const oracleType = config.testnet ? 'TestnetComplianceOracle' : 'ChainalysisScreener'

    return { status: 'up', address: oracleAddress, type: oracleType }
  } catch (e) {
    console.warn(`[compliance/health] On-chain oracle check failed:`, e instanceof Error ? e.message : e)
    return { status: 'down', address: poolAddress, type: 'none' }
  }
}

async function checkExclusionTree(chainId: number): Promise<ExclusionTreeCheck> {
  try {
    const [root, count] = await Promise.all([
      getExclusionRoot(chainId),
      getFlaggedCount(chainId),
    ])
    return {
      status: 'up',
      rootHash: '0x' + root.toString(16).padStart(64, '0'),
      sanctionedCount: count,
    }
  } catch (e) {
    console.warn(`[compliance/health] Exclusion tree check failed:`, e instanceof Error ? e.message : e)
    return {
      status: 'down',
      rootHash: '0x' + '0'.repeat(64),
      sanctionedCount: 0,
    }
  }
}

function checkComplianceVerifier(chainId: number): ComplianceVerifierCheck {
  const config = getChainConfig(chainId)
  const address = config.contracts.dustPoolV2ComplianceVerifier
  if (!address) {
    return { status: 'down', address: ethers.constants.AddressZero }
  }
  return { status: 'up', address }
}

export async function GET(req: Request): Promise<NextResponse<HealthResponse | { error: string }>> {
  try {
    const url = new URL(req.url)
    const chainId = Number(url.searchParams.get('chainId') ?? DEFAULT_CHAIN_ID)

    if (!isChainSupported(chainId)) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}` },
        { status: 400 },
      )
    }

    if (cachedResponse && Date.now() < cachedResponse.expiresAt) {
      if (cachedResponse.data.chainId === chainId) {
        return NextResponse.json(cachedResponse.data)
      }
    }

    const [chainalysis, oracle, exclusionTree] = await Promise.all([
      checkChainalysisApi(),
      checkOnChainOracle(chainId),
      checkExclusionTree(chainId),
    ])

    const complianceVerifier = checkComplianceVerifier(chainId)

    const chainalysisUp = chainalysis.status === 'up'
    const oracleUp = oracle.status === 'up'

    const response: HealthResponse = {
      status: deriveOverallStatus(chainalysisUp, oracleUp),
      checks: {
        chainalysisApi: chainalysis,
        onChainOracle: oracle,
        exclusionTree,
        complianceVerifier,
      },
      chainId,
      timestamp: new Date().toISOString(),
    }

    cachedResponse = { data: response, expiresAt: Date.now() + CACHE_TTL_MS }

    return NextResponse.json(response)
  } catch (e) {
    console.error('[V2/compliance/health] GET error:', e)
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 },
    )
  }
}
