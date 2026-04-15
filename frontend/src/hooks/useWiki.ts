import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type {
  WikiAddAssociationRequest,
  WikiAddAssociationResult,
  WikiArticle,
  WikiArticleDetail,
  WikiExportResponse,
  WikiImportRequest,
  WikiImportResult,
  WikiSearchResult,
} from '../types'

interface WikiFilters {
  category?: string
  tag?: string
  q?: string
  stubs?: boolean
}

export function useWikiArticles(campaignId: number, filters: WikiFilters = {}) {
  return useQuery<WikiArticle[]>({
    queryKey: ['campaigns', campaignId, 'wiki', filters],
    queryFn: async () => {
      const params: Record<string, unknown> = { campaign_id: campaignId }
      if (filters.category) params.category = filters.category
      if (filters.tag) params.tag = filters.tag
      if (filters.q) params.q = filters.q
      if (filters.stubs !== undefined) params.stubs = filters.stubs
      const { data } = await apiClient.get<WikiArticle[]>('/wiki', { params })
      return data
    },
    enabled: !!campaignId,
    staleTime: 0,
  })
}

export function useWikiSearch(campaignId: number, q: string) {
  return useQuery<WikiSearchResult[]>({
    queryKey: ['campaigns', campaignId, 'wiki', 'search', q],
    queryFn: async () => {
      if (!q.trim()) return []
      const { data } = await apiClient.get<WikiSearchResult[]>('/wiki/search', {
        params: { campaign_id: campaignId, q },
      })
      return data
    },
    enabled: !!campaignId && !!q.trim(),
    staleTime: 0,
  })
}

export function useWikiArticle(id: number | undefined) {
  return useQuery<WikiArticleDetail>({
    queryKey: ['wiki', id],
    queryFn: async () => {
      const { data } = await apiClient.get<WikiArticleDetail>(`/wiki/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateWikiArticle(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<WikiArticle, Error, Omit<WikiArticle, 'id' | 'created_at' | 'updated_at'>>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<WikiArticle>('/wiki', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
    },
  })
}

export function useUpdateWikiArticle(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<
    WikiArticle,
    Error,
    { id: number; title: string; category: string; is_stub: boolean; image_url: string | null; tags: string[] | null; public_content: string; private_content: string }
  >({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<WikiArticle>(`/wiki/${id}`, body)
      return data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
      queryClient.invalidateQueries({ queryKey: ['wiki', id] })
    },
  })
}

export function useDeleteWikiArticle(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiClient.delete(`/wiki/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
    },
  })
}

export function useAddWikiAssociation(articleId: number, campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<WikiAddAssociationResult, Error, WikiAddAssociationRequest>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<WikiAddAssociationResult>(
        `/wiki/${articleId}/associations`,
        body,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', articleId] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
    },
  })
}

export function useDeleteWikiAssociation(articleId: number, campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (associationId) => {
      await apiClient.delete(`/wiki/associations/${associationId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', articleId] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
    },
  })
}

export function useImportWiki(campaignId: number) {
  const queryClient = useQueryClient()
  return useMutation<WikiImportResult, Error, WikiImportRequest>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<WikiImportResult>('/wiki/import', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
    },
  })
}

export async function exportWikiAll(campaignId: number): Promise<void> {
  const { data } = await apiClient.get<WikiExportResponse>('/wiki/export', {
    params: { campaign_id: campaignId },
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'wiki-export.json'
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportWikiArticle(articleId: number, title: string): Promise<void> {
  const { data } = await apiClient.get<WikiExportResponse>(`/wiki/${articleId}/export`)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `wiki-${title.toLowerCase().replace(/\s+/g, '-')}.json`
  link.click()
  URL.revokeObjectURL(url)
}
