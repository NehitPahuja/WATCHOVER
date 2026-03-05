/**
 * GET /api/events/[id]
 *
 * Returns full event detail with sources.
 *
 * Security: Public read with rate limiting and UUID validation.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withSecurity, type SecuredHandler } from '../../server/lib/middleware'
import { createDb } from '../../server/db'
import { getEventDetail } from '../../server/services/events'
import { isValidUuid } from '../../server/lib/sanitize'

const handler: SecuredHandler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Event ID is required' })
    }

    // Validate UUID format to prevent injection
    if (!isValidUuid(id)) {
      return res.status(400).json({ error: 'Invalid event ID format' })
    }

    const db = createDb()
    const event = await getEventDetail(db, id)

    if (!event) {
      return res.status(404).json({ error: 'Event not found' })
    }

    // Longer cache for individual events (they don't change often)
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')

    return res.status(200).json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withSecurity(handler, {
  rateLimit: 'api',
  auth: 'none',
})
