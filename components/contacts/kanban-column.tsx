'use client'

import { useDroppable } from '@dnd-kit/core'
import type { ContactWithDetails, FunnelStage } from '@/lib/types/database'
import { KanbanCard } from './kanban-card'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

type ContactWithTags = ContactWithDetails & { tags?: { id: string; name: string; color: string }[] }

interface KanbanColumnProps {
  stage: FunnelStage
  contacts: ContactWithTags[]
  /** The card currently being dragged (global) */
  activeContact?: ContactWithTags | null
  /** Whether the drag pointer is currently over this column */
  isOver?: boolean
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
}

export function KanbanColumn({ stage, contacts, activeContact, isOver, selectedIds, onToggle }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage.id })

  // Is the dragged card currently FROM this column?
  const activeIsFromHere = activeContact && contacts.some(c => c.id === activeContact.id)
  // Should we render a ghost at the bottom of this column?
  const showGhost = isOver && activeContact && !activeIsFromHere

  // Display count: include ghost, exclude the invisible placeholder
  const displayCount = contacts.length + (showGhost ? 1 : 0)

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl transition-colors duration-200"
        style={{
          backgroundColor: isOver ? `${stage.color}22` : `${stage.color}14`,
          borderBottom: `2px solid ${isOver ? stage.color : `${stage.color}80`}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn('h-2.5 w-2.5 rounded-full transition-transform duration-200', isOver && 'scale-110')}
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-sm font-semibold text-foreground">{stage.name}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
          {displayCount}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[200px] rounded-b-xl border-x border-b transition-all duration-200',
          isOver
            ? 'bg-primary/[0.04] border-primary/20'
            : 'bg-muted/30 border-border',
        )}
      >
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="p-2 space-y-2">
            {contacts.map(contact => (
              <KanbanCard
                key={contact.id}
                contact={contact}
                isSelected={selectedIds?.has(contact.id)}
                onToggle={onToggle}
              />
            ))}

            {/* Ghost card: preview of the dragged card in this destination column */}
            {showGhost && (
              <KanbanCard contact={activeContact} isGhost />
            )}

            {/* Empty state */}
            {contacts.length === 0 && !showGhost && (
              <div
                className={cn(
                  'text-center py-10 text-xs transition-colors duration-200',
                  isOver ? 'text-primary/70' : 'text-muted-foreground/50',
                )}
              >
                {isOver ? 'Soltar aquí' : 'Sin contactos'}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
