'use client'

import { useDraggable } from '@dnd-kit/core'
import type { ContactWithDetails } from '@/lib/types/database'
import { TagBadge } from '@/components/shared/tag-badge'
import { LeadScoreBar } from '@/components/shared/lead-score-bar'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Building2, Phone } from 'lucide-react'

interface KanbanCardProps {
  contact: ContactWithDetails & { tags?: { id: string; name: string; color: string }[] }
  /** Rendered inside DragOverlay — elevated, rotated, no drag events needed */
  isOverlay?: boolean
  /** Ghost preview in destination column while dragging */
  isGhost?: boolean
}

export function KanbanCard({ contact, isOverlay, isGhost }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
    data: { contact },
    disabled: isOverlay || isGhost,
  })

  const style = transform && !isOverlay && !isGhost
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  const tags = contact.tags ?? []

  // Original card while being dragged: keep space but become invisible
  // so the DragOverlay is the only visible version
  if (isDragging && !isOverlay && !isGhost) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.04] min-h-[72px] transition-all"
        aria-hidden
      />
    )
  }

  return (
    <div
      ref={isOverlay || isGhost ? undefined : setNodeRef}
      style={style}
      {...(isOverlay || isGhost ? {} : { ...attributes, ...listeners })}
      className={cn(
        'rounded-xl border p-3 select-none transition-all duration-150',
        // Normal state
        !isOverlay && !isGhost && [
          'bg-card border-border',
          'cursor-grab active:cursor-grabbing',
          'shadow-sm hover:shadow-md hover:border-border/80 hover:bg-card',
        ],
        // DragOverlay: elevated card following cursor
        isOverlay && [
          'bg-card border-primary/40',
          'shadow-2xl shadow-black/20',
          'rotate-[1.5deg] scale-[1.03]',
          'cursor-grabbing',
        ],
        // Ghost in destination column
        isGhost && [
          'bg-primary/[0.06] border-primary/20 border-dashed',
          'opacity-50 pointer-events-none',
        ],
      )}
    >
      <Link
        href={`/contacts/${contact.id}`}
        onClick={e => e.stopPropagation()}
        className="block"
        tabIndex={isOverlay || isGhost ? -1 : undefined}
      >
        <p className="text-sm font-medium text-foreground mb-1 hover:text-primary transition-colors">
          {fullName}
        </p>
      </Link>

      {contact.company && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{contact.company}</span>
        </div>
      )}

      {contact.phone && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Phone className="h-3 w-3 shrink-0" />
          {contact.phone}
        </div>
      )}

      <LeadScoreBar score={contact.lead_score} className="mb-2" />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map(tag => <TagBadge key={tag.id} tag={tag} />)}
          {tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
