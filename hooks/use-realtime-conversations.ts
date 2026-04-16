'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { ConversationWithContact } from '@/lib/types/database'
import type { ConversationFilters } from '@/lib/types/shared'

export function useRealtimeConversations(filters: ConversationFilters = {}) {
  const { supabase } = useSupabase()
  const [conversations, setConversations] = useState<ConversationWithContact[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadConversations = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('conversations')
      .select(`
        *,
        contact:contacts(*),
        assigned_agent:users!conversations_assigned_agent_id_fkey(id, full_name, avatar_url, role)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.ai_active !== undefined) query = query.eq('ai_active', filters.ai_active)
    if (filters.assigned_to) query = query.eq('assigned_agent_id', filters.assigned_to)

    // Búsqueda por nombre/teléfono del contacto — filtramos en cliente
    const { data } = await query.limit(200)
    let result = (data ?? []) as unknown as ConversationWithContact[]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c => {
        const name = `${c.contact.first_name} ${c.contact.last_name ?? ''}`.toLowerCase()
        return name.includes(q) || (c.contact.phone ?? '').includes(q)
      })
    }

    setConversations(result)
    setLoading(false)
  }, [supabase, JSON.stringify(filters)])

  useEffect(() => {
    loadConversations()

    // Limpiar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    // Suscripción realtime: cualquier cambio en conversations o messages dispara recarga
    const channel = supabase
      .channel(`conversations-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => loadConversations()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => loadConversations()
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadConversations])

  return { conversations, loading, refetch: loadConversations }
}
