import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Scene, SessionWithScenes } from '../types'

export function useSession(campaignId: string, sessionId: string) {
  return useQuery<SessionWithScenes>({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data } = await apiClient.get<SessionWithScenes>(
        `/campaigns/${campaignId}/sessions/${sessionId}`,
      )
      return data
    },
    enabled: !!sessionId,
  })
}

export function useUpdateSession(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    SessionWithScenes,
    Error,
    { title?: string; date?: string | null; recap_notes?: string; active_storyline_id?: string | null }
  >({
    mutationFn: async (body) => {
      const { data } = await apiClient.put<SessionWithScenes>(
        `/campaigns/${campaignId}/sessions/${sessionId}`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}

export function useAddNextScene(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation<Scene, Error, void>({
    mutationFn: async () => {
      const { data } = await apiClient.post<Scene>(
        `/campaigns/${campaignId}/sessions/${sessionId}/next-scene`,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}

export function useRemoveSceneFromSession(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (sceneId) => {
      await apiClient.delete(
        `/campaigns/${campaignId}/sessions/${sessionId}/scenes/${sceneId}`,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}

export function useReorderSessionScenes(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string[]>({
    mutationFn: async (sceneIds) => {
      await apiClient.put(
        `/campaigns/${campaignId}/sessions/${sessionId}/scenes/reorder`,
        { scene_ids: sceneIds },
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}
