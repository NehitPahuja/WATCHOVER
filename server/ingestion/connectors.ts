/**
 * API Connectors — Conflict & Geopolitical Data Sources
 *
 * Curated connectors for open-source intelligence (OSINT)
 * and conflict tracking APIs. Each connector fetches data,
 * normalizes it to the WatchOver event format, and passes
 * it to the ingestion pipeline.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createDb } from '../db'
import * as schema from '../db/schema'
import { deduplicateEvent, type RawIngestedEvent } from './dedup'
import { RelayPublisher } from '../relay/publisher'
import type { EventNewPayload } from '../relay/protocol'

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

export interface ConnectorResult {
  source: string
  ingested: number
  duplicates: number
  errors: number
}

// =============================================
// GDELT Connector (Global Database of Events)
// =============================================

/**
 * Fetches recent events from the GDELT Event Database API.
 * GDELT tracks news events worldwide and provides free access.
 * API: https://api.gdeltproject.org/api/v2/doc/doc
 */
export async function fetchGdeltEvents(
  db: ReturnType<typeof createDb>,
  publisher?: RelayPublisher
): Promise<ConnectorResult> {
  const result: ConnectorResult = { source: 'GDELT', ingested: 0, duplicates: 0, errors: 0 }

  try {
    // GDELT GKG (Global Knowledge Graph) API — searches for conflict-related articles
    const queries = [
      'military conflict',
      'geopolitical tension',
      'ceasefire agreement',
      'sanctions imposed',
    ]

    const query = queries[Math.floor(Date.now() / 300_000) % queries.length] // rotate queries
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=10&format=json&timespan=1h`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WatchOver Intelligence Bot/1.0' },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`[GDELT] HTTP ${response.status}`)
      result.errors++
      return result
    }

    const data = await response.json() as { articles?: Array<{ title?: string; url?: string; seendate?: string; domain?: string }> }
    const articles = data?.articles || []

    for (const article of articles.slice(0, 15)) {
      try {
        const rawEvent: RawIngestedEvent = {
          title: article.title || 'Untitled',
          summary: (article.seendate ? `Published: ${article.seendate}` : '') + (article.domain ? ` via ${article.domain}` : ''),
          sourceUrl: article.url || '',
          sourceName: 'GDELT / ' + (article.domain || 'Unknown'),
          publishedAt: article.seendate ? new Date(article.seendate).toISOString() : new Date().toISOString(),
          externalId: `gdelt:${article.url || article.title}`,
        }

        const isDuplicate = await deduplicateEvent(rawEvent)
        if (isDuplicate) { result.duplicates++; continue }

        const [inserted] = await db
          .insert(schema.events)
          .values({
            title: rawEvent.title.slice(0, 500),
            summary: rawEvent.summary?.slice(0, 2000) || null,
            severity: 'medium',
            sentiment: 'neutral',
            confidence: 70,
            category: 'OSINT',
            sourceRefs: [rawEvent.sourceUrl],
            publishedAt: new Date(rawEvent.publishedAt),
          })
          .returning({ id: schema.events.id })

        await db.insert(schema.eventSources).values({
          eventId: inserted.id,
          name: rawEvent.sourceName,
          url: rawEvent.sourceUrl,
          credibility: 70,
          publishedAt: new Date(rawEvent.publishedAt),
        })

        if (publisher) {
          const payload: EventNewPayload = {
            id: inserted.id,
            title: rawEvent.title,
            severity: 'medium',
            sentiment: 'neutral',
            region: 'Global',
            countryFlag: '🌍',
            confidence: 70,
            publishedAt: rawEvent.publishedAt,
          }
          publisher.publishEvent(payload)
        }

        result.ingested++
      } catch (err) {
        result.errors++
        console.error('[GDELT] Item error:', err)
      }
    }
  } catch (err) {
    result.errors++
    console.error('[GDELT] Fetch error:', err)
  }

  return result
}

// =============================================
// ReliefWeb Connector (UN OCHA)
// =============================================

/**
 * Fetches from ReliefWeb API — the UN's humanitarian information portal.
 * Provides structured data about crises, disasters, and conflicts.
 * API: https://apidoc.rwlabs.org/
 */
export async function fetchReliefWebEvents(
  db: ReturnType<typeof createDb>,
  publisher?: RelayPublisher
): Promise<ConnectorResult> {
  const result: ConnectorResult = { source: 'ReliefWeb', ingested: 0, duplicates: 0, errors: 0 }

  try {
    const url = 'https://api.reliefweb.int/v1/reports?appname=watchover&limit=10&sort[]=date:desc&filter[field]=theme&filter[value]=Peace and Security'

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WatchOver Intelligence Bot/1.0' },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      result.errors++
      return result
    }

    const data = await response.json() as { data?: Array<{ id: string; fields?: { title?: string; url?: string; body?: string; date?: { created?: string }; primary_country?: { name?: string } } }> }
    const reports = data?.data || []

    for (const report of reports) {
      try {
        const fields = report.fields || {}
        const title = fields.title || 'Untitled Report'
        const reportUrl = fields.url || ''
        const pubDate = fields.date?.created || new Date().toISOString()
        const country = fields.primary_country?.name || 'Unknown'

        const rawEvent: RawIngestedEvent = {
          title,
          summary: (fields.body || '').slice(0, 500),
          sourceUrl: reportUrl,
          sourceName: 'ReliefWeb (UN OCHA)',
          publishedAt: pubDate,
          externalId: `reliefweb:${report.id}`,
        }

        const isDuplicate = await deduplicateEvent(rawEvent)
        if (isDuplicate) { result.duplicates++; continue }

        const [inserted] = await db
          .insert(schema.events)
          .values({
            title: title.slice(0, 500),
            summary: rawEvent.summary || null,
            severity: 'medium',
            sentiment: 'neutral',
            confidence: 88,
            category: 'Humanitarian',
            country: country,
            sourceRefs: [reportUrl],
            publishedAt: new Date(pubDate),
          })
          .returning({ id: schema.events.id })

        await db.insert(schema.eventSources).values({
          eventId: inserted.id,
          name: 'ReliefWeb (UN OCHA)',
          url: reportUrl,
          credibility: 88,
          publishedAt: new Date(pubDate),
        })

        if (publisher) {
          const payload: EventNewPayload = {
            id: inserted.id,
            title,
            severity: 'medium',
            sentiment: 'neutral',
            region: country,
            countryFlag: '🇺🇳',
            confidence: 88,
            publishedAt: pubDate,
          }
          publisher.publishEvent(payload)
        }

        result.ingested++
      } catch (err) {
        result.errors++
        console.error('[RELIEFWEB] Item error:', err)
      }
    }
  } catch (err) {
    result.errors++
    console.error('[RELIEFWEB] Fetch error:', err)
  }

  return result
}

// =============================================
// Connector Orchestrator
// =============================================

/**
 * Run all API connectors in sequence.
 * Returns aggregated results.
 */
export async function runAllConnectors(
  relayUrl?: string
): Promise<ConnectorResult[]> {
  const db = createDb()
  let publisher: RelayPublisher | undefined

  const effectiveRelayUrl = relayUrl || process.env.RELAY_URL || 'ws://localhost:8080'

  if (effectiveRelayUrl) {
    try {
      publisher = new RelayPublisher(effectiveRelayUrl)
      await publisher.connect()
    } catch {
      console.warn('[CONNECTORS] Could not connect to relay')
    }
  }

  const results: ConnectorResult[] = []

  console.log('[CONNECTORS] Running all API connectors...')

  // GDELT
  const gdeltResult = await fetchGdeltEvents(db, publisher)
  results.push(gdeltResult)
  console.log(`[CONNECTORS] GDELT: +${gdeltResult.ingested} new, ${gdeltResult.duplicates} dups, ${gdeltResult.errors} errors`)

  // ReliefWeb
  const reliefResult = await fetchReliefWebEvents(db, publisher)
  results.push(reliefResult)
  console.log(`[CONNECTORS] ReliefWeb: +${reliefResult.ingested} new, ${reliefResult.duplicates} dups, ${reliefResult.errors} errors`)

  // Disconnect publisher
  publisher?.disconnect()

  const totalIngested = results.reduce((sum, r) => sum + r.ingested, 0)
  console.log(`[CONNECTORS] ✓ Complete. Total ingested: ${totalIngested}`)

  return results
}

// =============================================
// Standalone Execution
// =============================================

if (process.argv[1]?.includes('connectors')) {
  runAllConnectors().catch(err => {
    console.error('[CONNECTORS] Fatal error:', err)
    process.exit(1)
  })
}
