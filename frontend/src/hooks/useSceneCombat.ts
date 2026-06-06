import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import type { MonsterStatBlock } from '../types/monsterFactory'

export function useEnemyStatBlock(sceneId: string | null, enemyId: string | null) {
  return useQuery<MonsterStatBlock>({
    queryKey: ['scene-enemy-stat-block', sceneId, enemyId],
    queryFn: async () => {
      const { data } = await apiClient.get<MonsterStatBlock>(
        `/scenes/${sceneId}/enemies/${enemyId}/stat-block`,
      )
      return data
    },
    enabled: !!sceneId && !!enemyId,
  })
}
