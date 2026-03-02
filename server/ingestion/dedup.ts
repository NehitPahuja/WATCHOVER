/**
 * Event Deduplication Module
 *
 * Uses Redis to track recently ingested events via content hashing.
 * Prevents duplicate events from being inserted into Postgres.
 *
 * Strategy:
 *   1. Hash the event title + source URL
 *   2. Check Redis for existing hash (dedup:event:{hash})
 *   3. If found → duplicate (skip)
 *   4. If not found → store hash with TTL, proceed with ingestion
 */

import { createHash } from 'crypto'
import { createRedis, REDIS_KEYS } from '../lib/redis'

// =============================================
// Types
// =============================================

export interface RawIngestedEvent {
  title: string
  summary?: string
  sourceUrl: string
  sourceName: string
  publishedAt: string
  externalId?: string
}

// =============================================
// Hash Function
// =============================================

/**
 * Generate a deduplication hash for an event.
 * Uses normalized title + source URL for uniqueness.
 */
export function generateEventHash(event: RawIngestedEvent): string {
  const normalizedTitle = event.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Use external ID if available (most reliable), otherwise title + source
  const input = event.externalId
    ? `${event.externalId}`
    : `${normalizedTitle}|${event.sourceUrl}`

  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

// =============================================
// Deduplication Check
// =============================================

/** Dedup TTL: 48 hours (events older than this can be re-ingested) */
const DEDUP_TTL = 48 * 60 * 60 // 48 hours in seconds

/**
 * Check if an event is a duplicate.
 * Returns true if the event was already ingested recently.
 * Stores the hash in Redis if it's new.
 */
export async function deduplicateEvent(event: RawIngestedEvent): Promise<boolean> {
  const hash = generateEventHash(event)
  const key = REDIS_KEYS.eventDedup(hash)

  try {
    const redis = createRedis()

    // Try to SET with NX (only set if not exists)
    // Returns 'OK' if set (new event), null if already exists (duplicate)
    const result = await redis.set(key, JSON.stringify({
      title: event.title.slice(0, 100),
      source: event.sourceName,
      ingestedAt: new Date().toISOString(),
    }), { ex: DEDUP_TTL, nx: true })

    // If result is null or false, the key already existed → duplicate
    return !result
  } catch {
    // Redis unavailable — fall through (allow potential duplicates rather than blocking ingestion)
    console.warn('[DEDUP] Redis unavailable, skipping dedup check')
    return false
  }
}

/**
 * Check if an event hash exists without storing it.
 * Useful for dry-run / inspection.
 */
export async function isDuplicate(event: RawIngestedEvent): Promise<boolean> {
  const hash = generateEventHash(event)
  const key = REDIS_KEYS.eventDedup(hash)

  try {
    const redis = createRedis()
    const exists = await redis.exists(key)
    return exists === 1
  } catch {
    return false
  }
}

/**
 * Manually mark an event hash as seen.
 * Useful for pre-populating dedup from existing DB records.
 */
export async function markAsSeen(event: RawIngestedEvent): Promise<void> {
  const hash = generateEventHash(event)
  const key = REDIS_KEYS.eventDedup(hash)

  try {
    const redis = createRedis()
    await redis.set(key, JSON.stringify({
      title: event.title.slice(0, 100),
      source: event.sourceName,
      markedAt: new Date().toISOString(),
    }), { ex: DEDUP_TTL })
  } catch {
    // Redis unavailable — no-op
  }
}
