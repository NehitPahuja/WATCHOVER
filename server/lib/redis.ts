import { Redis } from '@upstash/redis'

/**
 * Create an Upstash Redis client instance.
 * Works in serverless/edge environments.
 */
export function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set')
  }

  return new Redis({ url, token })
}

// =============================================
// Redis Key Patterns (from Tech Doc §2.4)
// =============================================

export const REDIS_KEYS = {
  /** Latest event IDs for a feed variant */
  feedLatest: (variant: string) => `feed:latest:${variant}`,

  /** Active counters (conflicts, tensions, aircraft, ships) */
  counters: (variant: string) => `counters:${variant}`,

  /** Latest prediction probability + sparkline */
  predictionProb: (id: string) => `prediction:prob:${id}`,

  /** Cached AI daily brief */
  aiBrief: (date: string, variant: string) => `cache:ai:brief:${date}:${variant}`,

  /** Event dedup check */
  eventDedup: (hash: string) => `dedup:event:${hash}`,

  /** Rate limit key */
  rateLimit: (identifier: string) => `ratelimit:${identifier}`,
} as const
