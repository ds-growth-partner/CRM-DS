'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { ContactWithDetails } from '@/lib/types/database'
import type { ContactFilters } from '@/lib/types/shared'

export function useContacts(filters: ContactFilters = {}) {
  const { supabase } = useSupabase()
  const [contacts, setContacts] = useState<ContactWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadContacts = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('contacts')
      .select(`
        *,
        funnel_stage:funnel_stages(*),
        assigned_user:users!contacts_assigned_to_fkey(id, full_name, avatar_url),
        contact_tags(tag:tags(*))
      `, { count: 'exact' })
      .order('updated_at', { ascending: false })

    if (filters.funnel_stage_id) query = query.eq('funnel_stage_id', filters.funnel_stage_id)
    if (filters.source) query = query.eq('source', filters.source)
    if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
    if (filters.ai_active !== undefined) query = query.eq('ai_active', filters.ai_active)
    if (filters.lead_score_min !== undefined) query = query.gte('lead_score', filters.lead_score_min)
    if (filters.lead_score_max !== undefined) query = query.lte('lead_score', filters.lead_score_max)
    if (filters.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
      )
    }

    const { data, count, error } = await query.limit(500)

    if (error) {
      console.error('Error fetching contacts:', error)
    }

    const mapped = (data ?? []).map(c => ({
      ...c,
      tags: (c.contact_tags as unknown as { tag: typeof c }[])?.map(ct => ct.tag) ?? [],
    }))

    setContacts(mapped as unknown as ContactWithDetails[])
    setTotal(count ?? 0)
    setLoading(false)
  }, [supabase, JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadContacts()

    // Limpiar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    // Realtime: recarga la lista cuando cambia cualquier contacto o sus etiquetas
    const channel = supabase
      .channel(`contacts-list-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => loadContacts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_tags' },
        () => loadContacts()
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadContacts])

  return { contacts, loading, total, refetch: loadContacts }
}
