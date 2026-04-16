'use client'

import { useEffect, useState } from 'react'
import { getWindow24hStatus } from '@/lib/utils/date'

export function useWindow24h(lastIncomingAt: string | null) {
  const [status, setStatus] = useState(() => getWindow24hStatus(lastIncomingAt))

  useEffect(() => {
    setStatus(getWindow24hStatus(lastIncomingAt))

    const interval = setInterval(() => {
      setStatus(getWindow24hStatus(lastIncomingAt))
    }, 30000) // Update every 30s

    return () => clearInterval(interval)
  }, [lastIncomingAt])

  return status
}
