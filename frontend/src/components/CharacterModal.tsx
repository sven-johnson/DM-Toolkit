import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Character } from '../types'
import { ABILITIES, SKILLS, SAVES, formatModifier } from '../constants/dnd'

interface Props {
  character: Character | null
  onClose: () => void
}

export function CharacterModal({ character, onClose }: Props) {
  useEffect(() => {
    if (!character) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [character, onClose])

  if (!character) return null

  return createPortal(
    <div className="character-modal-overlay" onClick={onClose}>
      <div
        className="character-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${character.name} details`}
      >
        <div className="character-modal-header">
          <h2>{character.name || 'Unnamed Character'}</h2>
          <button className="btn-icon" onClick={onClose} type="button" title="Close">
            ✕
          </button>
        </div>
        <div className="character-modal-sub">
          {character.char_class}
          {character.subclass ? ` — ${character.subclass}` : ''} &middot; Level {character.level}
        </div>

        <div className="character-modal-cols">
          {/* Column 1: Combat + Abilities + Saving Throws */}
          <div className="modal-col-left">
            <div className="modal-stat-block">
              <div className="modal-section-title">Combat</div>
              <div className="modal-stat-row">
                <span>AC</span>
                <strong>{character.ac}</strong>
              </div>
              <div className="modal-stat-row">
                <span>Max HP</span>
                <strong>{character.max_hp}</strong>
              </div>
            </div>

            <div className="modal-stat-block">
              <div className="modal-section-title">Abilities</div>
              {ABILITIES.map((a) => (
                <div key={a.key} className="modal-stat-row">
                  <span>{a.key.toUpperCase()}</span>
                  <strong>
                    {(character as unknown as Record<string, number>)[a.scoreField]}{' '}
                    ({formatModifier((character as unknown as Record<string, number>)[a.modField])})
                  </strong>
                </div>
              ))}
            </div>

            <div className="modal-stat-block">
              <div className="modal-section-title">Saving Throws</div>
              {SAVES.map((s) => (
                <div key={s.key} className="modal-stat-row">
                  <span>{s.name}</span>
                  <strong>{formatModifier((character as unknown as Record<string, number>)[s.key])}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Skills */}
          <div className="modal-col-right">
            <div className="modal-stat-block">
              <div className="modal-section-title">Skills</div>
              {SKILLS.map((s) => (
                <div key={s.key} className="modal-stat-row">
                  <span>{s.name}</span>
                  <strong>{formatModifier((character as unknown as Record<string, number>)[s.key])}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
