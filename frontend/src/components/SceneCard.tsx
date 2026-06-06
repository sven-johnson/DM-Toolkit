import { useRef, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import type { Character, Check, Currency, Scene, SceneEnemy } from '../types'
import type { AssignedAbility, GeneratedMonster, MonsterStatBlock } from '../types/monsterFactory'
import { SceneEditor } from './SceneEditor'
import { CheckWidget } from './CheckWidget'
import { DmNotesEditor } from './DmNotesEditor'
import {
  useAddEnemy,
  useUpdateEnemy,
  useDeleteEnemy,
  useAddShopItem,
  useUpdateShopItem,
  useDeleteShopItem,
} from '../hooks/useStorylines'
import { useEnemyStatBlock } from '../hooks/useSceneCombat'
import { useExportDnDBeyond } from '../hooks/useMonsterFactory'
import { SceneMonsterFactoryModal } from './MonsterFactory/SceneMonsterFactoryModal'
import { AttachEncounterModal } from './MonsterFactory/AttachEncounterModal'
import { MonsterStatBlockCard } from './MonsterFactory/MonsterStatBlockCard'
import { DnDBeyondExportModal } from './MonsterFactory/DnDBeyondExportModal'
import type { DnDBeyondExport } from '../types/monsterFactory'

interface SlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

interface ScenePatch {
  title?: string
  body?: string
  dm_notes?: string | null
  scene_type?: string
  puzzle_clues?: string | null
  puzzle_solution?: string | null
  music_cue?: string | null
}

interface WikiArticleRef {
  id: string
  title: string
  category: string
}

interface Props {
  scene: Scene
  characters: Character[]
  queryKey: unknown[]
  deleteLabel: string
  onUpdate: (id: string, patch: ScenePatch) => void
  onDelete: (id: string) => void
  onSelectSlashItem: (sceneId: string, item: SlashItem, insertLine: () => void) => void
  onEditCheck: (check: Check) => void
  wikiArticles?: WikiArticleRef[]
  onWikiLinkClick?: (articleId: string, title: string) => void
  campaignId?: string
  onAddSceneBelow?: () => void
}

export function SceneCard({
  scene,
  characters,
  queryKey,
  deleteLabel,
  onUpdate,
  onDelete,
  onSelectSlashItem,
  onEditCheck,
  wikiArticles,
  onWikiLinkClick,
  campaignId,
  onAddSceneBelow,
}: Props) {
  const TITLE_MAX = 255

  const [collapsed, setCollapsed] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(scene.title)
  const [musicCue, setMusicCue] = useState(scene.music_cue ?? '')
  const [editingCue, setEditingCue] = useState(false)
  const [newEnemyName, setNewEnemyName]       = useState('')
  const [newEnemyQty, setNewEnemyQty]         = useState('1')
  const [factoryModalOpen, setFactoryModalOpen] = useState(false)
  const [attachModalOpen, setAttachModalOpen]   = useState(false)
  const [statBlockEnemyId, setStatBlockEnemyId] = useState<string | null>(null)
  const [sbExportData, setSbExportData]         = useState<DnDBeyondExport | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('0')
  const [newItemCurrency, setNewItemCurrency] = useState<Currency>('gold')

  const titleRef = useRef<HTMLInputElement>(null)

  const addEnemy = useAddEnemy(queryKey)
  const updateEnemy = useUpdateEnemy(queryKey)
  const deleteEnemy = useDeleteEnemy(queryKey)
  const { data: statBlock }   = useEnemyStatBlock(scene.id, statBlockEnemyId)
  const exportMutation        = useExportDnDBeyond()

  function statBlockToMonster(sb: MonsterStatBlock, roleName: string, count: number): GeneratedMonster {
    return {
      slot_index: 0,
      combat_role_name: roleName,
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
        standard_actions:  (sb.actions           ?? []) as unknown as AssignedAbility[],
        legendary_actions: (sb.legendary_actions ?? []) as unknown as AssignedAbility[],
        lair_actions:      (sb.lair_actions      ?? []) as unknown as AssignedAbility[],
        special_traits: [],
        multiattack_description: '',
      },
    }
  }
  const addShopItem = useAddShopItem(queryKey)
  const updateShopItem = useUpdateShopItem(queryKey)
  const deleteShopItem = useDeleteShopItem(queryKey)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function commitTitle() {
    const trimmed = titleDraft.trim().slice(0, TITLE_MAX)
    setEditingTitle(false)
    setTitleDraft(trimmed)
    if (trimmed && trimmed !== scene.title) {
      onUpdate(scene.id, { title: trimmed })
    } else if (!trimmed) {
      setTitleDraft(scene.title)
    }
  }

  function handleSaveBody(md: string) {
    if (md !== scene.body) {
      onUpdate(scene.id, { body: md })
    }
  }

  function handleAddEnemy(e: React.FormEvent) {
    e.preventDefault()
    if (!newEnemyName.trim()) return
    const qty = parseInt(newEnemyQty, 10)
    addEnemy.mutate(
      { sceneId: scene.id, name: newEnemyName.trim(), quantity: isNaN(qty) ? 1 : qty },
      {
        onSuccess: () => {
          setNewEnemyName('')
          setNewEnemyQty('1')
        },
      },
    )
  }

  function handleAddShopItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim()) return
    const price = parseInt(newItemPrice, 10)
    addShopItem.mutate(
      {
        sceneId: scene.id,
        name: newItemName.trim(),
        description: newItemDesc.trim(),
        price: isNaN(price) ? 0 : price,
        currency: newItemCurrency,
      },
      {
        onSuccess: () => {
          setNewItemName('')
          setNewItemDesc('')
          setNewItemPrice('0')
          setNewItemCurrency('gold')
        },
      },
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="scene-card" data-scene-type={scene.scene_type}>
      <div
        className="scene-header"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed((c) => !c) }}
        aria-expanded={!collapsed}
      >
        <span
          className="drag-handle"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>

        <div className="scene-title-area">
          {editingTitle ? (
            <div style={{ width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <input
                ref={titleRef}
                className="scene-title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTitle()
                  if (e.key === 'Escape') {
                    setTitleDraft(scene.title)
                    setEditingTitle(false)
                  }
                }}
                autoFocus
              />
              {titleDraft.length > TITLE_MAX && (
                <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.2rem', whiteSpace: 'nowrap' }}>
                  Maximum title length: {TITLE_MAX}
                </div>
              )}
            </div>
          ) : (
            <span
              className="scene-title"
              onClick={(e) => { e.stopPropagation(); setTitleDraft(scene.title); setEditingTitle(true) }}
              title="Click to edit title"
            >
              {scene.title}
            </span>
          )}
        </div>

        <div className="scene-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-icon scene-expand-indicator"
            type="button"
            onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c) }}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <button
            className="btn-icon btn-danger"
            onClick={() => onDelete(scene.id)}
            title={deleteLabel}
          >
            ✕
          </button>
        </div>

        <div className="scene-header-controls" onClick={(e) => e.stopPropagation()}>
          <div className="scene-music-cue">
            <span className="scene-music-label">Music Cue</span>
            {musicCue && (
              <button
                className="btn-icon scene-music-play"
                type="button"
                onClick={() => window.open(musicCue, '_blank')}
                title="Play music cue"
              >
                ▶
              </button>
            )}
            {(!musicCue || editingCue) ? (
              <input
                className="input scene-music-input"
                type="url"
                placeholder="Paste link…"
                defaultValue={musicCue}
                key={editingCue ? 'edit' : 'new'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim()
                    setMusicCue(val)
                    setEditingCue(false)
                    onUpdate(scene.id, { music_cue: val || null })
                  }
                  if (e.key === 'Escape' && editingCue) {
                    setEditingCue(false)
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim()
                  setMusicCue(val)
                  setEditingCue(false)
                  onUpdate(scene.id, { music_cue: val || null })
                }}
              />
            ) : (
              <button
                className="btn-icon"
                type="button"
                onClick={() => setEditingCue(true)}
                title="Edit music cue"
              >
                ✎
              </button>
            )}
          </div>

          <div className="scene-header-divider" />

          <select
            className="input scene-type-select"
            value={scene.scene_type}
            onChange={(e) => onUpdate(scene.id, { scene_type: e.target.value })}
          >
            <option value="story">Story</option>
            <option value="puzzle">Puzzle</option>
            <option value="combat">Combat</option>
            <option value="shop">Shop</option>
          </select>
        </div>
      </div>

      {!collapsed && (
        <div className="scene-body">
          <SceneEditor
            content={scene.body}
            onSave={handleSaveBody}
            onSelectSlashItem={(item, insertLine) =>
              onSelectSlashItem(scene.id, item, insertLine)
            }
            wikiArticles={wikiArticles}
            onWikiLinkClick={onWikiLinkClick}
            campaignId={campaignId}
            onAddSceneBelow={onAddSceneBelow}
          />

          <DmNotesEditor
            value={scene.dm_notes ?? ''}
            onSave={(val) => onUpdate(scene.id, { dm_notes: val || null })}
          />

          {scene.scene_type === 'puzzle' && (
            <div className="scene-type-section">
              <div className="scene-type-section-title">Puzzle</div>
              <div className="scene-type-field">
                <label className="scene-type-label">Clues</label>
                <textarea
                  className="input scene-type-textarea"
                  defaultValue={scene.puzzle_clues ?? ''}
                  placeholder="Clues for this puzzle…"
                  rows={3}
                  onBlur={(e) => {
                    const val = e.target.value
                    if (val !== (scene.puzzle_clues ?? '')) {
                      onUpdate(scene.id, { puzzle_clues: val || null })
                    }
                  }}
                />
              </div>
              <div className="scene-type-field">
                <label className="scene-type-label">Solution</label>
                <textarea
                  className="input scene-type-textarea"
                  defaultValue={scene.puzzle_solution ?? ''}
                  placeholder="Solution…"
                  rows={2}
                  onBlur={(e) => {
                    const val = e.target.value
                    if (val !== (scene.puzzle_solution ?? '')) {
                      onUpdate(scene.id, { puzzle_solution: val || null })
                    }
                  }}
                />
              </div>
            </div>
          )}

          {scene.scene_type === 'combat' && (
            <div className="scene-type-section">
              <div className="scene-type-section-title">Enemies</div>
              {scene.enemies.length > 0 && (
                <table className="scene-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Qty</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scene.enemies.map((enemy) => (
                      <tr key={enemy.id}>
                        <td>
                          <input
                            className="input small-input"
                            defaultValue={enemy.name}
                            onBlur={(e) => {
                              const val = e.target.value.trim()
                              if (val && val !== enemy.name) {
                                updateEnemy.mutate({
                                  sceneId: scene.id,
                                  enemyId: enemy.id,
                                  name: val,
                                })
                              }
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="input small-input"
                            type="number"
                            min={1}
                            defaultValue={enemy.quantity}
                            style={{ width: 56 }}
                            onBlur={(e) => {
                              const qty = parseInt(e.target.value, 10)
                              if (!isNaN(qty) && qty !== enemy.quantity) {
                                updateEnemy.mutate({
                                  sceneId: scene.id,
                                  enemyId: enemy.id,
                                  quantity: qty,
                                })
                              }
                            }}
                          />
                        </td>
                        <td style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          {enemy.saved_encounter_monster_id && (
                            <button
                              className="sb-btn"
                              type="button"
                              onClick={() => setStatBlockEnemyId(enemy.id)}
                              title="View stat block"
                            >
                              Stat Block
                            </button>
                          )}
                          <button
                            className="btn-icon btn-danger"
                            type="button"
                            onClick={() =>
                              deleteEnemy.mutate({ sceneId: scene.id, enemyId: enemy.id })
                            }
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <form className="scene-add-row" onSubmit={handleAddEnemy}>
                <input
                  className="input"
                  placeholder="Enemy name"
                  value={newEnemyName}
                  onChange={(e) => setNewEnemyName(e.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={newEnemyQty}
                  onChange={(e) => setNewEnemyQty(e.target.value)}
                  style={{ width: 64 }}
                />
                <button
                  className="btn-primary btn-sm"
                  type="submit"
                  disabled={addEnemy.isPending}
                >
                  + Add
                </button>
              </form>
              <div className="scene-mf-btns">
                {campaignId && (
                  <button
                    type="button"
                    className="scene-mf-btn"
                    onClick={() => setFactoryModalOpen(true)}
                  >
                    + Monster Factory
                  </button>
                )}
                <button
                  type="button"
                  className="scene-mf-btn"
                  onClick={() => setAttachModalOpen(true)}
                >
                  Attach Saved Encounter
                </button>
              </div>
            </div>
          )}

          {scene.scene_type === 'shop' && (
            <div className="scene-type-section">
              <div className="scene-type-section-title">Shop Items</div>
              {scene.shop_items.length > 0 && (
                <table className="scene-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Price</th>
                      <th>Currency</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scene.shop_items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            className="input small-input"
                            defaultValue={item.name}
                            onBlur={(e) => {
                              const val = e.target.value.trim()
                              if (val && val !== item.name) {
                                updateShopItem.mutate({
                                  sceneId: scene.id,
                                  itemId: item.id,
                                  name: val,
                                })
                              }
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="input small-input"
                            defaultValue={item.description ?? ''}
                            onBlur={(e) => {
                              const val = e.target.value
                              if (val !== (item.description ?? '')) {
                                updateShopItem.mutate({
                                  sceneId: scene.id,
                                  itemId: item.id,
                                  description: val,
                                })
                              }
                            }}
                          />
                        </td>
                        <td>
                          <input
                            className="input small-input"
                            type="number"
                            min={0}
                            defaultValue={item.price}
                            style={{ width: 64 }}
                            onBlur={(e) => {
                              const price = parseInt(e.target.value, 10)
                              if (!isNaN(price) && price !== item.price) {
                                updateShopItem.mutate({
                                  sceneId: scene.id,
                                  itemId: item.id,
                                  price,
                                })
                              }
                            }}
                          />
                        </td>
                        <td>
                          <select
                            className="input small-input"
                            defaultValue={item.currency}
                            onChange={(e) => {
                              updateShopItem.mutate({
                                sceneId: scene.id,
                                itemId: item.id,
                                currency: e.target.value,
                              })
                            }}
                          >
                            <option value="copper">Copper</option>
                            <option value="silver">Silver</option>
                            <option value="gold">Gold</option>
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn-icon btn-danger"
                            type="button"
                            onClick={() =>
                              deleteShopItem.mutate({ sceneId: scene.id, itemId: item.id })
                            }
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <form className="scene-add-row" onSubmit={handleAddShopItem}>
                <input
                  className="input"
                  placeholder="Item name"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Description"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  min={0}
                  placeholder="Price"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  style={{ width: 72 }}
                />
                <select
                  className="input"
                  value={newItemCurrency}
                  onChange={(e) => setNewItemCurrency(e.target.value as Currency)}
                  style={{ width: 88 }}
                >
                  <option value="copper">Copper</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
                <button
                  className="btn-primary btn-sm"
                  type="submit"
                  disabled={addShopItem.isPending}
                >
                  + Add
                </button>
              </form>
            </div>
          )}

          {scene.checks.length > 0 && (
            <div className="scene-checks">
              {scene.checks.map((check: Check) => (
                <CheckWidget
                  key={check.id}
                  check={check}
                  characters={characters}
                  queryKey={queryKey}
                  onEdit={onEditCheck}
                  onDelete={() => {
                    // handled inside widget
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Monster Factory modal */}
      {factoryModalOpen && campaignId && (
        <SceneMonsterFactoryModal
          sceneId={scene.id}
          campaignId={campaignId}
          queryKey={queryKey}
          onClose={() => setFactoryModalOpen(false)}
        />
      )}

      {/* Attach saved encounter modal */}
      {attachModalOpen && (
        <AttachEncounterModal
          sceneId={scene.id}
          queryKey={queryKey}
          onClose={() => setAttachModalOpen(false)}
        />
      )}

      {/* Stat block viewer modal */}
      {statBlockEnemyId && statBlock && (() => {
        const enemy = scene.enemies.find((e) => e.id === statBlockEnemyId)
        const roleName = enemy?.stat_block_summary?.combat_role_name ?? '—'
        const count    = enemy?.quantity ?? 1
        const monster  = statBlockToMonster(statBlock, roleName, count)
        return (
          <div className="sbm-overlay" onClick={() => { setStatBlockEnemyId(null); setSbExportData(null) }}>
            <div className="sbm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sbm-header">
                <h2 className="sbm-title">{statBlock.name}</h2>
                <button
                  type="button"
                  className="sbm-close"
                  onClick={() => { setStatBlockEnemyId(null); setSbExportData(null) }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="sbm-body">
                <MonsterStatBlockCard monster={monster} showMathDetail={false} />
              </div>
              <div className="sbm-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={exportMutation.isPending}
                  onClick={() => void exportMutation.mutateAsync(monster).then(setSbExportData)}
                >
                  {exportMutation.isPending ? 'Loading…' : 'Export to D&D Beyond'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* D&D Beyond export modal (opened from stat block viewer) */}
      {sbExportData && (
        <DnDBeyondExportModal
          exportData={sbExportData}
          onClose={() => setSbExportData(null)}
        />
      )}
    </div>
  )
}
