import { useState } from 'react'

interface Props {
  value: string
  onSave: (val: string) => void
}

export function DmNotesEditor({ value, onSave }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="dm-notes">
      <button
        className="dm-notes-toggle"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        DM Notes {open ? '▲' : '▼'}
      </button>
      {open && (
        <textarea
          className="dm-notes-input"
          defaultValue={value}
          placeholder="Private DM notes…"
          rows={3}
          onBlur={(e) => {
            const val = e.target.value
            if (val !== value) onSave(val)
          }}
        />
      )}
    </div>
  )
}
