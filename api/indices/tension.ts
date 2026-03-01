/**
 * GET /api/indices/tension
 *
 * Returns the Global Tension Index — a 7-day line chart data set.
 * Cached in Redis for fast responses.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { days = '7' } = req.query
    const parsedDays = Math.min(parseInt(days as string, 10) || 7, 90)

    // TODO: Implement when database is provisioned
    // 1. Check Redis cache (counters:{variant})
    // 2. If miss, compute from events (weighted severity + volume)
    // 3. Return time series data points

    return res.status(200).json({
      current: 0,
      change: 0,
      dataPoints: [],
      meta: { days: parsedDays },
    })
  } catch (error) {
    console.error('Error fetching tension index:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
