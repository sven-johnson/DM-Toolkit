import { useState } from 'react'
import type { GeneratedEncounter } from '../../types/monsterFactory'
import './EncounterOutput.css'

interface Props {
  encounter: GeneratedEncounter
}

const DIFF_COLORS: Record<string, string> = {
  trivial: '#6b7280',
  easy:    '#4caf80',
  medium:  '#d97706',
  hard:    '#f97316',
  deadly:  '#e05252',
}

export function EncounterSummaryPanel({ encounter }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const activeWarnings = encounter.all_warnings.filter((w) => !dismissed.has(w))
  const diffColor = DIFF_COLORS[encounter.difficulty] ?? '#6b7280'

  return (
    <div className="esp-root">
      <div className="esp-top-row">
        <span
          className="esp-diff-badge"
          style={{ background: diffColor }}
          data-testid="difficulty-badge"
        >
          {encounter.difficulty}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {encounter.encounter_name}
        </span>
      </div>

      <div className="esp-stat-list">
        <span className="esp-stat">
          <strong>Party </strong>
          {encounter.party_profile.party_size} players, level{' '}
          {encounter.party_profile.avg_level}
        </span>
        <span className="esp-stat">
          <strong>Expected Rounds </strong>
          {encounter.expected_rounds_min.toFixed(1)}–{encounter.expected_rounds_max.toFixed(1)}
          {' '}(avg {encounter.expected_rounds.toFixed(1)})
        </span>
        <span className="esp-stat">
          <strong>Total Monster HP </strong>
          {encounter.total_monster_hp}
        </span>
        <span className="esp-stat">
          <strong>Monsters </strong>
          {encounter.total_monster_count}
        </span>
      </div>

      {activeWarnings.length > 0 && (
        <div className="esp-warnings">
          {activeWarnings.map((w) => (
            <div key={w} className="esp-warning-card">
              <span className="esp-warning-icon">⚠</span>
              <span className="esp-warning-text">{w}</span>
              <button
                type="button"
                className="esp-warning-dismiss"
                onClick={() => setDismissed((prev) => new Set([...prev, w]))}
                aria-label="Dismiss warning"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
