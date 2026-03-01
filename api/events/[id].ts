/**
 * GET /api/events/[id]
 *
 * Returns full event detail with sources.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id } = req.query

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Event ID is required' })
    }

    // TODO: Implement when database is provisioned
    // 1. Query event by ID from Postgres
    // 2. Join event_sources
    // 3. Return full detail

    return res.status(404).json({ error: 'Event not found' })
  } catch (error) {
    console.error('Error fetching event:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
