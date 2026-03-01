/**
 * API Client for WatchOver
 *
 * Centralized fetch wrapper with base URL, error handling,
 * and typed response parsing.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// =============================================
// Core Fetch Wrapper
// =============================================

interface ApiError {
  status: number
  message: string
}

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error: ApiError = {
      status: res.status,
      message: body.error || `Request failed with status ${res.status}`,
    }
    throw error
  }

  return res.json()
}

// =============================================
// Events API
// =============================================

export interface EventsListParams {
  severity?: string
  sentiment?: string
  region?: string
  since?: string
  limit?: number
  cursor?: string
}

export interface ApiEvent {
  id: string
  title: string
  summary: string | null
  region: string | null
  country: string | null
  countryCode: string | null
  lat: number | null
  lng: number | null
  severity: 'critical' | 'high' | 'medium' | 'low'
  sentiment: 'escalation' | 'de-escalation' | 'neutral'
  confidence: number
  category: string | null
  sourceRefs: string[]
  isLive: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface ApiEventDetail extends ApiEvent {
  sources: {
    id: string
    name: string
    url: string | null
    credibility: number | null
    publishedAt: string | null
  }[]
}

export interface EventsListResponse {
  data: ApiEvent[]
  nextCursor: string | null
}

export interface PredictionsListResponse {
  data: ApiPrediction[]
  meta: { filters: Record<string, unknown>; limit: number }
}

export interface ApiPrediction {
  id: string
  question: string
  description: string | null
  category: string | null
  status: 'active' | 'closed' | 'resolved'
  closesAt: string
  isFeatured: boolean
}

export interface TensionIndexResponse {
  current: number
  change: number
  dataPoints: { date: string; value: number }[]
}

export interface KeywordsResponse {
  data: { rank: number; keyword: string; mentionCount: number; trend: 'up' | 'down' | 'stable' }[]
}

/** Fetch paginated event list */
export function fetchEvents(params: EventsListParams = {}): Promise<EventsListResponse> {
  const query = new URLSearchParams()
  if (params.severity) query.set('severity', params.severity)
  if (params.sentiment) query.set('sentiment', params.sentiment)
  if (params.region) query.set('region', params.region)
  if (params.since) query.set('since', params.since)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.cursor) query.set('cursor', params.cursor)

  const qs = query.toString()
  return apiFetch<EventsListResponse>(`/events${qs ? `?${qs}` : ''}`)
}

/** Fetch single event with sources */
export function fetchEventDetail(id: string): Promise<ApiEventDetail> {
  return apiFetch<ApiEventDetail>(`/events/${id}`)
}

/** Fetch predictions list */
export function fetchPredictions(params: { status?: string; category?: string; limit?: number } = {}): Promise<PredictionsListResponse> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.category) query.set('category', params.category)
  if (params.limit) query.set('limit', String(params.limit))

  const qs = query.toString()
  return apiFetch<PredictionsListResponse>(`/predictions${qs ? `?${qs}` : ''}`)
}

/** Fetch tension index */
export function fetchTensionIndex(days: number = 7): Promise<TensionIndexResponse> {
  return apiFetch<TensionIndexResponse>(`/indices/tension?days=${days}`)
}

/** Fetch trending keywords */
export function fetchKeywords(limit: number = 10): Promise<KeywordsResponse> {
  return apiFetch<KeywordsResponse>(`/keywords?limit=${limit}`)
}

/** Cast a prediction vote */
export function castVote(predictionId: string, side: 'yes' | 'no', token: string): Promise<{ message: string }> {
  return apiFetch(`/predictions/${predictionId}/vote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ side }),
  })
}
