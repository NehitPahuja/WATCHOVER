/**
 * GET /api/keywords
 *
 * Returns top trending keywords from the last 24 hours.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { limit = '10' } = req.query
    const parsedLimit = Math.min(parseInt(limit as string, 10) || 10, 50)

    // TODO: Implement when database is provisioned
    // 1. Aggregate keywords from events in last 24h
    // 2. Rank by mention count
    // 3. Return with trend direction (up/down/stable)

    return res.status(200).json({
      data: [],
      meta: { limit: parsedLimit },
    })
  } catch (error) {
    console.error('Error fetching keywords:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
