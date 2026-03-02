/**
 * useRealtimeDashboard — Connects the dashboard to the WebSocket relay
 *
 * Orchestrates:
 * - WebSocket connection + auth
 * - Real-time event feed updates (prepend new events)
 * - Real-time counter updates (conflicts, tensions, aircraft)
 * - Real-time prediction probability updates
 * - Globe marker updates
 * - Connection status tracking
 *
 * Uses TanStack Query cache for instant UI updates.
 */

import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRealtime, type ConnectionStatus } from './useRealtime'
import { handleRealtimeMessage, queryKeys } from './useQueries'
import type { WsEnvelope } from '../../server/relay/protocol'
import type {
  EventNewPayload,
  CountersUpdatePayload,
  PredictionUpdatePayload,
} from '../../server/relay/protocol'
import type { WatchEvent } from '../types'

// =============================================
// Types
// =============================================

export interface RealtimeCounters {
  activeConflicts: number
  tensions: number
  aircraft: number
  ships: number
}

export interface RealtimeDashboardState {
  /** Current WebSocket connection status */
  connectionStatus: ConnectionStatus
  /** Live counters (updated in real-time) */
  counters: RealtimeCounters
  /** New events received since page load */
  newEventIds: Set<string>
  /** Newly arrived events (prepended to feed) */
  realtimeEvents: WatchEvent[]
  /** Updated prediction probabilities */
  predictionUpdates: Map<string, { probabilityYes: number; totalVotes: number }>
  /** Force reconnect */
  reconnect: () => void
  /** Number of new events since last interaction */
  unreadCount: number
  /** Mark all new events as read */
  markAllRead: () => void
}

// =============================================
// Configuration
// =============================================

const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'ws://localhost:8080'
const AUTH_TOKEN = import.meta.env.VITE_RELAY_TOKEN || 'viewer-token'

// =============================================
// Hook
// =============================================

export function useRealtimeDashboard(
  initialCounters: Partial<RealtimeCounters> = {}
): RealtimeDashboardState {
  const queryClient = useQueryClient()

  // State
  const [counters, setCounters] = useState<RealtimeCounters>({
    activeConflicts: initialCounters.activeConflicts ?? 14,
    tensions: initialCounters.tensions ?? 23,
    aircraft: initialCounters.aircraft ?? 1128,
    ships: initialCounters.ships ?? 342,
  })
  const [realtimeEvents, setRealtimeEvents] = useState<WatchEvent[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const newEventIdsRef = useRef(new Set<string>())
  const predictionUpdatesRef = useRef(new Map<string, { probabilityYes: number; totalVotes: number }>())
  const [predictionUpdates, setPredictionUpdates] = useState(
    new Map<string, { probabilityYes: number; totalVotes: number }>()
  )

  // Handle incoming WebSocket messages
  const onMessage = useCallback((envelope: WsEnvelope) => {
    // Forward to TanStack Query cache handler
    handleRealtimeMessage(queryClient, envelope)

    switch (envelope.type) {
      case 'events:new': {
        const payload = envelope.payload as EventNewPayload
        newEventIdsRef.current.add(payload.id)
        setUnreadCount(prev => prev + 1)

        // Create a WatchEvent-compatible object for the feed
        const newEvent: WatchEvent = {
          id: payload.id,
          title: payload.title,
          summary: '',
          region: payload.region || 'Unknown',
          country: payload.region || 'Unknown',
          countryCode: '',
          countryFlag: payload.countryFlag || '🌍',
          lat: 0,
          lng: 0,
          severity: payload.severity,
          sentiment: payload.sentiment,
          confidence: payload.confidence,
          category: 'Breaking',
          sources: [],
          activityCount24h: 0,
          publishedAt: payload.publishedAt,
          timeAgo: 'Just now',
        }

        setRealtimeEvents(prev => [newEvent, ...prev].slice(0, 50))
        break
      }

      case 'counters:update': {
        const payload = envelope.payload as CountersUpdatePayload
        setCounters(prev => ({
          activeConflicts: payload.activeConflicts ?? prev.activeConflicts,
          tensions: payload.tensions ?? prev.tensions,
          aircraft: payload.aircraft ?? prev.aircraft,
          ships: payload.ships ?? prev.ships,
        }))
        break
      }

      case 'predictions:update': {
        const payload = envelope.payload as PredictionUpdatePayload
        predictionUpdatesRef.current.set(payload.id, {
          probabilityYes: payload.probabilityYes,
          totalVotes: payload.totalVotes,
        })
        setPredictionUpdates(new Map(predictionUpdatesRef.current))
        // Invalidate predictions query to refresh UI
        queryClient.invalidateQueries({ queryKey: queryKeys.predictions.all })
        break
      }
    }
  }, [queryClient])

  // Connect to relay
  const { status, reconnect } = useRealtime({
    url: RELAY_URL,
    token: AUTH_TOKEN,
    channels: ['global'],
    onMessage,
    enabled: true,
    maxReconnectAttempts: 5,
    pollingInterval: 15_000,
  })

  const markAllRead = useCallback(() => {
    setUnreadCount(0)
  }, [])

  return {
    connectionStatus: status,
    counters,
    newEventIds: newEventIdsRef.current,
    realtimeEvents,
    predictionUpdates,
    reconnect,
    unreadCount,
    markAllRead,
  }
}
