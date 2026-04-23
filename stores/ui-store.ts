import { create } from 'zustand'

interface UIStore {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  selectedConversationId: string | null
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleMobileSidebar: () => void
  setMobileSidebarOpen: (v: boolean) => void
  setSelectedConversation: (id: string | null) => void
}

export const useUIStore = create<UIStore>(set => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  selectedConversationId: null,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleMobileSidebar: () => set(s => ({ mobileSidebarOpen: !s.mobileSidebarOpen })),
  setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
  setSelectedConversation: (id) => set({ selectedConversationId: id }),
}))
