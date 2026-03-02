/**
 * Test Realtime Pipeline
 *
 * Publishes simulated events, counter updates, and prediction updates
 * to the WebSocket relay to verify the full live data pipeline.
 *
 * Usage: npx tsx server/scripts/test-realtime.ts
 *
 * Prerequisites: relay server must be running (npm run relay:dev)
 */

import WebSocket from 'ws'
import { createEnvelope } from '../relay/protocol'
import type {
  EventNewPayload,
  CountersUpdatePayload,
  PredictionUpdatePayload,
} from '../relay/protocol'

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8080'
const SHARED_SECRET = process.env.RELAY_SHARED_SECRET || 'dev-secret'

// =============================================
// Simulated Events
// =============================================

const SIMULATED_EVENTS: EventNewPayload[] = [
  {
    id: `test-${Date.now()}-1`,
    title: '🔴 BREAKING: Military forces mobilizing near disputed border zone',
    severity: 'critical',
    sentiment: 'escalation',
    region: 'Eastern Europe',
    countryFlag: '🇺🇦',
    confidence: 92,
    publishedAt: new Date().toISOString(),
  },
  {
    id: `test-${Date.now()}-2`,
    title: 'Ceasefire negotiations resume after diplomatic breakthrough',
    severity: 'medium',
    sentiment: 'de-escalation',
    region: 'Middle East',
    countryFlag: '🇱🇧',
    confidence: 78,
    publishedAt: new Date().toISOString(),
  },
  {
    id: `test-${Date.now()}-3`,
    title: 'Cyber attack targets financial infrastructure in NATO member state',
    severity: 'high',
    sentiment: 'escalation',
    region: 'Western Europe',
    countryFlag: '🇩🇪',
    confidence: 85,
    publishedAt: new Date().toISOString(),
  },
  {
    id: `test-${Date.now()}-4`,
    title: 'UN Security Council emergency session called on regional tensions',
    severity: 'high',
    sentiment: 'neutral',
    region: 'Global',
    countryFlag: '🇺🇳',
    confidence: 97,
    publishedAt: new Date().toISOString(),
  },
  {
    id: `test-${Date.now()}-5`,
    title: 'Naval fleet detected conducting exercises in contested waters',
    severity: 'high',
    sentiment: 'escalation',
    region: 'South China Sea',
    countryFlag: '🌏',
    confidence: 88,
    publishedAt: new Date().toISOString(),
  },
]

// =============================================
// Main
// =============================================

async function main() {
  console.log('🧪 WatchOver Realtime Test Script')
  console.log(`   Connecting to relay: ${RELAY_URL}\n`)

  const ws = new WebSocket(RELAY_URL)

  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ Connected to relay')

      // Authenticate as publisher
      ws.send(JSON.stringify(createEnvelope('auth', { token: SHARED_SECRET })))
      console.log('🔑 Authenticating as publisher...')
    })

    ws.on('message', (raw: Buffer) => {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'auth:ok') {
        console.log('🔓 Authenticated!\n')
        resolve()
      } else if (msg.type === 'auth:fail') {
        reject(new Error('Authentication failed'))
      }
    })

    ws.on('error', (err) => reject(err))

    setTimeout(() => reject(new Error('Connection timeout')), 5000)
  })

  // ---- Phase 1: Counter Update ----
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Phase 1: Counter Increment Animation')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   Watch the navbar counters tick up smoothly!\n')

  const counterUpdate: CountersUpdatePayload = {
    activeConflicts: 16,
    tensions: 25,
    aircraft: 1156,
    ships: 348,
  }
  ws.send(JSON.stringify(createEnvelope('counters:update', counterUpdate, 'global')))
  console.log('   → Active Conflicts: 14 → 16  (red flash)')
  console.log('   → Tensions: 23 → 25  (yellow flash)')
  console.log('   → Aircraft: 1,128 → 1,156  (green flash)')
  console.log()

  await sleep(2000)

  // ---- Phase 2: Live Events ----
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📰 Phase 2: Live Event Feed')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   Events will appear in the Pulse Feed one by one.\n')

  for (let i = 0; i < SIMULATED_EVENTS.length; i++) {
    const event = SIMULATED_EVENTS[i]
    ws.send(JSON.stringify(createEnvelope('events:new', event, 'global')))
    console.log(`   [${i + 1}/${SIMULATED_EVENTS.length}] ${event.countryFlag}  ${event.title.slice(0, 60)}...`)
    console.log(`         Severity: ${event.severity.toUpperCase()} | Sentiment: ${event.sentiment}`)
    console.log()

    // Stagger events 2 seconds apart
    await sleep(2000)

    // Increment counters with each event
    if (event.sentiment === 'escalation') {
      counterUpdate.activeConflicts!++
      counterUpdate.tensions! += 2
    }
    ws.send(JSON.stringify(createEnvelope('counters:update', counterUpdate, 'global')))
  }

  // ---- Phase 3: Prediction Update ----
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📈 Phase 3: Prediction Probability Update')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   Prediction probabilities will shift.\n')

  const predictionUpdate: PredictionUpdatePayload = {
    id: 'pred-ceasefire',
    probabilityYes: 58,
    totalVotes: 1903,
    lastVoteAt: new Date().toISOString(),
  }
  ws.send(JSON.stringify(createEnvelope('predictions:update', predictionUpdate, 'prediction:pred-ceasefire')))
  console.log('   → Ceasefire prediction: 62% → 58% (probability dropped)')
  console.log()

  await sleep(1500)

  // ---- Phase 4: Rapid-fire counter updates ----
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('⚡ Phase 4: Rapid Counter Updates')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   Watch the counters animate in rapid succession!\n')

  for (let i = 0; i < 5; i++) {
    counterUpdate.aircraft! += Math.floor(Math.random() * 20) + 5
    counterUpdate.tensions! += Math.random() > 0.5 ? 1 : 0
    ws.send(JSON.stringify(createEnvelope('counters:update', counterUpdate, 'global')))
    console.log(`   [${i + 1}/5] Aircraft: ${counterUpdate.aircraft} | Tensions: ${counterUpdate.tensions}`)
    await sleep(800)
  }

  console.log()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Test complete! Check your dashboard at http://localhost:5173/')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()
  console.log('You should see:')
  console.log('  ✓ Navbar counters with animated increment + glow flash')
  console.log('  ✓ 5 new events in the Pulse Feed')
  console.log('  ✓ Green "new events" banner at top of feed')
  console.log('  ✓ Aircraft counter animated on the globe')
  console.log()

  ws.close()
  process.exit(0)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(err => {
  console.error('❌ Test failed:', err.message)
  process.exit(1)
})
