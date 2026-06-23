'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { Service } from '@/lib/types/database'

/**
 * Loads the tenant's service catalog ordered by position.
 * `activeOnly` is handy for pickers (e.g. when registering a sale).
 */
export function useServices(opts: { activeOnly?: boolean } = {}) {
  const { activeOnly = false } = opts
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tenant) return
    let q = supabase.from('services').select('*').eq('tenant_id', tenant.id)
    if (activeOnly) q = q.eq('is_active', true)
    const { data } = await q.order('position').order('created_at')
    setServices(data ?? [])
    setLoading(false)
  }, [supabase, tenant, activeOnly])

  useEffect(() => { load() }, [load])

  return { services, loading, refetch: load }
}
