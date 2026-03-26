import { useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Check } from '../types'

interface CreateCheckBody {
  scene_id: number
  check_type: string
  subtype: string
  dc: number
  character_ids: number[]
}

interface UpdateCheckBody {
  id: number
  check_type?: string
  subtype?: string
  dc?: number
  character_ids?: number[]
  order_index?: number
}

export function useCreateCheck(sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation<Check, Error, CreateCheckBody>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Check>(
        `/scenes/${body.scene_id}/checks`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}

export function useUpdateCheck(sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation<Check, Error, UpdateCheckBody>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<Check>(`/checks/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}

export function useDeleteCheck(sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/checks/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}

export function useReorderChecks(sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, { sceneId: number; checkIds: number[] }>({
    mutationFn: async ({ sceneId, checkIds }) => {
      await apiClient.put(`/scenes/${sceneId}/checks/reorder`, {
        check_ids: checkIds,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
    },
  })
}
