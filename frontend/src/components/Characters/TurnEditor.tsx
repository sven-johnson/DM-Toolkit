import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useCombatTurns,
  useCreateCombatTurn,
  useCreateLineItem,
  useDeleteCombatTurn,
  useDeleteLineItem,
  useReorderCombatTurns,
  useReorderLineItems,
  useUpdateCombatTurn,
  useUpdateLineItem,
} from '../../hooks/useCombatStats'
import { useInlineEdit } from '../../hooks/useInlineEdit'
import type {
  CharacterTurnSummary,
  CreateTurnInput,
  TurnLineItemSummary,
  TurnType,
} from '../../types'
import './TurnEditor.css'

// ── Badge ──────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TurnType }) {
  const label = type === 'nova' ? 'Nova' : type === 'sustained' ? 'Sustained' : 'Variant'
  return <span className={`te-badge te-badge--${type}`}>{label}</span>
}

// ── Line item row (handles its own autosave) ───────────────────────────────────

interface LineItemRowProps {
  item: TurnLineItemSummary
  characterId: string
  turnId: number
}

function SortableLineItemRow({ item, characterId, turnId }: LineItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const updateItem = useUpdateLineItem(characterId, turnId)
  const deleteItem = useDeleteLineItem(characterId, turnId)

  const [name, setName]             = useState(item.name)
  const [dice, setDice]             = useState(item.dice_notation ?? '')
  const [avg, setAvg]               = useState(String(item.average_damage))
  const [notes, setNotes]           = useState(item.notes ?? '')
  const [isBonus, setIsBonus]       = useState(item.is_bonus_action)

  function save(patch: Partial<{ name: string; dice_notation: string | null; average_damage: number; is_bonus_action: boolean; notes: string | null }>) {
    updateItem.mutate({
      itemId: item.id,
      name: patch.name ?? name,
      dice_notation: 'dice_notation' in patch ? patch.dice_notation ?? null : dice || null,
      average_damage: 'average_damage' in patch ? (patch.average_damage ?? 0) : (parseFloat(avg) || 0),
      is_bonus_action: patch.is_bonus_action ?? isBonus,
      notes: 'notes' in patch ? patch.notes ?? null : notes || null,
      sort_order: item.sort_order,
    })
  }

  return (
    <div ref={setNodeRef} style={style} className="te-line-item-row">
      <span className="te-li-drag" {...listeners} {...attributes}>⋮⋮</span>

      <input
        className="te-li-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== item.name) save({ name: name.trim() }) }}
        placeholder="Name"
        aria-label="Line item name"
      />

      <input
        className="te-li-input"
        value={dice}
        onChange={(e) => setDice(e.target.value)}
        onBlur={() => { const v = dice || null; if (v !== item.dice_notation) save({ dice_notation: v }) }}
        placeholder="e.g. 5d10"
        aria-label="Dice notation"
      />

      <input
        className="te-li-input"
        type="number"
        step="0.5"
        value={avg}
        onChange={(e) => setAvg(e.target.value)}
        onBlur={() => { const v = parseFloat(avg) || 0; if (v !== item.average_damage) save({ average_damage: v }) }}
        aria-label="Average damage"
      />

      <input
        type="checkbox"
        className="te-li-checkbox"
        checked={isBonus}
        onChange={(e) => { setIsBonus(e.target.checked); save({ is_bonus_action: e.target.checked }) }}
        aria-label="Bonus action"
      />

      <input
        className="te-li-input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => { const v = notes || null; if (v !== item.notes) save({ notes: v }) }}
        placeholder="Context"
        aria-label="Notes"
      />

      <button
        type="button"
        className="te-li-del-btn"
        onClick={() => deleteItem.mutate(item.id)}
        aria-label="Delete line item"
      >
        ✕
      </button>
    </div>
  )
}

// ── Turn card ────────────────────────────────────────────────────────────────

interface TurnCardProps {
  turn: CharacterTurnSummary
  characterId: string
  dragHandleListeners?: Record<string, unknown>
  dragHandleAttributes?: Record<string, unknown>
  onUpdate: (patch: Omit<Parameters<ReturnType<typeof useUpdateCombatTurn>['mutate']>[0], 'turnId'> & { turnId: number }) => void
  onDelete: (turn: CharacterTurnSummary) => void
  onSetPrimary: (turn: CharacterTurnSummary) => void
}

function TurnCard({
  turn,
  characterId,
  dragHandleListeners,
  dragHandleAttributes,
  onUpdate,
  onDelete,
  onSetPrimary,
}: TurnCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [notes, setNotes]       = useState(turn.notes ?? '')

  const createItem  = useCreateLineItem(characterId, turn.id)
  const reorderItems = useReorderLineItems(characterId, turn.id)

  const { editing, draft, setDraft, startEdit, commit, cancel } = useInlineEdit(
    turn.name,
    (newName) => onUpdate({ turnId: turn.id, name: newName, turn_type: turn.turn_type, is_primary: turn.is_primary, notes: turn.notes, sort_order: turn.sort_order }),
  )

  function handleNotesSave() {
    const v = notes || null
    if (v !== turn.notes) {
      onUpdate({ turnId: turn.id, name: turn.name, turn_type: turn.turn_type, is_primary: turn.is_primary, notes: v, sort_order: turn.sort_order })
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const old = turn.line_items
    const oIdx = old.findIndex((li) => li.id === active.id)
    const nIdx = old.findIndex((li) => li.id === over.id)
    const reordered = arrayMove(old, oIdx, nIdx)
    reorderItems.mutate(reordered.map((li, idx) => ({ id: li.id, sort_order: idx })))
  }

  function addLineItem() {
    createItem.mutate({
      name: 'New item',
      average_damage: 0,
      sort_order: turn.line_items.length,
    })
  }

  const borderClass = turn.is_primary
    ? `te-turn-card--primary-${turn.turn_type}`
    : ''

  return (
    <div className={`te-turn-card ${borderClass}`}>
      {/* Header */}
      <div className="te-turn-header" onClick={() => setExpanded((p) => !p)}>
        <span
          className="te-drag-handle"
          {...dragHandleListeners}
          {...dragHandleAttributes}
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </span>

        {editing ? (
          <input
            className="te-turn-name-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="te-turn-name te-turn-name-editable"
            onClick={(e) => { e.stopPropagation(); startEdit() }}
            title="Click to rename"
          >
            {turn.name}
          </span>
        )}

        <TypeBadge type={turn.turn_type} />
        {turn.is_primary && <span className="te-badge te-badge--primary">★ Primary</span>}

        {(turn.turn_type === 'nova' || turn.turn_type === 'sustained') && !turn.is_primary && (
          <button
            type="button"
            className="te-header-btn te-header-btn--accent"
            onClick={(e) => { e.stopPropagation(); onSetPrimary(turn) }}
          >
            Set Primary
          </button>
        )}

        <button
          type="button"
          className="te-header-btn te-header-btn--danger"
          onClick={(e) => { e.stopPropagation(); onDelete(turn) }}
          aria-label="Delete turn"
        >
          🗑
        </button>

        <span className={`te-chevron${expanded ? ' te-chevron--open' : ''}`}>▶</span>
      </div>

      {/* Body */}
      {expanded && (
        <div className="te-turn-body" onClick={(e) => e.stopPropagation()}>
          {/* Notes */}
          <div className="te-notes-label">Notes</div>
          <textarea
            className="te-notes-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder="When does this turn apply?"
          />

          {/* Line items */}
          {turn.line_items.length > 0 && (
            <div className="te-line-items-header">
              <span />
              <span className="te-li-col-label">Name</span>
              <span className="te-li-col-label">Dice</span>
              <span className="te-li-col-label">Avg Dmg</span>
              <span className="te-li-col-label">BA</span>
              <span className="te-li-col-label">Notes</span>
              <span />
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
            <SortableContext
              items={turn.line_items.map((li) => li.id)}
              strategy={verticalListSortingStrategy}
            >
              {turn.line_items.map((item) => (
                <SortableLineItemRow
                  key={item.id}
                  item={item}
                  characterId={characterId}
                  turnId={turn.id}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            type="button"
            className="te-add-li-btn"
            onClick={addLineItem}
            disabled={createItem.isPending}
          >
            + Add line item
          </button>
        </div>
      )}

      {/* Footer */}
      {expanded && (
        <div className="te-turn-footer">
          Total: <strong>{turn.turn_total.toFixed(1)}</strong> avg damage
        </div>
      )}
    </div>
  )
}

// ── Sortable turn card wrapper ─────────────────────────────────────────────────

function SortableTurnCard(props: Omit<TurnCardProps, 'dragHandleListeners' | 'dragHandleAttributes'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.turn.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <TurnCard
        {...props}
        dragHandleListeners={listeners as Record<string, unknown>}
        dragHandleAttributes={attributes as unknown as Record<string, unknown>}
      />
    </div>
  )
}

// ── Add Turn form ──────────────────────────────────────────────────────────────

interface AddTurnFormProps {
  characterId: string
  onDone: () => void
}

function AddTurnForm({ characterId, onDone }: AddTurnFormProps) {
  const createTurn = useCreateCombatTurn(characterId)
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<CreateTurnInput>({
    defaultValues: { name: '', turn_type: 'nova', is_primary: false, notes: null, sort_order: 0 },
  })

  async function onSubmit(values: CreateTurnInput) {
    await createTurn.mutateAsync({ ...values, notes: values.notes || null })
    onDone()
  }

  return (
    <div className="te-add-form">
      <div className="te-add-form-title">Add Turn</div>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
        <div className="te-add-form-grid">
          <div className="te-add-form-field te-add-form-field--full">
            <label className="te-add-form-label">Name *</label>
            <input className="te-add-form-input" {...register('name', { required: true })}
              placeholder="e.g. Nova, Sustained — Spirit Active" />
          </div>
          <div className="te-add-form-field">
            <label className="te-add-form-label">Type</label>
            <select className="te-add-form-select" {...register('turn_type')}>
              <option value="nova">Nova</option>
              <option value="sustained">Sustained</option>
              <option value="variant">Variant</option>
            </select>
          </div>
          <div className="te-add-form-field">
            <div className="te-add-form-check-row" style={{ paddingTop: '1.1rem' }}>
              <input type="checkbox" id="add-is-primary" {...register('is_primary')} />
              <label htmlFor="add-is-primary" className="te-add-form-check-label">Set as primary</label>
            </div>
          </div>
          <div className="te-add-form-field te-add-form-field--full">
            <label className="te-add-form-label">Notes (optional)</label>
            <input className="te-add-form-input" {...register('notes')} placeholder="When does this turn apply?" />
          </div>
        </div>
        <div className="te-add-form-actions" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="te-form-cancel-btn" onClick={onDone}>Cancel</button>
          <button type="submit" className="te-form-save-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Adding…' : 'Add Turn'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main TurnEditor ────────────────────────────────────────────────────────────

interface Props {
  characterId: string
  characterLevel: number
}

export function TurnEditor({ characterId }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: turns = [], isLoading } = useCombatTurns(characterId)
  const updateTurn  = useUpdateCombatTurn(characterId)
  const deleteTurn  = useDeleteCombatTurn(characterId)
  const reorderTurns = useReorderCombatTurns(characterId)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Summary
  const primaryNova      = turns.find((t) => t.turn_type === 'nova'      && t.is_primary)
  const primarySustained = turns.find((t) => t.turn_type === 'sustained' && t.is_primary)

  function handleTurnDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oIdx = turns.findIndex((t) => t.id === active.id)
    const nIdx = turns.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(turns, oIdx, nIdx)
    reorderTurns.mutate(reordered.map((t, idx) => ({ id: t.id, sort_order: idx })))
  }

  function handleUpdate(args: Parameters<typeof updateTurn['mutate']>[0]) {
    updateTurn.mutate(args)
  }

  function handleDelete(turn: CharacterTurnSummary) {
    const label = turn.turn_type === 'nova' ? 'Nova' : turn.turn_type === 'sustained' ? 'Sustained' : 'Variant'
    const msg = turn.is_primary
      ? `This is your primary ${label} turn. Deleting it will clear that value from Monster Factory calculations.\n\nDelete "${turn.name}"?`
      : `Delete "${turn.name}"?`
    if (!window.confirm(msg)) return
    deleteTurn.mutate(turn.id)
  }

  function handleSetPrimary(turn: CharacterTurnSummary) {
    updateTurn.mutate({
      turnId: turn.id,
      name: turn.name,
      turn_type: turn.turn_type,
      is_primary: true,
      notes: turn.notes,
      sort_order: turn.sort_order,
    })
  }

  if (isLoading) return <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading turns…</p>

  return (
    <div className="te-root">
      {/* Summary panel */}
      <div className="te-summary">
        <div className="te-summary-stat">
          <strong>Nova Damage</strong>
          <span>{primaryNova ? primaryNova.turn_total.toFixed(1) : '—'}</span>
        </div>
        <div className="te-summary-stat">
          <strong>Sustained Damage</strong>
          <span>{primarySustained ? primarySustained.turn_total.toFixed(1) : '—'}</span>
        </div>
        <div className="te-summary-hint">
          Set one Nova and one Sustained turn as primary to auto-populate Monster Factory.
        </div>
      </div>

      {/* Empty state */}
      {turns.length === 0 && !showAddForm && (
        <div className="te-empty">
          <div className="te-empty-title">No damage turns set up yet.</div>
          <div className="te-empty-sub">
            Add a Nova turn for burst damage and a Sustained turn for regular combat rounds.
          </div>
        </div>
      )}

      {/* Turn list */}
      {turns.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTurnDragEnd}>
          <SortableContext items={turns.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="te-turn-list">
              {turns.map((turn) => (
                <SortableTurnCard
                  key={turn.id}
                  turn={turn}
                  characterId={characterId}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add form or trigger */}
      {showAddForm ? (
        <AddTurnForm characterId={characterId} onDone={() => setShowAddForm(false)} />
      ) : (
        <button type="button" className="te-add-turn-trigger" onClick={() => setShowAddForm(true)}>
          + Add Turn
        </button>
      )}
    </div>
  )
}
