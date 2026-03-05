/**
 * POST /api/predictions/[id]/vote
 *
 * Cast a vote on a prediction.
 * Requires auth + predictions:vote permission (admin or subscriber).
 *
 * Body: { side: 'yes' | 'no', weight?: number }
 *
 * Returns updated probability and total votes.
 *
 * Security: Authenticated write with rate limiting, RBAC, sanitization, and audit logging.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withSecurity, type SecuredHandler } from '../../../server/lib/middleware'
import { createDb } from '../../../server/db'
import {
  castVote,
  PredictionError,
} from '../../../server/services/predictions'
import { isValidUuid, sanitizeEnum, sanitizeNumber } from '../../../server/lib/sanitize'

const handler: SecuredHandler = async (req, res, session) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Session is guaranteed by middleware (auth: 'required')
    if (!session) {
      return res.status(401).json({ error: 'Authentication required. Sign in to vote.' })
    }

    const { id } = req.query
    const { side, weight = 1 } = req.body || {}

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Prediction ID is required' })
    }

    // Validate UUID format
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid prediction ID format' })
    }

    // Validate vote side
    const sanitizedSide = sanitizeEnum(side, ['yes', 'no'] as const)
    if (!sanitizedSide) {
      return res.status(400).json({ error: 'Vote side must be "yes" or "no"' })
    }

    // Validate weight (bounded between 0.1 and 5)
    const parsedWeight = sanitizeNumber(weight, { min: 0.1, max: 5, default: 1 })

    const db = createDb()
    const result = await castVote(db, id, session.userId, sanitizedSide, parsedWeight)

    return res.status(200).json(result)
  } catch (error) {
    if (error instanceof PredictionError) {
      return res.status(error.statusCode).json({ error: error.message })
    }

    console.error('Error casting vote:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withSecurity(handler, {
  rateLimit: 'write',
  auth: 'required',
  permission: 'predictions:vote',
  sanitizeBody: true,
  audit: {
    action: 'prediction:vote',
    entityType: 'prediction',
  },
})
