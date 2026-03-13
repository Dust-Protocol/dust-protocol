// File-based cooldown persistence that survives serverless cold starts.
// Uses /tmp/ which persists within the same Vercel function lifecycle.
//
// On first access, loads existing cooldowns from disk. All writes are
// fire-and-forget to avoid blocking API responses.

import { readFile, writeFile } from 'fs/promises'

const COOLDOWN_FILE = '/tmp/dust-v2-cooldowns.json'
// In development, allow faster retries (2s vs 10s production)
const COOLDOWN_MS = process.env.NODE_ENV === 'development' ? 2_000 : 10_000
const MAX_ENTRIES = 1000

let cooldowns: Map<string, number> = new Map()
let loaded = false

async function loadIfNeeded(): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    const data = await readFile(COOLDOWN_FILE, 'utf-8')
    const entries: [string, number][] = JSON.parse(data)
    const now = Date.now()
    cooldowns = new Map(entries.filter(([, t]) => now - t < COOLDOWN_MS))
  } catch {
    // File doesn't exist or is corrupted — start fresh
  }
}

function saveAsync(): void {
  const entries = Array.from(cooldowns.entries())
  writeFile(COOLDOWN_FILE, JSON.stringify(entries)).catch(() => {})
}

/**
 * Check if a key is within its cooldown period.
 * Returns true if the operation is allowed, false if rate-limited.
 * Records the current timestamp for the key on success.
 */
export async function checkCooldown(key: string): Promise<boolean> {
  await loadIfNeeded()
  const now = Date.now()
  // Prune expired entries when map grows too large
  if (cooldowns.size > MAX_ENTRIES) {
    for (const [k, t] of cooldowns) {
      if (now - t > COOLDOWN_MS) cooldowns.delete(k)
    }
  }
  const last = cooldowns.get(key)
  if (last && now - last < COOLDOWN_MS) return false
  cooldowns.set(key, now)
  saveAsync()
  return true
}
