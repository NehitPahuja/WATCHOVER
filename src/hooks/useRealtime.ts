import { useEffect, useRef, useCallback, useState } from 'react'
import {
  createEnvelope,
  parseEnvelope,
  type WsEnvelope,
  type WsMessageType,
} from '../../server/relay/protocol'

// =============================================
// Types
// =============================================

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'fallback-polling'

interface UseRealtimeOptions {
  /** WebSocket relay URL */
  url: string
  /** Auth token for the relay */
  token?: string
  /** Channels to subscribe to on connect */
  channels?: string[]
  /** Callback for incoming messages */
  onMessage?: (envelope: WsEnvelope) => void
  /** Callback for connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void
  /** Enable/disable the connection */
  enabled?: boolean
  /** Max reconnect attempts before falling back to polling */
  maxReconnectAttempts?: number
  /** Fallback polling interval in ms */
  pollingInterval?: number
}

interface UseRealtimeReturn {
  /** Current connection status */
  status: ConnectionStatus
  /** Send a message to the relay */
  send: (type: WsMessageType, payload: unknown, channel?: string) => void
  /** Subscribe to additional channels */
  subscribe: (channels: string[]) => void
  /** Unsubscribe from channels */
  unsubscribe: (channels: string[]) => void
  /** Force reconnect */
  reconnect: () => void
}

// =============================================
// Hook
// =============================================

export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const {
    url,
    token,
    channels = ['global'],
    onMessage,
    onStatusChange,
    enabled = true,
    maxReconnectAttempts = 5,
    pollingInterval = 10_000,
  } = options

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const onMessageRef = useRef(onMessage)
  const onStatusChangeRef = useRef(onStatusChange)

  // Keep refs in sync
  onMessageRef.current = onMessage
  onStatusChangeRef.current = onStatusChange

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus)
    onStatusChangeRef.current?.(newStatus)
  }, [])

  // ---- Send ----
  const send = useCallback((type: WsMessageType, payload: unknown, channel?: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createEnvelope(type, payload, channel)))
    }
  }, [])

  // ---- Subscribe / Unsubscribe ----
  const subscribe = useCallback((newChannels: string[]) => {
    send('subscribe', { channels: newChannels })
  }, [send])

  const unsubscribe = useCallback((removeChannels: string[]) => {
    send('unsubscribe', { channels: removeChannels })
  }, [send])

  // ---- Connect ----
  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    updateStatus('connecting')

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected to relay')
        reconnectAttemptsRef.current = 0
        updateStatus('connected')

        // Authenticate
        if (token) {
          ws.send(JSON.stringify(createEnvelope('auth', { token })))
        }

        // Subscribe to channels
        if (channels.length > 0) {
          ws.send(JSON.stringify(createEnvelope('subscribe', { channels })))
        }

        // Stop polling if it was running
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current)
          pollingTimerRef.current = null
        }
      }

      ws.onmessage = (event) => {
        const envelope = parseEnvelope(event.data as string)
        if (envelope) {
          // Handle ping/pong internally
          if (envelope.type === 'ping') {
            ws.send(JSON.stringify(createEnvelope('pong', {})))
            return
          }

          onMessageRef.current?.(envelope)
        }
      }

      ws.onclose = (event) => {
        console.log(`[WS] Disconnected (code: ${event.code})`)
        wsRef.current = null
        handleReconnect()
      }

      ws.onerror = (error) => {
        console.error('[WS] Error:', error)
      }
    } catch (err) {
      console.error('[WS] Connection failed:', err)
      handleReconnect()
    }
  }, [url, token, channels, updateStatus])

  // ---- Reconnect with Backoff ----
  const handleReconnect = useCallback(() => {
    reconnectAttemptsRef.current++

    if (reconnectAttemptsRef.current > maxReconnectAttempts) {
      // Fall back to polling
      console.log('[WS] Max reconnect attempts reached, falling back to polling')
      updateStatus('fallback-polling')
      startPolling()
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30_000)
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
    updateStatus('disconnected')

    reconnectTimerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect, maxReconnectAttempts, updateStatus])

  // ---- Polling Fallback ----
  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return

    console.log(`[WS] Starting polling fallback (every ${pollingInterval}ms)`)

    pollingTimerRef.current = setInterval(async () => {
      try {
        // In production: fetch latest events from REST API
        // const res = await fetch('/api/events?since=...')
        // const data = await res.json()
        // onMessageRef.current?.(createEnvelope('events:new', data))

        // For now, just attempt WS reconnect periodically
        reconnectAttemptsRef.current = 0
        connect()
      } catch (err) {
        console.error('[WS] Polling fallback error:', err)
      }
    }, pollingInterval)
  }, [pollingInterval, connect])

  // ---- Manual Reconnect ----
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    connect()
  }, [connect])

  // ---- Effect: Connect/Disconnect ----
  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close()
      updateStatus('disconnected')
      return
    }

    connect()

    return () => {
      wsRef.current?.close()
      wsRef.current = null
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current)
    }
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return { status, send, subscribe, unsubscribe, reconnect }
}
