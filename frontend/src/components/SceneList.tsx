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
  music_cue?: string | null
}

interface WikiArticleRef {
  id: string
  title: string
  category: string
}

interface Props {
  scenes: Scene[]
  characters: Character[]
  queryKey: unknown[]
  deleteLabel: string
  onReorder: (ids: string[]) => void
  onUpdate: (id: string, patch: ScenePatch) => void
  onDelete: (id: string) => void
  onSelectSlashItem: (sceneId: string, item: SlashItem, insertLine: () => void) => void
  onEditCheck: (check: Check) => void
  wikiArticles?: WikiArticleRef[]
  onWikiLinkClick?: (articleId: string, title: string) => void
  campaignId?: string
  onAddSceneBelow?: (sceneId: string) => void
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
  campaignId,
  onAddSceneBelow,
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
              campaignId={campaignId}
              onAddSceneBelow={onAddSceneBelow ? () => onAddSceneBelow(scene.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
