'use client'

import { cn } from '@/lib/utils'
import { timeAgo, formatTime } from '@/lib/utils/date'
import { getInitials } from '@/lib/utils/format'
import type { ConversationWithContact } from '@/lib/types/database'
import { Bot, User } from 'lucide-react'

interface ConversationItemProps {
  conversation: ConversationWithContact
  isSelected: boolean
  onClick: () => void
}

export function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const contact = conversation.contact
  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
          {getInitials(fullName)}
        </div>
        {/* AI/Human indicator */}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white',
            conversation.ai_active ? 'bg-emerald-500' : 'bg-blue-500'
          )}
        >
          {conversation.ai_active
            ? <Bot className="h-2.5 w-2.5" />
            : <User className="h-2.5 w-2.5" />
          }
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-semibold text-foreground truncate">{fullName}</span>
          {conversation.last_message_at && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTime(conversation.last_message_at)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {conversation.last_message_direction === 'outbound' && <span className="text-primary">Tú: </span>}
          {conversation.last_message_preview ?? 'Sin mensajes'}
        </p>
      </div>

      {/* Unread badge */}
      {conversation.unread_count > 0 && (
        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
          {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
        </span>
      )}
    </button>
  )
}
