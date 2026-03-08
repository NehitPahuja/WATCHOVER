import type { VercelRequest, VercelResponse } from '@vercel/node'
import { withAuthRead, withAuthWrite, type SecuredHandler } from '../../server/lib/middleware'
import { createDb } from '../../server/db'
import { getUserNotificationPreferences, updateUserNotificationPreferences } from '../../server/services/notifications'

const getHandler: SecuredHandler = async (req, res, session) => {
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const db = createDb()
    const pref = await getUserNotificationPreferences(db, session.userId)

    return res.status(200).json(pref)
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const putHandler: SecuredHandler = async (req, res, session) => {
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const data = req.body
    if (!data) return res.status(400).json({ error: 'Invalid body' })

    const db = createDb()
    const updated = await updateUserNotificationPreferences(db, session.userId, data)

    return res.status(200).json(updated)
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const mainHandler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method === 'GET') {
    return withAuthRead(getHandler)(req, res)
  }
  if (req.method === 'PUT') {
    return withAuthWrite(putHandler, 'events:read', { action: 'notification:update_preferences', entityType: 'notification' })(req, res)
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

export default mainHandler
