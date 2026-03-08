import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuthRead, withAuthWrite, type SecuredHandler } from '../../../server/lib/middleware'
import { createDb } from '../../../server/db'
import { markNotificationAsRead } from '../../../server/services/notifications'

const patchHandler: SecuredHandler = async (req, res, session) => {
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid notification id' })
    }

    const db = createDb()
    const updated = await markNotificationAsRead(db, session.userId, id)

    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    return res.status(200).json(updated)
  } catch (error) {
    console.error('Error marking notification read:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const mainHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'PATCH') {
    return withAuthWrite(patchHandler, 'events:read', { action: 'notification:mark_read', entityType: 'notification' })(req, res)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

export default mainHandler
