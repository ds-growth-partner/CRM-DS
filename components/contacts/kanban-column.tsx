'use client'

import { useDroppable } from '@dnd-kit/core'
import type { ContactWithDetails, FunnelStage } from '@/lib/types/database'
import { KanbanCard } from './kanban-card'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface KanbanColumnProps {
  stage: FunnelStage
  contacts: (ContactWithDetails & { tags?: { id: string; name: string; color: string }[] })[]
}

export function KanbanColumn({ stage, contacts }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-lg"
        style={{ backgroundColor: `${stage.color}15`, borderBottom: `2px solid ${stage.color}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-sm font-semibold text-foreground">{stage.name}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{contacts.length}</span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[200px] rounded-b-lg border-x border-b border-border bg-muted/30 transition-colors',
          isOver && 'bg-primary/5 border-primary/30'
        )}
      >
        <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
          <div className="p-2 space-y-2">
            {contacts.map(contact => (
              <KanbanCard key={contact.id} contact={contact} />
            ))}
            {contacts.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Sin contactos
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
