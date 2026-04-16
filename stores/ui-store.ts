import { create } from 'zustand'

interface UIStore {
  sidebarCollapsed: boolean
  selectedConversationId: string | null
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  setSelectedConversation: (id: string | null) => void
}

export const useUIStore = create<UIStore>(set => ({
  sidebarCollapsed: false,
  selectedConversationId: null,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSelectedConversation: (id) => set({ selectedConversationId: id }),
}))
