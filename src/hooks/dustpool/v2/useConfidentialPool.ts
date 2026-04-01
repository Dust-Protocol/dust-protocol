import { useState, useCallback, useRef, useMemo } from 'react'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { publicActions, type Address, parseEther } from 'viem'
import { getChainConfig } from '@/config/chains'
import {
  checkFHECompliance,
  isFHEComplianceEnabled,
  encryptUint64,
  getFHEConfig,
} from '@/lib/dustpool/v2/fhe/fhe-compliance'

const CONFIDENTIAL_DUST_POOL_ABI = [
  { name: 'deposit', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'encryptedAmount', type: 'bytes32' }, { name: 'inputProof', type: 'bytes' }], outputs: [] },
  { name: 'registerComplianceResult', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'requestId', type: 'uint256' }], outputs: [] },
  { name: 'confidentialBalanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'confidentialPoolTotal', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'compliancePassed', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'depositorCount', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
] as const

type ComplianceStatus = 'unknown' | 'checking' | 'passed' | 'failed'

export function useConfidentialPool(chainIdOverride?: number) {
  const { address, isConnected } = useAccount()
  const wagmiChainId = useChainId()
  const chainId = chainIdOverride ?? wagmiChainId
  const publicClient = usePublicClient({ chainId })
  const { data: walletClient } = useWalletClient()

  const [isPending, setIsPending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus>('unknown')
  const [balanceHandle, setBalanceHandle] = useState<string | null>(null)
  const [depositorCount, setDepositorCount] = useState<bigint>(0n)
  const [isPoolPaused, setIsPoolPaused] = useState(false)
  const operatingRef = useRef(false)

  const getPoolAddress = useCallback((): Address | null => {
    try {
      const config = getChainConfig(chainId)
      return config.contracts.confidentialDustPool as Address | null
    } catch {
      return null
    }
  }, [chainId])

  const clearError = useCallback(() => {
    setError(null)
    setTxHash(null)
  }, [])

  const checkCompliance = useCallback(async () => {
    if (!isConnected || !address) { setError('Wallet not connected'); return }
    if (!walletClient) { setError('Wallet client not available'); return }
    if (operatingRef.current) return

    const poolAddress = getPoolAddress()
    if (!poolAddress) { setError(`ConfidentialDustPool not deployed on chain ${chainId}`); return }

    if (!isFHEComplianceEnabled()) {
      setError('FHE compliance is not enabled for this chain')
      return
    }

    operatingRef.current = true
    setIsPending(true)
    setError(null)
    setTxHash(null)
    setComplianceStatus('checking')

    try {
      const result = await checkFHECompliance(address, walletClient, (status) => {
        if (status.status === 'resolved') {
          setComplianceStatus(status.isBlocked ? 'failed' : 'passed')
        }
      })

      if (result.isBlocked) {
        setComplianceStatus('failed')
        setError('Address failed compliance screening')
        return
      }

      // Register compliance result on the pool contract
      const walletPublic = walletClient.extend(publicActions)
      const regHash = await walletClient.writeContract({
        address: poolAddress,
        abi: CONFIDENTIAL_DUST_POOL_ABI,
        functionName: 'registerComplianceResult',
        args: [result.requestId],
      })

      const receipt = await walletPublic.waitForTransactionReceipt({ hash: regHash })
      if (receipt.status === 'reverted') {
        throw new Error('registerComplianceResult transaction reverted')
      }

      setTxHash(regHash)
      setComplianceStatus('passed')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Compliance check failed'
      if (msg.toLowerCase().includes('rejected')) {
        setError('Transaction rejected by user')
      } else {
        setError(msg)
      }
      if (complianceStatus === 'checking') {
        setComplianceStatus('failed')
      }
    } finally {
      setIsPending(false)
      operatingRef.current = false
    }
  }, [isConnected, address, walletClient, chainId, getPoolAddress, complianceStatus])

  const deposit = useCallback(async (amountEth: string) => {
    if (!isConnected || !address) { setError('Wallet not connected'); return }
    if (!walletClient) { setError('Wallet client not available'); return }
    if (operatingRef.current) return

    const poolAddress = getPoolAddress()
    if (!poolAddress) { setError(`ConfidentialDustPool not deployed on chain ${chainId}`); return }

    const value = parseEther(amountEth)
    if (value <= 0n) { setError('Amount must be positive'); return }

    operatingRef.current = true
    setIsPending(true)
    setError(null)
    setTxHash(null)

    try {
      const hash = await walletClient.writeContract({
        address: poolAddress,
        abi: CONFIDENTIAL_DUST_POOL_ABI,
        functionName: 'deposit',
        args: [],
        value,
      })

      const walletPublic = walletClient.extend(publicActions)
      const receipt = await walletPublic.waitForTransactionReceipt({ hash })
      if (receipt.status === 'reverted') {
        throw new Error('Deposit transaction reverted')
      }

      setTxHash(hash)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Deposit failed'
      if (msg.toLowerCase().includes('rejected')) {
        setError('Transaction rejected by user')
      } else {
        setError(msg)
      }
    } finally {
      setIsPending(false)
      operatingRef.current = false
    }
  }, [isConnected, address, walletClient, chainId, getPoolAddress])

  const requestWithdrawal = useCallback(async (amountWei: bigint) => {
    if (!isConnected || !address) { setError('Wallet not connected'); return }
    if (!walletClient) { setError('Wallet client not available'); return }
    if (operatingRef.current) return

    const poolAddress = getPoolAddress()
    if (!poolAddress) { setError(`ConfidentialDustPool not deployed on chain ${chainId}`); return }

    if (amountWei <= 0n) { setError('Amount must be positive'); return }

    operatingRef.current = true
    setIsPending(true)
    setError(null)
    setTxHash(null)

    try {
      const config = getFHEConfig()
      const { handle, inputProof } = await encryptUint64(
        config.confidentialDustPoolAddress,
        address,
        amountWei,
      )

      const handleHex = `0x${Buffer.from(handle).toString('hex')}` as `0x${string}`
      const proofHex = `0x${Buffer.from(inputProof).toString('hex')}` as `0x${string}`

      const hash = await walletClient.writeContract({
        address: poolAddress,
        abi: CONFIDENTIAL_DUST_POOL_ABI,
        functionName: 'withdraw',
        args: [handleHex, proofHex],
      })

      const walletPublic = walletClient.extend(publicActions)
      const receipt = await walletPublic.waitForTransactionReceipt({ hash })
      if (receipt.status === 'reverted') {
        throw new Error('Withdrawal transaction reverted')
      }

      setTxHash(hash)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Withdrawal failed'
      if (msg.toLowerCase().includes('rejected')) {
        setError('Transaction rejected by user')
      } else {
        setError(msg)
      }
    } finally {
      setIsPending(false)
      operatingRef.current = false
    }
  }, [isConnected, address, walletClient, chainId, getPoolAddress])

  const refreshBalance = useCallback(async () => {
    if (!address || !publicClient) return

    const poolAddress = getPoolAddress()
    if (!poolAddress) return

    try {
      const result = await publicClient.readContract({
        address: poolAddress,
        abi: CONFIDENTIAL_DUST_POOL_ABI,
        functionName: 'confidentialBalanceOf',
        args: [address],
      })
      // euint64 handle returned as uint256 — store as hex
      setBalanceHandle(`0x${(result as bigint).toString(16).padStart(64, '0')}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to read balance'
      setError(msg)
    }
  }, [address, publicClient, getPoolAddress])

  const refreshPoolInfo = useCallback(async () => {
    if (!publicClient) return

    const poolAddress = getPoolAddress()
    if (!poolAddress) return

    try {
      const [count, paused] = await Promise.all([
        publicClient.readContract({
          address: poolAddress,
          abi: CONFIDENTIAL_DUST_POOL_ABI,
          functionName: 'depositorCount',
        }) as Promise<bigint>,
        publicClient.readContract({
          address: poolAddress,
          abi: CONFIDENTIAL_DUST_POOL_ABI,
          functionName: 'paused',
        }) as Promise<boolean>,
      ])
      setDepositorCount(count)
      setIsPoolPaused(paused)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to read pool info'
      setError(msg)
    }
  }, [publicClient, getPoolAddress])

  return useMemo(() => ({
    deposit,
    requestWithdrawal,
    checkCompliance,
    refreshBalance,
    refreshPoolInfo,
    isPending,
    txHash,
    error,
    clearError,
    complianceStatus,
    balanceHandle,
    depositorCount,
    isPoolPaused,
  }), [
    deposit,
    requestWithdrawal,
    checkCompliance,
    refreshBalance,
    refreshPoolInfo,
    isPending,
    txHash,
    error,
    clearError,
    complianceStatus,
    balanceHandle,
    depositorCount,
    isPoolPaused,
  ])
}
