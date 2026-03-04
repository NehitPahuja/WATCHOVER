/**
 * Ingestion Worker — RSS/News Polling
 *
 * Polls configured RSS/Atom feeds for new intelligence items.
 * Parses entries, deduplicates, stores in Postgres, and fans out
 * to the relay server for real-time delivery.
 *
 * Usage: npx tsx server/ingestion/rss-worker.ts
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createDb } from '../db'
import * as schema from '../db/schema'
import { deduplicateEvent, type RawIngestedEvent } from './dedup'
import { RelayPublisher } from '../relay/publisher'
import type { EventNewPayload } from '../relay/protocol'

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
// Configuration
// =============================================

export interface RssFeedConfig {
  name: string
  url: string
  /** Polling interval in ms */
  interval: number
  /** Default severity for items from this source */
  defaultSeverity: 'critical' | 'high' | 'medium' | 'low'
  /** Default category tag */
  category: string
  /** Source credibility score 0-100 */
  credibility: number
  /** Whether this feed is currently enabled */
  enabled: boolean
}

/** Curated list of intelligence-relevant RSS feeds */
export const RSS_FEEDS: RssFeedConfig[] = [
  {
    name: 'Reuters World',
    url: 'https://feeds.reuters.com/Reuters/worldNews',
    interval: 120_000,
    defaultSeverity: 'medium',
    category: 'General',
    credibility: 95,
    enabled: true,
  },
  {
    name: 'BBC World',
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    interval: 120_000,
    defaultSeverity: 'medium',
    category: 'General',
    credibility: 94,
    enabled: true,
  },
  {
    name: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    interval: 120_000,
    defaultSeverity: 'medium',
    category: 'General',
    credibility: 82,
    enabled: true,
  },
  {
    name: 'SIPRI News',
    url: 'https://www.sipri.org/rss.xml',
    interval: 120_000,
    defaultSeverity: 'medium',
    category: 'Military',
    credibility: 92,
    enabled: true,
  },
  {
    name: 'UN News',
    url: 'https://news.un.org/feed/subscribe/en/news/all/rss.xml',
    interval: 120_000,
    defaultSeverity: 'low',
    category: 'Diplomatic',
    credibility: 97,
    enabled: true,
  },
]

// =============================================
// RSS Parser (lightweight, no external deps)
// =============================================

interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
  guid?: string
}

/**
 * Parse RSS/Atom XML into simplified items.
 * Handles both RSS 2.0 and Atom feeds.
 */
function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = []

  // RSS 2.0: <item> tags
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    const description = extractTag(block, 'description')
    const pubDate = extractTag(block, 'pubDate')
    const guid = extractTag(block, 'guid')

    if (title) {
      items.push({
        title: stripHtml(title),
        link: link || '',
        description: stripHtml(description || ''),
        pubDate: pubDate || new Date().toISOString(),
        guid: guid || link || title,
      })
    }
  }

  // Atom fallback: <entry> tags
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1]
      const title = extractTag(block, 'title')
      const linkMatch = block.match(/<link[^>]*href="([^"]*)"/)
      const link = linkMatch ? linkMatch[1] : extractTag(block, 'link')
      const summary = extractTag(block, 'summary') || extractTag(block, 'content')
      const updated = extractTag(block, 'updated') || extractTag(block, 'published')
      const id = extractTag(block, 'id')

      if (title) {
        items.push({
          title: stripHtml(title),
          link: link || '',
          description: stripHtml(summary || ''),
          pubDate: updated || new Date().toISOString(),
          guid: id || link || title,
        })
      }
    }
  }

  return items
}

function extractTag(xml: string, tag: string): string | null {
  // Try CDATA first
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i')
  const cdataMatch = xml.match(cdataRegex)
  if (cdataMatch) return cdataMatch[1].trim()

  // Then plain text
  const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const plainMatch = xml.match(plainRegex)
  if (plainMatch) return plainMatch[1].trim()

  return null
}

function stripHtml(str: string): string {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================
// Severity Classification (keyword-based)
// =============================================

const SEVERITY_KEYWORDS: Record<string, 'critical' | 'high' | 'medium'> = {
  // Critical
  'nuclear': 'critical',
  'invasion': 'critical',
  'declaration of war': 'critical',
  'wmd': 'critical',
  'mass casualty': 'critical',
  // High
  'military': 'high',
  'attack': 'high',
  'missile': 'high',
  'airstrike': 'high',
  'bombing': 'high',
  'artillery': 'high',
  'troops': 'high',
  'sanctions': 'high',
  'cyber attack': 'high',
  'escalation': 'high',
  'conflict': 'high',
  'casualties': 'high',
  // Medium
  'ceasefire': 'medium',
  'negotiations': 'medium',
  'diplomacy': 'medium',
  'tension': 'medium',
  'protest': 'medium',
  'election': 'medium',
  'summit': 'medium',
}

const SENTIMENT_KEYWORDS = {
  escalation: ['attack', 'strike', 'bombing', 'invasion', 'deploy', 'missile', 'casualties', 'escalat'],
  'de-escalation': ['ceasefire', 'peace', 'withdraw', 'agreement', 'de-escalat', 'truce', 'diplomatic'],
}

function classifySeverity(text: string, defaultSeverity: RssFeedConfig['defaultSeverity']): 'critical' | 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase()
  for (const [keyword, severity] of Object.entries(SEVERITY_KEYWORDS)) {
    if (lower.includes(keyword)) return severity
  }
  return defaultSeverity
}

function classifySentiment(text: string): 'escalation' | 'de-escalation' | 'neutral' {
  const lower = text.toLowerCase()
  const escScore = SENTIMENT_KEYWORDS.escalation.filter(k => lower.includes(k)).length
  const deScore = SENTIMENT_KEYWORDS['de-escalation'].filter(k => lower.includes(k)).length
  if (escScore > deScore) return 'escalation'
  if (deScore > escScore) return 'de-escalation'
  return 'neutral'
}

// =============================================
// Fetch + Process Feed
// =============================================

export async function fetchAndProcessFeed(
  feedConfig: RssFeedConfig,
  db: ReturnType<typeof createDb>,
  publisher?: RelayPublisher
): Promise<{ ingested: number; duplicates: number; errors: number }> {
  let ingested = 0
  let duplicates = 0
  let errors = 0

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    const response = await fetch(feedConfig.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WatchOver Intelligence Bot/1.0' },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`[RSS] ${feedConfig.name}: HTTP ${response.status}`)
      return { ingested: 0, duplicates: 0, errors: 1 }
    }

    const xml = await response.text()
    const items = parseRssXml(xml)

    console.log(`[RSS] ${feedConfig.name}: parsed ${items.length} items`)

    for (const item of items.slice(0, 20)) { // Process at most 20 items per poll
      try {
        const rawEvent: RawIngestedEvent = {
          title: item.title,
          summary: item.description.slice(0, 1000),
          sourceUrl: item.link,
          sourceName: feedConfig.name,
          publishedAt: item.pubDate,
          externalId: item.guid || item.link,
        }

        // Deduplication check
        const isDuplicate = await deduplicateEvent(rawEvent)
        if (isDuplicate) {
          duplicates++
          continue
        }

        // Classify
        const fullText = `${item.title} ${item.description}`
        const severity = classifySeverity(fullText, feedConfig.defaultSeverity)
        const sentiment = classifySentiment(fullText)

        // Insert event
        const [inserted] = await db
          .insert(schema.events)
          .values({
            title: item.title.slice(0, 500),
            summary: item.description.slice(0, 2000) || null,
            severity,
            sentiment,
            confidence: feedConfig.credibility,
            category: feedConfig.category,
            sourceRefs: [item.link],
            publishedAt: new Date(item.pubDate),
          })
          .returning({ id: schema.events.id })

        // Insert source
        await db.insert(schema.eventSources).values({
          eventId: inserted.id,
          name: feedConfig.name,
          url: item.link,
          credibility: feedConfig.credibility,
          publishedAt: new Date(item.pubDate),
        })

        // Fan-out to relay
        if (publisher) {
          const payload: EventNewPayload = {
            id: inserted.id,
            title: item.title,
            summary: item.description.slice(0, 500) || 'No summary available.',
            sourceUrl: item.link,
            sourceName: feedConfig.name,
            severity,
            sentiment,
            region: 'Global', // Would be determined by NLP/geolocation in production
            countryFlag: '🌍',
            confidence: feedConfig.credibility,
            publishedAt: new Date(item.pubDate).toISOString(),
          }
          publisher.publishEvent(payload)
        }

        ingested++
      } catch (itemErr) {
        console.error(`[RSS] ${feedConfig.name}: Error processing item "${item.title.slice(0, 40)}":`, itemErr)
        errors++
      }
    }
  } catch (fetchErr) {
    console.error(`[RSS] ${feedConfig.name}: Fetch error:`, fetchErr)
    errors++
  }

  return { ingested, duplicates, errors }
}

// =============================================
// Worker Loop
// =============================================

export async function startRssWorker(
  feeds: RssFeedConfig[] = RSS_FEEDS,
  relayUrl?: string
): Promise<void> {
  const db = createDb()
  let publisher: RelayPublisher | undefined

  // Connect to relay if available
  const effectiveRelayUrl = relayUrl || process.env.RELAY_URL || 'ws://localhost:8080'
  try {
    publisher = new RelayPublisher(effectiveRelayUrl)
    await publisher.connect()
    console.log('[RSS_WORKER] Connected to relay')
  } catch {
    console.warn('[RSS_WORKER] Could not connect to relay, will ingest without fanout')
  }

  console.log(`[RSS_WORKER] Starting with ${feeds.filter(f => f.enabled).length} active feeds`)

  // Set up polling for each feed
  for (const feed of feeds) {
    if (!feed.enabled) continue

    // Initial fetch
    const result = await fetchAndProcessFeed(feed, db, publisher)
    console.log(
      `[RSS_WORKER] ${feed.name}: ingested=${result.ingested}, dups=${result.duplicates}, errors=${result.errors}`
    )

    // Schedule recurring polls
    setInterval(async () => {
      const r = await fetchAndProcessFeed(feed, db, publisher)
      if (r.ingested > 0 || r.errors > 0) {
        console.log(
          `[RSS_WORKER] ${feed.name}: ingested=${r.ingested}, dups=${r.duplicates}, errors=${r.errors}`
        )
      }
    }, feed.interval)
  }

  console.log('[RSS_WORKER] ✓ All feeds scheduled')
}

// =============================================
// Standalone Execution
// =============================================

if (process.argv[1]?.includes('rss-worker')) {
  startRssWorker().catch(err => {
    console.error('[RSS_WORKER] Fatal error:', err)
    process.exit(1)
  })
}
