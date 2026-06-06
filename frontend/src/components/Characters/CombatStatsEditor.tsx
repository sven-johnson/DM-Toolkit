import { useState } from 'react'
import type { StatDefinition } from '../../types'
import {
  useCampaignDetail,
  useCharacterStats,
  useStatDefinitions,
  useUpsertStats,
} from '../../hooks/useCombatStats'
import { TurnEditor } from './TurnEditor'
import './CombatStatsEditor.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function profBonus(level: number): number {
  if (level <= 4)  return 2
  if (level <= 8)  return 3
  if (level <= 12) return 4
  if (level <= 16) return 5
  return 6
}

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

type SubTab = 'scores' | 'abilities'

interface Props {
  characterId: string
  characterLevel: number
  campaignId: string
}

export function CombatStatsEditor({ characterId, characterLevel, campaignId }: Props) {
  const [subTab, setSubTab]             = useState<SubTab>('scores')
  const [savingStatId, setSavingStatId] = useState<number | null>(null)

  const { data: campaign }      = useCampaignDetail(campaignId)
  const ruleSystemId            = campaign?.rule_system?.id ?? null

  const { data: statDefs = [], isLoading: statDefsLoading }  = useStatDefinitions(ruleSystemId)
  const { data: currentStats = [], isLoading: statsLoading } = useCharacterStats(characterId)

  const upsertStats = useUpsertStats(characterId)

  const abilityScoreDefs = statDefs.filter((d: StatDefinition) => d.stat_type === 'ability_score')

  const prof    = profBonus(characterLevel)
  const dexStat = currentStats.find((s) => s.stat_definition.slug === 'dexterity')
  const dexMod  = dexStat?.computed_modifier ?? 0

  function handleStatBlur(statDefId: number, rawValue: string) {
    const value = parseInt(rawValue, 10)
    if (isNaN(value) || value < 1 || value > 30) return
    setSavingStatId(statDefId)
    upsertStats.mutate(
      [{ stat_definition_id: statDefId, value }],
      { onSettled: () => setSavingStatId(null) },
    )
  }

  return (
    <div className="cse-root">
      <div className="cse-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={subTab === 'scores'}
          className={`cse-tab-btn${subTab === 'scores' ? ' cse-tab-btn--active' : ''}`}
          onClick={() => setSubTab('scores')}>
          Ability Scores
        </button>
        <button type="button" role="tab" aria-selected={subTab === 'abilities'}
          className={`cse-tab-btn${subTab === 'abilities' ? ' cse-tab-btn--active' : ''}`}
          onClick={() => setSubTab('abilities')}>
          Damage Turns ✦
        </button>
      </div>

      {/* ── Tab 1: Ability Scores ── */}
      {subTab === 'scores' && (
        <div role="tabpanel">
          {statDefsLoading || statsLoading
            ? <p className="cse-loading">Loading…</p>
            : (
              <>
                <div className="cse-score-grid">
                  {abilityScoreDefs.map((def) => {
                    const existing = currentStats.find((s) => s.stat_definition.id === def.id)
                    const currentValue = existing?.value ?? 10
                    const currentMod   = existing?.computed_modifier ?? 0
                    const saving       = savingStatId === def.id
                    return (
                      <div key={def.id} className="cse-score-cell">
                        <span className="cse-score-abbr">{def.abbreviation}</span>
                        <input
                          type="number"
                          className={`cse-score-input${saving ? ' cse-score-input--saving' : ''}`}
                          defaultValue={currentValue}
                          min={1} max={30}
                          aria-label={def.name}
                          onBlur={(e) => handleStatBlur(def.id, e.target.value)}
                        />
                        <span className="cse-score-mod">{fmtMod(currentMod)}</span>
                      </div>
                    )
                  })}
                </div>

                <div className="cse-derived">
                  <span className="cse-derived-stat"><strong>Prof Bonus </strong>{fmtMod(prof)}</span>
                  <span className="cse-derived-stat"><strong>Initiative </strong>{fmtMod(dexMod)}</span>
                </div>
              </>
            )}
        </div>
      )}

      {/* ── Tab 2: Damage Turns ── */}
      {subTab === 'abilities' && (
        <div role="tabpanel">
          <TurnEditor characterId={characterId} characterLevel={characterLevel} />
        </div>
      )}
    </div>
  )
}
