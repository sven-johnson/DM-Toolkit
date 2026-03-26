import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Roll, RollHistoryItem, SessionRollOut } from '../types'

interface UpsertRollBody {
  checkId: number
  characterId: number
  dieResult: number
}

interface DeleteRollBody {
  checkId: number
  characterId: number
}

export function useUpsertRoll(sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation<Roll, Error, UpsertRollBody>({
    mutationFn: async ({ checkId, characterId, dieResult }) => {
      const { data } = await apiClient.put<Roll>(
        `/rolls/${checkId}/${characterId}`,
        { die_result: dieResult },
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['sessionRolls', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['rollHistory'] })
    },
  })
}

export function useDeleteRoll(sessionId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, DeleteRollBody>({
    mutationFn: async ({ checkId, characterId }) => {
      await apiClient.delete(`/rolls/${checkId}/${characterId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['sessionRolls', sessionId] })
      queryClient.invalidateQueries({ queryKey: ['rollHistory'] })
    },
  })
}

export function useSessionRolls(sessionId: number) {
  return useQuery<SessionRollOut[]>({
    queryKey: ['sessionRolls', sessionId],
    queryFn: async () => {
      const { data } = await apiClient.get<SessionRollOut[]>(
        `/sessions/${sessionId}/rolls`,
      )
      return data
    },
  })
}

export function useRollHistory() {
  return useQuery<RollHistoryItem[]>({
    queryKey: ['rollHistory'],
    queryFn: async () => {
      const { data } = await apiClient.get<RollHistoryItem[]>('/rolls/history')
      return data
    },
  })
}
