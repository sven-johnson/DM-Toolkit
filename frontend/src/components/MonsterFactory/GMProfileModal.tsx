import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  useCreateProfile,
  useDeleteProfile,
  useDuplicateProfile,
  useGMProfiles,
  usePresets,
  useSetDefaultProfile,
  useUpdateProfile,
} from '../../hooks/useMonsterFactory'
import type { GMProfile, GMProfileCreate, Preset } from '../../types/monsterFactory'
import './GMProfileModal.css'

// ── Balanced preset defaults ──────────────────────────────────────────────────
// Used for "Default" badge and reset-to-default buttons.

const BALANCED: Record<string, number | boolean | null> = {
  threat_turns_trivial: 6.0, threat_turns_easy: 5.0, threat_turns_medium: 3.5,
  threat_turns_hard: 2.25, threat_turns_deadly: 1.5,
  damage_smoothing: 0.85, hp_smoothing: 1.10,
  one_shot_prevention_threshold: 0.60, boss_nova_multiplier: 1.5, allow_player_death: false,
  target_rounds_trivial: 1.5, target_rounds_easy: 2.5, target_rounds_medium: 3.5,
  target_rounds_hard: 5.0, target_rounds_deadly: 6.0, round_variance_tolerance: 1.0,
  multiplier_trivial: 0.6, multiplier_easy: 0.8, multiplier_medium: 1.0,
  multiplier_hard: 1.2, multiplier_deadly: 1.4,
  bonus_action_estimate: 0.5, legendary_action_override: null, lair_actions_enabled: true,
  monster_hit_rate_trivial: 0.40, monster_hit_rate_easy: 0.50, monster_hit_rate_medium: 0.60,
  monster_hit_rate_hard: 0.65, monster_hit_rate_deadly: 0.70,
  player_hit_rate_trivial: 0.75, player_hit_rate_easy: 0.65, player_hit_rate_medium: 0.55,
  player_hit_rate_hard: 0.50, player_hit_rate_deadly: 0.45,
  save_dc_base: 8, save_dc_proficiency_scaling: true, save_dc_difficulty_bonus: 1,
  minion_one_hit_kill: false, minion_hp_fraction: 0.25, minion_damage_fraction: 0.40,
  warn_nova_threshold: true, warn_one_shot_risk: true,
  warn_action_economy_imbalance: true, warn_round_duration_deviation: true, show_math: false,
}

const DIFFS = ['trivial', 'easy', 'medium', 'hard', 'deadly'] as const

// ── Form values type ──────────────────────────────────────────────────────────

interface ProfileFormValues {
  name: string
  // lethality
  threat_turns_trivial: number; threat_turns_easy: number; threat_turns_medium: number
  threat_turns_hard: number; threat_turns_deadly: number
  damage_smoothing: number; hp_smoothing: number
  one_shot_prevention_threshold: number; boss_nova_multiplier: number; allow_player_death: boolean
  // combat duration
  target_rounds_trivial: number; target_rounds_easy: number; target_rounds_medium: number
  target_rounds_hard: number; target_rounds_deadly: number; round_variance_tolerance: number
  // action economy
  multiplier_trivial: number; multiplier_easy: number; multiplier_medium: number
  multiplier_hard: number; multiplier_deadly: number
  bonus_action_estimate: number; legendary_action_override: number | null; lair_actions_enabled: boolean
  // hit rates
  monster_hit_rate_trivial: number; monster_hit_rate_easy: number; monster_hit_rate_medium: number
  monster_hit_rate_hard: number; monster_hit_rate_deadly: number
  player_hit_rate_trivial: number; player_hit_rate_easy: number; player_hit_rate_medium: number
  player_hit_rate_hard: number; player_hit_rate_deadly: number
  // saving throws
  save_dc_base: number; save_dc_proficiency_scaling: boolean; save_dc_difficulty_bonus: number
  // minion
  minion_one_hit_kill: boolean; minion_hp_fraction: number; minion_damage_fraction: number
  // warnings
  warn_nova_threshold: boolean; warn_one_shot_risk: boolean
  warn_action_economy_imbalance: boolean; warn_round_duration_deviation: boolean; show_math: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function profileToFlat(p: GMProfile): ProfileFormValues {
  return {
    name: p.name,
    ...p.lethality, ...p.combat_duration, ...p.action_economy,
    ...p.hit_rate, ...p.saving_throw, ...p.minion, ...p.warnings,
  } as ProfileFormValues
}

function presetToFlat(preset: Preset, name: string): ProfileFormValues {
  return {
    name,
    ...preset.lethality, ...preset.combat_duration, ...preset.action_economy,
    ...preset.hit_rate, ...preset.saving_throw, ...preset.minion, ...preset.warnings,
  } as ProfileFormValues
}

function formToPayload(v: ProfileFormValues): GMProfileCreate {
  return {
    name: v.name,
    lethality: {
      threat_turns_trivial: v.threat_turns_trivial, threat_turns_easy: v.threat_turns_easy,
      threat_turns_medium: v.threat_turns_medium, threat_turns_hard: v.threat_turns_hard,
      threat_turns_deadly: v.threat_turns_deadly, damage_smoothing: v.damage_smoothing,
      hp_smoothing: v.hp_smoothing, one_shot_prevention_threshold: v.one_shot_prevention_threshold,
      boss_nova_multiplier: v.boss_nova_multiplier, allow_player_death: v.allow_player_death,
    },
    combat_duration: {
      target_rounds_trivial: v.target_rounds_trivial, target_rounds_easy: v.target_rounds_easy,
      target_rounds_medium: v.target_rounds_medium, target_rounds_hard: v.target_rounds_hard,
      target_rounds_deadly: v.target_rounds_deadly, round_variance_tolerance: v.round_variance_tolerance,
    },
    action_economy: {
      multiplier_trivial: v.multiplier_trivial, multiplier_easy: v.multiplier_easy,
      multiplier_medium: v.multiplier_medium, multiplier_hard: v.multiplier_hard,
      multiplier_deadly: v.multiplier_deadly, bonus_action_estimate: v.bonus_action_estimate,
      legendary_action_override: v.legendary_action_override, lair_actions_enabled: v.lair_actions_enabled,
    },
    hit_rate: {
      monster_hit_rate_trivial: v.monster_hit_rate_trivial, monster_hit_rate_easy: v.monster_hit_rate_easy,
      monster_hit_rate_medium: v.monster_hit_rate_medium, monster_hit_rate_hard: v.monster_hit_rate_hard,
      monster_hit_rate_deadly: v.monster_hit_rate_deadly, player_hit_rate_trivial: v.player_hit_rate_trivial,
      player_hit_rate_easy: v.player_hit_rate_easy, player_hit_rate_medium: v.player_hit_rate_medium,
      player_hit_rate_hard: v.player_hit_rate_hard, player_hit_rate_deadly: v.player_hit_rate_deadly,
    },
    saving_throw: {
      save_dc_base: v.save_dc_base, save_dc_proficiency_scaling: v.save_dc_proficiency_scaling,
      save_dc_difficulty_bonus: v.save_dc_difficulty_bonus,
    },
    minion: {
      minion_one_hit_kill: v.minion_one_hit_kill, minion_hp_fraction: v.minion_hp_fraction,
      minion_damage_fraction: v.minion_damage_fraction,
    },
    warnings: {
      warn_nova_threshold: v.warn_nova_threshold, warn_one_shot_risk: v.warn_one_shot_risk,
      warn_action_economy_imbalance: v.warn_action_economy_imbalance,
      warn_round_duration_deviation: v.warn_round_duration_deviation, show_math: v.show_math,
    },
  }
}

const BALANCED_FORM: ProfileFormValues = {
  name: '', ...BALANCED as Omit<ProfileFormValues, 'name'>,
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  onProfileChange: (profileId: string) => void
}

// ── Main component ────────────────────────────────────────────────────────────

export function GMProfileModal({ isOpen, onClose, onProfileChange }: Props) {
  const [view, setView]       = useState<'list' | 'edit'>('list')
  const [editId, setEditId]   = useState<string | null>(null)
  const [toast, setToast]     = useState<string | null>(null)
  const [presetLoaded, setPresetLoaded] = useState(false)

  const { data: profiles = [], isLoading: profilesLoading } = useGMProfiles()
  const { data: presets  = [] }                               = usePresets()

  const createProfile   = useCreateProfile()
  const updateProfile   = useUpdateProfile()
  const deleteProfile   = useDeleteProfile()
  const duplicateProfile = useDuplicateProfile()
  const setDefault      = useSetDefaultProfile()

  const {
    register, watch, setValue, reset, handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    mode: 'onChange',
    defaultValues: BALANCED_FORM,
  })

  const allValues = watch()
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // ── View navigation ─────────────────────────────────────────────────────────

  function openEditor(profileId: string | null) {
    if (profileId) {
      const p = profiles.find((x) => x.id === profileId)
      if (p) reset(profileToFlat(p))
    } else {
      reset(BALANCED_FORM)
    }
    setEditId(profileId)
    setPresetLoaded(false)
    setView('edit')
  }

  function handleBack() {
    if (isDirty || presetLoaded) {
      if (!window.confirm('Discard unsaved changes?')) return
    }
    setView('list')
    setEditId(null)
    setPresetLoaded(false)
  }

  // ── Preset loader ────────────────────────────────────────────────────────────

  function handlePresetLoad(presetName: string) {
    if (!presetName) return
    const preset = presets.find((p) => p.name === presetName)
    if (!preset) return
    const currentName = watch('name')
    reset(presetToFlat(preset, currentName || preset.name))
    setPresetLoaded(true)
  }

  // ── Form submit ──────────────────────────────────────────────────────────────

  async function onSubmit(values: ProfileFormValues) {
    const payload = formToPayload(values)
    if (editId) {
      const updated = await updateProfile.mutateAsync({ id: editId, ...payload })
      showToast('Profile saved.')
      onProfileChange(updated.id)
    } else {
      const created = await createProfile.mutateAsync(payload)
      showToast('Profile created.')
      onProfileChange(created.id)
    }
    setPresetLoaded(false)
    setView('list')
    setEditId(null)
  }

  // ── List actions ──────────────────────────────────────────────────────────

  async function handleDuplicate(profile: GMProfile) {
    await duplicateProfile.mutateAsync({ source: profile, newName: `${profile.name} (copy)` })
    showToast(`Duplicated "${profile.name}".`)
  }

  async function handleSetDefault(id: string) {
    const updated = await setDefault.mutateAsync(id)
    onProfileChange(updated.id)
    showToast('Default profile updated.')
  }

  async function handleDelete(profile: GMProfile) {
    if (!window.confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) return
    await deleteProfile.mutateAsync(profile.id)
    showToast(`Deleted "${profile.name}".`)
  }

  if (!isOpen) return null

  const isOnlyProfile = profiles.length <= 1
  const title = view === 'list' ? 'GM Profiles' : (editId ? 'Edit Profile' : 'New Profile')

  // ── Field helpers (closured over register/watch/setValue) ──────────────────

  function isDefault(key: string): boolean {
    const val = (allValues as unknown as Record<string, unknown>)[key]
    return val === BALANCED[key]
  }

  function resetField(key: string) {
    setValue(key as keyof ProfileFormValues,
      BALANCED[key] as never, { shouldDirty: true })
  }

  function SliderField({ k, label, tip, min, max, step }: {
    k: keyof ProfileFormValues; label: string; tip: string; min: number; max: number; step: number
  }) {
    const val = (allValues as unknown as Record<string, unknown>)[k as string] as number
    const atDefault = isDefault(k as string)
    return (
      <div className="gpm-field-row">
        <span className="gpm-field-label">
          {label}
          <span className="gpm-field-tip" title={tip}>ℹ</span>
        </span>
        <div className="gpm-field-controls">
          {atDefault && <span className="gpm-default-dot" title="Balanced default" />}
          {!atDefault && (
            <button type="button" className="gpm-reset-btn" title="Reset to default"
              onClick={() => resetField(k as string)}>↺</button>
          )}
          <input type="range" className="gpm-slider" min={min} max={max} step={step}
            {...register(k, { valueAsNumber: true, min, max })} />
          <span className="gpm-field-value">{typeof val === 'number' ? val.toFixed(2) : '—'}</span>
        </div>
        {errors[k] && <span className="gpm-field-error">{String(errors[k]?.message ?? '')}</span>}
      </div>
    )
  }

  function ToggleField({ k, label, tip }: {
    k: keyof ProfileFormValues; label: string; tip: string
  }) {
    const atDefault = isDefault(k as string)
    return (
      <div className="gpm-field-row">
        <span className="gpm-field-label">
          {label}
          <span className="gpm-field-tip" title={tip}>ℹ</span>
        </span>
        <div className="gpm-field-controls">
          {atDefault && <span className="gpm-default-dot" title="Balanced default" />}
          {!atDefault && (
            <button type="button" className="gpm-reset-btn" title="Reset to default"
              onClick={() => resetField(k as string)}>↺</button>
          )}
          <input type="checkbox" {...register(k)} />
        </div>
      </div>
    )
  }

  function NumberField({ k, label, tip, min, max, nullable }: {
    k: keyof ProfileFormValues; label: string; tip: string; min: number; max: number; nullable?: boolean
  }) {
    const atDefault = isDefault(k as string)
    const currentVal = (allValues as unknown as Record<string, unknown>)[k as string]
    return (
      <div className="gpm-field-row">
        <span className="gpm-field-label">
          {label}
          <span className="gpm-field-tip" title={tip}>ℹ</span>
        </span>
        <div className="gpm-field-controls">
          {atDefault && <span className="gpm-default-dot" title="Balanced default" />}
          {!atDefault && (
            <button type="button" className="gpm-reset-btn" title="Reset to default"
              onClick={() => resetField(k as string)}>↺</button>
          )}
          {nullable ? (
            <input
              type="number" className="gpm-number-sm" min={min} max={max}
              placeholder="None"
              value={currentVal === null || currentVal === undefined ? '' : String(currentVal)}
              onChange={(e) => setValue(k,
                (e.target.value === '' ? null : Number(e.target.value)) as never,
                { shouldDirty: true })}
            />
          ) : (
            <input type="number" className="gpm-number-sm" min={min} max={max}
              {...register(k, { valueAsNumber: true, min, max })} />
          )}
        </div>
        {errors[k] && <span className="gpm-field-error">{String(errors[k]?.message ?? '')}</span>}
      </div>
    )
  }

  function PerDiffField({ baseKey, label, tip, min, max, step }: {
    baseKey: string; label: string; tip: string; min: number; max: number; step: number
  }) {
    return (
      <div className="gpm-perdifficulty">
        <div className="gpm-perdifficulty-label-row">
          <span className="gpm-field-label">
            {label}
            <span className="gpm-field-tip" title={tip}>ℹ</span>
          </span>
        </div>
        <div className="gpm-diff-cols">
          {DIFFS.map((d) => {
            const k = `${baseKey}_${d}` as keyof ProfileFormValues
            const atDef = isDefault(k as string)
            return (
              <div key={d} className="gpm-diff-col">
                <span className="gpm-diff-col-label">{d.slice(0, 3)}</span>
                <input type="number" className="gpm-diff-input" min={min} max={max} step={step}
                  {...register(k, { valueAsNumber: true, min, max })} />
                {atDef
                  ? <span className="gpm-default-dot" title="Balanced default" />
                  : <button type="button" className="gpm-diff-reset" title="Reset"
                      onClick={() => resetField(k as string)}>↺</button>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="gpm-overlay" onClick={() => view === 'list' && onClose()}>
      <div className="gpm-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="gpm-header">
          {view === 'edit' && (
            <button type="button" className="gpm-back-btn" onClick={handleBack}
              aria-label="Back to profile list">←</button>
          )}
          <h2 className="gpm-title">{title}</h2>
          <button type="button" className="gpm-close-btn" onClick={onClose}
            aria-label="Close">✕</button>
        </div>

        {toast && <div className="gpm-toast" role="status">{toast}</div>}

        {/* ── Profile list ── */}
        {view === 'list' && (
          <>
            <div className="gpm-list">
              {profilesLoading && (
                <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Loading profiles…
                </div>
              )}
              {profiles.map((p) => {
                const canDelete = !p.is_default && !isOnlyProfile
                return (
                  <div key={p.id} className="gpm-profile-row">
                    <span className="gpm-profile-name">{p.name}</span>
                    {p.is_default && <span className="gpm-default-badge">Default</span>}
                    <div className="gpm-row-actions">
                      <button type="button" className="gpm-icon-btn"
                        onClick={() => openEditor(p.id)} title="Edit">✏</button>
                      <button type="button" className="gpm-icon-btn"
                        onClick={() => void handleDuplicate(p)} title="Duplicate">⧉</button>
                      <button type="button"
                        className={`gpm-icon-btn${p.is_default ? ' gpm-icon-btn--star-filled' : ''}`}
                        onClick={() => !p.is_default && void handleSetDefault(p.id)}
                        disabled={p.is_default}
                        title={p.is_default ? 'Already default' : 'Set as default'}>★</button>
                      <button type="button" className="gpm-icon-btn gpm-icon-btn--danger"
                        onClick={() => void handleDelete(p)}
                        disabled={!canDelete}
                        title={!canDelete ? (p.is_default ? 'Cannot delete the default profile' : 'Cannot delete the only profile') : 'Delete profile'}>
                        🗑
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="gpm-list-footer">
              <button type="button" className="gpm-new-btn" onClick={() => openEditor(null)}>
                + New Profile
              </button>
            </div>
          </>
        )}

        {/* ── Profile editor ── */}
        {view === 'edit' && (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} style={{ display: 'contents' }}>
            <div className="gpm-editor">
              {/* Name + preset */}
              <div className="gpm-editor-top">
                <div className="gpm-name-field">
                  <label className="gpm-name-label" htmlFor="profile-name">Profile Name</label>
                  <input
                    id="profile-name"
                    className={`gpm-name-input${errors.name ? ' gpm-name-input--error' : ''}`}
                    {...register('name', { required: 'Name is required' })}
                  />
                  {errors.name && <span className="gpm-field-error">{errors.name.message}</span>}
                </div>

                <div className="gpm-preset-field">
                  <label className="gpm-name-label">Load from preset</label>
                  <div className="gpm-preset-row">
                    <select className="gpm-preset-select" defaultValue=""
                      onChange={(e) => handlePresetLoad(e.target.value)}>
                      <option value="">— select preset —</option>
                      {presets.map((p) => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                    {presetLoaded && <span className="gpm-unsaved-tag">(unsaved)</span>}
                  </div>
                </div>
              </div>

              {/* 1. Lethality */}
              <details className="gpm-section">
                <summary>Lethality Settings</summary>
                <div className="gpm-section-body">
                  <PerDiffField baseKey="threat_turns" label="Threat Turns"
                    tip="Expected turns the party survives at this difficulty" min={0.5} max={12} step={0.25} />
                  <SliderField k="damage_smoothing" label="Damage Smoothing"
                    tip="Scales raw damage output to reduce spikes" min={0.5} max={1.5} step={0.05} />
                  <SliderField k="hp_smoothing" label="HP Smoothing"
                    tip="Multiplier applied to calculated monster HP" min={0.5} max={2.0} step={0.05} />
                  <SliderField k="one_shot_prevention_threshold" label="One-Shot Prevention"
                    tip="Max fraction of avg party HP a single attack can deal" min={0.0} max={1.0} step={0.05} />
                  <SliderField k="boss_nova_multiplier" label="Boss Nova Multiplier"
                    tip="Minimum HP as a multiple of party nova for boss monsters" min={1.0} max={3.0} step={0.05} />
                  <ToggleField k="allow_player_death" label="Allow Player Death"
                    tip="Whether the difficulty curve assumes player death is on the table" />
                </div>
              </details>

              {/* 2. Combat Duration */}
              <details className="gpm-section">
                <summary>Combat Duration</summary>
                <div className="gpm-section-body">
                  <PerDiffField baseKey="target_rounds" label="Target Rounds"
                    tip="Target number of combat rounds at each difficulty" min={0.5} max={12} step={0.25} />
                  <SliderField k="round_variance_tolerance" label="Round Variance Tolerance"
                    tip="±N rounds for the expected round range (min/max)" min={0.0} max={3.0} step={0.25} />
                </div>
              </details>

              {/* 3. Action Economy */}
              <details className="gpm-section">
                <summary>Action Economy</summary>
                <div className="gpm-section-body">
                  <PerDiffField baseKey="multiplier" label="Action Economy Multiplier"
                    tip="Scales monster action budget relative to the party" min={0.3} max={3.0} step={0.05} />
                  <SliderField k="bonus_action_estimate" label="Bonus Action Estimate"
                    tip="Average bonus actions per player per round" min={0.0} max={1.0} step={0.05} />
                  <NumberField k="legendary_action_override" label="Legendary Action Override"
                    tip="Force a specific legendary action count (leave blank for auto)" min={0} max={5} nullable />
                  <ToggleField k="lair_actions_enabled" label="Lair Actions Enabled"
                    tip="Whether boss monsters can have lair actions" />
                </div>
              </details>

              {/* 4. Hit Rates */}
              <details className="gpm-section">
                <summary>Hit Rates</summary>
                <div className="gpm-section-body">
                  <PerDiffField baseKey="monster_hit_rate" label="Monster Hit Rate"
                    tip="Probability a monster attack hits the party" min={0.1} max={1.0} step={0.05} />
                  <PerDiffField baseKey="player_hit_rate" label="Player Hit Rate"
                    tip="Probability a player attack hits a monster" min={0.1} max={1.0} step={0.05} />
                </div>
              </details>

              {/* 5. Saving Throws */}
              <details className="gpm-section">
                <summary>Saving Throws</summary>
                <div className="gpm-section-body">
                  <NumberField k="save_dc_base" label="Save DC Base"
                    tip="Base DC before proficiency and difficulty adjustments" min={0} max={20} />
                  <NumberField k="save_dc_difficulty_bonus" label="Save DC Difficulty Bonus"
                    tip="Added to DC based on difficulty tier" min={0} max={5} />
                  <ToggleField k="save_dc_proficiency_scaling" label="Scale with Proficiency"
                    tip="Whether Save DC scales with the party's proficiency bonus" />
                </div>
              </details>

              {/* 6. Minion Rules */}
              <details className="gpm-section">
                <summary>Minion Rules</summary>
                <div className="gpm-section-body">
                  <ToggleField k="minion_one_hit_kill" label="One-Hit Kill"
                    tip="Minions die in one hit regardless of calculated HP" />
                  <SliderField k="minion_hp_fraction" label="HP Fraction"
                    tip="Minion HP as a fraction of a standard monster's HP" min={0.0} max={1.0} step={0.05} />
                  <SliderField k="minion_damage_fraction" label="Damage Fraction"
                    tip="Minion damage as a fraction of a standard monster's damage" min={0.0} max={1.0} step={0.05} />
                </div>
              </details>

              {/* 7. Warnings & Display */}
              <details className="gpm-section">
                <summary>Warnings & Display</summary>
                <div className="gpm-section-body">
                  <ToggleField k="warn_nova_threshold" label="Warn: Nova Threshold"
                    tip="Warn when monster HP may not survive the party's nova round" />
                  <ToggleField k="warn_one_shot_risk" label="Warn: One-Shot Risk"
                    tip="Warn when monsters could one-shot a party member" />
                  <ToggleField k="warn_action_economy_imbalance" label="Warn: Action Economy"
                    tip="Warn when monster action economy greatly exceeds the party's" />
                  <ToggleField k="warn_round_duration_deviation" label="Warn: Round Duration"
                    tip="Warn when expected rounds deviate significantly from the target" />
                  <ToggleField k="show_math" label="Show Math Detail"
                    tip="Include intermediate calculation values in the generated encounter" />
                </div>
              </details>
            </div>

            <div className="gpm-editor-footer">
              <button type="button" className="gpm-cancel-btn" onClick={handleBack}>
                Cancel
              </button>
              <button
                type="submit"
                className="gpm-save-btn"
                disabled={isSubmitting || Object.keys(errors).length > 0}
              >
                {isSubmitting ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
