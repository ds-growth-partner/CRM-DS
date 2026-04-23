'use client'

import { useUIStore } from '@/stores/ui-store'

export function MobileBackdrop() {
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()
  if (!mobileSidebarOpen) return null
  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
      onClick={() => setMobileSidebarOpen(false)}
    />
  )
}
