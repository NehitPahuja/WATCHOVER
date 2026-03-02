/**
 * Ingestion Module Exports
 */

export { startRssWorker, fetchAndProcessFeed, RSS_FEEDS } from './rss-worker'
export type { RssFeedConfig } from './rss-worker'

export { deduplicateEvent, isDuplicate, markAsSeen, generateEventHash } from './dedup'
export type { RawIngestedEvent } from './dedup'

export { runAllConnectors, fetchGdeltEvents, fetchReliefWebEvents } from './connectors'
export type { ConnectorResult } from './connectors'
