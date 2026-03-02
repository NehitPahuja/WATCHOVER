/**
 * Predictions Service — Data access + caching layer
 *
 * Handles prediction listing, detail, voting, probability calculation,
 * and Redis caching for the predictions module.
 */

import { desc, eq, and, sql, count, sum } from 'drizzle-orm'
import type { Database } from '../db'
import {
  predictions,
  predictionVotes,
  predictionSnapshots,
} from '../db/schema'
import { createRedis, REDIS_KEYS } from '../lib/redis'

// =============================================
// Types
// =============================================

export interface PredictionListParams {
  status?: 'active' | 'closed' | 'resolved'
  category?: string
  limit?: number
  cursor?: string
}

export interface PredictionListItem {
  id: string
  question: string
  description: string | null
  category: string | null
  closesAt: Date
  resolutionRules: string | null
  status: 'active' | 'closed' | 'resolved'
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
  probabilityYes: number
  totalVotes: number
  trend: 'up' | 'down' | 'stable'
  sparkline: number[]
  timeLeft: string
}

export interface PredictionListResult {
  data: PredictionListItem[]
  nextCursor: string | null
  total: number
}

export interface PredictionDetailResult extends PredictionListItem {
  history: Array<{ date: string; value: number }>
  yesVotes: number
  noVotes: number
}

export interface VoteResult {
  success: boolean
  predictionId: string
  side: 'yes' | 'no'
  weight: number
  updatedProbability: number
  totalVotes: number
}

// =============================================
// Utility: Compute time remaining
// =============================================

function computeTimeLeft(closesAt: Date): string {
  const now = Date.now()
  const diff = closesAt.getTime() - now

  if (diff <= 0) return 'Closed'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 30) return `${days}d`
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${minutes}m`
}

// =============================================
// Utility: Compute trend from snapshots
// =============================================

function computeTrend(sparkline: number[]): 'up' | 'down' | 'stable' {
  if (sparkline.length < 2) return 'stable'
  const recent = sparkline[sparkline.length - 1]
  const prior = sparkline[sparkline.length - 2]
  const delta = recent - prior
  if (delta > 1) return 'up'
  if (delta < -1) return 'down'
  return 'stable'
}

// =============================================
// Probability Calculation
// =============================================

/**
 * Compute probability using weighted ratio:
 *   P(YES) = sum(YES weights) / (sum(YES weights) + sum(NO weights))
 * Returns value 0-100.
 * If no votes, returns 50 (neutral baseline).
 */
export async function calculateProbability(
  db: Database,
  predictionId: string
): Promise<{ probabilityYes: number; totalVotes: number; yesWeight: number; noWeight: number }> {
  const result = await db
    .select({
      side: predictionVotes.side,
      totalWeight: sum(predictionVotes.weight),
      voteCount: count(),
    })
    .from(predictionVotes)
    .where(eq(predictionVotes.predictionId, predictionId))
    .groupBy(predictionVotes.side)

  let yesWeight = 0
  let noWeight = 0
  let totalVotes = 0

  for (const row of result) {
    const weight = Number(row.totalWeight) || 0
    const votes = Number(row.voteCount) || 0
    totalVotes += votes

    if (row.side === 'yes') {
      yesWeight = weight
    } else {
      noWeight = weight
    }
  }

  const totalWeight = yesWeight + noWeight

  // Baseline 50% if no votes
  const probabilityYes = totalWeight > 0
    ? Math.round((yesWeight / totalWeight) * 10000) / 100
    : 50

  return { probabilityYes, totalVotes, yesWeight, noWeight }
}

// =============================================
// Cache probability in Redis
// =============================================

const PROB_CACHE_TTL = 60 // 1 minute

export interface CachedProbability {
  probabilityYes: number
  totalVotes: number
  sparkline: number[]
  trend: 'up' | 'down' | 'stable'
  updatedAt: string
}

export async function cacheProbability(
  predictionId: string,
  data: CachedProbability
): Promise<void> {
  try {
    const redis = createRedis()
    const key = REDIS_KEYS.predictionProb(predictionId)
    await redis.set(key, JSON.stringify(data), { ex: PROB_CACHE_TTL })
  } catch {
    // Redis unavailable — no-op
  }
}

export async function getCachedProbability(
  predictionId: string
): Promise<CachedProbability | null> {
  try {
    const redis = createRedis()
    const key = REDIS_KEYS.predictionProb(predictionId)
    const cached = await redis.get<string>(key)
    if (cached) {
      return JSON.parse(typeof cached === 'string' ? cached : JSON.stringify(cached))
    }
    return null
  } catch {
    return null
  }
}

// =============================================
// List Predictions (paginated + filterable)
// =============================================

const LIST_CACHE_TTL = 30 // 30 seconds

export async function listPredictions(
  db: Database,
  params: PredictionListParams = {}
): Promise<PredictionListResult> {
  const {
    status,
    category,
    limit = 20,
    cursor,
  } = params

  const conditions = []

  if (status) conditions.push(eq(predictions.status, status))
  if (category) conditions.push(eq(predictions.category, category))
  if (cursor) conditions.push(sql`${predictions.createdAt} < ${new Date(cursor)}`)

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count for the filtered query
  const [countResult] = await db
    .select({ total: count() })
    .from(predictions)
    .where(where)

  const total = Number(countResult?.total) || 0

  // Get prediction rows
  const rows = await db
    .select()
    .from(predictions)
    .where(where)
    .orderBy(desc(predictions.createdAt))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const predictionRows = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? predictionRows[predictionRows.length - 1].createdAt.toISOString() : null

  // Enrich each prediction with probability data
  const data: PredictionListItem[] = await Promise.all(
    predictionRows.map(async (row) => {
      // Try cache first
      const cached = await getCachedProbability(row.id)

      if (cached) {
        return {
          ...row,
          probabilityYes: cached.probabilityYes,
          totalVotes: cached.totalVotes,
          trend: cached.trend,
          sparkline: cached.sparkline,
          timeLeft: computeTimeLeft(row.closesAt),
        }
      }

      // Cache miss — compute from DB
      const prob = await calculateProbability(db, row.id)

      // Get sparkline from recent snapshots
      const snapshots = await db
        .select({
          value: predictionSnapshots.probabilityYes,
        })
        .from(predictionSnapshots)
        .where(eq(predictionSnapshots.predictionId, row.id))
        .orderBy(desc(predictionSnapshots.snapshotAt))
        .limit(7)

      const sparkline = snapshots.map(s => s.value).reverse()
      if (sparkline.length === 0) sparkline.push(prob.probabilityYes)

      const trend = computeTrend(sparkline)

      // Cache the computed data
      await cacheProbability(row.id, {
        probabilityYes: prob.probabilityYes,
        totalVotes: prob.totalVotes,
        sparkline,
        trend,
        updatedAt: new Date().toISOString(),
      })

      return {
        ...row,
        probabilityYes: prob.probabilityYes,
        totalVotes: prob.totalVotes,
        trend,
        sparkline,
        timeLeft: computeTimeLeft(row.closesAt),
      }
    })
  )

  return { data, nextCursor, total }
}

/**
 * Cached version of listPredictions — checks Redis first.
 */
export async function getCachedPredictionsList(
  db: Database,
  variant: string = 'default',
  params: PredictionListParams = {}
): Promise<PredictionListResult> {
  try {
    const redis = createRedis()
    const cacheKey = `predictions:list:${variant}`
    const cached = await redis.get<string>(cacheKey)

    if (cached) {
      return JSON.parse(typeof cached === 'string' ? cached : JSON.stringify(cached))
    }

    const result = await listPredictions(db, params)

    // Cache the list
    await redis.set(cacheKey, JSON.stringify(result), { ex: LIST_CACHE_TTL })

    return result
  } catch {
    // Redis unavailable — fallback to DB
    return listPredictions(db, params)
  }
}

// =============================================
// Get Prediction Detail (with history)
// =============================================

export async function getPredictionDetail(
  db: Database,
  predictionId: string
): Promise<PredictionDetailResult | null> {
  // Get prediction row
  const [prediction] = await db
    .select()
    .from(predictions)
    .where(eq(predictions.id, predictionId))
    .limit(1)

  if (!prediction) return null

  // Compute current probability
  const prob = await calculateProbability(db, predictionId)

  // Get full history for chart (all snapshots)
  const snapshots = await db
    .select({
      date: predictionSnapshots.snapshotAt,
      value: predictionSnapshots.probabilityYes,
    })
    .from(predictionSnapshots)
    .where(eq(predictionSnapshots.predictionId, predictionId))
    .orderBy(predictionSnapshots.snapshotAt)

  const history = snapshots.map(s => ({
    date: s.date.toISOString().slice(0, 10),
    value: s.value,
  }))

  // If history is empty, add the current value
  if (history.length === 0) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      value: prob.probabilityYes,
    })
  }

  // Get sparkline (last 7 points)
  const sparkline = history.slice(-7).map(h => h.value)
  const trend = computeTrend(sparkline)

  // Compute yes/no vote counts
  const yesVotes = Math.round(prob.totalVotes > 0
    ? prob.totalVotes * prob.probabilityYes / 100
    : 0)
  const noVotes = prob.totalVotes - yesVotes

  // Cache probability
  await cacheProbability(predictionId, {
    probabilityYes: prob.probabilityYes,
    totalVotes: prob.totalVotes,
    sparkline,
    trend,
    updatedAt: new Date().toISOString(),
  })

  return {
    ...prediction,
    probabilityYes: prob.probabilityYes,
    totalVotes: prob.totalVotes,
    trend,
    sparkline,
    timeLeft: computeTimeLeft(prediction.closesAt),
    history,
    yesVotes,
    noVotes,
  }
}

// =============================================
// Cast Vote
// =============================================

export async function castVote(
  db: Database,
  predictionId: string,
  userId: string,
  side: 'yes' | 'no',
  weight: number = 1
): Promise<VoteResult> {
  // 1. Verify prediction exists and is active
  const [prediction] = await db
    .select()
    .from(predictions)
    .where(eq(predictions.id, predictionId))
    .limit(1)

  if (!prediction) {
    throw new PredictionError('Prediction not found', 404)
  }

  if (prediction.status !== 'active') {
    throw new PredictionError('Prediction is no longer active', 400)
  }

  if (prediction.closesAt < new Date()) {
    throw new PredictionError('Prediction voting period has ended', 400)
  }

  // 2. Check if user already voted (upsert: update if exists)
  const [existingVote] = await db
    .select()
    .from(predictionVotes)
    .where(
      and(
        eq(predictionVotes.predictionId, predictionId),
        eq(predictionVotes.userId, userId)
      )
    )
    .limit(1)

  if (existingVote) {
    // Update existing vote
    await db
      .update(predictionVotes)
      .set({ side, weight, createdAt: new Date() })
      .where(eq(predictionVotes.id, existingVote.id))
  } else {
    // Insert new vote
    await db.insert(predictionVotes).values({
      predictionId,
      userId,
      side,
      weight,
    })
  }

  // 3. Recalculate probability
  const prob = await calculateProbability(db, predictionId)

  // 4. Insert a new snapshot
  await db.insert(predictionSnapshots).values({
    predictionId,
    probabilityYes: prob.probabilityYes,
    totalVotes: prob.totalVotes,
  })

  // 5. Update Redis cache
  const sparkline = [prob.probabilityYes] // minimal sparkline, will be enriched on next list fetch
  const trend = computeTrend(sparkline)

  await cacheProbability(predictionId, {
    probabilityYes: prob.probabilityYes,
    totalVotes: prob.totalVotes,
    sparkline,
    trend,
    updatedAt: new Date().toISOString(),
  })

  // 6. Invalidate the list cache
  try {
    const redis = createRedis()
    // Delete all prediction list caches
    await redis.del('predictions:list:default')
  } catch {
    // Redis unavailable — no-op
  }

  return {
    success: true,
    predictionId,
    side,
    weight,
    updatedProbability: prob.probabilityYes,
    totalVotes: prob.totalVotes,
  }
}

// =============================================
// Take Probability Snapshot (cron/scheduled)
// =============================================

/**
 * Creates a probability snapshot for all active predictions.
 * Intended to be called periodically (e.g., every hour via cron)
 * to build up the historical probability timeline.
 */
export async function takeAllSnapshots(db: Database): Promise<number> {
  const activePredictions = await db
    .select({ id: predictions.id })
    .from(predictions)
    .where(eq(predictions.status, 'active'))

  let snapshotCount = 0

  for (const pred of activePredictions) {
    const prob = await calculateProbability(db, pred.id)
    await db.insert(predictionSnapshots).values({
      predictionId: pred.id,
      probabilityYes: prob.probabilityYes,
      totalVotes: prob.totalVotes,
    })
    snapshotCount++
  }

  return snapshotCount
}

// =============================================
// Custom Error
// =============================================

export class PredictionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PredictionError'
  }
}
