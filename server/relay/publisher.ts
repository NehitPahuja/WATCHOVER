/**
 * Relay Publisher Client
 *
 * Used by backend services (ingestion workers, API handlers)
 * to publish events to the WebSocket relay.
 *
 * Authenticates with the shared secret.
 *
 * Usage:
 *   const publisher = new RelayPublisher('ws://localhost:8080')
 *   await publisher.connect()
 *   publisher.publishEvent({ id: '...', title: '...', ... })
 */

import WebSocket from 'ws'
import {
  createEnvelope,
  parseEnvelope,
  type EventNewPayload,
  type EventUpdatePayload,
  type PredictionUpdatePayload,
  type CountersUpdatePayload,
} from './protocol'

export class RelayPublisher {
  private ws: WebSocket | null = null
  private url: string
  private secret: string
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isConnected = false

  constructor(url?: string, secret?: string) {
    this.url = url || process.env.RELAY_URL || 'ws://localhost:8080'
    this.secret = secret || process.env.RELAY_SHARED_SECRET || 'dev-secret'
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.on('open', () => {
        console.log('[PUBLISHER] Connected to relay')
        // Authenticate with shared secret
        this.ws!.send(JSON.stringify(createEnvelope('auth', { token: this.secret })))
      })

      this.ws.on('message', (raw: Buffer) => {
        const envelope = parseEnvelope(raw.toString())
        if (!envelope) return

        if (envelope.type === 'auth:ok') {
          console.log('[PUBLISHER] Authenticated as publisher')
          this.isConnected = true
          resolve()
        } else if (envelope.type === 'auth:fail') {
          console.error('[PUBLISHER] Authentication failed')
          reject(new Error('Auth failed'))
        }
      })

      this.ws.on('close', () => {
        this.isConnected = false
        console.log('[PUBLISHER] Disconnected, reconnecting in 5s...')
        this.reconnectTimer = setTimeout(() => this.connect(), 5000)
      })

      this.ws.on('error', (err) => {
        console.error('[PUBLISHER] Error:', err.message)
      })

      // Timeout
      setTimeout(() => {
        if (!this.isConnected) reject(new Error('Connection timeout'))
      }, 10_000)
    })
  }

  /** Publish a new event to the global feed */
  publishEvent(event: EventNewPayload) {
    this.send('events:new', event, 'global')
    // Also publish to region channel
    if (event.region) {
      this.send('events:new', event, `region:${event.region.toLowerCase().replace(/\s+/g, '-')}`)
    }
  }

  /** Publish an event update */
  publishEventUpdate(update: EventUpdatePayload) {
    this.send('events:update', update, 'global')
  }

  /** Publish a prediction probability update */
  publishPredictionUpdate(update: PredictionUpdatePayload) {
    this.send('predictions:update', update, `prediction:${update.id}`)
  }

  /** Publish counter updates (navbar) */
  publishCounterUpdate(counters: CountersUpdatePayload) {
    this.send('counters:update', counters, 'global')
  }

  /** Close the connection */
  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.isConnected = false
  }

  private send(type: string, payload: unknown, channel: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[PUBLISHER] Not connected, message dropped:', type)
      return
    }
    this.ws.send(JSON.stringify(createEnvelope(type as any, payload, channel)))
  }
}
