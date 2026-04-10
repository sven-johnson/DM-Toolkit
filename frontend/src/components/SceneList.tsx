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
import type { Character, Check, Scene } from '../types'

interface SlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

interface ScenePatch {
  title?: string
  body?: string
  dm_notes?: string | null
  scene_type?: string
  puzzle_clues?: string | null
  puzzle_solution?: string | null
}

interface WikiArticleRef {
  id: number
  title: string
  category: string
}

interface Props {
  scenes: Scene[]
  characters: Character[]
  queryKey: unknown[]
  deleteLabel: string
  onReorder: (ids: number[]) => void
  onUpdate: (id: number, patch: ScenePatch) => void
  onDelete: (id: number) => void
  onSelectSlashItem: (sceneId: number, item: SlashItem, insertLine: () => void) => void
  onEditCheck: (check: Check) => void
  wikiArticles?: WikiArticleRef[]
  onWikiLinkClick?: (articleId: number, title: string) => void
}

export function SceneList({
  scenes,
  characters,
  queryKey,
  deleteLabel,
  onReorder,
  onUpdate,
  onDelete,
  onSelectSlashItem,
  onEditCheck,
  wikiArticles,
  onWikiLinkClick,
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
              queryKey={queryKey}
              deleteLabel={deleteLabel}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onSelectSlashItem={onSelectSlashItem}
              onEditCheck={onEditCheck}
              wikiArticles={wikiArticles}
              onWikiLinkClick={onWikiLinkClick}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
