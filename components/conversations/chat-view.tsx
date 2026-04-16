'use client'

import { useEffect, useRef, useState } from 'react'
import { useRealtimeMessages } from '@/hooks/use-realtime-messages'
import { MessageBubble } from './message-bubble'
import { Composer } from './composer'
import { WindowIndicator } from './window-indicator'
import { TakeControlButton } from './take-control-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConversationWithContact } from '@/lib/types/database'
import { formatDate } from '@/lib/utils/date'
import { Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatViewProps {
  conversation: ConversationWithContact
}

export function ChatView({ conversation }: ChatViewProps) {
  const contact = conversation.contact
  const { messages, loading, addOptimisticMessage } = useRealtimeMessages(conversation.id)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [aiActive, setAiActive] = useState(conversation.ai_active)

  // Sync when switching conversations
  useEffect(() => {
    setAiActive(conversation.ai_active)
  }, [conversation.id, conversation.ai_active])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Group messages by date
  const grouped: { date: string; messages: typeof messages }[] = []
  let currentDate = ''
  for (const msg of messages) {
    const d = formatDate(msg.created_at)
    if (d !== currentDate) {
      currentDate = d
      grouped.push({ date: d, messages: [msg] })
    } else {
      grouped[grouped.length - 1].messages.push(msg)
    }
  }

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground">{contact.phone}</p>
          </div>
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              aiActive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            )}
          >
            {aiActive ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {aiActive ? 'IA Activa' : 'Agente Humano'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <WindowIndicator lastIncomingAt={contact.last_incoming_at} />
          <TakeControlButton
            conversationId={conversation.id}
            contactId={contact.id}
            aiActive={aiActive}
            chatwootConversationId={conversation.chatwoot_conversation_id}
            onToggle={(newAiActive) => setAiActive(newAiActive)}
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4">
        {loading ? (
          <div className="px-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {grouped.map(({ date, messages: dayMsgs }) => (
              <div key={date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {date}
                  </span>
                </div>
                {dayMsgs.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </ScrollArea>

      {/* Composer */}
      <Composer
        conversationId={conversation.id}
        contactId={contact.id}
        waId={contact.wa_id ?? contact.phone?.replace(/\D/g, '') ?? ''}
        chatwootConversationId={conversation.chatwoot_conversation_id}
        lastIncomingAt={contact.last_incoming_at}
        onOptimisticMessage={(content) => addOptimisticMessage({
          content,
          conversation_id: conversation.id,
          contact_id: contact.id,
        })}
      />
    </div>
  )
}

