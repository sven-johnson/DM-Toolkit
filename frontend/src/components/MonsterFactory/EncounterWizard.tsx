import { useMemo, useRef, useState } from 'react'
import {
  useGenerateEncounter,
  useSaveEncounter,
  useSaveMonsterTemplate,
} from '../../hooks/useMonsterFactory'
import type {
  EncounterComposition,
  GeneratedEncounter,
  GeneratedMonster,
  PartyProfile,
} from '../../types/monsterFactory'
import { EncounterCompositionBuilder } from './EncounterCompositionBuilder'
import { GeneratedEncounterView } from './GeneratedEncounterView'
import { PartyProfileInput } from './PartyProfileInput'
import './EncounterWizard.css'

interface Props {
  gmProfileId: string
  onSwitchToSaved?: () => void
  campaignId?: string
  saveButtonLabel?: string
  onSaveOverride?: (name: string, currentEncounter: GeneratedEncounter) => Promise<void>
}

type Step = 1 | 2 | 3

const STEP_LABELS: Record<Step, string> = { 1: 'Party', 2: 'Encounter', 3: 'Review' }

export function EncounterWizard({ gmProfileId, onSwitchToSaved, campaignId, saveButtonLabel, onSaveOverride }: Props) {
  const [step, setStep]                             = useState<Step>(1)
  const [partyProfile, setPartyProfile]             = useState<PartyProfile | null>(null)
  const [composition, setComposition]               = useState<EncounterComposition | null>(null)
  const [generatedEncounter, setGeneratedEncounter] = useState<GeneratedEncounter | null>(null)
  const [generating, setGenerating]                 = useState(false)
  const [generateError, setGenerateError]           = useState<string | null>(null)
  const [isSaving, setIsSaving]                     = useState(false)
  const [saveToast, setSaveToast]                   = useState<string | null>(null)

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const generateMutation      = useGenerateEncounter()
  const saveMutation          = useSaveEncounter()
  const saveTemplateMutation  = useSaveMonsterTemplate()

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setSaveToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setSaveToast(null), 4000)
  }

  // ── Step navigation ──────────────────────────────────────────────────────────

  function handleStepClick(target: Step) {
    if (target >= step) return
    if (step === 3) {
      if (!window.confirm('Going back will discard the generated encounter. Continue?')) return
      setGeneratedEncounter(null)
    }
    setStep(target)
    setGenerateError(null)
  }

  // ── Generate (step 2 → 3) ────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!partyProfile || !composition?.difficulty) return

    const completeSlots = composition.slots.filter(
      (s) => s.creature_archetype_id && s.combat_role_id && s.count > 0,
    )
    if (completeSlots.length === 0) return

    const n = partyProfile.party_size
    const members = Array.from({ length: n }, () => ({
      max_hp: Math.round(partyProfile.avg_hp),
      ac: Math.round(partyProfile.avg_ac),
      nova_damage: partyProfile.party_nova / n,
      sustained_damage_per_round: partyProfile.party_sustained / n,
    }))

    setGenerating(true)
    setGenerateError(null)

    try {
      const result = await generateMutation.mutateAsync({
        party_members: members,
        party_level: partyProfile.avg_level,
        difficulty: composition.difficulty!,
        composition: completeSlots.map(
          ({ combat_role_id, creature_archetype_id, count, is_boss }) => ({
            combat_role_id, creature_archetype_id, count, is_boss,
          }),
        ),
        gm_profile_id: gmProfileId,
      })
      setGeneratedEncounter(result)
      setStep(3)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Generation failed — check your inputs and try again.'
      setGenerateError(msg)
    } finally {
      setGenerating(false)
    }
  }

  // ── Save encounter ────────────────────────────────────────────────────────────

  async function handleSave(name: string, currentEncounter: GeneratedEncounter) {
    setIsSaving(true)
    try {
      await saveMutation.mutateAsync({
        encounter: currentEncounter,
        name,
        gm_profile_id: gmProfileId,
      })
      showToast('Encounter saved!')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Save monster template ─────────────────────────────────────────────────────

  async function handleSaveMonsterTemplate(monster: GeneratedMonster, name: string) {
    setIsSaving(true)
    try {
      await saveTemplateMutation.mutateAsync({
        monster,
        name,
        party_avg_level: generatedEncounter?.party_profile.avg_level ?? 5,
      })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Rebalance (step 3 → 2) ───────────────────────────────────────────────────

  function handleRebalance() {
    setGenerateError(null)
    setStep(2)
    // composition and partyProfile remain in state; builder re-initializes from them
  }

  // ── New encounter (reset) ─────────────────────────────────────────────────────

  function handleNewEncounter() {
    if (!window.confirm('Start a new encounter? This will clear all current progress.')) return
    setStep(1)
    setPartyProfile(null)
    setComposition(null)
    setGeneratedEncounter(null)
    setGenerateError(null)
    setSaveToast(null)
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const canGenerate = useMemo(() => {
    if (!composition?.difficulty) return false
    return composition.slots.some(
      (s) => s.creature_archetype_id && s.combat_role_id && s.count > 0,
    )
  }, [composition])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="ew-root">
      {/* Step indicator */}
      <nav className="ew-step-indicator" aria-label="Wizard steps">
        {([1, 2, 3] as const).map((n, i) => {
          const isDone   = step > n
          const isActive = step === n
          return (
            <div key={n} className="ew-step-wrapper">
              {i > 0 && (
                <div className={`ew-step-sep${isDone ? ' ew-step-sep--done' : ''}`} />
              )}
              <button
                type="button"
                className={`ew-step${isActive ? ' ew-step--active' : ''}${isDone ? ' ew-step--done' : ''}`}
                onClick={() => isDone && handleStepClick(n)}
                disabled={!isDone}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${n}: ${STEP_LABELS[n]}${isDone ? ' (completed, click to go back)' : ''}`}
              >
                <span className="ew-step-dot">{isDone ? '✓' : n}</span>
                <span className="ew-step-label">{STEP_LABELS[n]}</span>
              </button>
            </div>
          )
        })}
      </nav>

      {/* ── Step 1: Party Profile ── */}
      {step === 1 && (
        <div className="ew-step-body">
          <PartyProfileInput onPartyProfileChange={setPartyProfile} campaignId={campaignId} />
          <div className="ew-step-footer">
            <button
              type="button"
              className="ew-next-btn"
              disabled={!partyProfile}
              onClick={() => setStep(2)}
            >
              Next: Build Encounter →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Encounter Composition ── */}
      {step === 2 && partyProfile && (
        <div className="ew-step-body">
          <EncounterCompositionBuilder
            partyProfile={partyProfile}
            gmProfileId={gmProfileId}
            onCompositionChange={setComposition}
            initialComposition={composition ?? undefined}
          />

          {generateError && (
            <div className="ew-error-msg" role="alert" aria-live="polite">
              {generateError}
            </div>
          )}

          <div className="ew-step-footer">
            <button type="button" className="ew-back-btn" onClick={() => { setStep(1); setGenerateError(null) }}>
              ← Back
            </button>
            <button
              type="button"
              className="ew-next-btn"
              disabled={!canGenerate || generating}
              onClick={() => void handleGenerate()}
            >
              Generate Encounter
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Generated Encounter ── */}
      {step === 3 && generatedEncounter && (
        <div className="ew-step-body">
          {saveToast && (
            <div className="ew-save-toast" role="status" aria-live="polite">
              <span>{saveToast}</span>
              {onSwitchToSaved && (
                <button type="button" className="ew-toast-link" onClick={onSwitchToSaved}>
                  View Saved Encounters →
                </button>
              )}
            </div>
          )}

          <GeneratedEncounterView
            encounter={generatedEncounter}
            onSave={(name, enc) => void (onSaveOverride ?? handleSave)(name, enc)}
            onSaveMonsterTemplate={(monster, name) => void handleSaveMonsterTemplate(monster, name)}
            onRebalance={handleRebalance}
            onNewEncounter={handleNewEncounter}
            isSaving={isSaving}
            saveButtonLabel={saveButtonLabel}
          />
        </div>
      )}

      {/* Generation overlay */}
      {generating && (
        <div className="ew-generate-overlay" aria-live="assertive">
          <div className="ew-generate-box">
            <span className="ew-generate-spinner" aria-hidden="true" />
            <span className="ew-generate-label">Building your encounter…</span>
          </div>
        </div>
      )}
    </div>
  )
}
