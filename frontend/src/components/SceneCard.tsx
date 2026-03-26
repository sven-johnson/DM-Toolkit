import { useRef, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import type { Character, Check, Scene } from '../types'
import { SceneEditor } from './SceneEditor'
import { CheckWidget } from './CheckWidget'

interface SlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

interface Props {
  scene: Scene
  characters: Character[]
  sessionId: number
  onUpdate: (id: number, patch: { title?: string; body?: string }) => void
  onDelete: (id: number) => void
  onSelectSlashItem: (sceneId: number, item: SlashItem) => void
}

export function SceneCard({
  scene,
  characters,
  sessionId,
  onUpdate,
  onDelete,
  onSelectSlashItem,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(scene.title)

  const titleRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  function commitTitle() {
    setEditingTitle(false)
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== scene.title) {
      onUpdate(scene.id, { title: trimmed })
    } else {
      setTitleDraft(scene.title)
    }
  }

  function handleSaveBody(md: string) {
    if (md !== scene.body) {
      onUpdate(scene.id, { body: md })
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="scene-card">
      <div className="scene-header">
        <span className="drag-handle" {...attributes} {...listeners} title="Drag to reorder">
          ⠿
        </span>

        {editingTitle ? (
          <input
            ref={titleRef}
            className="scene-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') {
                setTitleDraft(scene.title)
                setEditingTitle(false)
              }
            }}
            autoFocus
          />
        ) : (
          <span
            className="scene-title"
            onClick={() => setEditingTitle(true)}
            title="Click to edit title"
          >
            {scene.title}
          </span>
        )}

        <div className="scene-actions">
          <button
            className="btn-icon"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
          <button
            className="btn-icon btn-danger"
            onClick={() => onDelete(scene.id)}
            title="Delete scene"
          >
            ✕
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="scene-body">
          <SceneEditor
            content={scene.body}
            onSave={handleSaveBody}
            onSelectSlashItem={(item) => onSelectSlashItem(scene.id, item)}
          />

          {scene.checks.length > 0 && (
            <div className="scene-checks">
              {scene.checks.map((check: Check) => (
                <CheckWidget
                  key={check.id}
                  check={check}
                  characters={characters}
                  sessionId={sessionId}
                  onDelete={() => {
                    // handled inside widget
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
