import { useEffect, useRef, useState } from 'react'

interface Props {
  value: string
  onSave: (val: string) => void
}

export function DmNotesEditor({ value, onSave }: Props) {
  const [open, setOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    if (open && textareaRef.current) {
      autoResize(textareaRef.current)
    }
  }, [open, value])

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
          ref={textareaRef}
          className="dm-notes-input"
          defaultValue={value}
          placeholder="Private DM notes…"
          rows={1}
          onInput={(e) => autoResize(e.currentTarget)}
          onBlur={(e) => {
            const val = e.target.value
            if (val !== value) onSave(val)
          }}
        />
      )}
    </div>
  )
}
