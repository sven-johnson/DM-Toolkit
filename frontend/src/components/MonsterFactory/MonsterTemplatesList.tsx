import { useMemo, useState } from 'react'
import {
  useCombatRoles,
  useDeleteMonsterTemplate,
  useMonsterTemplates,
} from '../../hooks/useMonsterFactory'
import type {
  AssignedAbility,
  GeneratedMonster,
  MonsterStatBlock,
} from '../../types/monsterFactory'
import { MonsterStatBlockCard } from './MonsterStatBlockCard'
import './SavedTab.css'

// ── Helper ────────────────────────────────────────────────────────────────────

function statBlockToMonster(
  sb: MonsterStatBlock,
  roleMap: Map<string, string>,
): GeneratedMonster {
  return {
    slot_index: 0,
    combat_role_name: roleMap.get(sb.combat_role_archetype_id) ?? 'Unknown',
    creature_archetype_name: sb.name,
    count: 1,
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
      standard_actions:  (sb.actions            ?? []) as unknown as AssignedAbility[],
      legendary_actions: (sb.legendary_actions  ?? []) as unknown as AssignedAbility[],
      lair_actions:      (sb.lair_actions        ?? []) as unknown as AssignedAbility[],
      special_traits: [],
      multiattack_description: '',
    },
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MonsterTemplatesList() {
  const [page, setPage]     = useState(1)
  const [viewId, setViewId] = useState<string | null>(null)

  const { data: pagedData, isLoading, isError } = useMonsterTemplates(page, 20)
  const { data: roles = [] }                    = useCombatRoles()
  const deleteMutation                          = useDeleteMonsterTemplate()

  const roleMap  = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles])
  const viewedSb = useMemo(
    () => viewId ? pagedData?.items.find((t) => t.id === viewId) : null,
    [viewId, pagedData],
  )

  const total   = pagedData?.total ?? 0
  const perPage = 20
  const maxPage = Math.max(1, Math.ceil(total / perPage))

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation()
    if (!window.confirm(`Delete template "${name}"? This cannot be undone.`)) return
    await deleteMutation.mutateAsync(id)
    if (viewId === id) setViewId(null)
  }

  if (isError) return <p className="st-error">Failed to load templates.</p>
  if (isLoading) return <p className="st-loading">Loading templates…</p>

  if (total === 0) {
    return (
      <div className="st-empty">
        <span className="st-empty-icon">🐉</span>
        <span className="st-empty-title">No saved monster templates yet</span>
        <span className="st-empty-sub">
          Save individual monsters from a generated encounter to reuse them across sessions.
        </span>
      </div>
    )
  }

  return (
    <div>
      {/* Card grid */}
      <div className="st-tmpl-grid">
        {pagedData!.items.map((sb) => {
          const roleName = roleMap.get(sb.combat_role_archetype_id) ?? '—'
          return (
            <div
              key={sb.id}
              className="st-tmpl-card"
              onClick={() => setViewId(sb.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setViewId(sb.id)}
              aria-label={`View ${sb.name}`}
            >
              <div className="st-tmpl-card-top">
                <span className="st-tmpl-name">{sb.name}</span>
                <button
                  type="button"
                  className="st-tmpl-delete-btn"
                  onClick={(e) => void handleDelete(e, sb.id, sb.name)}
                  aria-label={`Delete ${sb.name}`}
                  title="Delete template"
                >
                  🗑
                </button>
              </div>
              <div className="st-tmpl-badges">
                <span className="st-tmpl-badge">{roleName}</span>
                {sb.is_boss && <span className="st-tmpl-badge st-tmpl-badge--boss">BOSS</span>}
                {sb.has_legendary_actions && (
                  <span className="st-tmpl-badge">Legendary</span>
                )}
              </div>
              <div className="st-tmpl-stats">
                <span>HP {sb.hp}</span>
                <span>AC {sb.ac}</span>
                <span>+{sb.attack_bonus} to hit</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="st-pagination">
        <span>
          {total === 0 ? 'No templates'
            : `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}`}
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

      {/* Detail modal */}
      {viewId && viewedSb && (
        <div
          className="st-tmpl-modal-overlay"
          onClick={() => setViewId(null)}
        >
          <div
            className="st-tmpl-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="st-tmpl-modal-close"
              onClick={() => setViewId(null)}
            >
              ✕ Close
            </button>
            <MonsterStatBlockCard
              monster={statBlockToMonster(viewedSb, roleMap)}
              showMathDetail={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
