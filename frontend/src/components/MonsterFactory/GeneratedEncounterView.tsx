import { useState } from 'react'
import type { DnDBeyondExport, GeneratedEncounter, GeneratedMonster } from '../../types/monsterFactory'
import { useExportDnDBeyond } from '../../hooks/useMonsterFactory'
import { DnDBeyondExportModal } from './DnDBeyondExportModal'
import { EncounterSummaryPanel } from './EncounterSummaryPanel'
import { MonsterStatBlockCard } from './MonsterStatBlockCard'
import './EncounterOutput.css'

interface Props {
  encounter: GeneratedEncounter
  onSave: (name: string, currentEncounter: GeneratedEncounter) => Promise<void>
  onSaveMonsterTemplate: (monster: GeneratedMonster, name: string) => Promise<void>
  onRebalance: () => void
  onNewEncounter: () => void
  isSaving: boolean
  saveButtonLabel?: string
}

interface TemplateRow {
  monster: GeneratedMonster
  name: string
  checked: boolean
}

export function GeneratedEncounterView({
  encounter,
  onSave,
  onSaveMonsterTemplate,
  onRebalance,
  onNewEncounter,
  isSaving,
  saveButtonLabel = 'Save Encounter',
}: Props) {
  // Local mutable copy — renames are applied here and passed to onSave at save time
  const [localEncounter, setLocalEncounter] = useState<GeneratedEncounter>(encounter)

  // D&D Beyond export
  const exportMutation = useExportDnDBeyond()
  const [exportData, setExportData] = useState<DnDBeyondExport | null>(null)

  async function handleExport(monster: GeneratedMonster) {
    try {
      const data = await exportMutation.mutateAsync(monster)
      setExportData(data)
    } catch {
      // silently ignore export errors
    }
  }

  const showMathDetail = Object.keys(localEncounter.math_detail).length > 0

  // ── Rename handlers ──────────────────────────────────────────────────────────

  function handleMonsterRenamed(slotIndex: number, newName: string) {
    setLocalEncounter((prev) => ({
      ...prev,
      monsters: prev.monsters.map((m, i) =>
        i === slotIndex ? { ...m, creature_archetype_name: newName } : m,
      ),
    }))
  }

  function handleAbilityRenamed(
    slotIndex: number,
    abilityIndex: number,
    isLegendary: boolean,
    newName: string,
  ) {
    const key = isLegendary ? 'legendary_actions' : 'standard_actions'
    setLocalEncounter((prev) => ({
      ...prev,
      monsters: prev.monsters.map((m, i) => {
        if (i !== slotIndex) return m
        return {
          ...m,
          abilities: {
            ...m.abilities,
            [key]: m.abilities[key].map((a, j) =>
              j === abilityIndex ? { ...a, name: newName } : a,
            ),
          },
        }
      }),
    }))
  }

  // ── Save encounter flow ──────────────────────────────────────────────────────
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveName, setSaveName]           = useState(localEncounter.encounter_name)

  async function handleSaveConfirm() {
    await onSave(saveName.trim() || localEncounter.encounter_name, localEncounter)
    setShowSaveInput(false)
  }

  // ── Save monster templates flow ─────────────────────────────────────────────
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateRows, setTemplateRows]           = useState<TemplateRow[]>([])
  const [templateSaving, setTemplateSaving]       = useState(false)

  function openTemplateModal() {
    setTemplateRows(
      localEncounter.monsters.map((m) => ({
        monster: m,
        name: m.creature_archetype_name,
        checked: true,
      })),
    )
    setTemplateModalOpen(true)
  }

  async function handleTemplateSave() {
    setTemplateSaving(true)
    try {
      for (const row of templateRows) {
        if (row.checked) {
          await onSaveMonsterTemplate(row.monster, row.name.trim() || row.monster.creature_archetype_name)
        }
      }
    } finally {
      setTemplateSaving(false)
      setTemplateModalOpen(false)
    }
  }

  function updateTemplateRow(idx: number, patch: Partial<TemplateRow>) {
    setTemplateRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="gev-root">
      {/* Summary panel */}
      <EncounterSummaryPanel encounter={localEncounter} />

      {/* Action bar */}
      <div className="gev-action-bar" role="toolbar" aria-label="Encounter actions">
        {showSaveInput ? (
          <div className="gev-save-inline">
            <input
              type="text"
              className="gev-save-name-input"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Encounter name…"
              aria-label="Encounter name"
              onKeyDown={(e) => e.key === 'Enter' && void handleSaveConfirm()}
              autoFocus
            />
            <button type="button" className="gev-btn gev-btn--primary"
              onClick={() => void handleSaveConfirm()} disabled={isSaving}>
              Confirm
            </button>
            <button type="button" className="gev-btn" onClick={() => setShowSaveInput(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="gev-btn gev-btn--primary"
            onClick={() => setShowSaveInput(true)} disabled={isSaving}>
            {saveButtonLabel}
          </button>
        )}

        <button type="button" className="gev-btn" onClick={openTemplateModal} disabled={isSaving}>
          Save Monster Templates
        </button>

        <button type="button" className="gev-btn" onClick={onRebalance} disabled={isSaving}>
          Rebalance
        </button>

        <button type="button" className="gev-btn gev-btn--danger"
          onClick={onNewEncounter} disabled={isSaving}>
          New Encounter
        </button>
      </div>

      {/* Stat block grid */}
      <div className="gev-stat-blocks">
        {localEncounter.monsters.map((monster, i) => (
          <MonsterStatBlockCard
            key={i}
            monster={monster}
            showMathDetail={showMathDetail}
            onMonsterRenamed={handleMonsterRenamed}
            onAbilityRenamed={handleAbilityRenamed}
            onExport={() => void handleExport(monster)}
          />
        ))}
      </div>

      {/* D&D Beyond export modal */}
      {exportData && (
        <DnDBeyondExportModal
          exportData={exportData}
          onClose={() => setExportData(null)}
        />
      )}

      {/* Saving overlay */}
      {isSaving && (
        <div className="gev-saving-overlay" aria-live="polite" aria-label="Saving">
          <div className="gev-saving-box">
            <span className="gev-spinner" />
            Saving…
          </div>
        </div>
      )}

      {/* Save monster templates modal */}
      {templateModalOpen && (
        <div className="gev-modal-overlay"
          onClick={() => !templateSaving && setTemplateModalOpen(false)}>
          <div className="gev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gev-modal-header">
              <h2 className="gev-modal-title">Save Monster Templates</h2>
              <button type="button" className="gev-modal-close"
                onClick={() => setTemplateModalOpen(false)}
                disabled={templateSaving} aria-label="Close">
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Select which monsters to save as reusable templates.
            </p>
            <div>
              {templateRows.map((row, idx) => (
                <div key={idx} className="gev-template-row">
                  <input type="checkbox" id={`tmpl-check-${idx}`} checked={row.checked}
                    onChange={(e) => updateTemplateRow(idx, { checked: e.target.checked })}
                    aria-label={`Save ${row.monster.creature_archetype_name} as template`}
                  />
                  <label htmlFor={`tmpl-check-${idx}`}
                    style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {row.monster.creature_archetype_name}
                    {row.monster.is_boss && ' (Boss)'}
                    {row.monster.count > 1 && ` ×${row.monster.count}`}
                  </label>
                  <input type="text" className="gev-template-name-input" value={row.name}
                    onChange={(e) => updateTemplateRow(idx, { name: e.target.value })}
                    placeholder="Template name…" disabled={!row.checked}
                    aria-label={`Template name for ${row.monster.creature_archetype_name}`}
                  />
                </div>
              ))}
            </div>
            <div className="gev-modal-footer">
              <button type="button" className="gev-btn" onClick={() => setTemplateModalOpen(false)}
                disabled={templateSaving}>
                Cancel
              </button>
              <button type="button" className="gev-btn gev-btn--primary"
                onClick={() => void handleTemplateSave()}
                disabled={templateSaving || templateRows.every((r) => !r.checked)}>
                {templateSaving ? 'Saving…' : 'Save Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
