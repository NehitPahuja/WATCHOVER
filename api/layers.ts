/**
 * GET /api/layers
 *
 * Returns the catalog of available map data layers.
 * Heavily cached — layer catalog changes infrequently.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // TODO: Implement when database is provisioned
    // 1. Check CDN/Redis cache
    // 2. If miss, query layers table
    // 3. Cache for long TTL (changes rarely)

    // Set long cache for layer catalog
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')

    return res.status(200).json({
      data: [],
    })
  } catch (error) {
    console.error('Error fetching layers:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
