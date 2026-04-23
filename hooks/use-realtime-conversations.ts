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

    // Incluye funnel_stage y contact_tags del contacto para poder filtrar
    let query = supabase
      .from('conversations')
      .select(`
        *,
        contact:contacts(
          *,
          funnel_stage:funnel_stages(*),
          contact_tags(tag:tags(*))
        ),
        assigned_agent:users!conversations_assigned_agent_id_fkey(id, full_name, avatar_url, role)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.ai_active !== undefined) query = query.eq('ai_active', filters.ai_active)
    if (filters.assigned_to) query = query.eq('assigned_agent_id', filters.assigned_to)

    const { data } = await query.limit(200)
    let result = (data ?? []).map(conv => ({
      ...conv,
      contact: {
        ...conv.contact,
        funnel_stage: (conv.contact as any).funnel_stage ?? null,
        tags: ((conv.contact as any).contact_tags as { tag: unknown }[] ?? []).map(ct => ct.tag),
      },
    })) as unknown as ConversationWithContact[]

    // Filtros en cliente (evita joins complejos en PostgREST)
    if (filters.funnel_stage_id) {
      result = result.filter(c => c.contact.funnel_stage?.id === filters.funnel_stage_id)
    }

    if (filters.tag_id) {
      result = result.filter(c =>
        (c.contact.tags ?? []).some((t: any) => t.id === filters.tag_id)
      )
    }

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c => {
        const name = `${c.contact.first_name} ${c.contact.last_name ?? ''}`.toLowerCase()
        const phone = (c.contact.phone ?? '').toLowerCase()
        const email = (c.contact.email ?? '').toLowerCase()
        const preview = (c.last_message_preview ?? '').toLowerCase()
        return name.includes(q) || phone.includes(q) || email.includes(q) || preview.includes(q)
      })
    }

    setConversations(result)
    setLoading(false)
  }, [supabase, JSON.stringify(filters)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadConversations()

    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const channel = supabase
      .channel(`conversations-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_tags' }, () => loadConversations())
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [loadConversations])

  return { conversations, loading, refetch: loadConversations }
}
