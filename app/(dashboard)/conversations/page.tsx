'use client'

import { useState } from 'react'
import { ConversationList } from '@/components/conversations/conversation-list'
import { ChatView } from '@/components/conversations/chat-view'
import { ContactPanel } from '@/components/conversations/contact-panel'
import { useRealtimeConversations } from '@/hooks/use-realtime-conversations'
import { MessageSquare } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export default function ConversationsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { conversations, loading } = useRealtimeConversations()

  const selectedConversation = conversations.find(c => c.id === selectedId) ?? null

  return (
    <div className="flex h-full">
      {/* Conversation List — recibe conversations del hook compartido */}
      <ConversationList
        conversations={conversations}
        loading={loading}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Chat Area */}
      <div className="flex-1 min-w-0">
        {selectedConversation ? (
          <ChatView conversation={selectedConversation} />
        ) : (
          <EmptyState
            icon={MessageSquare}
            title="Selecciona una conversación"
            description="Elige una conversación de la lista para ver los mensajes"
            className="h-full"
          />
        )}
      </div>

      {/* Contact Panel */}
      {selectedConversation && (
        <ContactPanel
          contactId={selectedConversation.contact_id}
          conversationId={selectedConversation.id}
        />
      )}
    </div>
  )
}
