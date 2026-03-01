/**
 * GET /api/events
 *
 * Returns a paginated, filterable list of intelligence events.
 * Cached in Redis for fast edge responses.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

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

    // TODO: Implement when database is provisioned
    // 1. Check Redis cache first
    // 2. If miss, query Postgres with filters
    // 3. Populate cache
    // 4. Return paginated results

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100)

    return res.status(200).json({
      data: [],
      nextCursor: null,
      meta: {
        filters: {
          severity: severity || null,
          sentiment: sentiment || null,
          region: region || null,
          since: since || null,
        },
        limit: parsedLimit,
        cursor: cursor || null,
      },
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
