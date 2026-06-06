import { useState } from 'react'
import type { DnDBeyondExport } from '../../types/monsterFactory'
import './DnDBeyondExportModal.css'

interface Props {
  exportData: DnDBeyondExport
  onClose: () => void
}

// ── Copy button with feedback ─────────────────────────────────────────────────

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <button
      type="button"
      className={`ddb-copy-btn${copied ? ' ddb-copy-btn--copied' : ''}`}
      onClick={() => void handleCopy()}
      aria-label={`Copy ${label}`}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ── Numeric cell ──────────────────────────────────────────────────────────────

function NumCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ddb-num-cell">
      <span className="ddb-num-label">{label}</span>
      <div className="ddb-num-value-row">
        <span className="ddb-num-value">{value}</span>
        <CopyButton label={label} text={String(value)} />
      </div>
    </div>
  )
}

// ── Text section ──────────────────────────────────────────────────────────────

function TextSection({ label, dest, text }: { label: string; dest: string; text: string }) {
  const lines = text.split('\n').length
  const rows  = Math.min(Math.max(lines + 1, 4), 16)
  return (
    <div className="ddb-text-section">
      <div className="ddb-text-header">
        <div>
          <div className="ddb-text-label">{label}</div>
          <div className="ddb-text-dest">→ Paste into "{dest}" on D&amp;D Beyond</div>
        </div>
        <CopyButton label={label} text={text} />
      </div>
      <textarea
        className="ddb-textarea"
        readOnly
        rows={rows}
        value={text}
        aria-label={`${label} content`}
      />
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function DnDBeyondExportModal({ exportData: e, onClose }: Props) {
  const textSections: Array<{ label: string; dest: string; text: string }> = [
    { label: 'Special Traits',       dest: 'Special Traits Description',  text: e.special_traits_text },
    { label: 'Actions',              dest: 'Actions Description',          text: e.actions_text },
    { label: 'Bonus Actions',        dest: 'Bonus Actions Description',    text: e.bonus_actions_text },
    { label: 'Reactions',            dest: 'Reactions Description',        text: e.reactions_text },
    { label: 'Legendary Actions',    dest: 'Legendary Actions Description',text: e.legendary_actions_text },
    { label: 'Lair Actions',         dest: 'Lair / Lair Actions Description', text: e.lair_actions_text },
    { label: 'Characteristics',      dest: 'Monster Characteristics Description', text: e.characteristics_text },
  ].filter((s) => s.text.trim().length > 0)

  return (
    <div className="ddb-overlay" onClick={onClose}>
      <div className="ddb-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ddb-header">
          <div>
            <h2 className="ddb-title">Export to D&amp;D Beyond</h2>
            <p className="ddb-subtitle">{e.name} · {e.meta_line}</p>
          </div>
          <button type="button" className="ddb-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ddb-body">
          {/* Section 1: Numeric fields */}
          <section>
            <div className="ddb-section-title">Copy these values into the stat block numeric fields</div>
            <div className="ddb-numeric-grid">
              <NumCell label="HP"    value={e.hp} />
              <NumCell label="HP Dice" value={e.hp_dice} />
              <NumCell label="AC"    value={e.ac} />
              <NumCell label="Speed" value={e.speed} />
              <NumCell label="STR"   value={e.str_score} />
              <NumCell label="DEX"   value={e.dex_score} />
              <NumCell label="CON"   value={e.con_score} />
              <NumCell label="INT"   value={e.int_score} />
              <NumCell label="WIS"   value={e.wis_score} />
              <NumCell label="CHA"   value={e.cha_score} />
            </div>
          </section>

          {/* Section 2: Text sections */}
          <section>
            <div className="ddb-section-title">Paste each section into the matching text field</div>
            {textSections.map((s) => (
              <TextSection key={s.label} {...s} />
            ))}
          </section>

          {/* Section 3: Metadata notes */}
          <section>
            <div className="ddb-section-title">Metadata to add after saving</div>
            <p className="ddb-meta-note">
              After creating the monster, add these in the metadata step:<br />
              <strong>Senses:</strong> Passive Perception {10 + Math.floor((e.wis_score - 10) / 2)}, darkvision 60 ft. (if applicable)<br />
              <strong>Languages:</strong> —<br />
              <strong>Skills:</strong> Add based on the monster's role and ability scores
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="ddb-footer">
          <a
            href="https://www.dndbeyond.com/homebrew/creations/create-monster"
            target="_blank"
            rel="noopener noreferrer"
            className="ddb-creator-link"
          >
            Open D&amp;D Beyond Homebrew Creator ↗
          </a>
        </div>
      </div>
    </div>
  )
}
