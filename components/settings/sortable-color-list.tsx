'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export const PALETTE = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16',
  '#eab308', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
]

export type ColorItem = { id: string; name: string; color: string; position: number }

type Props<T extends ColorItem> = {
  items: T[]
  canEdit: boolean
  onReorder: (orderedIds: string[]) => void
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, color: string) => void
  onDelete: (id: string) => void
  canDelete?: (item: T) => boolean
  renderMeta?: (item: T) => React.ReactNode
}

export function SortableColorList<T extends ColorItem>({
  items, canEdit, onReorder, onRename, onRecolor, onDelete, canDelete, renderMeta,
}: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(items, oldIndex, newIndex).map(i => i.id))
  }

  // Read-only view (viewer role)
  if (!canEdit) {
    return (
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
            <span className="h-5 w-5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="flex-1 text-sm font-medium">{item.name}</span>
            {renderMeta?.(item)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map(item => (
            <SortableRow
              key={item.id}
              item={item}
              onRename={onRename}
              onRecolor={onRecolor}
              onDelete={onDelete}
              deletable={canDelete ? canDelete(item) : true}
              meta={renderMeta?.(item)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow<T extends ColorItem>({
  item, onRename, onRecolor, onDelete, deletable, meta,
}: {
  item: T
  onRename: (id: string, name: string) => void
  onRecolor: (id: string, color: string) => void
  onDelete: (id: string) => void
  deletable: boolean
  meta?: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const [name, setName] = useState(item.name)
  const [showPalette, setShowPalette] = useState(false)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  }

  function commitName() {
    const v = name.trim()
    if (v && v !== item.name) onRename(item.id, v)
    else setName(item.name)
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2.5 border border-border rounded-lg bg-card">
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none shrink-0"
        aria-label="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Color */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setShowPalette(s => !s)}
          className="h-6 w-6 rounded-full border-2 border-white/20 shadow transition-transform hover:scale-110"
          style={{ backgroundColor: item.color }}
          aria-label="Cambiar color"
        />
        {showPalette && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPalette(false)} />
            <div className="absolute left-0 top-8 z-20 p-2 bg-popover border border-border rounded-xl shadow-xl flex items-center gap-1.5 w-max">
              {PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { onRecolor(item.id, c); setShowPalette(false) }}
                  className="h-6 w-6 rounded-full hover:scale-110 transition-transform flex items-center justify-center shrink-0"
                  style={{ backgroundColor: c }}
                >
                  {c.toLowerCase() === item.color?.toLowerCase() && <Check className="h-3 w-3 text-white" />}
                </button>
              ))}
              <label className="h-6 w-6 rounded-full border border-border flex items-center justify-center cursor-pointer overflow-hidden shrink-0 relative">
                <span className="text-[9px] text-muted-foreground">+</span>
                <input
                  type="color"
                  value={item.color || '#6366f1'}
                  onChange={e => onRecolor(item.id, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Name (inline editable) */}
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur() }
          if (e.key === 'Escape') { setName(item.name); (e.target as HTMLInputElement).blur() }
        }}
        className="flex-1 h-8 border-transparent bg-transparent hover:bg-muted/40 focus:border-primary/40 text-sm"
      />

      {meta}

      {deletable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
