import React, { useState } from 'react'
import {
  useNotifications,
  useNotificationPreferences,
  useMarkAllReadMutation,
  useMarkReadMutation,
  useUpdatePreferencesMutation,
} from '../../hooks/useNotifications'
import { Button } from '../Button'
import { useAuth } from '@clerk/clerk-react'
import './NotificationsPanel.css'

interface NotificationsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose }) => {
  const { isSignedIn } = useAuth()
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>('notifications')

  const { data: notifications = [] } = useNotifications(false, { enabled: isSignedIn && isOpen })
  const { data: preferences } = useNotificationPreferences({ enabled: isSignedIn && isOpen && activeTab === 'settings' })

  const markAllReadParams = useMarkAllReadMutation()
  const markReadParams = useMarkReadMutation()
  const updatePrefs = useUpdatePreferencesMutation()

  if (!isOpen) return null

  const safeNotifications = Array.isArray(notifications) ? notifications : []
  const unreadCount = safeNotifications.filter((n) => !n.isRead).length

  return (
    <div className="wo-notifications">
      <div className="wo-notifications__header">
        <div className="wo-notifications__tabs">
          <button
            className={`wo-notifications__tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications {unreadCount > 0 && <span className="wo-notifications__badge">{unreadCount}</span>}
          </button>
          <button
            className={`wo-notifications__tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
        <button className="wo-notifications__close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="wo-notifications__content">
        {activeTab === 'notifications' && (
          <>
            <div className="wo-notifications__actions">
              <span className="wo-notifications__title">Recent Activity</span>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => markAllReadParams.mutate(undefined)}>
                  Mark all as read
                </Button>
              )}
            </div>
            
            {!isSignedIn ? (
              <div className="wo-notifications__empty">Sign in to view notifications</div>
            ) : safeNotifications.length === 0 ? (
              <div className="wo-notifications__empty">No notifications yet</div>
            ) : (
              <div className="wo-notifications__list">
                {safeNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`wo-notifications__item ${!notif.isRead ? 'wo-notifications__item--unread' : ''}`}
                    onClick={() => {
                      if (!notif.isRead) markReadParams.mutate(notif.id)
                    }}
                  >
                    <div className="wo-notifications__item-icon">
                      {notif.type === 'event_alert' && '⚠️'}
                      {notif.type === 'prediction_status' && '📊'}
                      {notif.type === 'system_alert' && 'ℹ️'}
                    </div>
                    <div className="wo-notifications__item-body">
                      <div className="wo-notifications__item-title">{notif.title}</div>
                      <div className="wo-notifications__item-message">{notif.message}</div>
                      <div className="wo-notifications__item-time">
                        {new Date(notif.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <div className="wo-notifications__settings">
            <span className="wo-notifications__title">Preferences</span>
            
            {!isSignedIn ? (
              <div className="wo-notifications__empty">Sign in to change settings</div>
            ) : !preferences ? (
              <div className="wo-notifications__empty">Loading...</div>
            ) : (
              <div className="wo-notifications__settings-list">
                <label className="wo-notifications__setting">
                  <span>Event Alerts</span>
                  <input
                    type="checkbox"
                    checked={preferences.eventAlerts}
                    onChange={(e) => updatePrefs.mutate({ eventAlerts: e.target.checked })}
                  />
                </label>
                <label className="wo-notifications__setting">
                  <span>Prediction Updates</span>
                  <input
                    type="checkbox"
                    checked={preferences.predictionUpdates}
                    onChange={(e) => updatePrefs.mutate({ predictionUpdates: e.target.checked })}
                  />
                </label>
                <label className="wo-notifications__setting">
                  <span>System Alerts</span>
                  <input
                    type="checkbox"
                    checked={preferences.systemAlerts}
                    onChange={(e) => updatePrefs.mutate({ systemAlerts: e.target.checked })}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
