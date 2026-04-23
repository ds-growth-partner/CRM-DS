'use client'

import { useState } from 'react'
import { ConversationList } from '@/components/conversations/conversation-list'
import { ChatView } from '@/components/conversations/chat-view'
import { ContactPanel } from '@/components/conversations/contact-panel'
import { useRealtimeConversations } from '@/hooks/use-realtime-conversations'
import { MessageSquare } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import type { ConversationFilters } from '@/lib/types/shared'
import { cn } from '@/lib/utils'

type MobilePanel = 'list' | 'chat' | 'contact'

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ConversationFilters>({})
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('list')
  const { conversations, loading } = useRealtimeConversations(filters)

  const selectedConversation = conversations.find(c => c.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(id)
    setMobilePanel('chat')
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Panel 1: Lista de conversaciones ──────────────────────────── */}
      <div className={cn(
        'shrink-0 h-full',
        // Mobile: visible solo cuando mobilePanel === 'list'
        mobilePanel === 'list' ? 'flex' : 'hidden',
        // md+: siempre visible
        'md:flex',
      )}>
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={handleSelect}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* ── Panel 2: Chat ─────────────────────────────────────────────── */}
      <div className={cn(
        'flex-1 min-w-0 overflow-hidden',
        mobilePanel === 'chat' ? 'flex flex-col' : 'hidden',
        'md:flex md:flex-col',
      )}>
        {selectedConversation ? (
          <ChatView
            conversation={selectedConversation}
            onBack={() => setMobilePanel('list')}
            onShowContact={() => setMobilePanel('contact')}
          />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Selecciona una conversación"
            description="Elige una conversación de la lista para ver los mensajes"
            className="h-full"
          />
        )}
      </div>

      {/* ── Panel 3: Contacto ─────────────────────────────────────────── */}
      {selectedConversation && (
        <div className={cn(
          'h-full overflow-hidden',
          mobilePanel === 'contact' ? 'flex w-full' : 'hidden',
          // lg+: siempre visible como columna fija
          'lg:flex lg:w-[270px]',
        )}>
          <ContactPanel
            contactId={selectedConversation.contact_id}
            conversationId={selectedConversation.id}
            onClose={() => setMobilePanel('chat')}
          />
        </div>
      )}

    </div>
  )
}
