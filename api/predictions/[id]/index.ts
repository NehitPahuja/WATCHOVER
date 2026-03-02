/**
 * GET /api/predictions/[id]
 *
 * Returns full prediction detail with probability history for charting.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDb } from '../../../server/db'
import { getPredictionDetail } from '../../../server/services/predictions'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Prediction ID is required' })
    }

    const db = createDb()
    const prediction = await getPredictionDetail(db, id)

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' })
    }

    // Cache for 30s (probabilities change with votes)
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60')

    return res.status(200).json(prediction)
  } catch (error) {
    console.error('Error fetching prediction detail:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
