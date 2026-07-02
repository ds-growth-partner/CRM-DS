'use client'

import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/utils/date'
import { contactName, contactPhone, contactInitials } from '@/lib/utils/contact-fields'
import type { ConversationWithContact } from '@/lib/types/database'
import { Bot, User } from 'lucide-react'

interface ConversationItemProps {
  conversation: ConversationWithContact
  isSelected: boolean
  onClick: () => void
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const contact = conversation.contact
  const fullName = contactName(contact.fields, contact.wa_id)
  const phone = contactPhone(contact.fields, contact.wa_id)
  // Solo mostramos el teléfono aparte cuando el título es un nombre real
  // (si no hay nombre, el título ya es el número → evitamos duplicarlo).
  const showPhone = phone && phone !== fullName
  const tags = (contact as { tags?: { id: string; name: string; color: string }[] }).tags ?? []

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-3 text-left transition-all duration-150 rounded-xl mx-1 my-0.5 border cursor-pointer',
        isSelected
          ? 'conv-selected border-primary/20 bg-primary/10'
          : 'border-transparent hover:bg-accent/60'
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0 mt-0.5">
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold',
          isSelected
            ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
            : 'bg-primary/10 text-primary'
        )}>
          {contactInitials(contact.fields, contact.wa_id)}
        </div>
        {/* AI/Human dot */}
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-1 ring-background',
          conversation.ai_active ? 'bg-emerald-500' : 'bg-blue-500'
        )}>
          {conversation.ai_active
            ? <Bot className="h-2 w-2 text-white" />
            : <User className="h-2 w-2 text-white" />
          }
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className={cn(
            'text-sm font-semibold truncate',
            isSelected ? 'text-foreground' : 'text-foreground/90'
          )}>
            {fullName}
          </span>
          {conversation.last_message_at && (
            <span className={cn(
              'shrink-0 text-[10px] tabular-nums',
              isSelected ? 'text-primary/70' : 'text-muted-foreground'
            )}>
              {formatTime(conversation.last_message_at)}
            </span>
          )}
        </div>

        {showPhone && (
          <p className="text-[11px] text-muted-foreground/70 tabular-nums truncate leading-tight -mt-0.5 mb-0.5">
            {phone}
          </p>
        )}

        <p className="text-xs text-muted-foreground truncate leading-relaxed">
          {conversation.last_message_direction === 'outbound' && (
            <span className="text-primary/70">Tú: </span>
          )}
          {conversation.last_message_preview ?? 'Sin mensajes'}
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {tags.slice(0, 2).map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                style={{
                  backgroundColor: `${tag.color}18`,
                  color: tag.color,
                  border: `1px solid ${tag.color}30`,
                }}
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Unread badge */}
      {conversation.unread_count > 0 && (
        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full unread-badge px-1 text-[10px] font-bold">
          {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
        </span>
      )}
    </button>
  )
}
