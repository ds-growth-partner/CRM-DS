'use client'

import { useState } from 'react'
import type { ConversationWithContact } from '@/lib/types/database'
import type { ConversationFilters } from '@/lib/types/shared'
import { ConversationItem } from './conversation-item'
import { FilterPanel } from './filter-panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, SlidersHorizontal, MessageSquare } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ConversationListProps {
  conversations: ConversationWithContact[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  filters: ConversationFilters
  onFiltersChange: (f: ConversationFilters) => void
}

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
}: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const debouncedSearch = useDebounce(search, 250)

  const activeFilterCount = Object.values(filters).filter(
    v => v !== undefined && v !== '' && v !== null
  ).length

  const filtered = conversations.filter(conv => {
    if (!debouncedSearch) return true
    const q = debouncedSearch.toLowerCase()
    const name = `${conv.contact.first_name} ${conv.contact.last_name ?? ''}`.toLowerCase()
    const phone = (conv.contact.phone ?? '').replace(/\D/g, '')
    const email = (conv.contact.email ?? '').toLowerCase()
    const preview = (conv.last_message_preview ?? '').toLowerCase()
    return (
      name.includes(q) ||
      phone.includes(q.replace(/\D/g, '')) ||
      email.includes(q) ||
      preview.includes(q)
    )
  })

  return (
    <div className="flex flex-col h-full border-r border-border w-full md:w-[300px] shrink-0 bg-sidebar">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Conversaciones</h2>
            {!loading && filtered.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {filtered.length} conversación{filtered.length !== 1 ? 'es' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeFilterCount > 0 && (
              <span className="text-[10px] text-primary font-medium bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md">
                {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 rounded-lg transition-colors cursor-pointer',
                activeFilterCount > 0
                  ? 'text-primary bg-primary/10 hover:bg-primary/15'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Nombre, teléfono, correo..."
            className="pl-8 h-8 text-xs bg-muted/40 border-transparent focus:border-primary/40 transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onChange={onFiltersChange}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="px-3 pt-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-center px-2 py-2">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Sin conversaciones"
            description={
              search || activeFilterCount > 0
                ? 'No hay resultados con los filtros aplicados'
                : 'Las conversaciones aparecerán aquí cuando lleguen mensajes'
            }
          />
        ) : (
          <div className="py-1 px-1">
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
