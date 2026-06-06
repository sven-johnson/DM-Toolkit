import { useMemo, useState } from 'react'
import {
  useCombatRoles,
  useDeleteEncounter,
  useSavedEncounter,
  useSavedEncounters,
} from '../../hooks/useMonsterFactory'
import type {
  AssignedAbility,
  GeneratedMonster,
  MonsterStatBlock,
} from '../../types/monsterFactory'
import { MonsterStatBlockCard } from './MonsterStatBlockCard'
import './SavedTab.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFF_COLORS: Record<string, string> = {
  trivial: '#6b7280', easy: '#4caf80', medium: '#d97706', hard: '#f97316', deadly: '#e05252',
}

function relativeDate(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return '1 day ago'
  if (diff < 30)  return `${diff} days ago`
  const m = Math.floor(diff / 30)
  if (m === 1)    return '1 month ago'
  if (m < 12)     return `${m} months ago`
  return new Date(dateStr).toLocaleDateString()
}

function statBlockToMonster(
  sb: MonsterStatBlock,
  count: number,
  idx: number,
  roleMap: Map<string, string>,
): GeneratedMonster {
  return {
    slot_index: idx,
    combat_role_name: roleMap.get(sb.combat_role_archetype_id) ?? 'Unknown',
    creature_archetype_name: sb.name,
    count,
    is_boss: sb.is_boss,
    stats: {
      hp: sb.hp, ac: sb.ac, attack_bonus: sb.attack_bonus, save_dc: sb.save_dc,
      damage_per_attack: 0, attack_count: sb.actions?.length ?? 1,
      damage_dice: '—', damage_bonus: 0, speed: sb.speed,
      str_score: sb.str_score, dex_score: sb.dex_score, con_score: sb.con_score,
      int_score: sb.int_score, wis_score: sb.wis_score, cha_score: sb.cha_score,
      legendary_action_count: sb.legendary_action_count,
      warnings: [], show_math_detail: {},
    },
    abilities: {
      standard_actions:   (sb.actions            ?? []) as unknown as AssignedAbility[],
      legendary_actions:  (sb.legendary_actions  ?? []) as unknown as AssignedAbility[],
      lair_actions:       (sb.lair_actions        ?? []) as unknown as AssignedAbility[],
      special_traits: [],
      multiattack_description: '',
    },
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onReopenInBuilder?: (encounterId: string) => void
  onSwitchToCreate?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SavedEncountersList({ onReopenInBuilder, onSwitchToCreate }: Props) {
  const [page, setPage]             = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [diffFilter, setDiffFilter] = useState('all')
  const [minLevel, setMinLevel]     = useState<number | ''>('')
  const [maxLevel, setMaxLevel]     = useState<number | ''>('')

  const { data: pagedData, isLoading, isError } = useSavedEncounters(page, 20)
  const { data: detail, isLoading: detailLoading }  = useSavedEncounter(selectedId)
  const { data: roles = [] }                        = useCombatRoles()
  const deleteMutation                              = useDeleteEncounter()

  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles])

  // Client-side filter on loaded page
  const filtered = useMemo(() => {
    if (!pagedData) return []
    return pagedData.items.filter((enc) => {
      if (search && !enc.name.toLowerCase().includes(search.toLowerCase())) return false
      if (diffFilter !== 'all' && enc.difficulty !== diffFilter) return false
      if (minLevel !== '' && enc.party_avg_level < (minLevel as number)) return false
      if (maxLevel !== '' && enc.party_avg_level > (maxLevel as number)) return false
      return true
    })
  }, [pagedData, search, diffFilter, minLevel, maxLevel])

  function toggleRow(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    await deleteMutation.mutateAsync(id)
    if (selectedId === id) setSelectedId(null)
  }

  const total    = pagedData?.total ?? 0
  const perPage  = 20
  const maxPage  = Math.max(1, Math.ceil(total / perPage))
  const showFrom = total === 0 ? 0 : (page - 1) * perPage + 1
  const showTo   = Math.min(page * perPage, total)

  if (isError) return <p className="st-error">Failed to load encounters.</p>

  return (
    <div>
      {/* Filter bar */}
      <div className="st-filter-bar">
        <input
          type="text"
          className="st-filter-input"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="st-filter-select"
          value={diffFilter}
          onChange={(e) => { setDiffFilter(e.target.value); setPage(1) }}
        >
          <option value="all">All Difficulties</option>
          {['trivial', 'easy', 'medium', 'hard', 'deadly'].map((d) => (
            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
          ))}
        </select>
        <input
          type="number" className="st-filter-number" placeholder="Min level"
          value={minLevel} min={1} max={20}
          onChange={(e) => { setMinLevel(e.target.value === '' ? '' : Number(e.target.value)); setPage(1) }}
          aria-label="Min party level"
        />
        <input
          type="number" className="st-filter-number" placeholder="Max level"
          value={maxLevel} min={1} max={20}
          onChange={(e) => { setMaxLevel(e.target.value === '' ? '' : Number(e.target.value)); setPage(1) }}
          aria-label="Max party level"
        />
      </div>

      {/* Loading */}
      {isLoading && <p className="st-loading">Loading encounters…</p>}

      {/* Empty state */}
      {!isLoading && total === 0 && (
        <div className="st-empty">
          <span className="st-empty-icon">📋</span>
          <span className="st-empty-title">No saved encounters yet</span>
          <span className="st-empty-sub">Generate and save an encounter to see it here.</span>
          {onSwitchToCreate && (
            <button type="button" className="st-empty-cta" onClick={onSwitchToCreate}>
              Create your first encounter
            </button>
          )}
        </div>
      )}

      {/* Filtered empty */}
      {!isLoading && total > 0 && filtered.length === 0 && (
        <div className="st-empty">
          <span className="st-empty-icon">🔍</span>
          <span className="st-empty-title">No encounters match your filters</span>
          <span className="st-empty-sub">Try adjusting the search or filter options.</span>
        </div>
      )}

      {/* List */}
      {!isLoading && filtered.length > 0 && (
        <div className="st-list">
          {filtered.map((enc) => {
            const expanded = selectedId === enc.id
            return (
              <div key={enc.id} className={`st-enc-row${expanded ? ' st-enc-row--expanded' : ''}`}>
                {/* Row header */}
                <div className="st-enc-row-header" onClick={() => toggleRow(enc.id)}>
                  <span className="st-enc-chevron">▶</span>
                  <span className="st-enc-name">{enc.name}</span>
                  <div className="st-enc-meta">
                    <span
                      className="st-diff-badge"
                      style={{ background: DIFF_COLORS[enc.difficulty] ?? '#6b7280' }}
                    >
                      {enc.difficulty}
                    </span>
                    <span className="st-enc-detail-text">
                      {enc.party_size}p lv{enc.party_avg_level}
                    </span>
                    <span className="st-enc-detail-text">
                      {enc.expected_rounds.toFixed(1)} rds
                    </span>
                    <span className="st-enc-detail-text">{enc.total_monster_count} monsters</span>
                    <span className="st-enc-date">{relativeDate(enc.created_at)}</span>
                    <button
                      type="button"
                      className="st-delete-btn"
                      onClick={(e) => void handleDelete(e, enc.id, enc.name)}
                      aria-label={`Delete ${enc.name}`}
                      title="Delete encounter"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="st-enc-detail">
                    {detailLoading && (
                      <div className="st-detail-loading">
                        <span className="st-spinner" />
                        Loading…
                      </div>
                    )}

                    {!detailLoading && detail && (
                      <>
                        {/* Summary */}
                        <div className="st-enc-detail-summary">
                          <span className="st-enc-detail-stat">
                            <strong>Party </strong>
                            {detail.party_size} players, level {detail.party_avg_level}
                          </span>
                          <span className="st-enc-detail-stat">
                            <strong>Expected Rounds </strong>
                            {detail.expected_rounds_min.toFixed(1)}–{detail.expected_rounds_max.toFixed(1)}
                          </span>
                          <span className="st-enc-detail-stat">
                            <strong>Total Monster HP </strong>
                            {detail.total_monster_count > 0
                              ? detail.encounter_monsters.reduce((s, m) => s + m.monster_stat_block.hp * m.count, 0)
                              : '—'}
                          </span>
                        </div>

                        {/* Stat blocks */}
                        <div className="st-enc-detail-blocks">
                          {[...detail.encounter_monsters]
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((em, idx) => (
                              <MonsterStatBlockCard
                                key={em.id}
                                monster={statBlockToMonster(em.monster_stat_block, em.count, idx, roleMap)}
                                showMathDetail={false}
                              />
                            ))}
                        </div>

                        <div className="st-enc-detail-footer">
                          {onReopenInBuilder && (
                            <button
                              type="button"
                              className="st-reopen-btn"
                              onClick={() => onReopenInBuilder(enc.id)}
                            >
                              Reopen in Builder
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="st-pagination">
          <span>
            {total === 0 ? 'No encounters' : `Showing ${showFrom}–${showTo} of ${total}`}
          </span>
          <div className="st-page-btns">
            <button
              type="button" className="st-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <button
              type="button" className="st-page-btn"
              disabled={page >= maxPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
