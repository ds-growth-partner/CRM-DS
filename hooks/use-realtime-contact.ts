'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { Contact, FunnelStage, Tag } from '@/lib/types/database'

export type ContactFull = Contact & {
  funnel_stage?: FunnelStage | null
  tags?: Tag[]
}

export function useRealtimeContact(contactId: string | null) {
  const { supabase } = useSupabase()
  const [contact, setContact] = useState<ContactFull | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadContact(id: string) {
    const { data } = await supabase
      .from('contacts')
      .select(`
        *,
        funnel_stage:funnel_stages(*),
        contact_tags(tag:tags(*))
      `)
      .eq('id', id)
      .single()

    if (data) {
      const tags = (data.contact_tags as unknown as { tag: Tag }[])?.map(ct => ct.tag) ?? []
      setContact({ ...data, tags, funnel_stage: data.funnel_stage } as ContactFull)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!contactId) {
      setContact(null)
      setLoading(false)
      return
    }

    setLoading(true)
    loadContact(contactId)

    const channel = supabase
      .channel(`contact:${contactId}-${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `id=eq.${contactId}`,
        },
        () => loadContact(contactId)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [contactId, supabase])

  return { contact, loading }
}
