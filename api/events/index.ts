/**
 * GET /api/events
 *
 * Returns a paginated, filterable list of intelligence events.
 * Uses Redis cache for hot feed, falls back to Postgres.
 *
 * Security: Public read with rate limiting.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withSecurity, type SecuredHandler } from '../../server/lib/middleware'
import { createDb } from '../../server/db'
import { getCachedFeed, type EventListParams } from '../../server/services/events'
import {
  sanitizeSeverity,
  sanitizeSentiment,
  sanitizeString,
  sanitizeNumber,
} from '../../server/lib/sanitize'

const handler: SecuredHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      severity,
      sentiment,
      region,
      since,
      limit = '50',
      cursor,
    } = req.query

    const parsedLimit = sanitizeNumber(limit, { min: 1, max: 100, default: 50 })

    const params: EventListParams = {
      severity: sanitizeSeverity(severity),
      sentiment: sanitizeSentiment(sentiment),
      region: region ? sanitizeString(region, { maxLength: 100 }) : undefined,
      since: since as string | undefined,
      limit: parsedLimit,
      cursor: cursor as string | undefined,
    }

    const db = createDb()
    const variant = [params.severity, params.sentiment, params.region].filter(Boolean).join(':') || 'default'
    const result = await getCachedFeed(db, variant, params)

    // Cache headers for CDN
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching events:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withSecurity(handler, {
  rateLimit: 'api',
  auth: 'none',
})
