import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Character } from '../types'

export function useCharacters(campaignId?: string) {
  return useQuery<Character[]>({
    queryKey: ['campaigns', campaignId, 'characters'],
    queryFn: async () => {
      const { data } = await apiClient.get<Character[]>(`/campaigns/${campaignId}/characters`)
      return data
    },
    enabled: !!campaignId,
  })
}

export function useCreateCharacter(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation<Character, Error, Partial<Character>>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Character>(
        `/campaigns/${campaignId}/characters`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'characters'] })
    },
  })
}

export function useUpdateCharacter(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation<Character, Error, { id: string } & Partial<Character>>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<Character>(`/characters/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'characters'] })
    },
  })
}

export function useDeleteCharacter(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`/characters/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'characters'] })
    },
  })
}

export function useImportCharacterPdf(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation<Character, Error, { file: File; characterId?: string }>({
    mutationFn: async ({ file, characterId }) => {
      const formData = new FormData()
      formData.append('pdf_file', file)
      formData.append('campaign_id', campaignId)
      if (characterId !== undefined) {
        formData.append('character_id', characterId)
      }
      const { data } = await apiClient.post<Character>('/characters/import-pdf', formData)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'characters'] })
    },
  })
}
