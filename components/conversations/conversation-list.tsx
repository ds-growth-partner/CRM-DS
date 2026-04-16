'use client'

import { useState } from 'react'
import type { ConversationWithContact } from '@/lib/types/database'
import { ConversationItem } from './conversation-item'
import { Input } from '@/components/ui/input'
import { Search, MessageSquare } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ConversationListProps {
  conversations: ConversationWithContact[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ conversations, loading, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const filtered = conversations.filter(conv => {
    if (!debouncedSearch) return true
    const name = `${conv.contact.first_name} ${conv.contact.last_name ?? ''}`.toLowerCase()
    const preview = (conv.last_message_preview ?? '').toLowerCase()
    const q = debouncedSearch.toLowerCase()
    return name.includes(q) || preview.includes(q)
  })

  return (
    <div className="flex flex-col h-full border-r border-border w-80 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-base font-semibold mb-3">Conversaciones</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Sin conversaciones"
            description={search ? 'No hay resultados para tu búsqueda' : 'Las conversaciones aparecerán aquí cuando lleguen mensajes de WhatsApp'}
          />
        ) : (
          <div>
            {filtered.map(conv => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedId === conv.id}
                onClick={() => onSelect(conv.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
