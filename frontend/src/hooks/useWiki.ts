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

export function useWikiArticles(campaignId: string, filters: WikiFilters = {}) {
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

export function useWikiSearch(campaignId: string, q: string) {
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

export function useWikiArticle(id: string | undefined) {
  return useQuery<WikiArticleDetail>({
    queryKey: ['wiki', id],
    queryFn: async () => {
      const { data } = await apiClient.get<WikiArticleDetail>(`/wiki/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateWikiArticle(campaignId: string) {
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

export function useUpdateWikiArticle(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    WikiArticle,
    Error,
    { id: string; title: string; category: string; is_stub: boolean; image_url: string | null; tags: string[] | null; public_content: string; private_content: string }
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

export function useDeleteWikiArticle(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`/wiki/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
    },
  })
}

export function useAddWikiAssociation(articleId: string, campaignId: string) {
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

export function useDeleteWikiAssociation(articleId: string, campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (associationId) => {
      await apiClient.delete(`/wiki/associations/${associationId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki', articleId] })
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId, 'wiki'] })
    },
  })
}

export function useImportWiki(campaignId: string) {
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

export function exportWikiAll(campaignId: string): Promise<void> {
  return apiClient.get<WikiExportResponse>('/wiki/export', {
    params: { campaign_id: campaignId },
  }).then(({ data }) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'wiki-export.json'
    link.click()
    URL.revokeObjectURL(url)
  })
}

export function exportWikiArticle(articleId: string, title: string): Promise<void> {
  return apiClient.get<WikiExportResponse>(`/wiki/${articleId}/export`).then(({ data }) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `wiki-${title.toLowerCase().replace(/\s+/g, '-')}.json`
    link.click()
    URL.revokeObjectURL(url)
  })
}
