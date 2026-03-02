/**
 * POST /api/predictions/[id]/vote
 *
 * Cast a vote on a prediction.
 * Requires auth + predictions:vote permission (admin or subscriber).
 *
 * Body: { side: 'yes' | 'no', weight?: number }
 *
 * Returns updated probability and total votes.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth, hasPermission } from '../../../server/lib/auth'
import { createDb } from '../../../server/db'
import {
  castVote,
  PredictionError,
} from '../../../server/services/predictions'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Auth check
    const session = await verifyAuth(req as unknown as Request)
    if (!session) {
      return res.status(401).json({ error: 'Authentication required. Sign in to vote.' })
    }

    // Permission check
    if (!hasPermission(session.role, 'predictions:vote')) {
      return res.status(403).json({
        error: 'Signal Clearance subscription required to vote',
        requiredRole: 'subscriber',
      })
    }

    const { id } = req.query
    const { side, weight = 1 } = req.body || {}

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Prediction ID is required' })
    }

    if (!side || !['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Vote side must be "yes" or "no"' })
    }

    // Validate weight (bounded between 0.1 and 5)
    const parsedWeight = Math.max(0.1, Math.min(5, Number(weight) || 1))

    const db = createDb()
    const result = await castVote(db, id, session.userId, side, parsedWeight)

    return res.status(200).json(result)
  } catch (error) {
    if (error instanceof PredictionError) {
      return res.status(error.statusCode).json({ error: error.message })
    }

    console.error('Error casting vote:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
