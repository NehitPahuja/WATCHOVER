import { Ratelimit } from '@upstash/ratelimit'
import { createRedis } from './redis'

/**
 * Rate limiter configurations for different API tiers.
 * Uses Upstash's sliding window algorithm.
 */

/** Standard API rate limit — 60 requests per minute */
export function createApiRateLimiter() {
  return new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    analytics: true,
    prefix: 'ratelimit:api',
  })
}

/** Stricter rate limit for write operations — 20 per minute */
export function createWriteRateLimiter() {
  return new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    analytics: true,
    prefix: 'ratelimit:write',
  })
}

/** WebSocket connection limit — 5 connections per 10 seconds */
export function createWsRateLimiter() {
  return new Ratelimit({
    redis: createRedis(),
    limiter: Ratelimit.slidingWindow(5, '10 s'),
    analytics: true,
    prefix: 'ratelimit:ws',
  })
}

/**
 * Check rate limit and return result.
 * Usage in API handlers:
 *
 *   const limiter = createApiRateLimiter()
 *   const { success, remaining } = await checkRateLimit(limiter, userId)
 *   if (!success) return new Response('Too Many Requests', { status: 429 })
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}
