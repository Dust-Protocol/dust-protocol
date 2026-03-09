import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { validatePin, decryptPin, getStoredPin, hasPinStored } from '@/lib/stealth/pin'
import { STEALTH_KEY_DERIVATION_MESSAGE } from '@/lib/stealth/keys'
import { signMessage as signWithWallet } from '@/lib/providers'
import { deriveV2Keys } from '@/lib/dustpool/v2/keys'
import type { V2Keys } from '@/lib/dustpool/v2/types'

export function useV2Keys() {
  const keysRef = useRef<V2Keys | null>(null)
  const [hasKeys, setHasKeys] = useState(false)
  const [isDeriving, setIsDeriving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const hasPin = address ? hasPinStored(address) : false

  const derivingRef = useRef(false)

  const deriveKeys = useCallback(async (pin: string): Promise<boolean> => {
    if (derivingRef.current) return false
    if (!address || !walletClient) {
      setError('Wallet not connected')
      return false
    }

    const validation = validatePin(pin)
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid PIN')
      return false
    }

    derivingRef.current = true
    setIsDeriving(true)
    setError(null)

    try {
      const sig = await signWithWallet(STEALTH_KEY_DERIVATION_MESSAGE, walletClient)

      // Verify PIN against stored encrypted PIN (prevents deriving wrong keys)
      const stored = getStoredPin(address)
      if (stored) {
        const decrypted = await decryptPin(stored, sig)
        if (decrypted !== pin) {
          setError('Incorrect PIN')
          return false
        }
      }

      const keys = await deriveV2Keys(sig, pin)
      keysRef.current = keys
      setHasKeys(true)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Key derivation failed'
      if (msg.toLowerCase().includes('rejected') || msg.includes('ACTION_REJECTED')) {
        setError('Approve the signature in your wallet')
      } else if (msg.includes('decrypt') || msg.includes('OperationError')) {
        setError('Wallet signature mismatch — PIN was set with a different wallet')
      } else {
        setError(msg)
      }
      return false
    } finally {
      derivingRef.current = false
      setIsDeriving(false)
    }
  }, [address, walletClient])

  const clearKeys = useCallback(() => {
    keysRef.current = null
    setHasKeys(false)
    setError(null)
  }, [])

  // Clear keys on wallet switch or disconnect (cross-account leakage prevention)
  useEffect(() => {
    clearKeys()
  }, [address, clearKeys])

  return { keysRef, hasKeys, hasPin, isDeriving, error, deriveKeys, clearKeys }
}
