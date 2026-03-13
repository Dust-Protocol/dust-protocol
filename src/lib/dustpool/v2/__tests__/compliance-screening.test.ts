import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isSanctioned,
  checkSanctionsStatus,
  batchCheckSanctions,
  clearSanctionsCache,
  ChainalysisApiError,
} from '../chainalysis-api'
import {
  parseSDNXML,
  fetchOFACEthAddresses,
  clearOFACCache,
} from '../ofac-sdn-parser'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Error ${status}`,
    json: () => Promise.resolve(null),
    text: () => Promise.resolve(body),
  } as Response
}

beforeEach(() => {
  vi.useFakeTimers()
  clearSanctionsCache()
  clearOFACCache()
  mockFetch.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Chainalysis API ────────────────────────────────────────────────────────────

describe('chainalysis-api', () => {
  describe('isSanctioned', () => {
    it('returns false for clean address', async () => {
      // #given
      mockFetch.mockResolvedValueOnce(jsonResponse({ identifications: [] }))

      // #when
      const result = await isSanctioned('0xCleanAddress')

      // #then
      expect(result).toBe(false)
    })

    it('returns true for sanctioned address', async () => {
      // #given
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          identifications: [
            {
              category: 'sanctions',
              name: 'Tornado Cash',
              description: 'OFAC SDN',
              url: 'https://example.com',
            },
          ],
        })
      )

      // #when
      const result = await isSanctioned('0xSanctionedAddress')

      // #then
      expect(result).toBe(true)
    })
  })

  describe('checkSanctionsStatus', () => {
    it('returns full result with identifications', async () => {
      // #given
      const identifications = [
        {
          category: 'sanctions',
          name: 'Lazarus Group',
          description: 'North Korea',
          url: 'https://example.com/lazarus',
        },
      ]
      mockFetch.mockResolvedValueOnce(jsonResponse({ identifications }))

      // #when
      const result = await checkSanctionsStatus('0xBadActor')

      // #then
      expect(result.address).toBe('0xBadActor')
      expect(result.sanctioned).toBe(true)
      expect(result.identifications).toEqual(identifications)
      expect(result.checkedAt).toBeTypeOf('number')
    })
  })

  describe('batchCheckSanctions', () => {
    it('checks multiple addresses and returns map', async () => {
      // #given
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ identifications: [] }))
        .mockResolvedValueOnce(
          jsonResponse({
            identifications: [{ category: 'sanctions', name: 'Test', description: '', url: '' }],
          })
        )

      // #when — advance timers to flush the 100ms inter-request delay
      const promise = batchCheckSanctions(['0xClean', '0xDirty'])
      await vi.advanceTimersByTimeAsync(200)
      const results = await promise

      // #then
      expect(results.size).toBe(2)
      expect(results.get('0xClean')!.sanctioned).toBe(false)
      expect(results.get('0xDirty')!.sanctioned).toBe(true)
    })
  })

  describe('caching', () => {
    it('second call for same address does not hit API', async () => {
      // #given
      mockFetch.mockResolvedValueOnce(jsonResponse({ identifications: [] }))

      // #when
      await isSanctioned('0xCachedAddr')
      await isSanctioned('0xCachedAddr')

      // #then
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('clearSanctionsCache invalidates cache and forces fresh lookup', async () => {
      // #given
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ identifications: [] }))
        .mockResolvedValueOnce(jsonResponse({ identifications: [] }))

      // #when
      await isSanctioned('0xAddr')
      clearSanctionsCache()
      await isSanctioned('0xAddr')

      // #then
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    it('retries on 500 errors then succeeds', async () => {
      // #given — first call fails, second succeeds
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ error: 'server' }, 500))
        .mockResolvedValueOnce(jsonResponse({ identifications: [] }))

      // #when
      const promise = isSanctioned('0xRetryAddr')
      // Advance past retry delay (1s base * 2^0 = 1000ms)
      await vi.advanceTimersByTimeAsync(1500)
      const result = await promise

      // #then
      expect(result).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws ChainalysisApiError on 400 errors without retry', async () => {
      // #given
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'bad request' }, 400))

      // #when / #then
      await expect(isSanctioned('0xBadRequest')).rejects.toThrow(ChainalysisApiError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})

// ─── OFAC SDN Parser ────────────────────────────────────────────────────────────

describe('ofac-sdn-parser', () => {
  describe('parseSDNXML', () => {
    it('extracts ETH addresses from XML', () => {
      // #given
      const xml = `
        <sdnList>
          <sdnEntry>
            <uid>12345</uid>
            <firstName>John</firstName>
            <lastName>Doe</lastName>
            <id>
              <idType>Digital Currency Address - ETH</idType>
              <idNumber>0x1234567890abcdef1234567890abcdef12345678</idNumber>
            </id>
          </sdnEntry>
        </sdnList>
      `

      // #when
      const result = parseSDNXML(xml)

      // #then
      expect(result).toHaveLength(1)
      expect(result[0].address).toBe('0x1234567890abcdef1234567890abcdef12345678')
      expect(result[0].currency).toBe('ETH')
      expect(result[0].name).toBe('John Doe')
      expect(result[0].sdnId).toBe('12345')
    })

    it('handles empty XML with no entries', () => {
      // #given
      const xml = '<sdnList></sdnList>'

      // #when
      const result = parseSDNXML(xml)

      // #then
      expect(result).toHaveLength(0)
    })

    it('extracts multiple currency types from a single entry', () => {
      // #given
      const xml = `
        <sdnList>
          <sdnEntry>
            <uid>99999</uid>
            <lastName>Lazarus Group</lastName>
            <id>
              <idType>Digital Currency Address - ETH</idType>
              <idNumber>0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</idNumber>
            </id>
            <id>
              <idType>Digital Currency Address - XBT</idType>
              <idNumber>bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</idNumber>
            </id>
            <id>
              <idType>Digital Currency Address - USDT</idType>
              <idNumber>0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb</idNumber>
            </id>
          </sdnEntry>
        </sdnList>
      `

      // #when
      const result = parseSDNXML(xml)

      // #then
      expect(result).toHaveLength(3)
      expect(result[0].currency).toBe('ETH')
      expect(result[1].currency).toBe('XBT')
      expect(result[2].currency).toBe('USDT')
    })
  })

  describe('fetchOFACEthAddresses', () => {
    it('returns checksummed ETH addresses', async () => {
      // #given — valid lowercase ETH address in SDN XML
      const xml = `
        <sdnList>
          <sdnEntry>
            <uid>11111</uid>
            <lastName>Test Entity</lastName>
            <id>
              <idType>Digital Currency Address - ETH</idType>
              <idNumber>0xd8da6bf26964af9d7eed9e03e53415d37aa96045</idNumber>
            </id>
            <id>
              <idType>Digital Currency Address - XBT</idType>
              <idNumber>bc1qnoteth</idNumber>
            </id>
          </sdnEntry>
        </sdnList>
      `
      mockFetch.mockResolvedValueOnce(textResponse(xml))

      // #when
      const result = await fetchOFACEthAddresses()

      // #then — only ETH addresses, checksummed
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
    })
  })
})
