import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { Character } from '../types'

export function useCharacters() {
  return useQuery<Character[]>({
    queryKey: ['characters'],
    queryFn: async () => {
      const { data } = await apiClient.get<Character[]>('/characters')
      return data
    },
  })
}

export function useCreateCharacter() {
  const queryClient = useQueryClient()
  return useMutation<Character, Error, Partial<Character>>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<Character>('/characters', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] })
    },
  })
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient()
  return useMutation<Character, Error, { id: number } & Partial<Character>>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<Character>(`/characters/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] })
    },
  })
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/characters/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters'] })
    },
  })
}
