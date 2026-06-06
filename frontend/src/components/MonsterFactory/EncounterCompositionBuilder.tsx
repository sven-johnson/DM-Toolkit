import { useEffect, useRef, useState, useMemo } from 'react'
import {
  useCombatRoles,
  useCreatureArchetypes,
  useEncounterTemplate,
  useEncounterTemplates,
  useGenerateEncounter,
} from '../../hooks/useMonsterFactory'
import type {
  Difficulty,
  EncounterComposition,
  EncounterCompositionSlot,
  GeneratedEncounter,
  PartyProfile,
} from '../../types/monsterFactory'
import './EncounterCompositionBuilder.css'

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'trivial', label: 'Trivial',  desc: '1–2 rounds, no resources' },
  { value: 'easy',    label: 'Easy',     desc: '2–3 rounds, minor resources' },
  { value: 'medium',  label: 'Medium',   desc: '3–4 rounds, moderate resources' },
  { value: 'hard',    label: 'Hard',     desc: '4–5 rounds, significant resources' },
  { value: 'deadly',  label: 'Deadly',   desc: '5–6 rounds, full nova required' },
]

// ── Internal slot state ───────────────────────────────────────────────────────

interface SlotState extends EncounterCompositionSlot {
  _id: string          // stable React key
  _is_required: boolean
}

function blankSlot(): SlotState {
  return {
    _id: crypto.randomUUID(),
    combat_role_id: '',
    creature_archetype_id: '',
    count: 1,
    is_boss: false,
    _is_required: false,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function partyActionsPerRound(profile: PartyProfile): number {
  return profile.party_size + profile.estimated_bonus_actions_per_round
}

function actionEconomyColor(monsterActions: number, partyActions: number): string {
  const ratio = partyActions > 0 ? monsterActions / partyActions : 0
  if (ratio > 1.4) return 'ecb-preview-value--red'
  if (ratio > 1.2) return 'ecb-preview-value--amber'
  return 'ecb-preview-value--green'
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  partyProfile: PartyProfile
  onCompositionChange: (composition: EncounterComposition) => void
  initialTemplateId?: string
  gmProfileId: string
  initialComposition?: EncounterComposition
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EncounterCompositionBuilder({
  partyProfile,
  onCompositionChange,
  initialTemplateId,
  gmProfileId,
  initialComposition,
}: Props) {
  const { data: templates = [], isLoading: templatesLoading } = useEncounterTemplates()
  const { data: archetypes = [], isLoading: archetypesLoading } = useCreatureArchetypes()
  const { data: roles = [], isLoading: rolesLoading } = useCombatRoles()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialComposition?.templateId ?? initialTemplateId ?? null,
  )
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(
    initialComposition?.difficulty ?? null,
  )
  const [slots, setSlots] = useState<SlotState[]>(() => {
    if (initialComposition?.slots?.length) {
      return initialComposition.slots.map((s) => ({
        ...s,
        _id: crypto.randomUUID(),
        _is_required: false,
      }))
    }
    return [blankSlot()]
  })
  const [slotsModified, setSlotsModified] = useState(false)

  const [preview, setPreview] = useState<GeneratedEncounter | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set())

  // ── Template loading ────────────────────────────────────────────────────────

  const { data: templateDetail } = useEncounterTemplate(selectedTemplateId)

  // If we initialized from an existing composition, mark the template as already applied
  const appliedTemplateRef = useRef<string | null>(
    initialComposition?.templateId ?? null,
  )

  useEffect(() => {
    if (!templateDetail || !selectedTemplateId) return
    if (appliedTemplateRef.current === selectedTemplateId) return
    appliedTemplateRef.current = selectedTemplateId

    const newSlots: SlotState[] = (templateDetail.slots ?? []).map((s) => ({
      _id: crypto.randomUUID(),
      combat_role_id: s.combat_role_archetype_id,
      creature_archetype_id: '',
      count: s.default_count,
      is_boss: s.combat_role.is_boss_eligible,
      _is_required: s.is_required,
    }))

    setSlots(newSlots.length > 0 ? newSlots : [blankSlot()])
    setSlotsModified(false)
  }, [templateDetail, selectedTemplateId])

  // ── Template selection ──────────────────────────────────────────────────────

  function handleTemplateSelect(id: string) {
    if (id === selectedTemplateId) return
    if (slotsModified && slots.length > 0) {
      if (!window.confirm('Replace current slots with template defaults?')) return
    }
    appliedTemplateRef.current = null
    setSelectedTemplateId(id)
    setSlotsModified(false)
  }

  // ── Slot mutation ───────────────────────────────────────────────────────────

  function updateSlot(idx: number, patch: Partial<SlotState>) {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
    setSlotsModified(true)
  }

  function addSlot() {
    setSlots((prev) => [...prev, blankSlot()])
    setSlotsModified(true)
  }

  function removeSlot(idx: number) {
    setSlots((prev) => prev.filter((_, i) => i !== idx))
    setSlotsModified(true)
  }

  // ── Emit composition on every change ───────────────────────────────────────

  useEffect(() => {
    const composition: EncounterComposition = {
      templateId: selectedTemplateId,
      difficulty: selectedDifficulty,
      slots: slots.map(({ combat_role_id, creature_archetype_id, count, is_boss }) => ({
        combat_role_id,
        creature_archetype_id,
        count,
        is_boss,
      })),
    }
    onCompositionChange(composition)
  // onCompositionChange intentionally excluded — callers should use useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, selectedDifficulty, selectedTemplateId])

  // ── Live preview (debounced 400ms) ──────────────────────────────────────────

  const debouncedSlots = useDebounce(slots, 400)
  const debouncedDifficulty = useDebounce(selectedDifficulty, 400)

  const canPreview = useMemo(() => {
    if (!debouncedDifficulty || !gmProfileId) return false
    return debouncedSlots.some(
      (s) => s.creature_archetype_id && s.combat_role_id && s.count > 0,
    )
  }, [debouncedSlots, debouncedDifficulty, gmProfileId])

  const generateMutation = useGenerateEncounter()
  const runGenerateRef = useRef(generateMutation.mutateAsync)
  useEffect(() => { runGenerateRef.current = generateMutation.mutateAsync })

  useEffect(() => {
    if (!canPreview) return

    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)

    const completeSlots = debouncedSlots
      .filter((s) => s.creature_archetype_id && s.combat_role_id)
      .map(({ combat_role_id, creature_archetype_id, count, is_boss }) => ({
        combat_role_id,
        creature_archetype_id,
        count,
        is_boss,
      }))

    // Synthesise party members from the profile for the generate call
    const n = partyProfile.party_size
    const perNova = partyProfile.party_nova / n
    const perSustained = partyProfile.party_sustained / n
    const members = Array.from({ length: n }, () => ({
      max_hp: Math.round(partyProfile.avg_hp),
      ac: Math.round(partyProfile.avg_ac),
      nova_damage: perNova,
      sustained_damage_per_round: perSustained,
    }))

    runGenerateRef
      .current({
        party_members: members,
        party_level: partyProfile.avg_level,
        difficulty: debouncedDifficulty!,
        composition: completeSlots,
        gm_profile_id: gmProfileId,
      })
      .then((result) => {
        if (cancelled) return
        setPreview(result)
        setDismissedWarnings(new Set())
        setPreviewLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setPreviewError('Unable to preview — check your inputs')
        setPreviewLoading(false)
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSlots, debouncedDifficulty, canPreview, gmProfileId])

  // ── Render ──────────────────────────────────────────────────────────────────

  const partyActions = partyActionsPerRound(partyProfile)
  const activeWarnings = preview?.all_warnings.filter((w) => !dismissedWarnings.has(w)) ?? []

  return (
    <div className="ecb-root">
      {/* Section 1: Encounter type */}
      <section>
        <h3 className="ecb-section-title">Encounter Type</h3>
        {templatesLoading ? (
          <span className="ecb-loading-text">Loading templates…</span>
        ) : (
          <div className="ecb-template-grid">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`ecb-template-card${selectedTemplateId === t.id ? ' ecb-template-card--selected' : ''}`}
                onClick={() => handleTemplateSelect(t.id)}
              >
                <div className="ecb-template-card-name">{t.name}</div>
                {t.description && (
                  <div className="ecb-template-card-desc">{t.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Difficulty */}
      <section>
        <h3 className="ecb-section-title">Difficulty</h3>
        <div className="ecb-difficulty-row" role="group" aria-label="Difficulty">
          {DIFFICULTY_OPTIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              className={`ecb-diff-btn${selectedDifficulty === d.value ? ' ecb-diff-btn--selected' : ''}`}
              onClick={() => setSelectedDifficulty(d.value)}
              aria-pressed={selectedDifficulty === d.value}
              data-testid={`difficulty-${d.value}`}
            >
              <span className="ecb-diff-name">{d.label}</span>
              <span className="ecb-diff-desc">{d.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Section 3: Composition slots */}
      <section>
        <h3 className="ecb-section-title">Composition</h3>

        <div className="ecb-slot-header">
          <span className="ecb-col-label">Creature Archetype</span>
          <span className="ecb-col-label">Combat Role</span>
          <span className="ecb-col-label">Count</span>
          <span className="ecb-col-label">Boss</span>
          <span />
        </div>

        {slots.map((slot, idx) => (
          <div key={slot._id} className="ecb-slot-row" data-testid="slot-row">
            {/* Creature Archetype */}
            <select
              className="ecb-select"
              value={slot.creature_archetype_id}
              onChange={(e) => updateSlot(idx, { creature_archetype_id: e.target.value })}
              aria-label={`Slot ${idx + 1} creature archetype`}
              disabled={archetypesLoading}
            >
              <option value="">— Archetype —</option>
              {archetypes.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {/* Combat Role */}
            <select
              className="ecb-select"
              value={slot.combat_role_id}
              onChange={(e) => updateSlot(idx, { combat_role_id: e.target.value })}
              aria-label={`Slot ${idx + 1} combat role`}
              disabled={rolesLoading}
            >
              <option value="">— Role —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            {/* Count */}
            <input
              type="number"
              className="ecb-count-input"
              value={slot.count}
              min={1}
              max={20}
              aria-label={`Slot ${idx + 1} count`}
              onChange={(e) => updateSlot(idx, { count: Math.max(1, Math.min(20, Number(e.target.value))) })}
            />

            {/* Boss toggle */}
            <div className="ecb-boss-cell">
              <input
                type="checkbox"
                id={`boss-${slot._id}`}
                checked={slot.is_boss}
                onChange={(e) => updateSlot(idx, { is_boss: e.target.checked })}
                aria-label={`Slot ${idx + 1} is boss`}
              />
              <label htmlFor={`boss-${slot._id}`} className="ecb-boss-label">Boss</label>
            </div>

            {/* Remove */}
            <button
              type="button"
              className="ecb-remove-btn"
              onClick={() => removeSlot(idx)}
              disabled={slot._is_required}
              aria-label={`Remove slot ${idx + 1}`}
              title={slot._is_required ? 'Required by template' : 'Remove slot'}
            >
              ✕
            </button>
          </div>
        ))}

        <div className="ecb-slot-actions">
          <button type="button" className="ecb-add-btn" onClick={addSlot}>
            + Add Slot
          </button>
        </div>
      </section>

      {/* Section 4: Live preview */}
      <section>
        <h3 className="ecb-section-title">Preview</h3>
        <div className="ecb-preview" aria-live="polite">
          {previewLoading && (
            <div className="ecb-preview-loading" data-testid="preview-loading">
              <span className="ecb-spinner" />
              Calculating…
            </div>
          )}

          {!previewLoading && previewError && (
            <p className="ecb-preview-error" data-testid="preview-error">{previewError}</p>
          )}

          {!previewLoading && !previewError && !preview && (
            <p className="ecb-preview-empty">
              {canPreview
                ? 'Calculating…'
                : 'Select a difficulty and fill in at least one slot to see a preview.'}
            </p>
          )}

          {!previewLoading && !previewError && preview && (
            <>
              <div className="ecb-preview-grid">
                <div className="ecb-preview-stat">
                  <span className="ecb-preview-label">Expected Rounds</span>
                  <span className="ecb-preview-value" data-testid="preview-rounds">
                    {preview.expected_rounds_min.toFixed(1)}–{preview.expected_rounds_max.toFixed(1)}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8em' }}>
                      {' '}(avg {preview.expected_rounds.toFixed(1)})
                    </span>
                  </span>
                </div>

                <div className="ecb-preview-stat">
                  <span className="ecb-preview-label">Total Monster HP</span>
                  <span className="ecb-preview-value">{preview.total_monster_hp}</span>
                </div>

                <div className="ecb-preview-stat">
                  <span className="ecb-preview-label">Monster Actions/Round</span>
                  <span
                    className={`ecb-preview-value ${actionEconomyColor(preview.total_monster_actions_per_round, partyActions)}`}
                    data-testid="preview-actions"
                  >
                    {preview.total_monster_actions_per_round.toFixed(1)}
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8em' }}>
                      {' '}vs {partyActions.toFixed(1)} party
                    </span>
                  </span>
                </div>
              </div>

              {activeWarnings.length > 0 && (
                <div className="ecb-warnings" data-testid="preview-warnings">
                  {activeWarnings.map((w) => (
                    <div key={w} className="ecb-warning-card">
                      <span className="ecb-warning-icon">⚠</span>
                      <span className="ecb-warning-text">{w}</span>
                      <button
                        type="button"
                        className="ecb-warning-dismiss"
                        onClick={() =>
                          setDismissedWarnings((prev) => new Set([...prev, w]))
                        }
                        aria-label="Dismiss warning"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
