/**
 * POST /api/predictions/[id]/vote
 *
 * Cast a vote on a prediction.
 * Requires auth + active subscription.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAuth, hasPermission } from '../../../server/lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Auth check
    const session = await verifyAuth(req as unknown as Request)
    if (!session) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Permission check
    if (!hasPermission(session.role, 'predictions:vote')) {
      return res.status(403).json({ error: 'Signal Clearance subscription required to vote' })
    }

    const { id } = req.query
    const { side, weight = 1 } = req.body || {}

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Prediction ID is required' })
    }

    if (!side || !['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Vote side must be "yes" or "no"' })
    }

    // TODO: Implement when database is provisioned
    // 1. Check prediction exists and is active
    // 2. Check user hasn't already voted (or update vote)
    // 3. Insert vote into prediction_votes
    // 4. Recalculate probability: YES_weight / (YES_weight + NO_weight)
    // 5. Insert new prediction_snapshot
    // 6. Update Redis cache (prediction:prob:{id})
    // 7. Broadcast via WebSocket relay (predictions:update)
    // 8. Log to audit_logs

    return res.status(200).json({
      message: 'Vote recorded',
      predictionId: id,
      side,
      weight,
      updatedProbability: null, // Will be computed
    })
  } catch (error) {
    console.error('Error casting vote:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
