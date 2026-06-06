import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../api/client'
import type {
  AbilityFlavor,
  CombatRoleArchetype,
  CreatureArchetype,
  DnDBeyondExport,
  EncounterTemplate,
  GenerateEncounterInput,
  GeneratedEncounter,
  GeneratedMonster,
  GMProfile,
  GMProfileCreate,
  GMProfileUpdate,
  MonsterStatBlock,
  PagedEncounters,
  PagedTemplates,
  Preset,
  RebalanceEncounterInput,
  SavedEncounter,
  SavedEncounterSummary,
  SaveEncounterInput,
  SaveMonsterTemplateInput,
} from '../types/monsterFactory'

const BASE = '/monster-factory'

// ── Reference data (read-only) ────────────────────────────────────────────────

export function useCreatureArchetypes() {
  return useQuery<CreatureArchetype[]>({
    queryKey: ['monster-factory', 'creature-archetypes'],
    queryFn: async () => {
      const { data } = await apiClient.get<CreatureArchetype[]>(`${BASE}/creature-archetypes`)
      return data
    },
  })
}

export function useCombatRoles() {
  return useQuery<CombatRoleArchetype[]>({
    queryKey: ['monster-factory', 'combat-roles'],
    queryFn: async () => {
      const { data } = await apiClient.get<CombatRoleArchetype[]>(`${BASE}/combat-roles`)
      return data
    },
  })
}

export function useEncounterTemplates() {
  return useQuery<EncounterTemplate[]>({
    queryKey: ['monster-factory', 'encounter-templates'],
    queryFn: async () => {
      const { data } = await apiClient.get<EncounterTemplate[]>(`${BASE}/encounter-templates`)
      return data
    },
  })
}

export function useEncounterTemplate(id: string | null) {
  return useQuery<EncounterTemplate>({
    queryKey: ['monster-factory', 'encounter-templates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<EncounterTemplate>(`${BASE}/encounter-templates/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useAbilityFlavors() {
  return useQuery<AbilityFlavor[]>({
    queryKey: ['monster-factory', 'ability-flavors'],
    queryFn: async () => {
      const { data } = await apiClient.get<AbilityFlavor[]>(`${BASE}/ability-flavors`)
      return data
    },
  })
}

// ── GM Profiles ───────────────────────────────────────────────────────────────

export function useGMProfiles() {
  return useQuery<GMProfile[]>({
    queryKey: ['monster-factory', 'profiles'],
    queryFn: async () => {
      const { data } = await apiClient.get<GMProfile[]>(`${BASE}/profiles`)
      return data
    },
  })
}

export function useDefaultGMProfile() {
  return useQuery<GMProfile | undefined>({
    queryKey: ['monster-factory', 'profiles'],
    queryFn: async () => {
      const { data } = await apiClient.get<GMProfile[]>(`${BASE}/profiles`)
      return data
    },
    select: (profiles: GMProfile[]) => profiles.find((p) => p.is_default),
  })
}

// ── Saved encounters ──────────────────────────────────────────────────────────

export function useSavedEncounters(page = 1, perPage = 20) {
  return useQuery<PagedEncounters>({
    queryKey: ['monster-factory', 'encounters', page, perPage],
    queryFn: async () => {
      const { data } = await apiClient.get<PagedEncounters>(`${BASE}/encounters`, {
        params: { page, per_page: perPage },
      })
      return data
    },
  })
}

export function useSavedEncounter(id: string | null) {
  return useQuery<SavedEncounter>({
    queryKey: ['monster-factory', 'encounters', id],
    queryFn: async () => {
      const { data } = await apiClient.get<SavedEncounter>(`${BASE}/encounters/${id}`)
      return data
    },
    enabled: !!id,
  })
}

// ── Monster templates ─────────────────────────────────────────────────────────

export function useMonsterTemplates(page = 1, perPage = 20) {
  return useQuery<PagedTemplates>({
    queryKey: ['monster-factory', 'monster-templates', page, perPage],
    queryFn: async () => {
      const { data } = await apiClient.get<PagedTemplates>(`${BASE}/monsters/templates`, {
        params: { page, per_page: perPage },
      })
      return data
    },
  })
}

export function useMonsterTemplate(id: string | null) {
  return useQuery<MonsterStatBlock>({
    queryKey: ['monster-factory', 'monster-templates', id],
    queryFn: async () => {
      const { data } = await apiClient.get<MonsterStatBlock>(
        `${BASE}/monsters/templates/${id}`,
      )
      return data
    },
    enabled: !!id,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useGenerateEncounter() {
  return useMutation<GeneratedEncounter, Error, GenerateEncounterInput>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<GeneratedEncounter>(`${BASE}/generate`, body)
      return data
    },
  })
}

export function useRebalanceEncounter() {
  return useMutation<GeneratedEncounter, Error, RebalanceEncounterInput>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<GeneratedEncounter>(`${BASE}/rebalance`, body)
      return data
    },
  })
}

export function useSaveEncounter() {
  const queryClient = useQueryClient()
  return useMutation<SavedEncounter, Error, SaveEncounterInput>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<SavedEncounter>(`${BASE}/encounters`, body)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'encounters'] })
    },
  })
}

export function useSaveMonsterTemplate() {
  const queryClient = useQueryClient()
  return useMutation<MonsterStatBlock, Error, SaveMonsterTemplateInput>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<MonsterStatBlock>(
        `${BASE}/monsters/templates`,
        body,
      )
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'monster-templates'] })
    },
  })
}

export function useDeleteEncounter() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE}/encounters/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'encounters'] })
    },
  })
}

export function useDeleteMonsterTemplate() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE}/monsters/templates/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'monster-templates'] })
    },
  })
}

// ── Profile CRUD ──────────────────────────────────────────────────────────────

export function usePresets() {
  return useQuery<Preset[]>({
    queryKey: ['monster-factory', 'presets'],
    queryFn: async () => {
      const { data } = await apiClient.get<Preset[]>(`${BASE}/profiles/presets`)
      return data
    },
  })
}

export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation<GMProfile, Error, GMProfileCreate>({
    mutationFn: async (body) => {
      const { data } = await apiClient.post<GMProfile>(`${BASE}/profiles`, body)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'profiles'] })
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation<GMProfile, Error, { id: string } & GMProfileUpdate>({
    mutationFn: async ({ id, ...body }) => {
      const { data } = await apiClient.put<GMProfile>(`${BASE}/profiles/${id}`, body)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'profiles'] })
    },
  })
}

export function useDeleteProfile() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await apiClient.delete(`${BASE}/profiles/${id}`)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'profiles'] })
    },
  })
}

export function useDuplicateProfile() {
  const queryClient = useQueryClient()
  return useMutation<GMProfile, Error, { source: GMProfile; newName: string }>({
    mutationFn: async ({ source, newName }) => {
      const payload: GMProfileCreate = {
        name: newName,
        is_default: false,
        lethality: source.lethality,
        combat_duration: source.combat_duration,
        action_economy: source.action_economy,
        hit_rate: source.hit_rate,
        saving_throw: source.saving_throw,
        minion: source.minion,
        warnings: source.warnings,
      }
      const { data } = await apiClient.post<GMProfile>(`${BASE}/profiles`, payload)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'profiles'] })
    },
  })
}

export function useSetDefaultProfile() {
  const queryClient = useQueryClient()
  return useMutation<GMProfile, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.post<GMProfile>(`${BASE}/profiles/${id}/set-default`)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['monster-factory', 'profiles'] })
    },
  })
}

// ── D&D Beyond export ─────────────────────────────────────────────────────────

export function useExportDnDBeyond() {
  return useMutation<DnDBeyondExport, Error, GeneratedMonster>({
    mutationFn: async (monster) => {
      const { data } = await apiClient.post<DnDBeyondExport>(
        `${BASE}/export/dndbeyond`,
        { monster },
      )
      return data
    },
  })
}

// Re-export GeneratedMonster so consumers can import from this module
export type { GeneratedMonster }
