'use client'

import { useWindow24h } from '@/hooks/use-window-24h'
import { cn } from '@/lib/utils'
import { AlertTriangle, XCircle } from 'lucide-react'

interface WindowIndicatorProps {
  lastIncomingAt: string | null
}

export function WindowIndicator({ lastIncomingAt }: WindowIndicatorProps) {
  const { isOpen, hoursLeft, isWarning } = useWindow24h(lastIncomingAt)

  if (isOpen && !isWarning && hoursLeft !== null && hoursLeft > 12) return null

  if (!isOpen) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 text-destructive border border-destructive/20 text-[11px] font-medium rounded-lg">
        <XCircle className="h-3 w-3 shrink-0" />
        <span>Ventana expirada</span>
      </div>
    )
  }

  if (isWarning && hoursLeft !== null) {
    const mins = Math.floor((hoursLeft % 1) * 60)
    const hrs = Math.floor(hoursLeft)
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium rounded-lg">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>{hrs}h {mins}m restantes</span>
      </div>
    )
  }

  return null
}
