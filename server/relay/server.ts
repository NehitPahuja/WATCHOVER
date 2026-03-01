/**
 * WatchOver Realtime Relay Server
 *
 * A lightweight stateful WebSocket relay that:
 * 1. Accepts client connections with JWT auth
 * 2. Manages channel subscriptions (global, region:*, prediction:*, layer:*)
 * 3. Receives events from backend (via shared secret) and fans out to subscribers
 * 4. Handles heartbeat/ping-pong for connection health
 *
 * Deploy to Fly.io or Railway for always-on operation.
 *
 * Usage:
 *   RELAY_PORT=8080 RELAY_SHARED_SECRET=xxx node --loader ts-node/esm server/relay/server.ts
 */

import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import {
  createEnvelope,
  parseEnvelope,
  type WsEnvelope,
  type WsMessageType,
  type SubscribePayload,
  type AuthPayload,
} from './protocol'

// =============================================
// Configuration
// =============================================

const PORT = parseInt(process.env.RELAY_PORT || '8080', 10)
const SHARED_SECRET = process.env.RELAY_SHARED_SECRET || 'dev-secret'
const HEARTBEAT_INTERVAL = 30_000 // 30 seconds
const CLIENT_TIMEOUT = 60_000     // 60 seconds without pong → disconnect

// =============================================
// Client State
// =============================================

interface ClientState {
  ws: WebSocket
  id: string
  channels: Set<string>
  isAuthenticated: boolean
  isServerPublisher: boolean
  lastPong: number
}

const clients = new Map<string, ClientState>()
const channelSubscribers = new Map<string, Set<string>>() // channel -> client IDs

let clientIdCounter = 0

// =============================================
// Server Setup
// =============================================

const wss = new WebSocketServer({ port: PORT })

console.log(`[RELAY] WebSocket relay server starting on port ${PORT}`)

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const clientId = `client_${++clientIdCounter}`
  const ip = req.socket.remoteAddress || 'unknown'

  const client: ClientState = {
    ws,
    id: clientId,
    channels: new Set(['global']), // Everyone gets global by default
    isAuthenticated: false,
    isServerPublisher: false,
    lastPong: Date.now(),
  }

  clients.set(clientId, client)
  addToChannel('global', clientId)

  console.log(`[RELAY] Client connected: ${clientId} from ${ip} (total: ${clients.size})`)

  // ---- Handle Messages ----
  ws.on('message', (raw: Buffer) => {
    try {
      const envelope = parseEnvelope(raw.toString())
      if (!envelope) {
        sendError(ws, 'INVALID_MESSAGE', 'Could not parse message envelope')
        return
      }

      handleMessage(client, envelope)
    } catch (err) {
      console.error(`[RELAY] Error handling message from ${clientId}:`, err)
      sendError(ws, 'INTERNAL_ERROR', 'Server error processing message')
    }
  })

  // ---- Handle Pong ----
  ws.on('pong', () => {
    client.lastPong = Date.now()
  })

  // ---- Handle Disconnect ----
  ws.on('close', () => {
    console.log(`[RELAY] Client disconnected: ${clientId} (total: ${clients.size - 1})`)
    removeClient(clientId)
  })

  ws.on('error', (err) => {
    console.error(`[RELAY] Client error ${clientId}:`, err.message)
    removeClient(clientId)
  })

  // Send welcome + request auth
  send(ws, createEnvelope('ping', { message: 'Welcome to WatchOver Relay. Send auth token.' }))
})

// =============================================
// Message Handler
// =============================================

function handleMessage(client: ClientState, envelope: WsEnvelope) {
  switch (envelope.type) {
    case 'auth':
      handleAuth(client, envelope.payload as AuthPayload)
      break

    case 'subscribe':
      handleSubscribe(client, envelope.payload as SubscribePayload)
      break

    case 'unsubscribe':
      handleUnsubscribe(client, envelope.payload as SubscribePayload)
      break

    case 'pong':
      client.lastPong = Date.now()
      break

    // Server-to-relay publish messages (requires shared secret auth)
    case 'events:new':
    case 'events:update':
    case 'predictions:update':
    case 'counters:update':
    case 'layer:update':
      handlePublish(client, envelope)
      break

    default:
      sendError(client.ws, 'UNKNOWN_TYPE', `Unknown message type: ${envelope.type}`)
  }
}

// =============================================
// Auth
// =============================================

function handleAuth(client: ClientState, payload: AuthPayload) {
  const { token } = payload

  // Check if this is a server publisher (uses shared secret)
  if (token === SHARED_SECRET) {
    client.isAuthenticated = true
    client.isServerPublisher = true
    send(client.ws, createEnvelope('auth:ok', { role: 'publisher' }))
    console.log(`[RELAY] Server publisher authenticated: ${client.id}`)
    return
  }

  // For regular clients, verify JWT token
  // In production: verify Clerk JWT here
  // For now, accept any non-empty token
  if (token && token.length > 0) {
    client.isAuthenticated = true
    send(client.ws, createEnvelope('auth:ok', { role: 'subscriber' }))
    console.log(`[RELAY] Client authenticated: ${client.id}`)
  } else {
    send(client.ws, createEnvelope('auth:fail', { reason: 'Invalid token' }))
  }
}

// =============================================
// Channel Subscriptions
// =============================================

function handleSubscribe(client: ClientState, payload: SubscribePayload) {
  if (!client.isAuthenticated) {
    sendError(client.ws, 'NOT_AUTHENTICATED', 'Authenticate before subscribing')
    return
  }

  for (const channel of payload.channels) {
    if (isValidChannel(channel)) {
      client.channels.add(channel)
      addToChannel(channel, client.id)
      console.log(`[RELAY] ${client.id} subscribed to ${channel}`)
    }
  }

  send(client.ws, createEnvelope('subscribe', {
    channels: Array.from(client.channels),
    message: 'Subscription updated',
  }))
}

function handleUnsubscribe(client: ClientState, payload: SubscribePayload) {
  for (const channel of payload.channels) {
    if (channel === 'global') continue // Can't unsubscribe from global
    client.channels.delete(channel)
    removeFromChannel(channel, client.id)
  }

  send(client.ws, createEnvelope('unsubscribe', {
    channels: Array.from(client.channels),
    message: 'Subscription updated',
  }))
}

function isValidChannel(channel: string): boolean {
  if (channel === 'global') return true
  if (channel.startsWith('region:')) return true
  if (channel.startsWith('prediction:')) return true
  if (channel.startsWith('layer:')) return true
  return false
}

// =============================================
// Publish (Fan-out)
// =============================================

function handlePublish(client: ClientState, envelope: WsEnvelope) {
  if (!client.isServerPublisher) {
    sendError(client.ws, 'FORBIDDEN', 'Only server publishers can publish messages')
    return
  }

  const channel = envelope.channel || 'global'
  const subscriberIds = channelSubscribers.get(channel) || new Set()
  let delivered = 0

  for (const subId of subscriberIds) {
    const subscriber = clients.get(subId)
    if (subscriber && subscriber.ws.readyState === WebSocket.OPEN && subId !== client.id) {
      send(subscriber.ws, envelope)
      delivered++
    }
  }

  // Also broadcast to global for events:new and counters:update
  if (channel !== 'global' && (envelope.type === 'events:new' || envelope.type === 'counters:update')) {
    const globalSubs = channelSubscribers.get('global') || new Set()
    for (const subId of globalSubs) {
      if (subscriberIds.has(subId)) continue // Already delivered
      const subscriber = clients.get(subId)
      if (subscriber && subscriber.ws.readyState === WebSocket.OPEN && subId !== client.id) {
        send(subscriber.ws, envelope)
        delivered++
      }
    }
  }

  console.log(`[RELAY] Published ${envelope.type} to ${channel} → ${delivered} clients`)
}

// =============================================
// Heartbeat
// =============================================

const heartbeatInterval = setInterval(() => {
  const now = Date.now()

  for (const [clientId, client] of clients) {
    if (now - client.lastPong > CLIENT_TIMEOUT) {
      console.log(`[RELAY] Client timed out: ${clientId}`)
      client.ws.terminate()
      removeClient(clientId)
      continue
    }

    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.ping()
    }
  }
}, HEARTBEAT_INTERVAL)

wss.on('close', () => {
  clearInterval(heartbeatInterval)
})

// =============================================
// Helpers
// =============================================

function send(ws: WebSocket, envelope: WsEnvelope) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(envelope))
  }
}

function sendError(ws: WebSocket, code: string, message: string) {
  send(ws, createEnvelope('error', { code, message }))
}

function addToChannel(channel: string, clientId: string) {
  if (!channelSubscribers.has(channel)) {
    channelSubscribers.set(channel, new Set())
  }
  channelSubscribers.get(channel)!.add(clientId)
}

function removeFromChannel(channel: string, clientId: string) {
  channelSubscribers.get(channel)?.delete(clientId)
  // Clean up empty channels (except global)
  if (channel !== 'global' && channelSubscribers.get(channel)?.size === 0) {
    channelSubscribers.delete(channel)
  }
}

function removeClient(clientId: string) {
  const client = clients.get(clientId)
  if (!client) return

  // Remove from all channels
  for (const channel of client.channels) {
    removeFromChannel(channel, clientId)
  }

  clients.delete(clientId)
}

// =============================================
// Stats Endpoint (for monitoring)
// =============================================

// Log stats every 60 seconds
setInterval(() => {
  const channelList = Array.from(channelSubscribers.entries())
    .map(([ch, subs]) => `${ch}(${subs.size})`)
    .join(', ')

  console.log(`[RELAY] Stats — Clients: ${clients.size} | Channels: ${channelSubscribers.size} [${channelList}]`)
}, 60_000)

console.log(`[RELAY] ✓ Relay server ready on ws://localhost:${PORT}`)
