import { useState } from 'react'
import type { Character } from '../types'
import { ABILITIES, SKILLS, SAVES, calcModifier, formatModifier } from '../constants/dnd'
import {
  useCharacters,
  useCreateCharacter,
  useDeleteCharacter,
  useUpdateCharacter,
} from '../hooks/useCharacters'

export function CharactersPage() {
  const { data: characters = [], isLoading } = useCharacters()
  const createCharacter = useCreateCharacter()
  const updateCharacter = useUpdateCharacter()
  const deleteCharacter = useDeleteCharacter()

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleCreate() {
    createCharacter.mutate({}, {
      onSuccess: (char) => {
        setExpandedIds((prev) => new Set([...prev, char.id]))
      },
    })
  }

  function handleUpdate(id: number, patch: Partial<Character>) {
    updateCharacter.mutate({ id, ...patch })
  }

  function handleDelete(id: number) {
    deleteCharacter.mutate(id, {
      onSuccess: () => {
        setDeleteConfirmId(null)
        setExpandedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      },
    })
  }

  if (isLoading) return <div className="status-text">Loading…</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>Characters</h1>
        <button className="btn-primary" onClick={handleCreate} disabled={createCharacter.isPending}>
          + Add Character
        </button>
      </div>

      {characters.length === 0 && (
        <p className="empty-state">No characters yet. Add one to get started.</p>
      )}

      <div className="character-manager-list">
        {characters.map((character) => (
          <CharacterManagerCard
            key={character.id}
            character={character}
            expanded={expandedIds.has(character.id)}
            onToggleExpand={() => toggleExpand(character.id)}
            onUpdate={(patch) => handleUpdate(character.id, patch)}
            onDelete={() => {
              if (deleteConfirmId === character.id) {
                handleDelete(character.id)
              } else {
                setDeleteConfirmId(character.id)
              }
            }}
            deleteConfirm={deleteConfirmId === character.id}
            onCancelDelete={() => setDeleteConfirmId(null)}
          />
        ))}
      </div>
    </div>
  )
}

interface CardProps {
  character: Character
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (patch: Partial<Character>) => void
  onDelete: () => void
  deleteConfirm: boolean
  onCancelDelete: () => void
}

function CharacterManagerCard({
  character,
  expanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  deleteConfirm,
  onCancelDelete,
}: CardProps) {
  return (
    <div className="character-manager-card">
      <div className="character-manager-card-header">
        <InlineEdit
          value={character.name}
          placeholder="Name"
          onCommit={(v) => onUpdate({ name: v })}
          className="char-inline-name"
        />
        <InlineEdit
          value={character.char_class}
          placeholder="Class"
          onCommit={(v) => onUpdate({ char_class: v })}
          className="char-inline-class"
        />
        <InlineEdit
          value={character.subclass}
          placeholder="Subclass"
          onCommit={(v) => onUpdate({ subclass: v })}
          className="char-inline-subclass"
        />
        <InlineNumberEdit
          value={character.level}
          min={1}
          max={20}
          onCommit={(v) => onUpdate({ level: v })}
          className="char-inline-level"
          label="Lv"
        />

        <div className="char-card-actions">
          <button className="btn-icon" onClick={onToggleExpand} type="button">
            {expanded ? '▲' : '▼'}
          </button>
          {deleteConfirm ? (
            <>
              <span className="char-delete-confirm">Delete?</span>
              <button className="btn-icon btn-danger" onClick={onDelete} type="button">
                Yes
              </button>
              <button className="btn-icon" onClick={onCancelDelete} type="button">
                No
              </button>
            </>
          ) : (
            <button className="btn-icon btn-danger" onClick={onDelete} type="button" title="Delete character">
              ✕
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="character-manager-card-body">
          {/* Ability Scores */}
          <div className="char-section">
            <div className="char-section-title">Ability Scores</div>
            <div className="ability-grid">
              {ABILITIES.map((a) => {
                const score = (character as Record<string, number>)[a.scoreField]
                const mod = (character as Record<string, number>)[a.modField]
                return (
                  <div key={a.key} className="ability-cell">
                    <div className="ability-label">{a.key.toUpperCase()}</div>
                    <div className="ability-fields">
                      <div className="ability-field-group">
                        <label>Score</label>
                        <input
                          className="input small-input"
                          type="number"
                          min={1}
                          max={30}
                          defaultValue={score}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10)
                            if (!isNaN(val)) {
                              const newMod = calcModifier(val)
                              onUpdate({
                                [a.scoreField]: val,
                                [a.modField]: newMod,
                              } as Partial<Character>)
                            }
                          }}
                        />
                      </div>
                      <div className="ability-field-group">
                        <label>Mod</label>
                        <input
                          className="input small-input"
                          type="number"
                          defaultValue={mod}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value, 10)
                            if (!isNaN(val)) {
                              onUpdate({ [a.modField]: val } as Partial<Character>)
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Skill Modifiers */}
          <div className="char-section">
            <div className="char-section-title">Skill Modifiers</div>
            <div className="skill-grid">
              {SKILLS.map((s) => (
                <div key={s.key} className="skill-cell">
                  <label>{s.name}</label>
                  <input
                    className="input small-input"
                    type="number"
                    defaultValue={(character as Record<string, number>)[s.key]}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) {
                        onUpdate({ [s.key]: val } as Partial<Character>)
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Saving Throws */}
          <div className="char-section">
            <div className="char-section-title">Saving Throws</div>
            <div className="save-grid">
              {SAVES.map((s) => (
                <div key={s.key} className="skill-cell">
                  <label>{s.name}</label>
                  <input
                    className="input small-input"
                    type="number"
                    defaultValue={(character as Record<string, number>)[s.key]}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val)) {
                        onUpdate({ [s.key]: val } as Partial<Character>)
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Combat */}
          <div className="char-section">
            <div className="char-section-title">Combat</div>
            <div className="combat-grid">
              <div className="skill-cell">
                <label>AC</label>
                <input
                  className="input small-input"
                  type="number"
                  defaultValue={character.ac}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) onUpdate({ ac: val })
                  }}
                />
              </div>
              <div className="skill-cell">
                <label>Max HP</label>
                <input
                  className="input small-input"
                  type="number"
                  defaultValue={character.max_hp}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) onUpdate({ max_hp: val })
                  }}
                />
              </div>
            </div>
          </div>

          <div className="char-ability-summary">
            {ABILITIES.map((a) => (
              <span key={a.key} className="ability-summary-item">
                {a.key.toUpperCase()}{' '}
                {formatModifier((character as Record<string, number>)[a.modField])}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface InlineEditProps {
  value: string
  placeholder: string
  onCommit: (val: string) => void
  className?: string
}

function InlineEdit({ value, placeholder, onCommit, className }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    return (
      <input
        className={`inline-edit-input ${className ?? ''}`}
        value={draft}
        placeholder={placeholder}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onCommit(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setEditing(false)
            onCommit(draft)
          }
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <span
      className={`inline-edit-display ${className ?? ''}`}
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      title={`Click to edit ${placeholder.toLowerCase()}`}
    >
      {value || <span className="placeholder">{placeholder}</span>}
    </span>
  )
}

interface InlineNumberEditProps {
  value: number
  min?: number
  max?: number
  onCommit: (val: number) => void
  className?: string
  label?: string
}

function InlineNumberEdit({ value, min, max, onCommit, className, label }: InlineNumberEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  if (editing) {
    return (
      <input
        className={`inline-edit-input inline-edit-number ${className ?? ''}`}
        type="number"
        value={draft}
        min={min}
        max={max}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const val = parseInt(draft, 10)
          if (!isNaN(val)) onCommit(val)
          else setDraft(String(value))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setEditing(false)
            const val = parseInt(draft, 10)
            if (!isNaN(val)) onCommit(val)
          }
          if (e.key === 'Escape') {
            setDraft(String(value))
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <span
      className={`inline-edit-display ${className ?? ''}`}
      onClick={() => {
        setDraft(String(value))
        setEditing(true)
      }}
    >
      {label ? `${label} ${value}` : value}
    </span>
  )
}
