import type { Character, RollHistoryItem } from '../types'
import { useRollHistory } from '../hooks/useRolls'
import { useCharacters } from '../hooks/useCharacters'
import { formatModifier } from '../constants/dnd'

export function RollHistoryPage() {
  const { data: history = [], isLoading: histLoading } = useRollHistory()
  const { data: characters = [], isLoading: charsLoading } = useCharacters()

  if (histLoading || charsLoading) return <div className="status-text">Loading…</div>

  if (history.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Roll History</h1>
        </div>
        <p className="empty-state">No rolls recorded yet.</p>
      </div>
    )
  }

  const charMap = new Map<number, Character>(characters.map((c) => [c.id, c]))

  // Group by session
  const sessionGroups = new Map<number, { title: string; rolls: RollHistoryItem[] }>()
  for (const roll of history) {
    if (!sessionGroups.has(roll.session_id)) {
      sessionGroups.set(roll.session_id, { title: roll.session_title, rolls: [] })
    }
    sessionGroups.get(roll.session_id)!.rolls.push(roll)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Roll History</h1>
      </div>

      {Array.from(sessionGroups.entries()).map(([sessionId, group]) => {
        // Group rolls by check within this session
        const checkGroups = new Map<
          number,
          { checkType: string; subtype: string; dc: number; rolls: RollHistoryItem[] }
        >()
        for (const roll of group.rolls) {
          if (!checkGroups.has(roll.check_id)) {
            checkGroups.set(roll.check_id, {
              checkType: roll.check_type,
              subtype: roll.subtype,
              dc: roll.dc,
              rolls: [],
            })
          }
          checkGroups.get(roll.check_id)!.rolls.push(roll)
        }

        return (
          <div key={sessionId} className="roll-history-session">
            <div className="roll-history-session-title">{group.title}</div>

            {Array.from(checkGroups.entries()).map(([checkId, checkGroup]) => {
              const sub = checkGroup.subtype.replace(/_/g, ' ')
              const label =
                checkGroup.checkType === 'skill'
                  ? `${sub.charAt(0).toUpperCase() + sub.slice(1)} Check`
                  : `${sub.charAt(0).toUpperCase() + sub.slice(1)} Save`

              return (
                <div key={checkId} className="roll-history-check">
                  <div className="roll-history-check-header">
                    {checkGroup.checkType === 'skill' ? '⚠️' : '🔴'} {label} — DC {checkGroup.dc}
                  </div>
                  <table className="roll-history-table">
                    <thead>
                      <tr>
                        <th>Character</th>
                        <th>Die Result</th>
                        <th>Modifier</th>
                        <th>Total</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkGroup.rolls.map((roll) => {
                        const char = charMap.get(roll.character_id)
                        const charName = char?.name || `Character #${roll.character_id}`
                        const modifier = char
                          ? ((char as Record<string, number>)[roll.subtype] ?? 0)
                          : 0
                        const total = roll.die_result + modifier
                        const passed = total >= roll.dc

                        return (
                          <tr key={roll.id}>
                            <td>{charName}</td>
                            <td>{roll.die_result}</td>
                            <td>{formatModifier(modifier)}</td>
                            <td>{total}</td>
                            <td>
                              {passed ? (
                                <span className="pass-indicator">✓ Pass</span>
                              ) : (
                                <span className="fail-indicator">✗ Fail</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
