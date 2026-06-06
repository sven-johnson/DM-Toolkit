import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import type { PartyMember, PartyProfile } from '../../types/monsterFactory'
import { usePartySummary } from '../../hooks/useCombatStats'
import './PartyProfileInput.css'

interface Props {
  onPartyProfileChange: (profile: PartyProfile) => void
  initialMembers?: PartyMember[]
  campaignId?: string
}

interface MemberRow {
  max_hp: number | ''
  ac: number | ''
  nova_damage: number | ''
  sustained_damage_per_round: number | ''
  _name?: string   // display-only, not validated or sent to callback
}

interface FormValues {
  party_level: number | ''
  members: MemberRow[]
}

const DEFAULT_MEMBER: MemberRow = { max_hp: '', ac: '', nova_damage: '', sustained_damage_per_round: '' }

function proficiencyBonus(level: number): number {
  if (level <= 4)  return 2
  if (level <= 8)  return 3
  if (level <= 12) return 4
  if (level <= 16) return 5
  return 6
}

function levelTier(level: number): number {
  if (level <= 4)  return 1
  if (level <= 10) return 2
  if (level <= 16) return 3
  return 4
}

function computeProfile(values: FormValues): PartyProfile | null {
  const level = typeof values.party_level === 'number' ? values.party_level : NaN
  if (!Number.isFinite(level) || level < 1 || level > 20) return null

  const members = values.members
  if (members.length === 0) return null

  for (const m of members) {
    if (m.max_hp === '' || m.ac === '' || m.nova_damage === '' || m.sustained_damage_per_round === '') return null
    if ((m.max_hp as number) < 1 || (m.ac as number) < 1) return null
  }

  const n         = members.length
  const hps       = members.map((m) => m.max_hp as number)
  const acs       = members.map((m) => m.ac as number)
  const novas     = members.map((m) => m.nova_damage as number)
  const sustains  = members.map((m) => m.sustained_damage_per_round as number)

  const total_hp   = hps.reduce((a, b) => a + b, 0)
  const avg_hp     = total_hp / n
  const lowest_hp  = Math.min(...hps)
  const avg_ac     = acs.reduce((a, b) => a + b, 0) / n
  const party_nova      = novas.reduce((a, b) => a + b, 0)
  const party_sustained = sustains.reduce((a, b) => a + b, 0)
  const prof             = proficiencyBonus(level)

  return {
    party_size: n,
    avg_level: level,
    avg_hp,
    total_hp,
    lowest_hp,
    avg_ac,
    party_nova,
    party_sustained,
    proficiency_bonus: prof,
    estimated_bonus_actions_per_round: n * 0.5,
    avg_attack_bonus: Math.floor(level / 2) + prof,
  }
}

export function PartyProfileInput({ onPartyProfileChange, initialMembers, campaignId }: Props) {
  const defaultMembers: MemberRow[] = initialMembers
    ? initialMembers.map((m) => ({
        max_hp: m.max_hp, ac: m.ac,
        nova_damage: m.nova_damage, sustained_damage_per_round: m.sustained_damage_per_round,
      }))
    : [DEFAULT_MEMBER, DEFAULT_MEMBER, DEFAULT_MEMBER, DEFAULT_MEMBER]

  const {
    register, control, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: { party_level: '', members: defaultMembers },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'members' })

  const watched = watch()
  const profile = useMemo(() => computeProfile(watched), [watched])

  useEffect(() => {
    if (profile) onPartyProfileChange(profile)
  }, [profile, onPartyProfileChange])

  // ── Auto-load from campaign party summary ──────────────────────────────────
  const { data: partySummary, isLoading: summaryLoading } = usePartySummary(campaignId)
  const autoLoadedRef = useRef(false)

  useEffect(() => {
    if (autoLoadedRef.current || !partySummary) return
    if (partySummary.characters.length === 0) {
      autoLoadedRef.current = true
      return
    }
    autoLoadedRef.current = true

    const newRows: MemberRow[] = partySummary.characters.map((c) => ({
      max_hp: c.max_hp,
      ac: c.armor_class,
      nova_damage: c.nova_damage,
      sustained_damage_per_round: c.sustained_damage_per_round,
      _name: c.character_name,
    }))

    replace(newRows)
    const avgLevel = Math.max(1, Math.min(20, Math.round(partySummary.avg_level)))
    setValue('party_level', avgLevel)
  }, [partySummary, replace, setValue])

  // ── Banner state ───────────────────────────────────────────────────────────
  type BannerKind = 'green' | 'amber' | 'info' | null
  let bannerKind: BannerKind = null
  if (campaignId) {
    if (!summaryLoading && partySummary) {
      if (partySummary.party_size === 0 || partySummary.characters.length === 0) {
        bannerKind = 'info'
      } else if (partySummary.has_complete_data) {
        bannerKind = 'green'
      } else {
        bannerKind = 'amber'
      }
    }
  }

  const canRemove = fields.length > 1
  const canAdd    = fields.length < 12
  const lowestIsLow = profile != null && profile.lowest_hp < profile.avg_hp * 0.8

  return (
    <div className="ppi-root">
      {/* ── Auto-load banners ── */}
      {bannerKind === 'green' && (
        <div style={{
          background: 'color-mix(in srgb, var(--success) 15%, var(--bg-card))',
          border: '1px solid color-mix(in srgb, var(--success) 40%, var(--border))',
          borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.82rem',
          color: 'var(--success)',
        }}>
          ✓ Party loaded from campaign characters. Values are editable overrides.
        </div>
      )}
      {bannerKind === 'amber' && partySummary && (
        <div style={{
          background: 'color-mix(in srgb, #e6a817 12%, var(--bg-card))',
          border: '1px solid color-mix(in srgb, #e6a817 35%, var(--border))',
          borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.82rem',
          color: '#c88c10',
        }}>
          ⚠ Some characters are missing combat data: {partySummary.incomplete_characters.join(', ')}.{' '}
          <Link to="/characters" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Set up combat stats →
          </Link>
        </div>
      )}
      {bannerKind === 'info' && (
        <div style={{
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.82rem',
          color: 'var(--text-muted)',
        }}>
          ℹ Set up character combat stats to auto-load party data.{' '}
          <Link to="/characters" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
            Go to Characters →
          </Link>
        </div>
      )}

      {/* Party level */}
      <div className="ppi-level-row">
        <label className="ppi-level-label" htmlFor="party-level">Party Level</label>
        <div className="ppi-field">
          <input
            id="party-level"
            type="number"
            className={`ppi-input${errors.party_level ? ' ppi-input--error' : ''}`}
            aria-describedby={errors.party_level ? 'party-level-error' : undefined}
            {...register('party_level', {
              required: 'Must be between 1 and 20',
              min: { value: 1, message: 'Must be between 1 and 20' },
              max: { value: 20, message: 'Must be between 1 and 20' },
              valueAsNumber: true,
            })}
          />
          {errors.party_level && (
            <span id="party-level-error" className="ppi-error" role="alert">
              {errors.party_level.message}
            </span>
          )}
        </div>
      </div>

      <div className="ppi-body">
        <div className="ppi-members">
          <div className="ppi-member-header">
            <span className="ppi-col-label">Max HP</span>
            <span className="ppi-col-label">AC</span>
            <span className="ppi-col-label">Nova Damage</span>
            <span className="ppi-col-label">Sustained Dmg/Round</span>
            <span />
          </div>

          {fields.map((field, idx) => (
            <div key={field.id}>
              {/* Character name label (auto-loaded rows only) */}
              {field._name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {field._name}
                  </span>
                  <Link to="/characters"
                    style={{ fontSize: '0.65rem', color: 'var(--accent)', textDecoration: 'none' }}
                    title="Edit combat stats">
                    ✏
                  </Link>
                </div>
              )}

              <div className="ppi-member-row">
                <div className="ppi-field">
                  <input type="number"
                    className={`ppi-input${errors.members?.[idx]?.max_hp ? ' ppi-input--error' : ''}`}
                    aria-label={`Member ${idx + 1} max HP`}
                    {...register(`members.${idx}.max_hp`, {
                      required: 'Must be between 1 and 500',
                      min: { value: 1, message: 'Must be between 1 and 500' },
                      max: { value: 500, message: 'Must be between 1 and 500' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.members?.[idx]?.max_hp && (
                    <span className="ppi-error" role="alert">{errors.members[idx]!.max_hp!.message}</span>
                  )}
                </div>

                <div className="ppi-field">
                  <input type="number"
                    className={`ppi-input${errors.members?.[idx]?.ac ? ' ppi-input--error' : ''}`}
                    aria-label={`Member ${idx + 1} AC`}
                    {...register(`members.${idx}.ac`, {
                      required: 'Must be between 1 and 30',
                      min: { value: 1, message: 'Must be between 1 and 30' },
                      max: { value: 30, message: 'Must be between 1 and 30' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.members?.[idx]?.ac && (
                    <span className="ppi-error" role="alert">{errors.members[idx]!.ac!.message}</span>
                  )}
                </div>

                <div className="ppi-field">
                  <input type="number"
                    className={`ppi-input${errors.members?.[idx]?.nova_damage ? ' ppi-input--error' : ''}`}
                    aria-label={`Member ${idx + 1} nova damage`}
                    {...register(`members.${idx}.nova_damage`, {
                      required: 'Must be between 0 and 500',
                      min: { value: 0, message: 'Must be between 0 and 500' },
                      max: { value: 500, message: 'Must be between 0 and 500' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.members?.[idx]?.nova_damage && (
                    <span className="ppi-error" role="alert">{errors.members[idx]!.nova_damage!.message}</span>
                  )}
                </div>

                <div className="ppi-field">
                  <input type="number"
                    className={`ppi-input${errors.members?.[idx]?.sustained_damage_per_round ? ' ppi-input--error' : ''}`}
                    aria-label={`Member ${idx + 1} sustained damage per round`}
                    {...register(`members.${idx}.sustained_damage_per_round`, {
                      required: 'Must be between 0 and 200',
                      min: { value: 0, message: 'Must be between 0 and 200' },
                      max: { value: 200, message: 'Must be between 0 and 200' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.members?.[idx]?.sustained_damage_per_round && (
                    <span className="ppi-error" role="alert">
                      {errors.members[idx]!.sustained_damage_per_round!.message}
                    </span>
                  )}
                </div>

                <button type="button" className="ppi-remove-btn"
                  onClick={() => remove(idx)} disabled={!canRemove}
                  aria-label={`Remove member ${idx + 1}`}>
                  ✕
                </button>
              </div>
            </div>
          ))}

          <div className="ppi-actions">
            <button type="button" className="ppi-add-btn"
              onClick={() => append({ ...DEFAULT_MEMBER })} disabled={!canAdd}>
              + Add Member
            </button>
            <button type="button" className="ppi-import-btn" disabled
              title="Coming soon — will pull from character sheets automatically">
              Import from saved characters
            </button>
          </div>
        </div>

        {/* Derived stats panel */}
        <aside className="ppi-stats" aria-label="Party derived stats">
          <div className="ppi-stats-title">Party Summary</div>
          <div className="ppi-stat-row">
            <span className="ppi-stat-label">Party Size</span>
            <span className="ppi-stat-value">{fields.length} members</span>
          </div>

          {profile ? (
            <>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Party Level</span>
                <span className="ppi-stat-value">{profile.avg_level} (Tier {levelTier(profile.avg_level)})</span>
              </div>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Proficiency Bonus</span>
                <span className="ppi-stat-value">+{profile.proficiency_bonus}</span>
              </div>
              <hr className="ppi-stat-divider" />
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Average HP</span>
                <span className="ppi-stat-value">{profile.avg_hp.toFixed(1)}</span>
              </div>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Total HP</span>
                <span className="ppi-stat-value">{profile.total_hp}</span>
              </div>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Lowest HP</span>
                <span className={`ppi-stat-value${lowestIsLow ? ' ppi-stat-value--amber' : ''}`}
                  data-testid="lowest-hp">
                  {profile.lowest_hp}{lowestIsLow && ' ⚠'}
                </span>
              </div>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Average AC</span>
                <span className="ppi-stat-value">{profile.avg_ac.toFixed(1)}</span>
              </div>
              <hr className="ppi-stat-divider" />
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Est. Avg Attack Bonus</span>
                <span className="ppi-stat-value">+{profile.avg_attack_bonus}</span>
              </div>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Total Nova Damage</span>
                <span className="ppi-stat-value">{profile.party_nova.toFixed(1)}</span>
              </div>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Total Sustained Dmg/Round</span>
                <span className="ppi-stat-value">{profile.party_sustained.toFixed(1)}</span>
              </div>
              <div className="ppi-stat-row">
                <span className="ppi-stat-label">Est. Bonus Actions/Round</span>
                <span className="ppi-stat-value">{profile.estimated_bonus_actions_per_round.toFixed(1)}</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
              Fill in all fields to see stats.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
