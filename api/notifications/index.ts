import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuthRead, withAuthWrite, type SecuredHandler } from '../../server/lib/middleware'
import { createDb } from '../../server/db'
import { getUserNotifications, markAllNotificationsAsRead } from '../../server/services/notifications'

const getHandler: SecuredHandler = async (req, res, session) => {
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const unreadOnly = req.query.unread === 'true'
    const db = createDb()
    const result = await getUserNotifications(db, session.userId, unreadOnly)

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const patchHandler: SecuredHandler = async (req, res, session) => {
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const db = createDb()
    await markAllNotificationsAsRead(db, session.userId)

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error marking all notifications read:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const mainHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    return withAuthRead(getHandler)(req, res)
  }
  if (req.method === 'PATCH') {
    return withAuthWrite(patchHandler, 'events:read', { action: 'notification:mark_read', entityType: 'notification' })(req, res)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

export default mainHandler
