import { create } from 'zustand'
import type { ConversationFilters } from '@/lib/types/shared'

interface ConversationStore {
  filters: ConversationFilters
  setFilters: (f: Partial<ConversationFilters>) => void
  clearFilters: () => void
}

export const useConversationStore = create<ConversationStore>(set => ({
  filters: {},
  setFilters: (f) => set(s => ({ filters: { ...s.filters, ...f } })),
  clearFilters: () => set({ filters: {} }),
}))
