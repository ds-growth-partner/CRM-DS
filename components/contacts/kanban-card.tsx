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
}

export function KanbanCard({ contact }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
    data: { contact },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()
  const tags = contact.tags ?? []

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <Link
        href={`/contacts/${contact.id}`}
        onClick={e => e.stopPropagation()}
        className="block"
      >
        <p className="text-sm font-medium text-foreground mb-1 hover:text-primary transition-colors">{fullName}</p>
      </Link>
      {contact.company && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Building2 className="h-3 w-3" />
          {contact.company}
        </div>
      )}
      {contact.phone && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Phone className="h-3 w-3" />
          {contact.phone}
        </div>
      )}
      <LeadScoreBar score={contact.lead_score} className="mb-2" />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map(tag => <TagBadge key={tag.id} tag={tag} />)}
          {tags.length > 3 && <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>}
        </div>
      )}
    </div>
  )
}
