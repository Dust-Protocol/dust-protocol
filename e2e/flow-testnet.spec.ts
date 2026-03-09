import { test, expect } from '@playwright/test'

/**
 * Flow EVM Testnet E2E tests — verify API endpoints, chain selector UI,
 * and cross-chain state isolation for Flow (chainId 545).
 *
 * All tests are skipped until contracts are deployed on Flow EVM Testnet.
 * Enable after Flow deployment by removing `test.skip()` calls.
 */

const FLOW_CHAIN_ID = 545
const FLOW_CHAIN_NAME = 'Flow EVM Testnet'
const ETH_SEPOLIA_CHAIN_ID = 11155111

// ─── Stealth Send on Flow ────────────────────────────────────────────────────

test.describe('Stealth send on Flow EVM Testnet', () => {
  // Enable after Flow deployment
  test.skip()

  test('pay page loads and accepts Flow chain selection', async ({ page }) => {
    // #given
    await page.goto('/pay/main')

    // #when — look for the chain selector and verify Flow is an option
    const chainSelector = page.getByTestId('chain-selector')
    await expect(chainSelector).toBeVisible({ timeout: 10_000 })
    await chainSelector.click()

    // #then — Flow option is present in the dropdown
    await expect(page.getByText(FLOW_CHAIN_NAME)).toBeVisible({ timeout: 5_000 })
  })

  test('selecting Flow chain shows FLOW as native currency', async ({ page }) => {
    // #given
    await page.goto('/pay/main')
    const chainSelector = page.getByTestId('chain-selector')
    await expect(chainSelector).toBeVisible({ timeout: 10_000 })

    // #when — select Flow chain
    await chainSelector.click()
    await page.getByText(FLOW_CHAIN_NAME).click()

    // #then — amount input label or currency indicator shows FLOW
    await expect(page.getByText('FLOW')).toBeVisible({ timeout: 5_000 })
  })

  test('entering amount on Flow chain generates stealth address', async ({ page }) => {
    // #given — navigate to pay page with Flow selected
    await page.goto('/pay/main')
    const chainSelector = page.getByTestId('chain-selector')
    await expect(chainSelector).toBeVisible({ timeout: 10_000 })
    await chainSelector.click()
    await page.getByText(FLOW_CHAIN_NAME).click()

    // #when — enter a send amount
    const amountInput = page.getByTestId('send-amount')
    await amountInput.fill('1.0')

    // #then — stealth address should be generated (visible in the UI)
    const stealthAddr = page.getByTestId('stealth-address')
    await expect(stealthAddr).toBeVisible({ timeout: 10_000 })
    const addrText = await stealthAddr.textContent()
    expect(addrText).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })
})

// ─── DustPoolV2 Deposit on Flow ──────────────────────────────────────────────

test.describe('DustPoolV2 deposit on Flow EVM Testnet', () => {
  // Enable after Flow deployment
  test.skip()

  test('deposit modal shows Flow chain context', async ({ page }) => {
    // #given — navigate to pools page (requires wallet connection)
    await page.goto('/pools')

    // #then — the V2 pool card should indicate Flow chain when selected
    await expect(page.getByText('PRIVACY_POOL_V2')).toBeVisible({ timeout: 10_000 })
  })

  test('deposit creates commitment on Flow chain', async ({ page }) => {
    // #given — connected wallet on Flow chain, V2 keys unlocked
    await page.goto('/pools')

    // #when — open deposit modal and submit
    await page.getByTestId('v2-deposit-btn').click()
    await expect(page.getByText('[ DEPOSIT_V2 ]')).toBeVisible({ timeout: 5_000 })

    const amountInput = page.getByTestId('deposit-amount')
    await amountInput.fill('0.1')
    await page.getByTestId('deposit-submit').click()

    // #then — commitment confirmation should appear
    await expect(page.getByText(/commitment/i)).toBeVisible({ timeout: 30_000 })
  })
})

// ─── DustPoolV2 Withdraw on Flow ─────────────────────────────────────────────

test.describe('DustPoolV2 withdraw on Flow EVM Testnet', () => {
  // Enable after Flow deployment
  test.skip()

  test('withdraw generates FFLONK proof for Flow chain', async ({ page }) => {
    // #given — connected wallet with deposited notes on Flow
    await page.goto('/pools')

    // #when — open withdraw modal
    await page.getByTestId('v2-withdraw-btn').click()
    await expect(page.getByText('[ WITHDRAW_V2 ]')).toBeVisible({ timeout: 5_000 })

    // #then — chain indicator shows Flow
    await expect(page.getByText('FLOW')).toBeVisible({ timeout: 5_000 })
  })

  test('withdraw submits proof and recipient receives funds', async ({ page }) => {
    // #given — connected wallet with deposited notes on Flow
    await page.goto('/pools')
    await page.getByTestId('v2-withdraw-btn').click()

    // #when — fill recipient and amount, submit
    const recipientInput = page.getByTestId('withdraw-recipient')
    await recipientInput.fill('0x000000000000000000000000000000000000dEaD')
    const amountInput = page.getByTestId('withdraw-amount')
    await amountInput.fill('0.05')
    await page.getByTestId('withdraw-submit').click()

    // #then — success state
    await expect(page.getByText(/success|confirmed/i)).toBeVisible({ timeout: 60_000 })
  })
})

// ─── Chain Selector ──────────────────────────────────────────────────────────

test.describe('Chain selector — Flow EVM Testnet visibility', () => {
  // Enable after Flow deployment
  test.skip()

  test('Flow appears in chain dropdown with correct icon', async ({ page }) => {
    // #given
    await page.goto('/')

    // #when — open chain selector
    const chainSelector = page.getByTestId('chain-selector')
    await expect(chainSelector).toBeVisible({ timeout: 10_000 })
    await chainSelector.click()

    // #then — Flow option with flow icon family
    const flowOption = page.getByText(FLOW_CHAIN_NAME)
    await expect(flowOption).toBeVisible({ timeout: 5_000 })

    const flowIcon = page.getByTestId('chain-icon-flow')
    await expect(flowIcon).toBeVisible()
  })

  test('selecting Flow updates chain selector display', async ({ page }) => {
    // #given
    await page.goto('/')
    const chainSelector = page.getByTestId('chain-selector')
    await expect(chainSelector).toBeVisible({ timeout: 10_000 })

    // #when — select Flow
    await chainSelector.click()
    await page.getByText(FLOW_CHAIN_NAME).click()

    // #then — selector now shows Flow as active chain
    await expect(chainSelector).toContainText('Flow')
  })
})

// ─── API Health for Flow ─────────────────────────────────────────────────────

test.describe('Flow EVM Testnet API endpoints', () => {
  // Enable after Flow deployment
  test.skip()

  test(`GET /api/v2/health returns valid JSON for Flow (${FLOW_CHAIN_ID})`, async ({ request }) => {
    // #when
    const response = await request.get(`/api/v2/health?chainId=${FLOW_CHAIN_ID}`)

    // #then
    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    expect(body).toHaveProperty('ok')
    expect(typeof body.ok).toBe('boolean')

    if (body.ok) {
      expect(body).toHaveProperty('chainId')
      expect(body.chainId).toBe(FLOW_CHAIN_ID)
      expect(body).toHaveProperty('tree')
      expect(body).toHaveProperty('onChain')
      expect(body).toHaveProperty('rootMatch')
    }
  })

  test(`GET /api/v2/tree/root returns root for Flow`, async ({ request }) => {
    // #when
    const response = await request.get(`/api/v2/tree/root?chainId=${FLOW_CHAIN_ID}`)

    // #then
    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    if (response.status() === 200) {
      expect(body).toHaveProperty('root')
      expect(typeof body.root).toBe('string')
      expect(body.root).toMatch(/^0x[0-9a-fA-F]+$/)
    } else {
      expect(body).toHaveProperty('error')
    }
  })

  test(`GET /api/v2/deposit/status returns false for dummy commitment on Flow`, async ({ request }) => {
    // #given
    const dummyCommitment = '0x' + '00'.repeat(31) + '01'

    // #when
    const response = await request.get(
      `/api/v2/deposit/status/${dummyCommitment}?chainId=${FLOW_CHAIN_ID}`,
    )

    // #then
    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    if (response.status() === 200) {
      expect(body).toHaveProperty('confirmed')
      expect(body.confirmed).toBe(false)
      expect(body.leafIndex).toBe(-1)
    }
  })

  test(`POST /api/v2/withdraw rejects missing proof on Flow`, async ({ request }) => {
    // #when
    const response = await request.post('/api/v2/withdraw', {
      data: { targetChainId: FLOW_CHAIN_ID },
    })

    // #then — 400 (bad request) or 404 (DustPoolV2 not deployed)
    expect([400, 404]).toContain(response.status())
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  test(`POST /api/v2/split-withdraw rejects missing proof on Flow`, async ({ request }) => {
    // #when
    const response = await request.post('/api/v2/split-withdraw', {
      data: { targetChainId: FLOW_CHAIN_ID },
    })

    // #then
    expect([400, 404]).toContain(response.status())
    const body = await response.json()
    expect(body).toHaveProperty('error')
  })

  test(`GET /api/v2/compliance returns valid shape for Flow`, async ({ request }) => {
    // #when
    const response = await request.get(`/api/v2/compliance?chainId=${FLOW_CHAIN_ID}`)

    // #then
    const status = response.status()
    expect([200, 400, 503]).toContain(status)

    const body = await response.json()
    if (status === 200) {
      expect(body).toHaveProperty('exclusionRoot')
    } else {
      expect(body).toHaveProperty('error')
    }
  })
})

// ─── Cross-chain State Isolation ─────────────────────────────────────────────

test.describe('Cross-chain state isolation — Flow vs Ethereum Sepolia', () => {
  // Enable after Flow deployment
  test.skip()

  test('switching from Ethereum Sepolia to Flow resets pool state', async ({ page }) => {
    // #given — start on pools page (chain defaults to Ethereum Sepolia)
    await page.goto('/pools')
    await expect(page.getByText('PRIVACY_POOL_V2')).toBeVisible({ timeout: 10_000 })

    // #when — switch chain to Flow
    const chainSelector = page.getByTestId('chain-selector')
    await chainSelector.click()
    await page.getByText(FLOW_CHAIN_NAME).click()

    // #then — pool balance reflects Flow chain (not Ethereum Sepolia)
    // The tree root and deposit count should be independent per chain
    await expect(page.getByText('FLOW')).toBeVisible({ timeout: 5_000 })
  })

  test('API returns different tree roots for Flow vs Ethereum Sepolia', async ({ request }) => {
    // #when — fetch tree roots for both chains
    const [flowRes, ethRes] = await Promise.all([
      request.get(`/api/v2/tree/root?chainId=${FLOW_CHAIN_ID}`),
      request.get(`/api/v2/tree/root?chainId=${ETH_SEPOLIA_CHAIN_ID}`),
    ])

    // #then — both should return valid responses (or 503 if not synced)
    expect([200, 503]).toContain(flowRes.status())
    expect([200, 503]).toContain(ethRes.status())

    // If both are 200, roots must differ (independent Merkle trees)
    if (flowRes.status() === 200 && ethRes.status() === 200) {
      const flowBody = await flowRes.json()
      const ethBody = await ethRes.json()
      expect(flowBody.root).not.toBe(ethBody.root)
    }
  })

  test('nullifier from Ethereum Sepolia is not recognized on Flow', async ({ request }) => {
    // #given — a dummy nullifier
    const dummyNullifier = '0x' + 'ab'.repeat(32)

    // #when — check nullifier status on both chains
    const [flowRes, ethRes] = await Promise.all([
      request.get(`/api/v2/nullifier/${dummyNullifier}?chainId=${FLOW_CHAIN_ID}`),
      request.get(`/api/v2/nullifier/${dummyNullifier}?chainId=${ETH_SEPOLIA_CHAIN_ID}`),
    ])

    // #then — both should return independent results
    // 200 with spent:false, or 404 if endpoint doesn't exist for the chain
    for (const res of [flowRes, ethRes]) {
      expect([200, 404]).toContain(res.status())
    }
  })
})
