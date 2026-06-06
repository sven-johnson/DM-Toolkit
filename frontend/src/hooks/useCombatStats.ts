import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type {
  CampaignDetail,
  CharacterTurnSummary,
  CreateLineItemInput,
  CreateTurnInput,
  PartySummaryOut,
  ReorderItemInput,
  StatDefinition,
  StatOut,
  TurnLineItemSummary,
  UpdateLineItemInput,
  UpdateTurnInput,
} from '../types'

// ── Campaign detail (for rule_system.id) ──────────────────────────────────────

export function useCampaignDetail(campaignId: string | null) {
  return useQuery<CampaignDetail>({
    queryKey: ['campaign-detail', campaignId],
    queryFn: async () => {
      const { data } = await apiClient.get<CampaignDetail>(`/campaigns/${campaignId}`)
      return data
    },
    enabled: !!campaignId,
  })
}

// ── Party summary (used by Monster Factory auto-load) ─────────────────────────

export function usePartySummary(campaignId: string | null | undefined) {
  return useQuery<PartySummaryOut>({
    queryKey: ['party-summary', campaignId],
    queryFn: async () => {
      const { data } = await apiClient.get<PartySummaryOut>(
        `/campaigns/${campaignId}/combat/party-summary`,
      )
      return data
    },
    enabled: !!campaignId,
  })
}

// ── Rule system reference data ────────────────────────────────────────────────

export function useStatDefinitions(ruleSystemId: number | null | undefined) {
  return useQuery<StatDefinition[]>({
    queryKey: ['rule-system', ruleSystemId, 'stat-definitions'],
    queryFn: async () => {
      const { data } = await apiClient.get<StatDefinition[]>(
        `/api/v1/rule-systems/${ruleSystemId}/stat-definitions`,
      )
      return data
    },
    enabled: !!ruleSystemId,
  })
}

// ── Character stats ───────────────────────────────────────────────────────────

export function useCharacterStats(characterId: string) {
  return useQuery<StatOut[]>({
    queryKey: ['character-combat-stats', characterId],
    queryFn: async () => {
      const { data } = await apiClient.get<StatOut[]>(
        `/characters/${characterId}/combat/stats`,
      )
      return data
    },
  })
}

export function useUpsertStats(characterId: string) {
  const qc = useQueryClient()
  return useMutation<StatOut[], Error, Array<{ stat_definition_id: number; value: number; override_modifier?: number | null }>>({
    mutationFn: async (body) => {
      const { data } = await apiClient.put<StatOut[]>(
        `/characters/${characterId}/combat/stats`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['character-combat-stats', characterId] })
    },
  })
}

// ── Combat turns ──────────────────────────────────────────────────────────────

const _turnsKey = (characterId: string) => ['character-combat-turns', characterId]

export function useCombatTurns(characterId: string) {
  return useQuery<CharacterTurnSummary[]>({
    queryKey: _turnsKey(characterId),
    queryFn: async () => {
      const { data } = await apiClient.get<CharacterTurnSummary[]>(
        `/characters/${characterId}/combat/turns`,
      )
      return data
    },
  })
}

export function useCreateCombatTurn(characterId: string) {
  const qc = useQueryClient()
  return useMutation<CharacterTurnSummary, Error, CreateTurnInput>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<CharacterTurnSummary>(
        `/characters/${characterId}/combat/turns`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}

export function useUpdateCombatTurn(characterId: string) {
  const qc = useQueryClient()
  return useMutation<CharacterTurnSummary, Error, { turnId: number } & UpdateTurnInput>({
    mutationFn: async ({ turnId, ...body }) => {
      const { data } = await apiClient.put<CharacterTurnSummary>(
        `/characters/${characterId}/combat/turns/${turnId}`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}

export function useDeleteCombatTurn(characterId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (turnId) => {
      await apiClient.delete(`/characters/${characterId}/combat/turns/${turnId}`)
    },
    onMutate: async (turnId) => {
      await qc.cancelQueries({ queryKey: _turnsKey(characterId) })
      const prev = qc.getQueryData<CharacterTurnSummary[]>(_turnsKey(characterId))
      qc.setQueryData<CharacterTurnSummary[]>(
        _turnsKey(characterId),
        (old) => old?.filter((t) => t.id !== turnId) ?? [],
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      const c = ctx as { prev?: CharacterTurnSummary[] } | undefined
      if (c?.prev) qc.setQueryData(_turnsKey(characterId), c.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}

export function useReorderCombatTurns(characterId: string) {
  const qc = useQueryClient()
  return useMutation<{ updated: number }, Error, ReorderItemInput[]>({
    mutationFn: async (body) => {
      const { data } = await apiClient.put<{ updated: number }>(
        `/characters/${characterId}/combat/turns/reorder`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}

// ── Line items ────────────────────────────────────────────────────────────────

export function useCreateLineItem(characterId: string, turnId: number) {
  const qc = useQueryClient()
  return useMutation<TurnLineItemSummary, Error, CreateLineItemInput>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<TurnLineItemSummary>(
        `/characters/${characterId}/combat/turns/${turnId}/items`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}

export function useUpdateLineItem(characterId: string, turnId: number) {
  const qc = useQueryClient()
  return useMutation<TurnLineItemSummary, Error, { itemId: number } & UpdateLineItemInput>({
    mutationFn: async ({ itemId, ...body }) => {
      const { data } = await apiClient.put<TurnLineItemSummary>(
        `/characters/${characterId}/combat/turns/${turnId}/items/${itemId}`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}

export function useDeleteLineItem(characterId: string, turnId: number) {
  const qc = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: async (itemId) => {
      await apiClient.delete(
        `/characters/${characterId}/combat/turns/${turnId}/items/${itemId}`,
      )
    },
    onMutate: async (itemId) => {
      await qc.cancelQueries({ queryKey: _turnsKey(characterId) })
      const prev = qc.getQueryData<CharacterTurnSummary[]>(_turnsKey(characterId))
      qc.setQueryData<CharacterTurnSummary[]>(
        _turnsKey(characterId),
        (old) =>
          old?.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  line_items: t.line_items.filter((li) => li.id !== itemId),
                  turn_total: t.line_items
                    .filter((li) => li.id !== itemId)
                    .reduce((s, li) => s + li.average_damage, 0),
                }
              : t,
          ) ?? [],
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      const c = ctx as { prev?: CharacterTurnSummary[] } | undefined
      if (c?.prev) qc.setQueryData(_turnsKey(characterId), c.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}

export function useReorderLineItems(characterId: string, turnId: number) {
  const qc = useQueryClient()
  return useMutation<{ updated: number }, Error, ReorderItemInput[]>({
    mutationFn: async (body) => {
      const { data } = await apiClient.put<{ updated: number }>(
        `/characters/${characterId}/combat/turns/${turnId}/items/reorder`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: _turnsKey(characterId) })
    },
  })
}
