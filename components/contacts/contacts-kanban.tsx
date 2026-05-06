'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { ContactWithDetails, FunnelStage } from '@/lib/types/database'
import { KanbanColumn } from './kanban-column'
import { KanbanCard } from './kanban-card'
import { toast } from 'sonner'
import { useSupabase } from '@/providers/supabase-provider'

type ContactWithTags = ContactWithDetails & { tags?: { id: string; name: string; color: string }[] }

interface ContactsKanbanProps {
  contacts: ContactWithTags[]
  stages: FunnelStage[]
  onStageChange?: (contactId: string, newStageId: string) => void
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
}

const NO_STAGE_ID = 'no-stage'

const NO_STAGE: FunnelStage = {
  id: NO_STAGE_ID,
  name: 'Sin etapa',
  color: '#94a3b8',
  slug: '',
  position: 999,
  tenant_id: '',
  is_won: false,
  is_lost: false,
  is_default: false,
  created_at: '',
}

export function ContactsKanban({ contacts, stages, onStageChange, selectedIds, onToggle }: ContactsKanbanProps) {
  const { supabase } = useSupabase()
  const [localContacts, setLocalContacts] = useState(contacts)
  const [activeContact, setActiveContact] = useState<ContactWithTags | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const isDraggingRef = useRef(false)

  // Sync parent data → local state only when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalContacts(contacts)
    }
  }, [contacts])

  // Require 8px of movement before drag starts (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true
    setActiveContact(localContacts.find(c => c.id === event.active.id) ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumnId((event.over?.id as string) ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    isDraggingRef.current = false
    setActiveContact(null)
    setOverColumnId(null)

    if (!over) return

    const contactId = active.id as string
    const newStageId = over.id as string
    const contact = localContacts.find(c => c.id === contactId)
    if (!contact) return

    const currentColumnId = contact.funnel_stage_id ?? NO_STAGE_ID
    if (currentColumnId === newStageId) return

    const newStage = newStageId === NO_STAGE_ID
      ? NO_STAGE
      : stages.find(s => s.id === newStageId)

    const newFunnelStageId = newStageId === NO_STAGE_ID ? null : newStageId

    // Optimistic update — instant UI
    setLocalContacts(prev =>
      prev.map(c => c.id === contactId ? { ...c, funnel_stage_id: newFunnelStageId } : c)
    )

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ funnel_stage_id: newFunnelStageId, updated_at: new Date().toISOString() })
        .eq('id', contactId)

      if (error) throw error
      onStageChange?.(contactId, newStageId)
      toast.success(`Movido a ${newStage?.name ?? 'Sin etapa'}`)
    } catch {
      // Rollback on error
      setLocalContacts(prev =>
        prev.map(c => c.id === contactId ? { ...c, funnel_stage_id: contact.funnel_stage_id } : c)
      )
      toast.error('Error al mover contacto')
    }
  }

  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const allColumns = [...sortedStages, NO_STAGE]

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {allColumns.map(stage => {
          const columnContacts = localContacts.filter(c =>
            stage.id === NO_STAGE_ID ? !c.funnel_stage_id : c.funnel_stage_id === stage.id
          )
          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              contacts={columnContacts}
              activeContact={activeContact}
              isOver={overColumnId === stage.id}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          )
        })}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 180,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeContact ? <KanbanCard contact={activeContact} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
