import { useState } from 'react'
import type { Character, SessionRollOut } from '../types'
import { formatModifier } from '../constants/dnd'
import { CharacterModal } from './CharacterModal'

interface Props {
  character: Character
  rolls: SessionRollOut[]
}

export function CharacterCard({ character, rolls }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const charRolls = rolls.filter((r) => r.character_id === character.id)
  const rollCount = charRolls.length
  const avgDie =
    rollCount > 0
      ? Math.round(charRolls.reduce((sum, r) => sum + r.die_result, 0) / rollCount)
      : null

  const tooltipText = [
    `AC ${character.ac}`,
    `STR ${formatModifier(character.str_mod)}`,
    `DEX ${formatModifier(character.dex_mod)}`,
    `CON ${formatModifier(character.con_mod)}`,
    `INT ${formatModifier(character.int_mod)}`,
    `WIS ${formatModifier(character.wis_mod)}`,
    `CHA ${formatModifier(character.cha_mod)}`,
  ].join(', ')

  return (
    <>
      <div
        className="character-card"
        onClick={() => setModalOpen(true)}
        title={tooltipText}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setModalOpen(true)
        }}
      >
        <div className="character-card-header">
          <span className="character-card-name">{character.name || 'Unnamed'}</span>
          <span className="character-card-level">Lv {character.level}</span>
        </div>
        <div className="character-card-meta">
          {character.char_class}
          {character.subclass ? ` (${character.subclass})` : ''}
        </div>
        <div className="character-card-rolls">
          {rollCount > 0 ? (
            <span>
              {rollCount} roll{rollCount !== 1 ? 's' : ''} &middot; avg die {avgDie}
            </span>
          ) : (
            <span className="text-muted">No rolls yet</span>
          )}
        </div>
      </div>

      {modalOpen && (
        <CharacterModal character={character} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
