/**
 * WatchOver Realtime Relay — Message Types & Envelope
 *
 * Defines the wire protocol for all WebSocket communication.
 * Used by both the relay server and the frontend client.
 */

// =============================================
// Message Envelope
// =============================================

export interface WsEnvelope<T = unknown> {
  /** Message type identifier */
  type: WsMessageType
  /** ISO 8601 timestamp when the message was created */
  ts: string
  /** Optional channel the message was published to */
  channel?: string
  /** The actual message payload */
  payload: T
}

// =============================================
// Message Types
// =============================================

export type WsMessageType =
  | 'events:new'
  | 'events:update'
  | 'predictions:update'
  | 'counters:update'
  | 'layer:update'
  | 'subscribe'
  | 'unsubscribe'
  | 'ping'
  | 'pong'
  | 'error'
  | 'auth'
  | 'auth:ok'
  | 'auth:fail'

// =============================================
// Channel Patterns
// =============================================

export type WsChannel =
  | 'global'
  | `region:${string}`
  | `prediction:${string}`
  | `layer:${string}`

// =============================================
// Payload Types
// =============================================

/** New event published to the feed */
export interface EventNewPayload {
  id: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  sentiment: 'escalation' | 'de-escalation' | 'neutral'
  region: string
  countryFlag: string
  confidence: number
  publishedAt: string
}

/** Event data updated (e.g. confidence changed, new source added) */
export interface EventUpdatePayload {
  id: string
  changes: Partial<EventNewPayload>
}

/** Prediction probability updated after a vote */
export interface PredictionUpdatePayload {
  id: string
  probabilityYes: number
  totalVotes: number
  lastVoteAt: string
}

/** Live counter update (navbar counters) */
export interface CountersUpdatePayload {
  activeConflicts?: number
  tensions?: number
  aircraft?: number
  ships?: number
}

/** Subscribe/unsubscribe to channels */
export interface SubscribePayload {
  channels: string[]
}

/** Auth payload for client -> relay */
export interface AuthPayload {
  token: string
}

/** Error payload */
export interface ErrorPayload {
  code: string
  message: string
}

// =============================================
// Helper: Create Envelope
// =============================================

export function createEnvelope<T>(
  type: WsMessageType,
  payload: T,
  channel?: string
): WsEnvelope<T> {
  return {
    type,
    ts: new Date().toISOString(),
    channel,
    payload,
  }
}

export function parseEnvelope(data: string): WsEnvelope | null {
  try {
    const parsed = JSON.parse(data)
    if (parsed && typeof parsed.type === 'string' && parsed.payload !== undefined) {
      return parsed as WsEnvelope
    }
    return null
  } catch {
    return null
  }
}
