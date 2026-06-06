/**
 * Full-screen modal containing the EncounterWizard with a
 * "Save & Add to Scene" flow wired to scene enemy creation.
 */
import { useAddEnemy } from '../../hooks/useStorylines'
import { useDefaultGMProfile, useSaveEncounter } from '../../hooks/useMonsterFactory'
import type { GeneratedEncounter } from '../../types/monsterFactory'
import { EncounterWizard } from './EncounterWizard'
import './SceneMonsterFactoryModal.css'

interface Props {
  sceneId: string
  campaignId: string
  queryKey: unknown[]
  onClose: () => void
}

export function SceneMonsterFactoryModal({
  sceneId,
  campaignId,
  queryKey,
  onClose,
}: Props) {
  const { data: defaultProfile } = useDefaultGMProfile()
  const gmProfileId              = defaultProfile?.id ?? ''
  const saveMutation             = useSaveEncounter()
  const addEnemyMutation         = useAddEnemy(queryKey)

  async function handleSaveAndAddToScene(name: string, encounter: GeneratedEncounter) {
    const saved = await saveMutation.mutateAsync({
      encounter,
      name,
      gm_profile_id: gmProfileId,
    })
    // Add one enemy row per SavedEncounterMonster entry
    for (const sem of saved.encounter_monsters) {
      await addEnemyMutation.mutateAsync({
        sceneId,
        name: sem.monster_stat_block.name,
        quantity: sem.count,
        saved_encounter_monster_id: sem.id,
      })
    }
    onClose()
  }

  return (
    <div className="scmf-overlay">
      <div className="scmf-header">
        <h2 className="scmf-title">Create Encounter — Monster Factory</h2>
        <button type="button" className="scmf-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="scmf-body">
        <EncounterWizard
          gmProfileId={gmProfileId}
          campaignId={campaignId}
          saveButtonLabel="Save & Add to Scene"
          onSaveOverride={handleSaveAndAddToScene}
        />
      </div>
    </div>
  )
}
