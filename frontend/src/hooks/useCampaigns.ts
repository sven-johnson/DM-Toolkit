import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Campaign, CampaignWithRelations, Storyline } from '../types'

export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await apiClient.get<Campaign[]>('/campaigns')
      return data
    },
  })
}

export function useCampaign(id: number) {
  return useQuery<CampaignWithRelations>({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data } = await apiClient.get<CampaignWithRelations>(`/campaigns/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCampaignStorylines(campaignId: number) {
  return useQuery<Storyline[]>({
    queryKey: ['campaigns', campaignId, 'storylines'],
    queryFn: async () => {
      const { data } = await apiClient.get<Storyline[]>(`/campaigns/${campaignId}/storylines`)
      return data
    },
    enabled: !!campaignId,
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation<Campaign, Error, { name: string }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Campaign>('/campaigns', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation<Campaign, Error, { id: number; name: string }>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<Campaign>(`/campaigns/${id}`, body)
      return data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', id] })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/campaigns/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    },
  })
}
