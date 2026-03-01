/**
 * GET /api/events
 *
 * Returns a paginated, filterable list of intelligence events.
 * Uses Redis cache for hot feed, falls back to Postgres.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDb } from '../../server/db'
import { getCachedFeed, type EventListParams } from '../../server/services/events'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100)

    const params: EventListParams = {
      severity: severity as EventListParams['severity'],
      sentiment: sentiment as EventListParams['sentiment'],
      region: region as string | undefined,
      since: since as string | undefined,
      limit: parsedLimit,
      cursor: cursor as string | undefined,
    }

    const db = createDb()
    const variant = [severity, sentiment, region].filter(Boolean).join(':') || 'default'
    const result = await getCachedFeed(db, variant, params)

    // Cache headers for CDN
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching events:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
