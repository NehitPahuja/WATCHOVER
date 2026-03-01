/**
 * TanStack Query hooks for data fetching.
 *
 * Provides cached, auto-refreshing, typed queries for all API endpoints.
 * Integrates with the realtime WebSocket relay for instant updates.
 */

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import {
  fetchEvents,
  fetchEventDetail,
  fetchPredictions,
  fetchTensionIndex,
  fetchKeywords,
  castVote,
  type EventsListParams,
  type EventsListResponse,
  type ApiEventDetail,
  type PredictionsListResponse,
  type TensionIndexResponse,
  type KeywordsResponse,
} from '../services/api'

// =============================================
// Query Keys (centralized for cache management)
// =============================================

export const queryKeys = {
  events: {
    all: ['events'] as const,
    list: (params?: EventsListParams) => ['events', 'list', params] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
  },
  predictions: {
    all: ['predictions'] as const,
    list: (params?: Record<string, unknown>) => ['predictions', 'list', params] as const,
  },
  tensionIndex: (days?: number) => ['tensionIndex', days] as const,
  keywords: (limit?: number) => ['keywords', limit] as const,
} as const

// =============================================
// Events
// =============================================

/** Fetch paginated event list with auto-refresh */
export function useEvents(
  params: EventsListParams = {},
  options?: Partial<UseQueryOptions<EventsListResponse>>
) {
  return useQuery({
    queryKey: queryKeys.events.list(params),
    queryFn: () => fetchEvents(params),
    staleTime: 15_000,         // Consider fresh for 15 seconds
    refetchInterval: 30_000,   // Auto-refetch every 30 seconds
    refetchOnWindowFocus: true,
    ...options,
  })
}

/** Infinite scrolling event feed */
export function useInfiniteEvents(params: Omit<EventsListParams, 'cursor'> = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.events.list(params),
    queryFn: ({ pageParam }) => fetchEvents({ ...params, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

/** Fetch single event detail */
export function useEventDetail(
  id: string | null,
  options?: Partial<UseQueryOptions<ApiEventDetail>>
) {
  return useQuery({
    queryKey: queryKeys.events.detail(id!),
    queryFn: () => fetchEventDetail(id!),
    enabled: !!id,
    staleTime: 60_000, // Event details change less frequently
    ...options,
  })
}

// =============================================
// Predictions
// =============================================

/** Fetch predictions list */
export function usePredictions(
  params: { status?: string; category?: string; limit?: number } = {},
  options?: Partial<UseQueryOptions<PredictionsListResponse>>
) {
  return useQuery({
    queryKey: queryKeys.predictions.list(params),
    queryFn: () => fetchPredictions(params),
    staleTime: 30_000,
    refetchInterval: 60_000,
    ...options,
  })
}

/** Cast a vote on a prediction */
export function useVoteMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ predictionId, side, token }: { predictionId: string; side: 'yes' | 'no'; token: string }) =>
      castVote(predictionId, side, token),
    onSuccess: () => {
      // Invalidate predictions cache to refetch updated probabilities
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions.all })
    },
  })
}

// =============================================
// Analytics
// =============================================

/** Fetch Global Tension Index */
export function useTensionIndex(
  days: number = 7,
  options?: Partial<UseQueryOptions<TensionIndexResponse>>
) {
  return useQuery({
    queryKey: queryKeys.tensionIndex(days),
    queryFn: () => fetchTensionIndex(days),
    staleTime: 60_000,
    refetchInterval: 120_000, // Every 2 minutes
    ...options,
  })
}

/** Fetch trending keywords */
export function useKeywords(
  limit: number = 10,
  options?: Partial<UseQueryOptions<KeywordsResponse>>
) {
  return useQuery({
    queryKey: queryKeys.keywords(limit),
    queryFn: () => fetchKeywords(limit),
    staleTime: 60_000,
    refetchInterval: 120_000,
    ...options,
  })
}

// =============================================
// Realtime Cache Updater
// =============================================

/**
 * Call this from the useRealtime onMessage callback to update
 * TanStack Query cache instantly when WebSocket events arrive.
 *
 * Usage:
 *   const queryClient = useQueryClient()
 *   useRealtime({
 *     onMessage: (envelope) => handleRealtimeMessage(queryClient, envelope),
 *   })
 */
export function handleRealtimeMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  envelope: { type: string; payload: unknown }
) {
  switch (envelope.type) {
    case 'events:new':
      // Prepend new event to the list cache
      queryClient.setQueriesData<EventsListResponse>(
        { queryKey: queryKeys.events.all },
        (old) => {
          if (!old) return old
          return {
            ...old,
            data: [envelope.payload as EventsListResponse['data'][0], ...old.data],
          }
        }
      )
      break

    case 'events:update':
      // Invalidate the specific event detail + list
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all })
      break

    case 'predictions:update':
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions.all })
      break

    case 'counters:update':
      // Counters don't go through React Query — handled directly by components
      break
  }
}
