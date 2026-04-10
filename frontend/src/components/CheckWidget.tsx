import { useRef, useState } from 'react'
import type { Character, Check } from '../types'
import { getCheckModifier } from '../constants/dnd'
import { useDeleteCheck, useUpdateCheck } from '../hooks/useChecks'
import { useDeleteRoll, useUpsertRoll } from '../hooks/useRolls'

interface Props {
  check: Check
  characters: Character[]
  queryKey: unknown[]
  onEdit: (check: Check) => void
  onDelete: (id: number) => void
}

export function CheckWidget({ check, characters, queryKey, onEdit, onDelete }: Props) {
  const updateCheck = useUpdateCheck(queryKey)
  const deleteCheck = useDeleteCheck(queryKey)
  const upsertRoll = useUpsertRoll(queryKey)
  const deleteRoll = useDeleteRoll(queryKey)

  const [dcInput, setDcInput] = useState(String(check.dc))
  const dcInputRef = useRef<HTMLInputElement>(null)

  const isSkill = check.check_type === 'skill'
  const icon = isSkill ? '⚠️' : '🔴'

  function getCheckLabel(): string {
    if (isSkill) {
      const sub = check.subtype.replace(/_/g, ' ')
      const title = sub.charAt(0).toUpperCase() + sub.slice(1)
      return `${title} Check`
    } else {
      const sub = check.subtype.replace(/_save$/, '').replace(/_/g, ' ')
      const title = sub.charAt(0).toUpperCase() + sub.slice(1)
      return `${title} Save`
    }
  }


  function commitDc() {
    const val = parseInt(dcInput, 10)
    if (!isNaN(val) && val !== check.dc) {
      updateCheck.mutate({ id: check.id, dc: val })
    } else {
      setDcInput(String(check.dc))
    }
  }

  const visibleCharacters =
    check.character_ids.length === 0
      ? characters
      : characters.filter((c) => check.character_ids.includes(c.id))

  function getRollForCharacter(characterId: number) {
    return check.rolls.find((r) => r.character_id === characterId)
  }

  function handleRollInput(character: Character, value: string) {
    if (value.trim() === '') {
      const existing = getRollForCharacter(character.id)
      if (existing) {
        deleteRoll.mutate({ checkId: check.id, characterId: character.id })
      }
      return
    }
    const total = parseInt(value, 10)
    if (isNaN(total)) return
    const modifier = getCheckModifier(character, check.check_type, check.subtype)
    const dieResult = total - modifier
    upsertRoll.mutate({
      checkId: check.id,
      characterId: character.id,
      dieResult,
    })
  }

  return (
    <div className="check-widget">
      <div className={`check-summary-line ${isSkill ? 'check-summary-skill' : 'check-summary-save'}`}>
        <strong className="check-summary-title">{getCheckLabel()}</strong>
        <div className="check-summary-actions">
          <button
            className="check-summary-btn"
            onClick={() => onEdit(check)}
            title="Edit check"
            type="button"
          >
            ✎
          </button>
          <button
            className="check-summary-btn check-summary-btn-danger"
            onClick={() => {
              deleteCheck.mutate(check.id)
              onDelete(check.id)
            }}
            title="Delete check"
            type="button"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="check-header">
        <span className="check-icon">{icon}</span>
        <span className="check-label">{getCheckLabel()}</span>
        <span className="check-dc-label">DC:</span>
        <input
          ref={dcInputRef}
          className="roll-input"
          style={{ width: 48 }}
          type="number"
          value={dcInput}
          onChange={(e) => setDcInput(e.target.value)}
          onBlur={commitDc}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              dcInputRef.current?.blur()
            }
          }}
        />
      </div>

      <div className="check-character-rows">
        {visibleCharacters.map((character) => {
          const modifier = getCheckModifier(character, check.check_type, check.subtype)
          const roll = getRollForCharacter(character.id)
          const total = roll !== undefined ? roll.die_result + modifier : undefined
          const passed = total !== undefined ? total >= check.dc : undefined

          return (
            <div key={character.id} className="check-character-row">
              <span className="check-char-name">{character.name || 'Unnamed'}</span>
              <RollInput
                value={total !== undefined ? String(total) : ''}
                onCommit={(val) => handleRollInput(character, val)}
              />
              {passed === true && <span className="pass-indicator">✓</span>}
              {passed === false && <span className="fail-indicator">✗</span>}
              {passed === undefined && <span className="pass-indicator" style={{ opacity: 0 }}>✓</span>}
            </div>
          )
        })}
        {visibleCharacters.length === 0 && (
          <div className="check-no-chars">No characters in scope</div>
        )}
      </div>
    </div>
  )
}

interface RollInputProps {
  value: string
  onCommit: (val: string) => void
}

function RollInput({ value, onCommit }: RollInputProps) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync if external value changes
  if (draft !== value && document.activeElement !== inputRef.current) {
    setDraft(value)
  }

  return (
    <input
      ref={inputRef}
      className="roll-input"
      type="number"
      placeholder="—"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          inputRef.current?.blur()
        }
      }}
    />
  )
}
