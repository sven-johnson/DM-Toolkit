import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Scene, SceneEnemy, SceneShopItem, Storyline, StorylineWithScenes } from '../types'

export function useStoryline(campaignId: number, storylineId: number) {
  return useQuery<StorylineWithScenes>({
    queryKey: ['storyline', storylineId],
    queryFn: async () => {
      const { data } = await apiClient.get<StorylineWithScenes>(
        `/campaigns/${campaignId}/storylines/${storylineId}`,
      )
      return data
    },
    enabled: !!storylineId,
  })
}

export function useCreateStoryline(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<Storyline, Error, { title: string; description?: string | null }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Storyline>(
        `/campaigns/${campaignId}/storylines`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'storylines'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })
}

export function useUpdateStoryline(campaignId: number, storylineId: number) {
  const queryClient = useQueryClient()
  return useMutation<Storyline, Error, { title?: string; description?: string | null }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.put<Storyline>(
        `/campaigns/${campaignId}/storylines/${storylineId}`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyline', storylineId] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'storylines'] })
    },
  })
}

export function useDeleteStoryline(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (storylineId) => {
      await apiClient.delete(`/campaigns/${campaignId}/storylines/${storylineId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'storylines'] })
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] })
    },
  })
}

export function useCreateStorylineScene(campaignId: number, storylineId: number) {
  const queryClient = useQueryClient()
  return useMutation<Scene, Error, { title: string; scene_type?: string }>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Scene>(
        `/campaigns/${campaignId}/storylines/${storylineId}/scenes`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyline', storylineId] })
    },
  })
}

export function useReorderStorylineScenes(campaignId: number, storylineId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number[]>({
    mutationFn: async (sceneIds) => {
      await apiClient.put(
        `/campaigns/${campaignId}/storylines/${storylineId}/scenes/reorder`,
        { scene_ids: sceneIds },
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyline', storylineId] })
    },
  })
}

// Scene mutations (used from both session and storyline views)
// queryKey is passed in so each view invalidates its own cache
export function useUpdateScene(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<Scene, Error, { id: number; title?: string; body?: string; dm_notes?: string; scene_type?: string; puzzle_clues?: string | null; puzzle_solution?: string | null }>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<Scene>(`/scenes/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useDeleteScene(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/scenes/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

// Enemies
export function useAddEnemy(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<SceneEnemy, Error, { sceneId: number; name: string; quantity: number }>({
    mutationFn: async ({ sceneId, ...body }) => {
      const { data } = await apiClient.post<SceneEnemy>(`/scenes/${sceneId}/enemies`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useUpdateEnemy(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<SceneEnemy, Error, { sceneId: number; enemyId: number; name?: string; quantity?: number }>({
    mutationFn: async ({ sceneId, enemyId, ...body }) => {
      const { data } = await apiClient.put<SceneEnemy>(`/scenes/${sceneId}/enemies/${enemyId}`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useDeleteEnemy(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { sceneId: number; enemyId: number }>({
    mutationFn: async ({ sceneId, enemyId }) => {
      await apiClient.delete(`/scenes/${sceneId}/enemies/${enemyId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

// Shop items
export function useAddShopItem(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<SceneShopItem, Error, { sceneId: number; name: string; description: string; price: number; currency: string }>({
    mutationFn: async ({ sceneId, ...body }) => {
      const { data } = await apiClient.post<SceneShopItem>(`/scenes/${sceneId}/shop-items`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useUpdateShopItem(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<SceneShopItem, Error, { sceneId: number; itemId: number; name?: string; description?: string; price?: number; currency?: string }>({
    mutationFn: async ({ sceneId, itemId, ...body }) => {
      const { data } = await apiClient.put<SceneShopItem>(`/scenes/${sceneId}/shop-items/${itemId}`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useDeleteShopItem(queryKey: unknown[]) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { sceneId: number; itemId: number }>({
    mutationFn: async ({ sceneId, itemId }) => {
      await apiClient.delete(`/scenes/${sceneId}/shop-items/${itemId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}
