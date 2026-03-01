/** Shared event type used across frontend components */
export interface WatchEvent {
  id: string
  title: string
  summary: string
  region: string
  country: string
  countryCode: string
  countryFlag: string
  lat: number
  lng: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  sentiment: 'escalation' | 'de-escalation' | 'neutral'
  confidence: number
  category: string
  sources: EventSource[]
  contradictions?: string
  activityCount24h: number
  publishedAt: string
  timeAgo: string
}

export interface EventSource {
  name: string
  url: string
  credibility?: number
}

export interface WatchPrediction {
  id: string
  question: string
  description?: string
  category: string
  probabilityYes: number
  totalVotes: number
  timeLeft: string
  closesAt: string
  status: 'active' | 'closed' | 'resolved'
  trend: 'up' | 'down' | 'stable'
}

export interface MarketIndex {
  name: string
  value: string
  change: string
  isUp: boolean
}

export interface TrendingKeyword {
  rank: number
  keyword: string
  mentionCount: number
  trend: 'up' | 'down' | 'stable'
}
