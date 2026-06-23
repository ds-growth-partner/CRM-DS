'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'
import type { DealWithService } from '@/lib/types/database'

/**
 * Loads (and live-updates) the sales/orders ("negocios") for a contact — its
 * purchase history. Realtime is filtered by contact_id (RLS-protected tables only
 * deliver events when the subscription has a filter).
 */
export function useDeals(contactId: string | null | undefined) {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const tenantId = tenant?.id
  const [deals, setDeals] = useState<DealWithService[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const load = useCallback(async () => {
    if (!contactId) { setDeals([]); setLoading(false); return }
    const { data } = await supabase
      .from('deals')
      .select('*, service:services(*)')
      .eq('contact_id', contactId)
      .order('sold_at', { ascending: false })
    setDeals((data as DealWithService[]) ?? [])
    setLoading(false)
  }, [supabase, contactId])

  useEffect(() => {
    load()
    if (!contactId) return

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase
      .channel(`deals:${contactId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals', filter: `contact_id=eq.${contactId}` },
        () => load(),
      )
      .subscribe()
    channelRef.current = channel

    return () => { supabase.removeChannel(channel) }
  }, [contactId, supabase, load])

  return { deals, loading, refetch: load, tenantId }
}
