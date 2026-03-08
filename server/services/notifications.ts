import { eq, and, desc } from 'drizzle-orm'
import { type Database } from '../db'
import { notifications, notificationPreferences, type notificationTypeEnum } from '../db/schema'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

export type Notification = InferSelectModel<typeof notifications>
export type NotificationPreferences = InferSelectModel<typeof notificationPreferences>

export async function getUserNotifications(db: Database, userId: string, unreadOnly = false) {
  const query = db
    .select()
    .from(notifications)
    .where(
      unreadOnly 
        ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
        : eq(notifications.userId, userId)
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50)

  return await query
}

export async function createNotification(
  db: Database,
  data: Omit<InferInsertModel<typeof notifications>, 'id' | 'createdAt' | 'isRead'>
) {
  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, data.userId))
    .limit(1)

  // Check preferences before creating
  if (pref) {
    if (data.type === 'event_alert' && !pref.eventAlerts) return null
    if (data.type === 'prediction_status' && !pref.predictionUpdates) return null
    if (data.type === 'system_alert' && !pref.systemAlerts) return null
  }

  const [notification] = await db
    .insert(notifications)
    .values(data)
    .returning()
  return notification
}

export async function markNotificationAsRead(db: Database, userId: string, notificationId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning()
  return updated
}

export async function markAllNotificationsAsRead(db: Database, userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
}

export async function getUserNotificationPreferences(db: Database, userId: string) {
  let [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1)

  if (!pref) {
    [pref] = await db
      .insert(notificationPreferences)
      .values({ userId })
      .returning()
  }

  return pref
}

export async function updateUserNotificationPreferences(
  db: Database,
  userId: string,
  data: Partial<InferInsertModel<typeof notificationPreferences>>
) {
  const [updated] = await db
    .update(notificationPreferences)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notificationPreferences.userId, userId))
    .returning()
  
  return updated
}
