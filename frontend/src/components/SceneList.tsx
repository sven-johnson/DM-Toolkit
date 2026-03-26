import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SceneCard } from './SceneCard'
import type { Character, Scene } from '../types'

interface SlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

interface Props {
  scenes: Scene[]
  characters: Character[]
  sessionId: number
  onReorder: (ids: number[]) => void
  onUpdate: (id: number, patch: { title?: string; body?: string }) => void
  onDelete: (id: number) => void
  onSelectSlashItem: (sceneId: number, item: SlashItem) => void
}

export function SceneList({
  scenes,
  characters,
  sessionId,
  onReorder,
  onUpdate,
  onDelete,
  onSelectSlashItem,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = scenes.findIndex((s) => s.id === active.id)
    const newIndex = scenes.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(scenes, oldIndex, newIndex)
    onReorder(reordered.map((s) => s.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={scenes.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="scene-list">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              characters={characters}
              sessionId={sessionId}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onSelectSlashItem={onSelectSlashItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
