import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  type UseQueryOptions
} from '@tanstack/react-query'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type ApiNotification,
  type ApiNotificationPreferences
} from '../services/api'
import { useAuth } from '@clerk/clerk-react'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly?: boolean) => ['notifications', 'list', { unreadOnly }] as const,
  preferences: ['notifications', 'preferences'] as const,
}

export function useNotifications(unreadOnly = false, options?: Partial<UseQueryOptions<ApiNotification[]>>) {
  const { getToken } = useAuth()
  
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return fetchNotifications(token, unreadOnly)
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    ...options,
  })
}

export function useNotificationPreferences(options?: Partial<UseQueryOptions<ApiNotificationPreferences>>) {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return fetchNotificationPreferences(token)
    },
    staleTime: 60_000,
    ...options,
  })
}

export function useMarkAllReadMutation() {
  const queryClient = useQueryClient()
  const { getToken } = useAuth()

  return useMutation({
    mutationFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return markAllNotificationsRead(token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient()
  const { getToken } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return markNotificationRead(id, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient()
  const { getToken } = useAuth()

  return useMutation({
    mutationFn: async (data: Partial<ApiNotificationPreferences>) => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return updateNotificationPreferences(token, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences })
    },
  })
}
