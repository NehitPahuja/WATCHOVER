/**
 * GET /api/events/[id]
 *
 * Returns full event detail with sources.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDb } from '../../server/db'
import { getEventDetail } from '../../server/services/events'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Event ID is required' })
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
