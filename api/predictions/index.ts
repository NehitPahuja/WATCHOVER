/**
 * GET /api/predictions
 *
 * Returns a list of predictions, filterable by status and category.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { status, category, limit = '20' } = req.query

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 50)

    // TODO: Implement when database is provisioned
    // 1. Query predictions with filters
    // 2. Join latest snapshot for probability
    // 3. Return results

    return res.status(200).json({
      data: [],
      meta: {
        filters: {
          status: status || null,
          category: category || null,
        },
        limit: parsedLimit,
      },
    })
  } catch (error) {
    console.error('Error fetching predictions:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
