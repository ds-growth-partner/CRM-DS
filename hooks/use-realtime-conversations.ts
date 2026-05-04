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

    // Load all conversations with their contacts, ordered by last_message_at
    const { data: convs, error } = await supabase
      .from('conversations')
      .select(`
        *,
        assigned_agent:users!conversations_assigned_agent_id_fkey(id, full_name, avatar_url, role),
        contact:contacts!inner(
          *,
          funnel_stage:funnel_stages(*),
          contact_tags(tag:tags(*))
        )
      `)
      .order('last_message_at', { ascending: false })

    if (error || !convs?.length) {
      setConversations([])
      setLoading(false)
      return
    }

    let result: ConversationWithContact[] = convs.map(c => {
      // Map contact.contact_tags to just tags for frontend ease
      const contact = {
        ...(c.contact as any),
        tags: (c.contact as any).contact_tags?.map((ct: any) => ct.tag) ?? [],
      }
      
      return {
        ...c,
        contact
      } as ConversationWithContact
    })

    // Apply frontend filters
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(c => {
        const name = `${c.contact.first_name} ${c.contact.last_name ?? ''}`.toLowerCase()
        return name.includes(q) || (c.contact.phone ?? '').includes(q)
      })
    }

    if (filters.status) {
      result = result.filter(c => c.status === filters.status)
    }

    if (filters.assigned_to) {
      if (filters.assigned_to === 'unassigned') {
        result = result.filter(c => !c.assigned_agent_id)
      } else {
        result = result.filter(c => c.assigned_agent_id === filters.assigned_to)
      }
    }

    if (filters.funnel_stage_id) {
      result = result.filter(c => c.contact.funnel_stage_id === filters.funnel_stage_id)
    }

    if (filters.tag_id) {
      result = result.filter(c =>
        (c.contact.tags ?? []).some((t: any) => t.id === filters.tag_id)
      )
    }

    setConversations(result)
    setLoading(false)
  }, [supabase, filters])

  useEffect(() => {
    loadConversations()

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel('public:conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => loadConversations())
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadConversations, supabase])

  return { conversations, loading }
}