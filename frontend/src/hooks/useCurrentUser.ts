import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'

export interface CurrentUser {
  id: string
  username: string
  is_admin: boolean
}

export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await apiClient.get<CurrentUser>('/auth/me')
      return data
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}
