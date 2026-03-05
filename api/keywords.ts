/**
 * GET /api/keywords
 *
 * Returns top trending keywords from the last 24 hours.
 *
 * Security: Public read with rate limiting.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withSecurity, type SecuredHandler } from '../server/lib/middleware'
import { sanitizeNumber } from '../server/lib/sanitize'

const handler: SecuredHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { limit = '10' } = req.query
    const parsedLimit = sanitizeNumber(limit, { min: 1, max: 50, default: 10 })

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

export default withSecurity(handler, {
  rateLimit: 'api',
  auth: 'none',
})
