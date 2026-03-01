/**
 * Event Service — Data access + caching layer
 *
 * Queries Postgres via Drizzle, caches hot paths in Redis.
 */

import { desc, eq, and, gte, sql } from 'drizzle-orm'
import type { Database } from '../db'
import { events, eventSources } from '../db/schema'
import { createRedis, REDIS_KEYS } from '../lib/redis'

// =============================================
// Types
// =============================================

export interface EventListParams {
  severity?: 'critical' | 'high' | 'medium' | 'low'
  sentiment?: 'escalation' | 'de-escalation' | 'neutral'
  region?: string
  since?: string
  limit?: number
  cursor?: string
}

export interface EventListResult {
  data: typeof events.$inferSelect[]
  nextCursor: string | null
}

// =============================================
// List Events (paginated + filterable)
// =============================================

export async function listEvents(
  db: Database,
  params: EventListParams
): Promise<EventListResult> {
  const {
    severity,
    sentiment,
    region,
    since,
    limit = 50,
    cursor,
  } = params

  const conditions = []

  if (severity) conditions.push(eq(events.severity, severity))
  if (sentiment) conditions.push(eq(events.sentiment, sentiment))
  if (region) conditions.push(eq(events.region, region))
  if (since) conditions.push(gte(events.publishedAt, new Date(since)))
  if (cursor) conditions.push(sql`${events.publishedAt} < ${new Date(cursor)}`)

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(events)
    .where(where)
    .orderBy(desc(events.publishedAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? data[data.length - 1].publishedAt.toISOString() : null

  return { data, nextCursor }
}

// =============================================
// Get Event Detail (with sources)
// =============================================

export async function getEventDetail(
  db: Database,
  eventId: string
) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)

  if (!event) return null

  const sources = await db
    .select()
    .from(eventSources)
    .where(eq(eventSources.eventId, eventId))

  return { ...event, sources }
}

// =============================================
// Cached Feed (Redis-backed)
// =============================================

const FEED_CACHE_TTL = 30 // 30 seconds

export async function getCachedFeed(
  db: Database,
  variant: string = 'default',
  params: EventListParams = {}
): Promise<EventListResult> {
  try {
    const redis = createRedis()
    const cacheKey = REDIS_KEYS.feedLatest(variant)
    const cached = await redis.get<string>(cacheKey)

    if (cached) {
      return JSON.parse(typeof cached === 'string' ? cached : JSON.stringify(cached))
    }

    // Cache miss — query DB
    const result = await listEvents(db, params)

    // Store in cache
    await redis.set(cacheKey, JSON.stringify(result), { ex: FEED_CACHE_TTL })

    return result
  } catch {
    // Redis unavailable — fall through to DB
    return listEvents(db, params)
  }
}

// =============================================
// Invalidate Feed Cache
// =============================================

export async function invalidateFeedCache(variant: string = 'default') {
  try {
    const redis = createRedis()
    await redis.del(REDIS_KEYS.feedLatest(variant))
  } catch {
    // Redis unavailable — no-op
  }
}
