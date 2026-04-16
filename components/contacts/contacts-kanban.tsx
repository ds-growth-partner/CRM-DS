'use client'

import { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, closestCenter } from '@dnd-kit/core'
import type { ContactWithDetails, FunnelStage } from '@/lib/types/database'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import { toast } from 'sonner'

interface ContactsKanbanProps {
  contacts: (ContactWithDetails & { tags?: { id: string; name: string; color: string }[] })[]
  stages: FunnelStage[]
  onStageChange?: (contactId: string, newStageId: string) => void
}

export function ContactsKanban({ contacts, stages, onStageChange }: ContactsKanbanProps) {
  const [localContacts, setLocalContacts] = useState(contacts)
  const [dragging, setDragging] = useState<(typeof contacts)[0] | null>(null)

  // Sync with parent
  if (contacts !== localContacts && !dragging) {
    setLocalContacts(contacts)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragging(null)

    if (!over || active.id === over.id) return

    const contactId = active.id as string
    const newStageId = over.id as string
    const contact = localContacts.find(c => c.id === contactId)
    if (!contact || contact.funnel_stage_id === newStageId) return

    const prevStage = stages.find(s => s.id === contact.funnel_stage_id)
    const newStage = stages.find(s => s.id === newStageId)

    // Optimistic update
    setLocalContacts(prev =>
      prev.map(c => c.id === contactId ? { ...c, funnel_stage_id: newStageId } : c)
    )

    try {
      const res = await fetch('/api/webhooks/n8n/move-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          previous_stage_id: contact.funnel_stage_id,
          new_stage_id: newStageId,
          previous_stage_name: prevStage?.name,
          new_stage_name: newStage?.name,
          reason: 'manual',
        }),
      })

      if (!res.ok) throw new Error()
      onStageChange?.(contactId, newStageId)
      toast.success(`Movido a ${newStage?.name}`)
    } catch {
      // Rollback
      setLocalContacts(prev =>
        prev.map(c => c.id === contactId ? { ...c, funnel_stage_id: contact.funnel_stage_id } : c)
      )
      toast.error('Error al mover contacto')
    }
  }

  const sortedStages = [...stages].sort((a, b) => a.position - b.position)

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragStart={e => {
      setDragging(localContacts.find(c => c.id === e.active.id) ?? null)
    }}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {sortedStages.map(stage => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            contacts={localContacts.filter(c => c.funnel_stage_id === stage.id)}
          />
        ))}
        {/* No stage column */}
        <KanbanColumn
          key="no-stage"
          stage={{ id: 'no-stage', name: 'Sin etapa', color: '#94a3b8', slug: '', position: 999, tenant_id: '', is_won: false, is_lost: false, is_default: false, created_at: '' }}
          contacts={localContacts.filter(c => !c.funnel_stage_id)}
        />
      </div>

      <DragOverlay>
        {dragging && <KanbanCard contact={dragging} />}
      </DragOverlay>
    </DndContext>
  )
}
