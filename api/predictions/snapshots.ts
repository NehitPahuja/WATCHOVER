/**
 * POST /api/predictions/snapshots
 *
 * Takes probability snapshots for all active predictions.
 * Intended to be called by a cron job (e.g., every hour) to build
 * up the historical probability timeline used in charts.
 *
 * Protected by a shared secret (CRON_SECRET) for security.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createDb } from '../../server/db'
import { takeAllSnapshots } from '../../server/services/predictions'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify cron secret
    const authHeader = req.headers.authorization
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const db = createDb()
    const count = await takeAllSnapshots(db)

    return res.status(200).json({
      success: true,
      snapshotsCreated: count,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error taking prediction snapshots:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
