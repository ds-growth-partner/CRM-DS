'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { CannedResponse } from '@/lib/types/database'

export function useCannedResponses() {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const [responses, setResponses] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tenant) return
    const { data } = await supabase
      .from('canned_responses')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('shortcut')
    setResponses(data ?? [])
    setLoading(false)
  }, [supabase, tenant])

  useEffect(() => { load() }, [load])

  /** Filtra por shortcut o título, útil para el autocompletado con "/" */
  function search(query: string): CannedResponse[] {
    if (!query) return responses
    const q = query.toLowerCase().replace(/^\//, '')
    return responses.filter(r =>
      r.shortcut.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q)
    )
  }

  return { responses, loading, search, refetch: load }
}
