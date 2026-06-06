import type { GeneratedMonster } from '../../types/monsterFactory'
import { useInlineEdit } from '../../hooks/useInlineEdit'
import './EncounterOutput.css'

interface Props {
  monster: GeneratedMonster
  showMathDetail: boolean
  onMonsterRenamed?: (slotIndex: number, newName: string) => void
  onAbilityRenamed?: (slotIndex: number, abilityIndex: number, isLegendary: boolean, newName: string) => void
  onExport?: () => void
}

// ── Inline-editable text component ───────────────────────────────────────────

function EditableText({
  value,
  onSave,
  className,
}: {
  value: string
  onSave?: (v: string) => void
  className?: string
}) {
  const { editing, draft, setDraft, startEdit, commit, cancel } = useInlineEdit(
    value,
    onSave ?? (() => undefined),
  )

  if (!onSave) {
    return <span className={className}>{value}</span>
  }

  if (editing) {
    return (
      <input
        className="msb-edit-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') cancel()
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Rename"
      />
    )
  }

  return (
    <span
      className={`msb-editable${className ? ` ${className}` : ''}`}
      onClick={startEdit}
      title="Click to rename"
    >
      {value}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function sizeLabel(hp: number): string {
  if (hp < 36)  return 'Small'
  if (hp < 100) return 'Medium'
  if (hp < 200) return 'Large'
  return 'Huge'
}

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const
type AbilityKey = 'str_score' | 'dex_score' | 'con_score' | 'int_score' | 'wis_score' | 'cha_score'
const ABILITY_KEYS: AbilityKey[] = [
  'str_score', 'dex_score', 'con_score', 'int_score', 'wis_score', 'cha_score',
]

// ── Component ─────────────────────────────────────────────────────────────────

export function MonsterStatBlockCard({ monster, showMathDetail, onMonsterRenamed, onAbilityRenamed, onExport }: Props) {
  const { stats, abilities, is_boss, count, combat_role_name, creature_archetype_name, slot_index } = monster
  const size = sizeLabel(stats.hp)

  const hasResistSection = false  // not present on GeneratedMonster
  const hasSpecialTraits  = abilities.special_traits.length > 0
  const hasLegendary      = abilities.legendary_actions.length > 0
  const hasLair           = abilities.lair_actions.length > 0
  const hasMathDetail     = showMathDetail && Object.keys(stats.show_math_detail).length > 0

  return (
    <article className="msb-card">
      {/* ── Section 1: Header ── */}
      <header className="msb-header">
        <div className="msb-name-row">
          <h3 className="msb-name">
            <EditableText
              value={creature_archetype_name}
              onSave={onMonsterRenamed ? (v) => onMonsterRenamed(slot_index, v) : undefined}
            />
          </h3>
          {is_boss && <span className="msb-badge msb-badge--boss">BOSS</span>}
          {count > 1 && <span className="msb-badge msb-badge--count">×{count}</span>}
          {onExport && (
            <button type="button" className="msb-badge"
              style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer',
                       color: 'var(--accent)', fontSize: '0.65rem' }}
              onClick={onExport} title="Export to D&D Beyond">
              Export ↗
            </button>
          )}
        </div>
        <div className="msb-subtitle">
          {size} {creature_archetype_name}, {combat_role_name}
        </div>
        <div className="msb-chips">
          <span className="msb-chip"><strong>HP</strong> {stats.hp}</span>
          <span className="msb-chip"><strong>AC</strong> {stats.ac}</span>
          <span className="msb-chip"><strong>Speed</strong> {stats.speed} ft.</span>
        </div>
      </header>

      <div className="msb-body">
        {/* ── Section 2: Ability Scores ── */}
        <div className="msb-ability-grid" role="table" aria-label="Ability scores">
          {ABILITY_NAMES.map((name, i) => {
            const score = stats[ABILITY_KEYS[i]]
            return (
              <div key={name} className="msb-ability-cell" role="cell">
                <span className="msb-ability-name">{name}</span>
                <span className="msb-ability-score">{score}</span>
                <span className="msb-ability-mod">({abilityMod(score)})</span>
              </div>
            )
          })}
        </div>

        <hr className="msb-divider" />

        {/* ── Section 3: Combat Stats ── */}
        <div className="msb-combat-stats">
          <span className="msb-combat-stat"><strong>Attack Bonus</strong> +{stats.attack_bonus}</span>
          <span className="msb-combat-stat"><strong>Save DC</strong> {stats.save_dc}</span>
          <span className="msb-combat-stat"><strong>Speed</strong> {stats.speed} ft.</span>
        </div>

        {/* ── Section 4: Resistances (hidden for generated monsters) ── */}
        {hasResistSection && <hr className="msb-divider" />}

        {/* ── Section 5: Special Traits ── */}
        {hasSpecialTraits && (
          <>
            <hr className="msb-divider" />
            <div>
              {abilities.special_traits.map((trait, i) => {
                const dotIdx = trait.indexOf('.')
                const traitName = dotIdx >= 0 ? trait.slice(0, dotIdx) : trait
                const traitDesc = dotIdx >= 0 ? trait.slice(dotIdx + 1).trim() : ''
                return (
                  <p key={i} className="msb-trait-block">
                    <strong>{traitName}.</strong>{traitDesc && ` ${traitDesc}`}
                  </p>
                )
              })}
            </div>
          </>
        )}

        {/* ── Section 6: Actions ── */}
        <hr className="msb-divider" />
        <div>
          <div className="msb-section-heading">Actions</div>
          {abilities.multiattack_description && (
            <p className="msb-multiattack">{abilities.multiattack_description}</p>
          )}
          {abilities.standard_actions.length === 0 && (
            <p className="msb-action-desc">No actions.</p>
          )}
          {abilities.standard_actions.map((action, i) => (
            <div key={i} className="msb-action">
              <div className="msb-action-header">
                <span className="msb-action-name">
                  <EditableText
                    value={action.name}
                    onSave={onAbilityRenamed
                      ? (v) => onAbilityRenamed(slot_index, i, false, v)
                      : undefined}
                  />
                  .
                </span>
                <span className="msb-action-meta">
                  +{action.attack_bonus} to hit · {action.range} ·{' '}
                  {action.damage_dice}+{action.damage_bonus} {action.damage_type}
                </span>
              </div>
              <p className="msb-action-desc">{action.description}</p>
            </div>
          ))}
        </div>

        {/* ── Section 7: Legendary Actions ── */}
        {hasLegendary && (
          <>
            <hr className="msb-divider" />
            <div>
              <div className="msb-section-heading">Legendary Actions</div>
              <p className="msb-legendary-intro">
                The {creature_archetype_name} can take {stats.legendary_action_count} legendary
                action{stats.legendary_action_count !== 1 ? 's' : ''}, choosing from the options
                below. Only one legendary action option can be used at a time, and only at the end
                of another creature's turn.
              </p>
              {abilities.legendary_actions.map((action, i) => (
                <div key={i} className="msb-action">
                  <div className="msb-action-header">
                    <span className="msb-action-name">
                      <EditableText
                        value={action.name}
                        onSave={onAbilityRenamed
                          ? (v) => onAbilityRenamed(slot_index, i, true, v)
                          : undefined}
                      />
                      {action.action_cost > 1 && ` (Costs ${action.action_cost} Actions)`}.
                    </span>
                  </div>
                  <p className="msb-action-desc">{action.description}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Section 8: Lair Actions ── */}
        {hasLair && (
          <>
            <hr className="msb-divider" />
            <div>
              <div className="msb-section-heading">Lair Actions</div>
              <p className="msb-legendary-intro">
                On initiative count 20 (losing initiative ties), the {creature_archetype_name}{' '}
                can take a lair action.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {abilities.lair_actions.map((action, i) => (
                  <li key={i} className="msb-action-desc" style={{ marginBottom: '0.3rem' }}>
                    {action.description}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ── Section 9: Math Detail ── */}
        {hasMathDetail && (
          <>
            <hr className="msb-divider" />
            <details className="msb-math-details">
              <summary>Math Detail</summary>
              <table className="msb-math-table">
                <tbody>
                  {Object.entries(stats.show_math_detail).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </div>
    </article>
  )
}
