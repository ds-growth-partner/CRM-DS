'use client'

import { useWindow24h } from '@/hooks/use-window-24h'
import { cn } from '@/lib/utils'
import { Clock, AlertTriangle, XCircle } from 'lucide-react'

interface WindowIndicatorProps {
  lastIncomingAt: string | null
}

export function WindowIndicator({ lastIncomingAt }: WindowIndicatorProps) {
  const { isOpen, hoursLeft, isWarning } = useWindow24h(lastIncomingAt)

  if (isOpen && !isWarning && hoursLeft !== null && hoursLeft > 12) return null

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 text-xs rounded-md">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Ventana 24h expirada — Solo plantillas HSM</span>
      </div>
    )
  }

  if (isWarning && hoursLeft !== null) {
    const mins = Math.floor((hoursLeft % 1) * 60)
    const hrs = Math.floor(hoursLeft)
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 text-xs rounded-md">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Ventana cierra en {hrs}h {mins}m</span>
      </div>
    )
  }

  return null
}
