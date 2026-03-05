/**
 * GET /api/predictions
 *
 * Returns a list of predictions, filterable by status and category.
 * Uses Redis caching with 30s TTL, falls back to Postgres.
 *
 * Security: Public read with rate limiting and input sanitization.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withSecurity, type SecuredHandler } from '../../server/lib/middleware'
import { createDb } from '../../server/db'
import {
  getCachedPredictionsList,
  type PredictionListParams,
} from '../../server/services/predictions'
import {
  sanitizePredictionStatus,
  sanitizeString,
  sanitizeNumber,
} from '../../server/lib/sanitize'

const handler: SecuredHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { status, category, limit = '20', cursor } = req.query

    const parsedLimit = sanitizeNumber(limit, { min: 1, max: 50, default: 20 })

    const params: PredictionListParams = {
      status: sanitizePredictionStatus(status),
      category: category ? sanitizeString(category, { maxLength: 100 }) : undefined,
      limit: parsedLimit,
      cursor: cursor as string | undefined,
    }

    const db = createDb()
    const variant = [params.status, params.category].filter(Boolean).join(':') || 'default'
    const result = await getCachedPredictionsList(db, variant, params)

    // Cache headers for CDN
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching predictions:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withSecurity(handler, {
  rateLimit: 'api',
  auth: 'none',
})
