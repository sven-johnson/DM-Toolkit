import { useRef, useState } from 'react'
import type { Character, Check } from '../types'
import { calcSuccessPercent, formatModifier, getCheckModifier } from '../constants/dnd'
import { useDeleteCheck, useUpdateCheck } from '../hooks/useChecks'
import { useDeleteRoll, useUpsertRoll } from '../hooks/useRolls'

interface Props {
  check: Check
  characters: Character[]
  sessionId: number
  onDelete: (id: number) => void
}

export function CheckWidget({ check, characters, sessionId, onDelete }: Props) {
  const updateCheck = useUpdateCheck(sessionId)
  const deleteCheck = useDeleteCheck(sessionId)
  const upsertRoll = useUpsertRoll(sessionId)
  const deleteRoll = useDeleteRoll(sessionId)

  const [dcInput, setDcInput] = useState(String(check.dc))
  const dcInputRef = useRef<HTMLInputElement>(null)

  const isSkill = check.check_type === 'skill'
  const icon = isSkill ? '⚠️' : '🔴'

  function getCheckLabel(): string {
    const sub = check.subtype.replace(/_/g, ' ')
    const title = sub.charAt(0).toUpperCase() + sub.slice(1)
    if (isSkill) return `${title} Check`
    return `${title} Save`
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

  function toggleCharacter(characterId: number) {
    const current = check.character_ids
    const idx = current.indexOf(characterId)
    let next: number[]
    if (idx >= 0) {
      next = current.filter((id) => id !== characterId)
    } else {
      next = [...current, characterId]
    }
    updateCheck.mutate({ id: check.id, character_ids: next })
  }

  function setAllCharacters() {
    updateCheck.mutate({ id: check.id, character_ids: [] })
  }

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
        <button
          className="btn-icon btn-danger"
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

      <div className="check-character-filter">
        <button
          className={`filter-toggle${check.character_ids.length === 0 ? ' active' : ''}`}
          onClick={setAllCharacters}
          type="button"
        >
          All Characters
        </button>
        {characters.map((c) => (
          <button
            key={c.id}
            className={`filter-toggle${check.character_ids.includes(c.id) ? ' active' : ''}`}
            onClick={() => toggleCharacter(c.id)}
            type="button"
          >
            {c.name || 'Unnamed'}
          </button>
        ))}
      </div>

      <div className="check-character-rows">
        {visibleCharacters.map((character) => {
          const modifier = getCheckModifier(character, check.check_type, check.subtype)
          const successPct = calcSuccessPercent(modifier, check.dc)
          const roll = getRollForCharacter(character.id)
          const total = roll !== undefined ? roll.die_result + modifier : undefined
          const passed = total !== undefined ? total >= check.dc : undefined

          return (
            <div key={character.id} className="check-character-row">
              <span className="check-char-name">{character.name || 'Unnamed'}</span>
              <span className="check-char-mod">{formatModifier(modifier)}</span>
              <span className="check-char-pct">{successPct}%</span>
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
