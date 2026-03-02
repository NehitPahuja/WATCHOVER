/**
 * GET /api/predictions
 *
 * Returns a list of predictions, filterable by status and category.
 * Uses Redis caching with 30s TTL, falls back to Postgres.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDb } from '../../server/db'
import {
  getCachedPredictionsList,
  type PredictionListParams,
} from '../../server/services/predictions'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { status, category, limit = '20', cursor } = req.query

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 50)

    const params: PredictionListParams = {
      status: status as PredictionListParams['status'],
      category: category as string | undefined,
      limit: parsedLimit,
      cursor: cursor as string | undefined,
    }

    const db = createDb()
    const variant = [status, category].filter(Boolean).join(':') || 'default'
    const result = await getCachedPredictionsList(db, variant, params)

    // Cache headers for CDN
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching predictions:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
