/**
 * AI Smart Digest Service — Pluggable Intelligence Summarization
 *
 * Generates daily intelligence briefings from recent events using
 * a pluggable AI provider architecture with fallback chain:
 *
 *   1. HuggingFace Inference API (primary)
 *   2. Local extractive summarization (fallback)
 *
 * Results are cached in Redis with a configurable TTL.
 *
 * Usage:
 *   const digest = await generateSmartDigest(db)
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { desc, gte } from 'drizzle-orm'
import type { Database } from '../db'
import { createDb } from '../db'
import { events } from '../db/schema'
import { createRedis, REDIS_KEYS } from '../lib/redis'

// Load .env manually (for standalone script execution)
try {
  const envPath = resolve(process.cwd(), '.env')
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
} catch {}

// =============================================
// Types
// =============================================

export interface SmartDigest {
  /** The date this digest covers (YYYY-MM-DD) */
  date: string
  /** Generated at timestamp */
  generatedAt: string
  /** Main briefing headline */
  headline: string
  /** Full briefing body (markdown) */
  body: string
  /** Key bullet points */
  keyPoints: string[]
  /** Threat level assessment */
  threatLevel: 'critical' | 'elevated' | 'moderate' | 'low'
  /** Regions mentioned */
  regionsOfConcern: string[]
  /** Number of events analyzed */
  eventsAnalyzed: number
  /** Which AI provider was used */
  provider: string
}

export interface AIProvider {
  name: string
  generate: (prompt: string) => Promise<string>
  isAvailable: () => boolean
}

// =============================================
// AI Providers
// =============================================

/**
 * HuggingFace Inference API Provider
 * Uses the Mistral-7B-Instruct model for summarization.
 */
function createHuggingFaceProvider(): AIProvider {
  const apiKey = process.env.HUGGINGFACE_API_KEY

  return {
    name: 'HuggingFace',
    isAvailable: () => !!apiKey,
    generate: async (prompt: string): Promise<string> => {
      if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not set')

      const model = 'mistralai/Mistral-7B-Instruct-v0.3'
      const url = `https://api-inference.huggingface.co/models/${model}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000) // 60s timeout

      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: `<s>[INST] ${prompt} [/INST]`,
            parameters: {
              max_new_tokens: 800,
              temperature: 0.3,
              top_p: 0.9,
              do_sample: true,
              return_full_text: false,
            },
          }),
        })
        clearTimeout(timeout)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HuggingFace API error ${response.status}: ${errorText}`)
        }

        const result = await response.json() as Array<{ generated_text: string }>
        return result?.[0]?.generated_text?.trim() || ''
      } catch (err) {
        clearTimeout(timeout)
        throw err
      }
    },
  }
}

/**
 * Local extractive summarization fallback.
 * Generates a structured briefing without any external API whatsoever.
 * Uses statistical analysis of events to produce a professional-looking digest.
 */
function createLocalFallbackProvider(): AIProvider {
  return {
    name: 'Local Analysis',
    isAvailable: () => true,
    generate: async (_prompt: string): Promise<string> => {
      // This is a marker — we'll handle local generation
      // directly in the orchestrator where we have access to the raw event data.
      return '__LOCAL_FALLBACK__'
    },
  }
}

// =============================================
// Provider Chain
// =============================================

function getProviderChain(): AIProvider[] {
  return [
    createHuggingFaceProvider(),
    createLocalFallbackProvider(),
  ]
}

// =============================================
// Prompt Engineering
// =============================================

function buildDigestPrompt(eventSummaries: string[]): string {
  const eventList = eventSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')

  return `You are WatchOver, an elite geopolitical intelligence analyst.
Analyze the following ${eventSummaries.length} recent intelligence events and produce a concise, professional daily briefing.

EVENTS:
${eventList}

INSTRUCTIONS:
- Write a 2-3 sentence executive summary headline
- Identify the top 3-5 key developments as bullet points
- Assess the overall global threat level (CRITICAL / ELEVATED / MODERATE / LOW)
- List regions of highest concern
- Be factual, analytical, and avoid speculation
- Write in a terse, Bloomberg-terminal intelligence style
- Do NOT use emojis

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
HEADLINE: [your headline here]

KEY POINTS:
- [point 1]
- [point 2]
- [point 3]

THREAT LEVEL: [CRITICAL/ELEVATED/MODERATE/LOW]

REGIONS: [region1, region2, region3]

ANALYSIS:
[2-3 paragraph detailed analysis]`
}

// =============================================
// Parse AI Response
// =============================================

function parseAIResponse(raw: string): {
  headline: string
  keyPoints: string[]
  threatLevel: SmartDigest['threatLevel']
  regionsOfConcern: string[]
  body: string
} {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  // Extract headline
  let headline = 'Daily Intelligence Briefing'
  const headlineIdx = lines.findIndex(l => l.startsWith('HEADLINE:'))
  if (headlineIdx !== -1) {
    headline = lines[headlineIdx].replace('HEADLINE:', '').trim()
  }

  // Extract key points
  const keyPoints: string[] = []
  const keyPointsIdx = lines.findIndex(l => l.startsWith('KEY POINTS:'))
  if (keyPointsIdx !== -1) {
    for (let i = keyPointsIdx + 1; i < lines.length; i++) {
      if (lines[i].startsWith('-') || lines[i].startsWith('•')) {
        keyPoints.push(lines[i].replace(/^[-•]\s*/, '').trim())
      } else if (lines[i].startsWith('THREAT') || lines[i].startsWith('REGIONS') || lines[i].startsWith('ANALYSIS')) {
        break
      }
    }
  }

  // Extract threat level
  let threatLevel: SmartDigest['threatLevel'] = 'moderate'
  const threatIdx = lines.findIndex(l => l.startsWith('THREAT LEVEL:'))
  if (threatIdx !== -1) {
    const level = lines[threatIdx].replace('THREAT LEVEL:', '').trim().toLowerCase()
    if (level.includes('critical')) threatLevel = 'critical'
    else if (level.includes('elevated')) threatLevel = 'elevated'
    else if (level.includes('low')) threatLevel = 'low'
    else threatLevel = 'moderate'
  }

  // Extract regions
  let regionsOfConcern: string[] = []
  const regionsIdx = lines.findIndex(l => l.startsWith('REGIONS:'))
  if (regionsIdx !== -1) {
    regionsOfConcern = lines[regionsIdx]
      .replace('REGIONS:', '')
      .split(',')
      .map(r => r.trim())
      .filter(Boolean)
  }

  // Extract analysis body
  let body = ''
  const analysisIdx = lines.findIndex(l => l.startsWith('ANALYSIS:'))
  if (analysisIdx !== -1) {
    body = lines.slice(analysisIdx + 1).join('\n').trim()
  }

  // Fallback body if no analysis section
  if (!body) {
    body = keyPoints.length > 0
      ? keyPoints.map(p => `• ${p}`).join('\n')
      : raw.slice(0, 500)
  }

  return { headline, keyPoints, threatLevel, regionsOfConcern, body }
}

// =============================================
// Local Fallback Generator
// =============================================

interface EventRow {
  title: string
  severity: string
  sentiment: string
  region: string | null
  country: string | null
  summary: string | null
  publishedAt: Date
}

function generateLocalDigest(recentEvents: EventRow[]): SmartDigest {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  // Severity distribution
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  const sentimentCounts = { escalation: 0, 'de-escalation': 0, neutral: 0 }
  const regionCounts: Record<string, number> = {}

  for (const event of recentEvents) {
    const sev = event.severity as keyof typeof severityCounts
    if (sev in severityCounts) severityCounts[sev]++

    const sent = event.sentiment as keyof typeof sentimentCounts
    if (sent in sentimentCounts) sentimentCounts[sent]++

    const region = event.region || event.country || 'Unknown'
    regionCounts[region] = (regionCounts[region] || 0) + 1
  }

  // Determine threat level
  let threatLevel: SmartDigest['threatLevel'] = 'low'
  if (severityCounts.critical >= 3) threatLevel = 'critical'
  else if (severityCounts.critical >= 1 || severityCounts.high >= 5) threatLevel = 'elevated'
  else if (severityCounts.high >= 2) threatLevel = 'moderate'

  // Top regions
  const sortedRegions = Object.entries(regionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([region]) => region)

  // Build key points from highest severity events
  const keyEvents = recentEvents
    .filter(e => e.severity === 'critical' || e.severity === 'high')
    .slice(0, 5)

  const keyPoints = keyEvents.map(e => {
    const regionLabel = e.region || e.country || 'Global'
    return `[${e.severity.toUpperCase()}] ${regionLabel}: ${e.title}`
  })

  if (keyPoints.length === 0) {
    keyPoints.push(
      `${recentEvents.length} events tracked across ${Object.keys(regionCounts).length} regions`,
      `${sentimentCounts.escalation} escalation events, ${sentimentCounts['de-escalation']} de-escalation events detected`,
      'No critical-severity events in the last 24 hours'
    )
  }

  // Build headline
  const totalEvents = recentEvents.length
  const escRatio = totalEvents > 0 ? sentimentCounts.escalation / totalEvents : 0
  let headline: string

  if (threatLevel === 'critical') {
    headline = `CRITICAL: ${severityCounts.critical} critical-severity events detected. Global tension index elevated. Immediate attention required in ${sortedRegions.slice(0, 2).join(' and ')}.`
  } else if (threatLevel === 'elevated') {
    headline = `Elevated activity detected across ${Object.keys(regionCounts).length} regions. ${severityCounts.high} high-severity events tracked. Monitoring ${sortedRegions[0] || 'multiple regions'} closely.`
  } else if (escRatio > 0.4) {
    headline = `Escalation trend identified: ${Math.round(escRatio * 100)}% of events indicate rising tensions. ${sortedRegions.slice(0, 3).join(', ')} are primary areas of concern.`
  } else {
    headline = `${totalEvents} events analyzed across ${Object.keys(regionCounts).length} regions in the last 24 hours. Overall threat assessment: ${threatLevel.toUpperCase()}. Situation stable with normal monitoring cadence.`
  }

  // Build body
  const bodyParts: string[] = []

  bodyParts.push(
    `**Situation Overview:** WatchOver intelligence systems analyzed ${totalEvents} events across ${Object.keys(regionCounts).length} distinct regions in the last 24 hours.`
  )

  if (severityCounts.critical > 0 || severityCounts.high > 0) {
    bodyParts.push(
      `**Severity Distribution:** ${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low-severity events recorded.`
    )
  }

  bodyParts.push(
    `**Sentiment Analysis:** ${sentimentCounts.escalation} escalation indicators, ${sentimentCounts['de-escalation']} de-escalation signals, and ${sentimentCounts.neutral} neutral developments tracked.`
  )

  if (sortedRegions.length > 0) {
    bodyParts.push(
      `**Regional Focus:** Highest activity concentration in ${sortedRegions.slice(0, 3).join(', ')}. ` +
      `Primary monitoring targets identified for continued surveillance.`
    )
  }

  bodyParts.push(
    `**Assessment:** Global threat level assessed at **${threatLevel.toUpperCase()}**. ` +
    (threatLevel === 'critical' || threatLevel === 'elevated'
      ? `Heightened vigilance recommended across all operational sectors.`
      : `Standard monitoring cadence maintained. No immediate action required.`)
  )

  return {
    date: dateStr,
    generatedAt: now.toISOString(),
    headline,
    body: bodyParts.join('\n\n'),
    keyPoints,
    threatLevel,
    regionsOfConcern: sortedRegions,
    eventsAnalyzed: totalEvents,
    provider: 'Local Analysis',
  }
}

// =============================================
// Main Digest Generator
// =============================================

const DIGEST_CACHE_TTL = 6 * 60 * 60 // 6 hours

export async function generateSmartDigest(
  db?: Database,
  forceRefresh = false
): Promise<SmartDigest> {
  const database = db || createDb()
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const cacheKey = REDIS_KEYS.aiBrief(dateStr, 'default')

  // Check cache first (unless forced refresh)
  if (!forceRefresh) {
    try {
      const redis = createRedis()
      const cached = await redis.get<string>(cacheKey)
      if (cached) {
        console.log('[DIGEST] Cache hit — returning cached digest')
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
        return parsed as SmartDigest
      }
    } catch {
      console.warn('[DIGEST] Redis unavailable for cache check')
    }
  }

  console.log('[DIGEST] Generating new Smart Digest...')

  // Fetch events from the last 24 hours
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const recentEvents = await database
    .select({
      title: events.title,
      severity: events.severity,
      sentiment: events.sentiment,
      region: events.region,
      country: events.country,
      summary: events.summary,
      publishedAt: events.publishedAt,
    })
    .from(events)
    .where(gte(events.publishedAt, since))
    .orderBy(desc(events.publishedAt))
    .limit(100)

  console.log(`[DIGEST] Found ${recentEvents.length} events in the last 24h`)

  if (recentEvents.length === 0) {
    const emptyDigest: SmartDigest = {
      date: dateStr,
      generatedAt: now.toISOString(),
      headline: 'No recent events to analyze. Intelligence monitoring continues.',
      body: 'WatchOver intelligence systems are active. No significant events have been detected in the last 24 hours. Standard monitoring cadence is maintained across all operational sectors.',
      keyPoints: ['No significant events detected', 'Monitoring systems operational', 'Standard surveillance cadence maintained'],
      threatLevel: 'low',
      regionsOfConcern: [],
      eventsAnalyzed: 0,
      provider: 'Local Analysis',
    }
    await cacheDigest(cacheKey, emptyDigest)
    return emptyDigest
  }

  // Build event summaries for the AI prompt
  const eventSummaries = recentEvents.slice(0, 50).map(e => {
    const region = e.region || e.country || 'Unknown'
    return `[${e.severity.toUpperCase()}/${e.sentiment}] ${region}: ${e.title}${e.summary ? ` — ${e.summary.slice(0, 150)}` : ''}`
  })

  // Try AI providers in order
  const providers = getProviderChain()
  let digest: SmartDigest | null = null

  for (const provider of providers) {
    if (!provider.isAvailable()) {
      console.log(`[DIGEST] Skipping ${provider.name} (not available)`)
      continue
    }

    try {
      console.log(`[DIGEST] Trying provider: ${provider.name}`)

      if (provider.name === 'Local Analysis') {
        // Use local analytical generator
        digest = generateLocalDigest(recentEvents)
        break
      }

      // Use AI provider
      const prompt = buildDigestPrompt(eventSummaries)
      const rawResponse = await provider.generate(prompt)

      if (!rawResponse || rawResponse.length < 50) {
        console.warn(`[DIGEST] ${provider.name} returned insufficient response`)
        continue
      }

      const parsed = parseAIResponse(rawResponse)

      digest = {
        date: dateStr,
        generatedAt: now.toISOString(),
        headline: parsed.headline,
        body: parsed.body,
        keyPoints: parsed.keyPoints.length > 0 ? parsed.keyPoints : ['Analysis complete'],
        threatLevel: parsed.threatLevel,
        regionsOfConcern: parsed.regionsOfConcern,
        eventsAnalyzed: recentEvents.length,
        provider: provider.name,
      }

      console.log(`[DIGEST] Successfully generated via ${provider.name}`)
      break
    } catch (err) {
      console.error(`[DIGEST] ${provider.name} failed:`, err)
      continue
    }
  }

  // Final fallback if all providers failed
  if (!digest) {
    console.warn('[DIGEST] All providers failed, using minimal local fallback')
    digest = generateLocalDigest(recentEvents)
  }

  // Cache the result
  await cacheDigest(cacheKey, digest)

  return digest
}

// =============================================
// Cache Helpers
// =============================================

async function cacheDigest(key: string, digest: SmartDigest): Promise<void> {
  try {
    const redis = createRedis()
    await redis.set(key, JSON.stringify(digest), { ex: DIGEST_CACHE_TTL })
    console.log(`[DIGEST] Cached digest for ${digest.date}`)
  } catch {
    console.warn('[DIGEST] Failed to cache digest in Redis')
  }
}

/**
 * Retrieve the latest cached digest (from Redis).
 * Returns null if no cached digest is found.
 */
export async function getCachedDigest(
  date?: string,
  variant: string = 'default'
): Promise<SmartDigest | null> {
  const dateStr = date || new Date().toISOString().split('T')[0]
  const cacheKey = REDIS_KEYS.aiBrief(dateStr, variant)

  try {
    const redis = createRedis()
    const cached = await redis.get<string>(cacheKey)
    if (cached) {
      return (typeof cached === 'string' ? JSON.parse(cached) : cached) as SmartDigest
    }
  } catch {
    // Redis unavailable
  }

  return null
}
