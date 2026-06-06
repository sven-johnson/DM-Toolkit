import { useState } from 'react'

export interface InlineEditState {
  editing: boolean
  draft: string
  setDraft: (v: string) => void
  startEdit: () => void
  commit: () => void
  cancel: () => void
}

/**
 * Reusable click-to-edit inline text editing hook.
 *
 * Usage:
 *   const { editing, draft, setDraft, startEdit, commit, cancel } =
 *     useInlineEdit(currentValue, (saved) => handleSave(saved))
 */
export function useInlineEdit(initialValue: string, onSave: (v: string) => void): InlineEditState {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(initialValue)

  function startEdit() {
    setDraft(initialValue)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== initialValue) {
      onSave(trimmed)
    }
  }

  function cancel() {
    setEditing(false)
    setDraft(initialValue)
  }

  return { editing, draft, setDraft, startEdit, commit, cancel }
}
