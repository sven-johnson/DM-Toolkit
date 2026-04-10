import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Session } from '../types'

export function useSessions(campaignId: number) {
  return useQuery<Session[]>({
    queryKey: ['campaigns', campaignId, 'sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get<Session[]>(
        `/campaigns/${campaignId}/sessions`,
      )
      return data
    },
    enabled: !!campaignId,
  })
}

export function useCreateSession(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<
    Session,
    Error,
    { title: string; date?: string | null; storyline_id?: number | null }
  >({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Session>(
        `/campaigns/${campaignId}/sessions`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'sessions'] })
    },
  })
}

export function useDeleteSession(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/campaigns/${campaignId}/sessions/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'sessions'] })
    },
  })
}
